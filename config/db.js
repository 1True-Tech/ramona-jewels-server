const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Debug: Log the connection string (remove after testing)
    console.log('Connected to MongoDB:');
    
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000 // 5 seconds timeout
    });

    // console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;