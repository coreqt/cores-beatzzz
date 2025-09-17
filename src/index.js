require('dotenv').config();
const token = process.env.TOKEN;
const {client} = require('./core/main');

client.login(token)