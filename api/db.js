const mongoose = require('mongoose');

const mongoUrl = process.env.MONGODB_URI;

async function connectDB() {
  if (mongoose.connection.readyState >= 1) {return;}
  await mongoose.connect(mongoUrl);
  console.log('✅ DB connected');
}

module.exports = connectDB;
