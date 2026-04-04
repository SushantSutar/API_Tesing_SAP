const cds = require('@sap/cds');

async function createWebCount(req) {

    try {

        // const ipAddress =
        //     req.headers['x-forwarded-for'] ||
        //     req._?.req?.socket?.remoteAddress ||
        //     '';
        const ipAddress =
          (req.headers['x-forwarded-for'] || '')
          .split(',')[0]
          .trim() ||
          req._?.req?.socket?.remoteAddress ||
          '';


        const endpoint =
            req._?.req?.originalUrl || '';

        console.log("IP:", ipAddress);
        console.log("Endpoint:", endpoint);

        await cds.run(
            `CALL "prCreateUpdateWebCount"(?,?,?,?,?)`,
            [0,'WEB_TRAFFIC',ipAddress,endpoint,// new Date(),
                1]
        );

        console.log("Web Count Inserted");

    } catch (error) {

        console.error("WebCount Error:", error);

    }
}

module.exports = { createWebCount };
