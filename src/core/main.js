const fs = require('node:fs');
const path = require('node:path');
// const { Client } = require('discord.js-selfbot-v13');
// const { GatewayIntentBits } = require('discord.js');
const {Client, GatewayIntentBits} = require('discord.js');;
const {startServer} = require('./keepAlive.js');

 
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});
// const client = new Client();

client.queue = new Map();
client.connections = new Map();
client.players = new Map();
client.processes = new Map();
client.textChannels = new Map();


const port = process.env.PORT || 3000;

const server = startServer(port);
 
let eventsDir = path.join(__dirname, "..", "event")
let eventList = fs.readdirSync(eventsDir);

eventList.forEach((event) =>{
    let eventDir = path.join(eventsDir, event);
    let eventFiles = fs.readdirSync(eventDir);
    eventFiles.forEach(eventFile => {
        let eventFileDir = path.join(eventDir, eventFile);
        let eventModule = require(eventFileDir);

        if(eventModule.once){
            client.once(event,eventModule.execute)
        }else{
            client.on(event, eventModule.execute)
        }

    })
})


module.exports = { client }

