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

import 'material-icons/iconfont/material-icons.css';

import Vue from 'vue';

import 'mdc-vue-wrapper'

import io from 'socket.io-client'

import * as linkify from 'linkifyjs';

var app
var socket

var testImage = function (url) {
    return new Promise(function (resolve, reject) {
        var timeout = 5000;
        var timer, img = new Image();
        img.onerror = img.onabort = function () {
            clearTimeout(timer);
            img = null;
            reject("error");
        };
        img.onload = function () {
            clearTimeout(timer);
            img = null;
            resolve("success");
        };
        timer = setTimeout(function () {
            img.src = "";
            img = null;
            reject("timeout");
        }, timeout);
        img.src = url;
    });
}

app = new Vue({
    el: '#app',
    data: {
        activationCode: '',
        activationCodeError: null,
        active: false,
        currentContent: null,
        currentCaption: '',
    },
    methods: {
        sendActivationCode: function () {
            this.activationCodeError = null;
            setTimeout(() => {
                if (this.activationCode.length != 6) {
                    this.activationCodeError = "The entered code is not valid.";
                    return;
                }
                socket.emit('activate', this.activationCode);
            }, 0);
        },
        activationCodeKeyup: function (e) {
            if (e.keyCode == 13) {
                this.sendActivationCode()
            }
        },
        goFs: function () {
            document.documentElement.requestFullscreen()
        }
    },
    computed: {
        contentStyle: function () {
            var style = {};
            if (this.currentContent == null) return;
            if (this.currentContent.type == 'image')
                style['background-image'] = `url('${this.currentContent.url}')`;
            return style;
        },
        caption: function () {
            if (this.currentCaption != '')
                return this.currentCaption;
            if (this.currentContent == null)
                return "";
            if (this.currentContent.type == 'image')
                return this.currentContent.caption;
        },
    },
    mounted: function () {
        var self = this;
        socket = io();
        socket.on("disconnect", (reason) => {
            console.log('disconnected: ' + reason);
            location.reload();
        });
        socket.on('activate', function (msg) {
            if (msg == 'unknown_code') {
                self.activationCodeError = "The entered code is not valid.";
                return
            }
            if (msg == 'active') {
                self.active = true;
                socket.on('message', function (msg) {
                    if (msg.content == '!clear') {
                        self.currentContent = null;
                        self.currentCaption = '';
                        return;
                    }
                    if (msg.content == '!clear text') {
                        self.currentCaption = ' ';
                        return;
                    }
                    var links = linkify.find(msg.content);
                    if (links.length > 0) {
                        for (const element of links) {
                            msg.content = msg.content.replace(element.value, '');
                        }
                    }
                    if (msg.attachments.length > 0) {
                        self.currentContent = {};
                        self.currentContent.type = 'image';
                        self.currentContent.url = msg.attachments[0].proxyURL;
                        self.currentContent.caption = msg.content;
                        self.currentCaption = '';
                        return;
                    }
                    if (links.length > 0) {
                        testImage(links[0].href).then(() => {
                            self.currentContent = {};
                            self.currentContent.type = 'image';
                            self.currentContent.url = links[0].href;
                            self.currentContent.caption = '';
                        });
                    }
                    self.currentCaption = msg.content;
                });
                return
            }
            self.activationCodeError = "Unknown response.";
        });
    }
});