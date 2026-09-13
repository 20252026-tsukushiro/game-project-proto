// PveGameRoom.js
const { Room } = require('colyseus');
const { PveGameState, PvePlayer } = require('./PveGameState');

// 難易度の設定定義
const DIFFICULTY_CONFIG = {
    easy:   { time: 60,  minPlayers: 1, maxPlayers: 1 },
    normal: { time: 120, minPlayers: 1, maxPlayers: 3 },
    hard:   { time: 180, minPlayers: 3, maxPlayers: 3 }
};

class PveGameRoom extends Room {
    onCreate(options) {
        this.maxClients = 3; // 最大3名
        this.setState(new PveGameState());
        this.state.roomCode = options.roomCode || "0000";

        // --- メッセージハンドラー ---
        
        // 難易度変更（ホストのみ）
        this.onMessage("select_difficulty", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (!player || !player.isHost) return;

            if (DIFFICULTY_CONFIG[data.difficulty]) {
                this.state.difficulty = data.difficulty;
            }
        });

        // 「このメンバーで挑戦」ボタン（ホストのみ）
        this.onMessage("start_game", (client) => {
            const player = this.state.players.get(client.sessionId);
            if (!player || !player.isHost) return;

            const activePlayerCount = this.state.players.size;
            const config = DIFFICULTY_CONFIG[this.state.difficulty];

            // 人数条件チェック
            if (activePlayerCount < config.minPlayers || activePlayerCount > config.maxPlayers) {
                // 条件を満たさない場合はホストへエラーメッセージを送信
                client.send("error_message", { message: "この人数では挑戦できません" });
                return;
            }

            // ゲーム開始処理へ
            this.state.gameStarted = true;
            this.broadcast("start_countdown");
        });
    }

    onJoin(client, options) {
        const player = new PvePlayer();
        player.id = client.sessionId;

        // 空いているインデックス（0, 1, 2）を取得
        const usedIndexes = new Set();
        this.state.players.forEach(p => usedIndexes.add(p.playerIndex));
        let assignedIndex = 0;
        while (usedIndexes.has(assignedIndex) && assignedIndex < 3) {
            assignedIndex++;
        }

        player.playerIndex = assignedIndex;
        player.name = options.playerName || `Player${assignedIndex + 1}`;

        // 最初の参加者をホストに設定
        if (this.state.players.size === 0) {
            player.isHost = true;
        }

        this.state.players.set(client.sessionId, player);
    }

    onLeave(client) {
        const leavingPlayer = this.state.players.get(client.sessionId);
        const wasHost = leavingPlayer ? leavingPlayer.isHost : false;

        this.state.players.delete(client.sessionId);

        // ホストが退室した場合は、次のプレイヤーへホスト権限を移譲
        if (wasHost && this.state.players.size > 0) {
            const firstRemaining = this.state.players.values().next().value;
            if (firstRemaining) {
                firstRemaining.isHost = true;
            }
        }
    }
}

module.exports = PveGameRoom;