const cds = require('@sap/cds');
const express = require('express');

cds.on('bootstrap', (app) => {

    // CORS: browser UI on another origin (e.g. local file, SAP BAS preview) → POST /api/runTests
    app.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.setHeader('Access-Control-Max-Age', '86400');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(204);
        }
        next();
    });

    // Parse JSON bodies — needed since UI now sends JSON batch payload
    app.use(express.json({ limit: '10mb' }));

    app.post('/api/runTests', async (req, res) => {
        try {
            const handler = require('./srv/Handler/Application/main');
            const result = await handler.run({ _: { req } });
            res.json(result);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

});

module.exports = cds.server;
