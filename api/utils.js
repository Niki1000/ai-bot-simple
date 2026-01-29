// Helper function to calculate sympathy points from message
function calculateSympathyPoints(message) {
  const messageLength = message.trim().length;
  let points = 1; // Base value
  
  // Weight by message length (longer messages = more engagement)
  if (messageLength < 10) {
    points = 0.5; // Very short messages (like "ok", "да")
  } else if (messageLength < 30) {
    points = 1; // Short messages (normal)
  } else if (messageLength < 100) {
    points = 1.5; // Medium messages (thoughtful)
  } else if (messageLength < 200) {
    points = 2; // Long messages (very engaged)
  } else {
    points = 2.5; // Very long messages (highly engaged)
  }
  
  return points;
}

// Helper function to recalculate sympathy from all messages
function recalculateSympathy(chatHistory) {
  if (!chatHistory || !Array.isArray(chatHistory)) {return 0;}
  
  let totalSympathy = 0;
  const now = new Date();
  
  chatHistory.forEach(msg => {
    if (msg.sender === 'user' && msg.message) {
      const basePoints = calculateSympathyPoints(msg.message);
      
      // Time-based weighting: recent messages count more
      let timeMultiplier = 1.0;
      if (msg.timestamp) {
        const messageTime = new Date(msg.timestamp);
        const hoursSinceMessage = (now - messageTime) / (1000 * 60 * 60);
        
        if (hoursSinceMessage < 1) {
          timeMultiplier = 1.0; // Full weight for very recent
        } else if (hoursSinceMessage < 24) {
          timeMultiplier = 0.9; // Slightly less for same day
        } else if (hoursSinceMessage < 168) { // 7 days
          timeMultiplier = 0.7; // Less for this week
        } else {
          timeMultiplier = 0.5; // Much less for older messages
        }
      }
      
      totalSympathy += basePoints * timeMultiplier;
    }
  });
  
  return Math.round(totalSympathy * 10) / 10; // Round to 1 decimal
}

// Daily limits by subscription plan (messages and photo requests per day)
const DAILY_LIMITS = {
  free: { messages: 50, photos: 2 },
  pro: { messages: 200, photos: 14 },
  gold: { messages: 500, photos: 28 },
  premium: { messages: 1000, photos: 50 } // alias for backward compat
};

function getDailyLimits(subscriptionLevel) {
  const key = (subscriptionLevel || 'free').toLowerCase();
  return DAILY_LIMITS[key] || DAILY_LIMITS.free;
}

function getTodayString() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Ensure user has daily usage for today; reset if new day. Modifies user in place.
function ensureDailyUsage(user) {
  const today = getTodayString();
  if (!user.dailyUsageDate || user.dailyUsageDate !== today) {
    user.dailyUsageDate = today;
    user.messagesSentToday = 0;
    user.photosRequestedToday = 0;
    user.markModified('dailyUsageDate');
    user.markModified('messagesSentToday');
    user.markModified('photosRequestedToday');
  }
  return user;
}

module.exports = { calculateSympathyPoints, recalculateSympathy, getDailyLimits, getTodayString, ensureDailyUsage };
