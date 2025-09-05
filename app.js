const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const fileupload = require('express-fileupload');
const errorHandler = require('./middlewares/error');
const setupSwagger = require('./config/swagger'); // Add this line

// Route files
const auth = require('./routes/authRoutes');
const users = require('./routes/userRoutes');
const perfumes = require('./routes/perfumeRoutes');
const categories = require('./routes/categoryRoutes');
const cart = require('./routes/cartRoutes');
const admin = require('./routes/adminRoutes');
const orders = require('./routes/orderRoutes');
const analytics = require('./routes/analyticsRoutes');

const app = express();

// Body parser
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// File uploading
app.use(fileupload());

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Enable CORS
app.use(cors());

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Setup Swagger
setupSwagger(app); // Add this line

// Mount routers
app.use('/api/v1/auth', auth);
app.use('/api/v1/users', users);
app.use('/api/v1/perfumes', perfumes);
app.use('/api/v1/categories', categories);
app.use('/api/v1/cart', cart);
app.use('/api/v1/admin', admin);
app.use('/api/v1/orders', orders);
app.use('/api/v1/admin/analytics', analytics);

// Error handler
app.use(errorHandler);

module.exports = app;