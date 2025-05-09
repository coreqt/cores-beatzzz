const {client} = require('../../core/main.js');
const {AudioPlayerStatus} = require('@discordjs/voice');

module.exports = {
    structure: {
        name: "skip",
        description: "skips the current track"
    }, 
    execute: async (message, args) => {
        const gulidId = message.guild.id;

        const player = client.players.get(guildId);
        if (!player || player.state.status !== AudioPlayerStatus.Playing) {
            return message.reply('No song is currently playing.');
        }
        // Kill current streams and stop player (triggers Idle -> next track)
        const procs = client.processes.get(guildId);
        if (procs) {
            procs.yt.kill('SIGKILL');
            procs.ffmpeg.kill('SIGKILL');
        }
        player.stop();
        message.channel.send('⏭️ Skipped the current song.');
        return;
    }
}