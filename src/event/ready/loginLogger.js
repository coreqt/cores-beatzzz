module.exports = {
    execute: (client)=>{
        console.log(`Logged in as ${client.user.tag}`)
    },
    once: true
}