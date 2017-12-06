/*
 * Constructor for GameController, an object that
 * is responsible for reading from a GameModel and
 * rendering to GameController.game, which is a
 * CanvasRenderingContext2D object. GameController
 * also loads static assets, plays sounds during 
 * actions in the game, and checks for collisions
 * by reading from canvas image data.
 */
function GameController(socket) {
  this.canvas = document.getElementById('game');
  this.game = this.canvas.getContext('2d');
  this.step = 0;
  this.speed = 0;
  this.socket = socket;

  // Default GameController constants
  this.ZOOM_FACTOR = 2;

  this.init();
}

// GameController.init() loads static assets including
// the spritesheet image and all audio resources
// as well as initializing the GameModel.
// This function also sets up event handlers with
// EventController and WebSockets callbacks.
GameController.prototype.init = function() {
  this.setupTimers.assetsToLoad = 13; // GameModel, 11 sounds, spritesheet
  this.setupTimers.assetsLoaded = 0;

  this.spritesheet = new Image();
  this.spritesheet.src = '/static/sprites.png';
  this.spritesheet.onload = () => this.setupTimers();

  this.sounds = Array(11).fill(0).map((e, index) => {
    let slug = index < 10 ? ('0' + index) : index;
    let sound = new Audio('/static/snd_inv' + slug + '.mp3');
    sound.oncanplaythrough = () => this.setupTimers();
    sound.loop = false;
    return sound;
  });

  this.model = new GameModel();
  this.model.onload = () => this.setupTimers();

  // Setup Game events
  this.ev = new EventController();
  this.ev.registerEvent('left', () => {
    this.socket.emit('shipmove', 'left');
    this.model.ship.left();
  }, () => {
    this.socket.emit('shipmove', 'stop');
    this.model.ship.stop();
  });
  this.ev.registerEvent('right', () => {
    this.socket.emit('shipmove', 'right');
    this.model.ship.right();
  }, () => {
    this.socket.emit('shipmove', 'stop');
    this.model.ship.stop();
  });
  this.ev.registerEvent('space', () => {
    let bullet = new GameModel.Bullet('up', this.model.ship);
    this.model.bullets.push(bullet);
    this.socket.emit('bullet', { direction: 'up' });
    this.sounds[7].play();
  });

  // WebSockets event setup
  if (this.socket) {
    let socket = this.socket;
    socket.on('bullet', (bullet) => {
      let origin;
      if (bullet.direction === 'down') {
        origin = this.model.invaders[bullet.origin.row][bullet.origin.col];
      } else {
        origin = this.model.otherShip;
      }
      let b = new GameModel.Bullet(bullet.direction, origin);
      this.model.bullets.push(b);
    });

    socket.on('invaderdeath', (inv) => {
      this.sounds[4].play();
      this.model.invaders[inv.row][inv.col].explode();
    });

    socket.on('shipmove', (direction) => {
      if (direction === 'left') this.model.otherShip.left();
      if (direction === 'right') this.model.otherShip.right();
      if (direction === 'stop') this.model.otherShip.stop();
    });
  }
}

// Sets up the game loop (GameController.draw) with
// window.requestAnimationFrame and invader state toggling 
// with timers of decreasing intervals (to speed up the 
// pace of the game progressively).
// This function waits for all assets to be loaded
// before firing.
GameController.prototype.setupTimers = function() {
  if (
    ++this.setupTimers.assetsLoaded < this.setupTimers.assetsToLoad
    || this.setup
  ) {
    return;
  }

  this.sounds.forEach(sound => sound.oncanplaythrough = null);
  let gameLoop = () => {
    this.draw();
    window.requestAnimationFrame(gameLoop);
  }
  window.requestAnimationFrame(gameLoop);

  this.createTimer = () => {
    setTimeout(() => {
      this.sounds[this.step].play();
      if (this.step === 3) {
        this.step = 0;
      } else {
        this.step++;
      }

      if (this.player === 1) {
        let front = this.model.getLowest();
        let shooter = front[Math.floor(Math.random() * front.length)];
        let bullet = new GameModel.Bullet('down', shooter);
        this.model.bullets.push(bullet);

        let serialized = Object.assign({}, bullet);
        serialized.model = null; // Prevent circular JSON

        this.socket.emit('bullet', Object.assign({}, serialized, {
          origin: {
            row: bullet.origin.row,
            col: bullet.origin.col
          }
        }));
      }

      this.model.invadersFlat().reverse().forEach((invader, i) => {
        setTimeout(() => {
          invader.toggleState();
          invader.nextCol();
        }, i * 10);
        // This timeout delays each invader by its position,
        // to produce the "jitter" effect of the game.
      });

      this.speed += 5;
      this.createTimer();
    }, 1000 - this.speed);
  }

  this.createTimer(this.speed);
  this.setup = true;
}

// The draw function for the canvas (called to render the next
// frame). Draws all invaders, ships, and sprites at their 
// current positions as corresponds to their GameModel
// representations.
GameController.prototype.draw = function() {
  if (!this.game) throw new Error('No Game canvas to render to');
  if (!this.model) throw new Error('No GameModel found to render');

  let { invaders, ship, otherShip, bullets } = this.model;
  let game = this.game;
  
  game.clearRect(0, 0, this.canvas.width, this.canvas.height);

  // Text
  this.drawText('score', 5, 5);
  this.drawText(this.model.score.toString(), 5, 25);
  this.drawText('player ' + this.player, 150, 5);

  for (let row = 0; row < invaders.length; row++) {
    for (let col = 0; col < invaders[row].length; col++) {
      let invader = invaders[row][col];
      if (invader.dead) continue;
      this.drawSprite(
        invader,
        this.tileToPx(col) + this.model.INVADER_MARGIN_X,
        this.tileToPx(row) + this.model.INVADER_MARGIN_Y,
        this.model.COL_SCALE_X,
        this.model.COL_SCALE_Y
      );
    }
  }

  this.drawSprite(ship);
  this.drawSprite(otherShip);
  
  for (let i = 0; i < bullets.length; i++) {
    let bullet = bullets[i];

    if (bullet.direction === 'up') {
      const bulletSprite = bullet.getSprite();
      let bulletBound = game.getImageData(
        this.tileToPx(bullet.colOffset, 1) + this.model.BULLET_MARGIN_X,
        this.tileToPx(bullet.rowOffset, 1) - bulletSprite.h * this.ZOOM_FACTOR,
        bulletSprite.w * this.ZOOM_FACTOR,
        bulletSprite.h * this.ZOOM_FACTOR
      );

      // This reduces an array of RGBa values retrieved from the canvas
      // to its sum. If the total is greater than 0, then the box immediately
      // above the bullet has an object, which means a collision occurred.
      let collide = bulletBound.data.reduce((pixel, current) => pixel + current);
      if (collide) {
        this.sounds[4].play();
        let candidates = this.getCandidatesForCollision(bullet);

        if (candidates.length > 0) {
          let min = Infinity;
          let closest = candidates.filter((c) => {
            if (c.delta < min) {
              min = c.delta;
              return c;
            }
          }).pop().invader;

          // Making sure that the explosion only gets emitted from
          // the player that fired the bullet
          if (bullet.origin === this.model.ship) {
            socket.emit('invaderdeath', {
              row: closest.row,
              col: closest.col
            });
            closest.explode();
          }
          bullet.explode();
          this.model.score += 10 * closest.type + 10;
        }
      }

      this.drawSprite(bullet, this.model.BULLET_MARGIN_X);
    } else {
      const bulletOffsetX = this.tileToPx(bullet.origin.col) 
        + this.model.INVADER_MARGIN_X;
      const bulletOffsetY = this.tileToPx(bullet.origin.row)
        + this.model.INVADER_MARGIN_Y;

      this.drawSprite(
        bullet,
        bulletOffsetX, 
        bulletOffsetY,
        this.model.COL_SCALE_X,
        this.model.COL_SCALE_Y
      );
    }
  }

  // Color overlay for invaders, ship, etc.
  game.globalCompositeOperation = 'source-in';
  const overlay = this.model.getSprite('color_overlay');
  game.drawImage(
    this.spritesheet,
    overlay.x,
    overlay.y,
    overlay.w,
    overlay.h,
    0,
    0,
    this.canvas.width,
    this.canvas.height
  );

  // Reset to default draw operation for next call
  game.globalCompositeOperation = 'source-over';
}

// Returns a GameModel.Invader[] array given a GameModel.Bullet.
// This function takes the current x and y pixel positions for
// both the bullet and each invader and returns candidates that
// are less than 20px away from the bullet.
GameController.prototype.getCandidatesForCollision = function(bullet) {
  let bulletX = this.model.TILE_WIDTH * bullet.colOffset
    + this.model.BULLET_MARGIN_X;
  let bulletY = this.model.TILE_WIDTH * bullet.rowOffset;
  let invaders = this.model.invaders;
  let candidates = [];

  for (let row = 0; row < invaders.length; row++) {
    for (let col = 0; col < invaders[row].length; col++) {
      let currentInvader = invaders[row][col];
      let { colOffset, rowOffset } = currentInvader;

      let invaderTileX = this.model.COL_SCALE_X * colOffset + this.ZOOM_FACTOR * col;
      let invaderTileY = this.model.COL_SCALE_Y * rowOffset + this.ZOOM_FACTOR * row;
      let invaderX = this.tileToPx(invaderTileX, 1) + this.model.INVADER_MARGIN_X;
      let invaderY = this.tileToPx(invaderTileY, 1) + this.model.INVADER_MARGIN_Y;

      let dist = Math.sqrt(
        (bulletX - invaderX) ** 2
        + (bulletY - invaderY) ** 2
      );

      let THRESHOLD = 20;
      if (dist < THRESHOLD && !invaders[row][col].dead) {
        candidates.push({
          invader: invaders[row][col],
          delta: dist
        });
      }
    }
  }
  return candidates;
}

// A function for drawing text onto the canvas
// with characters from the spritesheet.
//
// Accepts the following parameters:
// - `text`: String - the text to be displayed
// - `x`: Number - the x-coordinate where the text should be drawn
// - `y`: Number - the y-coordinate where the text should be drawn
GameController.prototype.drawText = function(text, x, y) {
  text.split('').forEach((char, letterPos) => {
    if (char === ' ') return;
    const sprite = this.model.getSprite('abc_' + char);
    this.game.drawImage(
      this.spritesheet,
      sprite.x,
      sprite.y,
      sprite.w,
      sprite.h,
      x + sprite.w * this.ZOOM_FACTOR * letterPos,
      y,
      sprite.w * this.ZOOM_FACTOR,
      sprite.h * this.ZOOM_FACTOR
    );
  });
}

// A function for drawing entities from the GameModel
// onto the GameController.game (a CanvasRenderingContext2D).
//
// Accepts the following parameters:
// - `modelObj`: [GameModel.Invader, GameModel.Ship, GameModel.Bullet]
// - `xOffset`: Number - The pixel x offset to be added to the destination coordinates
// - `yOffset`: Number - The pixel y offset to be added to the destination coordinates
// - `colMultiple`: Number - The conversion scaling factor for columns
// - `rowMultiple`: Number - The conversion scaling factor for rows
GameController.prototype.drawSprite = function(
  modelObj,
  xOffset = 0,
  yOffset = 0,
  colMultiple = 1,
  rowMultiple = 1,
) {
  const sprite = modelObj.getSprite();

  this.game.drawImage(
    this.spritesheet,
    sprite.x, // Spritesheet source x
    sprite.y, // Spritesheet source y
    sprite.w, // Spritesheet source width
    sprite.h, // Spritesheet source height
    this.tileToPx(modelObj.colOffset, colMultiple) + xOffset, // Canvas destination x
    this.tileToPx(modelObj.rowOffset, rowMultiple) + yOffset, // Canvas destination y
    sprite.w * this.ZOOM_FACTOR, // Canvas destination width
    sprite.h * this.ZOOM_FACTOR // Canvas destination height
  );
}

// A function to convert a "tile" (column or row) value to 
// pixels by a scaling factor that defaults to the game's default
// zoom factor (GameController.ZOOM_FACTOR).
//
// Accepts the following parameters:
// - `colOrRow`: Number - The column or row value or offset value
// - `multiple`: Number - The conversion scaling factor for a column/row value or
//               offset value.
//
// Returns a Number that corresponds to the converted pixel value.
GameController.prototype.tileToPx = function(colOrRow, multiple = this.ZOOM_FACTOR) {
  return colOrRow * multiple * this.model.TILE_WIDTH;
}
