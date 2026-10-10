import FormRenderer from "./form-renderer.js";

import {
    ValidationError
} from "./core/validator.js";

import QRRenderer from "./core/qr-renderer.js";

import Exporter from "./core/exporter.js";


class QRApplication {
    constructor() {
        this.formRenderer = null;
        this.qrRenderer = null;
        this.exporter = null;

        this.currentResult = null;
        this.generationSequence = 0;
        this.busy = false;

        this.elements = {};
    }

    /**
     * Bootstrap application.
     */
    init() {
        this.cacheElements();

        this.initializeQrRenderer();
        this.initializeExporter();
        this.initializeFormRenderer();

        this.bindEvents();

        this.resetResult();

        return this;
    }

    /**
     * Cache DOM elements used by the application.
     */
    cacheElements() {
        this.elements = {
            generatorSelector:
                this.getRequiredElement(
                    "#generatorSelector"
                ),

            generatorFields:
                this.getRequiredElement(
                    "#generatorFields"
                ),

            generatorTitle:
                document.querySelector(
                    "#generatorTitle"
                ),

            generatorDescription:
                document.querySelector(
                    "#generatorDescription"
                ),

            generateButton:
                this.getRequiredElement(
                    "#generateButton"
                ),

            resetButton:
                document.querySelector(
                    "#resetButton"
                ),

            resultSection:
                this.getRequiredElement(
                    "#resultSection"
                ),

            qrPreview:
                this.getRequiredElement(
                    "#qrPreview"
                ),

            resultTitle:
                document.querySelector(
                    "#resultTitle"
                ),

            resultValue:
                document.querySelector(
                    "#resultValue"
                ),

            resultDetails:
                document.querySelector(
                    "#resultDetails"
                ),

            payloadOutput:
                this.getRequiredElement(
                    "#payloadOutput"
                ),

            copyPayloadButton:
                document.querySelector(
                    "#copyPayloadButton"
                ),

            downloadPngButton:
                document.querySelector(
                    "#downloadPngButton"
                ),

            downloadSvgButton:
                document.querySelector(
                    "#downloadSvgButton"
                ),

            errorBox:
                document.querySelector(
                    "#errorBox"
                )
        };
    }

    /**
     * Get required DOM element.
     */
    getRequiredElement(selector) {
        const element =
            document.querySelector(selector);

        if (!element) {
            throw new Error(
                `Required application element "${selector}" was not found.`
            );
        }

        return element;
    }

    /**
     * Initialize dynamic form system.
     */
    initializeFormRenderer() {
        this.formRenderer =
            new FormRenderer({
                selectorContainer:
                    this.elements.generatorSelector,

                formContainer:
                    this.elements.generatorFields,

                defaultGenerator:
                    "url",

                onGeneratorChange:
                    (generator) => {
                        this.handleGeneratorChange(
                            generator
                        );
                    }
            });

        this.formRenderer.init();

        this.handleGeneratorChange(
            this.formRenderer.getActiveGenerator()
        );
    }

    /**
     * Initialize QR rendering engine.
     */
    initializeQrRenderer() {
        this.qrRenderer =
            new QRRenderer({
                container:
                    this.elements.qrPreview,

                size: 280,

                foreground:
                    "#111111",

                background:
                    "#ffffff",

                errorCorrection:
                    "M",

                margin: 4
            });
    }

    /**
     * Initialize exporter.
     */
    initializeExporter() {
        this.exporter =
            new Exporter({
                qrRenderer:
                    this.qrRenderer
            });
    }

    /**
     * Bind global application events.
     */
    bindEvents() {
        this.elements.generateButton
            .addEventListener(
                "click",
                () => {
                    this.generateQr();
                }
            );

        if (this.elements.resetButton) {
            this.elements.resetButton
                .addEventListener(
                    "click",
                    () => {
                        this.reset();
                    }
                );
        }

        if (
            this.elements.copyPayloadButton
        ) {
            this.elements.copyPayloadButton
                .addEventListener(
                    "click",
                    () => {
                        this.copyPayload();
                    }
                );
        }

        if (
            this.elements.downloadPngButton
        ) {
            this.elements.downloadPngButton
                .addEventListener(
                    "click",
                    () => {
                        this.downloadPng();
                    }
                );
        }

        if (
            this.elements.downloadSvgButton
        ) {
            this.elements.downloadSvgButton
                .addEventListener(
                    "click",
                    () => {
                        this.downloadSvg();
                    }
                );
        }

        /**
         * Allow Ctrl/Cmd + Enter
         * to generate QR.
         */
        document.addEventListener(
            "keydown",
            (event) => {
                if (
                    (event.ctrlKey ||
                        event.metaKey) &&
                    event.key === "Enter"
                ) {
                    event.preventDefault();

                    this.generateQr();
                }
            }
        );
    }

    /**
     * Handle QR type switching.
     */
    handleGeneratorChange(generator) {
        this.generationSequence += 1;
        this.clearError();
        this.resetResult();

        if (
            this.elements.generatorTitle
        ) {
            this.elements.generatorTitle
                .textContent =
                generator.label;
        }

        if (
            this.elements.generatorDescription
        ) {
            this.elements.generatorDescription
                .textContent =
                generator.description;
        }
    }

    /**
     * Generate QR from active generator.
     */
    async generateQr() {
        if (this.busy) return;
        const sequence = ++this.generationSequence;
        this.clearError();
        this.busy = true;
        this.elements.generateButton.disabled = true;

        try {
            const result =
                await this.formRenderer.generate();
            if (sequence !== this.generationSequence) return;

            if (!result) {
                return;
            }

            if (
                !result.payload ||
                typeof result.payload !==
                    "string"
            ) {
                throw new Error(
                    "Generator did not return a valid QR payload."
                );
            }

            this.qrRenderer.size = this.formRenderer.getActiveGenerator().id === "image" ? 560 : 280;
            this.qrRenderer.render(
                result.payload
            );
            this.currentResult = result;

            this.renderResult(
                result
            );

            this.showResult();

        } catch (error) {
            if (sequence === this.generationSequence) this.handleError(error);
        } finally {
            this.busy = false;
            this.elements.generateButton.disabled = false;
        }
    }

    /**
     * Render payload and preview metadata.
     */
    renderResult(result) {
        const preview =
            result.preview || {};

        this.elements.payloadOutput.value =
            result.payload;

        if (
            this.elements.resultTitle
        ) {
            this.elements.resultTitle
                .textContent =
                preview.title ||
                "QR Code";
        }

        if (
            this.elements.resultValue
        ) {
            this.elements.resultValue
                .textContent =
                preview.value || "";
        }

        this.renderResultDetails(
            preview.details || []
        );
    }

    /**
     * Render preview detail rows.
     */
    renderResultDetails(details) {
        if (
            !this.elements.resultDetails
        ) {
            return;
        }

        this.elements.resultDetails.innerHTML =
            "";

        if (
            !Array.isArray(details) ||
            details.length === 0
        ) {
            this.elements.resultDetails.hidden =
                true;

            return;
        }

        const fragment =
            document.createDocumentFragment();

        details.forEach((detail) => {
            if (
                !detail ||
                detail.value === undefined ||
                detail.value === null ||
                detail.value === ""
            ) {
                return;
            }

            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "result-detail";

            const label =
                document.createElement(
                    "span"
                );

            label.className =
                "result-detail-label";

            label.textContent =
                detail.label || "";

            const value =
                document.createElement(
                    "span"
                );

            value.className =
                "result-detail-value";

            value.textContent =
                String(detail.value);

            row.appendChild(label);
            row.appendChild(value);

            fragment.appendChild(row);
        });

        this.elements.resultDetails.appendChild(
            fragment
        );

        this.elements.resultDetails.hidden =
            this.elements.resultDetails
                .children.length === 0;
    }

    /**
     * Show generated result section.
     */
    showResult() {
        this.elements.resultSection
            .classList.remove(
                "hidden"
            );

        this.elements.resultSection
            .scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
    }

    /**
     * Reset generated result.
     */
    resetResult() {
        this.currentResult = null;

        if (this.qrRenderer) {
            this.qrRenderer.clear();
        }

        if (
            this.elements.payloadOutput
        ) {
            this.elements.payloadOutput.value =
                "";
        }

        if (
            this.elements.resultTitle
        ) {
            this.elements.resultTitle
                .textContent = "";
        }

        if (
            this.elements.resultValue
        ) {
            this.elements.resultValue
                .textContent = "";
        }

        if (
            this.elements.resultDetails
        ) {
            this.elements.resultDetails
                .innerHTML = "";

            this.elements.resultDetails.hidden =
                true;
        }

        if (
            this.elements.resultSection
        ) {
            this.elements.resultSection
                .classList.add(
                    "hidden"
                );
        }
    }

    /**
     * Reset current form.
     */
    reset() {
        this.generationSequence += 1;
        this.clearError();

        this.formRenderer.reset();

        this.resetResult();
    }

    /**
     * Copy QR payload to clipboard.
     */
    async copyPayload() {
        if (
            !this.currentResult?.payload
        ) {
            return;
        }

        try {
            await navigator.clipboard.writeText(
                this.currentResult.payload
            );

            this.setTemporaryButtonText(
                this.elements.copyPayloadButton,
                "Copied!"
            );

        } catch {
            this.elements.payloadOutput.select();

            document.execCommand(
                "copy"
            );

            this.setTemporaryButtonText(
                this.elements.copyPayloadButton,
                "Copied!"
            );
        }
    }

    /**
     * Download QR as PNG.
     */
    async downloadPng() {
        if (!this.currentResult) {
            return;
        }

        try {
            await this.exporter.downloadPng(
                this.createFileName(
                    "png"
                )
            );
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Download QR as SVG.
     */
    async downloadSvg() {
        if (!this.currentResult) {
            return;
        }

        try {
            await this.exporter.downloadSvg(
                this.createFileName(
                    "svg"
                )
            );
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Create useful export filename.
     */
    createFileName(extension) {
        const generator =
            this.formRenderer
                .getActiveGenerator();

        const timestamp =
            new Date()
                .toISOString()
                .replace(
                    /[:.]/g,
                    "-"
                );

        return (
            `astakula-qr-` +
            `${generator.id}-` +
            `${timestamp}.${extension}`
        );
    }

    /**
     * Handle validation/application errors.
     */
    handleError(error) {
        console.error(error);

        if (
            error instanceof ValidationError
        ) {
            this.showError(
                error.message
            );

            if (error.field) {
                this.formRenderer.focusField(
                    error.field
                );
            }

            return;
        }

        this.showError(
            error?.message ||
            "Terjadi kesalahan saat membuat QR Code."
        );
    }

    /**
     * Display error message.
     */
    showError(message) {
        if (
            this.elements.errorBox
        ) {
            this.elements.errorBox
                .textContent =
                message;

            this.elements.errorBox
                .classList.remove(
                    "hidden"
                );

            return;
        }

        alert(message);
    }

    /**
     * Clear error message.
     */
    clearError() {
        if (
            !this.elements.errorBox
        ) {
            return;
        }

        this.elements.errorBox
            .textContent = "";

        this.elements.errorBox
            .classList.add(
                "hidden"
            );
    }

    /**
     * Temporary visual feedback
     * for action buttons.
     */
    setTemporaryButtonText(
        button,
        text,
        duration = 1500
    ) {
        if (!button) {
            return;
        }

        const original =
            button.textContent;

        button.textContent =
            text;

        button.disabled =
            true;

        window.setTimeout(
            () => {
                button.textContent =
                    original;

                button.disabled =
                    false;
            },
            duration
        );
    }
}


/**
 * Application bootstrap.
 */
document.addEventListener(
    "DOMContentLoaded",
    () => {
        try {
            const app =
                new QRApplication();

            app.init();

            /**
             * Expose during development.
             * Useful from browser console:
             *
             * window.astakulaQrApp
             */
            window.astakulaQrApp =
                app;

        } catch (error) {
            console.error(
                "Failed to initialize Astakula QR Tools:",
                error
            );
        }
    }
);

export default QRApplication;
