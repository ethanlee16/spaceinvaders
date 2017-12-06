function EventController() {
  this.events = {};
  this.keys = {};
  document.addEventListener('keydown', (e) => this.eventHandler(e));
  document.addEventListener('keyup', (e) => this.eventHandler(e));
}

EventController.prototype.registerEvent = function(key, fn, stopFn) {
  if (key === 'left') key = 37;
  if (key === 'up') key = 38;
  if (key === 'right') key = 39;
  if (key === 'down') key = 40;
  if (key === 'space') key = 32;

  this.events[key] = fn;
  this.events[key + 'stop'] = stopFn;
}

EventController.prototype.eventHandler = function(e) {
  let currentState = this.keys[e.keyCode];
  let startFn = this.events[e.keyCode];
  let stopFn = this.events[e.keyCode + 'stop'];

  if (!startFn) return;
  if (currentState === e.type) return;

  this.keys[e.keyCode] = e.type;

  if (this.keys[e.keyCode] === 'keydown') this.events[e.keyCode](e);
  if (this.keys[e.keyCode] === 'keyup' && stopFn) stopFn(e);
  
  
}
