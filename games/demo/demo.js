// Game code goes here....

class LogBlock extends GameCollisionObject {
    constructor(x, y, assets) {
        super(x, y, assets);
        this._sprite = assets.sprites.logSprite.buildSprite();
        this._collisionSides = {"top": true};
    }
    
    update(timeStep, gameState) {}
    
    draw(canvas, painter, camera) {
        // Implement this:
        let [cx, cy, cw, ch] = camera.transformBox([this.x, this.y - 3/32, 1, 1]);
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    drawPreview(canvas, painter, box) {
        let [cx, cy, cw, ch] = box;
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
}

class GameBlock extends GameCollisionObject {
    constructor(x, y, assets) {
        super(x, y, assets);
        this._sprite = assets.sprites.sandSprite.buildSprite();
        this._sprite.setAnimation("middle");
    }
    
    update(timeStep, gameState) {
        // Do we do anything in update?
        // No, because blocks don't move.
    }
    
    draw(canvas, painter, camera) {
        // Implement this:
        let [cx, cy, cw, ch] = camera.transformBox([this.x, this.y, 1, 1]);
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    drawPreview(canvas, painter, box) {
        let [cx, cy, cw, ch] = box;
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
}

class GameBlock2 extends GameCollisionObject {
    constructor(x, y, assets) {
        super(x, y, assets);
        this._sprite = assets.sprites.sandSprite.buildSprite();
        this._sprite.setAnimation("top");
    }
    
    update(timeStep, gameState) {
        // Do we do anything in update?
        // No, because blocks don't move.
    }
    
    draw(canvas, painter, camera) {
        // Implement this:
        let [cx, cy, cw, ch] = camera.transformBox([this.x, this.y - (3 / 32), 1, 35 / 32]);
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    drawPreview(canvas, painter, box) {
        let [cx, cy, cw, ch] = box;
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    getZOrder() {
        return 2;
    }
}

class Tree extends GameObject {
    constructor(x, y, assets) {
        super(x, y, assets);
        this._sprite = assets.sprites.treeSprite.buildSprite();
        this._numBlocks = 4;
        this._digIn = 4 / 32;
    }
    
    draw(canvas, painter, camera) {
        // Implement this:
        let scale = this._numBlocks;
        let [cx, cy, cw, ch] = camera.transformBox([
            this.x, this.y, scale * (this._sprite.width / this._sprite.height), scale + this._digIn
        ]);
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    drawPreview(canvas, painter, box) {
        let [cx, cy, cw, ch] = box;
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    getHitBoxes() {
        return [[this.x, this.y, 5, 4]];
    }
    
    getZOrder() {
        return -1
    }
}

class Grass extends GameObject {
    constructor(x, y, assets) {
        super(x, y, assets);
        this._sprite = assets.sprites.grassSprite.buildSprite();
    }
    
    update(timeStep, gameState) {
        // Do we do anything in update?
        // No, because blocks don't move.
    }
    
    draw(canvas, painter, camera) {
        // Implement this:
        let [cx, cy, cw, ch] = camera.transformBox([this.x, this.y, 1, 35/32]);
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    drawPreview(canvas, painter, box) {
        let [cx, cy, cw, ch] = box;
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
}

class PhysicsObject extends GameCollisionObject {
    constructor(x, y, assets) {
        super(x, y, assets);
        this._vx = 0;
        this._vy = 0;
        this._pvx = 0;
        this._pvy = 0;
        this._ax = 0;
        this._ay = 0.085 / 1000;
        this._airResistanceNormal = 0.05 / 1000;
        this._airResistance = 0.05 / 1000;
        this._terminalVelX = 10 / 1000;
        this._terminalVelY = Infinity;
        this._stopAccelX = 0.05 / 1000;
        this._slowOnNoInput = true;
    }
    
    update(timeStep, gameState) {
        if(this._slowOnNoInput && this._ax == 0) this._ax = -Math.min(this._stopAccelX, Math.abs(this._vx) / timeStep) * Math.sign(this._vx);
        if(this._ax != this._ax) this._ax = 0;
        this._vx += this._ax * timeStep;
        this._vx -= Math.sign(this._vx) * timeStep * this._airResistance * (this._vx) ** 2;
        this._vx = Math.sign(this._vx) * Math.min(Math.abs(this._vx), this._terminalVelX)
        
        this._vy += this._ay * timeStep;
        this._dragY = timeStep * this._vy;
        this._vy -= Math.sign(this._vy) * timeStep * this._airResistance * (this._vy) ** 2;
        this._vy = Math.sign(this._vy) * Math.min(Math.abs(this._vy), this._terminalVelY)

        this._pvx = this._vx;
        this._pvy = this._vy;

        this.x += this._vx * timeStep;
        this.y += this._vy * timeStep;
        this._airResistance = this._airResistanceNormal;        
    }
}

class Player extends PhysicsObject {
    constructor(x, y, assets) {
        super(x, y, assets);
        
        this._sprite = assets.sprites.playerSprite.buildSprite();
        this._sprite.setAnimation("stand");
        this._inset = [4 / 32, 4 / 32, 28 / 32, 24 / 32];
        this._priorUp = false;
        this._numJumps = Infinity;
        
        this._waitTime = 0;
        this._accept_inputs = true;
        
        this._hit_sound = assets.sounds.hit.buildSound();
        
        this._collisionSides = [
            {"top": true, "left": true, "right": true, "bottom": true},
            {"top": true, "left": true, "right": true}
        ];
        
        this._hp = 5;
        
        this._movable = true;
        this._in_water = false;
    }
    
    update(timeStep, gameState) {
        this._waitTime = Math.max(0, this._waitTime - timeStep);
        
        if(this._hp <= 0) {
            this._hp = 5;
            this._waitTime = 0;
            gameState.exitZone(gameState.zoneName);
        }
        
        let keys = {...gameState.keysPressed};
        
        let anim = "stand"
        
        this._ax = 0;
        
        if(gameState.mouse.pressed) {
            let [cx, cy, cw, ch] = gameState.cameras[0].getDisplayZone();
            let [x, y] = gameState.mouse.location;
            
            if((cx < x) && (x < (cx + cw * (1/3)))) {
                keys["ArrowLeft"] = true;
            }
            if(((cx + cw * (2/3)) < x) && (x < (cx + cw))) {
                keys["ArrowRight"] = true;
            }
            if((cy < y) && (y < (cy + ch * (1/3)))) {
                keys["ArrowUp"] = true;
            }
        }

        
        if(this._accept_inputs) {
            if("ArrowLeft" in keys) {
                this._ax -= 0.075 / 1000;
                anim = "run";
                this._sprite.setHorizontalFlip(true);
            }
            if("ArrowRight" in keys) {
                this._ax += 0.075 / 1000;
                anim = "run";
                this._sprite.setHorizontalFlip(false);
            }
            if(!this._priorUp && ("ArrowUp" in keys) && (this._numJumps > 0)) {
                this._vy = -22 / 1000;
                this._numJumps--;
                anim = "jump";
            }
            this._priorUp = "ArrowUp" in keys;

            if(this._sprite.getAnimation() != "jump") this._sprite.setAnimation(anim);
        
            if(this._in_water) this._sprite.setAnimation("water");
            this._in_water = false;
            this._waitTime = Math.max(0, this._waitTime - timeStep);
            
            super.update(timeStep, gameState);
        }
        
        let [__x, __y, w, h] = gameState.getLevelBounds();
        if((this.y + this._inset[3]) >= h) gameState.exitZone(gameState.zoneName);
        
        this._sprite.update(timeStep);
    }
    
    draw(canvas, painter, camera) {
        // Implement this:
        let [xi, yi, wi, hi] = this._inset;
        let [inx, iny] = [
            this.x - xi, 
            this.y - yi
        ];
        let [cx, cy, cw, ch] = camera.transformBox([inx, iny, 42 / 32, 1]);
        
        if((Math.floor(this._waitTime / 50) % 2) == 0) this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    drawPreview(canvas, painter, box) {
        let [cx, cy, cw, ch] = box;        
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    handleCollision(obj, side) {
        if(obj instanceof Water || obj instanceof WaterTop) {
            this._in_water = true;
            return;
        }
        
        if(side == "inside") return;
        if(side == "bottom") {
            this._numJumps = 2;
            if(this._sprite.getAnimation() == "jump") this._sprite.setAnimation("stand");
            if(obj instanceof Enemy) {
                this._hit_sound.play();
                this._vy = -this._vy;
            }
            else this._vy = 0;
        }
        else if(obj instanceof Enemy && this._waitTime <= 0) {
            this._hit_sound.play();
            this._hp -= 2;
            this._waitTime = 1000;
        }
        
        if(side == "left" || side == "right") {
            if(!(obj instanceof Ball)) {
                this._vx = 0;
            }
            else this._hit_sound.play();
        }
    }
    
    getHitBoxes() {
        let [xi, yi, wi, hi] = this._inset;
        let box2 = (this._sprite.isHorizontallyFlipped())? [this.x, this.y, 8 / 32, 9 / 32]: [this.x + wi - 8 / 32, this.y, 8 / 32, 9 / 32];
        
        return [
            [this.x, this.y + 9 / 32, wi, hi - 9 / 32],
            box2
        ];
    }
}


class Enemy extends PhysicsObject {
    constructor(x, y, assets) {
        super(x, y, assets);
        this.__ss = assets.sprites;
        this._sprite = assets.sprites.enemySprite.buildSprite();
        this._sprite.setAnimation("stand");
        
        this._inset = [10 / 32, 0 / 32, 73 / 32, 16 / 32];
        this._blocksBelow = [false, false];
        
        this._hp = 5;
        this._terminalVelX = 5 / 1000;
        
        this._movable = true;
        this._gState = null;
    }
    
    update(timeStep, gameState) {
        if(this._hp <= 0) return true;
        
        let minPX = null;
        let minDist = Infinity;
        
        for(let player of gameState.getPlayers()) {
            let [px, py] = player.getLocation();
            let dist = Math.sqrt((px - this.x) * (px - this.x) + (py - this.y) * (py - this.y));
            if(dist < minDist) {
                minPX = px;
                minDist = dist;
            }
        }
        
        this._ax = (minPX != null && minDist < 9)? 0.03 / 1000 * Math.sign(minPX - this.x): 0;
        
        if(this._ax != 0) {
            this._sprite.setHorizontalFlip(this._ax > 0);
            this._sprite.setAnimation("run");
        }
        else this._sprite.setAnimation("stand");
        
        this.updateBlockInfo(timeStep, gameState);
        if(!this._blocksBelow[(this._ax < 0)? 0: 1]) {
            this._ax *= -1;
            this._ax = Math.sign(this._ax) * Math.min(Math.abs(this._ax), Math.abs(this._vx / timeStep));
            if(this._ax != this._ax) this._ax = 0;
        }
        
        super.update(timeStep, gameState)
        
        this._sprite.update(timeStep);
    }
    
    updateBlockInfo(timeStep, gameState) {
        this._blocksBelow[0] = gameState.getBlocksAround(this.x, this.y + this._inset[3] / 2)[1][2] != null;
        this._blocksBelow[1] = gameState.getBlocksAround(this.x + this._inset[2], this.y + this._inset[3] / 2)[1][2] != null;
    }
    
    draw(canvas, painter, camera) {
        // Implement this:
        let [xi, yi, wi, hi] = this._inset;
        let [inx, iny] = [
            this.x - xi, 
            this.y - yi
        ];
        let [cx, cy, cw, ch] = camera.transformBox([inx, iny, 96 / 32, 24 / 32]);
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    handleCollision(obj, side) {
        if(obj instanceof Water || obj instanceof WaterTop) return;
        if(side == "bottom") this._vy = 0;
        
        if((obj instanceof Player) && side == "top") {
            this._hp = 0;
        }
        else if((obj instanceof Player || obj instanceof Enemy) && side != "bottom") {
            let d = (side == "left")? 1: -1;
            this._vx += d * 0.01; 
        }
    }
    
    drawPreview(canvas, painter, box) {
        let [cx, cy, cw, ch] = box;        
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    getHitBoxes() {
        let [xi, yi, wi, hi] = this._inset;
        return [[this.x, this.y, wi, hi]];
    }
}

class Ball extends PhysicsObject {
    constructor(x, y, assets) {
        super(x, y, assets);
        this._sprite = assets.sprites.beachBallSprite.buildSprite();
        this._sprite.setAnimation("still");
        
        this._vx = 0;
        this._vy = 0;
        this._ay = 0.04 / 1000;
        this._ax = 0;
        this._slowOnNoInput = false;
        this._stopAccelX = 0.1 / 1000;
        
        this._inset = [10 / 32, 0 / 32, 73 / 32, 16 / 32];
        this._blocksBelow = [false, false];
        
        this._airResistanceNormal = 0.3;
        
        this._movable = true;
    }
    
    update(timeStep, gameState) {
        this._ax = 0;
        super.update(timeStep, gameState)
        
        if(Math.abs(this._vx) > 0.0001) this._sprite.setAnimation("spin");
        else this._sprite.setAnimation("still");
        this._sprite.setHorizontalFlip(this._vx < 0);
        this._sprite.update(timeStep);
        
        this._slowOnNoInput = false;
    }
    
    draw(canvas, painter, camera) {
        let [cx, cy, cw, ch] = camera.transformBox(this.getBoundingBox());
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    drawPreview(canvas, painter, box) {
        let [cx, cy, cw, ch] = box;        
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    handleCollision(obj, side) {
        if(obj instanceof Water || obj instanceof WaterTop) return;
        if(side == "bottom" || side == "inside") this._slowOnNoInput = true;
        if(side == "inside") return;
        
        if(side == "top" || side == "bottom") {
            if(obj instanceof Ball) {
                this._vy = ((side == "top")? 1: -1) * Math.abs(obj._vy) * 0.8;
            }
            else {
                this._vy = ((side == "top")? 1: -1) * Math.abs(this._vy) + (obj._vy ?? 0) * 0.8;
            }
        }
        else {
            let vx = this._vx;
            
            if(obj instanceof Ball) {
                this._vx = ((side == "left")? 1: -1) * Math.abs(obj._vx);
                this._vy -= 0.01;
            }
            else {
                let c = (obj instanceof PhysicsObject)? 1: 0.2;
                this._vx = (((side == "left")? 1: -1) * Math.abs(this._vx + 0.01) + (obj._vx ?? 0)) * c;
                this._vy -= 0.01;
            }
        }
    }
}

class WaterTop extends GameCollisionObject {
    constructor(x, y, assets) {
        super(x, y, assets);
        this._sprite = assets.sprites.water.buildSprite();
        this._sprite.setAnimation("top");
        this._weight = 0.25 / 1000;
        this._timeStep = 0;
    }
    
    update(timeStep, gameState) {
        this._sprite.update(timeStep);
        this._timeStep = timeStep;
    }
    
    draw(canvas, painter, camera) {
        let [cx, cy, cw, ch] = camera.transformBox([this.x, this.y, 1, 1]);
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    drawPreview(canvas, painter, box) {
        let [cx, cy, cw, ch] = box;        
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    handleCollision(obj, side) {
        if(obj instanceof PhysicsObject) {
            obj._airResistance = 0.75;
            if(obj instanceof Player) obj._numJumps = 2;
        }
        // Compute the boyant force... and add it onto the objects velocity...
        let [wx, wy, ww, wh] = this.getBoundingBox();
        let [ox, oy, ow, oh] = obj.getBoundingBox();

        let yIn = Math.min(Math.abs((wy + wh) - oy), Math.abs((oy + oh) - wy));
        let xIn = Math.min(Math.abs((wx + ww) - ox), Math.abs((ox + ow) - wx))
        obj._vy -= ((xIn * yIn) / (ww * wh)) * this._weight * this._timeStep;
    }
    
    isSolid() {
        return false;
    }
    
    getHitBoxes() {
        return [[this.x, this.y + 0.25, 1, 0.75]];
    }
    
    getZOrder() {
        return 1;
    }
}

class Water extends GameCollisionObject {
    constructor(x, y, assets) {
        super(x, y, assets);
        this._sprite = assets.sprites.water.buildSprite();
        this._sprite.setAnimation("below");
        this._weight = 0.25 / 1000;
        this._timeStep = 0
    }
    
    update(timeStep, gameState) {
        this._sprite.update(timeStep);
        this._timeStep = timeStep;
    }
    
    draw(canvas, painter, camera) {
        let [cx, cy, cw, ch] = camera.transformBox(this.getBoundingBox());
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    drawPreview(canvas, painter, box) {
        let [cx, cy, cw, ch] = box;        
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    handleCollision(obj, side) {
        if(obj instanceof PhysicsObject) {
            obj._airResistance = 0.75;
            if(obj instanceof Player) obj._numJumps = 2;
        }
        // Compute the boyant force... and add it onto the objects velocity...
        let [wx, wy, ww, wh] = this.getBoundingBox();
        let [ox, oy, ow, oh] = obj.getBoundingBox();
        
        let yIn = Math.min(Math.abs((wy + wh) - oy), Math.abs((oy + oh) - wy));
        let xIn = Math.min(Math.abs((wx + ww) - ox), Math.abs((ox + ow) - wx))
        obj._vy -= ((xIn * yIn) / (ww * wh)) * this._weight * this._timeStep;
    }
    
    isSolid() {
        return false;
    }
    
    getZOrder() {
        return 1;
    }
}

class EndGame extends GameCollisionObject {
    constructor(x, y, assets) {
        super(x, y, assets);
        this._hidden = !assets.flags.isLevelEditor;
        this._endGame = false;
    }
    
    update(timeStep, gameState) {
        if(this._endGame) gameState.playGameEnding = true;
    }
    
    draw(canvas, painter, camera) {
        if(this._hidden) return;
        let [cx, cy, cw, ch] = camera.transformBox(this.getBoundingBox());
        painter.fillStyle = "red";
        painter.fillRect(cx, cy, cw, ch / 4);
        painter.fillRect(cx, cy + ch / 3, cw, ch / 4);
        painter.fillRect(cx, cy + 3 * ch / 4, cw, ch / 4);
        painter.fillRect(cx, cy, cw / 4, ch);
    }
    
    drawPreview(canvas, painter, box) {
        let [cx, cy, cw, ch] = box;
        painter.fillStyle = "red";
        painter.fillRect(cx, cy, cw, ch / 4);
        painter.fillRect(cx, cy + ch / 3, cw, ch / 4);
        painter.fillRect(cx, cy + 3 * ch / 4, cw, ch / 4);
        painter.fillRect(cx, cy, cw / 4, ch);
    }
    
    handleCollision(obj, side) {
        if(obj instanceof Player) {
            obj._accept_inputs = false;
            this._endGame = true;
            obj._sprite.setAnimation("fly");
        }
    }
    
    isSolid() {
        return false;
    }
}

const END_GAME_LENGTH = 8 * 1000;
const EXIT_SPEED = [8 / 1000, -0.5 / 1000];
const FADEOUT = 4 * 1000;
const FINAL_TRACK_BOX = [1.2, 0.25, 0.0001, 0.0001];

const INTRO_LENGTH = 4 * 1000;
const FADEIN = 3 * 1000;
const INTRO_SPEED = [0, 10 / 1000];

const SOUND_GAP = 5 * 1000;
const RANDOM_SOUND_CHANCE = 10;

$(document).ready(function() {
    $("#play-game-button").on("click", function() {
        let gameInfo = {
            objects: {
                blocks: [GameBlock, GameBlock2, Tree, Grass, LogBlock, WaterTop, Water, EndGame],
                entities: [Enemy, Ball],
                players: [Player]
            },
            assets: {
                sprites: {
                    playerSprite: {
                        image: "images/seagull2.png",
                        width: 42,
                        animations: {
                            "stand": {
                                "frames": [0],
                            },
                            "run": {
                                "frames": range(21),
                                "speed": 10
                            },
                            "water": {
                                "frames": [21]
                            },
                            "jump": {
                                "frames": [0, 4, 5],
                                "speed": 150,
                                "cycles": 1
                            },
                            "fly": {
                                "frames": [22, 23, 24, 25, 25, 24, 23, 22],
                                "speed": 80
                            }
                        }
                    },
                    enemySprite: {
                        image: "images/croc.png",
                        width: 96,
                        animations: {
                            "stand": {
                                "frames": [4, 5],
                                "speed": 500
                            },
                            "run": {
                                "frames": [0, 1, 2, 3],
                                "speed": 100
                            }
                        }
                    },
                    sandSprite: {
                        image: "images/sand.png",
                        animations: {
                            "top": {
                                "frames": [0]
                            },
                            "middle": {
                                "frames": [1]
                            }
                        }
                    },
                    backgroundSprite: {
                        image: "images/background2.png",
                        width: 250
                    },
                    treeSprite: {
                        image: "images/tree.png",
                        width: 60
                    },
                    grassSprite: {
                        image: "images/grass.png",
                        width: 20
                    },
                    logSprite: {
                        image: "images/log.png"
                    },
                    beachBallSprite: {
                        image: "images/beachball.png",
                        animations: {
                            "still": {
                                "frames": [0]
                            },
                            "spin": {
                                "speed": 100
                            }
                        }
                    },
                    water: {
                        image: "images/water.png",
                        animations: {
                            "below": {
                                "frames": [0],
                                "speed": 50
                            },
                            "top": {
                                "frames": range(1, 17),
                                "speed": 50
                            }
                        }
                    }
                },
                sounds: {
                    "wave0": {
                        "source": "sounds/wave1.wav",
                        "volume": 0.5
                    },
                    "wave1": {
                        "source": "sounds/wave2.wav",
                        "volume": 0.5
                    },
                    "wave2": {
                        "source": "sounds/wave3.wav",
                        "volume": 0.5
                    },
                    "noise": {
                        "source": "sounds/noise.wav",
                        "background": true
                    },
                    "hit": {
                        "source": "sounds/hit.wav"
                    }
                }
            },
            zones: {
                test: {
                    zoneData: "testdata/test_level.json",
                    preDraw: function(canvas, painter, gameState) {
                        if(gameState.background == null) gameState.background = gameState.assets.sprites.backgroundSprite.buildSprite();        

                        let bk = gameState.background;
                        let bgRatio = (bk.width / bk.height);
                        let cRatio = (canvas.width / canvas.height);

                        let {width, height} = canvas;

                        width = (bgRatio < cRatio)? width: height * bgRatio;
                        height = (bgRatio < cRatio)? width / bgRatio: height;
                        let centerX = canvas.width / 2;
                        let centerY = canvas.height / 2;

                        gameState.background.draw(painter, centerX - width / 2, centerY - height / 2, width, height);
                    },
                    postDraw: function(canvas, painter, gameState) {
                        if(gameState._endGameCounter != null && gameState._endGameCounter < FADEOUT) {
                            let alpha = Math.max(0, Math.min(1, (FADEOUT - gameState._endGameCounter) / FADEOUT));
                            painter.fillStyle = "rgba(255, 255, 255, " + alpha + ")";
                            painter.fillRect(0, 0, canvas.width, canvas.height);
                        }
                        if(gameState._beginGameCounter != null) {
                            let alpha = Math.max(0, Math.min(1, gameState._beginGameCounter / FADEIN));
                            painter.fillStyle = "rgba(255, 255, 255, " + alpha + ")";
                            painter.fillRect(0, 0, canvas.width, canvas.height);
                        }
                    },
                    preUpdate: function(timeStep, gameState) {
                        if(gameState._beginGameCounter === undefined) {
                            gameState.__players[0]._accept_inputs = false;
                            gameState._beginGameCounter = INTRO_LENGTH;
                        }
                        if(gameState._beginGameCounter != null && gameState._beginGameCounter > 0) {
                            gameState.__players[0].x += INTRO_SPEED[0] * timeStep;
                            gameState.__players[0].y += INTRO_SPEED[1] * timeStep;
                            gameState._beginGameCounter -= timeStep;
                            
                            if(gameState._beginGameCounter <= 0) {
                                gameState.__players[0]._accept_inputs = true;
                                gameState._beginGameCounter = null;
                            }
                        }
                        
                        if(gameState.soundCounter > 0) {
                            gameState.soundCounter -= timeStep;
                        }
                        else {
                            if(gameState.waves == null) {
                                gameState.assets.sounds.noise.buildSound().play();
                                gameState.waves = [];
                                for(let name in gameState.assets.sounds) {
                                    if(name.startsWith("wave")) {
                                        gameState.waves.push(gameState.assets.sounds[name].buildSound());
                                    }
                                }
                            }
                            
                            if(Math.floor(Math.random() * RANDOM_SOUND_CHANCE) == 0) {
                                let sound = gameState.waves[Math.floor(Math.random() * gameState.waves.length)];
                                sound.play();
                                gameState.soundCounter = SOUND_GAP;
                            }
                        }
                        
                        if(gameState.playGameEnding && (gameState._endGameCounter == null)) {
                            gameState._endGameCounter = END_GAME_LENGTH; // Time of game ending in millis...
                            gameState.origTrackBox = [...gameState.cameras[0].getTrackBox()];
                        }
                        
                        if(gameState._endGameCounter != null) {
                            gameState.__players[0].x += EXIT_SPEED[0] * timeStep;
                            gameState.__players[0].y += EXIT_SPEED[1] * timeStep;
                            gameState._endGameCounter -= timeStep;
                            
                            let interpol = Math.max(0, Math.min(1, (END_GAME_LENGTH - gameState._endGameCounter) / END_GAME_LENGTH));
                            let midBox = [0, 0, 0, 0];
                            
                            for(let i = 0; i < midBox.length; i++) {
                                midBox[i] = FINAL_TRACK_BOX[i] * interpol + gameState.origTrackBox[i] * (1 - interpol);
                            }
                            gameState.cameras[0].setTrackBox(midBox);
                            
                            if(gameState._endGameCounter < 0) gameState.exitZone();
                        }
                    }
                },
            }
        };
        
        element.makeGame(gameInfo, "test");
    });
});
