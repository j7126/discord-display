/*
discord-display, a web based content display controlled via discord. 
Copyright (C) 2021  Jefferey Neuffer (https://github.com/j7126/)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

// load config
const config = require('../config.js')

// express
const express = require('express')
const expressApp = express()
expressApp.use(express.static('dist'))

// http
const http = require('http')
const httpServer = http.createServer(expressApp)

// socket.io
const { Server: SocketServer } = require("socket.io")
const io = new SocketServer(httpServer)

// discord
const Discord = require('discord.js')
const { start } = require('repl')
const discordClient = new Discord.Client()
require('discord-buttons')(discordClient)
const { MessageButton, MessageActionRow } = require('discord-buttons');

clients = new Map()
activationCodes = new Map()
channels = new Map()

function makeActivationCode() {
    var result = ''
    var characters = 'abcdefghijklmnopqrstuvwxyz0123456789'
    for (var i = 0; i < 6; i++) {
        result += characters.charAt(Math.floor(Math.random() *
            characters.length))
    }
    return result
}

discordClient.on('ready', () => {
    console.log(`Logged in as ${discordClient.user.tag}!`)
})

discordClient.on('message', message => {
    if (message.author.bot) return
    if (message.type != 'DEFAULT') return

    if (channels.has(message.channel.id)) {
        var c = channels.get(message.channel.id)
        c.forEach(element => {
            clients.get(element).handleMessage(message)
        });
    }

    if (message.channel.type === 'dm' || message.mentions.has(discordClient.user, { ignoreRoles: true, ignoreEveryone: true })) {
        const args = message.content.replace(/<@(.*?)>/, "").trim().split(/ +/)
        const commandName = args.shift().toLowerCase()
        var id = message.author.id

        // Start Command
        if (commandName == 'start') {
            if (clients.has(id)) {
                if (clients.get(id).socket == null)
                    message.reply("Looks like you already have a session running.\nPlease activate your session.")
                else
                    message.reply("Looks like you already have a session running.\nTo move your session to this channel, use the `move` command")
                return;
            }
            if (message.channel.type != 'dm' && message.channel.type != 'text') {
                message.reply(`Sorry, this channel type (\`${message.channel.type}\`) is not currently supported`)
            }

            var activationCode = null
            var limit = 1000
            do {
                activationCode = makeActivationCode()
                limit--
            } while (activationCodes.has(activationCode) && limit > 0)
            if (limit <= 0) {
                message.reply("An error occurred, please try again later.")
                return
            }
            activationCodes.set(activationCode, id)

            message.author.send(`\u200b\nYour activation code is \`${activationCode}\`, it will be valid for 30 seconds\nPlease enter it on the web app to get started`)
                .then(msg => {
                    if (message.channel.type !== 'dm')
                        message.reply("Alright, let's get started!\nI have sent you a direct message to get set up.")
                    clients.set(id, {
                        id: id,
                        user: message.author,
                        socket: null,
                        channel: message.channel,
                        quiet: false,
                        anyUsers: false,
                        allowedUsers: [],
                        messageType: 'all',
                        activationCode: activationCode,
                        settingsMessage: null,
                        timeout: null,
                        sessionEnd: function () {
                            if (message.channel.type !== 'dm')
                                this.channel.send(`<@${this.user.id}>'s session in this channel has ended`)
                            if (message.channel.type === 'dm')
                                var channelString = `here`
                            else
                                var channelString = `in \`${this.channel.guild?.name}#${this.channel.name}\``
                            this.user.send(`Your session ${channelString} has ended`)
                            this.settingsMessage.delete()
                            var c = channels.get(this.channel.id)
                            c.splice(c.indexOf(this.id), 1)
                            if (c.length == 0)
                                channels.delete(this.channel.id)
                        },
                        sessionStart: function () {
                            var self = this
                            clearTimeout(this.timeout)
                            if (message.channel.type !== 'dm')
                                this.channel.send(`<@${this.user.id}> has started a session in this channel`)
                            if (message.channel.type === 'dm')
                                var channelString = `here`
                            else
                                var channelString = `in \`${this.channel.guild?.name}#${this.channel.name}\``
                            this.user.send(`You have started a session ${channelString}
This session will end if you close the web app, or if you loose connection`)

                            this.user.send("Session settings:", this.getSettingsButtonRow())
                                .then(message => { self.settingsMessage = message })

                            if (channels.has(this.channel.id)) {
                                channels.get(this.channel.id).push(this.id)
                            } else {
                                channels.set(this.channel.id, [this.id])
                            }
                        },
                        getSettingsButtonRow: function () {
                            let quietButton = new MessageButton()
                                .setStyle(this.quiet ? 'green' : 'red')
                                .setLabel('Quiet Mode')
                                .setID('quietToggle')
                            let anyUsersButton = new MessageButton()
                                .setStyle(this.anyUsers ? 'green' : 'red')
                                .setLabel('Show messages from anyone')
                                .setID('anyUsersToggle')
                            let buttonRow = new MessageActionRow()
                                .addComponents(quietButton, anyUsersButton)
                            return buttonRow
                        },
                        handleMessage: function (m) {
                            this.socket.send({ content: m.content, embeds: m.embeds, attachments: m.attachments })
                        }
                    })
                    clients.get(id).timeout = setTimeout(() => {
                        if (!clients.has(id)) return;
                        var client = clients.get(id)
                        if (client.socket != null) return;
                        activationCodes.delete(activationCode)
                        clients.delete(id)
                    }, 30000);
                })
                .catch(err => {
                    message.reply("I was unable to send you a direct message, please check you message settings.")
                    activationCodes.delete(activationCode)
                })

            return
        }

        // Stop Command
        if (commandName == 'stop' || commandName == 'end') {
            if (clients.has(id)) {
                var client = clients.get(id)
                client.socket.disconnect(true)
            } else {
                message.reply("You don't have any running sessions")
            }
            return
        }

        if (message.channel.type === 'dm' && clients.has(id) && clients.get(id).channel.id == message.channel.id) return;

        message.reply("Sorry, I didn't recognise that command.")
    }
})

discordClient.on('clickButton', async (button) => {
    var id = button.clicker.id;
    if (clients.has(id)) {
        var client = clients.get(id)
        if (button.id == "quietToggle") {
            client.quiet = !client.quiet
        } else if (button.id == "anyUsersToggle") {
            client.anyUsers = !client.anyUsers
        }
        client.settingsMessage.edit("Session settings:", client.getSettingsButtonRow())
        button.reply.defer()
    } else {
        button.channel.send(`<@${id}> You don't have any running sessions`)
    }
})

io.on('connection', (socket) => {
    var id = null
    var client = null
    console.log('a user connected to socket ' + socket.id)
    socket.on('activate', (msg) => {
        if (activationCodes.has(msg)) {
            socket.emit('activate', 'active')
            id = activationCodes.get(msg)
            activationCodes.delete(msg)
            client = clients.get(id)
            client.socket = socket
            client.sessionStart()
        } else {
            socket.emit('activate', 'unknown_code')
        }
        socket.on('disconnect', () => {
            console.log('a user disconnected from socket ' + socket.id)
            if (id != null) {
                client.sessionEnd()
                clients.delete(id)
            }
        })
    });
})

discordClient.login(config.token)

httpServer.listen(config.port, () => {
    console.log(`listening on *:${config.port}`)
})