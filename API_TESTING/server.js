const cds = require('@sap/cds');
const express = require('express');

cds.on('bootstrap', (app) => {

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
