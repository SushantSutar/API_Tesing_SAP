const cds = require('@sap/cds');
const handler = require('../Handler/Application/main');

module.exports = cds.service.impl(async function () {

    this.on('runTests', async (req) => {
        return await handler.run(req);
    });

});