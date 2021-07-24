/*
 * PLAYER TEAM CODE.
 */
class Player extends GameCollisionObject {
    constructor(x, y, blockSize, sprites) {
        super(x, y, blockSize, sprites);
        
        this._inset = [11/32, 7/32, 1, 1];
        this._spriteSize = [12/32, 23/32];
        this._movable = true;
        this._vx = 0;
        this._vx2 = 0;
        this._vel = 7/1000;
    
        this._vy = 0;
        this._vy2 = 0;
        this._ay = 0.1/1000;
        this._boost = 22/1000;
        this._wasUp = false;
        this._numLeft = 0;
        this._sprite = sprites.player.buildSprite();
        
        this._initHP = 20;
        this._hp = this._initHP;
        this._startInvTime = 2000;
        this._invulnTime = 0;
        this._flashRate = 100;
        this._minFall = 40/1000;
        this._mult = 50;
        
        this._dTime = 1000;
        this._dead = this._dTime;
        this._hasDied = false;
        
        this._damage = 5;
    }
    
    update(timeStep, gameState) {
        // Update code here. Returning true resets the entire level.
        // NOTE: not for this lesson :) 
        this._invulnTime = Math.max(this._invulnTime - timeStep, 0);
        
        let v = this._vx2;
        if('ArrowUp' in gameState.keysPressed && !this._wasUp && this._numLeft > 0){
            this._vy -= this._boost;
            this._numLeft--;
        }
        
        if('ArrowLeft' in gameState.keysPressed){
            v -= this._vel;
        }
        
        if ('ArrowRight'  in gameState.keysPressed){
            v += this._vel;
        }
        
        if(this._hasDied) {
            this._dead -= timeStep;
            this._sprite.setAnimation("die");
        }
        else if(this._numLeft >= 2 && v != 0) {
            this._sprite.setAnimation("run");
        }
        else {
            this._sprite.setAnimation("stand");
        }
        
        this._sprite.update(timeStep);
        
        this.x = v * timeStep + this.x;
        this._vx2 = 0;
        
        this._vy = this._ay * timeStep + this._vy;
        this._vy2 = this._vy;
        this.y = this._vy * timeStep + this.y
        this._wasUp = "ArrowUp" in gameState.keysPressed;
        
        if((this._hp <= 0) 
           || (this.y + this._spriteSize[1] >= (gameState.level.numChunks[1] * gameState.level.chunkSize))) {
            this._hasDied = true;
            this._collisionSides = {};
            this._hp = this._initHP;
            this._vy -= this._boost;
        }
        
        if(this._dead <= 0) {
            this._collisionSides = {"top": true, "bottom": true, "left": true, "right": true};
            this._dead = this._dTime;
            this._hasDied = false;
            return true;
        }
    }
    
    draw(canvas, painter, camera) {
        // Draw code here...
        let [xi, yi, wi, hi] = this._inset;
        let [inx, iny] = [
            (this.x * this._blockSize) - (xi * this._blockSize), 
            (this.y * this._blockSize) - (yi * this._blockSize)
        ];
        let [cx, cy, cw, ch] = camera.transformBox([inx, iny, wi * this._blockSize, hi * this._blockSize]);
        
        if(Math.floor(this._invulnTime / this._flashRate) % 2 == 0) {
            this._sprite.draw(painter, cx, cy, cw, ch);

            painter.fillStyle = "black";
            painter.font = "italic small-caps 30px fantasy";
            painter.fillText("Hp: " + this._hp, 0, 30);
        }
    }
    
    drawPreview(canvas, painter, box) {
        // Draw preview code here...
        let [cx, cy, cw, ch] = box;
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    handleCollisions(obj, side) {
        if(side == "bottom") {
            if(this._vy2 >= this._minFall && this._invulnTime <= 0) {
                this._hp -= Math.floor(this._vy2 * this._mult);
                this._invulnTime = this._startInvTime;
            }
            this._numLeft = 2;
        }
        else if(obj instanceof Entity && this._invulnTime <= 0) {
            this._hp -= obj._damage;
            this._invulnTime = this._startInvTime;
        }
    }
    
    getHitBox() {
        let [sw, sh] = this._spriteSize;
        return [this.x, this.y, sw, sh];
    }
}


/*
 * ENEMY TEAM CODE.
 */
class Entity extends GameCollisionObject {
    constructor(x, y, blockSize, sprites) {
        super(x, y, blockSize, sprites);
        // More initialization here...
        // NOTE: not for this lesson :) 
        this._inset = [18/64, 14/64, 1, 1];
        this._spriteSize = [26/64, 34/64];
        this._vel = 0.2/1000;
        this._movable = true;
        this._vx = 0;
        this._vy = 0;
        this._ay = 0.1 / 1000
        this._dist = 5;
        this._damage = 5;
        //this._collisionSides = {"top": true, "bottom": true};
        
        this._knockBack = 100/1000;
        this._hp = 5;
        
        this._sprite = sprites.imposter.buildSprite();
    }
    
    update(timeStep, gameState) {
        // Update code here. Returning true destroys the enemy.
        // NOTE: not for this lesson :) 
        let player = gameState.getPlayer();
        let [x, y, w, h] = player.getHitBox();
        let [cx, cy] = [x + w / 2, y + h / 2];
        
        let [ex, ey, ew, eh] = this.getHitBox();
        let [ecx, ecy] = [ex + ew / 2, ey + eh / 2]
        
        let dist = Math.sqrt((ecx - cx) ** 2 + (ecy - cy) ** 2);
        
        if(dist < this._dist) {
            this._vx = this._vel * Math.sign(cx - ecx) * timeStep;
        } else {
            this._vx = 0;
        }
        
        if(this._vx == 0) {
            this._sprite.setAnimation("stand");
        }
        else {
            this._sprite.setAnimation("run");
        }
        
        this._sprite.update(timeStep);
        
        this.x = this._vx * timeStep + this.x;
        this._vy = this._ay * timeStep + this._vy;
        this.y = this._vy * timeStep + this.y;
        
        if(this._hp <= 0 
           || (this.y + this._spriteSize[1] >= (gameState.level.numChunks[1] * gameState.level.chunkSize))) {
            return true;
        }
    }
    
    draw(canvas, painter, camera) {
        // Draw code here...
        let [xi, yi, wi, hi] = this._inset;
        let [inx, iny] = [
            (this.x * this._blockSize) - (xi * this._blockSize), 
            (this.y * this._blockSize) - (yi * this._blockSize)
        ];
        let [cx, cy, cw, ch] = camera.transformBox([inx, iny, wi * this._blockSize, hi * this._blockSize]);
        
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    drawPreview(canvas, painter, box) {
        // Draw preview code here...
        let [cx, cy, cw, ch] = box;
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    handleCollisions(obj, side) {
        if((obj instanceof Player) && (side == "top")) {
            this._hp -= obj._damage;
        }
    }
       
    getHitBox() {
        let [sw, sh] = this._spriteSize;
        return [this.x, this.y, sw, sh]
    }
}


/*
 * BLOCK TEAM CODE.
 */
class Block extends GameCollisionObject {
    constructor(x, y, blockSize, sprites) {
        super(x, y, blockSize, sprites);
        // More initialization here...
        // NOTE: not for this lesson :) 
        this._sprite = sprites.blocks.buildSprite();
        this._sprite.setAnimation("block");
    }
    
    update(timeStep, gameState) {
        // Update code here. Returning true destroys the block.
        // NOTE: not for this lesson :) 
        this._sprite.update(timeStep);
    }
    
    draw(canvas, painter, camera) {
        // Draw code here...
        let [cx, cy, cw, ch] = camera.transformBox([this.x * this._blockSize , this.y * this._blockSize, this._blockSize, this._blockSize]);
                
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    drawPreview(canvas, painter, box) {
        // Draw preview code here...
        let [cx, cy, cw, ch] = box;
        
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
}

class Block2 extends GameCollisionObject {
    constructor(x, y, blockSize, sprites) {
        super(x, y, blockSize, sprites);
        // More initialization here...
        // NOTE: not for this lesson :) 
        this._sprite = sprites.blocks.buildSprite();
        this._sprite.setAnimation("block2");
    }
    
    update(timeStep, gameState) {
        // Update code here. Returning true destroys the block.
        // NOTE: not for this lesson :) 
        this._sprite.update(timeStep);
    }
    
    draw(canvas, painter, camera) {
        // Draw code here...
        let [cx, cy, cw, ch] = camera.transformBox([this.x * this._blockSize , this.y * this._blockSize, this._blockSize, this._blockSize]);
                
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    drawPreview(canvas, painter, box) {
        // Draw preview code here...
        let [cx, cy, cw, ch] = box;
        
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
}

class Block3 extends GameCollisionObject {
    constructor(x, y, blockSize, sprites) {
        super(x, y, blockSize, sprites);
        // More initialization here...
        // NOTE: not for this lesson :) 
        this._sprite = sprites.blocks.buildSprite();
        this._sprite.setAnimation("block3");
    }
    
    update(timeStep, gameState) {
        // Update code here. Returning true destroys the block.
        // NOTE: not for this lesson :) 
        this._sprite.update(timeStep);
    }
    
    draw(canvas, painter, camera) {
        // Draw code here...
        let [cx, cy, cw, ch] = camera.transformBox([this.x * this._blockSize , this.y * this._blockSize, this._blockSize, this._blockSize]);
                
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    drawPreview(canvas, painter, box) {
        // Draw preview code here...
        let [cx, cy, cw, ch] = box;
        
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
}

class Block4 extends GameCollisionObject {
    constructor(x, y, blockSize, sprites) {
        super(x, y, blockSize, sprites);
        // More initialization here...
        // NOTE: not for this lesson :) 
        this._sprite = sprites.blocks.buildSprite();
        this._sprite.setAnimation("block4");
    }
    
    update(timeStep, gameState) {
        // Update code here. Returning true destroys the block.
        // NOTE: not for this lesson :) 
        this._sprite.update(timeStep);
    }
    
    draw(canvas, painter, camera) {
        // Draw code here...
        let [cx, cy, cw, ch] = camera.transformBox([this.x * this._blockSize , this.y * this._blockSize, this._blockSize, this._blockSize]);
                
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    drawPreview(canvas, painter, box) {
        // Draw preview code here...
        let [cx, cy, cw, ch] = box;
        
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
}

class Block5 extends GameCollisionObject {
    constructor(x, y, blockSize, sprites) {
        super(x, y, blockSize, sprites);
        // More initialization here...
        // NOTE: not for this lesson :) 
        this._sprite = sprites.blocks.buildSprite();
        this._sprite.setAnimation("block5");
    }
    
    update(timeStep, gameState) {
        // Update code here. Returning true destroys the block.
        // NOTE: not for this lesson :) 
        this._sprite.update(timeStep);
    }
    
    draw(canvas, painter, camera) {
        // Draw code here...
        let [cx, cy, cw, ch] = camera.transformBox([this.x * this._blockSize , this.y * this._blockSize, this._blockSize, this._blockSize]);
                
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
    
    drawPreview(canvas, painter, box) {
        // Draw preview code here...
        let [cx, cy, cw, ch] = box;
        
        this._sprite.draw(painter, cx, cy, cw, ch);
    }
}

$(document).ready(function() {
    // We'll learn about this later....
    let spriteData = {
        sprites: {
            blocks: {
                image: "sprites/blocks.png",
                animations: {
                    block: {
                        frames: [0]
                    },
                    block2: {
                        frames: [1]
                    },
                    block3: {
                        frames: [2]
                    },
                    block4: {
                        frames: [3]
                    },
                    block5: {
                        frames: [4]
                    },
                }
            },
            player: {
                image: "sprites/player.png",
                width: 32,
                animations: {
                    run: {
                        frames: [1, 2, 3],
                        speed: 100
                    },
                    stand: {
                        frames: [0]
                    },
                    die: {
                        frames: [4]
                    }
                }
            },
            imposter: {
                image: "sprites/enemy.png",
                animations: {
                    stand: {
                        frames: [0]
                    },
                    run: {
                        frames: [0, 1, 2],
                        speed: 100
                    }
                }
            }
        }
    };
    
    $("#play-game-button").on("click", function() {
        element.makeGame("levels/test_level.json", [Block, Block2, Block3, Block4, Block5], [Entity], spriteData, Player);
    });
});
