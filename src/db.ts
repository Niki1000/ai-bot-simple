import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-dating-bot';

export const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    if (process.env.NODE_ENV === 'production') {
      console.error('Continuing without MongoDB');
    } else {
      process.exit(1);
    }
  }
};

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
});

export default mongoose;