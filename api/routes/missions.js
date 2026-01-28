const express = require('express');
const router = express.Router();
const { User } = require('../models');
const connectDB = require('../db');

// POST claim mission rewards
router.post('/claim-mission-rewards', async (req, res) => {
  try {
    await connectDB();
    const { telegramId, missionIds, totalReward } = req.body;
    
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    if (!user) {
      return res.json({ success: false, error: 'User not found' });
    }

    // Initialize dailyMissions if needed
    if (!user.dailyMissions) {
      user.dailyMissions = {
        lastReset: new Date(),
        completed: [],
        progress: {}
      };
    }

    // Add completed missions
    if (!user.dailyMissions.completed) {
      user.dailyMissions.completed = [];
    }
    
    missionIds.forEach(missionId => {
      if (!user.dailyMissions.completed.includes(missionId)) {
        user.dailyMissions.completed.push(missionId);
      }
    });

    // Add credits
    user.credits = (user.credits || 0) + totalReward;
    
    // Update last reset date if needed
    const today = new Date().toDateString();
    const lastReset = user.dailyMissions.lastReset ? new Date(user.dailyMissions.lastReset).toDateString() : null;
    if (lastReset !== today) {
      user.dailyMissions.lastReset = new Date();
      user.dailyMissions.completed = missionIds; // Reset for new day
    }

    user.markModified('dailyMissions');
    await user.save();

    console.log(`✅ Mission rewards claimed: ${totalReward} credits for missions: ${missionIds.join(', ')}`);

    res.json({
      success: true,
      credits: user.credits,
      dailyMissions: user.dailyMissions
    });
  } catch (e) {
    console.error('❌ Claim mission rewards error:', e);
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
