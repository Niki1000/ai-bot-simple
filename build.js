const fs = require('fs-extra');
const path = require('path');

async function build() {
  console.log('🚀 Начинаем сборку проекта...');
  
  // Копируем public папку в dist
  if (fs.existsSync('public')) {
    await fs.copy('public', 'dist/public');
    console.log('✅ Скопирована папка public в dist/public');
  }
  
  // Копируем .env.example если нет .env
  if (fs.existsSync('.env.example') && !fs.existsSync('.env')) {
    await fs.copy('.env.example', '.env');
    console.log('✅ Скопирован .env.example в .env');
  }
  
  console.log('🎉 Сборка завершена!');
}

build().catch(console.error);