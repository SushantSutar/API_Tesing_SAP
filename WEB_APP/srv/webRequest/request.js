const cds = require('@sap/cds');
const { createWebCount } = require('../handlers/applications/webCount');

module.exports = cds.service.impl(function () {

    this.before('READ', '*', async (req) => {
        const instanceIndex = process.env.CF_INSTANCE_INDEX || "0";
        const instanceId = process.env.CF_INSTANCE_GUID;

        console.log("Request handled by instance:", instanceIndex);
        console.log("Instance GUID:", instanceId);
        
        console.log("Web Count Triggered");   // debug
        await createWebCount(req);
    });

});
