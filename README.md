# discord-display

A web based content display controlled via discord.

A discord bot which hosts a web app which can be used to display the latest image message and text caption from a discord channel.

@ mentiuon the bot in a discord channel with the start command `@discord-display start`. The bot will send a direct message with an activation code to be entered on the web app. The web app will then display content form the channel where the initial command was sent.

Built with material-components-web, vuejs, socket.io and webpack. 

To host the bot, add the `config.js` file and then run `npm start`

`config.js`
```js
module.exports = {
    port: HTTP_PORT,
    token: 'DISCORD_BOT_TOKEN',
};
```
