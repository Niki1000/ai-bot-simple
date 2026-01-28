const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { recalculateSympathy } = require('../utils');
const connectDB = require('../db');

// POST add credits (for testing/demo)
router.post('/add-credits', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, amount } = req.body;
    
    let user = await User.findOne({ telegramId: parseInt(telegramId) });
    
    if (!user) {
      return res.json({ success: false, error: 'User not found' });
    }
    
    user.credits = (user.credits || 0) + (amount || 50);
    await user.save();
    
    console.log(`✅ Added ${amount || 50} credits to user ${telegramId}. Total: ${user.credits}`);
    
    res.json({ success: true, credits: user.credits });
  } catch (e) {
    console.error('❌ Add credits error:', e);
    res.json({ success: false, error: e.message });
  }
});

// POST recalculate sympathy
router.post('/recalculate-sympathy', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, characterId } = req.body;
    
    console.log(`🔄 Recalculating sympathy for user ${telegramId}, char ${characterId}`);
    
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    
    if (!user) {
      return res.json({ success: false, error: 'User not found' });
    }
    
    if (!user.chatHistory || !user.chatHistory[characterId]) {
      return res.json({ 
        success: true, 
        sympathy: 0,
        message: 'No chat history found' 
      });
    }
    
    // Recalculate sympathy from all messages
    const newSympathy = recalculateSympathy(user.chatHistory[characterId]);
    
    // Update sympathy
    if (!user.sympathy) user.sympathy = {};
    user.sympathy[characterId] = newSympathy;
    user.markModified('sympathy');
    await user.save();
    
    console.log(`✅ Recalculated sympathy: ${newSympathy}`);
    
    res.json({
      success: true,
      sympathy: newSympathy,
      messageCount: user.chatHistory[characterId].filter(m => m.sender === 'user').length
    });
  } catch (e) {
    console.error('❌ Recalculate sympathy error:', e);
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
