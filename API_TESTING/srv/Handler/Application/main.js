
const axios = require('axios');
// const cds = require('@sap/cds');
const CryptoJS = require('crypto-js');

// ─── CONSTANTS (adjust to match your project) ────────────────────────────────
const constants = {
    APP_GRVCOM:   'GRVCOM',
    FUN_COM_FTPYL: 'fetchPayload',
    FUN_COM_GASK:  'GetAESKey'
};

// ─── ERROR LOG (stub — wire to your real createErrorLog if available) ─────────
async function createErrorLog(app, fun, id, msg) {
    console.error(`[ErrorLog] App:${app} | Fun:${fun} | Id:${id} | ${msg}`);
}

// ─── GET AES KEY FROM DB ──────────────────────────────────────────────────────
// async function GetAESKey(req) {
//     try {
//         const query = `SELECT LABTX FROM GRV_M_LABEL WHERE LABTY = 'ZKEY' AND ISDEL = '0'`;
//         const rs = await cds.run(query);
//         let keyFetch;
//         if (rs.length !== 0) {
//             keyFetch = rs[0].LABTX;
//         } else {
//             throw new Error('Key mismatched, If issue persist please contact admin.');
//         }
//         return keyFetch.substring(2, keyFetch.length - 4); // extract the usable portion
//     } catch (e) {
//         await createErrorLog(constants.APP_GRVCOM, constants.FUN_COM_GASK, '', e.toString());
//         throw e.toString();
//     }
// }

async function GetAESKey(req) {
    return "1234567890123456";
}

// ─── FETCH & DECRYPT PAYLOAD ──────────────────────────────────────────────────
// Expects req.data = { D4OXYPALUYAIDNSO: "stringified-json-or-encrypted-string" }
// 1. Try JSON.parse directly (plain stringified JSON)
// 2. If that fails → AES decrypt using key from DB → then JSON.parse
async function fetchPayload(req) {
    try {
        const payload = req.data;
        if (payload) {
            try {
                // Case 1: plain stringified JSON  e.g. "{\"GRVID\":68,\"ROLL\":\"UNION\"}"
                return JSON.parse(payload.D4OXYPALUYAIDNSO);
            } catch (e) {
                // Case 2: AES encrypted string
                const secretKey   = await GetAESKey(req);
                const decrypted   = CryptoJS.AES.decrypt(payload.D4OXYPALUYAIDNSO, secretKey);
                const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
                return JSON.parse(decryptedText);
            }
        } else {
            throw new Error("No data found in the request: " + JSON.stringify(req));
        }
    } catch (e) {
        await createErrorLog(constants.APP_GRVCOM, constants.FUN_COM_FTPYL, '', e.toString());
        throw e;
    }
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
module.exports = {

    fetchPayload,   // export so other handlers can reuse
    GetAESKey,      // export so other handlers can reuse

    run: async function (req) {
        try {
            console.log("API Testing Started — Batch Mode");

            const body = req._.req.body;
            const { clientId, clientSecret, tokenUrl, sheets } = body;

            if (!clientId || !clientSecret || !tokenUrl || !sheets) {
                return { error: "Missing required fields: clientId, clientSecret, tokenUrl, sheets" };
            }

            // ── Get OAuth token ───────────────────────────────────────────────
            const tokenRes = await axios.post(
                tokenUrl,
                `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
            const token = tokenRes.data.access_token;
            console.log("Token obtained successfully");

            let allSheetResults = [];

            // ── Loop each sheet ───────────────────────────────────────────────
            for (let sheetObj of sheets) {
                const { sheetName, tests } = sheetObj;
                console.log(`Running Sheet: ${sheetName} | Tests: ${tests.length}`);

                let results = [];

                for (let test of tests) {
                    if ((test["Skip?"] || "").toLowerCase() === "yes") continue;

                    const methodUpper = (test.Method || "GET").toUpperCase();

                    try {
                        // ── Headers ───────────────────────────────────────────
                        let headers = {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        };
                        if (test.Headers && test.Headers !== "NA") {
                            test.Headers.split(";").forEach(h => {
                                const colonIdx = h.indexOf(":");
                                if (colonIdx > -1) {
                                    const k = h.substring(0, colonIdx).trim();
                                    const v = h.substring(colonIdx + 1).trim();
                                    if (k) headers[k] = v;
                                }
                            });
                        }

                        // ── Payload — wrap in D4OXYPALUYAIDNSO envelope ───────
                        // The Excel Payload column contains a plain JSON string.
                        // We stringify it and wrap it:
                        //   { "D4OXYPALUYAIDNSO": "{\"GRVID\":68,\"ROLL\":\"UNION\"}" }
                        // The backend fetchPayload() will unwrap + parse it.
                        let axiosPayload = null;
                        if (test.Payload && test.Payload !== "NA") {
                            // test.Payload can be a raw JSON string from Excel
                            // or already an object (SheetJS parsed it)
                            const innerStr = typeof test.Payload === 'object'
                                ? JSON.stringify(test.Payload)   // object → stringify
                                : test.Payload;                  // already a string

                            // Validate it is parseable JSON before wrapping
                            JSON.parse(innerStr); // throws if malformed

                            axiosPayload = {
                                D4OXYPALUYAIDNSO: innerStr   // stringified inner JSON
                            };
                        }

                        const config = {
                            method: methodUpper,
                            url: test.URL,
                            headers,
                            timeout: 30000
                        };
                        if (axiosPayload !== null && methodUpper !== "GET") {
                            config.data = axiosPayload;
                        }

                        console.log(`  [${methodUpper}] ${test.TestName} -> ${test.URL}`);
                        if (axiosPayload) {
                            console.log(`  Wrapped payload: ${JSON.stringify(axiosPayload).substring(0, 150)}`);
                        }

                        const start    = Date.now();
                        const response = await axios(config);
                        const time     = Date.now() - start;

                        // ── Validation ────────────────────────────────────────
                        let isPass = false;
                        if (String(response.status) === String(test.ExpectedStatus)) {
                            if (test.ExpectedResponseContains && test.ExpectedResponseContains !== "NA") {
                                isPass = JSON.stringify(response.data).includes(test.ExpectedResponseContains);
                            } else {
                                isPass = true;
                            }
                        }

                        results.push({
                            testName:     test.TestName,
                            method:       methodUpper,
                            status:       isPass ? "PASS" : "FAIL",
                            actual:       response.status,
                            expected:     test.ExpectedStatus,
                            time,
                            responseData: JSON.stringify(response.data).substring(0, 500)
                        });

                    } catch (err) {
                        let responseData = err.message;
                        if (err.response?.data !== undefined && err.response?.data !== '') {
                            const d = err.response.data;
                            responseData = typeof d === 'string' ? d : JSON.stringify(d);
                            if (responseData.length > 2000) responseData = responseData.substring(0, 2000) + '…';
                        }
                        results.push({
                            testName:     test.TestName,
                            method:       methodUpper,
                            status:       "ERROR",
                            actual:       err.response?.status ?? err.message,
                            expected:     test.ExpectedStatus,
                            time:         "-",
                            responseData,
                            errorMessage: err.message
                        });
                    }
                }

                console.log(`Sheet [${sheetName}] done — ${results.length} tests run`);
                allSheetResults.push({
                    sheetName,
                    total:   results.length,
                    passed:  results.filter(r => r.status === "PASS").length,
                    failed:  results.filter(r => r.status === "FAIL").length,
                    errors:  results.filter(r => r.status === "ERROR").length,
                    results
                });
            }

            return { sheets: allSheetResults };

        } catch (err) {
            console.error("Handler error:", err);
            return { error: err.message };
        }
    }
};