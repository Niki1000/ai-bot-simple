// api/health.js - отдельный health check
module.exports = (req, res) => {
  console.log('🏥 Health check called');
  
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      telegram: !!process.env.TELEGRAM_BOT_TOKEN,
      vercel: true
    }
  });
};