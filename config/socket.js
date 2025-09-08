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

    // Clients can join order rooms to receive payment/status updates for a particular order
    socket.on('join_order', (orderId) => {
      if (orderId) socket.join(`order:${orderId}`);
    });
    socket.on('leave_order', (orderId) => {
      if (orderId) socket.leave(`order:${orderId}`);
    });
  });
  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

// Helper to emit order payment updates
function emitOrderPaymentUpdate(orderId, payload) {
  if (!io) return;
  io.to(`order:${orderId}`).emit('order:payment_update', payload);
}

module.exports = { init, getIO, emitOrderPaymentUpdate };