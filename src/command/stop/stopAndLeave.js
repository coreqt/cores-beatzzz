const { client } = require('../../core/main.js');

module.exports = {
    structure: {
        name: "stop",
        description: "Stops playing current track and leave."
    },
    execute: async(message, args) =>{
        const guildId = message.guild.id;

        const player = client.players.get(guildId);
        if (!player) {
            return message.reply('Nothing is playing right now.');
        }
        // Clear the queue, stop playing, and disconnect
        queue.delete(guildId);
        const procs = client.processes.get(guildId);
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
        return;
    }
}