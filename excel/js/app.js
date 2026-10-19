const XLSX = window.XLSX;
const JSZip = window.JSZip;

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_MERGE_FILES = 10;
const MAX_MERGE_TOTAL = 250 * 1024 * 1024;
const PREVIEW_LIMIT = 300;
const ACCEPTED_EXTENSIONS = /\.(xlsx|xls|csv|json)$/i;

const elements = {
    sourceInput: document.querySelector("#sourceInput"),
    dropZone: document.querySelector("#dropZone"),
    filePanel: document.querySelector("#filePanel"),
    fileName: document.querySelector("#fileName"),
    fileMeta: document.querySelector("#fileMeta"),
    resetWorkbookButton: document.querySelector("#resetWorkbookButton"),
    removeFileButton: document.querySelector("#removeFileButton"),
    modeTabs: [...document.querySelectorAll("[data-mode]")],
    panels: [...document.querySelectorAll("[data-panel]")],
    statusBox: document.querySelector("#statusBox"),
    sheetToolbar: document.querySelector("#sheetToolbar"),
    sheetSelect: document.querySelector("#sheetSelect"),
    sheetRows: document.querySelector("#sheetRows"),
    sheetColumns: document.querySelector("#sheetColumns"),
    searchInput: document.querySelector("#searchInput"),
    exportXlsxButton: document.querySelector("#exportXlsxButton"),
    exportCsvButton: document.querySelector("#exportCsvButton"),
    exportJsonButton: document.querySelector("#exportJsonButton"),
    exportWorkbookButton: document.querySelector("#exportWorkbookButton"),
    extractSheetButton: document.querySelector("#extractSheetButton"),
    splitWorkbookButton: document.querySelector("#splitWorkbookButton"),
    combineSheetsButton: document.querySelector("#combineSheetsButton"),
    mergeInput: document.querySelector("#mergeInput"),
    mergeWorkbooksButton: document.querySelector("#mergeWorkbooksButton"),
    removeEmptyRows: document.querySelector("#removeEmptyRows"),
    removeEmptyColumns: document.querySelector("#removeEmptyColumns"),
    trimWhitespace: document.querySelector("#trimWhitespace"),
    findText: document.querySelector("#findText"),
    replaceText: document.querySelector("#replaceText"),
    renameColumnSelect: document.querySelector("#renameColumnSelect"),
    renameColumnValue: document.querySelector("#renameColumnValue"),
    renameColumnButton: document.querySelector("#renameColumnButton"),
    sortColumnSelect: document.querySelector("#sortColumnSelect"),
    sortOrderSelect: document.querySelector("#sortOrderSelect"),
    sortRowsButton: document.querySelector("#sortRowsButton"),
    applyCleaningButton: document.querySelector("#applyCleaningButton"),
    duplicateMeta: document.querySelector("#duplicateMeta"),
    duplicateColumns: document.querySelector("#duplicateColumns"),
    findDuplicatesButton: document.querySelector("#findDuplicatesButton"),
    removeDuplicatesButton: document.querySelector("#removeDuplicatesButton"),
    previewSection: document.querySelector("#previewSection"),
    previewMeta: document.querySelector("#previewMeta"),
    previewTable: document.querySelector("#previewTable")
};

let sourceFile = null;
let workbook = null;
let activeSheetName = "";
let duplicateRows = new Set();
let loadSequence = 0;

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** index);
    return `${value.toFixed(index === 0 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`;
}

function baseName(name) {
    return name.replace(/\.(xlsx|xls|csv|json)$/i, "") || "spreadsheet";
}

function safeFilename(value) {
    return String(value || "sheet").replace(/[\\/:*?"<>|]+/g, "-").trim() || "sheet";
}

function setStatus(message, state = "neutral") {
    elements.statusBox.textContent = message;
    elements.statusBox.className = `status-box is-${state}`;
}

function requireWorkbook() {
    if (!workbook || !activeSheetName) throw new Error("Choose a spreadsheet first.");
}

function currentSheet() {
    requireWorkbook();
    return workbook.Sheets[activeSheetName];
}

function sheetToAoa(sheet, raw = true) {
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw, blankrows: true });
}

function getSheetDimensions(sheet) {
    const rows = sheetToAoa(sheet);
    const rowCount = rows.length;
    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
    return { rows, rowCount, columnCount };
}

function columnLabels(sheet) {
    const { rows, columnCount } = getSheetDimensions(sheet);
    const headers = rows[0] || [];
    return Array.from({ length: columnCount }, (_, index) => {
        const label = String(headers[index] ?? "").trim();
        return { index, label: label || `Column ${XLSX.utils.encode_col(index)}` };
    });
}

function uniqueSheetName(existing, desired) {
    const clean = String(desired || "Sheet").replace(/[\\/?*\[\]:]/g, "-").slice(0, 31) || "Sheet";
    if (!existing.includes(clean)) return clean;
    let counter = 2;
    while (existing.includes(`${clean.slice(0, 27)} ${counter}`)) counter += 1;
    return `${clean.slice(0, 27)} ${counter}`;
}

async function readWorkbookFile(file) {
    if (!XLSX) throw new Error("Spreadsheet library did not load. Refresh the page and try again.");
    if (!file || !ACCEPTED_EXTENSIONS.test(file.name)) throw new Error("Choose an XLSX, XLS, CSV, or JSON file.");
    if (file.size > MAX_FILE_SIZE) throw new Error("The file must be 50 MB or smaller.");

    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "json") {
        const text = await file.text();
        let data;
        try { data = JSON.parse(text); } catch { throw new Error("Could not parse this JSON file."); }
        const wb = XLSX.utils.book_new();
        let sheet;
        if (Array.isArray(data) && data.every((row) => Array.isArray(row))) {
            sheet = XLSX.utils.aoa_to_sheet(data);
        } else if (Array.isArray(data)) {
            sheet = XLSX.utils.json_to_sheet(data);
        } else if (data && typeof data === "object") {
            sheet = XLSX.utils.json_to_sheet([data]);
        } else {
            throw new Error("JSON must contain an object, array of objects, or array of arrays.");
        }
        XLSX.utils.book_append_sheet(wb, sheet, "Data");
        return wb;
    }

    if (ext === "csv") {
        const text = await file.text();
        return XLSX.read(text, { type: "string", cellDates: true });
    }

    const bytes = await file.arrayBuffer();
    return XLSX.read(bytes, { type: "array", cellDates: true });
}

async function loadSource(file) {
    const sequence = ++loadSequence;
    setStatus(`Reading ${file.name}…`, "working");
    const parsed = await readWorkbookFile(file);
    if (sequence !== loadSequence) return false; // A newer file or Remove takes precedence.
    if (!parsed.SheetNames?.length) throw new Error("This file does not contain a readable sheet.");

    sourceFile = file;
    workbook = parsed;
    activeSheetName = parsed.SheetNames[0];
    duplicateRows.clear();
    elements.filePanel.classList.remove("hidden");
    elements.fileName.textContent = file.name;
    elements.fileMeta.textContent = `${formatBytes(file.size)} · ${parsed.SheetNames.length} ${parsed.SheetNames.length === 1 ? "sheet" : "sheets"}`;
    elements.sheetToolbar.classList.remove("hidden");
    elements.previewSection.classList.remove("hidden");
    populateSheetSelect();
    updateWorkspace();
    setStatus(`${file.name} loaded.`, "success");
    return true;
}

async function resetWorkbook() {
    if (!sourceFile) return;
    const sequence = loadSequence + 1;
    try {
        if (await loadSource(sourceFile)) setStatus("Workbook reset to the original file.", "success");
    } catch (error) {
        if (sequence === loadSequence) setStatus(error.message, "error");
    }
}

function removeSource() {
    loadSequence += 1; // Invalidate any pending asynchronous read.
    sourceFile = null;
    workbook = null;
    activeSheetName = "";
    duplicateRows.clear();
    elements.sourceInput.value = "";
    elements.mergeInput.value = "";
    elements.filePanel.classList.add("hidden");
    elements.sheetToolbar.classList.add("hidden");
    elements.previewSection.classList.add("hidden");
    elements.previewTable.replaceChildren();
    elements.sheetSelect.replaceChildren();
    elements.searchInput.value = "";
    elements.duplicateMeta.textContent = "Not checked";
    elements.removeDuplicatesButton.disabled = true;
    populateColumnControls();
    setStatus("Choose a spreadsheet to begin.", "neutral");
}

function populateSheetSelect() {
    elements.sheetSelect.replaceChildren();
    if (!workbook) return;
    for (const name of workbook.SheetNames) {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        option.selected = name === activeSheetName;
        elements.sheetSelect.append(option);
    }
}

function populateColumnControls() {
    const selects = [elements.renameColumnSelect, elements.sortColumnSelect, elements.duplicateColumns];
    selects.forEach((select) => select.replaceChildren());
    if (!workbook || !activeSheetName) return;
    const columns = columnLabels(currentSheet());
    for (const column of columns) {
        for (const select of selects) {
            const option = document.createElement("option");
            option.value = String(column.index);
            option.textContent = `${XLSX.utils.encode_col(column.index)} · ${column.label}`;
            select.append(option);
        }
    }
}

function updateWorkspace() {
    if (!workbook || !activeSheetName) return;
    const { rowCount, columnCount } = getSheetDimensions(currentSheet());
    elements.sheetRows.textContent = `${rowCount} ${rowCount === 1 ? "row" : "rows"}`;
    elements.sheetColumns.textContent = `${columnCount} ${columnCount === 1 ? "column" : "columns"}`;
    populateColumnControls();
    duplicateRows.clear();
    elements.duplicateMeta.textContent = "Not checked";
    elements.removeDuplicatesButton.disabled = true;
    renderPreview();
}

function renderPreview() {
    if (!workbook || !activeSheetName) return;
    const rows = sheetToAoa(currentSheet(), false);
    const query = elements.searchInput.value.trim().toLowerCase();
    const indexed = rows.map((row, index) => ({ row, index }));
    const filtered = query
        ? indexed.filter(({ row }) => row.some((cell) => String(cell ?? "").toLowerCase().includes(query)))
        : indexed;
    const limited = filtered.slice(0, PREVIEW_LIMIT);
    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);

    elements.previewTable.replaceChildren();
    if (!rows.length || columnCount === 0) {
        const tbody = document.createElement("tbody");
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.textContent = "This sheet is empty.";
        tr.append(td);
        tbody.append(tr);
        elements.previewTable.append(tbody);
        elements.previewMeta.textContent = "0 rows";
        return;
    }

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    const rowHead = document.createElement("th");
    rowHead.textContent = "#";
    headRow.append(rowHead);
    for (let col = 0; col < columnCount; col += 1) {
        const th = document.createElement("th");
        th.textContent = XLSX.utils.encode_col(col);
        headRow.append(th);
    }
    thead.append(headRow);

    const tbody = document.createElement("tbody");
    for (const { row, index } of limited) {
        const tr = document.createElement("tr");
        if (duplicateRows.has(index)) tr.classList.add("is-duplicate");
        const number = document.createElement("td");
        number.textContent = String(index + 1);
        tr.append(number);
        for (let col = 0; col < columnCount; col += 1) {
            const td = document.createElement("td");
            td.textContent = String(row[col] ?? "");
            tr.append(td);
        }
        tbody.append(tr);
    }

    elements.previewTable.append(thead, tbody);
    const suffix = filtered.length > PREVIEW_LIMIT ? ` · showing first ${PREVIEW_LIMIT}` : "";
    elements.previewMeta.textContent = `${filtered.length} matching ${filtered.length === 1 ? "row" : "rows"}${suffix}`;
}

function setActiveMode(mode) {
    for (const tab of elements.modeTabs) {
        const active = tab.dataset.mode === mode;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
    }
    for (const panel of elements.panels) panel.classList.toggle("hidden", panel.dataset.panel !== mode);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function workbookBlob(wb) {
    const bytes = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function activeSheetWorkbook() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, currentSheet(), activeSheetName.slice(0, 31));
    return wb;
}

function exportActiveXlsx() {
    try {
        requireWorkbook();
        downloadBlob(workbookBlob(activeSheetWorkbook()), `${baseName(sourceFile.name)}-${safeFilename(activeSheetName)}.xlsx`);
        setStatus("Active sheet exported as XLSX.", "success");
    } catch (error) { setStatus(error.message, "error"); }
}

function exportCsv() {
    try {
        requireWorkbook();
        const csv = XLSX.utils.sheet_to_csv(currentSheet());
        downloadBlob(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }), `${baseName(sourceFile.name)}-${safeFilename(activeSheetName)}.csv`);
        setStatus("Active sheet exported as CSV.", "success");
    } catch (error) { setStatus(error.message, "error"); }
}

function exportJson() {
    try {
        requireWorkbook();
        const data = XLSX.utils.sheet_to_json(currentSheet(), { defval: "", raw: false });
        downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `${baseName(sourceFile.name)}-${safeFilename(activeSheetName)}.json`);
        setStatus("Active sheet exported as JSON.", "success");
    } catch (error) { setStatus(error.message, "error"); }
}

function exportWorkbook() {
    try {
        requireWorkbook();
        downloadBlob(workbookBlob(workbook), `${baseName(sourceFile.name)}-edited.xlsx`);
        setStatus("Current workbook exported as XLSX.", "success");
    } catch (error) { setStatus(error.message, "error"); }
}

async function splitWorkbook() {
    try {
        requireWorkbook();
        if (!JSZip) throw new Error("ZIP library did not load. Refresh and try again.");
        setStatus("Preparing split workbook package…", "working");
        const zip = new JSZip();
        for (const name of workbook.SheetNames) {
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, workbook.Sheets[name], name.slice(0, 31));
            const bytes = XLSX.write(wb, { bookType: "xlsx", type: "array" });
            zip.file(`${safeFilename(name)}.xlsx`, bytes);
        }
        const blob = await zip.generateAsync({ type: "blob" });
        downloadBlob(blob, `${baseName(sourceFile.name)}-sheets.zip`);
        setStatus(`${workbook.SheetNames.length} sheets packaged into a ZIP.`, "success");
    } catch (error) { setStatus(error.message, "error"); }
}

function combineSheets() {
    try {
        requireWorkbook();
        const unionHeaders = [];
        const seenHeaders = new Set();
        const sheetObjects = [];

        for (const name of workbook.SheetNames) {
            const data = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: "", raw: false });
            sheetObjects.push({ name, data });
            for (const row of data) {
                for (const key of Object.keys(row)) {
                    if (!seenHeaders.has(key)) { seenHeaders.add(key); unionHeaders.push(key); }
                }
            }
        }

        const combined = [];
        for (const { name, data } of sheetObjects) {
            for (const row of data) combined.push({ __sheet: name, ...row });
        }
        const header = ["__sheet", ...unionHeaders];
        const sheet = XLSX.utils.json_to_sheet(combined, { header });
        const desired = uniqueSheetName(workbook.SheetNames, "Combined");
        XLSX.utils.book_append_sheet(workbook, sheet, desired);
        activeSheetName = desired;
        populateSheetSelect();
        updateWorkspace();
        setStatus(`${workbook.SheetNames.length - 1} sheets combined into “${desired}”.`, "success");
    } catch (error) { setStatus(error.message, "error"); }
}

async function mergeWorkbooks() {
    const files = [...elements.mergeInput.files];
    if (files.length < 2) { setStatus("Choose at least two files to merge.", "error"); return; }
    if (files.length > MAX_MERGE_FILES) { setStatus(`Merge supports up to ${MAX_MERGE_FILES} files at once.`, "error"); return; }
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_MERGE_TOTAL) { setStatus("Selected files exceed the 250 MB merge limit.", "error"); return; }
    try {
        setStatus(`Reading ${files.length} files…`, "working");
        const output = XLSX.utils.book_new();
        for (const file of files) {
            const wb = await readWorkbookFile(file);
            for (const name of wb.SheetNames) {
                const desired = uniqueSheetName(output.SheetNames, `${baseName(file.name)}-${name}`);
                XLSX.utils.book_append_sheet(output, wb.Sheets[name], desired);
            }
        }
        downloadBlob(workbookBlob(output), "merged-workbooks.xlsx");
        setStatus(`${files.length} files merged into ${output.SheetNames.length} sheets.`, "success");
    } catch (error) { setStatus(error.message, "error"); }
}

function setCurrentSheetFromAoa(rows) {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    workbook.Sheets[activeSheetName] = sheet;
    duplicateRows.clear();
    updateWorkspace();
}

function normalizeCell(value, trim) {
    if (typeof value !== "string") return value;
    return trim ? value.trim() : value;
}

function applyCleaning() {
    try {
        requireWorkbook();
        let rows = sheetToAoa(currentSheet());
        const trim = elements.trimWhitespace.checked;
        const find = elements.findText.value;
        const replace = elements.replaceText.value;

        rows = rows.map((row) => row.map((cell) => {
            let value = normalizeCell(cell, trim);
            if (find && typeof value === "string") value = value.split(find).join(replace);
            return value;
        }));

        if (elements.removeEmptyRows.checked) rows = rows.filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""));

        if (elements.removeEmptyColumns.checked && rows.length) {
            const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
            const keep = [];
            for (let col = 0; col < columnCount; col += 1) {
                if (rows.some((row) => String(row[col] ?? "").trim() !== "")) keep.push(col);
            }
            rows = rows.map((row) => keep.map((col) => row[col] ?? ""));
        }

        setCurrentSheetFromAoa(rows);
        setStatus("Cleaning applied to the active sheet.", "success");
    } catch (error) { setStatus(error.message, "error"); }
}

function renameColumn() {
    try {
        requireWorkbook();
        const index = Number(elements.renameColumnSelect.value);
        const next = elements.renameColumnValue.value.trim();
        if (!Number.isInteger(index) || !next) throw new Error("Choose a column and enter a new header.");
        const rows = sheetToAoa(currentSheet());
        if (!rows.length) throw new Error("This sheet is empty.");
        while (rows[0].length <= index) rows[0].push("");
        rows[0][index] = next;
        setCurrentSheetFromAoa(rows);
        elements.renameColumnValue.value = "";
        setStatus("Column header renamed.", "success");
    } catch (error) { setStatus(error.message, "error"); }
}

function sortRows() {
    try {
        requireWorkbook();
        const index = Number(elements.sortColumnSelect.value);
        if (!Number.isInteger(index)) throw new Error("Choose a column to sort.");
        const rows = sheetToAoa(currentSheet());
        if (rows.length <= 1) throw new Error("This sheet has no data rows to sort.");
        const header = rows.shift();
        const direction = elements.sortOrderSelect.value === "desc" ? -1 : 1;
        rows.sort((a, b) => {
            const left = a[index] ?? "";
            const right = b[index] ?? "";
            if (typeof left === "number" && typeof right === "number") return (left - right) * direction;
            return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" }) * direction;
        });
        setCurrentSheetFromAoa([header, ...rows]);
        setStatus("Rows sorted.", "success");
    } catch (error) { setStatus(error.message, "error"); }
}

function duplicateKey(row, mode, selectedColumns) {
    const values = mode === "columns" ? selectedColumns.map((index) => row[index] ?? "") : row;
    return JSON.stringify(values.map((value) => typeof value === "string" ? value.trim() : value));
}

function findDuplicates() {
    try {
        requireWorkbook();
        const rows = sheetToAoa(currentSheet());
        if (rows.length <= 1) throw new Error("This sheet has no data rows to compare.");
        const mode = document.querySelector('input[name="duplicateMode"]:checked')?.value || "row";
        const selectedColumns = [...elements.duplicateColumns.selectedOptions].map((option) => Number(option.value));
        if (mode === "columns" && !selectedColumns.length) throw new Error("Select at least one column for duplicate checking.");

        duplicateRows.clear();
        const seen = new Map();
        for (let index = 1; index < rows.length; index += 1) {
            const key = duplicateKey(rows[index], mode, selectedColumns);
            if (seen.has(key)) {
                duplicateRows.add(index);
                duplicateRows.add(seen.get(key));
            } else {
                seen.set(key, index);
            }
        }

        const duplicateDataRows = [...duplicateRows].filter((index) => index > 0).length;
        elements.duplicateMeta.textContent = duplicateDataRows ? `${duplicateDataRows} duplicate rows highlighted` : "No duplicates found";
        elements.removeDuplicatesButton.disabled = duplicateDataRows === 0;
        renderPreview();
        setStatus(duplicateDataRows ? `${duplicateDataRows} rows belong to duplicate groups.` : "No duplicate rows found.", duplicateDataRows ? "neutral" : "success");
    } catch (error) { setStatus(error.message, "error"); }
}

function removeDuplicates() {
    try {
        requireWorkbook();
        const rows = sheetToAoa(currentSheet());
        if (rows.length <= 1) throw new Error("This sheet has no data rows.");
        const mode = document.querySelector('input[name="duplicateMode"]:checked')?.value || "row";
        const selectedColumns = [...elements.duplicateColumns.selectedOptions].map((option) => Number(option.value));
        if (mode === "columns" && !selectedColumns.length) throw new Error("Select at least one column for duplicate checking.");
        const header = rows[0];
        const seen = new Set();
        const cleaned = [header];
        let removed = 0;
        for (let index = 1; index < rows.length; index += 1) {
            const key = duplicateKey(rows[index], mode, selectedColumns);
            if (seen.has(key)) { removed += 1; continue; }
            seen.add(key);
            cleaned.push(rows[index]);
        }
        setCurrentSheetFromAoa(cleaned);
        elements.duplicateMeta.textContent = `${removed} rows removed`;
        setStatus(`${removed} duplicate ${removed === 1 ? "row" : "rows"} removed.`, "success");
    } catch (error) { setStatus(error.message, "error"); }
}

async function handleIncomingFile(file) {
    const sequence = loadSequence + 1;
    try { await loadSource(file); }
    catch (error) { if (sequence === loadSequence) setStatus(error.message, "error"); }
    finally { if (sequence === loadSequence) elements.sourceInput.value = ""; }
}

function extractPastedFile(event) {
    const files = [...(event.clipboardData?.files || [])];
    return files.find((file) => ACCEPTED_EXTENSIONS.test(file.name)) || null;
}

elements.sourceInput.addEventListener("change", () => { const [file] = elements.sourceInput.files; if (file) handleIncomingFile(file); });
elements.dropZone.addEventListener("dragover", (event) => { event.preventDefault(); elements.dropZone.classList.add("is-dragging"); });
elements.dropZone.addEventListener("dragleave", () => elements.dropZone.classList.remove("is-dragging"));
elements.dropZone.addEventListener("drop", (event) => { event.preventDefault(); elements.dropZone.classList.remove("is-dragging"); const [file] = event.dataTransfer.files; if (file) handleIncomingFile(file); });
document.addEventListener("paste", (event) => { if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return; const file = extractPastedFile(event); if (file) handleIncomingFile(file); });
elements.resetWorkbookButton.addEventListener("click", resetWorkbook);
elements.removeFileButton.addEventListener("click", removeSource);
elements.modeTabs.forEach((tab) => tab.addEventListener("click", () => setActiveMode(tab.dataset.mode)));
elements.sheetSelect.addEventListener("change", () => { activeSheetName = elements.sheetSelect.value; duplicateRows.clear(); updateWorkspace(); setStatus(`Active sheet: ${activeSheetName}.`, "neutral"); });
elements.searchInput.addEventListener("input", renderPreview);
elements.exportXlsxButton.addEventListener("click", exportActiveXlsx);
elements.exportCsvButton.addEventListener("click", exportCsv);
elements.exportJsonButton.addEventListener("click", exportJson);
elements.exportWorkbookButton.addEventListener("click", exportWorkbook);
elements.extractSheetButton.addEventListener("click", exportActiveXlsx);
elements.splitWorkbookButton.addEventListener("click", splitWorkbook);
elements.combineSheetsButton.addEventListener("click", combineSheets);
elements.mergeWorkbooksButton.addEventListener("click", mergeWorkbooks);
elements.applyCleaningButton.addEventListener("click", applyCleaning);
elements.renameColumnButton.addEventListener("click", renameColumn);
elements.sortRowsButton.addEventListener("click", sortRows);
elements.findDuplicatesButton.addEventListener("click", findDuplicates);
elements.removeDuplicatesButton.addEventListener("click", removeDuplicates);

setActiveMode("viewer");
populateColumnControls();
