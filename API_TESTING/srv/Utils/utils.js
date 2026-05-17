const axios = require('axios');
const CryptoJS = require('crypto-js');

// const cds = require('@sap/cds');

const constants = {
    APP_GRVCOM: 'GRVCOM',
    FUN_COM_FTPYL: 'fetchPayload',
    FUN_COM_GASK: 'GetAESKey'
};

async function createErrorLog(app, fun, id, msg) {
    console.error(`[ErrorLog] App:${app} | Fun:${fun} | Id:${id} | ${msg}`);
}

// Replace this stub with the DB-backed implementation when AES key storage is ready.
async function GetAESKey(req) {
    return "1234567890123456";
}

async function fetchPayload(req) {
    try {
        const payload = req.data;
        if (!payload) {
            throw new Error("No data found in the request: " + JSON.stringify(req));
        }

        try {
            return JSON.parse(payload.D4OXYPALUYAIDNSO);
        } catch (e) {
            const secretKey = await GetAESKey(req);
            const decrypted = CryptoJS.AES.decrypt(payload.D4OXYPALUYAIDNSO, secretKey);
            const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
            return JSON.parse(decryptedText);
        }
    } catch (e) {
        await createErrorLog(constants.APP_GRVCOM, constants.FUN_COM_FTPYL, '', e.toString());
        throw e;
    }
}

function isSkippedTest(test) {
    return (test["Skip?"] || "").toLowerCase() === "yes";
}

function getMethod(test) {
    return (test.Method || "GET").toUpperCase();
}

function parseHeaders(test, token) {
    const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    if (test.Headers && test.Headers !== "NA") {
        test.Headers.split(";").forEach(h => {
            const colonIdx = h.indexOf(":");
            if (colonIdx > -1) {
                const key = h.substring(0, colonIdx).trim();
                const value = h.substring(colonIdx + 1).trim();
                if (key) headers[key] = value;
            }
        });
    }

    return headers;
}

async function getOAuthToken({ clientId, clientSecret, tokenUrl }) {
    const tokenRes = await axios.post(
        tokenUrl,
        `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    return tokenRes.data.access_token;
}

function isEmptyPayload(rawPayload) {
    if (rawPayload === null || rawPayload === undefined) return true;
    return typeof rawPayload === 'string' &&
        (rawPayload.trim() === '' || rawPayload.trim().toUpperCase() === 'NA');
}

function parseJsonIfPossible(rawPayload) {
    if (typeof rawPayload !== 'string') return rawPayload;

    try {
        return JSON.parse(rawPayload);
    } catch (e) {
        return rawPayload;
    }
}

function normalizePayloadManipulationRules(rules) {
    return rules && typeof rules === 'object' && !Array.isArray(rules) ? rules : {};
}

function hasPayloadManipulationRules(rules) {
    return Object.keys(normalizePayloadManipulationRules(rules)).length > 0;
}

function parsePayloadPath(path) {
    return String(path).match(/[^.[\]]+/g) || [];
}

function setValueByPath(target, path, value) {
    const parts = parsePayloadPath(path);
    if (!parts.length) return;

    let current = target;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current[part] === undefined || current[part] === null) return;
        current = current[part];
    }

    current[parts[parts.length - 1]] = value;
}

function replaceValueByKey(target, key, value) {
    if (!target || typeof target !== 'object') return;

    if (Array.isArray(target)) {
        target.forEach(item => replaceValueByKey(item, key, value));
        return;
    }

    Object.keys(target).forEach(currentKey => {
        if (currentKey === key) {
            target[currentKey] = value;
        } else {
            replaceValueByKey(target[currentKey], key, value);
        }
    });
}

function applyPayloadManipulationRules(payloadObj, rules) {
    const safeRules = normalizePayloadManipulationRules(rules);
    if (!payloadObj || typeof payloadObj !== 'object' || !hasPayloadManipulationRules(safeRules)) {
        return payloadObj;
    }

    const manipulatedPayload = JSON.parse(JSON.stringify(payloadObj));
    Object.entries(safeRules).forEach(([pathOrKey, value]) => {
        if (pathOrKey.includes('.') || pathOrKey.includes('[')) {
            setValueByPath(manipulatedPayload, pathOrKey, value);
        } else {
            replaceValueByKey(manipulatedPayload, pathOrKey, value);
        }
    });

    return manipulatedPayload;
}

function manipulateD4Payload(payloadObj, rules) {
    const d4Value = payloadObj.D4OXYPALUYAIDNSO;
    const innerPayload = parseJsonIfPossible(d4Value);

    if (!innerPayload || typeof innerPayload !== 'object') {
        return payloadObj;
    }

    return {
        ...payloadObj,
        D4OXYPALUYAIDNSO: JSON.stringify(applyPayloadManipulationRules(innerPayload, rules))
    };
}

function buildPayloadEnvelope(rawPayload, payloadManipulationRules = {}) {
    if (isEmptyPayload(rawPayload)) return null;

    const payloadObj = parseJsonIfPossible(rawPayload);
    if (
        payloadObj &&
        typeof payloadObj === 'object' &&
        Object.prototype.hasOwnProperty.call(payloadObj, 'D4OXYPALUYAIDNSO')
    ) {
        return manipulateD4Payload(payloadObj, payloadManipulationRules);
    }

    const manipulatedPayloadObj = applyPayloadManipulationRules(payloadObj, payloadManipulationRules);

    return {
        D4OXYPALUYAIDNSO: typeof manipulatedPayloadObj === 'string'
            ? manipulatedPayloadObj
            : JSON.stringify(manipulatedPayloadObj)
    };
}

function buildAxiosPayload(rawPayload, shouldManipulatePayload, payloadManipulationRules = {}) {
    if (isEmptyPayload(rawPayload)) return null;
    return shouldManipulatePayload
        ? buildPayloadEnvelope(rawPayload, payloadManipulationRules)
        : parseJsonIfPossible(rawPayload);
}

function buildAxiosConfig({ test, methodUpper, token, payloadManipulationEnabled, payloadManipulationRules }) {
    const shouldManipulatePayload = payloadManipulationEnabled === true && methodUpper === "POST";
    const axiosPayload = buildAxiosPayload(test.Payload, shouldManipulatePayload, payloadManipulationRules);
    const config = {
        method: methodUpper,
        url: test.URL,
        headers: parseHeaders(test, token),
        timeout: 30000
    };

    if (axiosPayload !== null && methodUpper !== "GET") {
        config.data = axiosPayload;
    }

    return { config, axiosPayload, shouldManipulatePayload };
}

async function executeApiRequest(config) {
    return axios(config);
}

function isResponsePass(response, test) {
    if (String(response.status) !== String(test.ExpectedStatus)) return false;

    if (test.ExpectedResponseContains && test.ExpectedResponseContains !== "NA") {
        return JSON.stringify(response.data).includes(test.ExpectedResponseContains);
    }

    return true;
}

function buildSuccessResult({ test, methodUpper, response, time }) {
    return {
        testName: test.TestName,
        method: methodUpper,
        status: isResponsePass(response, test) ? "PASS" : "FAIL",
        actual: response.status,
        expected: test.ExpectedStatus,
        time,
        responseData: JSON.stringify(response.data).substring(0, 500)
    };
}

function buildErrorResult({ test, methodUpper, err }) {
    let responseData = err.message;
    if (err.response?.data !== undefined && err.response?.data !== '') {
        const data = err.response.data;
        responseData = typeof data === 'string' ? data : JSON.stringify(data);
        if (responseData.length > 2000) responseData = responseData.substring(0, 2000) + '…';
    }

    return {
        testName: test.TestName,
        method: methodUpper,
        status: "ERROR",
        actual: err.response?.status ?? err.message,
        expected: test.ExpectedStatus,
        time: "-",
        responseData,
        errorMessage: err.message
    };
}

function buildSheetSummary(sheetName, results) {
    return {
        sheetName,
        total: results.length,
        passed: results.filter(r => r.status === "PASS").length,
        failed: results.filter(r => r.status === "FAIL").length,
        errors: results.filter(r => r.status === "ERROR").length,
        results
    };
}

module.exports = {
    fetchPayload,
    GetAESKey,
    getOAuthToken,
    getMethod,
    isSkippedTest,
    buildAxiosConfig,
    executeApiRequest,
    buildSuccessResult,
    buildErrorResult,
    buildSheetSummary
};
