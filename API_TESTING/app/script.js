let latestResults = [];

async function upload() {
    const file = document.getElementById('file').files[0];
    const progressBar = document.getElementById('progressBar');

    if (!file) {
        alert("Please upload Excel file");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("clientId", clientId.value);
    formData.append("clientSecret", clientSecret.value);
    formData.append("tokenUrl", tokenUrl.value);

    progressBar.style.width = "30%";

    const res = await fetch('/api/runTests', {
        method: "POST",
        body: formData
    });

    progressBar.style.width = "70%";

    const data = await res.json();
    latestResults = data.results || [];

    progressBar.style.width = "100%";

    renderSummary(data);
    renderTable(latestResults);
}

function renderSummary(data) {
    document.getElementById("summary").innerHTML = `
        <div class="card">
            <h3>Summary</h3>
            <div class="summary-box">
                <div class="summary-item total">Total<br>${data.total}</div>
                <div class="summary-item pass">Passed<br>${data.passed}</div>
                <div class="summary-item fail">Failed<br>${data.failed}</div>
                <div class="summary-item error">Errors<br>${data.errors}</div>
            </div>
        </div>
    `;
}

function renderTable(results) {
    let html = `<table>
    <tr>
      <th>Test</th>
      <th>Status</th>
      <th>Actual</th>
      <th>Expected</th>
      <th>Time</th>
    </tr>`;

    results.forEach(r => {
        html += `<tr>
            <td>${r.testName}</td>
            <td class="${r.status === 'PASS' ? 'pass-text' : r.status === 'FAIL' ? 'fail-text' : 'error-text'}">${r.status}</td>
            <td>${r.actual ?? '-'}</td>
            <td>${r.expected ?? '-'}</td>
            <td>${r.time ? r.time + ' ms' : '-'}</td>
        </tr>`;
    });

    html += "</table>";
    document.getElementById("report").innerHTML = html;
}

function downloadReport() {
    let blob = new Blob([JSON.stringify(latestResults, null, 2)], {type: "application/json"});
    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "report.json";
    a.click();
}
