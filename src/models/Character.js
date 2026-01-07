const mongoose = require('mongoose');

const CharacterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Number, required: true },
  description: String,
  photos: [String],  // Photo URLs, unlock sequentially
  avatarUrl: String,
  welcomeMessage: String,
  bio: String,
  baseSympathyReq: { type: Number, default: 10 },  // Sympathy needed for first photo
  photoUnlockChance: { type: Number, default: 0.3 },  // 30% base chance
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Character', CharacterSchema);
