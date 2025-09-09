const { Server } = require('socket.io');

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    // Existing rooms
    socket.on('join_product', (productId) => {
      socket.join(`product_${productId}`);
    });

    socket.on('leave_product', (productId) => {
      socket.leave(`product_${productId}`);
    });

    socket.on('join_order', (orderId) => {
      socket.join(`order_${orderId}`);
    });

    socket.on('leave_order', (orderId) => {
      socket.leave(`order_${orderId}`);
    });

    // New: analytics room for admin dashboard
    socket.on('join_analytics', () => {
      socket.join('analytics');
    });

    socket.on('leave_analytics', () => {
      socket.leave('analytics');
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

// Existing emitter examples
function emitOrderPaymentUpdate(orderId, payload) {
  if (!io) return;
  io.to(`order_${orderId}`).emit('order_payment_update', payload);
}

// New: analytics update emitter
function emitAnalyticsUpdate(payload) {
  if (!io) return;
  io.to('analytics').emit('analytics_update', payload);
}

module.exports = {
  initSocket,
  getIO,
  emitOrderPaymentUpdate,
  emitAnalyticsUpdate,
};