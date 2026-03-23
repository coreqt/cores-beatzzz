const {
    joinVoiceChannel,
    createAudioPlayer,
    entersState,
    VoiceConnectionStatus,
    AudioPlayerStatus
} = require("@discordjs/voice");

const { client } = require("../core/main");
const { playTrack } = require("./playTrack");

module.exports = {
    connectToChannel: async (voiceChannel) => {
        if (!voiceChannel) throw new Error("No voice channel provided");

        const guildId = voiceChannel.guild.id;

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: false,
        });

        connection.on("stateChange", (oldState, newState) => {
            console.log(`[Voice ${guildId}] ${oldState.status} -> ${newState.status}`);
        });

        connection.on("error", console.error);

        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            } catch {
                connection.destroy();
            }
        });

        try {
            await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
        } catch (err) {
            connection.destroy();
            throw err;
        }

        const player = createAudioPlayer();
        connection.subscribe(player);

        client.connections.set(guildId, connection);
        client.players.set(guildId, player);

        player.on(AudioPlayerStatus.Idle, async() => {
            const guildQueue = client.queue.get(guildId);
            const textChannel = client.textChannels.get(guildId);

            if (!guildQueue || guildQueue.length === 0) {
                connection.destroy();
                client.queue.delete(guildId);
                client.players.delete(guildId);
                client.connections.delete(guildId);
                client.processes.delete(guildId);
                client.textChannels.delete(guildId);
                return;
            }

            const next = guildQueue.shift();
            if (textChannel) textChannel.send(`▶ Now playing: **${next.title || next.query}**`);
            playTrack(guildId, next.query, next.title);
        });

        player.on("error", (error) => {
            console.error("Audio player error:", error);
            const guildQueue = client.queue.get(guildId);
            const textChannel = client.textChannels.get(guildId);

            if (guildQueue && guildQueue.length > 0) {
                const next = guildQueue.shift();
                if (textChannel) textChannel.send(`⚠️ Skipping error track: **${next.title || next.query}**`);
                playTrack(guildId, next.query, next.title);
            } else {
                connection.destroy();
                client.queue.delete(guildId);
                client.players.delete(guildId);
                client.connections.delete(guildId);
                client.processes.delete(guildId);
                client.textChannels.delete(guildId);
            }
        });

        return connection;
    }
};