const { Room } = require('colyseus');
const { Schema, MapSchema, defineTypes } = require('@colyseus/schema');

class Player extends Schema {
    constructor() {
        super();
        this.x = 0;
        this.y = 0;
        this.rotation = 0;
        this.name = "Player";
        this.hp = 3;
        this.score = 0;
        this.playerIndex = 0;
        this.invincible = false;
        this.readyForRematch = false;
        this.chargeLevel = 0;
        this.isSpectator = false; // ★観戦者フラグ
    }
}
defineTypes(Player, {
    x: "number",
    y: "number",
    rotation: "number",
    name: "string",
    hp: "number",
    score: "number",
    playerIndex: "number",
    invincible: "boolean",
    readyForRematch: "boolean",
    chargeLevel: "number",
    isSpectator: "boolean" // ★定義追加
});

class GameState extends Schema {
    constructor() {
        super();
        this.players = new MapSchema();
        this.gameStarted = false;
        this.gameOver = false;
        this.timeLeft = 60;
        this.winnerText = "";
    }
}
defineTypes(GameState, {
    players: { map: Player },
    gameStarted: "boolean",
    gameOver: "boolean",
    timeLeft: "number",
    winnerText: "string"
});

class GameRoom extends Room {
    onCreate(options) {
        this.setState(new GameState());
        this.isCountingDown = false;
        this.gameTimerInterval = null;

        this.onMessage("move", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (player && !player.isSpectator && player.hp > 0 && !this.state.gameOver) {
                player.x = data.x;
                player.y = data.y;
                player.rotation = data.rotation;
            }
        });

        this.onMessage("set_charge", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (player && !player.isSpectator && player.hp > 0 && !this.state.gameOver) {
                player.chargeLevel = data.level || 0;
            }
        });

        this.onMessage("shoot", (client, data) => {
            if (!this.state.gameStarted || this.state.gameOver) return;

            const player = this.state.players.get(client.sessionId);
            if (player && !player.isSpectator && player.hp > 0) {
                this.broadcast("shoot", {
                    x: data.x,
                    y: data.y,
                    angle: data.angle,
                    ownerId: client.sessionId,
                    bulletId: data.bulletId,
                    isCharged: data.isCharged || false
                }, { except: client });
            }
        });

        this.onMessage("hit", (client, data) => {
            if (!this.state.gameStarted || this.state.gameOver) return;

            const damage = data.damage || 1;

            if (data.bulletId && !data.isCharged) {
                this.broadcast("destroy_bullet", { bulletId: data.bulletId });
            }

            const target = this.state.players.get(data.targetId);
            const attacker = this.state.players.get(client.sessionId);

            if (target && !target.isSpectator && target.hp > 0 && !target.invincible) {
                target.hp -= damage;
                target.chargeLevel = 0;

                if (target.hp <= 0) {
                    target.hp = 0;
                    if (attacker) attacker.score += 1;
                    target.invincible = false;

                    this.clock.setTimeout(() => {
                        if (this.state.gameOver) return;
                        target.hp = 3;
                        target.x = target.playerIndex === 0 ? 100 : 700;
                        target.y = 340;
                        target.invincible = true;

                        this.clock.setTimeout(() => {
                            target.invincible = false;
                        }, 2000);
                    }, 2000);
                } else {
                    target.invincible = true;
                    this.clock.setTimeout(() => {
                        target.invincible = false;
                    }, 2000);
                }
            }
        });

        this.onMessage("rematch", (client) => {
            const player = this.state.players.get(client.sessionId);
            if (player && !player.isSpectator && this.state.gameOver && !this.isCountingDown) {
                player.readyForRematch = true;

                let allReady = true;
                let activeCount = 0;
                this.state.players.forEach((p) => {
                    if (!p.isSpectator) {
                        activeCount++;
                        if (!p.readyForRematch) allReady = false;
                    }
                });

                if (activeCount >= 2 && allReady) {
                    this.resetAndStart();
                } else {
                    client.send("waiting_for_opponent");
                    this.broadcast("opponent_wants_rematch", {}, { except: client });
                }
            }
        });

        this.onMessage("exit", (client) => {
            const player = this.state.players.get(client.sessionId);
            // 対戦プレイヤーが押した場合のみ全員をトップに戻す
            if (player && !player.isSpectator) {
                this.broadcast("force_reload");
            }
        });
    }

    onJoin(client, options) {
        const player = new Player();
        player.name = options.name || "Player";

        // アクティブプレイヤー（対戦者）の数をカウント
        let activePlayers = [];
        this.state.players.forEach((p) => {
            if (!p.isSpectator) activePlayers.push(p);
        });

        if (activePlayers.length >= 2) {
            // 3人目以降は観戦モードにする
            player.isSpectator = true;
            player.playerIndex = -1;
            player.hp = 0;
        } else {
            // 対戦プレイヤーとして登録
            player.isSpectator = false;
            player.playerIndex = activePlayers.length;
            player.x = player.playerIndex === 0 ? 100 : 700;
            player.y = 340;
            player.rotation = player.playerIndex === 0 ? 0 : Math.PI;
        }

        this.state.players.set(client.sessionId, player);

        let currentActiveCount = 0;
        this.state.players.forEach((p) => { if (!p.isSpectator) currentActiveCount++; });

        if (currentActiveCount === 2 && !this.isCountingDown && !this.state.gameStarted && !this.state.gameOver) {
            this.startCountdown();
        }
    }

    resetAndStart() {
        if (this.gameTimerInterval) {
            this.gameTimerInterval.clear();
            this.gameTimerInterval = null;
        }

        this.state.players.forEach((p) => {
            if (!p.isSpectator) {
                p.hp = 3;
                p.score = 0;
                p.x = p.playerIndex === 0 ? 100 : 700;
                p.y = 340;
                p.rotation = p.playerIndex === 0 ? 0 : Math.PI;
                p.invincible = false;
                p.readyForRematch = false;
                p.chargeLevel = 0;
            }
        });

        this.state.gameOver = false;
        this.state.gameStarted = false;
        this.state.timeLeft = 60;
        this.state.winnerText = "";

        this.startCountdown();
    }

    startCountdown() {
        this.isCountingDown = true;
        let count = 3;

        this.broadcast("countdown", { text: "3" });

        const interval = this.clock.setInterval(() => {
            count--;
            if (count > 0) {
                this.broadcast("countdown", { text: count.toString() });
            } else if (count === 0) {
                this.broadcast("countdown", { text: "GAME START!" });
                this.state.gameStarted = true;
                this.startMatchTimer();
            } else {
                this.broadcast("countdown", { text: "" });
                this.isCountingDown = false;
                interval.clear();
            }
        }, 1000);
    }

    startMatchTimer() {
        this.state.timeLeft = 60;

        if (this.gameTimerInterval) {
            this.gameTimerInterval.clear();
        }

        this.gameTimerInterval = this.clock.setInterval(() => {
            if (this.state.timeLeft > 0) {
                this.state.timeLeft--;
            }

            if (this.state.timeLeft <= 0) {
                this.gameTimerInterval.clear();
                this.gameTimerInterval = null;
                this.finishGame();
            }
        }, 1000);
    }

    finishGame() {
        this.state.gameStarted = false;
        this.state.gameOver = true;

        let activePlayerList = [];
        this.state.players.forEach((p) => {
            if (!p.isSpectator) activePlayerList.push(p);
        });

        if (activePlayerList.length >= 2) {
            const p1 = activePlayerList.find(p => p.playerIndex === 0) || activePlayerList[0];
            const p2 = activePlayerList.find(p => p.playerIndex === 1) || activePlayerList[1];

            if (p1.score > p2.score) {
                this.state.winnerText = `WINNER : ${p1.name}`;
            } else if (p2.score > p1.score) {
                this.state.winnerText = `WINNER : ${p2.name}`;
            } else {
                // 復活待ち（HP0）のプレイヤーは復活後のHP（3）として計算
                const p1EffectiveHp = p1.hp === 0 ? 3 : p1.hp;
                const p2EffectiveHp = p2.hp === 0 ? 3 : p2.hp;

                if (p1EffectiveHp > p2EffectiveHp) {
                    this.state.winnerText = `WINNER : ${p1.name}`;
                } else if (p2EffectiveHp > p1EffectiveHp) {
                    this.state.winnerText = `WINNER : ${p2.name}`;
                } else {
                    this.state.winnerText = "DRAW : 引き分け";
                }
            }
        } else if (activePlayerList.length === 1) {
            this.state.winnerText = `WINNER : ${activePlayerList[0].name}`;
        } else {
            this.state.winnerText = "DRAW : 引き分け";
        }
    }

    onLeave(client) {
        const leavingPlayer = this.state.players.get(client.sessionId);
        const isSpectator = leavingPlayer ? leavingPlayer.isSpectator : true;
        this.state.players.delete(client.sessionId);
        
        // 対戦プレイヤーが抜けたらゲームを終了/リセット、観戦者なら無視
        if (!isSpectator) {
            this.broadcast("force_reload");
        }
    }
}

module.exports = { GameRoom };