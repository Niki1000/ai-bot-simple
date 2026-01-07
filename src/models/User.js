const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true
  },
  username: String,
  firstName: String,
  lastName: String,
  characterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Character'
  },
  trustLevel: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  photoRequests: {
    type: Number,
    default: 0
  },
  totalMessages: {
    type: Number,
    default: 0
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  selectedGirl: String,  // Current girl name
  sympathy: {  // {girlId: score}
    type: Map, of: Number, default: {}
  },
  unlockedPhotos: {  // {girlId: [photoUrls]}
    type: Map, of: [String], default: {}
  },
});

module.exports = mongoose.model('User', UserSchema);