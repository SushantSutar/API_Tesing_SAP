const RUN_TESTS_API_URL =
    'https://37ecf082trial-dev-api-testing-srv.cfapps.us10-001.hana.ondemand.com/api/runTests';

let latestResults = [];
let currentSheetIndex = 0;
let runTestsInProgress = false;
let pendingPayloadSheets = null;
let pendingPayloadAuth = null;

// ─── MAIN ENTRY ──────────────────────────────────────────────────────────────
async function runTests() {
    if (runTestsInProgress) return;

    const file = document.getElementById('file').files[0];
    const progressBar = document.getElementById('progressBar');
    const runBtn = document.getElementById('runTestsBtn');

    if (!file) { alert("Please upload an Excel file"); return; }

    const clientId     = document.getElementById('clientId').value.trim();
    const clientSecret = document.getElementById('clientSecret').value.trim();
    const tokenUrl     = document.getElementById('tokenUrl').value.trim();
    const payloadManipulationEnabled = document.getElementById('payloadManipulationToggle')?.checked === true;

    if (!clientId || !clientSecret || !tokenUrl) {
        alert("Please fill all authentication fields");
        return;
    }

    runTestsInProgress = true;
    if (runBtn) runBtn.disabled = true;

    progressBar.style.width = "10%";

    // ── Step 1: Read Excel in browser ────────────────────────────────────────
    let sheetsPayload = [];
    try {
        sheetsPayload = await readExcelToJson(file);
    } catch (e) {
        alert("Failed to read Excel: " + e.message);
        progressBar.style.width = "0%";
        runTestsInProgress = false;
        if (runBtn) runBtn.disabled = false;
        return;
    }

    progressBar.style.width = "30%";

    if (payloadManipulationEnabled) {
        pendingPayloadSheets = sheetsPayload;
        pendingPayloadAuth = { clientId, clientSecret, tokenUrl };

        const postPayloadCount = renderPayloadEditor(sheetsPayload);
        runTestsInProgress = false;
        if (runBtn) runBtn.disabled = false;
        progressBar.style.width = "0%";

        if (postPayloadCount === 0) {
            alert("No POST payloads found in the uploaded Excel file.");
        }
        return;
    }

    await submitBatch({
        clientId,
        clientSecret,
        tokenUrl,
        payloadManipulationEnabled: false,
        sheets: sheetsPayload
    });
}

async function submitManipulatedPayloads() {
    if (runTestsInProgress) return;
    if (!pendingPayloadSheets || !pendingPayloadAuth) {
        alert("Please upload Excel and click Run Tests first.");
        return;
    }

    const editedSheets = cloneJson(pendingPayloadSheets);
    const editors = document.querySelectorAll('[data-payload-editor="true"]');

    for (const editor of editors) {
        const sheetIndex = Number(editor.dataset.sheetIndex);
        const testIndex = Number(editor.dataset.testIndex);
        const text = editor.value.trim();

        try {
            editedSheets[sheetIndex].tests[testIndex].Payload = text ? JSON.parse(text) : null;
        } catch (e) {
            alert(`Invalid JSON in ${editor.dataset.testName}: ${e.message}`);
            editor.focus();
            return;
        }
    }

    await submitBatch({
        ...pendingPayloadAuth,
        payloadManipulationEnabled: true,
        sheets: editedSheets
    });
}

async function submitBatch(batchPayload) {
    const progressBar = document.getElementById('progressBar');
    const runBtn = document.getElementById('runTestsBtn');
    const submitBtn = document.getElementById('submitManipulatedPayloadsBtn');

    runTestsInProgress = true;
    if (runBtn) runBtn.disabled = true;
    if (submitBtn) submitBtn.disabled = true;

    progressBar.style.width = "50%";

    // ── Step 3: Build final batch body ───────────────────────────────────────
    console.log("=== Batch payload being sent ===");
    console.log(JSON.stringify(batchPayload, null, 2));

    // ── Step 4: Single POST to backend ───────────────────────────────────────
    try {
        const res = await fetch(RUN_TESTS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batchPayload)
        });

        progressBar.style.width = "80%";
        const text = await res.text();
        let data = {};
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            if (!res.ok) {
                alert(`Run Tests failed (HTTP ${res.status}): ${text ? text.substring(0, 600) : 'Empty body'}`);
                progressBar.style.width = "0%";
                return;
            }
            alert('Invalid JSON from server: ' + (text || '').substring(0, 400));
            progressBar.style.width = "0%";
            return;
        }

        if (!res.ok) {
            const msg = data.error || data.message || data.detail || text.substring(0, 600);
            alert(`Run Tests failed (HTTP ${res.status}): ${msg}`);
            progressBar.style.width = "0%";
            return;
        }

        if (data.error) {
            alert("Backend Error: " + data.error);
            progressBar.style.width = "0%";
            return;
        }

        latestResults = data.sheets || [];
        progressBar.style.width = "100%";
        pendingPayloadSheets = null;
        pendingPayloadAuth = null;
        clearPayloadEditor();

        setTimeout(() => {
            renderOverallSummary();
            renderSheetTabs();
            if (latestResults.length > 0) renderTable(0);
        }, 300);

    } catch (err) {
        alert("Connection failed: " + err.message);
        progressBar.style.width = "0%";
    } finally {
        runTestsInProgress = false;
        if (runBtn) runBtn.disabled = false;
        if (submitBtn) submitBtn.disabled = false;
    }
}

function renderPayloadEditor(sheetsPayload) {
    const payloadEditor = document.getElementById('payloadEditor');
    if (!payloadEditor) return 0;

    const editors = [];
    sheetsPayload.forEach((sheet, sheetIndex) => {
        sheet.tests.forEach((test, testIndex) => {
            const methodUpper = (test.Method || "GET").toUpperCase();
            if (methodUpper !== "POST" || (test["Skip?"] || "").toLowerCase() === "yes") return;

            editors.push({
                sheetIndex,
                testIndex,
                sheetName: sheet.sheetName || `Sheet ${sheetIndex + 1}`,
                testName: test.TestName || `Test ${testIndex + 1}`,
                url: test.URL || '-',
                payloadText: prettyEditablePayload(test.Payload)
            });
        });
    });

    if (!editors.length) {
        payloadEditor.innerHTML = "";
        return 0;
    }

    let html = `
        <div class="card">
            <div class="payload-editor-header">
                <div>
                    <h3>Review and Manipulate POST Payloads</h3>
                    <p class="toggle-help">Edit the JSON payloads below, then click Run With Edited Payloads.</p>
                </div>
                <strong>${editors.length} POST payload(s)</strong>
            </div>`;

    editors.forEach(editor => {
        html += `
            <div class="payload-editor-item">
                <div class="payload-editor-title">
                    <span>${escapeHtml(editor.sheetName)} / ${escapeHtml(editor.testName)}</span>
                    <span>POST</span>
                </div>
                <div class="payload-url">${escapeHtml(editor.url)}</div>
                <textarea
                    class="payload-textarea"
                    data-payload-editor="true"
                    data-sheet-index="${editor.sheetIndex}"
                    data-test-index="${editor.testIndex}"
                    data-test-name="${escapeHtml(editor.testName)}">${escapeHtml(editor.payloadText)}</textarea>
            </div>`;
    });

    html += `
            <div class="payload-actions">
                <button type="button" id="submitManipulatedPayloadsBtn" class="btn-primary" onclick="submitManipulatedPayloads()">Run With Edited Payloads</button>
                <button type="button" class="btn-info" onclick="cancelPayloadEditing()">Cancel Payload Editing</button>
            </div>
        </div>`;

    payloadEditor.innerHTML = html;
    payloadEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return editors.length;
}

function cancelPayloadEditing() {
    pendingPayloadSheets = null;
    pendingPayloadAuth = null;
    clearPayloadEditor();
}

function clearPayloadEditor() {
    const payloadEditor = document.getElementById('payloadEditor');
    if (payloadEditor) payloadEditor.innerHTML = "";
}

function prettyEditablePayload(rawPayload) {
    if (isEmptyPayloadValue(rawPayload)) return "";

    const payloadObj = parseJsonIfPossibleClient(rawPayload);
    if (
        payloadObj &&
        typeof payloadObj === 'object' &&
        Object.prototype.hasOwnProperty.call(payloadObj, 'D4OXYPALUYAIDNSO')
    ) {
        const innerPayload = parseJsonIfPossibleClient(payloadObj.D4OXYPALUYAIDNSO);
        if (innerPayload && typeof innerPayload === 'object') {
            return JSON.stringify(innerPayload, null, 2);
        }
    }

    return typeof payloadObj === 'string'
        ? JSON.stringify(payloadObj, null, 2)
        : JSON.stringify(payloadObj, null, 2);
}

function parseJsonIfPossibleClient(value) {
    if (typeof value !== 'string') return value;

    try {
        return JSON.parse(value);
    } catch (e) {
        return value;
    }
}

function isEmptyPayloadValue(value) {
    if (value === null || value === undefined) return true;
    return typeof value === 'string' && (value.trim() === '' || value.trim().toUpperCase() === 'NA');
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ─── READ EXCEL → JSON (browser-side SheetJS) ────────────────────────────────
function readExcelToJson(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data     = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheets   = workbook.SheetNames.map(sheetName => {
                    const sheet = workbook.Sheets[sheetName];
                    const tests = XLSX.utils.sheet_to_json(sheet, { defval: "" });
                    return { sheetName, tests };
                });
                resolve(sheets);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error("FileReader failed"));
        reader.readAsArrayBuffer(file);
    });
}

// ─── RENDER HELPERS ───────────────────────────────────────────────────────────
function renderOverallSummary() {
    if (!latestResults.length) return;
    let total = 0, passed = 0, failed = 0, errors = 0;
    latestResults.forEach(s => {
        total  += s.total  || 0;
        passed += s.passed || 0;
        failed += s.failed || 0;
        errors += s.errors || 0;
    });
    document.getElementById("overallSummary").innerHTML = `
        <div class="card">
            <h3>Overall Summary</h3>
            <div class="summary-box">
                <div class="summary-item total">Total<br><strong>${total}</strong></div>
                <div class="summary-item pass">Passed<br><strong>${passed}</strong></div>
                <div class="summary-item fail">Failed<br><strong>${failed}</strong></div>
                <div class="summary-item error">Errors<br><strong>${errors}</strong></div>
            </div>
        </div>`;
}

function renderSheetTabs() {
    let html = '<div class="tab-container">';
    latestResults.forEach((sheet, i) => {
        html += `<button class="tab ${i === currentSheetIndex ? 'active' : ''}"
                         onclick="switchSheet(${i})">
                    ${sheet.sheetName} <span class="count">(${sheet.total})</span>
                 </button>`;
    });
    html += '</div>';
    document.getElementById("sheetTabs").innerHTML = html;
}

function switchSheet(index) {
    currentSheetIndex = index;
    renderSheetTabs();
    renderTable(index);
}

function renderTable(sheetIndex) {
    const sheet = latestResults[sheetIndex];
    if (!sheet) return;

    let html = `
        <div class="card">
            <h3>Sheet: ${sheet.sheetName}</h3>
            <div class="summary-box">
                <div class="summary-item total">Total<br><strong>${sheet.total}</strong></div>
                <div class="summary-item pass">Passed<br><strong>${sheet.passed}</strong></div>
                <div class="summary-item fail">Failed<br><strong>${sheet.failed}</strong></div>
                <div class="summary-item error">Errors<br><strong>${sheet.errors}</strong></div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Test Name</th><th>Method</th><th>Status</th>
                        <th>Actual</th><th>Expected</th><th>Time</th><th>Response</th>
                    </tr>
                </thead>
                <tbody>`;

    sheet.results.forEach((r, rowIdx) => {
        const statusClass = r.status === 'PASS' ? 'pass-text' :
                            r.status === 'FAIL' ? 'fail-text' : 'error-text';
        const hasResp = hasViewableResponse(r);
        const respBtn = hasResp
            ? `<button type="button" class="response-btn" onclick="showResponseForResult(${sheetIndex}, ${rowIdx})">View</button>`
            : '-';
        html += `
            <tr>
                <td style="text-align:left;">${r.testName || '-'}</td>
                <td><strong>${r.method || '-'}</strong></td>
                <td><span class="${statusClass}">${r.status}</span></td>
                <td>${r.actual ?? '-'}</td>
                <td>${r.expected ?? '-'}</td>
                <td>${r.time ? r.time + ' ms' : '-'}</td>
                <td>${respBtn}</td>
            </tr>`;
    });

    html += `</tbody></table></div>`;
    document.getElementById("report").innerHTML = html;
}

function hasViewableResponse(r) {
    if (!r) return false;
    if (r.responseData !== undefined && r.responseData !== null && r.responseData !== '' && r.responseData !== '-') return true;
    if (r.errorMessage) return true;
    return false;
}

/** Safe for any characters — avoids broken onclick when response/error text contains quotes. */
function showResponseForResult(sheetIndex, rowIndex) {
    const sheet = latestResults[sheetIndex];
    const r = sheet && sheet.results[rowIndex];
    if (!r) {
        alert('No result data for this row.');
        return;
    }
    const parts = [];
    if (r.responseData !== undefined && r.responseData !== null && r.responseData !== '') {
        parts.push(typeof r.responseData === 'string' ? r.responseData : JSON.stringify(r.responseData, null, 2));
    }
    if (r.errorMessage) {
        parts.push('Error: ' + r.errorMessage);
    }
    const text = parts.length ? parts.join('\n\n---\n\n') : '(No response body stored for this test.)';
    showResponse(text);
}

function showResponse(data) {
    const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    alert(text.length > 1500 ? text.substring(0, 1500) + "\n\n... (truncated)" : text);
}

// ─── DOWNLOAD ─────────────────────────────────────────────────────────────────
function downloadFullReport(type) {
    if (!latestResults.length) { alert("No results to download!"); return; }
    const content = type === 'html' ? generateFullHTMLReport() : JSON.stringify(latestResults, null, 2);
    triggerDownload(content, `API_Test_Report_Full.${type}`, type);
}

function downloadCurrentSheet(type) {
    const sheet = latestResults[currentSheetIndex];
    if (!sheet) { alert("No sheet selected!"); return; }
    const content = type === 'html' ? generateSheetHTML(sheet) : JSON.stringify(sheet, null, 2);
    triggerDownload(content, `API_Test_${sheet.sheetName}.${type}`, type);
}

function triggerDownload(content, filename, type) {
    const blob = new Blob([content], { type: type === 'html' ? 'text/html' : 'text/plain' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}

function generateFullHTMLReport() {
    let html = `<!DOCTYPE html><html><head><title>API Test Report</title>
<style>body{font-family:Arial;padding:20px;}h1,h2{color:#007bff;}
table{width:100%;border-collapse:collapse;margin:20px 0;}
th,td{border:1px solid #ccc;padding:10px;text-align:center;}
th{background:#007bff;color:white;}
.pass{color:green;font-weight:bold;}.fail{color:red;font-weight:bold;}.error{color:orange;font-weight:bold;}
</style></head><body><h1>API Testing Full Report</h1>`;
    latestResults.forEach(sheet => {
        html += `<h2>Sheet: ${sheet.sheetName}</h2>
<p><strong>Total:</strong> ${sheet.total} | <strong>Passed:</strong> ${sheet.passed} | <strong>Failed:</strong> ${sheet.failed} | <strong>Errors:</strong> ${sheet.errors}</p>
<table><tr><th>Test Name</th><th>Method</th><th>Status</th><th>Actual</th><th>Expected</th><th>Time</th><th>Response</th></tr>`;
        sheet.results.forEach(r => {
            const cls = r.status === 'PASS' ? 'pass' : r.status === 'FAIL' ? 'fail' : 'error';
            html += `<tr><td>${r.testName||'-'}</td><td>${r.method||'-'}</td>
<td class="${cls}">${r.status}</td><td>${r.actual??'-'}</td><td>${r.expected??'-'}</td>
<td>${r.time ? r.time+'ms' : '-'}</td><td>${r.responseData&&r.responseData!=='-'?'Available':'-'}</td></tr>`;
        });
        html += `</table><hr>`;
    });
    return html + `</body></html>`;
}

function generateSheetHTML(sheet) {
    let html = `<!DOCTYPE html><html><head><title>${sheet.sheetName}</title>
<style>body{font-family:Arial;padding:20px;}table{width:100%;border-collapse:collapse;margin:20px 0;}
th,td{border:1px solid #ccc;padding:10px;text-align:center;}th{background:#007bff;color:white;}
.pass{color:green;font-weight:bold;}.fail{color:red;font-weight:bold;}.error{color:orange;font-weight:bold;}
</style></head><body><h1>Sheet: ${sheet.sheetName}</h1>
<p><strong>Total:</strong> ${sheet.total} | <strong>Passed:</strong> ${sheet.passed} | <strong>Failed:</strong> ${sheet.failed} | <strong>Errors:</strong> ${sheet.errors}</p>
<table><tr><th>Test Name</th><th>Method</th><th>Status</th><th>Actual</th><th>Expected</th><th>Time</th><th>Response</th></tr>`;
    sheet.results.forEach(r => {
        const cls = r.status === 'PASS' ? 'pass' : r.status === 'FAIL' ? 'fail' : 'error';
        html += `<tr><td>${r.testName||'-'}</td><td>${r.method||'-'}</td>
<td class="${cls}">${r.status}</td><td>${r.actual??'-'}</td><td>${r.expected??'-'}</td>
<td>${r.time ? r.time+'ms' : '-'}</td><td>${r.responseData&&r.responseData!=='-'?'Available':'-'}</td></tr>`;
    });
    return html + `</table></body></html>`;
}