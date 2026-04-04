const cds = require('@sap/cds');
const multer = require('multer');

cds.on('bootstrap', (app) => {
    const upload = multer();
    app.post('/api/runTests', upload.single('file'), async (req, res) => {
        try {
            const handler = require('./srv/Handler/Application/main');
            const result = await handler.run({
                _: { req }
            });
            res.json(result);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });
});

module.exports = cds.server;