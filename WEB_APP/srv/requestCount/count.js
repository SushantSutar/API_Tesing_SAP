// const cds = require('@sap/cds');
// const { createWebCount } = require('../handlers/applications/webCount');
// module.exports = cds.service.impl(function () {
//     this.on("G9sdu7jdbc6gl0rl", createWebCount);
// })
const cds = require('@sap/cds');
const { createWebCount } = require('../handlers/applications/webCount');

module.exports = cds.service.impl(function () {

    // Trigger before every READ request in this service
    // this.before('READ', '*', async (req) => {
    //     await createWebCount(req);
    // });

});
