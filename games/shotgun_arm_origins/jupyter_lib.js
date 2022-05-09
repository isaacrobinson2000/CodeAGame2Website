// Print to notebook cell output...
let elem_proto = null;

try {
    elem_proto = Object.getPrototypeOf(element);
} catch(exp) {
    let element = {};
    elem_proto = element;
    window.element = element;
}

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

let fdiv = (x, y) => Math.floor(x / y);

// Sound files...

/**
 * Represents game audio. Can be used to play sounds in game
 */
class Sound {
    /**
     * Creates a new sound element for playing a sound effect...
     * 
     * @param soundSrc: The path to the sound file.
     * @param background: If true, this sound is considered background music and will be auto played on construction 
     *                    and whenever music is unmuted...
     */
    constructor(soundSrc, background, volume = 1) {
        this.soundElm = new Audio(soundSrc);
        this.soundElm.src = soundSrc;
        this.soundElm.setAttribute("controls", "none");
        this.soundElm.style.display = "none";
        Sound.ALL_SOUNDS.push(this);
        
        this.soundElm.volume = volume
        
        // If background music immediately start playing it...
        if(background) {
            this.background = true;
            this.soundElm.loop = true;
        }
        else {
            this.background = false;
        }
    }

    /**
     * Set the volume of the audio...
     * 
     * @param value: A float between 0 and 1, 1 being max volume and 0 being no volume...
     */
    setVolume(value) {
        this.soundElm.volume = value;
    }

    /**
     * Get the volume of this sound effect.
     * 
     * @returns {number}: Float between 0 and 1 representing the volume of this sound when played...
     */
    getVolume() {
        return this.soundElm.volume;
    }

    /**
     * Play the sound effect...
     */
    play() {
        if(!Sound.MUTED) {
            this.soundElm.play();
        }
    }
    
    /**
     * Pause the desired sound effect...
     */
    pause() {
        this.soundElm.pause();
    }
    
    /**
     * Stop the sound effect...
     */
    stop() {
        this.soundElm.pause();
        if(!this.background) this.soundElm.currentTime = 0;
    }
    
    /**
     * Get the current time of the sound being played...
     */
    getTime() {
        return this.soundElm.currentTime;
    }
    
    /**
     * Set the current time of the sound being played...
     */
    setTime(value) {
        this.soundElm.currentTime = value;
    }

    /**
     * Mute all sound effects, stopping them immediately...
     */
    static muteAll() {
        this.MUTED = true;
        for(let i = 0; i < this.ALL_SOUNDS.length; i++) {
            this.ALL_SOUNDS[i].stop();
        }
    }
    
    /**
     * Unmute all sound effects, starting them if they are background music...
     */
    static unmuteAll() {
        this.MUTED = false;
        for(let i = 0; i < this.ALL_SOUNDS.length; i++) {
            if(this.ALL_SOUNDS[i].background) this.ALL_SOUNDS[i].play();
        }
    }

    /**
     * Mutes all background music... Use unmute to restart background music...
     */
    static muteAllBackground() {
        for(let i = 0; i < this.ALL_SOUNDS.length; i++) {
            if(this.ALL_SOUNDS[i].background) this.ALL_SOUNDS[i].stop();
        }
    }
}

// Firefox doesn't support static variables yet, so have to do dumb hack to do class global variables...
Sound.MUTED = false;
Sound.ALL_SOUNDS = [];

window.Sound = Sound;

async function getSoundBuilder(sndConfig) {
    return {
        _source: sndConfig.source,
        _background: !!sndConfig.background,
        _volume: +(sndConfig.volume ?? 1),
        buildSound: function() {
            return new Sound(this._source, this._background, this._volume)
        }
    };
}


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
        this._inset = [0, 0, this._width, this._height];
        
        this._index = 0;
        this._accumulator = 0;
        
        this._horiz_flip = false;
        this._vert_flip = false;
    }
    
    setAnimation(animationName) {
        if(animationName === this._selected) return;
        
        this._selected = ((animationName == null) || !(animationName in this._animations))? null: animationName;
        
        let anim = (this._selected != null)? this._animations[this._selected]: {};
        
        // Update properties...
        this._speed = ((anim.speed == null) || (anim.speed < 1))? 16: anim.speed;
        this._frames = anim.frames ?? range(0, this._numImages);
        this._cycles = ((anim.cycles == null) || (anim.cycles < 0))? Infinity: anim.cycles;
        this._inset = ((Array.isArray(anim.inset)) && (anim.inset.length == 4))? anim.inset: [0, 0, this._width, this._height];
        
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
    
    isVerticallyFlipped() {
        return this._vert_flip;
    }
    
    isHorizontallyFlipped() {
        return this._horiz_flip;
    }
    
    setVerticalFlip(value) {
        this._vert_flip = !!(value);
    }
    
    setHorizontalFlip(value) {
        this._horiz_flip = !!(value);
    }
    
    get width() {
        return this._width;
    }
    
    get height() {
        return this._height;
    }
    
    get cycles() {
        return this._cycles;
    }
    
    get inset() {
        return this._inset;
    }
    
    get frames() {
        return this._frames;
    }
    
    get speed() {
        return this._speed;
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
        
        let outsetW = (this._width / this._inset[2]) * width;
        let outsetH = (this._height / this._inset[3]) * height;
        let backX = (this._inset[0] / this._width) * outsetW;
        let backY = (this._inset[1] / this._height) * outsetH;
        
        ctx.save();
        ctx.translate(
            Math.round((this._horiz_flip)? x + width + backX: x - backX), 
            Math.round((this._vert_flip)? y + height + backY: y - backY)
        );
        ctx.scale(this._horiz_flip? -1: 1, this._vert_flip? -1: 1);
        ctx.drawImage(this._img, xin, 0, this._width, this._height, 0, 0, Math.round(outsetW), Math.round(outsetH));
        ctx.restore();
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

function _adjustTrackBox(trackBox, hitBox) {
    let [x, y, w, h] = hitBox;
    let cx = x + w / 2;
    let cy = y + h / 2;
                        
    // Move x coordinate of tracking box over the tracked object.
    if(cx < trackBox[0]) trackBox[0] = cx;
    else if(cx > (trackBox[0] + trackBox[2])) trackBox[0] = cx - trackBox[2];
    // Move y coordinate also...
    if(cy < trackBox[1]) trackBox[1] = cy;
    else if(cy > (trackBox[1] + trackBox[3])) trackBox[1] = cy - trackBox[3];
}

function _computeTrackedExtents(tracks) {
    let txMin = Infinity,
        tyMin = Infinity,
        txMax = -Infinity,
        tyMax = -Infinity;
    
    for(let track of tracks) {
        if(!("getBoundingBox" in track)) continue;
        let [bx, by, bw, bh] = track.getBoundingBox();
        let xCenter = bx + bw / 2;
        let yCenter = by + bh / 2;
        
        txMin = Math.min(txMin, xCenter);
        tyMin = Math.min(tyMin, yCenter);
        txMax = Math.max(txMax, xCenter);
        tyMax = Math.max(tyMax, yCenter);
    }
    
    return [txMin, tyMin, txMax - txMin, tyMax - tyMin];
}

function _adjustZoomFactor(trackBox, zoom, zoomMultCap, trackExtents) {
    let newZoomFactor = _bound(Math.max(trackExtents[2] / trackBox[2], trackExtents[3] / trackBox[3]), 1, zoomMultCap);
    if(newZoomFactor != newZoomFactor) return [zoom, trackBox];
    let [centX, centY] = [trackBox[0] + trackBox[2] / 2, trackBox[1] + trackBox[3] / 2];
    
    return [
        zoom / newZoomFactor,
        [
            centX - (trackBox[2] / 2) / newZoomFactor, 
            centY - (trackBox[3] / 2) / newZoomFactor, 
            trackBox[2] / newZoomFactor, 
            trackBox[3] / newZoomFactor
        ]
    ]
}

class Camera {
    constructor(canvas, blockSize, minBlocksShown, maxBlocksShown, maxZoomAdjustment = 1.5, trackBox = [1/3, 1/3, 1/3, 1/3], subCanvasBox = [0, 0, 1, 1]) {
        this._canvas = canvas;
        this._blockSize = blockSize;
        this._minBlocksShown = minBlocksShown;
        this._maxBlocksShown = maxBlocksShown;
        this._zoom = 1;
        this._tracks = [];
        this._centerPoint = [0, 0];
        this._trackBox = trackBox;
        this._subBox = subCanvasBox;
        this._maxZoomAdjustment = maxZoomAdjustment;
    }
    
    setTrackBox(trackBox) {
        this._trackBox = trackBox;
    }
    
    getTrackBox() {
        return this._trackBox;
    }
    
    setCenterPoint(cp) {
        this._centerPoint = [cp[0], cp[1]];
    }
    
    getCenterPoint() {
        return this._centerPoint;
    }
    
    setTracks(track) {
        this._tracks = track;
    }
    
    getTracks() {
        return this._tracks;
    }
    
    setSubCanvasBox(box) {
        this._subBox = box;
    }
    
    getSubCanvasBox() {
        return this._subBox;
    }
    
    getDisplayZone() {
        let [mx, my, mw, mh] = this._subBox;
        let cw = this._canvas.width;
        let ch = this._canvas.height;
        
        return [
            mx * cw,
            my * ch,
            mw * cw,
            mh * ch
        ];
    }
    
    getMinimumPixelsShown() {
        return this._minPixelsShown;
    }
    
    setMinimumPixelsShown(value) {
        this._minPixelsShown = value;
    }
    
    getMinimumBlocksShown() {
        return this._minBlocksShown;
    }
    
    setMinimumBlocksShown(value) {
        return this._minBlocksShown = value;
    }
    
    getMaximumBlocksShown() {
        return this._maxBlocksShown;
    }
    
    setMaximumBlocksShown(value) {
        return this._maxBlocksShown = value;
    }
    
    getMaxZoomAdjustment() {
        return this._maxZoomAdjustment;
    }
    
    setMaxZoomAdjustment(value) {
        this._maxZoomAdjustment = +value;
    }
    
    update(levelBounds) {
        let [canvX, canvY, canvW, canvH] = this.getDisplayZone();
        let minCanvasSide = Math.min(canvW, canvH);
        let maxCanvasSide = Math.max(canvW, canvH);
        this._zoom = Math.max(minCanvasSide / this._minBlocksShown, maxCanvasSide / this._maxBlocksShown);
        
        // Get the current track box...
        let [cx, cy, cw, ch] = this.getBounds();
        let [centX, centY] = this._centerPoint;
        let trackBox = [
            centX - (0.5 - this._trackBox[0]) * cw, 
            centY - (0.5 - this._trackBox[1]) * ch, 
            this._trackBox[2] * cw,
            this._trackBox[3] * ch
        ];
                
        // Adjust the tracking box using currently tracked objects (if there are any)...
        if((this._tracks.length > 0)) {
            let firstObject = null;
            
            let trackedExtents = _computeTrackedExtents(this._tracks);            
            [this._zoom, trackBox] = _adjustZoomFactor(trackBox, this._zoom, this._maxZoomAdjustment, trackedExtents);
            
            for(let i = this._tracks.length - 1; i >= 0; i--) {
                let elem = this._tracks[i];
                if(!("getBoundingBox" in elem)) continue;
                let hitBox = elem.getBoundingBox();
                _adjustTrackBox(trackBox, hitBox);
            }
        }
        
        [cx, cy, cw, ch] = this.getBounds();
        this._centerPoint = [trackBox[0] + (0.5 - this._trackBox[0]) * cw, trackBox[1] + (0.5 - this._trackBox[1]) * ch];
            
        // Bound the camera based on the level bounds...
        [cx, cy, cw, ch] = this.getBounds();
        let [xOut, yOut] = [this._centerPoint[0] - cx, this._centerPoint[1] - cy];
        let [newCx, newCy] = [_bound(cx, 0, levelBounds[0] - cw), _bound(cy, 0, levelBounds[1] - ch)];
        this._centerPoint = [newCx + xOut, newCy + yOut];
    }
    
    getBounds() {
        let [cx, cy] = this._centerPoint;
        let w = (this._canvas.width * this._subBox[2]) / this._zoom;
        let h = (this._canvas.height * this._subBox[3]) / this._zoom;
        
        return [cx - w / 2, cy - h / 2, w, h];
    }
    
    transform(point) {
        let [x, y] = point;
        
        let [xp, yp, wp, hp] = this.getSubCanvasBox();
        let [gx, gy, gw, gh] = this.getBounds();
        let cx = this._canvas.width * xp;
        let cy = this._canvas.height * yp;
        let cw = this._canvas.width * wp;
        let ch = this._canvas.height * hp;
        
        return [
            ((x - gx) / gw) * cw + cx, 
            ((y - gy) / gh) * ch + cy
        ];
    }
    
    transformBox(box) {
        let [x, y, w, h] = box;
        
        let [p1x, p1y] = this.transform([x, y]);
        let [p2x, p2y] = this.transform([x + w, y + h]);
        
        return [p1x, p1y, p2x - p1x, p2y - p1y];
    }
    
    reverseTransform(point) {
        let [x, y] = point;
        
        let [xp, yp, wp, hp] = this.getSubCanvasBox();
        let [gx, gy, gw, gh] = this.getBounds();
        let cx = this._canvas.width * xp;
        let cy = this._canvas.height * yp;
        let cw = this._canvas.width * wp;
        let ch = this._canvas.height * hp;
        
        return [(((x - cx) / cw) * gw) + gx, (((y - cy) / ch) * gh) + gy];
    }
}

window.Camera = Camera;

elem_proto.makeBaseGame = async function(gameLoop, gameState = {}, assets = {}, zones = {}, levelGen = null) {
    let newDiv = $($.parseHTML("<div style='position: fixed; z-index: 300; top: 0; bottom: 0; left: 0; right: 0; background-color: white; overflow: clip; touch-action: none;'></div>"));
    let newCanvas = $($.parseHTML("<canvas style='width: 100%; height: 100%;'>Your browser doesn't support canvas!</canvas>"));
    let closeBtn = $($.parseHTML("<button style='position: absolute; top: 0; right: 0; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none;'>X</button>"));
    
    let loadDiv = $($.parseHTML("<div style='position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: transparent;'></div>"));
    let loadTxt = $($.parseHTML("<p style='font: 38px sans-serif; text-align: center;'>LOADING...</p>"));
    let loadBar = $($.parseHTML("<progress style='width: 100%;'></progress>"));
    loadDiv.append(loadTxt);
    loadDiv.append(loadBar);
        
    newDiv.append(newCanvas);
    newDiv.append(closeBtn);
    newDiv.append(loadDiv);
    
    $(document.body).append(newDiv);
    if(document.activeElement != document.body) document.activeElement.blur();
    
    gameState = {...gameState};
    
    gameState.lastTimeStamp = null;
    gameState.keepRunning = true;
    gameState.canvas = newCanvas[0];
    gameState.painter = gameState.canvas.getContext("2d");
    gameState.keysPressed = {};
    gameState.gamepads = [];
    gameState.mouse = {
        pressed: false,
        location: [0, 0]
    };
    gameState.paused = false;
    
    gameState.assets = {};
    gameState.assets.sprites = {};
    gameState.assets.sounds = {};
    gameState.assets.flags = assets.flags ?? {};
    gameState.zones = {};
    
    let doc = $(document);
    let win = $(window);
    
    // If the close button is clicked delete the div and terminate the game loop. Also reattach jupyter keyboard events.
    closeBtn.click(() => {
        newDiv.remove();
        gameState.keepRunning = false;
        doc.off(".gameloop");
        win.off(".gameloop");
        try {
            Jupyter.keyboard_manager.bind_events();
        } catch(e) {
            console.log(e);
        }
    });
    
    loadBar.prop("max", Object.keys(assets.sprites ?? {}).length + Object.keys(assets.sounds ?? {}).length + Object.keys(zones).length)
    
    for(let spriteName in (assets.sprites ?? {})) {
        try {
            gameState.assets.sprites[spriteName] = await getSpriteBuilder(assets.sprites[spriteName]);
            loadBar.prop("value", loadBar.prop("value") + 1);
        } catch(exp) {
            loadTxt.text("Error: Unable to load asset '" + spriteName + "', image '" + assets.sprites[spriteName].image + "' not found.");
            throw exp;
        }
    }
    
    for(let soundName in (assets.sounds ?? {})) {
        try {
            gameState.assets.sounds[soundName] = await getSoundBuilder(assets.sounds[soundName]);
            loadBar.prop("value", loadBar.prop("value") + 1);
        } catch(exp) {
            loadTxt.text("Error: Unable to load asset " + soundName + ", because '" + exp + "'");
            throw exp;
        }
    }
    
    for(let zoneName in zones) {
        try {
            gameState.zones[zoneName] = await getZoneBuilder(zones[zoneName]);
            loadBar.prop("value", loadBar.prop("value") + 1);
        } catch(exp) {
            if(levelGen == null) {
                loadTxt.text("Error: Unable to load zone " + zoneName + ", because '" + exp + "'");
                throw exp;
            }
            else {
                gameState.zones[zoneName] = await levelGen(zoneName, zones[zoneName]);
            }
        }
    }
        
    loadDiv.remove();
    
    function loopManager(timeStamp) {
        let {width, height} = gameState.canvas.getBoundingClientRect();
        
        gameState.canvas.width = width;
        gameState.canvas.height = height;
        
        gameState.painter.imageSmoothingEnabled = false; 
        gameState.painter.mozImageSmoothingEnabled = false; 
        gameState.painter.webkitImageSmoothingEnabled = false; 
        gameState.painter.msImageSmoothingEnabled = false; 
        
        if("getGamepads" in navigator) {
            gameState.gamepads = navigator.getGamepads();
        }
        
        if(gameState.paused) gameState.lastTimeStamp = null;
        
        let timeStep = (gameState.lastTimeStamp == null)? 0: timeStamp - gameState.lastTimeStamp;
        
        gameLoop(timeStep, gameState);
        
        gameState.lastTimeStamp = timeStamp;
                
        if(gameState.keepRunning) {
            window.requestAnimationFrame(loopManager);
        }
        else {
            Sound.muteAll();
            Sound.ALL_SOUNDS = [];
            Sound.unmuteAll();
        }
    };
    
    // Mouse support....
    newDiv.on("pointerdown", (e) => {
        gameState.mouse.location = [e.offsetX, e.offsetY];
        gameState.mouse.pressed = true;
        return false;
    });
    
    newDiv.on("pointermove", (e) => {
        gameState.mouse.location = [e.offsetX, e.offsetY];
    });
    
    newDiv.on("pointerup pointercancel", (e) => {
        gameState.mouse.location = [e.offsetX, e.offsetY];
        gameState.mouse.pressed = false;
        return false;
    });
    
    newDiv.on("contextmenu", false);
    
    closeBtn.on("pointerdown", false);
    closeBtn.on("pointermove", false);
    closeBtn.on("pointerup", false);
    
    // Manage keyboard events, keep track of pressed keys in special property in the gameState object.
    // We have to disable all other keyevents as jupyter notebook doesn't play nicely with keyboard input.
    doc.off("keydown");
    
    doc.on("keydown.gameloop", (event) => {
        gameState.keysPressed[event.code] = true;
    });
    
    doc.on("keyup.gameloop", (event) => {
        delete gameState.keysPressed[event.code];
    });

    win.on("blur.gameloop", (event) => {
        gameState.lastTimeStamp = null;
        gameState.paused = true;
        Sound.muteAll();
        // Manually run the game loop to allow the game to handle the pause...
        // This handles cases where the user has switched tabs, which causes the game loop to
        // pause execution immediately.
        gameLoop(0, gameState);
    });

    win.on("focus.gameloop", (event) => {
        gameState.paused = false;
        Sound.unmuteAll();
    });
    
    // Start the game loop.
    window.requestAnimationFrame(loopManager);
};


let _kernel;
try {
    _kernel = IPython.notebook.kernel;
} catch(exp) {}

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

function _makeEmptyLevel(width = 10, height = 10, chunkSize = 16) {
    let level = {
        "chunkSize": chunkSize,
        "numChunks": [width, height],
        "players": [],
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
    constructor(x, y, assets) {
        this.x = x;
        this.y = y;
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
    
    static fromJSON(data, assets) {
        let obj = new this(data.x, data.y, assets);
        
        for(let prop in data) {
            if(!prop.startsWith("_")) obj[prop] = data[prop];
        }
        
        return obj;
    }
    
    getHitBoxes() {
        return [
            [this.x, this.y, 1, 1]
        ];
    }
    
    getBoundingBox() {
        let minX = Infinity, 
            minY = Infinity, 
            maxX = -Infinity, 
            maxY = -Infinity;
        
        for(let [x, y, width, height] of this.getHitBoxes()) {
            minX = Math.min(x, minX);
            minY = Math.min(y, minY);
            maxX = Math.max(x + width, maxX);
            maxY = Math.max(y + height, maxY);
        }
        
        return [minX, minY, maxX - minX, maxY - minY];
    }
    
    getZOrder() {
        return 0;
    }
}

window.GameObject = GameObject;


class GameCollisionObject extends GameObject {
    
    constructor(x, y, assets) {
        super(x, y, assets);
        
        this.___px = x;
        this.___py = y;
        
        this._collisionSides = {"left": true, "top": true, "right": true, "bottom": true};
        this._movable = false;
    }
    
    __getFullCollisionBox() {
        let [x, y, w, h] = this.getBoundingBox();
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
    
    handleCollision(obj, side, thisBox, otherBox, thisBoxIdx, otherBoxIdx) {}
    
    isSolid(otherObj, thisBoxIdx, thisSideIdx) {
        return true;
    }
    
    __collisionAdjust(box, bound, boundIdx) {
        let [_x, _y, width, height] = box;
        let [[x, y], ax, len] = bound;
        
        let [xOff, yOff] = [this.x - _x, this.y - _y];

        if(!this._movable) return;

        let sign = GameCollisionManager.sideSigns[boundIdx];
        let [sdx, sdy] = this.__getDisplacementVector().map((e) => Math.sign(e));

        let cX = xOff + (x - ((sign + 1) * width / 2));
        let cY = yOff + (y - ((sign + 1) * height / 2));
        this.x = (ax == 0 || sdx != sign)? this.x: cX;
        this.y = (ax == 1 || sdy != sign)? this.y: cY;
    }
    
    onCollisionEnd() {        
        this.___px = this.x;
        this.___py = this.y;
    }
}

window.GameCollisionObject = GameCollisionObject;

class CollisionHeap {
    constructor() {
        this._array = [];
        this._box2indexes = new Map();
        this._objects = new Map();
        this._objectCounter = 0;
    }
    
    _swap(index1, index2) {
        // Swap array values....
        let tmp = this._array[index1];
        this._array[index1] = this._array[index2];
        this._array[index2] = tmp;
        
        // Update the box mapping to point to the correct heap indicies...
        let [obj1, obj2, bestBoundIdx, bestTime, i, j] = this._array[index1];
        this._set_mapping(obj1, i, obj2, j, index1);
        
        [obj1, obj2, bestBoundIdx, bestTime, i, j] = this._array[index2];
        this._set_mapping(obj1, i, obj2, j, index2);
    }
    
    _sink(index) {        
        while(true) {
            let child1Idx = index * 2 + 1;
            let child2Idx = index * 2 + 2;
            let val1 = this._array[child1Idx];
            let val2 = this._array[child2Idx];
            val1 = (val1 == undefined)? val1: val1[3];
            val2 = (val2 == undefined)? val2: val2[3];
            
            if(val1 == undefined && val2 == undefined) return;
            let smallerIdx = (val2 == undefined || val1 < val2)? child1Idx: child2Idx;
            
            if(this._array[index][3] < this._array[smallerIdx][3]) return;
            this._swap(index, smallerIdx);
            index = smallerIdx;
        }
    }
    
    _swim(index) {
        while(true) {
            if(index <= 0) return;
            
            let parent = Math.floor((index - 1) / 2);
            if(this._array[parent][3] < this._array[index][3]) return;
            this._swap(index, parent);
            index = parent;
        }
    }
    
    _to_idx(obj, boxIdx) {
        return this._objects.get(obj) + "," + boxIdx;
    }
    
    _set_mapping(obj1, i, obj2, j, value) {
        let idx1 = this._to_idx(obj1, i);
        let idx2 = this._to_idx(obj2, j);
        
        if(!this._box2indexes.has(idx1)) this._box2indexes.set(idx1, new Map());
        if(!this._box2indexes.has(idx2)) this._box2indexes.set(idx2, new Map());
        
        this._box2indexes.get(idx1).set(idx2, value);
        this._box2indexes.get(idx2).set(idx1, value);
    }
    
    _delete_mapping(obj1, i, obj2, j, value) {
        let idx1 = this._to_idx(obj1, i);
        let idx2 = this._to_idx(obj2, j);
        
        this._box2indexes.get(idx1).delete(idx2);
        this._box2indexes.get(idx2).delete(idx1);
        
        if(this._box2indexes.get(idx1).size == 0) {
            this._box2indexes.delete(idx1);
            this._objects.delete(obj1);
        }
        if(this._box2indexes.get(idx2).size == 0) {
            this._box2indexes.delete(idx2);
            this._objects.delete(obj2);
        }
    }
    
    push(collisionInfoList) {
        let [obj1, obj2, bestBoundIdx, bestTime, i, j] = collisionInfoList;
        
        if(!this._objects.has(obj1)) this._objects.set(obj1, this._objectCounter++);
        if(!this._objects.has(obj2)) this._objects.set(obj2, this._objectCounter++);
        
        // Add value to the heap...
        this._array.push(collisionInfoList);
        let heapIdx = this._array.length - 1;
        
        this._set_mapping(obj1, i, obj2, j, heapIdx);
        this._swim(heapIdx);
    }
    
    peek() {
        return this._array[0];
    }
    
    pop() {
        let result = this.peek();
        if(result == undefined) return result;
        
        this._swap(0, this._array.length - 1);
        this._delete_mapping(result[0], result[4], result[1], result[5]);
        this._array.length--;
        
        this._sink(0);
        
        return result;
    }
    
    update(collisionInfoList) {
        let [obj1, obj2, bestBoundIdx, bestTime, i, j] = collisionInfoList;
        
        let idx1 = this._to_idx(obj1, i);
        let idx2 = this._to_idx(obj2, j);
        
        let heapLocation = this._box2indexes.get(obj1).get(obj2);
        let origT = this._array[heapLocation][3];
        this._array[heapLocation] = collisionInfoList;
        
        if(bestTime > origT) {
            this._sink(heapLocation);
        }
        else {
            this._swim(heapLocation);
        }
    }
    
    *getNeighborsOf(obj) {
        if(!this._box2indexes.has(obj)) return;
        
        for(let [obj, idx] of this._box2indexes.get(obj)) {
            yield [obj, this._array[idx]];
        }
    }
    
    get size() {
        return this._array.length;
    }
    
    clear() {
        this._array.length = 0;
        this._objects.clear();
        this._box2indexes.clear();
        this._objectCounter = 0;
    }
}

class SweepAndPrune {
    constructor() {
        this._objectSet = new Map();
        this._objects = [];
        this._xs = [];
        this._ys = [];
        this._visitState = false;
    }
    
    addEntity(entity) {
        if(this._objectSet.has(entity)) return false;
        
        this._objects.push([
            entity,
            null,
            0,  // Start point of x 
            0,  // End point of x
            0,  // Start point of y
            0  // End point of y
        ]);
        
        this._objectSet.set(entity, [this._objects.length - 1, this._visitState]);
        this._xs.push([this._objects.length - 1, false], [this._objects.length - 1, true]);
        this._ys.push([this._objects.length - 1, false], [this._objects.length - 1, true]);
        
        return true;
    }
    
    deleteEntity(entity) {
        if(!this._objectSet.has(entity)) return false;
        
        let [idx, visitedFlag] = this._objectSet.get(entity);
        _popAndSwapWithEnd(this._objects, idx);
        this._objectSet.delete(entity);
        if(idx < this._objects.length) this._objectSet.get(this._objects[idx][0])[0] = idx;
        
        return true;
    }
    
    sync(loadedChunks, players) {
        // Mark all visited objects by flipping the visited flag...
        for(let [x, y, chunk] of loadedChunks) {
            for(let entity of chunk.entities) {
                this.addEntity(entity);
                this._objectSet.get(entity)[1] = !this._objectSet.get(entity)[1];
            }
        }
        
        for(let player of players) {
            this.addEntity(player);
            this._objectSet.get(player)[1] = !this._objectSet.get(player)[1];
        }
        
        // Invert the visit flag...
        this._visitState = !this._visitState;
        
        // Delete any objects that have not been visited...
        for(let i = 0; i < this._objects.length; ) {
            let object = this._objects[i][0];
            
            if(this._objectSet.get(object)[1] != this._visitState) {
                this.deleteEntity(object);
            }
            else i++;
        }
    }
    
    _cutdown(arr) {
        for(let i = 0; i < arr.length; ) {
            if(arr[i][0] >= this._objects.length) _popAndSwapWithEnd(arr, i);
            else i++;
        }
    }
    
    detectCollisions(collisionHandler) {
        for(let i = 0; i < this._objects.length; i++) {
            if(!("__getFullCollisionBox" in this._objects[i][0])) {
                this._objects[i][1] = [-i, -i, -i + 0.1, -i + 0.1];
                continue;
            }
            this._objects[i][1] = this._objects[i][0].__getFullCollisionBox();
        }
        
        this._cutdown(this._xs);
        this._cutdown(this._ys);
        
        // Sort the x and y axes by starts of the bounding boxes
        this._xs.sort((a, b) => {
            let off1 = (a[1])? this._objects[a[0]][1][0] + this._objects[a[0]][1][2]: this._objects[a[0]][1][0];
            let off2 = (b[1])? this._objects[b[0]][1][0] + this._objects[b[0]][1][2]: this._objects[b[0]][1][0];
            return off1 - off2;
        });
        this._ys.sort((a, b) => {
            let off1 = (a[1])? this._objects[a[0]][1][1] + this._objects[a[0]][1][3]: this._objects[a[0]][1][1];
            let off2 = (b[1])? this._objects[b[0]][1][1] + this._objects[b[0]][1][3]: this._objects[b[0]][1][1];
            return off1 - off2;
        });
        
        for(let i = 0; i < this._xs.length; i++) {
            let [objIdx, isEnd] = this._xs[i];
            this._objects[objIdx][(isEnd)? 3: 2] = i;
        }
        for(let i = 0; i < this._ys.length; i++) {
            let [objIdx, isEnd] = this._ys[i];
            this._objects[objIdx][(isEnd)? 5: 4] = i;
        }
        
        let xCount = 0;
        let yCount = 0;
        for(let [obj, box, xS, xE, yS, yE] of this._objects) {
            xCount += xE - xS;
            yCount += yE - yS;
        }
                
        let arr = (xCount <= yCount)? this._xs: this._ys;
        let startIdx = (xCount <= yCount)? 2: 4;
        let endIdx = (xCount <= yCount)? 3: 5;
                
        for(let i = 0; i < this._objects.length; i++) {
            let obj1 = this._objects[i][0];
            let box1 = this._objects[i][1];
            
            let start = this._objects[i][startIdx];
            let end = this._objects[i][endIdx];
            
            for(let j = start + 1; j < end; j++) {
                if(arr[j][1]) continue;
                
                let obj2 = this._objects[arr[j][0]][0];
                let box2 = this._objects[arr[j][0]][1];
                
                if(collisionHandler.__insideCheck(box1, box2)) {
                    collisionHandler.addCollision(obj1, obj2);
                }
            }
        }
    }
    
    clear() {
        this._object.length = 0;
        this._xs.length = 0;
        this._ys.length = 0;
    }
}

class GameCollisionManager {
    constructor() {
        this._collisions = new CollisionHeap();
        this._unknowns = [];
    }
    
    __intersection(boxSeg, dvec, boxSeg2, dvec2, ignoreT = false) {
        // PRIVATE: Tests 2 borders for colision within the time step.
        let [pt, ax, len] = boxSeg;
        let [pt2, ax2, len2] = boxSeg2;
        
        if(ax != ax2) throw "Axes did not match!";
        
        let opAx = (ax + 1) % 2;
        let t = (pt2[opAx] - pt[opAx]) / (dvec[opAx] - dvec2[opAx]);
                
        if((t == Infinity) || (t == -Infinity)) return [Infinity, 0, null];
            
        // We got 0 / 0 or NaN, that means the objects are right next to each other, and moving in the same direction at the same speed...
        // I just go with 0, meaning this collision should be handled right away...
        if(t != t) t = 0;
        
        let res = pt[ax] + dvec[ax] * t;
        let res2 = pt2[ax] + dvec2[ax] * t;
        let overlapLoc = pt[opAx] + dvec[opAx] * t;
        
        // Check if borders overlap...
        if((res + len < res2) || (res2 + len2 < res)) return [Infinity, 0, null];
        
        if((!ignoreT) && (t > 1 || t < 0)) return [Infinity, 0, null];
        
        let segOverlap = Math.min.apply(
            null, [res2 - (res + len), (res2 + len2) - res].map(Math.abs)
        );
        
        if(t < 0) t = 1 + Math.abs(t);
                        
        let boundAtCollision = [[(ax != 0)? overlapLoc: res2, (ax != 1)? overlapLoc: res2], ax, len2];
                
        return [t, segOverlap, boundAtCollision];
    }
    
    __getCollisionSides(boxes, dispVector, collisionSides) {
        let [dx, dy] = dispVector;
        
        // Build hitbox sides...
        let allSides = [];
        
        for(let i = 0; i < boxes.length; i++) {
            let [x, y, w, h] = boxes[i];
            
            x -= dx;
            y -= dy;
            
            let sides = [
                [[x, y + h], 0, w],
                [[x, y], 0, w],
                [[x + w, y], 1, h],
                [[x, y], 1, h]
            ];
            
            let cSides = this._colSidesAt(collisionSides, i);
                        
            for(let i = 0; i < GameCollisionManager.sideNames.length; i++) {
                sides[i] = (cSides[GameCollisionManager.sideNames[i]])? sides[i]: null;
            }
            
            allSides.push(sides);
        }
        
        return allSides;
    }
    
    __insideCheck(box1, box2) {
        let [x, y, w, h] = box1;
        let [ox, oy, ow, oh] = box2;
        
        return (
            !((x >= (ox + ow)) || ((x + w) <= ox))
            && !((oy >= (y + h)) || ((oy + oh) <= y))
        );
    }
    
    addCollision(obj1, obj2) {
        if((obj1 instanceof GameCollisionObject) && (obj2 instanceof GameCollisionObject)) {
            // Gives us direction of move...
            let obj1Vec = obj1.__getDisplacementVector();
            let obj2Vec = obj2.__getDisplacementVector();
            
            let obj1Boxes = obj1.getHitBoxes();
            let obj2Boxes = obj2.getHitBoxes();

            let obj1SideList = this.__getCollisionSides(obj1Boxes, obj1Vec, obj1._collisionSides);
            let obj2SideList = this.__getCollisionSides(obj2Boxes, obj2Vec, obj2._collisionSides);
            
            let sideSwap = GameCollisionManager.sideSwaps;
            obj2SideList = obj2SideList.map((elm) => elm.map((e, i, a) => a[sideSwap[i]]));
            
            for(let i = 0; i < obj1Boxes.length; i++) {
                for(let j = 0; j < obj2Boxes.length; j++) {
                    let obj1Sides = obj1SideList[i];
                    let obj2Sides = obj2SideList[j];
                                        
                    let bestTime = Infinity;
                    let bestBoundIdx = null;

                    for(let k = 0; k < obj2Sides.length; k++) {
                        if((obj2Sides[k] == null) || (obj1Sides[k] == null)) continue;
                        
                        let [time, overlap, bound] = this.__intersection(obj1Sides[k], obj1Vec, obj2Sides[k], obj2Vec, true);

                        if(bestTime > time) {
                            bestTime = time;
                            bestBoundIdx = k;
                        }
                    }
                    
                    if(bestTime != Infinity) {
                        this._collisions.push([obj1, obj2, bestBoundIdx, bestTime, i, j]);
                    }
                    else {
                        this._unknowns.push([obj1, obj2, i, j]);
                    }
                }
            }
        }
    }
    
    _flushUnkowns() {
        for(let k = 0; k < this._unknowns.length;) {
            let [obj1, obj2, il, jl] = this._unknowns[k];
            
            let obj1Vec = obj1.__getDisplacementVector();
            let obj2Vec = obj2.__getDisplacementVector();
            let obj1Sides = this.__getCollisionSides([obj1.getHitBoxes()[il]], obj1Vec, this._colSidesAt(obj1._collisionSides, il))[0];
            let obj2Sides = this.__getCollisionSides([obj2.getHitBoxes()[jl]], obj2Vec, this._colSidesAt(obj2._collisionSides, jl))[0];
            
            obj2Sides = obj2Sides.map((e, i, a) => a[GameCollisionManager.sideSwaps[i]])
            
            let bestTime = Infinity;
            let bestBoundIdx = null;

            for(let k = 0; k < obj2Sides.length; k++) {
                if((obj2Sides[k] == null) || (obj1Sides[k] == null)) continue;
                
                let [time, overlap, bound] = this.__intersection(obj1Sides[k], obj1Vec, obj2Sides[k], obj2Vec, true);

                if(bestTime > time) {
                    bestTime = time;
                    bestBoundIdx = k;
                }
            }
            
            if(bestTime != Infinity) {
                this._collisions.push([obj1, obj2, bestBoundIdx, bestTime, il, jl]);
                _popAndSwapWithEnd(this._unknowns, k);
            }
            else {
                k++;
            }
        }
    }
    
    _colSidesAt(collisionSides, idx) {
        return (Array.isArray(collisionSides))? collisionSides[idx]: collisionSides;
    }
    
    _updateCollisionTime(collisionData) {
        let [obj1, obj2, boundIdx, time, boxI1, boxI2] = collisionData;
        
        let dvec1 = obj1.__getDisplacementVector();
        let dvec2 = obj2.__getDisplacementVector();
        let obj1Box = obj1.getHitBoxes()[boxI1];
        let obj2Box = obj2.getHitBoxes()[boxI2];
        let obj1Side = this.__getCollisionSides([obj1Box], dvec1, this._colSidesAt(obj1._collisionSides, boxI1))[0][boundIdx];
        let obj2Side = this.__getCollisionSides([obj2Box], dvec2, this._colSidesAt(obj2._collisionSides, boxI2))[0][sideSwap[boundIdx]];
        
        let [newTime, overlap, bound] = this.__intersection(obj1Side, dvec1, obj2Side, dvec2, true);
        
        return [obj1, obj2, boundIdx, newTime, boxI1, boxI2];
    }
    
    resolveCollisions() {
        let sideSwap = GameCollisionManager.sideSwaps;
        let sideNames = GameCollisionManager.sideNames;
        
        while(this._collisions.size > 0) {
            let [obj1, obj2, boundIdx, time, boxI1, boxI2] = this._collisions.pop();
            
            let dvec1 = obj1.__getDisplacementVector();
            let dvec2 = obj2.__getDisplacementVector();
            let obj1Box = obj1.getHitBoxes()[boxI1];
            let obj2Box = obj2.getHitBoxes()[boxI2];
            let obj1Side = this.__getCollisionSides([obj1Box], dvec1, this._colSidesAt(obj1._collisionSides, boxI1))[0][boundIdx];
            let obj2Side = this.__getCollisionSides([obj2Box], dvec2, this._colSidesAt(obj2._collisionSides, boxI2))[0][sideSwap[boundIdx]];
            
            let [t, overlap, bound] = this.__intersection(obj1Side, dvec1, obj2Side, dvec2);
            
            if(overlap <= 0 || bound == null) {
                // Do the objects overlap in this frame? If so, trigger an 'inside' event.
                if(this.__insideCheck(obj1Box, obj2Box)) {
                    obj1.handleCollision(obj2, "inside", obj1Box, boxI1, obj2Box, boxI2);
                    obj2.handleCollision(obj1, "inside", obj2Box, boxI2, obj1Box, boxI1);
                }
                continue;
            }
                        
            let [delta1, delta2] = (bound[1])? [dvec1[0], dvec2[0]]: [dvec1[1], dvec2[1]];
            let direc = Math.sign((delta1 - delta2) * Math.abs(t));
            if(direc != GameCollisionManager.sideSigns[sideSwap[boundIdx]] && direc != 0) continue;
                                    
            // Move both objects....
            if(obj1.isSolid(obj2, boxI1, sideNames[boundIdx]) && obj2.isSolid(obj1, boxI2, sideNames[sideSwap[boundIdx]])) {
                obj1.__collisionAdjust(obj1Box, bound, sideSwap[boundIdx]);
                obj2.__collisionAdjust(obj2Box, bound, boundIdx);
            }
            
            // For extra functionality...
            obj1.handleCollision(obj2, sideNames[boundIdx], obj1Box, boxI1, obj2Box, boxI2);
            obj2.handleCollision(obj1, sideNames[sideSwap[boundIdx]], obj2Box, boxI2, obj1Box, boxI1);
            
            // Update nearby collision times...
            for(let [otherObj, col] of this._collisions.getNeighborsOf(obj1)) {
                col = this._updateCollisionTime(col);
                this._collisions.update(col);
            }
            for(let [otherObj, col] of this._collisions.getNeighborsOf(obj2)) {
                col = this._updateCollisionTime(col);
                this._collisions.update(col);
            }
            
            this._flushUnkowns();
        }
        
        this._collisions.clear();
        this._unknowns.length = 0;
    }
}

GameCollisionManager.sideNames = ["bottom", "top", "right", "left"];
GameCollisionManager.sideSigns = [-1, 1, -1, 1];
GameCollisionManager.sideSwaps = [1, 0, 3, 2];

/*
 * CHUNK MANAGEMENT FUNCTIONS:
 */
function _loadChunk(cx, cy, level, blockTypes, entityTypes, assets) {    
    let chunkSize = level.chunkSize;
    let newLoadedChunk = _makeEmptyChunk(chunkSize);
    
    // Load blocks...
    for(let x = 0; x < chunkSize; x++) {
        for(let y = 0; y < chunkSize; y++) {
            let blockData = level.chunks[cx][cy].blocks[x][y];
            let blockName = (blockData != null)? blockData._$type: null;
            let bx = cx * chunkSize + x;
            let by = cy * chunkSize + y;

            newLoadedChunk.blocks[x][y] = (blockName != null)? blockTypes[blockName].fromJSON(blockData, assets): null;
        }
    }
    
    // Load entities...
    for(let data of level.chunks[cx][cy].entities) {
        let entity = entityTypes[data._$type].fromJSON(data, assets);
        newLoadedChunk.entities.push(entity);
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

function _getChunkBoundsFromCamera(level, camera) {
    let chunkSide = level.chunkSize; 
    let [cx, cy, cw, ch] = camera.getBounds();
    
    return {
        xStartChunk: Math.max(0, Math.floor((cx / chunkSide) - 0.5)),
        yStartChunk: Math.max(0, Math.floor((cy / chunkSide) - 0.5)),
        xEndChunk: Math.min(level.numChunks[0] - 1, Math.ceil(((cx + cw) + 0.5) / chunkSide)),
        yEndChunk: Math.min(level.numChunks[1] - 1, Math.ceil(((cy + ch) + 0.5) / chunkSide))
    };
}

function _isChunkWithinCameras(level, x, y, cameras) {
    for(let camera of cameras) {
        let {xStartChunk, yStartChunk, xEndChunk, yEndChunk} = _getChunkBoundsFromCamera(level, camera);
        
        if((x < xStartChunk || x > xEndChunk) || (y < yStartChunk || y > yEndChunk)) continue;
        
        return true;
    }
    return false;
}

function _manageChunks(level, cameras, loadedChunks, blockTypes, entityTypes, assets) {
    let newLoadedChunks = [];
    let doneChunks = {};
    
    // Unload chunks that are out of the area... Keep others loaded...
    for(let [x, y, chunk] of loadedChunks) {
        if(!_isChunkWithinCameras(level, x, y, cameras)) {
            _unloadChunk(chunk, x, y, level);
        }
        else {
            newLoadedChunks.push([x, y, chunk]);
            doneChunks[[x, y]] = true;
        }
    }

    // Load chunks in area that are remaining...
    for(let camera of cameras) {
        let {xStartChunk, yStartChunk, xEndChunk, yEndChunk} = _getChunkBoundsFromCamera(level, camera);
        
        for(let xic = xStartChunk; xic <= xEndChunk; xic++) {
            for(let yic = yStartChunk; yic <= yEndChunk; yic++) {
                if(!([xic, yic] in doneChunks)) {
                    newLoadedChunks.push([xic, yic, _loadChunk(xic, yic, level, blockTypes, entityTypes, assets)]); 
                    doneChunks[[xic, yic]] = true;
                }
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

function _reboundEntity(entity, chunkSize, numChunks) {
    let [cBoundX, cBoundY] = numChunks;
    let [ex, ey, ew, eh] = entity.getBoundingBox();
    [ex, ey] = [_bound(ex, 0, (cBoundX * chunkSize) - ew), _bound(ey, 0, (cBoundY * chunkSize) - eh)];
    entity.setLocation([ex, ey]);
    return [ex, ey];
}

function _buildChunkLookup(loadedChunks) {
    let chunkLookup = {};
    for(let [cx, cy, chunk] of loadedChunks) chunkLookup[[cx, cy]] = chunk;
    
    return chunkLookup;
}

/*
 * COLLISION MANAGEMENT FUNCTIONS... 
 */
function _handleCollisions(loadedChunks, chunkLookup, chunkSize, numChunks, players, gameState, collisionDetector) {
    // Bound value, then compute floored division and modulo...
    let boundNFloor = (x, xlow, xhigh, bounding_func = Math.floor) => {
        x = _bound(x, xlow, xhigh);
        return bounding_func(x);
    }
    
    let divmod = (x, y) => [Math.floor(x / y), Math.floor(x % y)];
    
    let collisionManager = new GameCollisionManager();
            
    // Going over every entity in every loaded chunk...
    for(let ci = 0; ci < loadedChunks.length; ci++) {
        let [cx, cy, chunk] = loadedChunks[ci];
        
        for(let i = ((ci == 0)? -players.length: 0); i < chunk.entities.length; i++) {
            // -1 indicates index of the player...
            let entity1 = (i < 0)? players[players.length + i]: chunk.entities[i];
            
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
                        
                        if(collisionManager.__insideCheck([x1, y1, w1, h1], [x2, y2, w2, h2])) {
                            collisionManager.addCollision(entity1, block);
                        }
                    }
                }
            }
        }
    }
    
    // Now handle any entity-entity collisions...
    collisionDetector.sync(loadedChunks, players);  // <-- Sync SAP with latest set of loaded chunks and players (add/remove entities in it)...
    collisionDetector.detectCollisions(collisionManager);  // <-- Detect collisions using the SAP... 
    collisionManager.resolveCollisions();
    
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
    
    for(let player of players) {
        if("onCollisionEnd" in player) player.onCollisionEnd();
    }
}


function _buildCamerasFrom(canvas, cameraConfig, players) {
    let cameraObjs = [];
    
    if(cameraConfig == null) {
        cameraConfig = [{}];
    }
    
    for(let camera of cameraConfig) {
        let {
            blockSize = 32,
            minBlocksShown = 10,
            maxBlocksShown = 20,
            maxZoomAdjustment = 1.5,
            trackBox = [1/3, 1/3, 1/3, 1/3],
            subCanvasBox = [0, 0, 1, 1],
            tracks = range(players.length)
        } = camera;
        
        let cameraObj = new Camera(canvas, blockSize, minBlocksShown, maxBlocksShown, maxZoomAdjustment, trackBox, subCanvasBox);
        let trackPlayers = [];
        
        for(let idx of tracks) {
            trackPlayers.push(players[idx]);
        }
        
        cameraObj.setTracks(trackPlayers);
        
        cameraObjs.push(cameraObj);
    }
        
    return cameraObjs;
}

/*
gameData {
    assets: {
        sprites: ...
        sounds: ...
    }
    objects: {
        blocks: [BlockClass1, ...],
        entities: [EntityClass1, ...],
        players: [PlayerClass1, ...]
    }
    zones: {
        "zoneName": {
            zoneData: "path/to/level/data"
            preDraw: function...,
            postDraw: ...,
            preUpdate: ...,
            postUpdate: ...,
            initialGameState: {
        
            }
        }
    }
}
*/

class Zone {
    constructor(zoneInfo, cameraConfig) {
        let {
            zoneData,
            preUpdate = null,
            postUpdate = null,
            preDraw = null,
            postDraw = null,
            initGameState = {}
        } = zoneInfo;
        this.zoneData = zoneData;
        this.preUpdate = preUpdate;
        this.postUpdate = postUpdate;
        this.preDraw = preDraw;
        this.postDraw = postDraw;
        this.cameraConfig = cameraConfig;
        this._initGameState = initGameState;
        
        this._colDetect = new SweepAndPrune();
    }
    
    initialized(gameState) {
        return gameState.cameras != null;
    }
    
    initGameState(gameState) {
        if(gameState.cameras == null) {
            gameState.__players = [];
            gameState.loadedChunks = [];
            
            for(let player of this.zoneData.players) {
                let playerType = gameState.playerTypes[player._$type];
                gameState.__players.push(playerType.fromJSON(player, gameState.assets));
            }
                        
            gameState.cameras = _buildCamerasFrom(gameState.canvas, this.cameraConfig, gameState.__players);
            
            if(this._initGameState != null) Object.assign(gameState, this._initGameState);
        }
    }
    
    update(timeStep, gameState) {
        if(this.preUpdate != null) if(this.preUpdate(timeStep, gameState)) return;
        
        // Used heavily below...
        let chunkSize = this.zoneData.chunkSize;
        let numChunks = this.zoneData.numChunks;
        
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
            for(let i = 0; i < chunk.entities.length; ) {
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
                    continue;
                }
                
                i++;
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
        for(let loc in relocate) {
            let [ex, ey] = loc.split(",").map((val) => +val);
            for(let entity of relocate[loc]) {
                this.zoneData.chunks[ex][ey].entities.push(entity.toJSON());
            }
        }
        
        // Update the player... Bound player to game zone...
        for(let i = 0; i < gameState.__players.length; ) {
            let player = gameState.__players[i];
            
            if(player.update(timeStep, gameState)) {
                _popAndSwapWithEnd(gameState.__players, i);
                for(let camera of gameState.cameras) {
                    let tracks = camera.getTracks();
                    let index = track.indexOf(player);
                    if(index >= 0) _popAndSwapWithEnd(tracks, index);
                }
                continue;
            }
            _reboundEntity(player, chunkSize, numChunks);
            i++;
        }
        
        // Handle collisions between objects.... (Expensive...)
        _handleCollisions(gameState.loadedChunks, gameState.chunkLookup, chunkSize, numChunks, gameState.__players, gameState, this._colDetect);
        
        // Finally, update the cameras...
        for(let camera of gameState.cameras) {
            camera.update(this.zoneData.numChunks.map((v) => v * this.zoneData.chunkSize));
        }
        
        // Update chunks...
        gameState.loadedChunks = _manageChunks(
            this.zoneData, gameState.cameras, gameState.loadedChunks, 
            gameState.blockTypes, gameState.entityTypes, gameState.assets,
            
        );
        gameState.chunkLookup = _buildChunkLookup(gameState.loadedChunks);
        
        if(this.postUpdate != null) this.postUpdate(timeStep, gameState);
    }
    
    draw(canvas, painter, gameState) {
        // Clear the canvas...
        painter.fillStyle = "white"
        painter.fillRect(0, 0, canvas.width, canvas.height);
        
        if(this.preDraw != null) if(this.preDraw(gameState.canvas, gameState.painter, gameState)) return;
        
        // Add everything to zorder list...
        let drawObjects = [];
        
        for(let [cx, cy, chunk] of gameState.loadedChunks) {
            for(let blockCol of chunk.blocks) {
                for(let block of blockCol) {
                    if(block != null) drawObjects.push(block);
                }
            }
        }
        
        for(let [cx, cy, chunk] of gameState.loadedChunks) {
            for(let entity of chunk.entities) {
                drawObjects.push(entity);
            }
        }
        
        // Draw the player...
        for(let player of gameState.__players) drawObjects.push(player);
        
        drawObjects.sort((a, b) => a.getZOrder() - b.getZOrder());
        
        for(let camera of gameState.cameras) {
            let [x, y, w, h] = camera.getDisplayZone();
            let clipBox = new Path2D();
            clipBox.rect(x, y, w, h);
            
            gameState.painter.save();
            gameState.painter.clip(clipBox, "evenodd");
            
            let [cx, cy, cw, ch] = camera.getBounds();
            
            for(let object of drawObjects) {
                let [ox, oy, ow, oh] = object.getBoundingBox();
                if(
                    !((ox >= (cx + cw)) || ((ox + ow) <= cx))
                    && !((oy >= (cy + ch)) || ((oy + oh) <= cy)) 
                ) {
                    object.draw(gameState.canvas, gameState.painter, camera);
                }
            }
            
            gameState.painter.restore();
        }
        
        if(this.postDraw != null) this.postDraw(gameState.canvas, gameState.painter, gameState);
    }
}

async function getZoneBuilder(zoneInfo) {
    if(zoneInfo.zoneData == null) {
        throw "Zone does not have a 'zoneData' attribute";
    }
    
    return {
        origPath: zoneInfo.zoneData,
        _zoneData: await loadJSON(zoneInfo.zoneData),
        _zoneInfo: zoneInfo,
        buildZone: function(cameraInfo) {
            this._zoneInfo.zoneData = JSON.parse(JSON.stringify(this._zoneData));
            return new Zone(this._zoneInfo, cameraInfo);
        }
    }
}

window.Zone = Zone;


elem_proto.levelEditor = async function(gameInfo, editZone) {    
    function _levelGen(zoneName, zoneInfo) {
        let width = Math.floor(_bound(prompt("Width in Chunks: ", 10), 1, 20));
        let height = Math.floor(_bound(prompt("Height in Chunks: ", 10), 1, 20));
        let chunkSize = Math.floor(_bound(prompt("Chunk Size (in blocks):", 16), 10, 30));
                
        return {
            origPath: zoneInfo.zoneData,
            _zoneData: _makeEmptyLevel(width, height, chunkSize),
            _zoneInfo: zoneInfo,
            buildZone: function(cameraInfo) {
                this._zoneInfo.zoneData = JSON.parse(JSON.stringify(this._zoneData));
                return new Zone(this._zoneInfo, cameraInfo);
            }
        }
    }
    
    let cameraVelocity = 1 / 1000; // In blocks per millisecond...
    let cameraMaxZoomIn = 5;
    let cameraMaxZoomOut = 40;
    let cameraScaleSpeed = 0.02; // In pixels per millisecond...
    
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
    
    function _addBlock(blockX, blockY, loadedChunk, chunkSize, blockClass, assets) {
        let cBlockX = Math.floor(blockX % chunkSize);
        let cBlockY = Math.floor(blockY % chunkSize);
                                
        loadedChunk.blocks[cBlockX][cBlockY] = new blockClass(Math.floor(blockX), Math.floor(blockY), assets);
    }
    
    function _deleteEntity(blockX, blockY, loadedChunk, chunkSize) {
        for(let i = 0; i < loadedChunk.entities.length; i++) {
            let entity = loadedChunk.entities[i];
            
            let [x, y, w, h] = entity.getBoundingBox();
            if((blockX > x) && (blockY > y) && (blockX < x + w) && (blockY < y + h)) {
                _popAndSwapWithEnd(loadedChunk.entities, i);
                return true;
            }
        }
        
        return false;
    }
    
    function _addEntity(blockX, blockY, loadedChunk, chunkSize, entityClass, assets) {
        loadedChunk.entities.push(new entityClass(blockX, blockY, assets));
    }
    
    function _addPlayer(blockX, blockY, gameState, playerType, assets) {
        if(playerType != null) {
            gameState.zone.zoneData.players.push(new playerType(blockX, blockY, assets));
        }
    }
    
    function _deletePlayer(blockX, blockY, gameState) {
        for(let i = 0; i < gameState.zone.zoneData.players.length; i++) {
            let [x, y, w, h] = gameState.zone.zoneData.players[i].getBoundingBox();
            
            if((blockX > x) && (blockY > y) && (blockX < x + w) && (blockY < y + h)) {
                _popAndSwapWithEnd(gameState.zone.zoneData.players, i);
                return true;
            }
        }
        
        return false;
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
        constructor(x, y, assets) {
            super(x, y, assets);
            this._sprite = assets.sprites["_levelEditHover"].buildSprite();
            this._sprite.setAnimation("main");
            this._numChunks = null;
            this._chunkSize = null;
        }
        
        update(timeStep, gameState) {
            if(this._numChunks == null) {
                this._numChunks = gameState.zone.zoneData.numChunks;
                this._chunkSize = gameState.zone.zoneData.chunkSize;
            }
            
            [this.x, this.y] = gameState.cameras[0].reverseTransform(gameState.mouse.location);

            this._sprite.update(timeStep);
        }
        
        getBlockLocation() {
            let [x, y] = [this.x, this.y];
            
            if((x < 0) || (x >= this._numChunks[0] * this._chunkSize)) return [null, null];
            if((y < 0) || (y >= this._numChunks[1] * this._chunkSize)) return [null, null];
            
            return [x, y];
        }
        
        draw(canvas, painter, camera) {
            let [x, y, w, h] = camera.transformBox([Math.floor(this.x), Math.floor(this.y), 1, 1]);
            this._sprite.draw(painter, x, y, w, h);
        }
    }
    
    class GameSelectPanel extends GameObject {
        constructor(x, y, assets) {
            super(x, y, assets);
            this._deleteSprite = assets.sprites["_levelEditDelete"].buildSprite();
            this._itemSize = 1;
            this._hovered = null;
            this._selected = null;
            this._blocks = null;
            this._entities = null;
            this._assets = assets;
            this._width = 0;
            this._overbar = false;
            this._playerType = null;
        }
        
        _grabSelection(tileX, tileY, entityLen, blockLen, playerLen) {
            switch(tileY) {
                case 0:
                    if((tileX >= 0) && (tileX < entityLen + playerLen + 1)) {
                        if(tileX < (playerLen + 1)) {
                            return ["player", tileX - 1];
                        }
                        else {
                            return ["entity", tileX - (playerLen + 1)];
                        }
                    }
                    return null;
                case 1:
                    return ((tileX >= 0) && (tileX < blockLen + 1))? ["block", tileX - 1]: null;
            }
            
            return null;
        }
        
        _getDrawLocation(selection) {
            let info;
            
            switch(selection[0]) {
                case "block":
                    info = [1, 1];
                    break;
                case "entity":
                    info = [this._players.length + 1, 0];
                    break;
                case "player":
                    info = [1, 0];
                    break;
            }
            
            return info;
        }
        
        update(timeStep, gameState) {            
            if(this._blocks == null) {
                this._blocks = _gameObjMappingToList(gameState.blockTypes);
                this._entities = _gameObjMappingToList(gameState.entityTypes);
                this._players = _gameObjMappingToList(gameState.playerTypes);
                
                this._lookupObj = {
                    "entity": this._entities,
                    "block": this._blocks,
                    "player": this._players
                }
            }
            
            let [x, y, w, h] = gameState.cameras[0].getBounds();
            
            [this._x, this._y] = [x, y];
            this._width = w;
            
            this._itemSize = Math.min(w / (this._blocks.length + 1), 1, w / (this._entities.length + 2));
            
            let [mx, my] = gameState.cameras[0].reverseTransform(gameState.mouse.location);
            let [tileX, tileY] = [Math.floor((mx - x) / this._itemSize), Math.floor((my - y) / this._itemSize)];
            
            this._overbar = tileY < 2 && tileY >= 0;
            this._hovered = this._grabSelection(tileX, tileY, this._entities.length, this._blocks.length, this._players.length);

            if(gameState.mouse.pressed && this._hovered != null) {
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
            painter.fillStyle = "#dbdbdb";
            let [x, y, width, height] = camera.transformBox([this._x, this._y, this._width, this._itemSize * 2]);
            let step = height / 2;
            
            painter.fillRect(x, y, width, height);
            
            this._deleteSprite.draw(painter, x, y, step, step);
            for(let i = 0; i < this._players.length; i++) {
                (new this._players[i](x + step * (i + 1), y, this._assets)).drawPreview(canvas, painter, [x + step * (i + 1), y, step, step]);
            }
            this._deleteSprite.draw(painter, x, y + step, step, step);
            for(let i = 0; i < this._entities.length; i++) {
                (new this._entities[i](x + step * (i + this._players.length + 1), y, this._assets)).drawPreview(
                    canvas, painter, [x + step * (i + this._players.length + 1), y, step, step]
                );
            }
            for(let i = 0; i < this._blocks.length; i++) {
                (new this._blocks[i](x + step * (i + 1), y + step, this._assets)).drawPreview(
                    canvas, painter, [x + step * (i + 1), y + step, step, step]
                );
            }
            
            // Hover object....
            if(this._hovered != null) {
                painter.fillStyle = "rgba(46, 187, 230, 0.5)";

                let [idxOff, yOff] = this._getDrawLocation(this._hovered);
                painter.fillRect(x + (this._hovered[1] + idxOff) * step, y + yOff * step, step, step);
            }
            
            // Selected Object...
            if(this._selected != null) {
                painter.fillStyle = "rgba(27, 145, 181, 0.7)";
                let [idxOff, yOff] = this._getDrawLocation(this._selected);
                painter.fillRect(x + (this._selected[1] + idxOff) * step, y + yOff * step, step, step);
            }
        }
    }
    
    class ActionBar extends GameObject {
        constructor(x, y, assets) {
            super(x, y, assets);
            this._sprites = [assets.sprites["_levelEditSave"].buildSprite(), assets.sprites["_levelEditHitbox"].buildSprite()];
            this._action = ["save", "hitbox"];
            this._itemSize = 1;
            this._wasPressed = false;
            this._hovered = null;
            this._clicked = true;
            this._overbar = false;
            this._x = null;
            this._y = null;
        }
        
        update(timeStep, gameState) {
            this._clicked = false;
            
            let [cx, cy] = gameState.cameras[0].reverseTransform(gameState.mouse.location);
            let [gx, gy, gw, gh] = gameState.cameras[0].getBounds();
            [this._x, this._y] = [gx, gy + gh];
            
            let overObj = Math.floor((cx - gx) / this._itemSize);
            this._hovered = ((cy >= ((gy + gh - this._itemSize)) && (overObj < this._action.length)))? overObj: null;
            this._overbar = this._hovered != null
            this._clicked = this._overbar && this._wasPressed && !gameState.mouse.pressed;
            
            this._wasPressed = gameState.mouse.pressed;
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
        let [cx, cy] = gameState.cameras[0].getCenterPoint();
        let cZoomStep = cameraScaleSpeed * timeStep;
        
        if("Minus" in keys) {
            gameState.cameras[0].setMinimumBlocksShown(Math.min(cameraMaxZoomOut, gameState.cameras[0].getMinimumBlocksShown() + cZoomStep));
            gameState.cameras[0].setMaximumBlocksShown(gameState.cameras[0].getMinimumBlocksShown() * 1.6);
        }
        if("Equal" in keys) { 
            gameState.cameras[0].setMinimumBlocksShown(Math.max(cameraMaxZoomIn, gameState.cameras[0].getMinimumBlocksShown() - cZoomStep));
            gameState.cameras[0].setMaximumBlocksShown(gameState.cameras[0].getMinimumBlocksShown() * 1.6);
        }
        
        let stepAmt = cameraVelocity * timeStep * gameState.cameras[0].getMinimumBlocksShown();
            
        if("ArrowUp" in keys || "KeyW" in keys) cy -= stepAmt;
        if("ArrowDown" in keys || "KeyS" in keys) cy += stepAmt;
        if("ArrowLeft" in keys || "KeyA" in keys) cx -= stepAmt;
        if("ArrowRight" in keys || "KeyD" in keys) cx += stepAmt;
        
        gameState.cameras[0].setCenterPoint([cx, cy]);
        gameState.cameras[0].update(gameState.zone.zoneData.numChunks.map((v) => v * gameState.zone.zoneData.chunkSize));
        
        gameState.__levelHoverIndicator.update(timeStep, gameState);
        gameState.__levelSelectorBar.update(timeStep, gameState);
        gameState.__levelActionBar.update(timeStep, gameState);
        gameState.__levelDisplayBanner.update(timeStep);
        
        gameState.loadedChunks = _manageChunks(
            gameState.zone.zoneData, gameState.cameras, gameState.loadedChunks, 
            gameState.blockTypes, gameState.entityTypes, 
            gameState.assets
        );
        
        // We check if user has clicked a location with a item in the toolbar selected...
        let [selLocX, selLocY] = gameState.__levelHoverIndicator.getBlockLocation();
        let blockLoc = [Math.floor(selLocX), Math.floor(selLocY)];
        let selection = gameState.__levelSelectorBar.getSelection();
        if(
            (!gameState.clickWasDown || (gameState.lastBlockLocation.join() != blockLoc.join())) 
            && !gameState.__levelSelectorBar.getOverBar() && (selection != null) 
            && (selLocX != null) && gameState.mouse.pressed
            && !gameState.__levelActionBar.getOverBar()
        ) {
            let level = gameState.zone.zoneData;
            let chunk = _findChunk(Math.floor(selLocX / level.chunkSize), Math.floor(selLocY / level.chunkSize), gameState.loadedChunks);
            if(chunk != null) {
                switch(selection[0]) {
                    case "block":
                        if(selection[1] != -1) {
                            _addBlock(selLocX, selLocY, chunk, level.chunkSize, selection[1], gameState.assets);
                        }
                        else {
                            _deleteBlock(selLocX, selLocY, chunk, level.chunkSize);
                        }
                        break;
                    case "entity":
                        _addEntity(selLocX, selLocY, chunk, level.chunkSize, selection[1], gameState.assets);
                        break;
                    case "player":
                        switch(selection[1]) {
                            case -1:
                                if(!_deleteEntity(selLocX, selLocY, chunk, level.chunkSize)) _deletePlayer(selLocX, selLocY, gameState);
                                break;
                            default:
                                _addPlayer(selLocX, selLocY, gameState, selection[1], gameState.assets);
                                break;
                        }
                        break;
                }
            }
        }
        
        switch(gameState.__levelActionBar.getClicked()) {
            case "save":
                gameState.__levelDisplayBanner.setText("Saving Results!", Infinity);
                _flushLoadedChunks(gameState.zone.zoneData, gameState.loadedChunks);
                let zoneBuilder = null;
                for(let res in gameState.zones) {
                    zoneBuilder = gameState.zones[res];
                    break;
                }
                _saveLevel(gameState.__levelDisplayBanner, zoneBuilder.origPath, gameState.zone.zoneData);
                break;
            case "hitbox":
                gameState.__levelShowHitboxes = !gameState.__levelShowHitboxes;
                gameState.__levelDisplayBanner.setText("Toggling Hitboxes " + ((gameState.__levelShowHitboxes)? "On": "Off"), 1000);
                break;
        }
        
        gameState.lastBlockLocation = blockLoc;
        gameState.clickWasDown = gameState.mouse.pressed;
    }
    
    function drawHitBoxesOf(camera, painter, object) {
        painter.strokeStyle = "red";
        let boxes = object.getHitBoxes();
        
        for(let box of boxes) 
            painter.strokeRect(...camera.transformBox(box));
        
        if(boxes.length > 1) {
            painter.strokeStyle = "pink";
            painter.strokeRect(...camera.transformBox(object.getBoundingBox()));
        }
    }
    
    function draw(canvas, painter, gameState) {    
        // Clear the canvas...
        painter.fillStyle = "white"
        painter.fillRect(0, 0, canvas.width, canvas.height);
        
        gameState.zone.draw(gameState.canvas, gameState.painter, gameState);
        
        for(let [x, y, chunk] of gameState.loadedChunks) {
            for(let bx = 0; bx < chunk.blocks.length; bx++) {
                let blockCol = chunk.blocks[bx];
                
                for(let by = 0; by < blockCol.length; by++) {
                    let block = blockCol[by];
                    
                    let gx = x * gameState.zone.zoneData.chunkSize + bx;
                    let gy = y * gameState.zone.zoneData.chunkSize + by;
                    
                    let [canvX, canvY, canvW, canvH] = gameState.cameras[0].transformBox([gx, gy, 1, 1]);
                    
                    painter.strokeStyle = "black";
                    painter.strokeRect(canvX, canvY, canvW, canvH);                    
                }
            }
        }
        
        if(gameState.__levelShowHitboxes) {
            for(let [x, y, chunk] of gameState.loadedChunks) {
                for(let blockCol of chunk.blocks) {
                    for(let block of blockCol) {
                        if(block == null) continue;
                        if(!Object.getPrototypeOf(block).hasOwnProperty("getHitBoxes")) continue;
                        drawHitBoxesOf(gameState.cameras[0], painter, block);
                    }
                }
                
                for(let entity of chunk.entities) {                
                    drawHitBoxesOf(gameState.cameras[0], painter, entity);
                }
            }
            
            for(let player of gameState.zone.zoneData.players) {
                drawHitBoxesOf(gameState.cameras[0], painter, player);
            }
        }
                
        let [selLocX, selLocY] = gameState.__levelHoverIndicator.getBlockLocation();
        if(
            (selLocX != null) && !gameState.__levelSelectorBar.getOverBar() 
            && !gameState.__levelActionBar.getOverBar() 
            && gameState.__levelHoverIndicator.getLocation()
        ) {
            gameState.__levelHoverIndicator.draw(canvas, painter, gameState.cameras[0]);
        }
        gameState.__levelSelectorBar.draw(canvas, painter, gameState.cameras[0]);
        gameState.__levelActionBar.draw(canvas, painter, gameState.cameras[0]);
        gameState.__levelDisplayBanner.draw();
    }
    
    function gameLoop(timeStep, gameState) {
        if(gameState.__levelHoverIndicator == null) {
            gameState.__levelHoverIndicator = new GameHoverBlock(0, 0, gameState.assets);
            gameState.__levelSelectorBar = new GameSelectPanel(0, 0, gameState.assets);
            gameState.__levelActionBar = new ActionBar(0, 0, gameState.assets);
            gameState.__levelDisplayBanner = new BannerDisplay(gameState);
            // Grab the only zone and load it in...
            for(let zone in gameState.zones) {
                gameState.zone = gameState.zones[zone].buildZone([{tracks: []}]);
                break;
            }
            gameState.zone.initGameState(gameState);
            gameState.zone.zoneData.players = gameState.__players;
        }
        
        update(timeStep, gameState);
        draw(gameState.canvas, gameState.painter, gameState);
    }
    
    let gameState = {};
    gameState.entityTypes = _gameObjListToMapping(gameInfo.objects.entities);
    gameState.blockTypes = _gameObjListToMapping(gameInfo.objects.blocks);
    gameState.playerTypes = _gameObjListToMapping(gameInfo.objects.players);
    gameState.loadedChunks = [];
    gameState.lastBlockLocation = null;
    gameState.clickWasDown = false;
    gameState.__levelShowHitboxes = false;
    
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
    };
    
    gameInfo.assets.sprites = (gameInfo?.assets?.sprites != null)? {...gameInfo.assets.sprites, ...levelEditSprites}: levelEditSprites;
    
    gameInfo.assets.flags = gameInfo.assets.flags ?? {};
    gameInfo.assets.flags.isLevelEditor = true;
    
    let theZone = gameInfo.zones[editZone];
    gameInfo.zones = {};
    gameInfo.zones[editZone] = theZone;
    
    this.makeBaseGame(gameLoop, gameState, gameInfo.assets, gameInfo.zones, _levelGen);
}

function _copyGameStateProperties(gameState, subGameState) {
    subGameState.lastTimeStamp = gameState.lastTimeStamp;
    subGameState.keepRunning = gameState.keepRunning;
    subGameState.canvas = gameState.canvas;
    subGameState.painter = gameState.painter;
    subGameState.keysPressed = gameState.keysPressed;
    subGameState.mouse = gameState.mouse;
    subGameState.paused = gameState.paused;
    subGameState.zones = gameState.zones;
    subGameState.entityTypes = gameState.entityTypes;
    subGameState.blockTypes = gameState.blockTypes;
    subGameState.playerTypes = gameState.playerTypes;
    subGameState.assets = gameState.assets;
    subGameState.__zoneStackAction = gameState.__zoneStackAction;
    subGameState.__zoneStack = gameState.__zoneStack;
    subGameState.gamepads = gameState.gamepads;
    
    return subGameState;
}

function _attachGameAPI(gameState) {
    // Some methods to allow entities/blocks to add other entities/blocks to the game...
    gameState.addEntity = function(entity) {
        let level = this.__zoneStack[this.__zoneStack.length - 1][0].zoneData;
        
        let [ex, ey] = _reboundEntity(entity, level.chunkSize, level.numChunks);
        [ex, ey] = [Math.floor(ex / level.chunkSize), Math.floor(ey / level.chunkSize)];
        
        if([ex, ey] in this.chunkLookup) {
            this.chunkLookup[[ex, ey]].entities.push(entity);
            return;
        }
        
        level.chunks[ex][ey].entities.push(entity.toJSON());
    };

    gameState.addBlock = function(block) {
        let level = this.__zoneStack[this.__zoneStack.length - 1][0].zoneData;
        
        let [bx, by] = _reboundEntity(block, level.chunkSize, level.numChunks);
        let [cx, cy] = [Math.floor(bx / level.chunkSize), Math.floor(by / level.chunkSize)];
        [bx, by] = [Math.floor(bx), Math.floor(by)];
        
        block.x = Math.floor(bx);
        block.y = Math.floor(by);
        let subBX = bx % level.chunkSize;
        let subBY = by % level.chunkSize;
        
        if([cx, cy] in this.chunkLookup) {
            this.chunkLookup[[cx, cy]].blocks[subBX][subBY] = block;
            return;
        }
        
        level.chunks[cx][cy].blocks[subBX][subBY] = block.toJSON();
    };
    
    gameState.addPlayer = function(player) {
        this.__players.push(player);
    }

    gameState.getPlayers = function() {
        return this.__players;
    };

    gameState.getNeighboringBlocks = function(block) {
        let level = this.__zoneStack[this.__zoneStack.length - 1][0].zoneData;
        let [bx, by] = _reboundEntity(block, level.chunkSize, level.numChunks).map(Math.floor);
        
        let neighbors = [
            [null, null, null],
            [null, null, null],
            [null, null, null]
        ];
        
        let iStart = bx - 1;
        let jStart = by - 1;
        
        for(let i = iStart; i < bx + 2; i++) {
            for(let j = jStart; j < by + 2; j++) {
                let [cx, cy] = [i / level.chunkSize, j / level.chunkSize].map(Math.floor); 
                
                let subBX = i % level.chunkSize;
                let subBY = j % level.chunkSize;
                
                if([cx, cy] in this.chunkLookup) {
                    neighbors[i - iStart][j - jStart] = this.chunkLookup[[cx, cy]].blocks[subBX][subBY];
                }
            }
        }
        
        return neighbors;
    };

    gameState.getBlocksAround = function(x, y) {
        let dummyObj = new GameObject(x, y, null);
        return this.getNeighboringBlocks(dummyObj);
    }

    gameState.getEntities = function() {
        let entityLst = [];
        
        for(let [cx, cy, chunk] of this.loadedChunks) {
            entityLst.push(...chunk.entities);
        }
        
        return entityLst;
    };
    
    gameState.getLevelBounds = function() {
        let level = this.__zoneStack[this.__zoneStack.length - 1][0].zoneData;
        return [0, 0, level.numChunks[0] * level.chunkSize, level.numChunks[1] * level.chunkSize];
    }
    
    // Level management methods...
    gameState.exitZone = function(replacementZone = null, cameraConfig = null) {
        this.__zoneStackAction[0] = "pop";
        this.__zoneStackAction[1] = replacementZone;
        this.__zoneStackAction[2] = cameraConfig;
    }
    
    gameState.enterZone = function(zoneName, cameraConfig = null) {
        this.__zoneStackAction[0] = "push";
        this.__zoneStackAction[1] = zoneName;
        this.__zoneStackAction[2] = cameraConfig;
    }
}


elem_proto.makeGame = async function(gameInfo, entryZone, cameraSpec = null) {
    let gameState = {};
    gameState.entityTypes = _gameObjListToMapping(gameInfo.objects.entities);
    gameState.blockTypes = _gameObjListToMapping(gameInfo.objects.blocks);
    gameState.playerTypes = _gameObjListToMapping(gameInfo.objects.players);
    gameState.loadedChunks = [];
    gameState.__players = null;
    gameState.__zoneStack = [];
    gameState.__zoneStackAction = ["push", entryZone, cameraSpec];
    
    function gameLoop(timeStep, globalGameState) {
        // Zone management...
        let [command, arg, cameraInfo] = globalGameState.__zoneStackAction;
        
        if(command == "push") {
            if(globalGameState.__zoneStack.length > 0) {
                Sound.muteAll();
                let belowGameState = globalGameState.__zoneStack[globalGameState.__zoneStack.length - 1][1];
                belowGameState.__soundsToRestore = Sound.ALL_SOUNDS;
                Sound.ALL_SOUNDS = [];
                Sound.unmuteAll();
            }
            
            let newZone = globalGameState.zones[arg].buildZone(cameraInfo);
            let subGameState = {zoneName: arg, cameraConfig: cameraInfo};
            globalGameState.__zoneStack.push([newZone, subGameState]);
        }
        else if(command == "pop") {
            Sound.muteAll();
            globalGameState.__zoneStack.pop();
            Sound.ALL_SOUNDS = [];
            
            if(arg != null) {
                let newZone = globalGameState.zones[arg].buildZone(cameraInfo);
                let subGameState = {zoneName: arg, cameraConfig: cameraInfo};
                globalGameState.__zoneStack.push([newZone, subGameState]);
            }
            else if(globalGameState.__zoneStack.length > 0) {
                let belowGameState = globalGameState.__zoneStack[globalGameState.__zoneStack.length - 1][1];
                Sound.ALL_SOUNDS = belowGameState.__soundsToRestore;
                belowGameState.__soundsToRestore = null;
            }
            
            Sound.unmuteAll();
        }
        
        globalGameState.__zoneStackAction = [null, null, null];
        
        if(globalGameState.__zoneStack.length <= 0) {
            globalGameState.keepRunning = false;
            return;
        }
        
        let [zone, subGameState] = globalGameState.__zoneStack[globalGameState.__zoneStack.length - 1];
        
        _copyGameStateProperties(globalGameState, subGameState);
        
        // Setup player object if we just started the game...
        if(!zone.initialized(subGameState)) {
            _attachGameAPI(subGameState);
            zone.initGameState(subGameState);
        }
        
        zone.update(timeStep, subGameState);
        zone.draw(globalGameState.canvas, globalGameState.painter, subGameState);
    }
    
    gameInfo.assets.flags = gameInfo.assets.flags ?? {};
    gameInfo.assets.flags.isLevelEditor = false;
    
    this.makeBaseGame(gameLoop, gameState, gameInfo.assets, gameInfo.zones);
}
