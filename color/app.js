(() => {
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => Array.from(document.querySelectorAll(selector));
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    const wrapHue = (h) => ((h % 360) + 360) % 360;
    const rand = (min, max) => min + Math.random() * (max - min);
    let nextId = 1;
    let dragIndex = null;

    const modeNotes = {
        brand: 'Primary + supporting hue + complementary accent + readable neutrals.',
        ui: 'Interface roles with primary, secondary, accent, background, surface, and text neutrals.',
        monochromatic: 'One hue with controlled OKLCH lightness and chroma steps.',
        analogous: 'Neighboring hues distributed around the anchor color.',
        complementary: 'Anchor hue paired with its opposite hue and controlled lightness variation.',
        split: 'Anchor hue paired with two hues around the direct complement.',
        triadic: 'Three hue families separated by approximately 120 degrees.',
        extracted: 'Representative colors sampled from the current source image.'
    };

    const state = {
        mode: 'brand',
        colors: [],
        selectedId: null,
        candidates: [],
        image: null,
        imageUrl: null
    };

    const els = {
        modeSelect: $('#modeSelect'),
        extractedModeOption: $('#extractedModeOption'),
        modeNote: $('#modeNote'),
        paletteBoard: $('#paletteBoard'),
        generateButton: $('#generateButton'),
        addColorButton: $('#addColorButton'),
        imageButton: $('#imageButton'),
        analyzeButton: $('#analyzeButton'),
        exportButton: $('#exportButton'),
        statusBox: $('#statusBox'),
        imageDialog: $('#imageDialog'),
        analyzeDialog: $('#analyzeDialog'),
        exportDialog: $('#exportDialog'),
        imageInput: $('#imageInput'),
        dropZone: $('#dropZone'),
        imagePreviewWrap: $('#imagePreviewWrap'),
        imagePreview: $('#imagePreview'),
        imageName: $('#imageName'),
        imageMeta: $('#imageMeta'),
        extractCount: $('#extractCount'),
        sampleQuality: $('#sampleQuality'),
        extractButton: $('#extractButton'),
        clearImageButton: $('#clearImageButton'),
        candidateSection: $('#candidateSection'),
        candidateGrid: $('#candidateGrid'),
        applyExtractedButton: $('#applyExtractedButton'),
        inspectColorPicker: $('#inspectColorPicker'),
        inspectHex: $('#inspectHex'),
        inspectOklch: $('#inspectOklch'),
        inspectRgb: $('#inspectRgb'),
        inspectLockButton: $('#inspectLockButton'),
        tonalScale: $('#tonalScale'),
        contrastList: $('#contrastList'),
        scoreGrid: $('#scoreGrid'),
        copyColorsButton: $('#copyColorsButton'),
        copyCssButton: $('#copyCssButton'),
        downloadJsonButton: $('#downloadJsonButton'),
        downloadPngButton: $('#downloadPngButton'),
        exportPreview: $('#exportPreview')
    };

    const hex2 = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0').toUpperCase();
    const rgbToHex = (rgb) => '#' + hex2(rgb.r) + hex2(rgb.g) + hex2(rgb.b);
    const hexToRgb = (hex) => {
        const match = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
        if (!match) return null;
        const n = parseInt(match[1], 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    };
    const srgbToLinear = (v) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const linearToSrgb = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

    function rgbToOklab(rgb) {
        const r = srgbToLinear(rgb.r);
        const g = srgbToLinear(rgb.g);
        const b = srgbToLinear(rgb.b);
        const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
        const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
        const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
        const l_ = Math.cbrt(l);
        const m_ = Math.cbrt(m);
        const s_ = Math.cbrt(s);
        return {
            L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
            a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
            b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
        };
    }

    function oklabToRgbRaw(lab) {
        const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
        const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
        const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;
        const l = Math.pow(l_, 3);
        const m = Math.pow(m_, 3);
        const s = Math.pow(s_, 3);
        return {
            r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
            g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
            b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
        };
    }

    function oklabToOklch(lab) {
        const C = Math.hypot(lab.a, lab.b);
        return { L: lab.L, C: C, h: C < 1e-7 ? 0 : wrapHue(Math.atan2(lab.b, lab.a) * 180 / Math.PI) };
    }

    function oklchToOklab(color) {
        const rad = color.h * Math.PI / 180;
        return { L: color.L, a: color.C * Math.cos(rad), b: color.C * Math.sin(rad) };
    }

    function inGamut(rgb) {
        return rgb.r >= 0 && rgb.r <= 255 && rgb.g >= 0 && rgb.g <= 255 && rgb.b >= 0 && rgb.b <= 255;
    }

    function oklchToRgbGamut(color) {
        const c = { L: color.L, C: color.C, h: color.h };
        let rgb = oklabToRgbRaw(oklchToOklab(c));
        for (let i = 0; i < 36 && !inGamut(rgb); i += 1) {
            c.C *= 0.92;
            rgb = oklabToRgbRaw(oklchToOklab(c));
        }
        return { r: clamp(rgb.r, 0, 255), g: clamp(rgb.g, 0, 255), b: clamp(rgb.b, 0, 255) };
    }

    function hexToOklch(hex) {
        return oklabToOklch(rgbToOklab(hexToRgb(hex)));
    }

    function oklchToHex(color) {
        return rgbToHex(oklchToRgbGamut(color));
    }

    function formatOklch(color) {
        return 'oklch(' + (color.L * 100).toFixed(1) + '% ' + color.C.toFixed(3) + ' ' + Math.round(color.h) + ')';
    }

    function colorDistance(hexA, hexB) {
        const a = rgbToOklab(hexToRgb(hexA));
        const b = rgbToOklab(hexToRgb(hexB));
        return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
    }

    function relativeLuminance(hex) {
        const c = hexToRgb(hex);
        const f = (v) => {
            v /= 255;
            return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    }

    function contrastRatio(a, b) {
        const l1 = relativeLuminance(a);
        const l2 = relativeLuminance(b);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    function bestText(bg) {
        const black = '#111318';
        const white = '#FFFFFF';
        return contrastRatio(black, bg) >= contrastRatio(white, bg) ? black : white;
    }

    function normalizeHex(value) {
        const v = String(value).trim();
        if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
        if (/^[0-9a-f]{6}$/i.test(v)) return '#' + v.toUpperCase();
        return null;
    }

    function createColor(hex, role, locked, description) {
        return {
            id: nextId++,
            hex: normalizeHex(hex) || '#777777',
            role: role || 'Color',
            locked: Boolean(locked),
            description: description || ''
        };
    }

    function setStatus(message, kind) {
        const type = kind || 'neutral';
        els.statusBox.textContent = message;
        els.statusBox.className = 'status-box is-' + type;
    }

    function neutralFrom(anchorHex, L, C) {
        const anchor = hexToOklch(anchorHex);
        return oklchToHex({ L: L, C: Math.min(C == null ? 0.012 : C, Math.max(0.006, anchor.C * 0.18)), h: anchor.h });
    }

    function fromAnchor(anchorHex, deltaHue, lightness, chromaScale) {
        const anchor = hexToOklch(anchorHex);
        return oklchToHex({
            L: lightness == null ? anchor.L : clamp(lightness, 0.08, 0.97),
            C: Math.max(0.015, anchor.C * (chromaScale == null ? 1 : chromaScale)),
            h: wrapHue(anchor.h + deltaHue)
        });
    }

    function randomAnchor() {
        return oklchToHex({
            L: rand(0.48, 0.72),
            C: rand(0.10, 0.23),
            h: rand(0, 360)
        });
    }

    function rolesFor(mode, count) {
        const result = [];
        if (mode === 'brand') {
            const fixed = ['Primary', 'Secondary', 'Accent', 'Background', 'Text'];
            for (let i = 0; i < count; i += 1) result.push(fixed[i] || 'Supporting ' + (i - 4));
            return result;
        }
        if (mode === 'ui') {
            const fixed = ['Primary', 'Secondary', 'Accent', 'Background', 'Surface', 'Text', 'Muted Text'];
            for (let i = 0; i < count; i += 1) result.push(fixed[i] || 'Supporting ' + (i - 6));
            return result;
        }
        if (mode === 'monochromatic') {
            for (let i = 0; i < count; i += 1) result.push(i === Math.floor(count / 2) ? 'Primary' : 'Tone ' + (i + 1));
            return result;
        }
        if (mode === 'extracted') {
            for (let i = 0; i < count; i += 1) result.push(i === 0 ? 'Primary' : 'Extracted ' + (i + 1));
            return result;
        }
        for (let i = 0; i < count; i += 1) result.push(i === 0 ? 'Primary' : (i === 1 ? 'Secondary' : (i === 2 ? 'Accent' : 'Color ' + (i + 1))));
        return result;
    }

    function buildStructuredPalette(anchorHex, count, mode) {
        const roles = rolesFor(mode, count);
        const out = [];
        const anchor = hexToOklch(anchorHex);
        const hueJitter = rand(-5, 5);
        const lightJitter = rand(-0.025, 0.025);
        const chromaJitter = rand(0.91, 1.06);

        if (mode === 'extracted' && state.candidates.length) {
            for (let i = 0; i < count; i += 1) {
                const candidate = state.candidates[i % state.candidates.length];
                out.push({ hex: candidate.hex, role: roles[i], description: 'Representative source-image color' });
            }
            return out;
        }

        if (mode === 'monochromatic') {
            for (let i = 0; i < count; i += 1) {
                const t = count === 1 ? 0.5 : i / (count - 1);
                const L = 0.92 - t * 0.62;
                const middleBoost = 1 - Math.abs(t - 0.5) * 0.7;
                const hex = oklchToHex({ L: L, C: anchor.C * clamp(middleBoost, 0.4, 1), h: anchor.h });
                out.push({ hex: hex, role: roles[i], description: 'Same hue with structured lightness' });
            }
            return out;
        }

        if (mode === 'analogous') {
            const span = Math.min(70, 24 + count * 8);
            for (let i = 0; i < count; i += 1) {
                const t = count === 1 ? 0.5 : i / (count - 1);
                const offset = -span / 2 + span * t + hueJitter;
                const L = clamp(anchor.L + ((i % 2 ? 1 : -1) * 0.035) + lightJitter, 0.38, 0.80);
                out.push({ hex: fromAnchor(anchorHex, offset, L, 0.92 * chromaJitter), role: roles[i], description: 'Analogous hue relationship' });
            }
            return out;
        }

        if (mode === 'complementary') {
            for (let i = 0; i < count; i += 1) {
                const family = i % 2 === 0 ? 0 : 180;
                const step = Math.floor(i / 2);
                const L = clamp(anchor.L + (step - 1) * 0.09 + lightJitter, 0.28, 0.86);
                out.push({ hex: fromAnchor(anchorHex, family + hueJitter, L, (i > 2 ? 0.65 : 0.96) * chromaJitter), role: roles[i], description: 'Complementary hue family' });
            }
            return out;
        }

        if (mode === 'split') {
            const families = [0, 150, 210];
            for (let i = 0; i < count; i += 1) {
                const family = families[i % families.length];
                const step = Math.floor(i / families.length);
                const L = clamp(anchor.L + step * 0.10 - 0.03 + lightJitter, 0.30, 0.86);
                out.push({ hex: fromAnchor(anchorHex, family + hueJitter, L, (step ? 0.68 : 0.94) * chromaJitter), role: roles[i], description: 'Split-complementary hue family' });
            }
            return out;
        }

        if (mode === 'triadic') {
            const families = [0, 120, 240];
            for (let i = 0; i < count; i += 1) {
                const family = families[i % families.length];
                const step = Math.floor(i / families.length);
                const L = clamp(anchor.L + step * 0.10 - 0.03 + lightJitter, 0.30, 0.86);
                out.push({ hex: fromAnchor(anchorHex, family + hueJitter, L, (step ? 0.7 : 0.94) * chromaJitter), role: roles[i], description: 'Triadic hue family' });
            }
            return out;
        }

        if (mode === 'ui') {
            const fixed = [
                fromAnchor(anchorHex, hueJitter, clamp(anchor.L + lightJitter, 0.42, 0.70), chromaJitter),
                fromAnchor(anchorHex, 34 + hueJitter, clamp(anchor.L + 0.05 + lightJitter, 0.46, 0.74), 0.72 * chromaJitter),
                fromAnchor(anchorHex, 180 + hueJitter, clamp(anchor.L + 0.08 + lightJitter, 0.50, 0.78), 0.84 * chromaJitter),
                neutralFrom(anchorHex, 0.975, 0.008),
                '#FFFFFF',
                neutralFrom(anchorHex, 0.19, 0.012),
                neutralFrom(anchorHex, 0.43, 0.010)
            ];
            for (let i = 0; i < count; i += 1) {
                const hex = fixed[i] || fromAnchor(anchorHex, (i - 6) * 42 + hueJitter, clamp(0.55 + (i % 2) * 0.12, 0.35, 0.78), 0.55);
                out.push({ hex: hex, role: roles[i], description: 'UI role generated from the anchor color' });
            }
            return out;
        }

        const brandFixed = [
            fromAnchor(anchorHex, hueJitter, clamp(anchor.L + lightJitter, 0.42, 0.72), chromaJitter),
            fromAnchor(anchorHex, 32 + hueJitter, clamp(anchor.L + 0.05 + lightJitter, 0.44, 0.76), 0.78 * chromaJitter),
            fromAnchor(anchorHex, 180 + hueJitter, clamp(anchor.L + 0.08 + lightJitter, 0.48, 0.80), 0.88 * chromaJitter),
            neutralFrom(anchorHex, 0.97, 0.009),
            neutralFrom(anchorHex, 0.20, 0.012)
        ];
        for (let i = 0; i < count; i += 1) {
            const hex = brandFixed[i] || fromAnchor(anchorHex, (i % 2 ? -1 : 1) * (48 + i * 12) + hueJitter, clamp(0.48 + (i % 3) * 0.12, 0.34, 0.80), 0.62);
            out.push({ hex: hex, role: roles[i], description: 'Brand palette role generated from the anchor color' });
        }
        return out;
    }

    function generatePalette(options) {
        const opts = options || {};
        if (state.colors.length < 2) return;
        const locked = state.colors.filter((color) => color.locked);
        if (locked.length === state.colors.length && !opts.force) {
            setStatus('Every swatch is locked. Unlock at least one color before generating.', 'error');
            return;
        }

        let anchorHex;
        if (locked.length) {
            anchorHex = locked[0].hex;
        } else if (opts.keepAnchor && state.colors.length) {
            anchorHex = state.colors[0].hex;
        } else {
            anchorHex = randomAnchor();
        }

        const suggestions = buildStructuredPalette(anchorHex, state.colors.length, state.mode);
        state.colors = state.colors.map((color, index) => {
            if (color.locked && !opts.force) return color;
            return {
                id: color.id,
                hex: suggestions[index].hex,
                role: suggestions[index].role,
                locked: false,
                description: suggestions[index].description
            };
        });

        if (!state.selectedId || !state.colors.some((color) => color.id === state.selectedId)) {
            state.selectedId = state.colors[0].id;
        }

        renderAll();
        const preserved = locked.length ? ' ' + locked.length + ' locked color' + (locked.length === 1 ? ' was' : 's were') + ' preserved.' : '';
        setStatus('Generated a ' + modeLabel(state.mode) + ' palette.' + preserved, 'success');
    }

    function modeLabel(mode) {
        const option = Array.from(els.modeSelect.options).find((item) => item.value === mode);
        return option ? option.textContent : mode;
    }

    function selectedIndex() {
        const index = state.colors.findIndex((color) => color.id === state.selectedId);
        return index >= 0 ? index : 0;
    }

    function selectedColor() {
        return state.colors[selectedIndex()];
    }

    function renderPalette() {
        els.paletteBoard.style.setProperty('--palette-count', String(state.colors.length));
        els.paletteBoard.innerHTML = state.colors.map((color, index) => {
            const text = bestText(color.hex);
            const selected = color.id === state.selectedId ? ' is-selected' : '';
            const lockLabel = color.locked ? 'Unlock' : 'Lock';
            return '<article class="color-column' + selected + '" draggable="true" data-index="' + index + '" data-id="' + color.id + '" data-locked="' + color.locked + '" style="background:' + color.hex + ';color:' + text + '">' +
                '<div class="color-top-actions">' +
                    '<button class="color-icon-button lock-button' + (color.locked ? ' is-locked' : '') + '" type="button" data-index="' + index + '">' + lockLabel + '</button>' +
                    '<div>' +
                        '<button class="color-icon-button move-left" type="button" data-index="' + index + '" aria-label="Move color left" ' + (index === 0 ? 'disabled' : '') + '>←</button>' +
                        '<button class="color-icon-button move-right" type="button" data-index="' + index + '" aria-label="Move color right" ' + (index === state.colors.length - 1 ? 'disabled' : '') + '>→</button>' +
                        '<button class="color-icon-button remove-color" type="button" data-index="' + index + '" aria-label="Remove color" ' + (state.colors.length <= 2 ? 'disabled' : '') + '>×</button>' +
                    '</div>' +
                '</div>' +
                '<button class="color-open" type="button" data-index="' + index + '" aria-label="Inspect ' + color.hex + '"></button>' +
                '<div class="color-bottom">' +
                    '<span class="color-role">' + escapeHtml(color.role) + '</span>' +
                    '<input class="hex-input" type="text" value="' + color.hex + '" data-index="' + index + '" maxlength="7" spellcheck="false" aria-label="Edit HEX color ' + (index + 1) + '">' +
                    '<div class="color-meta-line"><span><span class="locked-label">Locked</span><span class="unlocked-label">Unlocked</span></span><button class="details-button" type="button" data-index="' + index + '">Details</button></div>' +
                '</div>' +
            '</article>';
        }).join('');

        $$('.lock-button').forEach((button) => button.addEventListener('click', () => toggleLock(Number(button.dataset.index))));
        $$('.move-left').forEach((button) => button.addEventListener('click', () => moveColor(Number(button.dataset.index), -1)));
        $('.move-right').forEach((button) => button.addEventListener('click', () => moveColor(Number(button.dataset.index), 1)));
        $('.remove-color').forEach((button) => button.addEventListener('click', () => removeColor(Number(button.dataset.index))));
        $('.details-button,.color-open').forEach((button) => button.addEventListener('click', () => openAnalyze(Number(button.dataset.index))));
        $$('.hex-input').forEach((input) => {
            input.addEventListener('click', (event) => event.stopPropagation());
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    input.blur();
                }
            });
            input.addEventListener('change', () => updateHex(Number(input.dataset.index), input.value));
        });

        $$('.color-column').forEach((column) => {
            column.addEventListener('dragstart', (event) => {
                dragIndex = Number(column.dataset.index);
                column.classList.add('is-dragging');
                event.dataTransfer.effectAllowed = 'move';
            });
            column.addEventListener('dragend', () => {
                dragIndex = null;
                $$('.color-column').forEach((item) => item.classList.remove('is-dragging', 'is-drop-target'));
            });
            column.addEventListener('dragover', (event) => {
                event.preventDefault();
                if (dragIndex !== null && dragIndex !== Number(column.dataset.index)) column.classList.add('is-drop-target');
            });
            column.addEventListener('dragleave', () => column.classList.remove('is-drop-target'));
            column.addEventListener('drop', (event) => {
                event.preventDefault();
                const target = Number(column.dataset.index);
                column.classList.remove('is-drop-target');
                if (dragIndex === null || dragIndex === target) return;
                const item = state.colors.splice(dragIndex, 1)[0];
                state.colors.splice(target, 0, item);
                dragIndex = null;
                renderAll();
                setStatus('Palette order updated.', 'success');
            });
        });
    }

    function updateHex(index, value) {
        const normalized = normalizeHex(value);
        if (!normalized) {
            renderPalette();
            setStatus('Use a six-digit HEX value such as #64145C.', 'error');
            return;
        }
        state.colors[index].hex = normalized;
        state.selectedId = state.colors[index].id;
        renderAll();
        setStatus(normalized + ' applied to ' + state.colors[index].role + '.', 'success');
    }

    function toggleLock(index) {
        state.colors[index].locked = !state.colors[index].locked;
        state.selectedId = state.colors[index].id;
        renderAll();
        setStatus(state.colors[index].hex + (state.colors[index].locked ? ' locked.' : ' unlocked.'), 'success');
    }

    function moveColor(index, delta) {
        const target = index + delta;
        if (target < 0 || target >= state.colors.length) return;
        const tmp = state.colors[index];
        state.colors[index] = state.colors[target];
        state.colors[target] = tmp;
        state.selectedId = tmp.id;
        renderAll();
        setStatus('Palette order updated.', 'success');
    }

    function addColor() {
        if (state.colors.length >= 10) {
            setStatus('A palette can contain up to 10 swatches.', 'error');
            return;
        }
        const anchor = selectedColor() ? selectedColor().hex : randomAnchor();
        const newHex = fromAnchor(anchor, rand(35, 85), clamp(hexToOklch(anchor).L + rand(-0.08, 0.12), 0.30, 0.84), rand(0.62, 0.92));
        const color = createColor(newHex, 'Color ' + (state.colors.length + 1), false, 'Added color');
        state.colors.push(color);
        state.selectedId = color.id;
        renderAll();
        setStatus('Color added. You can edit, lock, or regenerate it.', 'success');
    }

    function removeColor(index) {
        if (state.colors.length <= 2) {
            setStatus('Keep at least two colors in the palette.', 'error');
            return;
        }
        const removed = state.colors.splice(index, 1)[0];
        if (removed.id === state.selectedId) state.selectedId = state.colors[Math.min(index, state.colors.length - 1)].id;
        renderAll();
        setStatus('Color removed from the palette.', 'success');
    }

    function openAnalyze(index) {
        const safeIndex = clamp(index, 0, state.colors.length - 1);
        state.selectedId = state.colors[safeIndex].id;
        renderPalette();
        renderAnalysis();
        if (!els.analyzeDialog.open) els.analyzeDialog.showModal();
    }

    function renderAnalysis() {
        const color = selectedColor();
        if (!color) return;
        const rgb = hexToRgb(color.hex);
        const oklch = hexToOklch(color.hex);
        els.inspectColorPicker.value = color.hex;
        els.inspectHex.value = color.hex;
        els.inspectOklch.textContent = formatOklch(oklch);
        els.inspectRgb.textContent = 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')';
        els.inspectLockButton.textContent = color.locked ? 'Unlock color' : 'Lock color';
        renderTonalScale(color.hex);
        renderContrast(color.hex);
        renderScores();
    }

    function renderTonalScale(hex) {
        const base = hexToOklch(hex);
        const stops = [
            ['50', 0.97, 0.20], ['100', 0.93, 0.34], ['200', 0.86, 0.55], ['300', 0.77, 0.75],
            ['400', 0.68, 0.90], ['500', 0.60, 1.00], ['600', 0.52, 0.98], ['700', 0.44, 0.90],
            ['800', 0.36, 0.78], ['900', 0.28, 0.65], ['950', 0.20, 0.52]
        ];
        els.tonalScale.innerHTML = stops.map((stop) => {
            const toneHex = oklchToHex({ L: stop[1], C: base.C * stop[2], h: base.h });
            return '<div class="tone"><div class="tone-swatch" style="background:' + toneHex + '"></div><div class="tone-copy"><strong>' + stop[0] + '</strong><span>' + toneHex + '</span></div></div>';
        }).join('');
    }

    function contrastLabel(ratio) {
        if (ratio >= 7) return ['AAA', true];
        if (ratio >= 4.5) return ['AA', true];
        if (ratio >= 3) return ['Large AA', true];
        return ['Fail', false];
    }

    function renderContrast(selectedHex) {
        els.contrastList.innerHTML = state.colors.map((color) => {
            const ratio = contrastRatio(selectedHex, color.hex);
            const result = contrastLabel(ratio);
            return '<div class="contrast-row">' +
                '<div class="contrast-pair"><span class="contrast-mini"><i style="background:' + selectedHex + '"></i><i style="background:' + color.hex + '"></i></span><div><strong>' + escapeHtml(color.role) + '</strong><span>' + selectedHex + ' on ' + color.hex + '</span></div></div>' +
                '<div class="contrast-result"><strong>' + ratio.toFixed(2) + ' : 1</strong><span class="' + (result[1] ? 'pass' : 'fail') + '">' + result[0] + '</span></div>' +
            '</div>';
        }).join('');
    }

    function circularHueDistance(a, b) {
        const d = Math.abs(a - b) % 360;
        return Math.min(d, 360 - d);
    }

    function computeScores() {
        let distanceTotal = 0;
        let distancePairs = 0;
        for (let i = 0; i < state.colors.length; i += 1) {
            for (let j = i + 1; j < state.colors.length; j += 1) {
                distanceTotal += Math.min(1, colorDistance(state.colors[i].hex, state.colors[j].hex) / 0.18);
                distancePairs += 1;
            }
        }
        const distinctness = Math.round(100 * (distancePairs ? distanceTotal / distancePairs : 1));

        const textCoverage = Math.round(100 * state.colors.filter((color) => {
            return Math.max(contrastRatio('#111318', color.hex), contrastRatio('#FFFFFF', color.hex)) >= 4.5;
        }).length / state.colors.length);

        const chromatic = state.colors.map((color) => hexToOklch(color.hex)).filter((color) => color.C > 0.035);
        let hueTotal = 0;
        let huePairs = 0;
        for (let i = 0; i < chromatic.length; i += 1) {
            for (let j = i + 1; j < chromatic.length; j += 1) {
                hueTotal += Math.min(1, circularHueDistance(chromatic[i].h, chromatic[j].h) / 90);
                huePairs += 1;
            }
        }
        const hue = Math.round(100 * (huePairs ? hueTotal / huePairs : 0.75));
        const lockScore = Math.round(100 * state.colors.filter((color) => color.locked).length / state.colors.length);
        return [
            ['Distinctness', distinctness],
            ['Text coverage', textCoverage],
            ['Hue separation', hue],
            ['Locked', lockScore]
        ];
    }

    function renderScores() {
        els.scoreGrid.innerHTML = computeScores().map((item) => {
            return '<div class="score-card"><span>' + item[0] + '</span><strong>' + item[1] + ' / 100</strong><div class="score-meter"><i style="width:' + item[1] + '%"></i></div></div>';
        }).join('');
    }

    function renderExportPreview() {
        els.exportPreview.textContent = cssExport();
    }

    function renderAll() {
        renderPalette();
        els.modeNote.textContent = modeNotes[state.mode] || '';
        els.modeSelect.value = state.mode;
        if (els.analyzeDialog.open) renderAnalysis();
        if (els.exportDialog.open) renderExportPreview();
    }

    function cssVarName(color, index) {
        const role = color.role.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return '--color-' + (role || 'swatch') + (state.colors.filter((item) => item.role === color.role).length > 1 ? '-' + (index + 1) : '');
    }

    function cssExport() {
        return ':root {\n' + state.colors.map((color, index) => '  ' + cssVarName(color, index) + ': ' + color.hex + ';').join('\n') + '\n}';
    }

    function jsonExport() {
        return JSON.stringify({
            generator: 'Astakula Tools Color Palette Generator',
            mode: state.mode,
            palette: state.colors.map((color, index) => ({
                index: index + 1,
                role: color.role,
                hex: color.hex,
                locked: color.locked,
                oklch: formatOklch(hexToOklch(color.hex))
            }))
        }, null, 2);
    }

    async function copyText(value, message) {
        try {
            await navigator.clipboard.writeText(value);
            setStatus(message, 'success');
        } catch (error) {
            setStatus('Clipboard access was blocked by the browser.', 'error');
        }
    }

    function downloadBlob(blob, name) {
        const anchor = document.createElement('a');
        const url = URL.createObjectURL(blob);
        anchor.href = url;
        anchor.download = name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function pngExport() {
        const width = 1400;
        const swatchHeight = 540;
        const footerHeight = 180;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = swatchHeight + footerHeight;
        const ctx = canvas.getContext('2d');
        const cellWidth = width / state.colors.length;

        state.colors.forEach((color, index) => {
            const x = index * cellWidth;
            ctx.fillStyle = color.hex;
            ctx.fillRect(x, 0, Math.ceil(cellWidth), swatchHeight);
            ctx.fillStyle = bestText(color.hex);
            ctx.font = '900 28px Arial';
            ctx.fillText(color.hex, x + 22, swatchHeight - 66);
            ctx.font = '700 15px Arial';
            ctx.fillText(color.role.toUpperCase(), x + 22, swatchHeight - 32);
        });

        ctx.fillStyle = '#F7F4ED';
        ctx.fillRect(0, swatchHeight, width, footerHeight);
        ctx.fillStyle = '#111318';
        ctx.font = '900 36px Arial';
        ctx.fillText('Astakula Color Palette', 42, swatchHeight + 64);
        ctx.font = '600 20px Arial';
        ctx.fillText(modeLabel(state.mode) + ' · ' + state.colors.length + ' colors', 42, swatchHeight + 104);
        ctx.font = '500 16px Arial';
        ctx.fillText('Generated locally at tools.astakula.com/color/', 42, swatchHeight + 140);

        canvas.toBlob((blob) => {
            if (blob) downloadBlob(blob, 'astakula-color-palette.png');
        }, 'image/png');
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    async function loadImageFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            setStatus('Choose a supported image file.', 'error');
            return;
        }
        if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
        state.image = file;
        state.imageUrl = URL.createObjectURL(file);
        els.imagePreview.src = state.imageUrl;
        els.imageName.textContent = file.name;
        els.imageMeta.textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB · ' + file.type.replace('image/', '').toUpperCase();
        els.imagePreviewWrap.classList.remove('hidden');
        els.extractButton.disabled = false;
        els.clearImageButton.disabled = false;
        setStatus('Image ready. Extract representative colors when you are ready.', 'success');
    }

    function clearImage() {
        if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
        state.image = null;
        state.imageUrl = null;
        state.candidates = [];
        els.imageInput.value = '';
        els.imagePreview.removeAttribute('src');
        els.imagePreviewWrap.classList.add('hidden');
        els.extractButton.disabled = true;
        els.clearImageButton.disabled = true;
        els.candidateSection.classList.add('hidden');
        els.extractedModeOption.disabled = true;
        if (state.mode === 'extracted') {
            state.mode = 'brand';
            els.modeSelect.value = state.mode;
            generatePalette({ keepAnchor: true });
        }
        setStatus('Image cleared. The generator is back to rule-based palette modes.', 'neutral');
    }

    function samplePixels(img, quality) {
        const max = quality === 'fine' ? 240 : quality === 'fast' ? 120 : 175;
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, width, height);
        const data = ctx.getImageData(0, 0, width, height).data;
        const step = quality === 'fine' ? 4 : quality === 'fast' ? 16 : 8;
        const pixels = [];
        for (let i = 0; i < data.length; i += 4 * step) {
            if (data[i + 3] < 180) continue;
            const rgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
            const lab = rgbToOklab(rgb);
            if (lab.L < 0.03 || lab.L > 0.985) continue;
            pixels.push({ rgb: rgb, lab: lab });
        }
        return pixels;
    }

    function extractColors(pixels, k) {
        if (!pixels.length) return [];
        const seeds = [pixels[Math.floor(pixels.length / 3)].lab];
        while (seeds.length < k) {
            let best = null;
            let bestDistance = -1;
            const stride = Math.max(1, Math.floor(pixels.length / 1400));
            for (let i = 0; i < pixels.length; i += stride) {
                const p = pixels[i].lab;
                const d = Math.min.apply(null, seeds.map((seed) => Math.hypot(p.L - seed.L, p.a - seed.a, p.b - seed.b)));
                if (d > bestDistance) {
                    bestDistance = d;
                    best = p;
                }
            }
            seeds.push({ L: best.L, a: best.a, b: best.b });
        }

        let centers = seeds.map((seed) => ({ L: seed.L, a: seed.a, b: seed.b }));
        let counts = [];
        for (let iteration = 0; iteration < 10; iteration += 1) {
            const groups = centers.map(() => ({ L: 0, a: 0, b: 0, n: 0 }));
            pixels.forEach((pixel) => {
                let bestIndex = 0;
                let bestDistance = Infinity;
                centers.forEach((center, index) => {
                    const d = Math.pow(pixel.lab.L - center.L, 2) + Math.pow(pixel.lab.a - center.a, 2) + Math.pow(pixel.lab.b - center.b, 2);
                    if (d < bestDistance) {
                        bestDistance = d;
                        bestIndex = index;
                    }
                });
                const group = groups[bestIndex];
                group.L += pixel.lab.L;
                group.a += pixel.lab.a;
                group.b += pixel.lab.b;
                group.n += 1;
            });
            centers = groups.map((group, index) => group.n ? { L: group.L / group.n, a: group.a / group.n, b: group.b / group.n } : centers[index]);
            counts = groups.map((group) => group.n);
        }

        const output = centers.map((lab, index) => ({
            hex: rgbToHex(oklabToRgbRaw(lab)),
            count: counts[index] || 0,
            lab: lab
        })).sort((a, b) => b.count - a.count);

        const merged = [];
        output.forEach((color) => {
            if (merged.every((existing) => colorDistance(existing.hex, color.hex) > 0.055)) merged.push(color);
        });
        return merged.slice(0, k);
    }

    async function extractFromImage() {
        if (!state.image) return;
        setStatus('Analyzing image colors…', 'working');
        els.extractButton.disabled = true;
        await new Promise((resolve) => setTimeout(resolve, 20));
        try {
            const img = new Image();
            img.src = state.imageUrl;
            await img.decode();
            const pixels = samplePixels(img, els.sampleQuality.value);
            state.candidates = extractColors(pixels, Number(els.extractCount.value));
            if (!state.candidates.length) throw new Error('No representative colors found');
            renderCandidates();
            els.candidateSection.classList.remove('hidden');
            els.extractedModeOption.disabled = false;
            setStatus(state.candidates.length + ' perceptually distinct image colors extracted.', 'success');
        } catch (error) {
            console.error(error);
            setStatus('The browser could not extract colors from this image. Try another supported image.', 'error');
        } finally {
            els.extractButton.disabled = false;
        }
    }

    function renderCandidates() {
        const maxCount = Math.max.apply(null, state.candidates.map((color) => color.count));
        els.candidateGrid.innerHTML = state.candidates.map((color, index) => {
            const share = maxCount ? Math.round(color.count / maxCount * 100) : 0;
            return '<button class="candidate-card" type="button" data-index="' + index + '" style="background:' + color.hex + ';color:' + bestText(color.hex) + '">' +
                '<strong>' + color.hex + '</strong><span>' + (index === 0 ? 'Highest sampled share' : 'Relative sample ' + share + '%') + '</span></button>';
        }).join('');
        $$('.candidate-card').forEach((button) => button.addEventListener('click', () => {
            const candidate = state.candidates[Number(button.dataset.index)];
            const index = selectedIndex();
            state.colors[index].hex = candidate.hex;
            renderAll();
            setStatus(candidate.hex + ' applied to the selected swatch.', 'success');
        }));
    }

    function applyExtractedPalette() {
        if (!state.candidates.length) return;
        state.colors = state.candidates.slice(0, 10).map((candidate, index) => createColor(candidate.hex, index === 0 ? 'Primary' : 'Extracted ' + (index + 1), false, 'Representative source-image color'));
        if (state.colors.length < 2) state.colors.push(createColor(fromAnchor(state.colors[0].hex, 180, null, 0.8), 'Extracted 2', false, 'Generated support color'));
        state.selectedId = state.colors[0].id;
        state.mode = 'extracted';
        els.modeSelect.value = state.mode;
        renderAll();
        els.imageDialog.close();
        setStatus('Extracted colors loaded into the interactive palette.', 'success');
    }

    function initPalette() {
        const seed = '#64145C';
        const suggestions = buildStructuredPalette(seed, 5, 'brand');
        state.colors = suggestions.map((item) => createColor(item.hex, item.role, false, item.description));
        state.selectedId = state.colors[0].id;
        renderAll();
    }

    els.generateButton.addEventListener('click', () => generatePalette());
    els.addColorButton.addEventListener('click', addColor);

    els.modeSelect.addEventListener('change', () => {
        const mode = els.modeSelect.value;
        if (mode === 'extracted' && !state.candidates.length) {
            els.modeSelect.value = state.mode;
            setStatus('Extract colors from an image before using Extracted mode.', 'error');
            return;
        }
        state.mode = mode;
        generatePalette({ keepAnchor: true });
    });

    els.imageButton.addEventListener('click', () => els.imageDialog.showModal());
    els.analyzeButton.addEventListener('click', () => openAnalyze(selectedIndex()));
    els.exportButton.addEventListener('click', () => {
        renderExportPreview();
        els.exportDialog.showModal();
    });

    $$('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => {
        const dialog = document.getElementById(button.dataset.closeDialog);
        if (dialog && dialog.open) dialog.close();
    }));

    [els.imageDialog, els.analyzeDialog, els.exportDialog].forEach((dialog) => {
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) dialog.close();
        });
    });

    els.imageInput.addEventListener('change', (event) => loadImageFile(event.target.files[0]));
    ['dragenter', 'dragover'].forEach((type) => els.dropZone.addEventListener(type, (event) => {
        event.preventDefault();
        els.dropZone.classList.add('is-dragging');
    }));
    ['dragleave', 'drop'].forEach((type) => els.dropZone.addEventListener(type, (event) => {
        event.preventDefault();
        els.dropZone.classList.remove('is-dragging');
    }));
    els.dropZone.addEventListener('drop', (event) => loadImageFile(event.dataTransfer.files[0]));
    els.dropZone.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            els.imageInput.click();
        }
    });
    els.extractButton.addEventListener('click', extractFromImage);
    els.clearImageButton.addEventListener('click', clearImage);
    els.applyExtractedButton.addEventListener('click', applyExtractedPalette);

    els.inspectColorPicker.addEventListener('input', () => {
        els.inspectHex.value = els.inspectColorPicker.value.toUpperCase();
    });
    els.inspectColorPicker.addEventListener('change', () => updateHex(selectedIndex(), els.inspectColorPicker.value));
    els.inspectHex.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            els.inspectHex.blur();
        }
    });
    els.inspectHex.addEventListener('change', () => updateHex(selectedIndex(), els.inspectHex.value));
    els.inspectLockButton.addEventListener('click', () => toggleLock(selectedIndex()));

    els.copyColorsButton.addEventListener('click', () => copyText(state.colors.map((color) => color.hex).join('\n'), 'HEX list copied.'));
    els.copyCssButton.addEventListener('click', () => copyText(cssExport(), 'CSS variables copied.'));
    els.downloadJsonButton.addEventListener('click', () => downloadBlob(new Blob([jsonExport()], { type: 'application/json' }), 'astakula-color-palette.json'));
    els.downloadPngButton.addEventListener('click', pngExport);

    document.addEventListener('keydown', (event) => {
        if (event.code !== 'Space' || event.ctrlKey || event.metaKey || event.altKey) return;
        const tag = document.activeElement && document.activeElement.tagName;
        if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag)) return;
        if ($$('dialog[open]').length) return;
        event.preventDefault();
        generatePalette();
    });

    els.paletteBoard.addEventListener('dblclick', (event) => {
        const column = event.target.closest('.color-column');
        if (!column) return;
        openAnalyze(Number(column.dataset.index));
    });

    els.paletteBoard.addEventListener('contextmenu', (event) => {
        const column = event.target.closest('.color-column');
        if (!column) return;
        event.preventDefault();
        removeColor(Number(column.dataset.index));
    });

    initPalette();
})();
