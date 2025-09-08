let io;

function init(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });
  io.on('connection', (socket) => {
    // Clients can join product rooms to receive updates for a particular product
    socket.on('join_product', (productId) => {
      if (productId) socket.join(`product:${productId}`);
    });
    socket.on('leave_product', (productId) => {
      if (productId) socket.leave(`product:${productId}`);
    });
  });
  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

module.exports = { init, getIO };