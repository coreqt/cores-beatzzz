const fs = require('fs');

module.exports = {
    execute: async(client) => {
        console.log(`Logged in as ${client.user.tag}`)
        client.user.setSamsungActivity('com.YostarJP.BlueArchive', 'START');

        setTimeout(() => {
            client.user.setSamsungActivity('com.miHoYo.bh3oversea', 'UPDATE');
        }, 30_000);

        setTimeout(() => {
            client.user.setSamsungActivity('com.miHoYo.GenshinImpact', 'STOP');
        }, 60_000);


    },
    once: true
}