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
  // Level 0–10 per character; progress 0–(MESSAGES_PER_LEVEL-1) toward next level
  characterLevel: Object,       // { [characterId]: 0..10 }
  characterLevelProgress: Object, // { [characterId]: 0..9 }
  dailyMissions: {
    lastReset: Date,
    completed: [String],
    progress: Object
  },
  lastAICall: Date, // For rate limiting
  aiCallCount: { type: Number, default: 0 }, // Daily AI call counter
  aiCallResetDate: Date // Date when counter was last reset
}, { strict: false });

// Character schema; photos can be string (URL) or { url, requiredLevel }
const charSchema = new mongoose.Schema({
  name: String,
  age: Number,
  avatarUrl: String,
  photos: [mongoose.Schema.Types.Mixed],
  bio: String,
  personality: String,
  welcomeMessage: String,
  isActive: Boolean
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Character = mongoose.models.Character || mongoose.model('Character', charSchema);

module.exports = { User, Character };
