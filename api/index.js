// api/index.js - главная страница
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>🤖 AI Dating Bot - РАБОТАЕТ</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          min-height: 100vh;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 30px;
          background: rgba(255,255,255,0.1);
          border-radius: 20px;
          backdrop-filter: blur(10px);
        }
        h1 { font-size: 48px; margin: 0 0 20px 0; }
        .status {
          background: rgba(0,255,0,0.2);
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
          border-left: 5px solid green;
        }
        .btn {
          display: inline-block;
          background: white;
          color: #667eea;
          padding: 15px 30px;
          border-radius: 10px;
          text-decoration: none;
          font-weight: bold;
          margin: 10px 10px 10px 0;
        }
        .btn-telegram { background: #0088cc; color: white; }
        code { background: rgba(0,0,0,0.3); padding: 5px; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>✅ AI Dating Bot РАБОТАЕТ</h1>
        
        <div class="status">
          <h3>📊 СИСТЕМА В РАБОЧЕМ СОСТОЯНИИ</h3>
          <p>Время: ${new Date().toLocaleString('ru-RU')}</p>
          <p>Сервер: Vercel ▲</p>
        </div>
        
        <h3>🚀 Что работает:</h3>
        <ul>
          <li><strong>Telegram бот</strong> - отвечает на команды</li>
          <li><strong>Вебхук</strong> - подключен к Vercel</li>
          <li><strong>Web App</strong> - кнопка в Telegram</li>
          <li><strong>API</strong> - все эндпоинты активны</li>
        </ul>
        
        <h3>📱 Проверьте бота:</h3>
        <p>Откройте Telegram и отправьте боту:</p>
        <p><code>/start</code> - проверка работы</p>
        <p><code>/girls</code> - список персонажей</p>
        <p><code>/profile</code> - ваш профиль</p>
        
        <div style="margin-top: 30px;">
          <a href="https://t.me/your_bot" class="btn btn-telegram">📱 Открыть в Telegram</a>
          <button onclick="testAPI()" class="btn">🔍 Проверить API</button>
        </div>
        
        <div id="api-status" style="margin-top: 20px; padding: 15px; border-radius: 10px; background: rgba(0,0,0,0.2);">
          <!-- Статус API появится здесь -->
        </div>
      </div>
      
      <script>
        async function testAPI() {
          const statusEl = document.getElementById('api-status');
          try {
            const res = await fetch('/api/health');
            const data = await res.json();
            statusEl.innerHTML = \`
              <h4>✅ API РАБОТАЕТ</h4>
              <p>Статус: <strong>\${data.status}</strong></p>
              <p>Время: \${new Date(data.timestamp).toLocaleString('ru-RU')}</p>
            \`;
          } catch(e) {
            statusEl.innerHTML = \`
              <h4>❌ Ошибка API</h4>
              <p>\${e.message}</p>
            \`;
          }
        }
        
        // Автопроверка при загрузке
        setTimeout(testAPI, 1000);
      </script>
    </body>
    </html>
  `);
};