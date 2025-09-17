const fs = require("node:fs");
const path = require("node:path");
const config = require('../../config/config.json');
const prefix = config.bot.prefix;

module.exports = {
    execute: (message, client) => {
        if (!message.content.toLowerCase().startsWith(prefix) || message.author.bot) return;
        let args = message.content.slice(prefix.length).split(" ");
        const command = args.shift();

        const commandsDir = path.join(__dirname, "..", "..", "command");
        const commands = fs.readdirSync(commandsDir);

        commands.forEach((_command, i) => {
            if (command != _command) return;
            
            const commandDir = path.join(commandsDir, _command);
            const commandFiles = fs.readdirSync(commandDir);

            commandFiles.forEach((commandFile, j) => {

                if(!commandFile.endsWith('.js'))return;

                const commandFilePath = path.join(commandDir, commandFile);


                try {
                    const commandModule = require(commandFilePath);
                    commandModule.execute(message, args, client);

                } catch (error) {
                    console.log(error)
                    message.channel.send(`There was an error while executing that command\${error}`);
                }

            })


        })


        // console.log(commands)


    },
    once: false,
}