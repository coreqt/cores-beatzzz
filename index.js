const { Client, GatewayIntentBits, MessageEmbed } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const ytpl = require('ytpl');
const { getVoiceConnection } = require('@discordjs/voice');
require('dotenv').config();
const token = process.env.TOKEN;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const prefix = '!';

let queue = [];
let history = [];
let currentPlaying = null;
let connection = null;
let player = createAudioPlayer();
let loop = false;

client.once('ready', () => {
    console.log('Bot is online!');
});

player.on(AudioPlayerStatus.Idle, () => {
    if (loop && currentPlaying) {
        queue.unshift(currentPlaying);
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
            return message.channel.send('Please provide a YouTube link.');
        }

        const url = args[0];

        if (ytdl.validateURL(url)) {
            queue.push({ url, textChannel: message.channel.id, voiceChannel: message.member.voice.channel.id });
            message.channel.send(`Added to queue: ${url}`);
            if (!currentPlaying) {
                playNext();
            }
        } else if (ytpl.validateID(url)) {
            const playlist = await ytpl(url);
            playlist.items.forEach(item => queue.push({ url: item.shortUrl, textChannel: message.channel.id, voiceChannel: message.member.voice.channel.id }));
            message.channel.send(`Added playlist to queue: ${playlist.title}`);
            if (!currentPlaying) {
                playNext();
            }
        } else {
            message.channel.send('Please provide a valid YouTube link or playlist.');
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
    } else if (command === 'help') {
        const helpEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Music Bot Commands')
            .setDescription('Here are the commands you can use with this bot:')
            .addFields(
                { name: '!play <YouTube URL>', value: 'Add a YouTube video or playlist to the queue and start playing if not already playing.' },
                { name: '!stop', value: 'Stop playing and clear the queue and history.' },
                { name: '!loop', value: 'Toggle looping the current track.' },
                { name: '!next', value: 'Skip to the next track in the queue.' },
                { name: '!previous', value: 'Play the previous track from the history.' },
                { name: '!help', value: 'Show this help message.' }
            )
            .setFooter('Enjoy your music!');

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
        history.push(currentPlaying);
    }

    currentPlaying = queue.shift();
    playCurrent();
}

async function playCurrent() {
    const stream = ytdl(currentPlaying.url, {
        filter: 'audioonly',
        quality: 'highestaudio', // Specify the highest audio quality available
        highWaterMark: 1 << 25 // Set a higher highWaterMark for better buffering
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
        });
        connection.subscribe(player);
    }

    client.channels.cache.get(currentPlaying.textChannel).send(`Now playing: ${currentPlaying.url}`);
}



client.login(token);
