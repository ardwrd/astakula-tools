import {
    getGenerator,
    listGenerators,
    hasGenerator
} from "./registry.js";

/**
 * FormRenderer
 *
 * Responsibilities:
 * - Read generator definitions from registry
 * - Render generator selector
 * - Render dynamic form fields
 * - Handle generator switching
 * - Handle conditional field visibility
 * - Collect form data
 * - Reset current form
 */
export class FormRenderer {
    constructor({
        selectorContainer,
        formContainer,
        defaultGenerator = "url",
        onGeneratorChange = null
    }) {
        this.selectorContainer =
            this.resolveElement(selectorContainer);

        this.formContainer =
            this.resolveElement(formContainer);

        this.onGeneratorChange =
            typeof onGeneratorChange === "function"
                ? onGeneratorChange
                : null;

        this.activeGeneratorId =
            hasGenerator(defaultGenerator)
                ? defaultGenerator
                : listGenerators()[0]?.id || null;

        this.fieldElements = new Map();
        this.fieldWrappers = new Map();
    }

    /**
     * Resolve DOM element from selector or HTMLElement.
     */
    resolveElement(target) {
        if (target instanceof HTMLElement) {
            return target;
        }

        if (typeof target === "string") {
            const element =
                document.querySelector(target);

            if (!element) {
                throw new Error(
                    `FormRenderer target "${target}" was not found.`
                );
            }

            return element;
        }

        throw new TypeError(
            "FormRenderer target must be an HTMLElement or CSS selector."
        );
    }

    /**
     * Initialize selector and form.
     */
    init() {
        if (!this.activeGeneratorId) {
            throw new Error(
                "No QR generators are registered."
            );
        }

        this.renderGeneratorSelector();

        this.setGenerator(
            this.activeGeneratorId,
            false
        );

        return this;
    }

    /**
     * Render buttons for all QR generators.
     */
    renderGeneratorSelector() {
        this.selectorContainer.innerHTML = "";

        const generators =
            listGenerators();

        const fragment =
            document.createDocumentFragment();

        generators.forEach((generator) => {
            const button =
                document.createElement("button");

            button.type = "button";
            button.className =
                "generator-selector-button";

            button.dataset.generatorId =
                generator.id;

            button.setAttribute(
                "aria-pressed",
                generator.id ===
                    this.activeGeneratorId
                    ? "true"
                    : "false"
            );

            const label =
                document.createElement("span");

            label.className =
                "generator-selector-label";

            label.textContent =
                generator.label;

            button.appendChild(label);

            button.addEventListener(
                "click",
                () => {
                    this.setGenerator(
                        generator.id
                    );
                }
            );

            fragment.appendChild(button);
        });

        this.selectorContainer.appendChild(
            fragment
        );

        this.updateSelectorState();
    }

    /**
     * Change active QR generator.
     */
    setGenerator(
        generatorId,
        emitChange = true
    ) {
        if (!hasGenerator(generatorId)) {
            throw new Error(
                `QR generator "${generatorId}" does not exist.`
            );
        }

        this.activeGeneratorId =
            generatorId;

        this.renderForm();

        this.updateSelectorState();

        if (
            emitChange &&
            this.onGeneratorChange
        ) {
            this.onGeneratorChange(
                this.getActiveGenerator()
            );
        }

        return this.getActiveGenerator();
    }

    /**
     * Return current generator object.
     */
    getActiveGenerator() {
        return getGenerator(
            this.activeGeneratorId
        );
    }

    /**
     * Update selected state of selector buttons.
     */
    updateSelectorState() {
        const buttons =
            this.selectorContainer.querySelectorAll(
                "[data-generator-id]"
            );

        buttons.forEach((button) => {
            const isActive =
                button.dataset.generatorId ===
                this.activeGeneratorId;

            button.classList.toggle(
                "is-active",
                isActive
            );

            button.setAttribute(
                "aria-pressed",
                isActive
                    ? "true"
                    : "false"
            );
        });
    }

    /**
     * Render fields belonging to current generator.
     */
    renderForm() {
        const generator =
            this.getActiveGenerator();

        this.formContainer.innerHTML = "";

        this.fieldElements.clear();
        this.fieldWrappers.clear();

        const fragment =
            document.createDocumentFragment();

        generator.fields.forEach(
            (field) => {
                const fieldElement =
                    this.createField(field);

                fragment.appendChild(
                    fieldElement
                );
            }
        );

        this.formContainer.appendChild(
            fragment
        );

        this.bindConditionalFields();
        this.updateConditionalFields();
    }

    /**
     * Create one field wrapper.
     */
    createField(field) {
        const wrapper =
            document.createElement("div");

        wrapper.className =
            "form-field";

        wrapper.dataset.fieldName =
            field.name;

        this.fieldWrappers.set(
            field.name,
            wrapper
        );

        if (field.type === "checkbox") {
            return this.createCheckboxField(
                field,
                wrapper
            );
        }

        const label =
            document.createElement("label");

        label.htmlFor =
            this.getFieldId(field.name);

        label.className =
            "form-label";

        label.textContent =
            field.label;

        if (field.required) {
            const requiredMark =
                document.createElement("span");

            requiredMark.className =
                "required-mark";

            requiredMark.textContent = " *";

            requiredMark.setAttribute(
                "aria-hidden",
                "true"
            );

            label.appendChild(
                requiredMark
            );
        }

        wrapper.appendChild(label);

        const input =
            this.createInput(field);

        wrapper.appendChild(input);

        if (field.help) {
            wrapper.appendChild(
                this.createHelpText(
                    field.help
                )
            );
        }

        return wrapper;
    }

    /**
     * Create actual input based on field.type.
     */
    createInput(field) {
        let input;

        switch (field.type) {
            case "textarea":
                input =
                    document.createElement(
                        "textarea"
                    );

                if (field.rows) {
                    input.rows =
                        Number(field.rows);
                }

                break;

            case "select":
                input =
                    this.createSelect(field);
                break;

            default:
                input =
                    document.createElement(
                        "input"
                    );

                input.type =
                    this.getSupportedInputType(
                        field.type
                    );

                break;
        }

        this.applyCommonAttributes(
            input,
            field
        );

        this.fieldElements.set(
            field.name,
            input
        );

        return input;
    }

    /**
     * Only allow safe native input types.
     */
    getSupportedInputType(type) {
        const supportedTypes = [
            "text",
            "tel",
            "url",
            "email",
            "password",
            "file",
            "number",
            "date",
            "time"
        ];

        return supportedTypes.includes(type)
            ? type
            : "text";
    }

    /**
     * Create select element.
     */
    createSelect(field) {
        const select =
            document.createElement("select");

        field.options.forEach(
            (option) => {
                const optionElement =
                    document.createElement(
                        "option"
                    );

                optionElement.value =
                    String(option.value);

                optionElement.textContent =
                    option.label;

                select.appendChild(
                    optionElement
                );
            }
        );

        return select;
    }

    /**
     * Create checkbox field.
     */
    createCheckboxField(
        field,
        wrapper
    ) {
        wrapper.classList.add(
            "form-field-checkbox"
        );

        const checkboxRow =
            document.createElement("label");

        checkboxRow.className =
            "checkbox-field";

        checkboxRow.htmlFor =
            this.getFieldId(field.name);

        const input =
            document.createElement("input");

        input.type = "checkbox";
        input.id =
            this.getFieldId(field.name);

        input.name =
            field.name;

        input.checked =
            Boolean(field.default);

        input.required =
            Boolean(field.required);

        const label =
            document.createElement("span");

        label.className =
            "checkbox-label";

        label.textContent =
            field.label;

        checkboxRow.appendChild(input);
        checkboxRow.appendChild(label);

        wrapper.appendChild(
            checkboxRow
        );

        if (field.help) {
            wrapper.appendChild(
                this.createHelpText(
                    field.help
                )
            );
        }

        this.fieldElements.set(
            field.name,
            input
        );

        return wrapper;
    }

    /**
     * Apply metadata defined by generator fields.
     */
    applyCommonAttributes(
        input,
        field
    ) {
        input.id =
            this.getFieldId(field.name);

        input.name =
            field.name;

        input.classList.add(
            "form-control"
        );

        if (field.type === "file" && field.accept) input.accept = field.accept;

        if (field.placeholder) {
            input.placeholder =
                field.placeholder;
        }

        if (field.required) {
            input.required = true;
        }

        if (
            field.autocomplete !==
            undefined
        ) {
            input.autocomplete =
                field.autocomplete;
        }

        if (
            field.maxlength !==
            undefined
        ) {
            input.maxLength =
                Number(field.maxlength);
        }

        if (field.min !== undefined) {
            input.min =
                String(field.min);
        }

        if (field.max !== undefined) {
            input.max =
                String(field.max);
        }

        if (field.step !== undefined) {
            input.step =
                String(field.step);
        }

        if (field.inputmode) {
            input.inputMode =
                field.inputmode;
        }

        if (
            field.default !== undefined &&
            field.type !== "checkbox"
        ) {
            input.value =
                String(field.default);
        }
    }

    /**
     * Create field help text.
     */
    createHelpText(text) {
        const help =
            document.createElement("small");

        help.className =
            "form-help";

        help.textContent =
            text;

        return help;
    }

    /**
     * Create stable DOM id.
     */
    getFieldId(fieldName) {
        return `qr-field-${this.activeGeneratorId}-${fieldName}`;
    }

    /**
     * Watch dependencies used by visibleWhen.
     */
    bindConditionalFields() {
        const generator =
            this.getActiveGenerator();

        const dependencyNames =
            new Set();

        generator.fields.forEach(
            (field) => {
                if (
                    field.visibleWhen?.field
                ) {
                    dependencyNames.add(
                        field.visibleWhen.field
                    );
                }
            }
        );

        dependencyNames.forEach(
            (fieldName) => {
                const input =
                    this.fieldElements.get(
                        fieldName
                    );

                if (!input) {
                    return;
                }

                input.addEventListener(
                    "change",
                    () => {
                        this.updateConditionalFields();
                    }
                );

                input.addEventListener(
                    "input",
                    () => {
                        this.updateConditionalFields();
                    }
                );
            }
        );
    }

    /**
     * Evaluate conditional visibility.
     *
     * Supported:
     *
     * visibleWhen: {
     *   field: "security",
     *   equals: "WPA"
     * }
     *
     * visibleWhen: {
     *   field: "security",
     *   notEquals: "nopass"
     * }
     */
    updateConditionalFields() {
        const generator =
            this.getActiveGenerator();

        generator.fields.forEach(
            (field) => {
                if (!field.visibleWhen) {
                    return;
                }

                const wrapper =
                    this.fieldWrappers.get(
                        field.name
                    );

                const input =
                    this.fieldElements.get(
                        field.name
                    );

                if (!wrapper || !input) {
                    return;
                }

                const dependency =
                    this.fieldElements.get(
                        field.visibleWhen.field
                    );

                if (!dependency) {
                    console.warn(
                        `Conditional dependency "${field.visibleWhen.field}" was not found for field "${field.name}".`
                    );

                    return;
                }

                const dependencyValue =
                    this.getInputValue(
                        dependency
                    );

                let visible = true;

                if (
                    Object.prototype.hasOwnProperty.call(
                        field.visibleWhen,
                        "equals"
                    )
                ) {
                    visible =
                        String(
                            dependencyValue
                        ) ===
                        String(
                            field.visibleWhen.equals
                        );
                }

                if (
                    Object.prototype.hasOwnProperty.call(
                        field.visibleWhen,
                        "notEquals"
                    )
                ) {
                    visible =
                        String(
                            dependencyValue
                        ) !==
                        String(
                            field.visibleWhen.notEquals
                        );
                }

                wrapper.hidden =
                    !visible;

                input.disabled =
                    !visible;

                /*
                 * Clear invisible values so stale
                 * data does not accidentally reach
                 * a generator.
                 */
                if (!visible) {
                    if (
                        input.type ===
                        "checkbox"
                    ) {
                        input.checked = false;
                    } else {
                        input.value = "";
                    }
                }
            }
        );
    }

    /**
     * Return normalized value from input.
     */
    getInputValue(input) {
        if (
            input.type === "checkbox"
        ) {
            return input.checked;
        }

        return input.type === "file" ? input.files?.[0] || null : input.value;
    }

    /**
     * Collect data for active generator.
     *
     * Example:
     *
     * {
     *   phone: "08123456789",
     *   message: "Hello"
     * }
     */
    getFormData() {
        const generator =
            this.getActiveGenerator();

        const data = {};

        generator.fields.forEach(
            (field) => {
                const input =
                    this.fieldElements.get(
                        field.name
                    );

                if (!input) {
                    return;
                }

                /*
                 * Disabled conditional fields
                 * are intentionally excluded.
                 */
                if (input.disabled) {
                    data[field.name] =
                        field.type ===
                        "checkbox"
                            ? false
                            : "";

                    return;
                }

                data[field.name] =
                    this.getInputValue(
                        input
                    );
            }
        );

        return data;
    }

    /**
     * Native browser form validity check.
     *
     * Returns boolean.
     */
    validateNativeFields() {
        let valid = true;

        for (
            const input
            of this.fieldElements.values()
        ) {
            if (input.disabled) {
                continue;
            }

            if (
                typeof input.checkValidity ===
                    "function" &&
                !input.checkValidity()
            ) {
                input.reportValidity();

                valid = false;
                break;
            }
        }

        return valid;
    }

    /**
     * Collect data and execute generator.
     */
    generate() {
        if (!this.validateNativeFields()) {
            return null;
        }

        const generator =
            this.getActiveGenerator();

        const data =
            this.getFormData();

        return generator.generate(data);
    }

    /**
     * Reset current generator fields.
     */
    reset() {
        const generator =
            this.getActiveGenerator();

        generator.fields.forEach(
            (field) => {
                const input =
                    this.fieldElements.get(
                        field.name
                    );

                if (!input) {
                    return;
                }

                if (
                    field.type ===
                    "checkbox"
                ) {
                    input.checked =
                        Boolean(
                            field.default
                        );

                    return;
                }

                input.value =
                    field.default !==
                    undefined
                        ? String(
                            field.default
                        )
                        : "";
            }
        );

        this.updateConditionalFields();
    }

    /**
     * Focus a field by generator field name.
     *
     * Useful after ValidationError:
     *
     * renderer.focusField(error.field)
     */
    focusField(fieldName) {
        if (!fieldName) {
            return;
        }

        const input =
            this.fieldElements.get(
                fieldName
            );

        if (!input) {
            return;
        }

        input.focus();

        if (
            typeof input.select ===
            "function" &&
            [
                "text",
                "tel",
                "email",
                "url",
                "password"
            ].includes(input.type)
        ) {
            input.select();
        }
    }
}

export default FormRenderer;
