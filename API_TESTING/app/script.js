let latestResults = [];
let currentSheetIndex = 0;
async function runTests() {
    const file = document.getElementById('file').files[0];
    const progressBar = document.getElementById('progressBar');
    if (!file) {
        alert("Please upload an Excel file");
        return;
    }
    const clientId = document.getElementById('clientId').value.trim();
    const clientSecret = document.getElementById('clientSecret').value.trim();
    const tokenUrl = document.getElementById('tokenUrl').value.trim();
    if (!clientId || !clientSecret || !tokenUrl) {
        alert("Please fill all authentication fields");
        return;
    }
    progressBar.style.width = "20%";
    const formData = new FormData();
    formData.append("file", file);
    formData.append("clientId", clientId);
    formData.append("clientSecret", clientSecret);
    formData.append("tokenUrl", tokenUrl);
    try {
        const res = await fetch('/api/runTests', { 
            method: "POST", 
            body: formData 
        });
        progressBar.style.width = "70%";
        const data = await res.json();
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
            if (latestResults.length > 0) {
                renderTable(0);
            }
        }, 300);
    } catch (err) {
        alert("Connection failed: " + err.message);
        progressBar.style.width = "0%";
    }
}
// Overall Summary
function renderOverallSummary() {
    if (!latestResults.length) return;
    let total = 0, passed = 0, failed = 0, errors = 0;
    latestResults.forEach(s => {
        total += s.total || 0;
        passed += s.passed || 0;
        failed += s.failed || 0;
        errors += s.errors || 0;
    });
    const html = `
        <div class="card">
            <h3>Overall Summary</h3>
            <div class="summary-box">
                <div class="summary-item total">Total<br><strong>${total}</strong></div>
                <div class="summary-item pass">Passed<br><strong>${passed}</strong></div>
                <div class="summary-item fail">Failed<br><strong>${failed}</strong></div>
                <div class="summary-item error">Errors<br><strong>${errors}</strong></div>
            </div>
        </div>
    `;
    document.getElementById("overallSummary").innerHTML = html;
}
// Sheet Tabs
function renderSheetTabs() {
    let html = '<div class="tab-container">';
    
    latestResults.forEach((sheet, i) => {
        html += `
            <button class="tab ${i === currentSheetIndex ? 'active' : ''}" 
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
// ==================== Render Table (Fixed) ====================
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
                        <th>Test Name</th>
                        <th>Method</th>
                        <th>Status</th>
                        <th>Actual</th>
                        <th>Expected</th>
                        <th>Time</th>
                        <th>Response</th>
                    </tr>
                </thead>
                <tbody>`;
    sheet.results.forEach(r => {
        const statusClass = r.status === 'PASS' ? 'pass-text' : 
                           r.status === 'FAIL' ? 'fail-text' : 'error-text';
        const respBtn = (r.responseData && r.responseData !== "-") 
            ? `<button class="response-btn" onclick='showResponse(${JSON.stringify(r.responseData)})'>View</button>` 
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
function showResponse(data) {
    const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    const displayText = text.length > 1500 
        ? text.substring(0, 1500) + "\n\n... (truncated)" 
        : text;
    
    alert(displayText);
}
// ==================== DOWNLOAD FUNCTIONS ====================
function downloadFullReport(type) {
    if (!latestResults.length) {
        alert("No results to download!");
        return;
    }
    const content = type === 'html' ? generateFullHTMLReport() : JSON.stringify(latestResults, null, 2);
    const blob = new Blob([content], { type: type === 'html' ? 'text/html' : 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `API_Test_Report_Full.${type}`;
    a.click();
}
function downloadCurrentSheet(type) {
    const sheet = latestResults[currentSheetIndex];
    if (!sheet) {
        alert("No sheet selected!");
        return;
    }
    const content = type === 'html' ? generateSheetHTML(sheet) : JSON.stringify(sheet, null, 2);
    const blob = new Blob([content], { type: type === 'html' ? 'text/html' : 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `API_Test_${sheet.sheetName}.${type}`;
    a.click();
}
// HTML Report Generators (Updated with Method column)
function generateFullHTMLReport() {
    let html = `<!DOCTYPE html><html><head><title>API Test Report</title>
<style>
    body{font-family:Arial;padding:20px;}
    h1,h2{color:#007bff;}
    table{width:100%;border-collapse:collapse;margin:20px 0;}
    th,td{border:1px solid #ccc;padding:10px;text-align:center;}
    th{background:#007bff;color:white;}
    .pass{color:green;font-weight:bold;}
    .fail{color:red;font-weight:bold;}
    .error{color:orange;font-weight:bold;}
</style>
</head><body><h1>API Testing Full Report</h1>`;
    latestResults.forEach(sheet => {
        html += `<h2>Sheet: ${sheet.sheetName}</h2>`;
        html += `<p><strong>Total:</strong> ${sheet.total} | <strong>Passed:</strong> ${sheet.passed} | <strong>Failed:</strong> ${sheet.failed} | <strong>Errors:</strong> ${sheet.errors}</p>`;
        html += `<table><tr><th>Test Name</th><th>Method</th><th>Status</th><th>Actual</th><th>Expected</th><th>Time</th><th>Response</th></tr>`;
        sheet.results.forEach(r => {
            const cls = r.status === 'PASS' ? 'pass' : r.status === 'FAIL' ? 'fail' : 'error';
            html += `<tr>
                <td>${r.testName || '-'}</td>
                <td>${r.method || '-'}</td>
                <td class="${cls}">${r.status}</td>
                <td>${r.actual ?? '-'}</td>
                <td>${r.expected ?? '-'}</td>
                <td>${r.time ? r.time + ' ms' : '-'}</td>
                <td>${r.responseData && r.responseData !== '-' ? 'Available' : '-'}</td>
            </tr>`;
        });
        html += `</table><hr>`;
    });
    html += `</body></html>`;
    return html;
}
function generateSheetHTML(sheet) {
    let html = `<!DOCTYPE html><html><head><title>${sheet.sheetName} Report</title>
<style>
    body{font-family:Arial;padding:20px;}
    table{width:100%;border-collapse:collapse;margin:20px 0;}
    th,td{border:1px solid #ccc;padding:10px;text-align:center;}
    th{background:#007bff;color:white;}
    .pass{color:green;font-weight:bold;}
    .fail{color:red;font-weight:bold;}
    .error{color:orange;font-weight:bold;}
</style>
</head><body><h1>Sheet: ${sheet.sheetName}</h1>`;
    html += `<p><strong>Total:</strong> ${sheet.total} | <strong>Passed:</strong> ${sheet.passed} | <strong>Failed:</strong> ${sheet.failed} | <strong>Errors:</strong> ${sheet.errors}</p>`;
    html += `<table><tr><th>Test Name</th><th>Method</th><th>Status</th><th>Actual</th><th>Expected</th><th>Time</th><th>Response</th></tr>`;
    sheet.results.forEach(r => {
        const cls = r.status === 'PASS' ? 'pass' : r.status === 'FAIL' ? 'fail' : 'error';
        html += `<tr>
            <td>${r.testName || '-'}</td>
            <td>${r.method || '-'}</td>
            <td class="${cls}">${r.status}</td>
            <td>${r.actual ?? '-'}</td>
            <td>${r.expected ?? '-'}</td>
            <td>${r.time ? r.time + ' ms' : '-'}</td>
            <td>${r.responseData && r.responseData !== '-' ? 'Available' : '-'}</td>
        </tr>`;
    });
    html += `</table></body></html>`;
    return html;
}
