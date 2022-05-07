class Player extends GameCollisionObject {
    constructor(x, y, assets) {
        super(x, y, assets);
        // More initialization here...
        // NOTE: not for this lesson :) 
        this._sprite = assets.sprites.player.buildSprite();
        
        this._vx = 5.4 / 1000;
        this._ay = 0.1 / 1000;
        this._vy = 0;
        this._movable = true;
        this._jumpy = 25 / 1000;
        this._max_hp = 20
        this._HP = this._max_hp;
        this._immune = 0;
        this._immune_amount = 1000;
        this._flash_time = 100;
        
        this._priorUp = false;
        this._priorSpace = false;
        this._face_left = false;
        
        this._shot_dist = 4.5;
        this._shot_angle = 30;
        this._shot_damage = 5;
        this._reload_time = 1000;
        this._reload_max = 3000;
        this._reload_counter = 0;
        
        this._pixelsInBlock = 32;
        
        this._jump_counter = 0;
        this._jumps_allowed = 1;
        
        this._sprite.setAnimation("stand");
        
        this._font_size = 22;
        
        this._controls = ["ArrowLeft", "ArrowRight", "ArrowUp", "Space"];
    }
    
    _getMidPoint(entity) {
        let box = entity.getBoundingBox();
        return [box[0] + box[2] / 2, box[1] + box[3] / 2];
    }
    
    _attack(isLeft, enemies) {
        let [px, py] = this._getMidPoint(this);
        
        for(let enemy of enemies) {
            let [ex, ey] = this._getMidPoint(enemy);
            let dist = Math.sqrt((ex - px) ** 2 + (ey - py) ** 2);
            let angle = Math.atan2((isLeft)? py - ey: ey - py, (isLeft)? px - ex: ex - px) * 180 / Math.PI;
                        
            if((dist <= this._shot_dist) && (Math.abs(angle) < this._shot_angle)) {
                enemy._HP -= this._shot_damage;
            }
        }
    }
    
    update(timeStep, gameState) {
        // Update code here. Returning true deletes the player...
        // NOTE: not for this lesson :) 
        let anim = "stand";
        
        if(gameState.PLAYER_COUNT == undefined) gameState.PLAYER_COUNT = 0;
        if(this._index == null) this._index = gameState.PLAYER_COUNT++;
        
        let keys = {...gameState.keysPressed};
        
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
            if(((cy + ch * (2/3)) < y) && (x < (cx + cw))) {
                keys["Space"] = true;
            }
        }
        
        if(this._controls[0] in keys) {
            this.x = this.x - (this._vx * timeStep);
            this._face_left = true;
            anim = "run";
        }
        if(this._controls[1] in keys){
            this.x = this.x + (this._vx * timeStep);
            this._face_left = false;
            anim = "run";
        }
        if(!this._priorUp && this._controls[2] in keys) {
            if(this._jump_counter > 0) {
                this._vy = -this._jumpy;
                this._jump_counter--;
            }
        }
        if(!this._priorSpace && this._controls[3] in keys) {
            if(this._reload_counter >= this._reload_time) {
                anim = "shoot";
                this._attack(this._face_left, gameState.getEntities());
                this._reload_counter -= this._reload_time;
            }
        }
        
        if(this._sprite.getAnimation() == "shoot") {
            if(this._sprite.cycles == 0) this._sprite.setAnimation(anim);
        }
        else {
            this._sprite.setAnimation(anim);
        }
        this._sprite.setHorizontalFlip(!this._face_left);
        
        this._priorUp = this._controls[2] in keys;
        this._priorSpace = this._controls[3] in keys;
        
        this._vy = this._vy + (this._ay * timeStep);
        this.y += this._vy * timeStep;
        
        if(this._HP <= 0) {
            gameState.exitZone(gameState.zoneName, gameState.cameraConfig);
        }
        let [__x, __y, w, h] = gameState.getLevelBounds();
        if((this.y + this.getBoundingBox()[3]) >= h) gameState.exitZone(gameState.zoneName, gameState.cameraConfig);
        
        this._reload_counter = Math.min(this._reload_max, this._reload_counter + timeStep);
        this._immune -= timeStep;
        
        this._sprite.update(timeStep);
    }
    
    draw(canvas, painter, camera) {
        // Draw code here...
        if(this._immune < 0 || (Math.floor(this._immune / this._flash_time) % 2 == 0)) {
            let [x, y, w, h] = camera.transformBox(this.getBoundingBox());
            this._sprite.draw(painter, x, y, w, h);
        }
        
        let [cx, cy, cw, ch] = camera.getDisplayZone();
        
        painter.fillStyle = "black";
        painter.font = this._font_size + "px Comic Sans";
        
        painter.fillText("HP: ", cx + 5, cy + 27);
        painter.fillText("Ammo: ", cx + 5, cy + 27 * 2);
        let ammo_width = painter.measureText("Ammo: ").width;
        
        painter.fillStyle = "red";
        painter.fillRect(cx + ammo_width + 10, cy + 8, cw / 6 * (this._HP / this._max_hp), this._font_size);
        painter.fillStyle = "grey";
        painter.fillRect(cx + ammo_width + 10, cy + 37, cw / 6 * (this._reload_counter / this._reload_max), this._font_size);
    }
    
    drawPreview(canvas, painter, box) {
        // Draw preview code here...
        this._sprite.draw(painter, box[0], box[1], box[2], box[3]);
    }
    
    handleCollision(obj, side) {
        if(side == "bottom") {
            this._vy = 0;
            this._jump_counter = this._jumps_allowed;
        }
        
        if(this._immune <= 0 && obj instanceof Entity) {
            this._HP -= 3;
            this._immune = this._immune_amount;
        }
    }
    
    getHitBoxes() {
        return [
            [this.x, this.y, 25 / this._pixelsInBlock, 35 / this._pixelsInBlock]
        ];
    }
}

class Entity extends GameCollisionObject {
    constructor(x, y, assets) {
        super(x, y, assets);
        // More initialization here...
        // NOTE: not for this lesson :) 
        this._vx = 3.0 / 1000;
        this._ay = 0.1 / 1000;
        this._vy = 0;
        this._movable = true;
        this._HP = 5;
        
        this._pixelsInBlock = 32;
        
        this._sprite = assets.sprites.enemySprite.buildSprite();
        this._sprite.setAnimation("run");
    }
    
    update(timeStep, gameState) {
        // Update code here. Returning true destroys the enemy.
        // NOTE: not for this lesson :) 
        this._vy = this._vy + (this._ay * timeStep);
        this.y += this._vy * timeStep;
        
        let players = gameState.getPlayers();
        let closest = null;
        let closestDist = Infinity;
        
        if(this._HP <= 0) return true;
        let [__x, __y, w, h] = gameState.getLevelBounds();
        if((this.y + this.getBoundingBox()[3]) >= h) return true;
        
        for(let player of players) {
            let dist = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
            if(dist < closestDist) {
                closestDist = dist;
                closest = player;
            }
        }
        
        this._sprite.setAnimation("run");
        this._sprite.setHorizontalFlip(closest.x - this.x > 0);
        
        this.x += Math.sign(closest.x - this.x) * this._vx * timeStep;
        this._sprite.update(timeStep);
    }
    
    draw(canvas, painter, camera) {
        // Draw code here...
        let [x, y, w, h] = camera.transformBox(this.getBoundingBox());        
        this._sprite.draw(painter, x, y, w, h);
    }
    
    drawPreview(canvas, painter, box) {
        // Draw preview code here...
        this._sprite.draw(painter, box[0], box[1], box[2], box[3]);
    }
    
    handleCollision(obj, side) {
        if(side == "bottom") this._vy = 0;
    }
    
    getHitBoxes() {
        return [
            [this.x, this.y, 72 / this._pixelsInBlock, 16 / this._pixelsInBlock]
        ];
    }
}

class Block extends GameCollisionObject {
    constructor(x, y, assets) {
        super(x, y, assets);
        // More initialization here...
        // NOTE: not for this lesson :) 
        this._sprite = assets.sprites.blocks.buildSprite();
        this._sprite.setAnimation("grass2");
    }
    
    update(timeStep, gameState) {
        // Update code here. Returning true destroys the block.
        // NOTE: not for this lesson :) 
    }
    
    draw(canvas, painter, camera) {
        // Draw code here...
        let [x, y, w, h] = camera.transformBox(this.getBoundingBox());
        this._sprite.draw(painter, x, y, w, h);
    }
    
    drawPreview(canvas, painter, box) {
        // Draw preview code here...
        this._sprite.draw(painter, box[0], box[1], box[2], box[3]);
    }
}

class Block2 extends GameCollisionObject {
    constructor(x, y, assets) {
        super(x, y, assets);
        // More initialization here...
        // NOTE: not for this lesson :) 
        this._sprite = assets.sprites.blocks.buildSprite();
        this._sprite.setAnimation("grass3");
    }
    
    update(timeStep, gameState) {
        // Update code here. Returning true destroys the block.
        // NOTE: not for this lesson :) 
    }
    
    draw(canvas, painter, camera) {
        // Draw code here...
        let [x, y, w, h] = camera.transformBox(this.getBoundingBox());
        this._sprite.draw(painter, x, y, w, h);
    }
    
    drawPreview(canvas, painter, box) {
        // Draw preview code here...
        this._sprite.draw(painter, box[0], box[1], box[2], box[3]);
    }
}

class GrassTop extends GameObject {
    constructor(x, y, assets) {
        super(x, y, assets);
        // More initialization here...
        // NOTE: not for this lesson :) 
        this._sprite = assets.sprites.blocks.buildSprite();
        this._sprite.setAnimation("grass");
        this._solid = false;
    }
    
    update(timeStep, gameState) {
        // Update code here. Returning true destroys the block.
        // NOTE: not for this lesson :) 
    }
    
    draw(canvas, painter, camera) {
        // Draw code here...
        let [x, y, w, h] = camera.transformBox(this.getBoundingBox());
        this._sprite.draw(painter, x, y, w, h);
    }
    
    drawPreview(canvas, painter, box) {
        // Draw preview code here...
        this._sprite.draw(painter, box[0], box[1], box[2], box[3]);
    }
}

class EndGameBlock extends GameCollisionObject {
    constructor(x, y, assets) {
        super(x, y, assets);
        // More initialization here...
        // NOTE: not for this lesson :) 
        this._solid = false;
        this._isLevelEditor = assets.flags.isLevelEditor
        this._triggered = false;
    }
    
    update(timeStep, gameState) {
        // Update code here. Returning true destroys the block.
        // NOTE: not for this lesson :)
        if(this._triggered) gameState.gameOver = true;
    }
    
    draw(canvas, painter, camera) {
        // Draw code here...
        if(this._isLevelEditor) {
            painter.fillStyle = "red";
            let [x, y, w, h] = camera.transformBox(this.getBoundingBox());
            painter.fillRect(x, y, w, h);
        }
    }
        
    handleCollision(obj, side) {
        if(obj instanceof Player) {
            this._triggered = true;
        }
    }
    
    drawPreview(canvas, painter, box) {
        // Draw preview code here...
        painter.fillStyle = "red";
        painter.fillRect(box[0], box[1], box[2], box[3]);
    }
}

// On document load, setup event to run the game on button click...
$(document).ready(function() {
    $("#play-game-button").on("click", function() {
        let gameInfo = {
            objects: {
                blocks: [Block, EndGameBlock, Block2, GrassTop],
                entities: [Entity],
                players: [Player]
            },
            zones: {
                main: {
                    zoneData: "levels/test_level.json",
                    preDraw: function(canvas, painter, gameState) {
                        painter.fillStyle = "DarkOliveGreen";
                        painter.fillRect(0, 0, canvas.width, canvas.height);
                        
                        if(gameState.background == null) gameState.background = gameState.assets.sprites.background.buildSprite();        

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
                    preUpdate(timeStep, gameState) {
                        if(gameState.gameOver) {
                            if(gameState._endTimer == null) gameState._endTimer = 5000;
                            gameState._endTimer -= timeStep;
                            return true;
                        }
                    },
                    postDraw: function(canvas, painter, gameState) {
                        if(gameState.gameOver) {
                            painter.fillStyle = "black";
                            painter.font = "30px Monospace";
                            let width = painter.measureText("You Win!").width;
                            painter.fillText("You Win!", canvas.width / 2 - width / 2, canvas.height / 2);
                        }
                    }
                }
            },
            assets: {
                sprites: {
                    player: {
                        image: "sprites/shotgunarm.png",
                        width: 100,
                        animations: {
                            stand: {
                                frames: [0],
                                inset: [30, 34, 25, 35]
                            },
                            run: {
                                frames: [1, 2, 3, 4],
                                speed: 100,
                                inset: [30, 34, 25, 35]
                            },
                            shoot: {
                                frames: [5, 6, 7],
                                speed: 20,
                                cycles: 1,
                                inset: [30, 34, 25, 35]
                            }
                        }
                    },
                    enemySprite: {
                        image: "sprites/croc.png",
                        width: 96,
                        animations: {
                            "stand": {
                                "frames": [4, 5],
                                "speed": 500,
                                "inset": [10, 0, 72, 16]
                            },
                            "run": {
                                "frames": [0, 1, 2, 3],
                                "speed": 100,
                                "inset": [10, 0, 72, 16]
                            }
                        }
                    },
                    background: {
                        image: "sprites/background.png",
                        width: 640
                    },
                    blocks: {
                        image: "sprites/bush.png",
                        animations: {
                            grass: {
                                frames: [0],
                                "inset": [5, 3, 24, 18]
                            },
                            grass2: {
                                frames: [1],
                                "inset": [9, 6, 14, 14]
                            },
                            grass3: {
                                frames: [2],
                                "inset": [9, 6, 14, 14]
                            },
                        }
                    }
                },
                sounds: {}
            }
        };

        // First, we have to make a level.
        element.makeGame(gameInfo, "main", [{minBlocksShown: 8, maxBlocksShown: 16}]);
    });
});
