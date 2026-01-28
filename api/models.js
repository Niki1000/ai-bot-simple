const mongoose = require('mongoose');

// User schema
const userSchema = new mongoose.Schema({
  telegramId: Number,
  selectedGirl: String,
  likes: [String],
  passes: [String],
  sympathy: Object,
  chatHistory: Object,
  unlockedPhotos: Object,
  totalMessages: Number,
  subscriptionLevel: { type: String, default: 'free' },
  credits: { type: Number, default: 0 },
  dailyMissions: {
    lastReset: Date,
    completed: [String],
    progress: Object
  },
  lastAICall: Date, // For rate limiting
  aiCallCount: { type: Number, default: 0 }, // Daily AI call counter
  aiCallResetDate: Date // Date when counter was last reset
}, { strict: false });

// Character schema
const charSchema = new mongoose.Schema({
  name: String,
  age: Number,
  avatarUrl: String,
  photos: [String],
  bio: String,
  personality: String,
  welcomeMessage: String,
  isActive: Boolean
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Character = mongoose.models.Character || mongoose.model('Character', charSchema);

module.exports = { User, Character };
