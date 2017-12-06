# spaceinvaders
Space Invaders 2-player game! :rocket:

## Project Structure
* `public/` - contains all the game files
  * :star: **`EventController.js`** - registers Keyboard events (keydown/keyup) and maps them to game-related functions
  * :star: **`GameController.js`** - handles all display logic and static assets for the game based on the state of a `GameModel`
  * :star: **`GameModel.js`** - contains all state for the game, including player/invader/bullet positions and statuses
  * `game.html` - static page to load in the above JavaScript to play the game
  * `index.html` - static landing page that has a button to a new (randomized) game link
  * `static/*` - static resources: spritesheet, spritesheet JSON, and all audio files <sub>_Note: these resources are not mine - they are from a Space Invaders game found on Messenger Instant Games.
   They are reproduced here for educational purposes only._</sub>
* `app.js` - the Express web server that has one route defined for the game at `/play/:id`, where `id` is the unique ID for a room 
* `events.js` - the WebSockets server to pass event data between clients
