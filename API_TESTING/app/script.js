const RUN_TESTS_API_URL =
    'https://37ecf082trial-dev-api-testing-srv.cfapps.us10-001.hana.ondemand.com/api/runTests';

let latestResults = [];
let currentSheetIndex = 0;
let runTestsInProgress = false;

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

    // ── Step 2: Wrap each test payload into D4OXYPALUYAIDNSO envelope ────────
    sheetsPayload = sheetsPayload.map(sheet => {
        const tests = sheet.tests.map(test => ({
            ...test,
            Payload: buildPayloadEnvelope(test.Payload)
        }));
        return { ...sheet, tests };
    });

    progressBar.style.width = "50%";

    // ── Step 3: Build final batch body ───────────────────────────────────────
    const batchPayload = {
        clientId,
        clientSecret,
        tokenUrl,
        sheets: sheetsPayload
    };

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
    }
}

// ─── BUILD D4OXYPALUYAIDNSO ENVELOPE ─────────────────────────────────────────
//
// Rules:
//  1. null / "" / "NA"          → return null (no payload)
//  2. Already has D4OXYPALUYAIDNSO key  → use AS-IS, no double-wrap
//  3. Plain JSON object/string  → wrap: { D4OXYPALUYAIDNSO: "<stringified>" }
//
// Excel examples and what gets sent to backend:
//
//  Excel value (string):  {"GRVID":68,"ROLL":"UNION"}
//  Sent:                  { "D4OXYPALUYAIDNSO": "{\"GRVID\":68,\"ROLL\":\"UNION\"}" }
//
//  Excel value (already wrapped):  {"D4OXYPALUYAIDNSO":"U2FsdGVk..."}
//  Sent:                           { "D4OXYPALUYAIDNSO": "U2FsdGVk..." }  ← no double wrap
//
function buildPayloadEnvelope(rawPayload) {
    // ── Case 1: empty / NA ────────────────────────────────────────────────────
    if (rawPayload === null || rawPayload === undefined) return null;
    if (typeof rawPayload === 'string' && (rawPayload.trim() === '' || rawPayload.trim() === 'NA')) return null;

    // ── Normalise to object if it's still a string ────────────────────────────
    let payloadObj;
    if (typeof rawPayload === 'string') {
        try {
            payloadObj = JSON.parse(rawPayload);
        } catch (e) {
            // Not valid JSON — wrap the raw string as-is (pre-encrypted maybe)
            console.warn("Payload is not valid JSON, wrapping as-is:", rawPayload);
            return { D4OXYPALUYAIDNSO: rawPayload };
        }
    } else {
        // SheetJS already parsed it into an object
        payloadObj = rawPayload;
    }

    // ── Case 2: already has D4OXYPALUYAIDNSO → use as-is, no double-wrap ─────
    if (payloadObj.hasOwnProperty('D4OXYPALUYAIDNSO')) {
        console.log("Payload already has D4OXYPALUYAIDNSO key — sending as-is");
        return payloadObj;  // { D4OXYPALUYAIDNSO: "encrypted-or-stringified-value" }
    }

    // ── Case 3: plain object → stringify and wrap ─────────────────────────────
    return {
        D4OXYPALUYAIDNSO: JSON.stringify(payloadObj)
    };
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