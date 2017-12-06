let express = require('express');
let path = require('path');
let logger = require('morgan');
let bodyParser = require('body-parser');
let app = express();
let IS_DEV = app.get('env') === 'development';

app.use(logger('combined'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'hbs');

app.get('/play/:id', (req, res, next) => {
  res.sendFile(path.join(__dirname, 'public/game.html'));
});

app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.json({
    message: err.message,
    error: IS_DEV ? err : {}
  });
});

module.exports = app;
