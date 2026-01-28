const express = require('express');
const app = express();
app.use(express.json());
app.use(express.static('public'));

// Import routes
const charactersRoutes = require('./routes/characters');
const userRoutes = require('./routes/user');
const matchesRoutes = require('./routes/matches');
const messagesRoutes = require('./routes/messages');
const chatRoutes = require('./routes/chat');
const photosRoutes = require('./routes/photos');
const creditsRoutes = require('./routes/credits');
const missionsRoutes = require('./routes/missions');

// Mount routes
app.use('/api/webapp/characters', charactersRoutes);
app.use('/api/webapp/user', userRoutes);
app.use('/api/webapp', matchesRoutes);
app.use('/api/webapp', messagesRoutes);
app.use('/api/webapp', chatRoutes);
app.use('/api/webapp', photosRoutes);
app.use('/api/webapp', creditsRoutes);
app.use('/api/webapp', missionsRoutes);

// Seed endpoint
app.post('/api/seed', async (req, res) => {
  try {
    const { handleSeed } = require('./seed');
    await handleSeed(req, res);
  } catch (error) {
    console.error('❌ Seed endpoint error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Telegram webhook
app.post('/api/webhook', async (req, res) => {
  try {
    const { handleUpdate } = require('./bot');
    await handleUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = app;
