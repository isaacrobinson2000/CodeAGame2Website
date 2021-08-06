// Print to notebook cell output...
let elem_proto = Object.getPrototypeOf(element);

elem_proto.println = function(obj){
    this.append(((obj === undefined)? "": obj) + "<br>\n");
};

elem_proto.print = function(obj){
    this.append((obj === undefined)? "": obj);
};

// canvas.getBoundingClientRect() 
// window.requestAnimationFrame
elem_proto.getCanvasAndPainter = function(width, height, stretch = true, heightStretch = false) {
    let canvStyle = (stretch)? ((heightStretch)? " style='height: 75vh;'": " style='width: 100%;'"): " style='margin-right: auto; margin-left: auto; display: block;'";
    let jqCanvas = $.parseHTML("<canvas width='" + width + "' height='" + height +  "'" + canvStyle + ">");
    
    let painter = jqCanvas[0].getContext("2d");
    painter.imageSmoothingEnabled = false;
    
    this.append(jqCanvas);
    
    return [jqCanvas[0], painter];
};

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


let _kernel = IPython.notebook.kernel;

function runPython(code) {
    return new Promise(function(resolve, reject) {
        let callbacks = {
            shell: {
                reply: (data) => {
                    if(data.content.status == "ok") {
                        resolve(data);
                    }
                    else if(data.content.status == "error") {
                        reject(data.content.ename + ": " + data.content.evalue);
                    }
                    else {
                        reject("Unkown Error!")
                    }
                }
            }
        }
        
        _kernel.execute(code, callbacks);
    });
}

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
        
        // We got 0 / 0 or NaN, that means indeterminate. (Were not sure either way...)
        // I just go with 1, meaning all other in-frame collisions are resolved first, then this collision is checked...
        if(t != t) t = 1;
        
        let res = pt[ax] + dvec[ax] * t;
        let res2 = pt2[ax] + dvec2[ax] * t;
        let overlapLoc = pt[opAx] + dvec[opAx] * t;
        
        // Check if borders overlap...
        if((res + len < res2) || (res2 + len2 < res)) return [Infinity, 0, null];
        
        if((!ignoreT) && (t > 1 || t < -5)) return [Infinity, 0, null];
        
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
    
    __getFullCollisionBox() {
        let [x, y, w, h] = this.getHitBox();
        return [
            Math.min(x, this.___px), 
            Math.min(y, this.___py),
            w + Math.abs(x - this.___px),
            h + Math.abs(y - this.___py)
        ]
    }
    
    __getDisplacementVector() {
        return [this.x - this.___px, this.y - this.___py];
    }
    
    handleCollisions(obj, side) {}
    
    isSolid(obj, side) {
        return true;
    }
    
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
                let [time, overlap, bound] = this.__intersection(thisSides[i], [dx, dy], oSides[i], [dx2, dy2], true);

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
        let [sdx, sdy] = this.__getDisplacementVector().map((e) => Math.sign(e));

        let cX = x - ((sign + 1) * width / 2);
        let cY = y - ((sign + 1) * height / 2);
        this.x = (ax == 0 || sdx != sign)? this.x: cX;
        this.y = (ax == 1 || sdy != sign)? this.y: cY;
        
        this._vx *= (ax == 1 && Math.sign(this._vx) == sign)? !this.___covered[1]: 1;
        this._vy *= (ax == 0 && Math.sign(this._vy) == sign)? !this.___covered[0]: 1;
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
            let snames = GameCollisionObject.sideNames;
            
            // Move both objects....
            if(obj.isSolid(otherObj, sideNames[sideSwap[boundIdx]]) && otherObj.isSolid(obj, sideNames[boundIdx])) {
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

function _saveLevelCode(filename, levelData) {
    const LEVEL_EDIT_CODE = `
    import base64
    from pathlib import Path
    
    p = Path(base64.decodebytes(b"${btoa(filename)}").decode())
    data = base64.decodebytes(b"${btoa(levelData)}")
    
    with p.open("wb") as f:
        f.write(data)
    `;
    
    return LEVEL_EDIT_CODE;
}

elem_proto.levelEditor = async function(levelPath, blockTypes = [], entityTypes = [], levelData = {}, playerType = null, callbacks = {}) {
    let level;
    try {
        level = (levelPath == null)? _makeEmptyLevel(): await loadJSON(levelPath);
    } catch(exp) {
        level = _makeEmptyLevel();
    }
    
    let cameraVelocity = 8 / 10000; // In screen quantile per millisecond...
    let cameraMaxZoomIn = 200;
    let cameraMaxZoomOut = 3000;
    let cameraScaleSpeed = 0.6; // In pixels per millisecond...
    
    async function _saveLevel(banner, filename, levelData) {
        try {
            let result = await runPython(_saveLevelCode(filename, JSON.stringify(levelData, null, 4)));
            banner.setText("Saved Successfully.", 1500);
        } catch(exp) {
            banner.setText(exp, 3000);
        }
    }
    
    function _deleteBlock(blockX, blockY, loadedChunk, chunkSize) {
        blockX = Math.floor(blockX % chunkSize);
        blockY = Math.floor(blockY % chunkSize);
        
        loadedChunk.blocks[blockX][blockY] = null;
    }
    
    function _addBlock(blockX, blockY, loadedChunk, chunkSize, blockSize, blockClass, sprites) {
        let cBlockX = Math.floor(blockX % chunkSize);
        let cBlockY = Math.floor(blockY % chunkSize);
                                
        loadedChunk.blocks[cBlockX][cBlockY] = new blockClass(Math.floor(blockX), Math.floor(blockY), blockSize, sprites);
    }
    
    function _deleteEntity(blockX, blockY, loadedChunk, chunkSize) {
        for(let i = 0; i < loadedChunk.entities.length; i++) {
            let entity = loadedChunk.entities[i];
            
            let [x, y, w, h] = entity.getHitBox();
            if((blockX > x) && (blockY > y) && (blockX < x + w) && (blockY < y + h)) {
                _popAndSwapWithEnd(loadedChunk.entities, i);
                return;
            }
        }
    }
    
    function _addEntity(blockX, blockY, loadedChunk, chunkSize, blockSize, entityClass, sprites) {
        loadedChunk.entities.push(new entityClass(blockX, blockY, blockSize, sprites));
    }
    
    function _setPlayer(blockX, blockY, gameState, playerType, blockSize, sprites) {
        if(playerType != null) {
            gameState.level.player = new playerType(blockX, blockY, blockSize, sprites);
        }
    }
    
    class BannerDisplay {
        constructor(gameState) {
            this._g = gameState;
            this._text = "";
            this._timeLeft = 0;
            this._style = null;
            this._color = null;
        }
        
        setText(text = "", time = 3000, color = "black", style = "30px Arial") {
            this._text = text;
            this._timeLeft = time;
            this._style = style;
            this._color = color;
        }
        
        update(timeStep) {
            this._timeLeft = Math.max(0, this._timeLeft - timeStep);
        }
        
        draw() {
            if(this._timeLeft > 0) {
                let {width, height} = this._g.canvas;
                
                this._g.painter.fillStyle = this._color;
                this._g.painter.font = this._style;
                this._g.painter.textAlign = "center";
                
                this._g.painter.fillText(this._text, width / 2, height / 2);
            }
        }
    }
    
    class GameHoverBlock extends GameObject {
        constructor(x, y, blockSize, sprites) {
            super(x, y, blockSize, sprites);
            this._sprite = sprites["_levelEditHover"].buildSprite();
            this._sprite.setAnimation("main");
            this._numChunks = null;
            this._chunkSize = null;
        }
        
        update(timeStep, gameState) {
            if(this._numChunks == null) {
                this._numChunks = gameState.level.numChunks;
                this._chunkSize = gameState.level.chunkSize;
            }
            
            [this.x, this.y] = gameState.camera.reverseTransform(gameState.mouseLocation);
            this.x = this.x / this._blockSize;
            this.y = this.y / this._blockSize;

            this._sprite.update(timeStep);
        }
        
        getBlockLocation() {
            let [x, y] = [this.x, this.y];
            
            if((x < 0) || (x >= this._numChunks[0] * this._chunkSize)) return [null, null];
            if((y < 0) || (y >= this._numChunks[1] * this._chunkSize)) return [null, null];
            
            return [x, y];
        }
        
        draw(canvas, painter, camera) {
            let [x, y, w, h] = camera.transformBox([Math.floor(this.x) * this._blockSize, Math.floor(this.y) * this._blockSize, this._blockSize, this._blockSize]);
            this._sprite.draw(painter, x, y, w, h);
        }
    }
    
    class GameSelectPanel extends GameObject {
        constructor(x, y, blockSize, sprites) {
            super(x, y, blockSize, sprites);
            this._deleteSprite = sprites["_levelEditDelete"].buildSprite();
            this._itemSize = blockSize;
            this._hovered = null;
            this._selected = null;
            this._blocks = null;
            this._entities = null;
            this._sprites = sprites;
            this._width = 0;
            this._overbar = false;
            this._playerType = null;
        }
        
        _grabSelection(tileX, tileY, entityLen, blockLen) {
            switch(tileY) {
                case 0:
                    return ((tileX >= 0) && (tileX < entityLen + 2))? ["entity", tileX - 2]: null;
                case 1:
                    return ((tileX >= 0) && (tileX < blockLen + 1))? ["block", tileX - 1]: null;
            }
            
            return null;
        }
        
        update(timeStep, gameState) {            
            if(this._blocks == null) {
                this._blocks = _gameObjMappingToList(gameState.blockTypes);
                this._entities = _gameObjMappingToList(gameState.entityTypes);
                this._lookupObj = {
                    "entity": this._entities,
                    "block": this._blocks
                }
                this._playerType = gameState.playerType;
            }
            
            let [x, y, w, h] = gameState.camera.getBounds();
            
            [this._x, this._y] = [x, y];
            this._width = w;
            
            this._itemSize = Math.min(w / (this._blocks.length + 1), this._blockSize, w / (this._entities.length + 2));
            
            let [mx, my] = gameState.camera.reverseTransform(gameState.mouseLocation);
            let [tileX, tileY] = [Math.floor((mx - x) / this._itemSize), Math.floor((my - y) / this._itemSize)];
            
            this._overbar = tileY < 2 && tileY >= 0;
            this._hovered = this._grabSelection(tileX, tileY, this._entities.length, this._blocks.length);

            if(gameState.mousePressed && this._hovered != null) {
                this._selected = this._hovered;
            }

            this._deleteSprite.update(timeStep);
        }
        
        getOverBar() {
            return this._overbar;
        }
        
        getSelection() {
            return (this._selected != null)? [this._selected[0], (this._selected[1] >= 0)? this._lookupObj[this._selected[0]][this._selected[1]]: this._selected[1]]: null;
        }
        
        draw(canvas, painter, camera) {
            if("preDraw" in callbacks) callbacks.preDraw(canvas, painter, camera);
            
            painter.fillStyle = "#dbdbdb";
            let [x, y, width, height] = camera.transformBox([this._x, this._y, this._width, this._itemSize * 2]);
            let step = height / 2;
            
            painter.fillRect(x, y, width, height);
            
            this._deleteSprite.draw(painter, x, y, step, step);
            if(this._playerType != null) {
                (new this._playerType(0, 0, step, this._sprites)).drawPreview(canvas, painter, [x + step, y, step, step]);
            }
            this._deleteSprite.draw(painter, x, y + step, step, step);
            for(let i = 0; i < this._entities.length; i++) {
                (new this._entities[i](x + step * (i + 2), y, step, this._sprites)).drawPreview(canvas, painter, [x + step * (i + 2), y, step, step]);
            }
            for(let i = 0; i < this._blocks.length; i++) {
                (new this._blocks[i](x + step * (i + 1), y + step, step, this._sprites)).drawPreview(canvas, painter, [x + step * (i + 1), y + step, step, step]);
            }
            
            // Hover object....
            if(this._hovered != null) {
                painter.fillStyle = "rgba(46, 187, 230, 0.5)";
                let [idxOff, yOff] = (this._hovered[0] == "block")? [1, step]: [2, 0];
                painter.fillRect(x + (this._hovered[1] + idxOff) * step, (this._hovered[0] == "block")? y + yOff: y, step, step);
            }
            
            // Selected Object...
            if(this._selected != null) {
                painter.fillStyle = "rgba(27, 145, 181, 0.7)";
                let [idxOff, yOff] = (this._selected[0] == "block")? [1, step]: [2, 0];
                painter.fillRect(x + (this._selected[1] + idxOff) * step, (this._selected[0] == "block")? y + yOff: y, step, step);
            }
            
            if("postDraw" in callbacks) callbacks.postDraw(canvas, painter, camera);
        }
    }
    
    class ActionBar extends GameObject {
        constructor(x, y, blockSize, sprites) {
            super(x, y, blockSize, sprites);
            this._sprites = [sprites["_levelEditSave"].buildSprite(), sprites["_levelEditHitbox"].buildSprite()];
            this._action = ["save", "hitbox"];
            this._itemSize = blockSize;
            this._wasPressed = false;
            this._hovered = null;
            this._clicked = true;
            this._overbar = false;
            this._x = null;
            this._y = null;
        }
        
        update(timeStep, gameState) {
            this._clicked = false;
            
            let [cx, cy] = gameState.camera.reverseTransform(gameState.mouseLocation);
            let [gx, gy, gw, gh] = gameState.camera.getBounds();
            [this._x, this._y] = [gx, gy + gh];
            
            let overObj = Math.floor((cx - gx) / this._itemSize);
            this._hovered = ((cy >= ((gy + gh - this._itemSize)) && (overObj < this._action.length)))? overObj: null;
            this._overbar = this._hovered != null
            this._clicked = this._overbar && this._wasPressed && !gameState.mousePressed;
            
            this._wasPressed = gameState.mousePressed;
        }
        
        getOverBar() {
            return this._overbar;
        }
        
        getClicked() {
            return (this._clicked)? this._action[this._hovered]: null; 
        }
        
        draw(canvas, painter, camera) {            
            for(let i = 0; i < this._sprites.length; i++) {
                let [x, y, w, h] = camera.transformBox(
                    [this._x + i * this._itemSize, this._y - this._itemSize, this._itemSize, this._itemSize]
                );
                
                painter.fillStyle = "white";
                painter.fillRect(x, y, w, h);
                
                this._sprites[i].draw(painter, x, y, w, h);
                
                if(this._hovered == i) {
                    painter.fillStyle = "rgba(46, 187, 230, 0.5)";
                    painter.fillRect(x, y, w, h);
                }
            }
        }
    }
    
    function update(timeStep, gameState) {
        let keys = gameState.keysPressed;
        let c = gameState.camera;
        let [cx, cy] = c.getCenterPoint();
        let cZoomStep = cameraScaleSpeed * timeStep;
        
        
        if("Minus" in keys) gameState.camera.setMinimumPixelsShown(Math.min(cameraMaxZoomOut, gameState.camera.getMinimumPixelsShown() + cZoomStep));
        if("Equal" in keys) gameState.camera.setMinimumPixelsShown(Math.max(cameraMaxZoomIn, gameState.camera.getMinimumPixelsShown() - cZoomStep));
        
        let stepAmt = cameraVelocity * timeStep * gameState.camera.getMinimumPixelsShown();
            
        if("ArrowUp" in keys || "KeyW" in keys) cy -= stepAmt;
        if("ArrowDown" in keys || "KeyS" in keys) cy += stepAmt;
        if("ArrowLeft" in keys || "KeyA" in keys) cx -= stepAmt;
        if("ArrowRight" in keys || "KeyD" in keys) cx += stepAmt;
        
        c.setCenterPoint([cx, cy]);
        c.update(level.numChunks.map((v) => v * level.chunkSize * level.blockSize));
        
        gameState.__levelHoverIndicator.update(timeStep, gameState);
        gameState.__levelSelectorBar.update(timeStep, gameState);
        gameState.__levelActionBar.update(timeStep, gameState);
        gameState.__levelDisplayBanner.update(timeStep);
        
        gameState.loadedChunks = _manageChunks(
            level, gameState.camera, gameState.loadedChunks, 
            gameState.blockTypes, gameState.entityTypes, 
            gameState.sprites
        );
        
        // We check if user has clicked a location with a item in the toolbar selected...
        let [selLocX, selLocY] = gameState.__levelHoverIndicator.getBlockLocation();
        let blockLoc = [Math.floor(selLocX), Math.floor(selLocY)];
        let selection = gameState.__levelSelectorBar.getSelection();
        if(
            (!gameState.clickWasDown || (gameState.lastBlockLocation.join() != blockLoc.join())) 
            && !gameState.__levelSelectorBar.getOverBar() && (selection != null) 
            && (selLocX != null) && gameState.mousePressed
            && !gameState.__levelActionBar.getOverBar()
        ) {
            let chunk = _findChunk(Math.floor(selLocX / level.chunkSize), Math.floor(selLocY / level.chunkSize), gameState.loadedChunks);
            if(chunk != null) {
                switch(selection[0]) {
                    case "block":
                        if(selection[1] != -1) {
                            _addBlock(selLocX, selLocY, chunk, level.chunkSize, level.blockSize, selection[1], gameState.sprites);
                        }
                        else {
                            _deleteBlock(selLocX, selLocY, chunk, level.chunkSize);
                        }
                        break;
                    case "entity":
                        switch(selection[1]) {
                            case -2:
                                _deleteEntity(selLocX, selLocY, chunk, level.chunkSize);
                                break;
                            case -1:
                                _setPlayer(selLocX, selLocY, gameState, gameState.playerType, level.blockSize, gameState.sprites);
                                break;
                            default: 
                                _addEntity(selLocX, selLocY, chunk, level.chunkSize, level.blockSize, selection[1], gameState.sprites);
                        }
                        break;
                }
            }
        }
        
        switch(gameState.__levelActionBar.getClicked()) {
            case "save":
                gameState.__levelDisplayBanner.setText("Saving Results!", Infinity);
                _flushLoadedChunks(level, gameState.loadedChunks);
                _saveLevel(gameState.__levelDisplayBanner, levelPath, level);
                break;
            case "hitbox":
                gameState.__levelShowHitboxes = !gameState.__levelShowHitboxes;
                gameState.__levelDisplayBanner.setText("Toggling Hitboxes " + ((gameState.__levelShowHitboxes)? "On": "Off"), 1000);
                break;
        }
        
        gameState.lastBlockLocation = blockLoc;
        gameState.clickWasDown = gameState.mousePressed;
    }
    
    function draw(canvas, painter, gameState) {    
        // Clear the canvas...
        painter.fillStyle = "white"
        painter.fillRect(0, 0, canvas.width, canvas.height);
        
        for(let [x, y, chunk] of gameState.loadedChunks) {
            for(let bx = 0; bx < chunk.blocks.length; bx++) {
                let blockCol = chunk.blocks[bx];
                
                for(let by = 0; by < blockCol.length; by++) {
                    let block = blockCol[by];
                    
                    let gx = x * level.chunkSize * level.blockSize + bx * level.blockSize;
                    let gy = y * level.chunkSize * level.blockSize + by * level.blockSize;
                    
                    let [canvX, canvY, canvW, canvH] = gameState.camera.transformBox([gx, gy, level.blockSize, level.blockSize]);
                    
                    painter.strokeStyle = "black";
                    painter.strokeRect(canvX, canvY, canvW, canvH);
                    
                    if(block != null) block.draw(canvas, painter, gameState.camera);
                }
            }
            
            for(let entity of chunk.entities) {
                entity.draw(canvas, painter, gameState.camera);
                
                if(gameState.__levelShowHitboxes) {
                    painter.strokeStyle = "red";
                    painter.strokeRect(...gameState.camera.transformBox(entity.getHitBox().map((val) => val * level.blockSize)));
                }
            }
        }
        
        if(gameState.level.player != null) {
            gameState.level.player.draw(canvas, painter, gameState.camera);
            
            if(gameState.__levelShowHitboxes) {
                painter.strokeStyle = "red";
                painter.strokeRect(...gameState.camera.transformBox(gameState.level.player.getHitBox().map((val) => val * level.blockSize)));
            }
        }
        
        let [selLocX, selLocY] = gameState.__levelHoverIndicator.getBlockLocation();
        if(
            (selLocX != null) && !gameState.__levelSelectorBar.getOverBar() 
            && !gameState.__levelActionBar.getOverBar() 
            && gameState.__levelHoverIndicator.getLocation()
        ) {
            gameState.__levelHoverIndicator.draw(canvas, painter, gameState.camera);
        }
        
        gameState.__levelSelectorBar.draw(canvas, painter, gameState.camera);
        gameState.__levelActionBar.draw(canvas, painter, gameState.camera);
        
        gameState.__levelDisplayBanner.draw();
    }
    
    function gameLoop(timeStep, gameState) {
        if(gameState.__levelHoverIndicator == null) {
            gameState.__levelHoverIndicator = new GameHoverBlock(0, 0, level.blockSize, gameState.sprites);
            gameState.__levelSelectorBar = new GameSelectPanel(0, 0, level.blockSize, gameState.sprites);
            gameState.__levelActionBar = new ActionBar(0, 0, level.blockSize, gameState.sprites);
            gameState.__levelDisplayBanner = new BannerDisplay(gameState);
            gameState.level = level;
            if(gameState.level.player != null) {
                gameState.level.player = (gameState.playerType != null)? gameState.playerType.fromJSON(gameState.level.player, gameState.level.blockSize, gameState.sprites): null;
            }
        }
        
        update(timeStep, gameState);
        draw(gameState.canvas, gameState.painter, gameState);
    }
    
    let gameState = {};
    gameState.entityTypes = _gameObjListToMapping(entityTypes);
    gameState.blockTypes = _gameObjListToMapping(blockTypes);
    gameState.loadedChunks = [];
    gameState.lastBlockLocation = null;
    gameState.clickWasDown = false;
    gameState.playerType = playerType;
    gameState.__levelShowHitboxes = false;
    
    let data = {...levelData};
    
    let levelEditSprites = {
        "_levelEditHover": {
            "image": "levelEdit/hover.png",
            "animations": {
                "main": {
                    "speed": 150
                }
            }
        },
        "_levelEditDelete": {
            "image": "levelEdit/deleteSelected.png",
        },
        "_levelEditSave": {
            "image": "levelEdit/save.png"
        },
        "_levelEditHitbox": {
            "image": "levelEdit/hitbox.png"
        }
    }
    data.sprites = (data.sprites != null)? {...data.sprites, ...levelEditSprites}: levelEditSprites;
    
    this.makeBaseGame(gameLoop, gameState, data);
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
        
        let lvl = gameState.level;
        gameState.__player = gameState.playerType.fromJSON(lvl.player, lvl.blockSize, gameState.sprites);
        gameState.camera.setTrackedObject(gameState.__player);
        
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
                
                if(!("__getFullCollisionBox" in entity1)) continue;
                
                let [x1, y1, w1, h1] = entity1.__getFullCollisionBox();
                
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
                        
                        if((block != null) && ("__getFullCollisionBox" in block)) {
                            // If block is not null, perform collision check with entity...
                            let [x2, y2, w2, h2] = block.__getFullCollisionBox();
                            
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
                        
                        if(!("__getFullCollisionBox" in entity2)) continue;
                        let [x2, y2, w2, h2] = entity2.__getFullCollisionBox();
                        
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
