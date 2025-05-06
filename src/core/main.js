const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection, NoSubscriberBehavior } = require('@discordjs/voice');
// const ytdl = require('ytdl-core');
// const ytpl = require('ytpl');
// const ytSearch = require('yt-search');
const {startServer} = require('./keepAlive.js');


const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// let player = createAudioPlayer({
//     behaviors: {
//         noSubscriber: NoSubscriberBehavior.Pause,
//     },
// });

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



// client.on('messageCreate', (message) =>{
//     
    
//     if(command == 'ping'){
//         message.channel.send(`pong! <@${message.author.id}>`);
//     }else if(command == 'play'){

//     }else if(command == 'join'){

//         let voiceChannel = message.member.voice.channel;

//         let connection = joinVoiceChannel({
//             channelId: voiceChannel.id,
//             guildId: message.guild.id,
//             adapterCreator: voiceChannel.guild.voiceAdapterCreator,
//         });


//         const resource = createAudioResource('E:/Programming/github/core-beatzzz/musiqq.mp3')

//         player.play(resource);

//         connection.subscribe(player)
        

//     } else if(command == 'leave' || command == 'stop'){
//         let connection = getVoiceConnection(message.guild.id)

//         if(connection){
//             connection.destroy();
//         }
//     } else if(command == 'pause' ){
//         player.pause();
//     } else if( command == 'resume'){
//         player.play();
//     }
// })


module.exports = { client }

