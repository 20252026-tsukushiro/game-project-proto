const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server } = require('colyseus');
const { GameRoom } = require('./GameRoom');

const app = express();
app.use(cors());
app.use(express.json());

// ★ client フォルダ内のファイル（index.html, game.js など）を静的ファイルとして配信
app.use(express.static(path.join(__dirname, '../client')));

const server = http.createServer(app);
const gameServer = new Server({ server });

// 'game_room' という名前で GameRoom を登録し、roomCode と mode でフィルタリング可能にする
gameServer.define('game_room', GameRoom).filterBy(['roomCode', 'mode']);

const PORT = process.env.PORT || 2567;

server.listen(PORT, () => {
    console.log(`Colyseus Server running on port ${PORT}`);
});