let player;
let bullets;
let obstacles;
let cursors;
let WASD;
let keyR;
let keySpace;

let client;
let room;
let otherPlayers = {};
let otherPlayerNames = {};
let chargeEffects = {}; // プレイヤーごとのチャージエフェクト(Graphics)

// 弾薬・リロード管理変数（自機用）
let ammo = 3;
const maxAmmo = 3;
let isReloading = false;
let reloadTimer = 0;

// チャージショット管理変数
let isCharging = false;
let chargeStartTime = 0;
let currentChargeLevel = 0; // 0: なし, 1: チャージ中, 2: チャージ完了

// UI 要素
let leftPlayerText;
let leftScoreValue;
let rightPlayerText;
let rightScoreValue;
let timerText;
let ammoText;

let centerText;
let winnerResultText;
let finishText;
let rematchBtn;
let exitBtn;
let opponentRematchText;

let nameTag;
let sceneRef;
let localChargeGraphic;

document.getElementById('startBtn').addEventListener('click', () => {
    const name = document.getElementById('playerName').value || "Player";
    const roomCode = document.getElementById('roomCode').value || "0000";

    document.getElementById('login-form').style.display = 'none';
    startGame(name, roomCode);
});

function startGame(playerName, roomCode) {
    const config = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        backgroundColor: '#000000',
        physics: {
            default: 'arcade',
            arcade: { debug: false }
        },
        scene: { create: create, update: update }
    };

    new Phaser.Game(config);

    async function create() {
        const scene = this;
        sceneRef = scene;

        const gameAreaBg = this.add.graphics();
        gameAreaBg.fillStyle(0x555555, 1);
        gameAreaBg.fillRect(0, 80, 800, 520);

        this.physics.world.setBounds(0, 80, 800, 520);

        obstacles = this.physics.add.staticGroup();

        function createWall(x, y, width, height) {
            const wall = scene.add.rectangle(x, y, width, height, 0x111111);
            scene.physics.add.existing(wall, true);
            obstacles.add(wall);
        }

        // マップ配置
        createWall(400, 340, 40, 40);
        createWall(220, 260, 16, 80);
        createWall(580, 420, 16, 80);
        createWall(550, 190, 16, 60);
        createWall(572, 212, 60, 16);
        createWall(250, 490, 16, 60);
        createWall(228, 468, 60, 16);

        createTexture(this, 'playerTexture', 0x0088ff);
        createTexture(this, 'otherPlayerTexture', 0xff4444);

        // 通常弾テクスチャ (8x8)
        const bulletGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        bulletGraphics.fillStyle(0xffff00, 1);
        bulletGraphics.fillCircle(4, 4, 4);
        bulletGraphics.generateTexture('bulletTexture', 8, 8);

        // チャージ弾テクスチャ (16x16, 水色)
        const chargedBulletGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        chargedBulletGraphics.fillStyle(0x00ffff, 1);
        chargedBulletGraphics.fillCircle(8, 8, 8);
        chargedBulletGraphics.lineStyle(2, 0xffffff, 1);
        chargedBulletGraphics.strokeCircle(8, 8, 7);
        chargedBulletGraphics.generateTexture('chargedBulletTexture', 16, 16);

        player = this.physics.add.sprite(400, 340, 'playerTexture');
        player.setCollideWorldBounds(true);

        this.physics.add.collider(player, obstacles);

        bullets = this.physics.add.group({ defaultKey: 'bulletTexture', maxSize: 50 });

        // 障害物との衝突判定：チャージ弾（isCharged）は貫通させる
        this.physics.add.collider(
            bullets,
            obstacles,
            (bullet, obstacle) => {
                handleBulletBounce(bullet);
            },
            (bullet, obstacle) => {
                return !bullet.isCharged;
            }
        );

        // 画面外判定
        this.physics.world.on('worldbounds', (body) => {
            const bullet = body.gameObject;
            if (bullet && bullet.active && bullets.contains(bullet)) {
                if (bullet.isCharged) {
                    bullet.disableBody(true, true);
                } else {
                    handleBulletBounce(bullet);
                }
            }
        });

        cursors = this.input.keyboard.createCursorKeys();
        WASD = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });
        keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        nameTag = this.add.text(0, 0, playerName, { fontSize: '14px', fill: '#ffffff' }).setOrigin(0.5);
        localChargeGraphic = this.add.graphics();

        // UI
        leftPlayerText = this.add.text(16, 40, 'Player1 | ♡3', { fontSize: '18px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0.5);
        this.add.text(350, 22, 'SCORE', { fontSize: '14px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5, 0.5);
        leftScoreValue = this.add.text(350, 48, '0', { fontSize: '20px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5, 0.5);
        timerText = this.add.text(400, 40, '60', { fontSize: '28px', fill: '#ffff00', fontStyle: 'bold' }).setOrigin(0.5, 0.5);
        this.add.text(450, 22, 'SCORE', { fontSize: '14px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5, 0.5);
        rightScoreValue = this.add.text(450, 48, '0', { fontSize: '20px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5, 0.5);
        rightPlayerText = this.add.text(784, 40, '♡3 | Player2', { fontSize: '18px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(1, 0.5);

        ammoText = this.add.text(16, 580, 'AMMO : 3/3', { fontSize: '16px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0, 1);

        centerText = this.add.text(400, 340, '対戦相手を待っています...', {
            fontSize: '32px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        winnerResultText = this.add.text(400, 250, '', {
            fontSize: '32px',
            fill: '#ffff00',
            fontStyle: 'bold'
        }).setOrigin(0.5).setVisible(false);

        finishText = this.add.text(400, 330, 'FINISH!', {
            fontSize: '48px',
            fill: '#ff4444',
            fontStyle: 'bold'
        }).setOrigin(0.5).setVisible(false);

        opponentRematchText = this.add.text(310, 390, '相手が再戦を希望しています', {
            fontSize: '13px',
            fill: '#ffffff'
        }).setOrigin(0.5).setVisible(false);

        rematchBtn = this.add.text(310, 430, ' 再戦 ', {
            fontSize: '22px',
            fill: '#ffffff',
            backgroundColor: '#28a745',
            padding: { x: 16, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false);

        rematchBtn.on('pointerover', () => rematchBtn.setStyle({ fill: '#ffff00' }));
        rematchBtn.on('pointerout', () => rematchBtn.setStyle({ fill: '#ffffff' }));
        rematchBtn.on('pointerdown', () => {
            if (room) room.send("rematch");
        });

        exitBtn = this.add.text(490, 430, ' ゲーム終了 ', {
            fontSize: '22px',
            fill: '#ffffff',
            backgroundColor: '#dc3545',
            padding: { x: 16, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false);

        exitBtn.on('pointerover', () => exitBtn.setStyle({ fill: '#ffff00' }));
        exitBtn.on('pointerout', () => exitBtn.setStyle({ fill: '#ffffff' }));
        exitBtn.on('pointerdown', () => {
            if (room) {
                room.send("exit");
            } else {
                window.location.reload();
            }
        });

        // クリック射撃（通常弾）
        this.input.on('pointerdown', () => {
            const isStarted = room && room.state && room.state.gameStarted && !room.state.gameOver;
            if (isStarted && !isReloading && ammo > 0 && player && player.visible && !isCharging) {
                shootBullet.call(scene, player.x, player.y, player.rotation, true, false);
                ammo--;

                if (ammo <= 0) {
                    startReload();
                }
            }
        });

        // 接続先URLの動的判定
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = isLocal ? 'ws://localhost:2567' : `${protocol}//${window.location.host}`;

        client = new Colyseus.Client(host);
        try {
            room = await client.joinOrCreate('game_room', { name: playerName, roomCode: roomCode });

            room.onMessage("force_reload", () => {
                window.location.reload();
            });

            room.onMessage("waiting_for_opponent", () => {
                winnerResultText.setVisible(false);
                finishText.setVisible(false);
                rematchBtn.setVisible(false);
                exitBtn.setVisible(false);
                opponentRematchText.setVisible(false);
                centerText.setText("対戦相手を待っています...").setVisible(true);
            });

            room.onMessage("opponent_wants_rematch", () => {
                opponentRematchText.setVisible(true);
            });

            room.state.onChange = () => {
                timerText.setText(room.state.timeLeft.toString());

                let p1 = null;
                let p2 = null;

                room.state.players.forEach((p) => {
                    if (p.playerIndex === 0) p1 = p;
                    if (p.playerIndex === 1) p2 = p;
                });

                if (p1) {
                    leftPlayerText.setText(`${p1.name} | ♡${p1.hp}`);
                    leftScoreValue.setText(`${p1.score}`);
                } else {
                    leftPlayerText.setText('Player1 | ♡3');
                    leftScoreValue.setText('0');
                }

                if (p2) {
                    rightPlayerText.setText(`♡${p2.hp} | ${p2.name}`);
                    rightScoreValue.setText(`${p2.score}`);
                } else {
                    rightPlayerText.setText('♡3 | Player2');
                    rightScoreValue.setText('0');
                }

                if (room.state.gameOver) {
                    cancelCharge();
                    bullets.children.each((b) => {
                        if (b.active) b.disableBody(true, true);
                    });

                    const myState = room.state.players.get(room.sessionId);
                    if (myState && !myState.readyForRematch) {
                        centerText.setVisible(false);
                        winnerResultText.setText(room.state.winnerText).setVisible(true);
                        finishText.setVisible(true);
                        rematchBtn.setVisible(true);
                        exitBtn.setVisible(true);
                    }
                }
            };

            // 自機のHP変化検知用変数
            let lastMyHp = 3;

            room.state.players.onAdd = (playerState, sessionId) => {
                if (sessionId === room.sessionId) {
                    player.setPosition(playerState.x, playerState.y);
                    player.setRotation(playerState.rotation);
                    lastMyHp = playerState.hp;

                    playerState.onChange = () => {
                        player.visible = playerState.hp > 0;
                        updateInvincibleEffect(player, playerState.invincible, scene);

                        // 被弾してHPが減ったのみチャージを中断
                        if (playerState.hp < lastMyHp) {
                            cancelCharge();
                        }
                        lastMyHp = playerState.hp;

                        // 撃破（HP0以下）時、チャージ解除及び弾薬リセット
                        if (playerState.hp <= 0) {
                            cancelCharge();
                            resetAmmo();
                        }
                    };
                } else {
                    // 他プレイヤーの処理
                    const otherPlayer = scene.physics.add.sprite(playerState.x, playerState.y, 'otherPlayerTexture');
                    otherPlayers[sessionId] = otherPlayer;

                    const otherName = scene.add.text(playerState.x, playerState.y - 25, playerState.name, { fontSize: '14px', fill: '#ffaaaa' }).setOrigin(0.5);
                    otherPlayerNames[sessionId] = otherName;

                    const otherChargeG = scene.add.graphics();
                    chargeEffects[sessionId] = otherChargeG;

                    playerState.onChange = () => {
                        otherPlayer.setPosition(playerState.x, playerState.y);
                        otherPlayer.setRotation(playerState.rotation);
                        otherPlayer.visible = playerState.hp > 0;

                        otherName.setPosition(playerState.x, playerState.y - 25);
                        otherName.visible = playerState.hp > 0;

                        updateInvincibleEffect(otherPlayer, playerState.invincible, scene);
                    };
                }
            };

            room.state.players.onRemove = (playerState, sessionId) => {
                if (otherPlayers[sessionId]) {
                    if (otherPlayers[sessionId].invincibleTween) otherPlayers[sessionId].invincibleTween.stop();
                    otherPlayers[sessionId].destroy();
                    otherPlayerNames[sessionId].destroy();
                    if (chargeEffects[sessionId]) chargeEffects[sessionId].destroy();
                    delete otherPlayers[sessionId];
                    delete otherPlayerNames[sessionId];
                    delete chargeEffects[sessionId];
                }
            };

            room.onMessage("shoot", (data) => {
                shootBullet.call(scene, data.x, data.y, data.angle, false, data.isCharged, data.bulletId);
            });

            room.onMessage("destroy_bullet", (data) => {
                bullets.children.each((bullet) => {
                    // チャージ弾（貫通）は一括消去メッセージで消さない
                    if (bullet.active && bullet.bulletId === data.bulletId && !bullet.isCharged) {
                        bullet.disableBody(true, true);
                    }
                });
            });

            room.onMessage("countdown", (data) => {
                winnerResultText.setVisible(false);
                finishText.setVisible(false);
                rematchBtn.setVisible(false);
                exitBtn.setVisible(false);
                opponentRematchText.setVisible(false);

                resetAmmo();
                cancelCharge();

                // カウントダウン開始時に残弾を消去
                bullets.children.each((b) => {
                    if (b.active) b.disableBody(true, true);
                });

                centerText.setText(data.text).setVisible(true);
                if (data.text !== "") {
                    centerText.setScale(1.5);
                    scene.tweens.add({
                        targets: centerText,
                        scaleX: 1.0,
                        scaleY: 1.0,
                        duration: 300,
                        ease: 'Back.out'
                    });
                }
            });

        } catch (e) {
            console.error('接続エラー:', e);
        }
    }

    function update(time, delta) {
        if (!player || !player.visible) {
            cancelCharge();
            return;
        }

        const isStarted = room && room.state && room.state.gameStarted && !room.state.gameOver;

        // リロード処理
        if (Phaser.Input.Keyboard.JustDown(keyR) && isStarted) {
            cancelCharge();
            startReload();
        }

        if (isReloading) {
            reloadTimer -= delta / 1000;
            if (reloadTimer <= 0) {
                isReloading = false;
                reloadTimer = 0;
                ammo = maxAmmo;
            }
        }

        if (isReloading) {
            ammoText.setText(`RELOAD : ${reloadTimer.toFixed(1)}s`);
        } else {
            ammoText.setText(`AMMO : ${ammo}/${maxAmmo}`);
        }

        // --- チャージ処理（SPACEキー） ---
        if (isStarted && !isReloading && ammo > 0) {
            if (Phaser.Input.Keyboard.JustDown(keySpace)) {
                isCharging = true;
                chargeStartTime = time;
                updateChargeLevel(1);
            }

            if (isCharging && keySpace.isDown) {
                const elapsed = time - chargeStartTime;
                if (elapsed >= 2000 && currentChargeLevel !== 2) {
                    updateChargeLevel(2);
                }
            }

            if (isCharging && Phaser.Input.Keyboard.JustUp(keySpace)) {
                const elapsed = time - chargeStartTime;
                const isChargedShot = elapsed >= 2000;

                shootBullet.call(this, player.x, player.y, player.rotation, true, isChargedShot);
                ammo--;

                cancelCharge();

                if (ammo <= 0) {
                    startReload();
                }
            }
        } else if (isCharging) {
            cancelCharge();
        }

        // 移動制御（チャージ中は100に減速）
        const speed = isCharging ? 100 : 200;
        player.body.setVelocity(0);

        if (cursors.left.isDown || WASD.left.isDown) player.body.setVelocityX(-speed);
        if (cursors.right.isDown || WASD.right.isDown) player.body.setVelocityX(speed);
        if (cursors.up.isDown || WASD.up.isDown) player.body.setVelocityY(-speed);
        if (cursors.down.isDown || WASD.down.isDown) player.body.setVelocityY(speed);

        player.body.velocity.normalize().scale(player.body.velocity.length() > 0 ? speed : 0);

        const pointer = this.input.activePointer;
        const angle = Phaser.Math.Angle.Between(player.x, player.y, pointer.x, pointer.y);
        player.setRotation(angle);

        nameTag.setPosition(player.x, player.y - 25);
        nameTag.visible = player.visible;

        // 自機のチャージリング描画
        drawChargeRing(localChargeGraphic, player.x, player.y, currentChargeLevel, player.visible);

        // 他プレイヤーのチャージリングのリアルタイム追従描画
        if (room && room.state) {
            for (let sessionId in otherPlayers) {
                const otherPlayer = otherPlayers[sessionId];
                const otherChargeG = chargeEffects[sessionId];
                const playerState = room.state.players.get(sessionId);

                if (otherPlayer && otherChargeG && playerState) {
                    drawChargeRing(otherChargeG, otherPlayer.x, otherPlayer.y, playerState.chargeLevel, otherPlayer.visible);
                }
            }
        }

        if (room) {
            room.send("move", { x: player.x, y: player.y, rotation: player.rotation });
        }

        // 弾の当たり判定処理
        bullets.children.each((bullet) => {
            if (!bullet.active) return;

            if (bullet.isLocal) {
                for (let sessionId in otherPlayers) {
                    const target = otherPlayers[sessionId];
                    const targetState = room ? room.state.players.get(sessionId) : null;

                    if (target && target.visible && targetState && !targetState.invincible) {
                        const dist = Phaser.Math.Distance.Between(bullet.x, bullet.y, target.x, target.y);
                        const hitDistance = bullet.isCharged ? 24 : 20;

                        if (dist < hitDistance) {
                            if (bullet.isCharged) {
                                if (!bullet.hitSet) bullet.hitSet = new Set();
                                if (!bullet.hitSet.has(sessionId)) {
                                    bullet.hitSet.add(sessionId);
                                    if (room) {
                                        room.send("hit", { targetId: sessionId, bulletId: bullet.bulletId, isCharged: true, damage: 2 });
                                    }
                                }
                            } else {
                                bullet.disableBody(true, true);

                                if (room) {
                                    room.send("hit", { targetId: sessionId, bulletId: bullet.bulletId, isCharged: false, damage: 1 });
                                }
                                break;
                            }
                        }
                    }
                }
            }
        });
    }
}

function updateChargeLevel(level) {
    currentChargeLevel = level;
    if (room) {
        room.send("set_charge", { level: level });
    }
}

function cancelCharge() {
    isCharging = false;
    chargeStartTime = 0;
    if (currentChargeLevel !== 0) {
        updateChargeLevel(0);
    }
}

// 全プレイヤーのチャージ描画をクリアする関数
function clearAllChargeEffects() {
    // 自機のチャージグラフィックをクリア
    if (typeof localChargeGraphic !== 'undefined' && localChargeGraphic) {
        localChargeGraphic.clear();
    }

    // 他プレイヤーのチャージグラフィックをすべてクリア
    if (typeof chargeEffects !== 'undefined' && chargeEffects) {
        for (let id in chargeEffects) {
            if (chargeEffects[id]) {
                chargeEffects[id].clear();
            }
        }
    }
}

function drawChargeRing(graphics, x, y, level, isVisible) {
    graphics.clear();
    if (!isVisible || level === 0) return;

    if (level === 1) {
        graphics.lineStyle(1, 0xffffff, 1);
        graphics.strokeCircle(x, y, 18);
    } else if (level === 2) {
        graphics.lineStyle(3, 0xffffff, 1);
        graphics.strokeCircle(x, y, 19);
    }
}

function handleBulletBounce(bullet) {
    if (!bullet || !bullet.active) return;

    const now = sceneRef ? sceneRef.time.now : Date.now();
    if (bullet.lastBounceTime && (now - bullet.lastBounceTime < 50)) {
        return;
    }
    bullet.lastBounceTime = now;
    bullet.bounceCount = (bullet.bounceCount || 0) + 1;

    if (bullet.bounceCount >= 2) {
        bullet.disableBody(true, true);
    }
}

function startReload() {
    if (isReloading || ammo === maxAmmo) return;
    isReloading = true;
    reloadTimer = 3.0;
}

function resetAmmo() {
    ammo = maxAmmo;
    isReloading = false;
    reloadTimer = 0;
}

function updateInvincibleEffect(sprite, isInvincible, scene) {
    if (isInvincible) {
        if (!sprite.invincibleTween) {
            sprite.invincibleTween = scene.tweens.add({
                targets: sprite,
                alpha: 0.2,
                duration: 100,
                ease: 'Linear',
                yoyo: true,
                repeat: -1
            });
        }
    } else {
        if (sprite.invincibleTween) {
            sprite.invincibleTween.stop();
            sprite.invincibleTween = null;
            sprite.setAlpha(1.0);
        }
    }
}

function createTexture(scene, key, color) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color, 1);
    g.fillCircle(16, 16, 16);
    g.lineStyle(3, 0xffffff, 1);
    g.beginPath();
    g.moveTo(16, 16);
    g.lineTo(32, 16);
    g.strokePath();
    g.generateTexture(key, 32, 32);
}

function shootBullet(x, y, angle, isLocal, isCharged = false, bulletId = null) {
    const textureKey = isCharged ? 'chargedBulletTexture' : 'bulletTexture';
    const bullet = bullets.get(x, y, textureKey);
    if (bullet) {
        bullet.enableBody(true, x, y, true, true);
        bullet.setTexture(textureKey);
        bullet.isLocal = isLocal;
        bullet.isCharged = isCharged;
        bullet.bounceCount = 0;
        bullet.lastBounceTime = 0;
        bullet.hitSet = new Set();

        const id = bulletId || `${room ? room.sessionId : 'local'}_${Date.now()}_${Math.random()}`;
        bullet.bulletId = id;

        bullet.body.setCollideWorldBounds(true);
        bullet.body.onWorldBounds = true;

        if (isCharged) {
            bullet.body.setSize(16, 16);
            bullet.body.setOffset(0, 0);
            bullet.body.setBounce(0, 0);
            this.physics.velocityFromRotation(angle, 1200, bullet.body.velocity);
        } else {
            bullet.body.setSize(8, 8);
            bullet.body.setOffset(0, 0);
            bullet.body.setBounce(1, 1);
            this.physics.velocityFromRotation(angle, 750, bullet.body.velocity);
        }

        if (isLocal && room) {
            room.send("shoot", { x: x, y: y, angle: angle, bulletId: id, isCharged: isCharged });
        }
    }
}