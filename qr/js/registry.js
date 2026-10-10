
import urlGenerator from "./generators/url.js";
import textGenerator from "./generators/text.js";
import whatsappGenerator from "./generators/whatsapp.js";
import wifiGenerator from "./generators/wifi.js";
import emailGenerator from "./generators/email.js";
import phoneGenerator from "./generators/phone.js";
import smsGenerator from "./generators/sms.js";
import vcardGenerator from "./generators/vcard.js";
import locationGenerator from "./generators/location.js";
import eventGenerator from "./generators/event.js";
import imageGenerator from "./generators/image.js";

const generatorList = [
    urlGenerator,
    textGenerator,
    whatsappGenerator,
    wifiGenerator,
    emailGenerator,
    phoneGenerator,
    smsGenerator,
    vcardGenerator,
    locationGenerator,
    eventGenerator,
    imageGenerator
];

/**
 * Validate the structure of a QR generator.
 *
 * Required generator properties:
 *
 * {
 *   id: string,
 *   label: string,
 *   description: string,
 *   icon: string,
 *   fields: array,
 *   generate: function
 * }
 */
export function validateGenerator(generator) {
    if (!generator || typeof generator !== "object") {
        throw new TypeError(
            "QR generator must be an object."
        );
    }

    if (
        typeof generator.id !== "string" ||
        generator.id.trim() === ""
    ) {
        throw new TypeError(
            "QR generator must have a valid id."
        );
    }

    if (
        typeof generator.label !== "string" ||
        generator.label.trim() === ""
    ) {
        throw new TypeError(
            `QR generator "${generator.id}" must have a valid label.`
        );
    }

    if (
        typeof generator.description !== "string"
    ) {
        throw new TypeError(
            `QR generator "${generator.id}" must have a description.`
        );
    }

    if (
        typeof generator.icon !== "string" ||
        generator.icon.trim() === ""
    ) {
        throw new TypeError(
            `QR generator "${generator.id}" must have a valid icon.`
        );
    }

    if (!Array.isArray(generator.fields)) {
        throw new TypeError(
            `QR generator "${generator.id}" must define fields as an array.`
        );
    }

    if (typeof generator.generate !== "function") {
        throw new TypeError(
            `QR generator "${generator.id}" must define a generate() function.`
        );
    }

    validateFields(generator);

    return true;
}

/**
 * Validate all field definitions inside a generator.
 */
function validateFields(generator) {
    const fieldNames = new Set();

    generator.fields.forEach((field, index) => {
        if (!field || typeof field !== "object") {
            throw new TypeError(
                `Field #${index + 1} in generator "${generator.id}" must be an object.`
            );
        }

        if (
            typeof field.name !== "string" ||
            field.name.trim() === ""
        ) {
            throw new TypeError(
                `Field #${index + 1} in generator "${generator.id}" must have a valid name.`
            );
        }

        if (fieldNames.has(field.name)) {
            throw new TypeError(
                `Duplicate field "${field.name}" found in generator "${generator.id}".`
            );
        }

        fieldNames.add(field.name);

        if (
            typeof field.label !== "string" ||
            field.label.trim() === ""
        ) {
            throw new TypeError(
                `Field "${field.name}" in generator "${generator.id}" must have a valid label.`
            );
        }

        if (
            typeof field.type !== "string" ||
            field.type.trim() === ""
        ) {
            throw new TypeError(
                `Field "${field.name}" in generator "${generator.id}" must have a valid type.`
            );
        }

        if (
            field.options !== undefined &&
            !Array.isArray(field.options)
        ) {
            throw new TypeError(
                `Field "${field.name}" in generator "${generator.id}" must define options as an array.`
            );
        }

        if (
            field.type === "select" &&
            !Array.isArray(field.options)
        ) {
            throw new TypeError(
                `Select field "${field.name}" in generator "${generator.id}" must define options.`
            );
        }

        if (Array.isArray(field.options)) {
            validateOptions(
                generator.id,
                field
            );
        }
    });
}

/**
 * Validate select/radio option definitions.
 */
function validateOptions(generatorId, field) {
    const optionValues = new Set();

    field.options.forEach((option, index) => {
        if (!option || typeof option !== "object") {
            throw new TypeError(
                `Option #${index + 1} for field "${field.name}" in generator "${generatorId}" must be an object.`
            );
        }

        if (
            option.value === undefined ||
            option.value === null
        ) {
            throw new TypeError(
                `Option #${index + 1} for field "${field.name}" in generator "${generatorId}" must have a value.`
            );
        }

        if (
            typeof option.label !== "string" ||
            option.label.trim() === ""
        ) {
            throw new TypeError(
                `Option "${option.value}" for field "${field.name}" in generator "${generatorId}" must have a label.`
            );
        }

        const normalizedValue =
            String(option.value);

        if (optionValues.has(normalizedValue)) {
            throw new TypeError(
                `Duplicate option value "${normalizedValue}" found in field "${field.name}" of generator "${generatorId}".`
            );
        }

        optionValues.add(normalizedValue);
    });
}

/**
 * Validate all registered generators
 * and build an immutable registry map.
 */
function createRegistry(generators) {
    const registry = new Map();

    generators.forEach((generator) => {
        validateGenerator(generator);

        if (registry.has(generator.id)) {
            throw new Error(
                `Duplicate QR generator id "${generator.id}".`
            );
        }

        registry.set(
            generator.id,
            generator
        );
    });

    return registry;
}

const registry =
    createRegistry(generatorList);

/**
 * Get one generator by id.
 *
 * Example:
 *
 * getGenerator("whatsapp")
 */
export function getGenerator(id) {
    const key =
        String(id || "").trim();

    if (!key) {
        throw new Error(
            "Generator id is required."
        );
    }

    const generator =
        registry.get(key);

    if (!generator) {
        throw new Error(
            `QR generator "${key}" was not found.`
        );
    }

    return generator;
}

/**
 * Return all registered generators.
 *
 * A copied array is returned so external code
 * cannot mutate the internal registry order.
 */
export function listGenerators() {
    return Array.from(
        registry.values()
    );
}

/**
 * Check whether a generator exists.
 */
export function hasGenerator(id) {
    const key =
        String(id || "").trim();

    if (!key) {
        return false;
    }

    return registry.has(key);
}

/**
 * Return all registered generator ids.
 *
 * Example:
 *
 * [
 *   "url",
 *   "text",
 *   "whatsapp",
 *   ...
 * ]
 */
export function listGeneratorIds() {
    return Array.from(
        registry.keys()
    );
}

/**
 * Number of registered QR generators.
 */
export function getGeneratorCount() {
    return registry.size;
}

/**
 * Validate the complete registry manually.
 *
 * Useful for development checks.
 */
export function validateRegistry() {
    const seenIds = new Set();

    listGenerators().forEach((generator) => {
        validateGenerator(generator);

        if (seenIds.has(generator.id)) {
            throw new Error(
                `Duplicate QR generator id "${generator.id}".`
            );
        }

        seenIds.add(generator.id);
    });

    return true;
}

export default registry;
