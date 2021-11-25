class GameBlock extends GameCollisionObject {
    constructor(x, y, blockSize, sprites) {
        super(x, y, blockSize, sprites);
        this._sprite = sprites.sandSprite.buildSprite();
        this._sprite.setAnimation("middle");
    }
    
    update(timeStep, gameState) {
        // Do we do anything in update?
        // No, because blocks don't move.
    }
    
    draw(canvas, painter, camera) {
        // Implement this:
        let [cx, cy, cw, ch] = camera.transformBox([this.x * this._blockSize , this.y * this._blockSize, this._blockSize, this._blockSize]);
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    drawPreview(canvas, painter, box) {
        let [cx, cy, cw, ch] = box;
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
}

class GameBlock2 extends GameCollisionObject {
    constructor(x, y, blockSize, sprites) {
        super(x, y, blockSize, sprites);
        this._sprite = sprites.sandSprite.buildSprite();
        this._sprite.setAnimation("top");
    }
    
    update(timeStep, gameState) {
        // Do we do anything in update?
        // No, because blocks don't move.
    }
    
    draw(canvas, painter, camera) {
        // Implement this:
        let [cx, cy, cw, ch] = camera.transformBox([this.x * this._blockSize, this.y * this._blockSize - 3, this._blockSize, this._blockSize + 3]);
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    drawPreview(canvas, painter, box) {
        let [cx, cy, cw, ch] = box;
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
}

class Tree extends GameObject {
    constructor(x, y, blockSize, sprites) {
        super(x, y, blockSize, sprites);
        this._sprite = sprites.treeSprite.buildSprite();
        this._numBlocks = 4;
        this._digIn = 4 / 32;
    }
    
    draw(canvas, painter, camera) {
        // Implement this:
        let bS = this._blockSize;
        let scale = bS * this._numBlocks;
        let [cx, cy, cw, ch] = camera.transformBox([
            this.x * bS, this.y * bS, scale * (this._sprite.width / this._sprite.height), scale + this._digIn * bS
        ]);
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    drawPreview(canvas, painter, box) {
        let [cx, cy, cw, ch] = box;
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
}

class Grass extends GameObject {
    constructor(x, y, blockSize, sprites) {
        super(x, y, blockSize, sprites);
        this._sprite = sprites.grassSprite.buildSprite();
    }
    
    update(timeStep, gameState) {
        // Do we do anything in update?
        // No, because blocks don't move.
    }
    
    draw(canvas, painter, camera) {
        // Implement this:
        let [cx, cy, cw, ch] = camera.transformBox([this.x * this._blockSize , this.y * this._blockSize, this._blockSize, this._blockSize + 3]);
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    drawPreview(canvas, painter, box) {
        let [cx, cy, cw, ch] = box;
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
}

class Player extends GameCollisionObject {
    constructor(x, y, blockSize, sprites) {
        super(x, y, blockSize, sprites);
        this._sprite = sprites.playerSprite.buildSprite();
        this._sprite.setAnimation("stand");
        this._inset = [4 / 32, 4 / 32, 28 / 32, 24 / 32];
        this._vx = 0;
        this._vy = 0;
        this._pvx = 0;
        this._pvy = 0;
        this._ax = 0;
        this._ay = 0.09 / 1000;
        this._priorUp = false;
        this._numJumps = Infinity;
        this._fric_facx = 0.96;
        this._fric_facy = 0.9999;
        this._waitTime = 0;
        
        this._hp = 5;
        
        this._movable = true;
    }
    
    update(timeStep, gameState) {
        this._waitTime = Math.max(0, this._waitTime - timeStep);
        
        if(this._hp <= 0) {
            this._hp = 5;
            this._waitTime = 0;
            return true;
        }
        
        let keys = gameState.keysPressed;
        
        let anim = "stand"
        
        this._ax = 0;
        if("ArrowLeft" in keys) {
            this._ax -= 0.05 / 1000;
            anim = "run";
            this._sprite.setHorizontalFlip(true);
        }
        if("ArrowRight" in keys) {
            this._ax += 0.05 / 1000;
            anim = "run";
            this._sprite.setHorizontalFlip(false);
        }
        if(!this._priorUp && ("ArrowUp" in keys) && (this._numJumps > 0)) {
            this._vy = -20 / 1000;
            this._numJumps--;
            anim = "jump";
        }
        this._priorUp = "ArrowUp" in keys;
        
        if(this._sprite.getAnimation() != "jump") this._sprite.setAnimation(anim);
                
        this._vx += this._ax * timeStep;
        this._vx *= this._fric_facx;
        this._vy += this._ay * timeStep;
        this._vy *= this._fric_facy;
        
        this._pvx = this._vx;
        this._pvy = this._vy;
        
        this.x += this._vx * timeStep;
        this.y += this._vy * timeStep;
        
        if((this.y + this._inset[3]) >= (gameState.level.numChunks[1] * gameState.level.chunkSize)) return true;
        
        this._sprite.update(timeStep);
    }
    
    draw(canvas, painter, camera) {
        // Implement this:
        let [xi, yi, wi, hi] = this._inset;
        let [inx, iny] = [
            (this.x * this._blockSize) - (xi * this._blockSize), 
            (this.y * this._blockSize) - (yi * this._blockSize)
        ];
        let [cx, cy, cw, ch] = camera.transformBox([inx, iny, 42, 32]);
        
        if((Math.floor(this._waitTime / 50) % 2) == 0) this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    drawPreview(canvas, painter, box) {
        let [cx, cy, cw, ch] = box;        
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    handleCollisions(obj, side) {
        if(side == "bottom") {
            this._numJumps = 2;
            if(this._sprite.getAnimation() == "jump") this._sprite.setAnimation("stand");
            if(obj instanceof Enemy) this._vy = -this._pvy;
        }
        else if(obj instanceof Enemy && this._waitTime <= 0) {
            this._hp -= 2;
            this._waitTime = 1000;
        }
    }
    
    getHitBox() {
        let [xi, yi, wi, hi] = this._inset;
        return [this.x, this.y, wi, hi];
    }
}


class Enemy extends GameCollisionObject {
    constructor(x, y, blockSize, sprites) {
        super(x, y, blockSize, sprites);
        this.__ss = sprites;
        this._sprite = sprites.enemySprite.buildSprite();
        this._sprite.setAnimation("stand");
        this._vx = 0;
        this._vy = 0;
        this._ax = 0;
        this._ay = 0.09 / 1000;
        this._fric_fac = 0.95;
        this._inset = [10 / 32, 0 / 32, 73 / 32, 16 / 32];
        this._blocksBelow = [false, false];
        
        this._hp = 5;
        
        this._movable = true;
        this._gState = null;
    }
    
    update(timeStep, gameState) {
        if(this._hp <= 0) return true;
        
        let [px, py] = gameState.getPlayer().getLocation();
        
        let dist = Math.sqrt((px - this.x) * (px - this.x) + (py - this.y) * (py - this.y));
        
        this._ax = (dist < 6)? 0.03 / 1000 * Math.sign(px - this.x): 0;
        
        if(this._ax != 0) {
            this._sprite.setHorizontalFlip(this._ax > 0);
            this._sprite.setAnimation("run");
        }
        else this._sprite.setAnimation("stand");
        
        this.updateBlockInfo(timeStep, gameState);
        if(!this._blocksBelow[(this._ax < 0)? 0: 1]) this._ax *= -1;
        
        this._vx += this._ax * timeStep;
        this._vx *= this._fric_fac;
                
        this._vy += this._ay * timeStep;
        this._vy *= this._fric_fac;
        
        this.x += this._vx * timeStep;
        this.y += this._vy * timeStep;
        
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
            (this.x * this._blockSize) - (xi * this._blockSize), 
            (this.y * this._blockSize) - (yi * this._blockSize)
        ];
        let [cx, cy, cw, ch] = camera.transformBox([inx, iny, 96, 24]);
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    handleCollisions(obj, side) {
        if(obj instanceof Player && side == "top") {
            this._hp = 0;
        }
        else if(obj instanceof Player && side != "bottom") {
            let d = (side == "left")? 1: -1;
            this._vx += d * 0.01; 
        }
    }
    
    drawPreview(canvas, painter, box) {
        let [cx, cy, cw, ch] = box;        
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    getHitBox() {
        let [xi, yi, wi, hi] = this._inset;
        return [this.x, this.y, wi, hi];
    }
}

function draw(canvas, painter, gameState) {
    // Clear the canvas...
    painter.fillStyle = "white"
    painter.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw our single block...
    gameState.block.draw(gameState.canvas, gameState.painter, gameState.camera);
}

// This function will get called over and over...
function gameLoop(timeStep, gameState) {
    update(timeStep, gameState);
    draw(gameState.canvas, gameState.painter, gameState);
}

$(document).ready(function() {
    let gameState = {
        "cameraMoveSpeed": 20
    }

    let levelData = {
        sprites: {
            playerSprite: {
                image: "images/seagull2.png",
                width: 42,
                animations: {
                    "stand": {
                        "frames": [0],
                    },
                    "run": {
                        "speed": 10
                    },
                    "jump": {
                        "frames": [0, 4, 5],
                        "speed": 150,
                        "cycles": 1
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
            }
        }
    };

    let callbacks = {
        "preDraw": function(canvas, painter, gameState) {
            if(gameState.background == null) gameState.background = gameState.sprites.backgroundSprite.buildSprite();        
            
            let bk = gameState.background;
            let bgRatio = (bk.width / bk.height);
            let cRatio = (canvas.width / canvas.height);
            
            let {width, height} = canvas;
            
            width = (bgRatio < cRatio)? width: height * bgRatio;
            height = (bgRatio < cRatio)? width / bgRatio: height;
            let centerX = canvas.width / 2;
            let centerY = canvas.height / 2;
            
            gameState.background.draw(painter, centerX - width / 2, centerY - height / 2, width, height);
        }
    };
    
    $("#play-game-button").on("click", function() {
        element.makeGame("testdata/test_level.json", [GameBlock, GameBlock2, Tree, Grass], [Enemy], levelData, Player, callbacks=callbacks);
    });
});
