// const { joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior } = require("@discordjs/voice");
import { joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior } from "@discordjs/voice";
import ytdl from "ytdl-core";
import fs from "node:fs"
import { Message } from "discord.js";



export let structure =  {
    name: "play",
    description: "Joins your voice channel and starts playing music"
}

export let execute =  async (message, args) => {

    if(!message?.member || !message.channel.isSendable() || message.channel.isDMBased() || !message.guild ) return;


    
    let voiceChannel = message.member.voice.channel;
    if(!voiceChannel){
        message.channel.send("You are not in any vc");  
        return;
    }

    const url = args[0].toString();
    let isValidURL = ytdl.validateURL(url);
    if(!isValidURL) {
        message.channel.send("Invalid Url");
        return;
    }

    let basicInfo = await ytdl.getBasicInfo(url);
    let info = await ytdl.getInfo(url);
    let audioFormats = ytdl.chooseFormat(info.formats, { quality: "highestaudio"});
    
    await message.channel.send(`Title: ${basicInfo.videoDetails.title}`)

    // await ytdl(url, {filter: 'audioonly'}).pipe(fs.createWriteStream("audio.mp3"))
    ytdl(url).pipe(fs.createWriteStream("audiooo"));

    
    // let player = createAudioPlayer({
    //     behaviors: {
    //         noSubscriber: NoSubscriberBehavior.Pause,
    //     },
    // });


    // let connection = joinVoiceChannel({
    //     channelId: voiceChannel.id,
    //     guildId: message.guild.id,
    //     adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    // });


    // // const resource = createAudioResource(vid)

    // player.play(vid);

    // connection.subscribe(player)

}