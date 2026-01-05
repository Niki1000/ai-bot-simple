// api/health.js - проверка здоровья
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'AI Dating Bot',
    endpoints: {
      bot: 'POST /api/bot',
      health: 'GET /api/health',
      main: 'GET /'
    },
    environment: process.env.NODE_ENV || 'development'
  });
};