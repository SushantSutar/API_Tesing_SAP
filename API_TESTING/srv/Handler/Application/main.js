
// const axios = require('axios');
// // const cds = require('@sap/cds');
// const CryptoJS = require('crypto-js');

// // ─── CONSTANTS (adjust to match your project) ────────────────────────────────
// const constants = {
//     APP_GRVCOM:   'GRVCOM',
//     FUN_COM_FTPYL: 'fetchPayload',
//     FUN_COM_GASK:  'GetAESKey'
// };

// // ─── ERROR LOG (stub — wire to your real createErrorLog if available) ─────────
// async function createErrorLog(app, fun, id, msg) {
//     console.error(`[ErrorLog] App:${app} | Fun:${fun} | Id:${id} | ${msg}`);
// }

// // ─── GET AES KEY FROM DB ──────────────────────────────────────────────────────
// // async function GetAESKey(req) {
// //     try {
// //         const query = `SELECT LABTX FROM GRV_M_LABEL WHERE LABTY = 'ZKEY' AND ISDEL = '0'`;
// //         const rs = await cds.run(query);
// //         let keyFetch;
// //         if (rs.length !== 0) {
// //             keyFetch = rs[0].LABTX;
// //         } else {
// //             throw new Error('Key mismatched, If issue persist please contact admin.');
// //         }
// //         return keyFetch.substring(2, keyFetch.length - 4); // extract the usable portion
// //     } catch (e) {
// //         await createErrorLog(constants.APP_GRVCOM, constants.FUN_COM_GASK, '', e.toString());
// //         throw e.toString();
// //     }
// // }

// async function GetAESKey(req) {
//     return "1234567890123456";
// }

// // ─── FETCH & DECRYPT PAYLOAD ──────────────────────────────────────────────────
// // Expects req.data = { D4OXYPALUYAIDNSO: "stringified-json-or-encrypted-string" }
// // 1. Try JSON.parse directly (plain stringified JSON)
// // 2. If that fails → AES decrypt using key from DB → then JSON.parse
// async function fetchPayload(req) {
//     try {
//         const payload = req.data;
//         if (payload) {
//             try {
//                 // Case 1: plain stringified JSON  e.g. "{\"GRVID\":68,\"ROLL\":\"UNION\"}"
//                 return JSON.parse(payload.D4OXYPALUYAIDNSO);
//             } catch (e) {
//                 // Case 2: AES encrypted string
//                 const secretKey   = await GetAESKey(req);
//                 const decrypted   = CryptoJS.AES.decrypt(payload.D4OXYPALUYAIDNSO, secretKey);
//                 const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
//                 return JSON.parse(decryptedText);
//             }
//         } else {
//             throw new Error("No data found in the request: " + JSON.stringify(req));
//         }
//     } catch (e) {
//         await createErrorLog(constants.APP_GRVCOM, constants.FUN_COM_FTPYL, '', e.toString());
//         throw e;
//     }
// }

// function isEmptyPayload(rawPayload) {
//     if (rawPayload === null || rawPayload === undefined) return true;
//     return typeof rawPayload === 'string' &&
//         (rawPayload.trim() === '' || rawPayload.trim().toUpperCase() === 'NA');
// }

// function parseJsonIfPossible(rawPayload) {
//     if (typeof rawPayload !== 'string') return rawPayload;

//     try {
//         return JSON.parse(rawPayload);
//     } catch (e) {
//         return rawPayload;
//     }
// }

// function normalizePayloadManipulationRules(rules) {
//     return rules && typeof rules === 'object' && !Array.isArray(rules) ? rules : {};
// }

// function hasPayloadManipulationRules(rules) {
//     return Object.keys(normalizePayloadManipulationRules(rules)).length > 0;
// }

// function parsePayloadPath(path) {
//     return String(path).match(/[^.[\]]+/g) || [];
// }

// function setValueByPath(target, path, value) {
//     const parts = parsePayloadPath(path);
//     if (!parts.length) return;

//     let current = target;
//     for (let i = 0; i < parts.length - 1; i++) {
//         const part = parts[i];
//         if (current[part] === undefined || current[part] === null) return;
//         current = current[part];
//     }

//     current[parts[parts.length - 1]] = value;
// }

// function replaceValueByKey(target, key, value) {
//     if (!target || typeof target !== 'object') return;

//     if (Array.isArray(target)) {
//         target.forEach(item => replaceValueByKey(item, key, value));
//         return;
//     }

//     Object.keys(target).forEach(currentKey => {
//         if (currentKey === key) {
//             target[currentKey] = value;
//         } else {
//             replaceValueByKey(target[currentKey], key, value);
//         }
//     });
// }

// function applyPayloadManipulationRules(payloadObj, rules) {
//     const safeRules = normalizePayloadManipulationRules(rules);
//     if (!payloadObj || typeof payloadObj !== 'object' || !hasPayloadManipulationRules(safeRules)) {
//         return payloadObj;
//     }

//     const manipulatedPayload = JSON.parse(JSON.stringify(payloadObj));
//     Object.entries(safeRules).forEach(([pathOrKey, value]) => {
//         if (pathOrKey.includes('.') || pathOrKey.includes('[')) {
//             setValueByPath(manipulatedPayload, pathOrKey, value);
//         } else {
//             replaceValueByKey(manipulatedPayload, pathOrKey, value);
//         }
//     });

//     return manipulatedPayload;
// }

// function manipulateD4Payload(payloadObj, rules) {
//     const d4Value = payloadObj.D4OXYPALUYAIDNSO;
//     const innerPayload = parseJsonIfPossible(d4Value);

//     if (!innerPayload || typeof innerPayload !== 'object') {
//         return payloadObj;
//     }

//     return {
//         ...payloadObj,
//         D4OXYPALUYAIDNSO: JSON.stringify(applyPayloadManipulationRules(innerPayload, rules))
//     };
// }

// function buildPayloadEnvelope(rawPayload, payloadManipulationRules = {}) {
//     if (isEmptyPayload(rawPayload)) return null;

//     const payloadObj = parseJsonIfPossible(rawPayload);
//     if (
//         payloadObj &&
//         typeof payloadObj === 'object' &&
//         Object.prototype.hasOwnProperty.call(payloadObj, 'D4OXYPALUYAIDNSO')
//     ) {
//         return manipulateD4Payload(payloadObj, payloadManipulationRules);
//     }

//     const manipulatedPayloadObj = applyPayloadManipulationRules(payloadObj, payloadManipulationRules);

//     return {
//         D4OXYPALUYAIDNSO: typeof manipulatedPayloadObj === 'string'
//             ? manipulatedPayloadObj
//             : JSON.stringify(manipulatedPayloadObj)
//     };
// }

// function buildAxiosPayload(rawPayload, shouldManipulatePayload, payloadManipulationRules = {}) {
//     if (isEmptyPayload(rawPayload)) return null;
//     return shouldManipulatePayload
//         ? buildPayloadEnvelope(rawPayload, payloadManipulationRules)
//         : parseJsonIfPossible(rawPayload);
// }

// // ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
// module.exports = {

//     fetchPayload,   // export so other handlers can reuse
//     GetAESKey,      // export so other handlers can reuse

//     run: async function (req) {
//         try {
//             console.log("API Testing Started — Batch Mode");

//             const body = req._.req.body;
//             const {
//                 clientId,
//                 clientSecret,
//                 tokenUrl,
//                 sheets,
//                 payloadManipulationEnabled = false,
//                 payloadManipulationRules = {}
//             } = body;

//             if (!clientId || !clientSecret || !tokenUrl || !sheets) {
//                 return { error: "Missing required fields: clientId, clientSecret, tokenUrl, sheets" };
//             }

//             // ── Get OAuth token ───────────────────────────────────────────────
//             const tokenRes = await axios.post(
//                 tokenUrl,
//                 `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
//                 { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
//             );
//             const token = tokenRes.data.access_token;
//             console.log("Token obtained successfully");

//             let allSheetResults = [];

//             // ── Loop each sheet ───────────────────────────────────────────────
//             for (let sheetObj of sheets) {
//                 const { sheetName, tests } = sheetObj;
//                 console.log(`Running Sheet: ${sheetName} | Tests: ${tests.length}`);

//                 let results = [];

//                 for (let test of tests) {
//                     if ((test["Skip?"] || "").toLowerCase() === "yes") continue;

//                     const methodUpper = (test.Method || "GET").toUpperCase();

//                     try {
//                         // ── Headers ───────────────────────────────────────────
//                         let headers = {
//                             Authorization: `Bearer ${token}`,
//                             'Content-Type': 'application/json'
//                         };
//                         if (test.Headers && test.Headers !== "NA") {
//                             test.Headers.split(";").forEach(h => {
//                                 const colonIdx = h.indexOf(":");
//                                 if (colonIdx > -1) {
//                                     const k = h.substring(0, colonIdx).trim();
//                                     const v = h.substring(colonIdx + 1).trim();
//                                     if (k) headers[k] = v;
//                                 }
//                             });
//                         }

//                         // ── Payload manipulation is opt-in and only for POST ───
//                         const shouldManipulatePayload = payloadManipulationEnabled === true && methodUpper === "POST";
//                         const axiosPayload = buildAxiosPayload(
//                             test.Payload,
//                             shouldManipulatePayload,
//                             payloadManipulationRules
//                         );

//                         const config = {
//                             method: methodUpper,
//                             url: test.URL,
//                             headers,
//                             timeout: 30000
//                         };
//                         if (axiosPayload !== null && methodUpper !== "GET") {
//                             config.data = axiosPayload;
//                         }

//                         console.log(`  [${methodUpper}] ${test.TestName} -> ${test.URL}`);
//                         if (axiosPayload) {
//                             const payloadLabel = shouldManipulatePayload ? 'Manipulated payload' : 'Payload';
//                             console.log(`  ${payloadLabel}: ${JSON.stringify(axiosPayload).substring(0, 150)}`);
//                         }

//                         const start    = Date.now();
//                         const response = await axios(config);
//                         const time     = Date.now() - start;

//                         // ── Validation ────────────────────────────────────────
//                         let isPass = false;
//                         if (String(response.status) === String(test.ExpectedStatus)) {
//                             if (test.ExpectedResponseContains && test.ExpectedResponseContains !== "NA") {
//                                 isPass = JSON.stringify(response.data).includes(test.ExpectedResponseContains);
//                             } else {
//                                 isPass = true;
//                             }
//                         }

//                         results.push({
//                             testName:     test.TestName,
//                             method:       methodUpper,
//                             status:       isPass ? "PASS" : "FAIL",
//                             actual:       response.status,
//                             expected:     test.ExpectedStatus,
//                             time,
//                             responseData: JSON.stringify(response.data).substring(0, 500)
//                         });

//                     } catch (err) {
//                         let responseData = err.message;
//                         if (err.response?.data !== undefined && err.response?.data !== '') {
//                             const d = err.response.data;
//                             responseData = typeof d === 'string' ? d : JSON.stringify(d);
//                             if (responseData.length > 2000) responseData = responseData.substring(0, 2000) + '…';
//                         }
//                         results.push({
//                             testName:     test.TestName,
//                             method:       methodUpper,
//                             status:       "ERROR",
//                             actual:       err.response?.status ?? err.message,
//                             expected:     test.ExpectedStatus,
//                             time:         "-",
//                             responseData,
//                             errorMessage: err.message
//                         });
//                     }
//                 }

//                 console.log(`Sheet [${sheetName}] done — ${results.length} tests run`);
//                 allSheetResults.push({
//                     sheetName,
//                     total:   results.length,
//                     passed:  results.filter(r => r.status === "PASS").length,
//                     failed:  results.filter(r => r.status === "FAIL").length,
//                     errors:  results.filter(r => r.status === "ERROR").length,
//                     results
//                 });
//             }

//             return { sheets: allSheetResults };

//         } catch (err) {
//             console.error("Handler error:", err);
//             return { error: err.message };
//         }
//     }
// };



const {    fetchPayload,GetAESKey,getOAuthToken,getMethod,isSkippedTest,buildAxiosConfig,executeApiRequest,buildSuccessResult,
    buildErrorResult,buildSheetSummary} = require('../../Utils/utils');

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
module.exports = {

    fetchPayload,   // export so other handlers can reuse
    GetAESKey,      // export so other handlers can reuse

    run: async function (req) {
        try {
            console.log("API Testing Started — Batch Mode");

            const body = req._.req.body;
            const {
                clientId,
                clientSecret,
                tokenUrl,
                sheets,
                payloadManipulationEnabled = false,
                payloadManipulationRules = {}
            } = body;

            if (!clientId || !clientSecret || !tokenUrl || !sheets) {
                return { error: "Missing required fields: clientId, clientSecret, tokenUrl, sheets" };
            }

            const token = await getOAuthToken({ clientId, clientSecret, tokenUrl });
            console.log("Token obtained successfully");

            let allSheetResults = [];

            // ── Loop each sheet ───────────────────────────────────────────────
            for (let sheetObj of sheets) {
                const { sheetName, tests } = sheetObj;
                console.log(`Running Sheet: ${sheetName} | Tests: ${tests.length}`);

                let results = [];

                for (let test of tests) {
                    if (isSkippedTest(test)) continue;

                    const methodUpper = getMethod(test);

                    try {
                        const { config, axiosPayload, shouldManipulatePayload } = buildAxiosConfig({
                            test,
                            methodUpper,
                            token,
                            payloadManipulationEnabled,
                            payloadManipulationRules
                        });

                        console.log(`  [${methodUpper}] ${test.TestName} -> ${test.URL}`);
                        if (axiosPayload) {
                            const payloadLabel = shouldManipulatePayload ? 'Manipulated payload' : 'Payload';
                            console.log(`  ${payloadLabel}: ${JSON.stringify(axiosPayload).substring(0, 150)}`);
                        }

                        const start    = Date.now();
                        const response = await executeApiRequest(config);
                        const time     = Date.now() - start;

                        results.push(buildSuccessResult({ test, methodUpper, response, time }));

                    } catch (err) {
                        results.push(buildErrorResult({ test, methodUpper, err }));
                    }
                }

                console.log(`Sheet [${sheetName}] done — ${results.length} tests run`);
                allSheetResults.push(buildSheetSummary(sheetName, results));
            }

            return { sheets: allSheetResults };

        } catch (err) {
            console.error("Handler error:", err);
            return { error: err.message };
        }
    }
};