const { AudioPlayerStatus } = require("@discordjs/voice");
const { spawn } = require("node:child_process");
const { client } = require("../../core/main");
const { playTrack } = require("../../utils/playTrack");
const { connectToChannel } = require("../../utils/connectToChannel");



module.exports = {

    structure: {
        name: "play",
        description: "Joins your voice channel and starts playing music"
    },
    
    execute: async (message, args) => {

        // if(!message?.member || !message.channel.isSendable() || message.channel.isDMBased() || !message.guild ) return;



        // let voiceChannel = message.member.voice.channel;
        // if(!voiceChannel){
        //     message.channel.send("You are not in any vc");  
        //     return;
        // }

        // const url = args[0].toString();
        // let isValidURL = ytdl.validateURL(url);
        // if(!isValidURL) {
        //     message.channel.send("Invalid Url");
        //     return;
        // }

        // let basicInfo = await ytdl.getBasicInfo(url);
        // let info = await ytdl.getInfo(url);
        // let audioFormats = ytdl.chooseFormat(info.formats, { quality: "highestaudio"});

        // await message.channel.send(`Title: ${basicInfo.videoDetails.title}`)

        // // await ytdl(url, {filter: 'audioonly'}).pipe(fs.createWriteStream("audio.mp3"))
        // ytdl(url).pipe(fs.createWriteStream("audiooo.mp4")); 


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

        const guildId = message.guild.id;
        const voiceChannel = message.member.voice.channel;

        if (!voiceChannel) {
            return message.reply('You need to join a voice channel first!');
        }
        // If bot is already in a different channel, refuse
        const existingConnection = client.connections.get(guildId);
        if (existingConnection && existingConnection.joinConfig.channelId !== voiceChannel.id) {
            return message.reply('I am already in another voice channel!');
        }
        const query = args.join(' ');
        if (!query) {
            return message.reply('Please provide a YouTube link or search query.');
        }
        // Save the text channel for sending replies
        client.textChannels.set(guildId, message.channel);

        // Fetch video title (metadata) via yt-dlp for user feedback
        let title = query;
        try {
            const info = spawn('yt-dlp', [
                query.startsWith('http') ? query : `ytsearch:${query}`,
                '--no-playlist',
                '--print-json',
                '--skip-download',
                '--cookies', '/etc/secrets/cookies.txt'
            ], { stdio: ['ignore', 'pipe', 'pipe'] });
            let infoData = '';
            info.stdout.on('data', chunk => infoData += chunk);
            await new Promise(resolve => info.on('close', resolve));
            const metadata = JSON.parse(infoData);
            title = metadata.title || title;
        } catch (error) {
            console.error('Error fetching video info:', error);
        }

        // If nothing is playing, join and start this track immediately
        if (!client.players.has(guildId) || client.players.get(guildId).state.status === AudioPlayerStatus.Idle) {
            try {
                await connectToChannel(voiceChannel);
            } catch (err) {
                console.error('Failed to join voice channel:', err);
                return message.reply('Unable to join your voice channel.');
            }
            message.channel.send(`▶ Now playing: **${title}**`);
            playTrack(guildId, query, title);
        } else {
            // Otherwise, enqueue the track
            if (!client.queue.has(guildId)) client.queue.set(guildId, []);
            client.queue.get(guildId).push({ query, title });
            message.channel.send(`✅ Added to queue: **${title}**`);
        }

        return;

    }
}