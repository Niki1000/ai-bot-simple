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
  if (!chatHistory || !Array.isArray(chatHistory)) return 0;
  
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

module.exports = { calculateSympathyPoints, recalculateSympathy };
