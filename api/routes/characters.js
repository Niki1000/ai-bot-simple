const express = require('express');
const router = express.Router();
const { User, Character } = require('../models');
const connectDB = require('../db');

// GET characters - filter out already liked characters with chat history
router.get('/', async (req, res) => {
  try {
    await connectDB();
    const telegramId = req.query.telegramId ? parseInt(req.query.telegramId) : null;
    
    let chars = await Character.find({ isActive: true });
    console.log(`✅ Found ${chars.length} characters`);
    
    // If telegramId provided, filter out characters that are liked AND have chat history
    if (telegramId) {
      const user = await User.findOne({ telegramId });
      
      if (user && user.likes && user.likes.length > 0 && user.chatHistory) {
        // Filter out characters that are in likes AND have chat history
        const likedWithChat = user.likes.filter(charId => {
          return user.chatHistory[charId] && user.chatHistory[charId].length > 0;
        });
        
        // Remove characters that are liked and have chat
        chars = chars.filter(char => {
          const charIdStr = char._id.toString();
          const isLiked = user.likes.includes(charIdStr);
          const hasChat = user.chatHistory[charIdStr] && user.chatHistory[charIdStr].length > 0;
          
          // Exclude if both liked AND has chat history
          return !(isLiked && hasChat);
        });
        
        console.log(`🔍 Filtered: ${likedWithChat.length} characters removed (liked + chat exists)`);
        console.log(`✅ Returning ${chars.length} characters for swipe`);
      }
    }
    
    res.json({ success: true, characters: chars });
  } catch (e) {
    console.error('❌ Characters error:', e);
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
