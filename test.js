require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    StreamType,
    AudioPlayerStatus,
    entersState,
    VoiceConnectionStatus
} = require('@discordjs/voice');
const { spawn } = require('child_process');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const queue = new Map(); // guildId => Array of { query, title 
const connections = new Map(); // guildId => VoiceConnection
const players = new Map(); // guildId => AudioPlayer
const processes = new Map(); // guildId => { yt: ChildProcess, ffmpeg: ChildProcess }
const textChannels = new Map(); // guildId => TextChannel for bot replies

/**
 * Connects the bot to a voice channel and sets up the audio player.
 * @param {VoiceChannel} voiceChannel The voice channel to join.
 */
async function connectToChannel(voiceChannel) {
    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator
    });
    try {
        // Wait for the connection to become ready
        await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    } catch (error) {
        connection.destroy();
        throw error;
    }
    const player = createAudioPlayer();
    connection.subscribe(player);
    const guildId = voiceChannel.guild.id;
    connections.set(guildId, connection);
    players.set(guildId, player);

    // When a track finishes (Idle), play the next one or leave if queue is empty
    player.on(AudioPlayerStatus.Idle, () => {
        const guildQueue = queue.get(guildId);
        const textChannel = textChannels.get(guildId);
        if (!guildQueue || guildQueue.length === 0) {
            // No more songs: disconnect and clean up
            connection.destroy();
            queue.delete(guildId);
            players.delete(guildId);
            connections.delete(guildId);
            processes.delete(guildId);
            textChannels.delete(guildId);
            return;
        }
        // Dequeue next song and play it
        const next = guildQueue.shift();
        if (textChannel) {
            textChannel.send(`▶ Now playing: **${next.title || next.query}**`);
        }
        playTrack(guildId, next.query, next.title);
    });

    // Handle audio player errors (skip to next if any)
    player.on('error', error => {
        console.error(`Audio player error: ${error.message}`);
        const guildQueue = queue.get(guildId);
        const textChannel = textChannels.get(guildId);
        if (guildQueue && guildQueue.length > 0) {
            const next = guildQueue.shift();
            if (textChannel) {
                textChannel.send(`⚠️ Error with current track. Skipping to next: **${next.title || next.query}**`);
            }
            playTrack(guildId, next.query, next.title);
        } else {
            connection.destroy();
            queue.delete(guildId);
            players.delete(guildId);
            connections.delete(guildId);
            processes.delete(guildId);
            textChannels.delete(guildId);
        }
    });
}

/**
 * Plays a YouTube track in the guild's voice channel by piping yt-dlp into ffmpeg.
 * @param {string} guildId Discord guild ID.
 * @param {string} query YouTube URL or search terms.
 * @param {string} title The resolved title (optional, for messaging).
 */
function playTrack(guildId, query, title) {
    const player = players.get(guildId);
    if (!player) return;

    // Determine input for yt-dlp (URL or ytsearch:)
    let input = query;
    if (!query.startsWith('http')) {
        input = `ytsearch:${query}`;
    }

    // Spawn yt-dlp to fetch the audio stream
    const yt = spawn('yt-dlp', [
        input,
        '-f', 'bestaudio',
        '-o', '-',
        '--no-playlist',
        '--no-warnings',
        '--quiet'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    yt.stderr.on('data', data => {
        console.error(`yt-dlp error: ${data}`);
    });
    yt.on('error', error => {
        console.error(`yt-dlp failed: ${error.message}`);
    });

    // Spawn ffmpeg to convert the audio stream to raw PCM (48kHz stereo)
    const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',
        '-analyzeduration', '0',
        '-loglevel', '0',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
    ], { stdio: ['pipe', 'pipe', 'inherit'] });
    ffmpeg.on('error', error => {
        console.error(`ffmpeg error: ${error.message}`);
    });

    // Pipe the yt-dlp output into ffmpeg
    yt.stdout.pipe(ffmpeg.stdin);
    // Handle EPIPE (broken pipe) errors gracefully
    yt.stdout.on('error', err => {
        if (err.code !== 'EPIPE') console.error('yt-dlp stdout error:', err);
    });
    ffmpeg.stdout.on('error', err => {
        if (err.code !== 'EPIPE') console.error('ffmpeg stdout error:', err);
    });

    // Create an audio resource from ffmpeg's output and play it
    const resource = createAudioResource(ffmpeg.stdout, { inputType: StreamType.Raw });
    player.play(resource);
    processes.set(guildId, { yt, ffmpeg });
}

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    const guildId = message.guild.id;
    const prefix = 'c!';
    if (!message.content.startsWith(prefix)) return;

    const [cmd, ...args] = message.content.slice(prefix.length).trim().split(/\s+/);
    const voiceChannel = message.member.voice.channel;

    if (cmd === 'play') {
        if (!voiceChannel) {
            return message.reply('You need to join a voice channel first!');
        }
        // If bot is already in a different channel, refuse
        const existingConnection = connections.get(guildId);
        if (existingConnection && existingConnection.joinConfig.channelId !== voiceChannel.id) {
            return message.reply('I am already in another voice channel!');
        }
        const query = args.join(' ');
        if (!query) {
            return message.reply('Please provide a YouTube link or search query.');
        }
        // Save the text channel for sending replies
        textChannels.set(guildId, message.channel);

        // Fetch video title (metadata) via yt-dlp for user feedback
        let title = query;
        try {
            const info = spawn('yt-dlp', [
                query.startsWith('http') ? query : `ytsearch:${query}`,
                '--no-playlist',
                '--print-json',
                '--skip-download'
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
        if (!players.has(guildId) || players.get(guildId).state.status === AudioPlayerStatus.Idle) {
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
            if (!queue.has(guildId)) queue.set(guildId, []);
            queue.get(guildId).push({ query, title });
            message.channel.send(`✅ Added to queue: **${title}**`);
        }
    }
    else if (cmd === 'skip') {
        const player = players.get(guildId);
        if (!player || player.state.status !== AudioPlayerStatus.Playing) {
            return message.reply('No song is currently playing.');
        }
        // Kill current streams and stop player (triggers Idle -> next track)
        const procs = processes.get(guildId);
        if (procs) {
            procs.yt.kill('SIGKILL');
            procs.ffmpeg.kill('SIGKILL');
        }
        player.stop();
        message.channel.send('⏭️ Skipped the current song.');
    }
    else if (cmd === 'stop') {
        const player = players.get(guildId);
        if (!player) {
            return message.reply('Nothing is playing right now.');
        }
        // Clear the queue, stop playing, and disconnect
        queue.delete(guildId);
        const procs = processes.get(guildId);
        if (procs) {
            procs.yt.kill('SIGKILL');
            procs.ffmpeg.kill('SIGKILL');
        }
        player.stop();
        connections.get(guildId)?.destroy();
        players.delete(guildId);
        connections.delete(guildId);
        processes.delete(guildId);
        textChannels.delete(guildId);
        message.channel.send('⏹️ Stopped playback and cleared the queue.');
    }
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Log in the bot with the token from .env
client.login(process.env.TOKEN);
