/*
 * Constructor for GameModel, which is an object
 * that controls the state for the game inside of
 * a two-dimensional array of `invaders` containing
 * instances of `GameModel.Invader`, an array of
 * bullets containing non-exploded instances of
 * `GameModel.Bullet`, and the player's ship, an
 * instance of `GameModel.Ship`.
 */
function GameModel(ir = 5, ic = 11) {
  // Default GameModel properties
  this.score = 0;
  this.sprites = [];
  this.invaders = [];
  this.bullets = [];

  this.invaderDirection = 'right';
  this.ship = null;
  this.otherShip = null;
  this.onload = () => null;

  // Default GameModel constants
  this.INVADER_ROW = ir;
  this.INVADER_COL = ic;
  this.TILE_WIDTH = 15;
  
  this.BULLET_MARGIN_X = 11;
  this.INVADER_MARGIN_X = 10;
  this.INVADER_MARGIN_Y = 140;

  this.INVADER_COL_OFFSET_MIN = 0;
  this.INVADER_COL_OFFSET_MAX = 19;
  this.SHIP_COL_OFFSET_MIN = 1;
  this.SHIP_COL_OFFSET_MAX = 28;
  this.BULLET_ROW_OFFSET_MIN = 0;
  this.BULLET_ROW_OFFSET_MAX = 100;

  this.COL_SCALE_X = (1 / 3);
  this.COL_SCALE_Y = 2;
  this.BULLET_BOUNDING_FRAME_Y = 10;

  this.init();
}

// GameModel.init() must be called on a GameModel
// to (asynchronously) load assets. Calls GameModel.onload()
// when finished.
GameModel.prototype.init = function() {
  // Get spritesheet data
  fetch('/static/sprites.json')
  .then(response => response.json())
  .then(response => {
    this.sprites = response.frames;
    this.onload();
  });

  for (let i = 0; i < this.INVADER_ROW; i++) {
    this.invaders[i] = [];
    for (let j = 0; j < this.INVADER_COL; j++) {
      let type = 0;
      if (i < this.INVADER_ROW * 0.2) type = 2;
      else if (i < this.INVADER_ROW * 0.6) type = 1;
      else type = 0;

      let invader = new GameModel.Invader(type, i, j, this);
      this.invaders[i].push(invader);
    }
  }

  this.ship = new GameModel.Ship(this);
  this.otherShip = new GameModel.Ship(this);
}


// Returns an Object:
// { w: Number, h: Number, x: Number, y: Number }
//
// found in the loaded sprites.json file.
// The returned object refers to the sprite
// sourcing information for the spritesheet.
GameModel.prototype.getSprite = function(name) {
  let sprite = this.sprites[name].frame;
  if (!sprite) throw new Error('No sprite found for ' + name);
  return sprite;
}

// Returns a GameModel.Invader[] array that
// corresponds to GameModel.invaders, but in
// a flattened structure (as opposed to 2-dimensional).
GameModel.prototype.invadersFlat = function() {
  let invaders = [];
  for (let i = 0; i < this.INVADER_ROW; i++) {
    for (let j = 0; j < this.INVADER_COL; j++) {
      invaders.push(this.invaders[i][j]);
    }
  }
  return invaders;
}

// Returns a GameModel.Invader[] array of
// the lowest alive instances of GameModel.Invader
// for each column. If a column has no remaining
// invaders, it is not represented in the returned array.
GameModel.prototype.getLowest = function() {
  let invaders = Array(this.INVADER_COL);
  for (let i = this.INVADER_ROW - 1; i >= 0; i--) {
    for (let j = this.INVADER_COL - 1; j >= 0; j--) {
      if (!invaders[j] && !this.invaders[i][j].dead) {
        invaders[j] = this.invaders[i][j];
      }
    }
  }

  // Trim out undefined values that refer to columns
  // that have no remaining invaders.
  for (let i = 0; i < invaders.length; i++) {
    if (invaders[i] == undefined) {         
      invaders.splice(i, 1);
      i--;
    }
  }

  return invaders;
}

/*
 * Constructor for GameModel.Invader, which refers to
 * a specific invader within the GameModel.
 *
 * Requires the following parameters:
 * - `type`: Number[0-2] for different invader sprites/types
 * - `row`: Number for position in GameModel.invaders - used
 *          to calculate x-position
 * - `col`: Number for position in GameModel.invaders - used
 *          to calculate y-position
 * - `parent`: GameModel - the model this invader was created in
 */
GameModel.Invader = function(type, row, col, parent) {
  this.dead = false;
  this.exploding = false;
  this.model = parent;
  this.type = type;
  this.frameState = 0;
  this.row = row;
  this.col = col;
  this.colOffset = 10;
  this.rowOffset = 0;
}

// Changes the GameModel.Invader.frameState to 0 if 1,
// and 1 if 0. Refers to different movements of the sprite.
GameModel.Invader.prototype.toggleState = function() {
  this.frameState = +(!this.frameState);
}

// Causes the GameModel.Invader to have a 
// `GameModel.Invader.exploding` value of true and a
// `GameModel.Invader.dead` value of true 500 ms after.
// Returns the exploding GameModel.Invader.
GameModel.Invader.prototype.explode = function() {
  this.exploding = true;

  setTimeout(() => {
    this.dead = true;
  }, 500);
  return this;
}

// Returns an Object:
// { w: Number, h: Number, x: Number, y: Number }
//
// referring to the current sprite frame information
// for a GameModel.Invader.
GameModel.Invader.prototype.getSprite = function() {
  return this.exploding ? this.model.getSprite('invader_explode') 
  : this.model.getSprite('invader_' + this.type + '_' + this.frameState);
}

// Moves the GameModel.Invader to the next position by
// GameModel.Invader.colOffset, depending on the
// GameModel.invaderDirection. Changes the direction
// and calls GameModel.Invader.nextRow() if it is beyond
// boundaries.
GameModel.Invader.prototype.nextCol = function() {
  let direction = this.model.invaderDirection;
  let lastToShift = this.row === 0 && this.col === 0;

  let hitRightBound = this.colOffset === this.model.INVADER_COL_OFFSET_MAX
    && direction === 'right';
  let hitLeftBound = this.colOffset === this.model.INVADER_COL_OFFSET_MIN
    && direction === 'left';

  if (hitRightBound || hitLeftBound) {
    if (lastToShift) {
      this.model.invaderDirection = (direction === 'right') ? 'left' : 'right';
    }
    return this.nextRow();
  } else {
    this.colOffset = (direction === 'right') ? this.colOffset + 1 : this.colOffset - 1;
  }
}

// Increments the rowOffset for a GameModel.Invader
GameModel.Invader.prototype.nextRow = function() {
  this.rowOffset++;
}

/*
 * Constructor for GameModel.Ship, which refers to a
 * player's ship in the GameModel.
 *
 * Requires the following parameters:
 * - `parent`: GameModel - the model this ship was created in
 */
GameModel.Ship = function(parent) {
  this.dead = false;
  this.frameState = null;
  this.model = parent;
  this.colOffset = 14;
  this.rowOffset = 30;
  this.moveTimer = null;
}

// Stops any current actions first by calling
// GameModel.Ship.stop() and sets a moveTimer
// to repeatedly decrement the GameModel.Ship.colOffset
// until the ship's colOffset minimum is reached or
// the ship's moveTimer is stopped.
// 
// An 80ms delay is used to prevent race conditions
// between the stop() action and the creation of the 
// new moveTimer.
GameModel.Ship.prototype.left = function() {
  this.stop();
  setTimeout(() => {
    this.moveTimer = setInterval(() => {
      if (
        this.colOffset <= this.model.SHIP_COL_OFFSET_MIN
        && this.moveTimer
      ) {
        return this.stop();
      }
      this.colOffset -= 0.1;
    }, 5);
  }, 80)
}

// Sets a moveTimer to repeatedly increment the 
// GameModel.Ship.colOffset until the ship's colOffset
// maximum is reached or the ship's moveTimer is stopped.
GameModel.Ship.prototype.right = function() {
  this.stop();
  setTimeout(() => {
    this.moveTimer = setInterval(() => {
      if (
        this.colOffset >= this.model.SHIP_COL_OFFSET_MAX
        && this.moveTimer
      ) {
        return this.stop();
      }
      this.colOffset += 0.1;
    }, 5);
  }, 80)

}

// Clears the interval corresponding to the ID
// found in GameModel.Ship.moveTimer.
GameModel.Ship.prototype.stop = function() {
  clearInterval(this.moveTimer);
}

// Returns an Object:
// { w: Number, h: Number, x: Number, y: Number }
//
// referring to the sprite information for a ship.
GameModel.Ship.prototype.getSprite = function() {
  return this.model.getSprite('ship');
}

/*
 * Constructor for GameModel.Bullet, which refers to a
 * bullet fired from either a GameModel.Ship or GameModel.Invader.
 *
 * Requires the following parameters:
 * - `direction`: String['up' or 'down'] - the direction of the bullet
 * - `parent`: GameModel - the model this ship was created in
 */
GameModel.Bullet = function(direction, parent) {
  this.origin = parent;
  this.model = parent.model;
  this.dead = false;
  this.type = Math.floor(Math.random() * 3);
  this.frameState = 0;
  this.direction = direction;
  this.colOffset = parent.colOffset;
  this.rowOffset = parent.rowOffset;

  // GameModel.Bullet.moveTimer moves a bullet every 5ms
  // +0.25 or -0.25 in its rowOffset until it is off-screen
  // (determined by GameModel.BULLET_ROW_OFFSET_MIN/MAX)
  // or is already dead.
  this.moveTimer = setInterval(() => {
    if (
      this.rowOffset <= this.model.BULLET_ROW_OFFSET_MIN
      || this.rowOffset >= this.model.BULLET_ROW_OFFSET_MAX
      || this.dead
    ) {
      this.explode();
      return clearInterval(this.moveTimer);
    }

    if (this.frameState === 2) {
      this.frameState = 0;
    } else {
      this.frameState++;
    }

    if (this.direction === 'up') {
      this.rowOffset -= 0.25;
    }
    else {
      this.rowOffset += 0.05;
    }
  }, 5);
}

// Explodes a bullet by changing the GameModel.Bullet.dead
// property to true and removing it from the GameModel.bullets
// array.
GameModel.Bullet.prototype.explode = function() {
  this.dead = true;
  let bullets = this.model.bullets;
  bullets.splice(bullets.indexOf(this), 1);
}

// Returns an Object:
// { w: Number, h: Number, x: Number, y: Number }
//
// referring to the sprite information for a bullet,
// including for exploding frames when colliding with
// an invader.
GameModel.Bullet.prototype.getSprite = function() {
  let model = this.origin.model;
  if (this.origin instanceof GameModel.Ship) {
    return this.dead ? model.getSprite('player_bullet_explode') : model.getSprite('player_bullet');
  } else {
    return model.getSprite('bullet_' + this.type + '_' + this.frameState);
  }
}
