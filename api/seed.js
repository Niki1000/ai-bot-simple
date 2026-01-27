const seedDatabase = require('../src/seed');
const mongoose = require('mongoose');

// API endpoint handler for seeding (can be called via HTTP)
async function handleSeed(req, res) {
  try {
    // Connect to DB if not already connected
    if (mongoose.connection.readyState === 0) {
      if (!process.env.MONGODB_URI) {
        return res.status(500).json({ 
          success: false, 
          error: 'MONGODB_URI not configured' 
        });
      }
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // Run seed function
    await seedDatabase();
    
    res.json({ 
      success: true, 
      message: 'Database seeded successfully' 
    });
  } catch (error) {
    console.error('❌ Seed API error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

module.exports = { handleSeed };
