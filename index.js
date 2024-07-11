const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const ytpl = require('ytpl');
const ytSearch = require('yt-search');
const express = require('express');
const app = express();
require('dotenv').config();
const token = process.env.TOKEN;

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildVoiceStates, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ]
});
const prefix = '!';

let queue = [];
let history = [];
let currentPlaying = null;
let connection = null;
let player = createAudioPlayer();
let loop = false;
let loopAll = false;

app.get('/', (req, res) => {
    res.send({ code: 200 });
});
const port = process.env.PORT || 3000;

app.listen(port);

client.once('ready', () => {
    console.log('Bot is online!');
});

player.on(AudioPlayerStatus.Idle, () => {
    if (loop && currentPlaying) {
        queue.unshift(currentPlaying);
    } else if (loopAll && currentPlaying) {
        queue.push(currentPlaying);
    } else if (currentPlaying) {
        history.push(currentPlaying);
    }
    playNext();
});

player.on('error', error => {
    console.error('Error:', error);
    playNext();
});

client.on('messageCreate', async message => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'play') {
        if (args.length === 0) {
            return message.channel.send('Please provide a YouTube link or song name.');
        }

        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.channel.send('You need to be in a voice channel to play music!');
        }

        const query = args.join(' ');

        if (ytdl.validateURL(query)) {
            const songInfo = await ytdl.getInfo(query);
            queue.push({ url: query, title: songInfo.videoDetails.title, textChannel: message.channel.id, voiceChannel: voiceChannel.id });
            message.channel.send(`Added to queue: **${songInfo.videoDetails.title}**`);
            if (!currentPlaying) {
                playNext();
            }
        } else if (ytpl.validateID(query)) {
            const playlist = await ytpl(query);
            playlist.items.forEach(item => queue.push({ url: item.shortUrl, title: item.title, textChannel: message.channel.id, voiceChannel: voiceChannel.id }));
            message.channel.send(`Added playlist to queue: **${playlist.title}**`);
            if (!currentPlaying) {
                playNext();
            }
        } else {
            const searchResult = await ytSearch(query);
            if (searchResult && searchResult.videos.length > 0) {
                const video = searchResult.videos[0];
                queue.push({ url: video.url, title: video.title, textChannel: message.channel.id, voiceChannel: voiceChannel.id });
                message.channel.send(`Added to queue: **${video.title}**`);
                if (!currentPlaying) {
                    playNext();
                }
            } else {
                message.channel.send('No results found on YouTube.');
            }
        }
    } else if (command === 'stop') {
        if (connection) {
            connection.destroy();
            connection = null;
            currentPlaying = null;
            queue = [];
            history = [];
            message.channel.send('Stopped playing and left the voice channel.');
        } else {
            message.channel.send('I am not in a voice channel.');
        }
    } else if (command === 'loop') {
        loop = !loop;
        message.channel.send(`Loop is now ${loop ? 'enabled' : 'disabled'}.`);
    } else if (command === 'loopall') {
        loopAll = !loopAll;
        message.channel.send(`Loop all is now ${loopAll ? 'enabled' : 'disabled'}.`);
    } else if (command === 'next') {
        playNext(true);
        message.channel.send('Skipped to the next track.');
    } else if (command === 'previous') {
        if (history.length > 0) {
            queue.unshift(currentPlaying);
            currentPlaying = history.pop();
            playCurrent();
            message.channel.send('Playing the previous track.');
        } else {
            message.channel.send('No previous track to play.');
        }
    } else if (command === 'remove') {
        if (args.length === 0) {
            return message.channel.send('Please provide the position of the song to remove from the queue.');
        }

        const position = parseInt(args[0]);

        if (isNaN(position) || position < 1 || position > queue.length) {
            return message.channel.send('Invalid position. Please provide a valid position within the queue.');
        }

        const removedSong = queue.splice(position - 1, 1)[0];
        message.channel.send(`Removed song at position ${position} from the queue: **${removedSong.title}**`);
    } else if (command === 'queue') {
        if (queue.length === 0) {
            return message.channel.send('The queue is empty.');
        }

        const queueList = queue.map((song, index) => `${index + 1}. **${song.title}**`).join('\n');
        message.channel.send(`Current queue:\n${queueList}`);
    } else if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Music Bot Commands')
            .setDescription('Here are the commands you can use with this bot:')
            .addFields(
                { name: '!play <YouTube URL or song name>', value: 'Add a YouTube video, playlist, or search for a song by name and add it to the queue.' },
                { name: '!stop', value: 'Stop playing and clear the queue and history.' },
                { name: '!loop', value: 'Toggle looping the current track.' },
                { name: '!loopall', value: 'Toggle looping the entire queue.' },
                { name: '!next', value: 'Skip to the next track in the queue.' },
                { name: '!previous', value: 'Play the previous track from the history.' },
                { name: '!queue', value: 'Display the current queue.' },
                { name: '!remove <position>', value: 'Remove a song from the queue at the specified position.' },
                { name: '!help', value: 'Show this help message.' }
            )
            .setFooter({text:'Enjoy your music!'});

        message.channel.send({ embeds: [helpEmbed] });
    }
});

async function playNext(skip = false) {
    if (queue.length === 0) {
        currentPlaying = null;
        if (connection) {
            connection.destroy();
            connection = null;
        }
        return;
    }

    if (!skip && currentPlaying) {
        if (loopAll) {
            queue.push(currentPlaying); // Add the current song back to the end of the queue
        } else {
            history.push(currentPlaying);
        }
    }

    currentPlaying = queue.shift();
    playCurrent();
}

async function playCurrent() {
    const stream = ytdl(currentPlaying.url, {
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 27, // Increased buffer size for better audio quality
        dlChunkSize: 0 // Fetch the entire audio stream at once
    });
    
    const resource = createAudioResource(stream, {
        inputType: stream.readable ? stream.readableType : stream.type,
        inlineVolume: true
    });

    player.play(resource);

    if (!connection) {
        connection = joinVoiceChannel({
            channelId: currentPlaying.voiceChannel,
            guildId: client.channels.cache.get(currentPlaying.voiceChannel).guild.id,
            adapterCreator: client.channels.cache.get(currentPlaying.voiceChannel).guild.voiceAdapterCreator,
            selfDeaf: false
        });
        connection.subscribe(player);
    }

    client.channels.cache.get(currentPlaying.textChannel).send(`Now playing: **${currentPlaying.title}**`);
}


client.login(token);
