const XLSX = require('xlsx');
const axios = require('axios');
module.exports = {
    run: async function (req) {
        try {
            console.log("API Testing Started");
            const file = req._.req.file;
            const buffer = file.buffer;
            const { clientId, clientSecret, tokenUrl } = req._.req.body;
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            // TOKEN
            const tokenRes = await axios.post(tokenUrl,
                `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
            const token = tokenRes.data.access_token;
            let allSheetResults = [];
            // LOOP SHEETS- parse the whole sheet
            for (let sheetName of workbook.SheetNames) {
                console.log("Running Sheet:", sheetName);
                const sheet = workbook.Sheets[sheetName];
                const testCases = XLSX.utils.sheet_to_json(sheet, {
                    defval: "" // prevents undefined
                });
                let results = [];
                for (let test of testCases) {
                    if ((test["Skip?"] || "").toLowerCase() === "yes") continue;
                    try {
                        let headers = {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        };
                        // headers
                        if (test.Headers && test.Headers !== "NA") {
                            test.Headers.split(";").forEach(h => {
                                const [k, v] = h.split(":");
                                if (k && v) headers[k.trim()] = v.trim();
                            });
                        }
                        // payload
                        let payload = null;
                        if (test.Payload && test.Payload !== "NA") {
                            payload = JSON.parse(test.Payload);
                        }
                        const config = {
                            method: test.Method,
                            url: test.URL,
                            headers,
                            timeout: 20000
                        };
                        if (payload && test.Method.toUpperCase() !== "GET") {
                            config.data = payload;
                        }
                        const start = Date.now();
                        const response = await axios(config);
                        const time = Date.now() - start;
                        // RESPONSE VALIDATION - it will check the resopnse is corect or not
                        let isPass = false;
                        if (response.status == test.ExpectedStatus) {
                            if (test.ExpectedResponseContains && test.ExpectedResponseContains !== "NA") {
                                const respStr = JSON.stringify(response.data);
                                isPass = respStr.includes(test.ExpectedResponseContains);
                            } else {
                                isPass = true;
                            }
                        }
                        results.push({
                            testName: test.TestName,
                            // method: config.method,// me -- to add which method get/post
                            status: isPass ? "PASS" : "FAIL",
                            actual: response.status,
                            expected: test.ExpectedStatus,
                            time,
                            responseData: test.Method !== "GET"
                                ? JSON.stringify(response.data).substring(0, 200)
                                : "-" // me - to check and send response of get also 
                                // : JSON.stringify(response.data)// me
                        });
                    } catch (err) {
                        results.push({
                            testName: test.TestName,
                            // method: config.method,// me -- to add which method get/post
                            status: "ERROR",
                            actual: err.response?.status || err.message,
                            expected: test.ExpectedStatus,
                            time: "-",
                            responseData: err.response?.data
                                ? JSON.stringify(err.response.data).substring(0, 200)
                                : "-"
                        });
                    }
                }
                console.log("=----------------result = ",results);
                
                allSheetResults.push({
                    sheetName,
                    total: results.length,
                    passed: results.filter(r => r.status === "PASS").length,
                    failed: results.filter(r => r.status === "FAIL").length,
                    errors: results.filter(r => r.status === "ERROR").length,
                    results
                });
            }
            return { sheets: allSheetResults };
        } catch (err) {
            return { error: err.message };
        }
    }
};
