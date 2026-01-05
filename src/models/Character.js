const mongoose = require('mongoose');

const CharacterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  age: {
    type: Number,
    required: true,
    min: 18,
    max: 60
  },
  description: {
    type: String,
    required: true
  },
  personality: {
    type: String,
    required: true
  },
  avatarUrl: {
    type: String,
    default: 'https://i.pravatar.cc/150'
  },
  welcomeMessage: {
    type: String,
    default: 'Привет! Рада познакомиться! 😊'
  },
  bio: {
    type: String,
    default: 'Интересный персонаж для общения'
  },
  trustRequired: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  photoLimit: {
    type: Number,
    default: 3,
    min: 1,
    max: 10
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Character', CharacterSchema);