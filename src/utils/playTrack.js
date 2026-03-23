const { createAudioResource, StreamType } = require("@discordjs/voice");
const { spawn } = require("node:child_process");
const { client } = require("../core/main");

module.exports = {
    playTrack: async (guildId, query, title) => {
        const player = client.players.get(guildId);
        if (!player) return;

        let input = query;
        if (!query.startsWith('http')) {
            input = `ytsearch:${query}`;
        }

        const yt = spawn('yt-dlp', [
            input,
            '-f', 'bestaudio',
            '-o', '-',
            '--no-playlist',
            '--no-warnings',
            '--quiet',
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

        yt.stderr.on('data', data => {
            console.error(`yt-dlp error: ${data}`);
        });

        yt.on('error', error => {
            console.error(`yt-dlp failed: ${error.message}`);
        });

        const ffmpeg = spawn('ffmpeg', [
            '-i', 'pipe:0',
            '-analyzeduration', '0',
            '-loglevel', '0',
            '-af', 'volume=0.1',
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            'pipe:1'
        ], { stdio: ['pipe', 'pipe', 'inherit'] });

        ffmpeg.on('error', error => {
            console.error(`ffmpeg error: ${error.message}`);
        });

        yt.stdout.pipe(ffmpeg.stdin);

        yt.stdout.on('error', err => {
            if (err.code !== 'EPIPE') console.error('yt-dlp stdout error:', err);
        });

        ffmpeg.stdin.on('error', err => {
            if (err.code !== 'EPIPE') console.error('ffmpeg stdin error:', err);
        });

        ffmpeg.stdout.on('error', err => {
            if (err.code !== 'EPIPE') console.error('ffmpeg stdout error:', err);
        });

        yt.on('close', code => {
            if (code !== 0) console.log(`yt-dlp exited with code ${code}`);
        });

        ffmpeg.on('close', code => {
            if (code !== 0) console.log(`ffmpeg exited with code ${code}`);
        });

        const resource = createAudioResource(ffmpeg.stdout, { inputType: StreamType.Raw });
        player.play(resource);

        client.processes.set(guildId, { yt, ffmpeg });
    }
};