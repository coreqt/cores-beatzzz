const { client } = require('../../core/main.js');

module.exports = {
    structure: {
        name: "stop",
        description: "Stops playing current track and leave."
    },

    execute: async (message) => {
        const guildId = message.guild.id;
        const player = client.players.get(guildId);

        if (!player) {
            return message.reply('Nothing is playing right now.');
        }

        client.queue.delete(guildId);

        const procs = client.processes.get(guildId);
        if (procs) {
            try {
                procs.yt?.stdout?.unpipe(procs.ffmpeg?.stdin);
            } catch {}

            try {
                procs.ffmpeg?.stdin?.end();
            } catch {}

            try {
                procs.yt?.kill('SIGTERM');
            } catch {}

            try {
                procs.ffmpeg?.kill('SIGTERM');
            } catch {}

            setTimeout(() => {
                try {
                    if (procs.yt && !procs.yt.killed) procs.yt.kill('SIGKILL');
                } catch {}
                try {
                    if (procs.ffmpeg && !procs.ffmpeg.killed) procs.ffmpeg.kill('SIGKILL');
                } catch {}
            }, 1000);
        }

        try {
            player.stop(true);
        } catch {}

        try {
            client.connections.get(guildId)?.destroy();
        } catch {}

        client.players.delete(guildId);
        client.connections.delete(guildId);
        client.processes.delete(guildId);
        client.textChannels.delete(guildId);

        return message.channel.send('⏹️ Stopped playback and cleared the queue.');
    }
};