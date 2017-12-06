const _ = require('lodash');

module.exports = function(server, app) {
  let io = require('socket.io')(server);
  io.on('connection', function(socket) {
    let origin = socket.handshake.headers.referer;
    let room = origin.substring(origin.lastIndexOf('/') + 1);
    socket.join(room);

    if (!socket.adapter.rooms[room].readies) {
      socket.adapter.rooms[room].readies = [];
    }

    let ready = socket.adapter.rooms[room].readies;
    let currentSockets = socket.adapter.rooms[room].sockets;
    let currentConnected = _.filter(currentSockets, s => s);

    console.log(currentConnected.length + ' connected to ' + room);
    if (currentConnected.length === 2) {
      socket.emit('ready');
      socket.to(room).emit('ready');
    }

    socket.on('ready', () => {
      ready.push(socket.id);
      if (ready.length === 1) {
        socket.emit('player', 1);
      }
      if (ready.length === 2) {
        socket.emit('player', 2);
        setTimeout(() => {
          socket.emit('start');
          socket.to(room).emit('start');
        }, 5000);
      }
    });

    socket.on('bullet', bullet => {
      socket.to(room).emit('bullet', bullet)
    });

    socket.on('invaderdeath', invaderData => {
      socket.to(room).emit('invaderdeath', invaderData);
    });

    socket.on('shipmove', direction => {
      socket.to(room).emit('shipmove', direction);
    });

    socket.on('disconnect', () => {

    });

  });

}
