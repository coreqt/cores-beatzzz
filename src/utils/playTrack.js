const { createAudioResource, StreamType } = require("@discordjs/voice")
const { spawn } = require("node:child_process")
const { client } = require("../core/main")


/**
 * Plays a YouTube track in the guild's voice channel by piping yt-dlp into ffmpeg.
 * @param {string} guildId Discord guild ID.
 * @param {string} query YouTube URL or search terms.
 * @param {string} title The resolved title (optional, for messaging).
 */
module.exports = {
    playTrack: async(guildId, query, title) => {
        const player = client.players.get(guildId);
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
            '--quiet',
            // '--cookies', '/etc/secrets/cookies.txt'
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
        client.processes.set(guildId, { yt, ffmpeg });
        return;
    }
} 