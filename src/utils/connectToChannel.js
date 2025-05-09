
const { joinVoiceChannel, createAudioPlayer, entersState, VoiceConnectionStatus, AudioPlayerStatus  } = require("@discordjs/voice");
const {playTrack} = require('./playTrack');

/**
 * Connects the bot to a voice channel and sets up the audio player.
 * @param {VoiceChannel} voiceChannel The voice channel to join.
 */
const { client } = require("../core/main");

module.exports = {
    connectToChannel: async(voiceChannel) => {
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
        client.connections.set(guildId, connection);
        client.players.set(guildId, player);

        // When a track finishes (Idle), play the next one or leave if queue is empty
        player.on(AudioPlayerStatus.Idle, () => {
            const guildQueue = client.queue.get(guildId);
            const textChannel = client.textChannels.get(guildId);
            if (!guildQueue || guildQueue.length === 0) {
                // No more songs: disconnect and clean up
                connection.destroy();
                client.queue.delete(guildId);
                client.players.delete(guildId);
                client.connections.delete(guildId);
                client.processes.delete(guildId);
                client.textChannels.delete(guildId);
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
                client.queue.delete(guildId);0
                client.players.delete(guildId);
                client.connections.delete(guildId);
                client.processes.delete(guildId);
                client.textChannels.delete(guildId);
            }
        });
        return;
    }
}