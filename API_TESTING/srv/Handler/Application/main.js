const XLSX = require('xlsx');
const axios = require('axios');

module.exports = {

    run: async function (req) {

        try {
            console.log("API Testing Started");

            const file = req._.req.file;
            const buffer = file.buffer;

            const {
                clientId,
                clientSecret,
                tokenUrl
            } = req._.req.body;

            // 1. Read Excel
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const testCases = XLSX.utils.sheet_to_json(sheet);

            console.log(`Loaded ${testCases.length} test cases`);

            // 2. Get Token
            console.log("Fetching Token");
            const tokenRes = await axios.post(tokenUrl,
                `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );
            console.log(tokenRes.data);


            const token = tokenRes.data.access_token;
            console.log("Token:", token);

            let results = [];

            // 3. Execute Test Cases
            for (let test of testCases) {

                // Skip if required
                if (test["Skip?"] && test["Skip?"].toLowerCase() === "yes") {
                    continue;
                }

                try {

                    let headers = {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    };

                    // Custom Headers
                    if (test.Headers && test.Headers !== "NA") {
                        test.Headers.split(";").forEach(h => {
                            const [k, v] = h.split(":");
                            if (k && v) headers[k.trim()] = v.trim();
                        });
                    }

                    // Payload Handling
                    let payload = null;

                    if (test.Payload && test.Payload !== "NA") {
                        try {
                            payload = JSON.parse(test.Payload);

                            // Handle nested JSON string (your POST case)
                            for (let key in payload) {
                                if (typeof payload[key] === "string") {
                                    try {
                                        payload[key] = JSON.parse(payload[key]);
                                    } catch {
                                        // ignore if not JSON
                                    }
                                }
                            }

                        } catch (e) {
                            console.log("Payload Parse Error:", e.message);
                            throw new Error("Invalid JSON Payload");
                        }
                    }

                    const config = {
                        method: test.Method,
                        url: test.URL,
                        headers: headers,
                        timeout: 20000
                    };

                    //Only attach data for NON-GET
                    if (payload && test.Method.toUpperCase() !== "GET") {
                        config.data = payload;
                    }

                    const start = Date.now();

                    const response = await axios(config);

                    const time = Date.now() - start;

                    results.push({
                        testName: test.TestName,
                        status: response.status == test.ExpectedStatus ? "PASS" : "FAIL",
                        actual: response.status,
                        expected: test.ExpectedStatus,
                        time: time
                    });

                } catch (err) {

                    console.log("FULL ERROR:", err.message);

                    results.push({
                        testName: test.TestName,
                        status: "ERROR",
                        actual: err.response ? err.response.status : err.message,
                        expected: test.ExpectedStatus,
                        time: "-"
                    });
                }
            }

            console.log("Testing Completed"); console.log("FINAL RESULTS :", results);

            return {
                total: results.length,
                passed: results.filter(r => r.status === "PASS").length,
                failed: results.filter(r => r.status === "FAIL").length,
                errors: results.filter(r => r.status === "ERROR").length,
                results: results
            };

        } catch (err) {

            console.log("GLOBAL ERROR:", err.message);

            return {
                error: err.message
            };
        }
    }
};