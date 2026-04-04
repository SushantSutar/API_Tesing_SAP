async function loadData() {

    const url = "/odata/v4/count-log/asfasfcqfcacac";

    const response = await fetch(url);
    const data = await response.json();

    const tableBody = document.querySelector("#trafficTable tbody");

    tableBody.innerHTML = "";

    data.value.forEach(row => {

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${row.IPADD}</td>
            <td>${row.REQCT}</td>
            <td>${row.REQDT}</td>
            <td>${row.CHNBY || '-'}</td>
        `;

        tableBody.appendChild(tr);

    });

}

window.onload = loadData;
