const { AudioPlayerStatus } = require("@discordjs/voice");
const { spawn } = require("node:child_process");
const { client } = require("../../core/main");
const { playTrack } = require("../../utils/playTrack");
const { connectToChannel } = require("../../utils/connectToChannel");

// const guildId = "550389429567750155";
// const channelId = "1287863586819145828";

// const guildId = "1117823396043034624";
// const channelId = "1258844274212995073";


module.exports = {

    structure: {
        name: "play",
        description: "Joins your voice channel and starts playing music"
    },

    execute: async (message, args) => {

        const guildId = message.guild.id;
        // let guild = client.guilds.cache.get(guildId);
        // if (!guild) return message.reply("I am not in this guild!");
        // let voiceChannel = guild.channels.cache.get(channelId);
        // if (!voiceChannel) return message.reply("I cannot find the specified channel in this guild!");
        const voiceChannel = message.member.voice.channel;

        if (!voiceChannel) {
            return message.reply('You need to join a voice channel first!');
        }
        const existingConnection = client.connections.get(guildId);
        if (existingConnection && existingConnection.joinConfig.channelId !== voiceChannel.id) {
            return message.reply('I am already in another voice channel!');
        }
        const query = args.join(' ');
        if (!query) {
            return message.reply('Please provide a YouTube link or search query.');
        }
        client.textChannels.set(guildId, message.channel);

        let title = query;
        try {
            const info = spawn('yt-dlp', [
                query.startsWith('http') ? query : `ytsearch:${query}`,
                '--no-playlist',
                '--print-json',
                '--skip-download',
                // '--cookies-from-browser', '/etc/secrets/cookies.txt'
            ], { stdio: ['ignore', 'pipe', 'pipe'] });
            let infoData = '';
            info.stdout.on('data', chunk => infoData += chunk);

            infoData = await new Promise(resolve => info.on('close', resolve));
            const metadata = JSON.parse(infoData);
            title = metadata.title || title;
        } catch (error) {
            console.error('Error fetching video info:', error);
        }

        if (!client.players.has(guildId) || client.players.get(guildId).state.status === AudioPlayerStatus.Idle) {
            try {
                connectToChannel(voiceChannel);
            } catch (err) {
                console.error('Failed to join voice channel:', err);
                return message.reply('Unable to join your voice channel.');
            }
            message.channel.send(`▶ Now playing: **${title}**`);
            playTrack(guildId, query, title);
        } else {

            if (!client.queue.has(guildId)) client.queue.set(guildId, []);
            client.queue.get(guildId).push({ query, title });
            message.channel.send(`✅ Added to queue: **${title}**`);
        }

        return;

    }
}