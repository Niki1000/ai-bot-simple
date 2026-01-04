// Telegram Web App API
const tg = window.Telegram.WebApp;
tg.expand(); // Разворачиваем на весь экран

// Инициализация приложения
tg.ready();
tg.setHeaderColor('#667eea');
tg.setBackgroundColor('#667eea');

// DOM элементы
const userInfoEl = document.getElementById('userInfo');
const charactersListEl = document.getElementById('charactersList');
const profileInfoEl = document.getElementById('profileInfo');
const messagesEl = document.getElementById('messages');
const messageInputEl = document.getElementById('messageInput');

// Инициализация чата
let selectedCharacterId = null;

// Загрузка данных пользователя
async function loadUserData() {
    try {
        const userId = tg.initDataUnsafe?.user?.id || 1069404536;
        
        const response = await fetch(`/api/user/${userId}`);
        if (!response.ok) throw new Error('Ошибка загрузки данных');
        
        const userData = await response.json();
        
        userInfoEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                    ${userData.firstName ? userData.firstName[0].toUpperCase() : 'U'}
                </div>
                <div>
                    <strong>${userData.firstName || 'Пользователь'}</strong>
                    <div style="font-size: 12px; margin-top: 2px;">ID: ${userId}</div>
                </div>
            </div>
        `;
        
        profileInfoEl.innerHTML = `
            <div class="profile-info">
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
                    <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold;">
                        ${userData.firstName ? userData.firstName[0].toUpperCase() : 'U'}
                    </div>
                    <div>
                        <h3 style="margin: 0; color: #333;">${userData.firstName || 'Пользователь'}</h3>
                        <p style="margin: 5px 0 0; color: #666; font-size: 14px;">В системе с: ${new Date(userData.createdAt).toLocaleDateString('ru-RU')}</p>
                    </div>
                </div>
                
                <div class="stats">
                    <div class="stat-item">
                        <div class="stat-value">${userData.trustLevel || 0}</div>
                        <div class="stat-label">Уровень доверия</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${userData.photoRequests || 0}</div>
                        <div class="stat-label">Запросов фото</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${userData.totalMessages || 0}</div>
                        <div class="stat-label">Сообщений</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${userData.characterId ? '🎭' : '—'}</div>
                        <div class="stat-label">Персонаж</div>
                    </div>
                </div>
            </div>
        `;
        
        selectedCharacterId = userData.characterId;
        
    } catch (error) {
        console.error('Ошибка загрузки данных пользователя:', error);
        userInfoEl.innerHTML = '<div style="color: #f5576c;">Ошибка загрузки данных</div>';
        profileInfoEl.innerHTML = '<p style="color: #f5576c;">Не удалось загрузить профиль</p>';
    }
}

// Загрузка персонажей
async function loadCharacters() {
    try {
        const response = await fetch('/api/characters');
        if (!response.ok) throw new Error('Ошибка загрузки персонажей');
        
        const characters = await response.json();
        
        if (characters.length === 0) {
            charactersListEl.innerHTML = '<p style="text-align: center; color: #666;">Нет доступных персонажей</p>';
            return;
        }
        
        charactersListEl.innerHTML = characters.map(character => `
            <div class="character-card" onclick="selectCharacter('${character._id}', '${character.name}')" 
                 style="${selectedCharacterId === character._id ? 'border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);' : ''}">
                <h3>${character.name}, ${character.age}</h3>
                <p>${character.description}</p>
                <div class="trust-level">
                    <span>🔒 Требуется доверие: ${character.trustRequired || 0}</span>
                </div>
                ${selectedCharacterId === character._id ? '<div style="margin-top: 10px; color: #667eea; font-weight: bold;">✓ Выбран</div>' : ''}
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Ошибка загрузки персонажей:', error);
        charactersListEl.innerHTML = '<p style="color: #f5576c; text-align: center;">Не удалось загрузить персонажей</p>';
    }
}

// Выбор персонажа
async function selectCharacter(characterId, characterName) {
    try {
        const userId = tg.initDataUnsafe?.user?.id || 1069404536;
        
        const response = await fetch('/api/select-character', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                userId: userId,
                characterId: characterId 
            })
        });
        
        if (!response.ok) throw new Error('Ошибка выбора персонажа');
        
        selectedCharacterId = characterId;
        
        // Обновляем UI
        await loadCharacters();
        await loadUserData();
        
        // Добавляем системное сообщение
        addMessage(`Вы выбрали персонажа: ${characterName}. Теперь вы можете начать общение!`, 'bot');
        
        tg.showAlert(`✅ Вы выбрали ${characterName}!`);
        
    } catch (error) {
        console.error('Ошибка:', error);
        tg.showAlert('❌ Ошибка при выборе персонажа');
    }
}

// Отправка сообщения
async function sendMessage() {
    const message = messageInputEl.value.trim();
    if (!message) return;
    
    // Добавляем сообщение пользователя
    addMessage(message, 'user');
    messageInputEl.value = '';
    
    // Показываем индикатор загрузки
    const loadingMessage = addMessage('🤔 Думаю...', 'bot');
    
    try {
        const userId = tg.initDataUnsafe?.user?.id || 1069404536;
        
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                userId: userId,
                message: message,
                characterId: selectedCharacterId 
            })
        });
        
        if (!response.ok) throw new Error('Ошибка отправки сообщения');
        
        const data = await response.json();
        
        // Удаляем индикатор загрузки
        loadingMessage.remove();
        
        // Добавляем ответ
        addMessage(data.response || 'Извините, произошла ошибка', 'bot');
        
    } catch (error) {
        console.error('Ошибка:', error);
        loadingMessage.remove();
        addMessage('Извините, произошла ошибка. Попробуйте позже.', 'bot');
        tg.showAlert('❌ Ошибка отправки сообщения');
    }
}

// Добавление сообщения в чат
function addMessage(text, sender) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${sender}`;
    messageEl.textContent = text;
    messagesEl.appendChild(messageEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return messageEl;
}

// Обработка нажатия Enter
messageInputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Инициализация при загрузке страницы
async function initApp() {
    // Проверяем, запущено ли в Telegram Web App
    if (window.Telegram && window.Telegram.WebApp) {
        console.log('Запущено в Telegram Web App');
        tg.MainButton.hide();
    } else {
        console.log('Запущено в браузере, режим разработки');
        // Симуляция данных для разработки
        if (!tg.initDataUnsafe) {
            tg.initDataUnsafe = {
                user: {
                    id: 1069404536,
                    first_name: 'Разработчик',
                    last_name: 'Тестовый'
                }
            };
        }
    }
    
    await loadUserData();
    await loadCharacters();
    
    // Добавляем приветственное сообщение
    setTimeout(() => {
        addMessage('Привет! 👋 Я AI Dating Bot. Выберите персонажа для начала общения.', 'bot');
    }, 500);
}

// Запускаем приложение
document.addEventListener('DOMContentLoaded', initApp);