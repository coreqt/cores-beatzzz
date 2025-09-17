

module.exports = {
    structure: {
        name: "ping",
        description: "Sends Pong! and other details related connectivity",
        alias: null,
    },
    execute: (message, client) => {
        message.channel.send(`Pong! <@${message.author.id}>`);
    
    }
}