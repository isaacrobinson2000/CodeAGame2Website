class CoreElement {}
let element = new CoreElement();
let elem_proto = Object.getPrototypeOf(element);

// For loading images...
function loadImage(url) {
    return new Promise(function(resolve, reject) {
        let img = new Image();
        
        img.onload = function() {
            resolve(img);
        };
        img.onerror = function() {
            reject("Unable to load image");
        };
        
        img.src = url;
    })
}

function loadJSON(url) {
    return new Promise(function(resolve, reject) {
        $.getJSON(url)
        .done(function(json) {
            resolve(json);
        })
        .fail(function(jqxhr, textStatus, error) {
            reject(error);
        });
    });
}

window.loadImage = loadImage;


function range(start = 0, stop = undefined, step = 1) {
    let fstart = (stop != undefined)? start: 0;
    let fstop = (stop != undefined)? stop: start;
    let fstep = (step == 0)? 1: step;
    
    let numSteps = Math.floor((fstop - fstart) / fstep);
    
    let array = [];
    for(let i = 0, val = fstart; i < numSteps; i++, val += fstep) {
        array[i] = val;
    }
    
    return array;
}
window.range = range; // Make range accessible outside this code...

/* Animation:
let spritemap = {
    "image": "...",
    "width": 30, // In pixels, default is to match image height...
    "animations": {
        "run": {
            "speed": 1, // In millis
            "frames": [0, 1, 5, 8, 3, 4], // Frames
            "cycles": -1 // Number of cycles (negative means forever)
        }
    }
}
*/

let fdiv = (x, y) => Math.floor(x / y);

class Sprite {
    constructor(img, width, animations) {
        this._img = img;
        this._animations = animations;
        this._selected = null;
        
        this._height = img.height;
        this._width = ((width <= 0) || (width == null))? this._height: width; 
        
        this._numImages = Math.floor(img.width / this._width);
        
        this._speed = 16;
        this._frames = range(0, this._numImages);
        this._cycles = Infinity;
        
        this._index = 0;
        this._accumulator = 0;        
    }
    
    setAnimation(animationName) {
        if(animationName === this._selected) return;
        
        this._selected = ((animationName == null) || !(animationName in this._animations))? null: animationName;
        
        let anim = (this._selected != null)? this._animations[this._selected]: {};
        
        // Update properties...
        this._speed = ((anim.speed == null) || (anim.speed < 1))? 16: anim.speed;
        this._frames = anim.frames ?? range(0, this._numImages);
        this._cycles = ((anim.cycles == null) || (anim.cycles < 0))? Infinity: anim.cycles;
        
        for(let i = 0; i < this._frames.length; i++) {
            this._frames[i] = Math.abs(this._frames[i]) % this._numImages;
        }
        
        // Reset the index and accumulator.
        this._index = 0;
        this._accumulator = 0;
    }
    
    getAnimation() {
        return this._selected;
    }
    
    get width() {
        return this._width;
    }
    
    get height() {
        return this._height;
    }
    
    update(timeDelta) {
        this._accumulator += timeDelta;
        
        // Update the index and accumulator...
        this._index += fdiv(this._accumulator, this._speed);
        this._accumulator %= this._speed;
        
        // Update the cycles based on new index.
        this._cycles -= fdiv(this._index, this._frames.length);
        this._index %= this._frames.length;
        
        if(this._cycles <= 0) {
            this._cycles = 0;
            this._index = this._frames.length - 1;
        }
    }
    
    draw(ctx, x, y, width, height) {
        let imgIdx = this._frames[this._index];
        let xin = this._width * imgIdx;
        
        ctx.drawImage(this._img, xin, 0, this._width, this._height, x, y, width, height);
    }
}

window.Sprite = Sprite;

async function getSpriteBuilder(imgConfig) {
    return {
        _img: await loadImage(imgConfig.image),
        _width: imgConfig.width,
        _animations: imgConfig.animations,
        buildSprite: function() {
            return new Sprite(this._img, this._width, this._animations);
        }
    };
}

function _bound(val, low, high) {
    return Math.max(low, Math.min(high, val));
}

class Camera {
    constructor(canvas, minPixelsShown, trackBoxRatio = 1 / 3) {
        this._canvas = canvas;
        this._minPixelsShown = minPixelsShown;
        this._zoom = 1;
        this._track = null;
        this._centerPoint = [0, 0];
        this._trackBoxRatio = trackBoxRatio;
    }
    
    setCenterPoint(cp) {
        this._centerPoint = [cp[0], cp[1]];
    }
    
    getCenterPoint() {
        return this._centerPoint;
    }
    
    setTrackedObject(track) {
        this._track = track;
    }
    
    getMinimumPixelsShown() {
        return this._minPixelsShown;
    }
    
    setMinimumPixelsShown(value) {
        this._minPixelsShown = value;
    }
    
    update(levelBounds) {
        let minCanvasSide = Math.min(this._canvas.width, this._canvas.height);
        this._zoom = minCanvasSide / this._minPixelsShown;
        
        if((this._track != null) && ("getHitBox" in this._track)) {
            let [x, y, w, h] = this._track.getHitBox().map((val) => val * this._track._blockSize);
            
            // If object is not within track box, move the track box to put it in bounds....
            let [cx, cy, cw, ch] = this.getBounds();
            let [centX, centY] = this._centerPoint;
            let trackBox = [
                centX - this._trackBoxRatio * (cw / 2), 
                centY - this._trackBoxRatio * (ch / 2), 
                this._trackBoxRatio * cw, 
                this._trackBoxRatio * ch
            ];
            
            // Move x coordinate of tracking box over the tracked object.
            if(x < trackBox[0]) trackBox[0] = x;
            else if(x > (trackBox[0] + trackBox[2])) trackBox[0] = x - trackBox[2];
            // Move y coordinate also...
            if(y < trackBox[1]) trackBox[1] = y;
            else if(y > (trackBox[1] + trackBox[3])) trackBox[1] = y - trackBox[3];
            
            this._centerPoint = [trackBox[0] + trackBox[2] / 2, trackBox[1] + trackBox[3] / 2];
            
            // Bound the camera...
            [cx, cy, cw, ch] = this.getBounds();
            let [xOut, yOut] = [this._centerPoint[0] - cx, this._centerPoint[1] - cy];
            
            let [newCx, newCy] = [_bound(cx, 0, levelBounds[0] - cw), _bound(cy, 0, levelBounds[1] - ch)];
            
            this._centerPoint = [newCx + xOut, newCy + yOut];
        }
    }
    
    getBounds() {
        let [cx, cy] = this._centerPoint;
        let w = this._canvas.width / this._zoom;
        let h = this._canvas.height / this._zoom;
        
        return [cx - w / 2, cy - h / 2, w, h];
    }
    
    transform(point) {
        let [x, y] = point;
        
        let [gx, gy, gw, gh] = this.getBounds();
        let cw = this._canvas.width;
        let ch = this._canvas.height;
        
        return [((x - gx) / gw) * cw, ((y - gy) / gh) * ch]
    }
    
    transformBox(box) {
        let [x, y, w, h] = box;
        
        let [p1x, p1y] = this.transform([x, y]);
        let [p2x, p2y] = this.transform([x + w, y + h]);
        
        return [p1x, p1y, p2x - p1x, p2y - p1y];
    }
    
    reverseTransform(point) {
        let [x, y] = point;
        
        let [gx, gy, gw, gh] = this.getBounds();
        let cw = this._canvas.width;
        let ch = this._canvas.height;
        
        return [((x / cw) * gw) + gx, ((y / ch) * gh) + gy];
    }
}

window.Camera = Camera;

elem_proto.makeBaseGame = async function(gameLoop, gameState = {}, levelData = {}, minPixelsShown = 32 * 10) {
    let newDiv = $($.parseHTML("<div style='position: fixed; z-index: 300; top: 0; bottom: 0; left: 0; right: 0; background-color: white;'></div>"));
    let newCanvas = $($.parseHTML("<canvas style='width: 100%; height: 100%;'>Your browser doesn't support canvas!</canvas>"));
    let closeBtn = $($.parseHTML("<button style='position: absolute; top: 0; right: 0;'>X</button>"));
        
    newDiv.append(newCanvas);
    newDiv.append(closeBtn);
    
    $(document.body).append(newDiv);
    
    gameState = {...gameState};
    
    gameState.lastTimeStamp = null;
    gameState.keepRunning = true;
    gameState.canvas = newCanvas[0];
    gameState.painter = gameState.canvas.getContext("2d");
    gameState.keysPressed = {};
    gameState.mousePressed = false;
    gameState.mouseLocation = [0, 0];
    gameState.camera = new Camera(newCanvas[0], minPixelsShown);
    
    gameState.sprites = {};
        
    for(let spriteName in (levelData.sprites ?? {})) {
        gameState.sprites[spriteName] = await getSpriteBuilder(levelData.sprites[spriteName]);
    }
    
    try {
        gameState.level = (levelData.level != null)? await loadJSON(levelData.level): {};
    } catch(exp) {
        gameState.level = {};
    }
    
    function loopManager(timeStamp) {
        let {width, height} = gameState.canvas.getBoundingClientRect();
        
        gameState.canvas.width = width;
        gameState.canvas.height = height;
        
        gameState.painter.imageSmoothingEnabled = false; 
        gameState.painter.mozImageSmoothingEnabled = false; 
        gameState.painter.webkitImageSmoothingEnabled = false; 
        gameState.painter.msImageSmoothingEnabled = false; 
        
        let timeStep = (gameState.lastTimeStamp == null)? 0: timeStamp - gameState.lastTimeStamp;
        
        gameLoop(timeStep, gameState);
        
        gameState.lastTimeStamp = timeStamp;
                
        if(gameState.keepRunning) {
            window.requestAnimationFrame(loopManager);
        }
    };
    
    // Mouse support....
    newDiv.mousedown((e) => {
        gameState.mouseLocation = [e.offsetX, e.offsetY];
        gameState.mousePressed = true;
        return false;
    });
    
    newDiv.mousemove((e) => {
        gameState.mouseLocation = [e.offsetX, e.offsetY];
    });
    
    newDiv.mouseup((e) => {
        gameState.mouseLocation = [e.offsetX, e.offsetY];
        gameState.mousePressed = false;
        return false;
    });
    
    closeBtn.mousedown(false);
    closeBtn.mouseup(false);
    closeBtn.mousemove(false);
    
    // Manage keyboard events, keep track of pressed keys in special property in the gameState object.
    let doc = $(document);
    // We have to disable all other keyevents as jupyter notebook doesn't play nicely with keyboard input.
    doc.off("keydown");
    
    doc.on("keydown.gameloop", (event) => {
        gameState.keysPressed[event.code] = true;
    });
    
    doc.on("keyup.gameloop", (event) => {
        delete gameState.keysPressed[event.code];
    });
    
    // If the close button is clicked delete the div and terminate the game loop. Also reattach jupyter keyboard events.
    closeBtn.click(() => {
        newDiv.remove();
        gameState.keepRunning = false;
        doc.off(".gameloop");
        try {
            Jupyter.keyboard_manager.bind_events();
        } catch(e) {
            console.log(e);
        }
    });
    
    // Start the game loop.
    window.requestAnimationFrame(loopManager);
};

function _makeEmptyLevel() {
    let level = {
        "blockSize": 32,
        "chunkSize": 16,
        "numChunks": [10, 10],
        "player": null,
        "chunks": []
    };
    let chunks = level.chunks;
    
    // Initial level with all null...
    for(let i = 0; i < level.numChunks[0]; i++) {
        chunks[i] = [];
        for(let j = 0; j < level.numChunks[1]; j++) {
            chunks[i][j] = _makeEmptyChunk(level.chunkSize);
        }
    }
    
    return level;
}

function _makeEmptyChunk(chunkSize) {
    let chunk = {"entities": [], "blocks": []};
    
    for(let k = 0; k < chunkSize; k++) {
        chunk.blocks[k] = [];
        for(let l = 0; l < chunkSize; l++) {
            chunk.blocks[k][l] = null;
        }
    }
    
    return chunk;
}

class GameObject {
    constructor(x, y, blockSize, sprites) {
        this.x = x;
        this.y = y;
        this._blockSize = blockSize;
    }
    update(timeStep, gameState) {}
    draw(canvas, painter, camera) {}
    drawPreview(canvas, painter, box) {}
    
    getLocation() {
        return [this.x, this.y];
    }
    
    setLocation(point) {
        [this.x, this.y] = point;
    }
    
    toJSON() {
        let obj = {
            _$type: this.constructor.name
        };
        
        for(let prop in this) {
            if(!prop.startsWith("_")) {
                obj[prop] = this[prop];
            }
        }
        
        return obj;
    }
    
    static fromJSON(data, blockSize, sprites) {
        let obj = new this(data.x, data.y, blockSize, sprites);
        
        for(let prop in data) {
            if(!prop.startsWith("_")) obj[prop] = data[prop];
        }
        
        return obj;
    }
    
    getHitBox() {
        return [this.x, this.y, 1, 1];
    }
}
window.GameObject = GameObject;


class GameCollisionObject extends GameObject {
    
    constructor(x, y, blockSize, sprites) {
        super(x, y, blockSize, sprites);
        
        this.___px = x;
        this.___py = y;
        this._vx = null;
        this._vy = null;
        
        this._collisionSides = {"left": true, "top": true, "right": true, "bottom": true};
        this._movable = false;
        this._solid = true;
        this.___covered = [false, false];
    }
    
    __intersection(boxSeg, dvec, boxSeg2, dvec2, ignoreT = false) {
        // PRIVATE: Tests 2 borders for colision within the time step.
        let [pt, ax, len] = boxSeg;
        let [pt2, ax2, len2] = boxSeg2;
        
        if(ax != ax2) throw "Axes did not match!";
        
        let opAx = (ax + 1) % 2;
        let t = (pt2[opAx] - pt[opAx]) / (dvec[opAx] - dvec2[opAx]);
        
        if((t == Infinity) || (t == -Infinity)) return [Infinity, 0, null];
        if(t != t) return [Infinity, 0, null];
        
        let res = pt[ax] + dvec[ax] * t;
        let res2 = pt2[ax] + dvec2[ax] * t;
        let overlapLoc = pt[opAx] + dvec[opAx] * t;
        
        if((res + len < res2) || (res2 + len2 < res)) return [Infinity, 0, null];
        
        if(!ignoreT && (t > 1 || t < -5)) return [Infinity, 0, null];
        
        let segOverlap = Math.min.apply(
            null, [res2 - (res + len), (res2 + len2) - res].map(Math.abs)
        );
        
        if(t < 0) t = 1 + Math.abs(t);
                
        let boundAtCollision = [[(ax != 0)? overlapLoc: res2, (ax != 1)? overlapLoc: res2], ax, len2];
                
        return [t, segOverlap, boundAtCollision];
    }
    
    __getCollisionSides() {
        let [x, y, w, h] = this.getHitBox();
        [x, y] = [this.___px, this.___py];
        
        // Build hitbox sides...
        let sides = [
            [[x, y + h], 0, w],
            [[x, y], 0, w],
            [[x + w, y], 1, h],
            [[x, y], 1, h]
        ];
        
        for(let i = 0; i < GameCollisionObject.sideNames.length; i++) {
            sides[i] = (this._collisionSides[GameCollisionObject.sideNames[i]])? sides[i]: null;
        }
        
        return sides;
    }
    
    __getDisplacementVector() {
        return [this.x - this.___px, this.y - this.___py];
    }
    
    handleCollisions(obj, side) {}
    
    onCollision(other) {
        if(this._movable && (this._vx == null || this._vy == null)) {
            throw "Error: Must store velocity in _vx and _vy for game collision objects!";
        }
                        
        if(this._movable && (other instanceof GameCollisionObject)) {
            // Gives us direction of move...
            let [dx, dy] = this.__getDisplacementVector();
            let [dx2, dy2] = other.__getDisplacementVector();

            let oSides = other.__getCollisionSides();
            let thisSides = this.__getCollisionSides();
            
            let sideSwap = GameCollisionObject.sideSwaps;
            thisSides = thisSides.map((e, i, a) => a[sideSwap[i]]);
            
            let bestTime = Infinity;
            let bestBoundIdx = null;

            for(let i = 0; i < thisSides.length; i++) {
                if((oSides[i] == null) || (thisSides[i] == null)) continue;
                let [time, overlap, bound] = this.__intersection(thisSides[i], [dx, dy], oSides[i], [dx2, dy2]);

                if(bestTime > time) {
                    bestTime = time;
                    bestBoundIdx = i;
                }
            }
            
            if(bestTime != Infinity) {
                GameCollisionObject.appendCollision(this, other, bestBoundIdx, bestTime);
            }
        }
        
        GameCollisionObject.finalPassDone = false;
    }
    
    __collisionAdjust(bound, boundIdx) {
        let [_x, _y, width, height] = this.getHitBox();
        let [[x, y], ax, len] = bound;

        //if(this.___covered[boundIdx]) return;
        if(!this._movable) return;
        this.___covered[ax] = true;

        let sign = GameCollisionObject.sideSigns[boundIdx];

        let cX = x - ((sign + 1) * width / 2);
        let cY = y - ((sign + 1) * height / 2);
        this.x = (ax == 0)? this.x: cX;
        this.y = (ax == 1)? this.y: cY;
        
        this._vx *= !this.___covered[1];
        this._vy *= !this.___covered[0];
    }
    
    onCollisionEnd() {
        GameCollisionObject.manageAllCollisions();
        
        this.___px = this.x;
        this.___py = this.y;
        this.___covered = [false, false];
    }
    
    static manageAllCollisions() {
        if(GameCollisionObject.finalPassDone) return;
        
        let colList = [];
        for(let elem in GameCollisionObject.collisions) {
            colList.push(GameCollisionObject.collisions[elem]);
        }
        colList.sort((a, b) => a[3] - b[3]);
        
        let sideSwap = GameCollisionObject.sideSwaps;
        let sideNames = GameCollisionObject.sideNames;
        
        for(let [obj, otherObj, boundIdx, time] of colList) {
            let dvec1 = obj.__getDisplacementVector();
            let dvec2 = otherObj.__getDisplacementVector();
            let thisB = obj.__getCollisionSides()[sideSwap[boundIdx]];
            let otherB = otherObj.__getCollisionSides()[boundIdx];
            
            let [t, overlap, bound] = obj.__intersection(thisB, dvec1, otherB, dvec2);
            
            if(overlap <= 0 || bound == null) continue;
            let [[x, y], ax, len] = bound;
            
            // Move both objects....
            if(obj._solid && otherObj._solid) {
                obj.__collisionAdjust(bound, boundIdx);
                otherObj.__collisionAdjust(bound, sideSwap[boundIdx]);
            }
            // For extra functionality...
            obj.handleCollisions(otherObj, sideNames[sideSwap[boundIdx]]);
            otherObj.handleCollisions(obj, sideNames[boundIdx]);
        }
        
        GameCollisionObject.objectIdx = 0;
        GameCollisionObject.objectMapping.clear();
        GameCollisionObject.collisions = {};
        GameCollisionObject.finalPassDone = true;
    }
    
    static appendCollision(obj, otherObj, boundIdx, time) {
        if(!GameCollisionObject.objectMapping.has(obj)) GameCollisionObject.objectMapping.set(obj, GameCollisionObject.objectIdx++);
        if(!GameCollisionObject.objectMapping.has(otherObj)) GameCollisionObject.objectMapping.set(otherObj, GameCollisionObject.objectIdx++);
        
        let i1 = GameCollisionObject.objectMapping.get(obj);
        let i2 = GameCollisionObject.objectMapping.get(otherObj);
        
        let iLst = [i1, i2];
        iLst.sort();
        
        if(!(iLst in GameCollisionObject.collisions)) GameCollisionObject.collisions[iLst] = [obj, otherObj, boundIdx, time];
    }
}

GameCollisionObject.objectIdx = 0;
GameCollisionObject.objectMapping = new Map();
GameCollisionObject.collisions = {};
GameCollisionObject.finalPassDone = false;
GameCollisionObject.sideNames = ["bottom", "top", "right", "left"];
GameCollisionObject.sideSigns = [-1, 1, -1, 1];
GameCollisionObject.sideSwaps = [1, 0, 3, 2];

window.GameCollisionObject = GameCollisionObject;


function _loadChunk(cx, cy, level, blockTypes, entityTypes, sprites) {    
    let chunkSize = level.chunkSize;
    let newLoadedChunk = _makeEmptyChunk(chunkSize);
    
    // Load blocks...
    for(let x = 0; x < chunkSize; x++) {
        for(let y = 0; y < chunkSize; y++) {
            let blockData = level.chunks[cx][cy].blocks[x][y];
            let blockName = (blockData != null)? blockData._$type: null;
            let bx = cx * chunkSize + x;
            let by = cy * chunkSize + y;

            newLoadedChunk.blocks[x][y] = (blockName != null)? blockTypes[blockName].fromJSON(blockData, level.blockSize, sprites): null;
        }
    }
    
    // Load sprites...
    for(let data of level.chunks[cx][cy].entities) {
        newLoadedChunk.entities.push(entityTypes[data._$type].fromJSON(data, level.blockSize, sprites));
    }
    
    return newLoadedChunk;
}

function _unloadChunk(chunk, cx, cy, level) {
    let chunkSize = level.chunkSize;
    // Save the chunk blocks...
    for(let x = 0; x < chunkSize; x++) {
        for(let y = 0; y < chunkSize; y++) {
            let res = chunk.blocks[x][y]
            level.chunks[cx][cy].blocks[x][y] = (res != null)? res.toJSON(): null;
        }
    }
    
    level.chunks[cx][cy].entities = [];
    // Save chunk entities...
    for(let entity of chunk.entities) {
        level.chunks[cx][cy].entities.push(entity.toJSON());
    }
}

function _flushLoadedChunks(level, loadedChunks) {
    for(let [x, y, chunk] of loadedChunks) {
        _unloadChunk(chunk, x, y, level);
    }
}

function _manageChunks(level, camera, loadedChunks, blockTypes, entityTypes, sprites) {
    // Issue: Blocks just dissapear!
    let [cx, cy, cw, ch] = camera.getBounds();
        
    let chunkSide = level.blockSize * level.chunkSize; 
    let xStartChunk = Math.max(0, Math.floor(cx / chunkSide));
    let yStartChunk = Math.max(0, Math.floor(cy / chunkSide));
    let xEndChunk = Math.min(level.numChunks[0] - 1, Math.ceil((cx + cw) / chunkSide));
    let yEndChunk = Math.min(level.numChunks[1] - 1, Math.ceil((cy + ch) / chunkSide));
    
    let newLoadedChunks = [];
    let doneChunks = {};
    
    // Unload chunks that are out of the area... Keep others loaded...
    for(let [x, y, chunk] of loadedChunks) {
        if((x < xStartChunk || x > xEndChunk) || (y < yStartChunk || y > yEndChunk)) {
            _unloadChunk(chunk, x, y, level);
        }
        else {
            newLoadedChunks.push([x, y, chunk]);
            doneChunks[[x, y]] = true;
        }
    }

    // Load chunks in area...
    for(let xic = xStartChunk; xic <= xEndChunk; xic++) {
        for(let yic = yStartChunk; yic <= yEndChunk; yic++) {
            if(!([xic, yic] in doneChunks)) {
                newLoadedChunks.push([xic, yic, _loadChunk(xic, yic, level, blockTypes, entityTypes, sprites)]); 
            }
        }
    }
    
    loadedChunks = null;
    
    return newLoadedChunks;
}

function _popAndSwapWithEnd(arr, i) {
    if(arr.length > 0) {
        let tmp = arr[i];
        arr[i] = arr[arr.length - 1];
        arr.length--;
        return tmp;
    }
    return undefined;
}

function _findChunk(x, y, loadedChunks) {
    for(let [cx, cy, chunk] of loadedChunks) {
        if((cx == x) && (cy == y)) return chunk;
    }
    
    return null;
}

function _gameObjListToMapping(list) {
    let mappingObj = {};
    
    for(let elem of list) {
        mappingObj[elem.name] = elem;
    }
        
    return mappingObj;
}

function _gameObjMappingToList(obj) {
    let list = [];
    
    for(let key in obj) {
        list.push(obj[key]);
    }
    
    return list;
}


elem_proto.makeGame = async function(levelPath, blockTypes = [], entityTypes = [], levelData = {}, playerType = null, callbacks = {}, minPixelsShown = null) {    
    let gameState = {};
    gameState.entityTypes = _gameObjListToMapping(entityTypes);
    gameState.blockTypes = _gameObjListToMapping(blockTypes);
    gameState.loadedChunks = [];
    gameState.playerType = playerType;
    gameState.__player = null;
    
    levelData.level = levelPath;
    
    function _reboundEntity(entity, chunkSize, numChunks) {
        let [cBoundX, cBoundY] = numChunks;
        let [ex, ey, ew, eh] = entity.getHitBox();
        [ex, ey] = [_bound(ex, 0, (cBoundX * chunkSize) - ew), _bound(ey, 0, (cBoundY * chunkSize) - eh)];
        entity.setLocation([ex, ey]);
        return [ex, ey];
    }
    
    function _buildChunkLookup(loadedChunks) {
        let chunkLookup = {};
        for(let [cx, cy, chunk] of loadedChunks) chunkLookup[[cx, cy]] = chunk;
        
        return chunkLookup;
    }
    
    function _resetLevel(gameState) {
        gameState.level = JSON.parse(JSON.stringify(gameState.__origLevel));
        for(let prop in gameState.level.player) {
            gameState.__player[prop] = gameState.level.player[prop];
        }
        gameState.loadedChunks = [];
        gameState.chunkLookup = {};
    }
    
    function _handleCollisions(loadedChunks, chunkLookup, chunkSize, numChunks, player, gameState) {
        // Bound value, then compute floored division and modulo...
        let boundNFloor = (x, xlow, xhigh, bounding_func = Math.floor) => {
            x = _bound(x, xlow, xhigh);
            return bounding_func(x);
        }
        
        let divmod = (x, y) => [Math.floor(x / y), Math.floor(x % y)];
                
        // Going over every entity in every loaded chunk...
        for(let ci = 0; ci < loadedChunks.length; ci++) {
            let [cx, cy, chunk] = loadedChunks[ci];
            
            for(let i = ((ci == 0)? -1: 0); i < chunk.entities.length; i++) {
                // -1 indicates index of the player...
                let entity1 = (i < 0)? player: chunk.entities[i];
                
                let [x1, y1, w1, h1] = entity1.getHitBox();
                
                // Handle any entity-block collisions....
                let xbs = boundNFloor(x1, 0, (chunkSize * numChunks[0]) - 1);
                let ybs = boundNFloor(y1, 0, (chunkSize * numChunks[1]) - 1);
                let xbe = boundNFloor(x1 + w1, 0, (chunkSize * numChunks[0]) - 1);
                let ybe = boundNFloor(y1 + h1, 0, (chunkSize * numChunks[1]) - 1);
                        
                for(let fbx = xbs; fbx <= xbe; fbx++) {
                    for(let fby = ybs; fby <= ybe; fby++) {
                        // Compute chunk and block in chunk indexes...
                        let [cxb, bx] = divmod(fbx, chunkSize);
                        let [cyb, by] = divmod(fby, chunkSize);
                        
                        // If chunk is not loaded, just skip it...
                        if(!([cxb, cyb] in chunkLookup)) continue;
                        
                        let block = chunkLookup[[cxb, cyb]].blocks[bx][by]
                        
                        if(block != null) {
                            // If block is not null, perform collision check with entity...
                            let [x2, y2, w2, h2] = block.getHitBox();
                            
                            if(
                                !((x2 >= (x1 + w1)) || ((x2 + w2) <= x1)) // If we collide on x-values
                                && !((y2 >= (y1 + h1)) || ((y2 + h2) <= y1)) // and y values... (boxes overlap).
                            ) {
                                if("onCollision" in entity1) {
                                    if(entity1.onCollision(block) && (i >= 0)) {
                                        if(i >= 0) {
                                            _popAndSwapWithEnd(chunk.entities, i);
                                        }
                                        else {
                                            _resetLevel(gameState);
                                            return;
                                        }
                                    }
                                }
                                if("onCollision" in block) {
                                    if(block.onCollision(entity1)) {
                                        chunkLookup[[cxb, cyb]].blocks[bx][by] = null;
                                    }
                                }
                            }
                        }
                    }
                }

                // Now handle any entity-entity collisions...
                for(let cj = ci; cj < loadedChunks.length; cj++) {
                    let [cx2, cy2, chunk2] = loadedChunks[cj]
                    
                    for(let j = ((ci == cj)? i + 1: 0); j < chunk2.entities.length; j++) {
                        let entity2 = chunk2.entities[j];
                        let [x2, y2, w2, h2] = entity2.getHitBox();
                        
                        // Collision checks....
                        if(
                            !((x2 >= (x1 + w1)) || ((x2 + w2) <= x1)) // If we collide on x-values
                            && !((y2 >= (y1 + h1)) || ((y2 + h2) <= y1)) // and y values... (boxes overlap).
                        ) {                            
                            if("onCollision" in entity1) {
                                if(entity1.onCollision(entity2)) {
                                    if(i >= 0) {
                                        _popAndSwapWithEnd(chunk.entities, i);
                                    }
                                    else {
                                        _resetLevel(gameState);
                                        return;
                                    }
                                }
                            }
                            if("onCollision" in entity2) {
                                if(entity2.onCollision(entity1)) {
                                    _popAndSwapWithEnd(chunk2.entities, j);
                                }
                            }
                        }
                    }
                }
            }
        }
        
        for(let [cx, cy, chunk] of loadedChunks) {
            for(let blockCol of chunk.blocks) {
                for(let block of blockCol) {
                    if((block != null) && ("onCollisionEnd" in block)) block.onCollisionEnd();
                }
            }
            for(let entity of chunk.entities) {
                if("onCollisionEnd" in entity) entity.onCollisionEnd();
            }
        }
        
        if("onCollisionEnd" in player) player.onCollisionEnd();
    }
    
    function gameLoop(timeStep, gameState) {
        // Setup player object if we just started the game...
        if(gameState.__player == null) {
            let lvl = gameState.level;
            gameState.__origLevel = JSON.parse(JSON.stringify(lvl));
            gameState.__player = gameState.playerType.fromJSON(lvl.player, lvl.blockSize, gameState.sprites);
            gameState.camera.setTrackedObject(gameState.__player);
            gameState.chunkLookup = {};
            
            // Some methods to allow entities/blocks to add other entities/blocks to the game...
            gameState.addEntity = function(entity) {
                let [ex, ey] = _reboundEntity(entity, this.level.chunkSize, this.level.numChunks);
                [ex, ey] = [Math.floor(ex / this.level.chunkSize), Math.floor(ey / this.level.chunkSize)];
                
                if([ex, ey] in this.chunkLookup) {
                    this.chunkLookup[[ex, ey]].entities.push(entity);
                    return;
                }
                
                this.level.chunks[ex][ey].entities.push(entity.toJSON());
            };
            
            gameState.addBlock = function(block) {
                let [bx, by] = _reboundEntity(block, this.level.chunkSize, this.level.numChunks);
                let [cx, cy] = [Math.floor(bx / this.level.chunkSize), Math.floor(by / this.level.chunkSize)];
                [bx, by] = [Math.floor(bx), Math.floor(by)];
                
                block.x = Math.floor(bx);
                block.y = Math.floor(by);
                let subBX = bx % this.level.chunkSize;
                let subBY = by % this.level.chunkSize;
                
                if([cx, cy] in this.chunkLookup) {
                    this.chunkLookup[[cx, cy]].blocks[subBX][subBY] = block;
                    return;
                }
                
                this.level.chunks[cx][cy].blocks[subBX][subBY] = block.toJSON();
            };
            
            gameState.getPlayer = function() {
                return gameState.__player;
            };
            
            gameState.getNeighboringBlocks = function(block) {
                let [bx, by] = _reboundEntity(block, this.level.chunkSize, this.level.numChunks).map(Math.floor);
                
                let neighbors = [
                    [null, null, null],
                    [null, null, null],
                    [null, null, null]
                ];
                
                let iStart = bx - 1;
                let jStart = by - 1;
                
                for(let i = iStart; i < bx + 2; i++) {
                    for(let j = jStart; j < by + 2; j++) {
                        let [cx, cy] = [i / this.level.chunkSize, j / this.level.chunkSize].map(Math.floor); 
                        
                        let subBX = i % this.level.chunkSize;
                        let subBY = j % this.level.chunkSize;
                        
                        if([cx, cy] in this.chunkLookup) {
                            neighbors[i - iStart][j - jStart] = this.chunkLookup[[cx, cy]].blocks[subBX][subBY];
                        }
                    }
                }
                
                return neighbors;
            };
            
            gameState.getEntities = function() {
                let entityLst = [];
                
                for(let [cx, cy, chunk] of this.loadedChunks) {
                    entityLst.push(...chunk.entities);
                }
                
                return entityLst;
            };
        }
        
        update(timeStep, gameState);
        draw(gameState.canvas, gameState.painter, gameState);
    }
    
    function update(timeStep, gameState) {
        if("preUpdate" in callbacks) {
            if(callbacks.preUpdate(timeStep, gameState)) return;
        }

        // Used heavily below...
        let chunkSize = gameState.level.chunkSize;
        let numChunks = gameState.level.numChunks;
        
        let relocate = {};
        
        for(let [cx, cy, chunk] of gameState.loadedChunks) {
            // Update the blocks....
            for(let blockCol of chunk.blocks) {
                let blockI = 0;
                for(let block of blockCol) {
                    if(block != null) {
                        if(block.update(timeStep, gameState)) blockCol[blockI] = null;
                    }
                    blockI++;
                }
            }
            
            // Update the entities...            
            for(let i = 0; i < chunk.entities.length; i++) {
                let entity = chunk.entities[i];
                // Update entity location...
                if(entity.update(timeStep, gameState)) {
                    // If update returns true, delete the entity...
                    _popAndSwapWithEnd(chunk.entities, i);
                    continue;
                }
                
                // Bound entities to game zone...
                let [ex, ey] = _reboundEntity(entity, chunkSize, numChunks);
                
                // Determine if entity needs to be moved to a new chunk, if so add it to the relocation list.
                [ex, ey] = [Math.floor(ex / chunkSize), Math.floor(ey / chunkSize)];
                
                if((ex != cx) || (ey != cy)) {
                    _popAndSwapWithEnd(chunk.entities, i);
                    let loc = [ex, ey];
                    if(!(loc in relocate)) relocate[loc] = [];
                    relocate[loc].push(entity);
                }
            }
        }
        
        // If the location of a loaded chunk matches one in the entity relocation list, move the entities...
        for(let [cx, cy, chunk] of gameState.loadedChunks) {
            let loc = [cx, cy];
            if(loc in relocate) {
                for(let entity of relocate[loc]) chunk.entities.push(entity);
                delete relocate[loc];
            }
        }
        
        // Unload any remaining entities into the level as their chunks aren't loaded...
        for(let [ex, ey] in relocate) {
            for(let entity in relocate[[ex, ey]]) {
                gameState.level.chunks[ex][ey].entities.push(entity.toJSON());
            }
        }
        
        // Update the player... Bound player to game zone...
        if(gameState.__player.update(timeStep, gameState)) {
            _resetLevel(gameState);
            return;
        };
        _reboundEntity(gameState.__player, chunkSize, numChunks);
        
        // Handle collisions between objects.... (Expensive...)
        _handleCollisions(gameState.loadedChunks, gameState.chunkLookup, chunkSize, numChunks, gameState.__player, gameState);
        
        // Finally, update the camera...
        gameState.camera.update(gameState.level.numChunks.map((v) => v * gameState.level.blockSize * gameState.level.chunkSize));
        
        // Update chunks...
        gameState.loadedChunks = _manageChunks(
            gameState.level, gameState.camera, gameState.loadedChunks, 
            gameState.blockTypes, gameState.entityTypes, gameState.sprites
        );
        gameState.chunkLookup = _buildChunkLookup(gameState.loadedChunks);
        
        if("postUpdate" in callbacks) callbacks.postUpdate(timeStep, gameState);
    }
    
    function draw(canvas, painter, gameState) {
        // Clear the canvas...
        painter.fillStyle = "white"
        painter.fillRect(0, 0, canvas.width, canvas.height);
        
        if("preDraw" in callbacks) {
            if(callbacks.preDraw(canvas, painter, gameState)) return;
        }
        
        // Draw all entities/blocks...
        for(let [cx, cy, chunk] of gameState.loadedChunks) {
            for(let blockCol of chunk.blocks) {
                for(let block of blockCol) {
                    if(block != null) block.draw(gameState.canvas, gameState.painter, gameState.camera);
                }
            }
            
            for(let entity of chunk.entities) {
                entity.draw(gameState.canvas, gameState.painter, gameState.camera);
            }
        }
        // Draw the player...
        gameState.__player.draw(gameState.canvas, gameState.painter, gameState.camera);
        
        if("postDraw" in callbacks) callbacks.postDraw(canvas, painter, gameState);
    }
    
    this.makeBaseGame(gameLoop, gameState, levelData, (minPixelsShown != null)? minPixelsShown: 10 * 32);
}
