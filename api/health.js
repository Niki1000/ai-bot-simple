const mongoose = require('mongoose');

module.exports = async (req, res) => {
  try {
    const health = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'AI Dating Bot API',
      environment: process.env.NODE_ENV || 'development',
      endpoints: {
        bot: 'POST /telegram-webhook',
        health: 'GET /api/health',
        webapp: 'GET /api/webapp/*',
        main: 'GET /'
      }
    };
    
    // Проверка MongoDB
    if (process.env.MONGODB_URI) {
      health.mongodb = {
        connected: mongoose.connection.readyState === 1,
        readyState: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState]
      };
    }
    
    // Проверка Telegram бота
    health.telegram = {
      token_set: !!process.env.TELEGRAM_BOT_TOKEN,
      token_length: process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_TOKEN.length : 0
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(health);
    
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};