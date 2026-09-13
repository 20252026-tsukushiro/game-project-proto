// PveLobbyScene.js (または game.js 内のPvE待機UI処理)
class PveLobbyScene extends Phaser.Scene {
    constructor() {
        super("PveLobbyScene");
    }

    create() {
        const { width, height } = this.scale;

        // --- 1. 左上：部屋番号 ---
        this.roomCodeText = this.add.text(20, 20, `部屋番号 : ${room.state.roomCode}`, {
            fontSize: '22px', fill: '#ffffff', fontFamily: 'sans-serif'
        });

        // --- 2. 難易度ボタン (easy, normal, hard) ---
        this.difficultyButtons = {};
        const difficulties = [
            { key: 'easy', label: 'easy', x: width / 2 - 180 },
            { key: 'normal', label: 'normal', x: width / 2 },
            { key: 'hard', label: 'hard', x: width / 2 + 180 }
        ];

        difficulties.forEach(d => {
            const container = this.add.container(d.x, 100);

            // 外枠（選択用ハイライト青枠）
            const highlight = this.add.graphics();
            highlight.lineStyle(6, 0x4d5eff, 1);
            highlight.strokeRoundedRect(-65, -28, 130, 56, 16);
            highlight.setVisible(false);

            // ボタン背景
            const bg = this.add.graphics();
            bg.fillStyle(0xffffff, 1);
            bg.fillRoundedRect(-60, -23, 120, 46, 14);

            // テキスト
            const txt = this.add.text(0, 0, d.label, {
                fontSize: '24px', fill: '#000000', fontWeight: 'bold', fontFamily: 'sans-serif'
            }).setOrigin(0.5);

            bg.setInteractive(new Phaser.Geom.Rectangle(-60, -23, 120, 46), Phaser.Geom.Rectangle.Contains);
            bg.on('pointerdown', () => {
                const myState = room.state.players.get(room.sessionId);
                if (myState && myState.isHost) {
                    room.send("select_difficulty", { difficulty: d.key });
                }
            });

            container.add([highlight, bg, txt]);
            this.difficultyButtons[d.key] = { container, highlight };
        });

        // 難易度ごとの説明テキスト
        this.difficultyInfoText = this.add.text(width / 2, 170, "", {
            fontSize: '20px', fill: '#ffffff', fontFamily: 'sans-serif'
        }).setOrigin(0.5);

        // --- 3. プレイヤーリスト枠 (1, 2, 3) ---
        this.playerSlots = [];
        for (let i = 0; i < 3; i++) {
            const yPos = 240 + i * 50;
            const numText = this.add.text(80, yPos, `${i + 1}`, {
                fontSize: '28px', fill: '#ffffff', fontWeight: 'bold'
            }).setOrigin(0.5);

            const nameText = this.add.text(180, yPos, "", {
                fontSize: '24px', fill: '#ffffff', fontWeight: 'bold'
            }).setOrigin(0, 0.5);

            this.playerSlots.push(nameText);
        }

        // --- 4. エラーメッセージテキスト ---
        this.errorText = this.add.text(width - 160, height - 90, "", {
            fontSize: '18px', fill: '#ff4d4d', fontWeight: 'bold'
        }).setOrigin(0.5);

        // --- 5. 退室するボタン ---
        const exitBtnBg = this.add.graphics();
        exitBtnBg.fillStyle(0x990011, 1);
        exitBtnBg.fillRoundedRect(30, height - 70, 140, 50, 18);
        const exitBtnTxt = this.add.text(100, height - 45, "退室する", {
            fontSize: '22px', fill: '#ffffff', fontWeight: 'bold'
        }).setOrigin(0.5);

        exitBtnBg.setInteractive(new Phaser.Geom.Rectangle(30, height - 70, 140, 50), Phaser.Geom.Rectangle.Contains);
        exitBtnBg.on('pointerdown', () => {
            if (room) room.leave();
            window.location.reload(); // ページを再読み込みして最初の対戦ルーム接続画面に戻る
        });

        // --- 6. このメンバーで挑戦ボタン（ホストのみ表示） ---
        this.startBtnContainer = this.add.container(width - 160, height - 45);
        const startBtnBg = this.add.graphics();
        startBtnBg.fillStyle(0x00cc44, 1);
        startBtnBg.fillRoundedRect(-120, -25, 240, 50, 18);

        const startBtnTxt = this.add.text(0, 0, "このメンバーで挑戦", {
            fontSize: '22px', fill: '#ffffff', fontWeight: 'bold'
        }).setOrigin(0.5);

        startBtnBg.setInteractive(new Phaser.Geom.Rectangle(-120, -25, 240, 50), Phaser.Geom.Rectangle.Contains);
        startBtnBg.on('pointerdown', () => {
            this.errorText.setText("");
            room.send("start_game");
        });

        this.startBtnContainer.add([startBtnBg, startBtnTxt]);

        // --- サーバーメッセージ・状態変更受信 ---
        
        // エラー受信（人数不一致時など）
        room.onMessage("error_message", (data) => {
            this.errorText.setText(data.message);
            this.tweens.add({
                targets: this.errorText,
                alpha: { from: 1, to: 0 },
                duration: 3000,
                ease: 'Power2'
            });
        });

        // ステート同期
        room.onStateChange((state) => {
            this.updateUI(state);
        });
    }

    updateUI(state) {
        // 1. 部屋番号更新
        this.roomCodeText.setText(`部屋番号 : ${state.roomCode}`);

        // 2. 難易度・ハイライト更新
        const diffConfig = {
            easy: "制限時間：60秒 挑戦人数：1人",
            normal: "制限時間：120秒 挑戦人数：1~3人",
            hard: "制限時間：180秒 挑戦人数：3人"
        };

        for (let key in this.difficultyButtons) {
            this.difficultyButtons[key].highlight.setVisible(key === state.difficulty);
        }
        this.difficultyInfoText.setText(diffConfig[state.difficulty] || "");

        // 3. プレイヤーリスト更新（入室順）
        const sortedPlayers = Array.from(state.players.values()).sort((a, b) => a.playerIndex - b.playerIndex);
        for (let i = 0; i < 3; i++) {
            if (sortedPlayers[i]) {
                this.playerSlots[i].setText(sortedPlayers[i].name);
            } else {
                this.playerSlots[i].setText(""); // 空き枠
            }
        }

        // 4. ホスト権限の確認と挑戦ボタン表示切り替え
        const myState = state.players.get(room.sessionId);
        const isHost = myState ? myState.isHost : false;
        this.startBtnContainer.setVisible(isHost);
    }
}