// PveGameState.js
const schema = require('@colyseus/schema');
const { Schema, MapSchema, type } = schema;

class PvePlayer extends Schema {
    constructor() {
        super();
        this.id = "";
        this.name = "";
        this.playerIndex = 0; // 0, 1, 2
        this.isHost = false;
        this.x = 0;
        this.y = 0;
        this.hp = 3;
    }
}
type("string")(PvePlayer.prototype, "id");
type("string")(PvePlayer.prototype, "name");
type("number")(PvePlayer.prototype, "playerIndex");
type("boolean")(PvePlayer.prototype, "isHost");
type("number")(PvePlayer.prototype, "x");
type("number")(PvePlayer.prototype, "y");
type("number")(PvePlayer.prototype, "hp");

class PveGameState extends Schema {
    constructor() {
        super();
        this.roomCode = "";
        this.difficulty = "easy"; // default: easy
        this.gameStarted = false;
        this.gameOver = false;
        this.players = new MapSchema();
    }
}
type("string")(PveGameState.prototype, "roomCode");
type("string")(PveGameState.prototype, "difficulty");
type("boolean")(PveGameState.prototype, "gameStarted");
type("boolean")(PveGameState.prototype, "gameOver");
type({ map: PvePlayer })(PveGameState.prototype, "players");

module.exports = { PveGameState, PvePlayer };