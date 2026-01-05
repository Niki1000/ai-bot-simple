// Telegram Web App API
const tg = window.Telegram.WebApp;

// Глобальные переменные
let selectedCharacterId = null;
let selectedCharacter = null;
let currentUser = null;

// Инициализация приложения
function initApp() {
    console.log('🚀 Инициализация Web App...');
    
    // Разворачиваем на весь экран
    tg.expand();
    
    // Настраиваем цвета
    tg.setHeaderColor('#667eea');
    tg.setBackgroundColor('#667eea');
    
    // Прячем основную кнопку
    tg.MainButton.hide();
    
    // Загружаем данные
    loadUserData();
    loadCharacters();
    loadProfileStats();
    
    // Проверяем, запущено ли в Telegram
    if (tg.initDataUnsafe?.user) {
        console.log('✅ Запущено в Telegram Web App');
        document.getElementById('userName').textContent = tg.initDataUnsafe.user.first_name || 'Пользователь';
    } else {
        console.log('🌐 Запущено в браузере');
        document.getElementById('userName').textContent = 'Гость';
    }
    
    // Добавляем приветственное сообщение
    addMessage('Привет! 👋 Я AI Dating Bot. Выбери персонажа для начала общения!', 'bot');
}

// Загрузка данных пользователя
async function loadUserData() {
    try {
        const telegramId = tg.initDataUnsafe?.user?.id || 0;
        
        if (telegramId) {
            const response = await fetch(`/api/webapp/user/${telegramId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    currentUser = data.user;
                    
                    // Обновляем UI
                    document.getElementById('userName').textContent = currentUser.firstName || 'Пользователь';
                    document.getElementById('userLevel').textContent = currentUser.trustLevel || 0;
                    
                    if (currentUser.character) {
                        selectedCharacterId = currentUser.characterId;
                        selectedCharacter = currentUser.character;
                        document.getElementById('selectedCharacter').textContent = currentUser.character.name;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки пользователя:', error);
        showError('Не удалось загрузить данные пользователя');
    }
}

// Загрузка персонажей
async function loadCharacters() {
    const charactersGrid = document.getElementById('charactersGrid');
    charactersGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Загрузка персонажей...</div>';
    
    try {
        const response = await fetch('/api/webapp/characters');
        const data = await response.json();
        
        if (data.success) {
            charactersGrid.innerHTML = '';
            
            if (data.characters.length === 0) {
                charactersGrid.innerHTML = '<div class="error">Нет доступных персонажей</div>';
                return;
            }
            
            data.characters.forEach(character => {
                const isSelected = selectedCharacterId === character._id;
                
                const characterCard = document.createElement('div');
                characterCard.className = `character-card ${isSelected ? 'selected' : ''}`;
                characterCard.innerHTML = `
                    <div class="character-avatar">
                        ${character.avatarUrl ? 
                          `<img src="${character.avatarUrl}" alt="${character.name}">` : 
                          `<i class="fas fa-user"></i>`}
                    </div>
                    <div class="character-name">${character.name}</div>
                    <div class="character-age">${character.age} лет</div>
                    <div class="character-desc">${character.description}</div>
                    <div class="character-stats">
                        <span><i class="fas fa-heart"></i> Доверие: ${character.trustRequired}</span>
                        <span><i class="fas fa-camera"></i> Фото: ${character.photoLimit}</span>
                    </div>
                `;
                
                characterCard.onclick = () => selectCharacter(character);
                charactersGrid.appendChild(characterCard);
            });
            
            // Показываем анимацию
            charactersGrid.classList.add('fade-in');
        } else {
            charactersGrid.innerHTML = `<div class="error">${data.error || 'Ошибка загрузки'}</div>`;
        }
    } catch (error) {
        console.error('Ошибка загрузки персонажей:', error);
        charactersGrid.innerHTML = '<div class="error">Ошибка подключения к серверу</div>';
    }
}

// Загрузка статистики профиля
async function loadProfileStats() {
    const profileStats = document.getElementById('profileStats');
    
    try {
        const telegramId = tg.initDataUnsafe?.user?.id || 0;
        
        if (telegramId) {
            const response = await fetch(`/api/webapp/user/${telegramId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const user = data.user;
                    
                    profileStats.innerHTML = `
                        <div class="stat-item">
                            <div class="stat-value">${user.trustLevel || 0}</div>
                            <div class="stat-label">Уровень доверия</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${user.totalMessages || 0}</div>
                            <div class="stat-label">Сообщений</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${user.photoRequests || 0}</div>
                            <div class="stat-label">Запросов фото</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${user.characterId ? '🎭' : '—'}</div>
                            <div class="stat-label">Персонаж</div>
                        </div>
                    `;
                    return;
                }
            }
        }
        
        // Если нет данных, показываем заглушку
        profileStats.innerHTML = `
            <div class="stat-item">
                <div class="stat-value">25</div>
                <div class="stat-label">Уровень доверия</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">15</div>
                <div class="stat-label">Сообщений</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">3</div>
                <div class="stat-label">Запросов фото</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">🎭</div>
                <div class="stat-label">Персонаж</div>
            </div>
        `;
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        profileStats.innerHTML = '<div class="error">Ошибка загрузки статистики</div>';
    }
}

// Выбор персонажа
function selectCharacter(character) {
    selectedCharacter = character;
    
    // Обновляем UI
    const characterCards = document.querySelectorAll('.character-card');
    characterCards.forEach(card => card.classList.remove('selected'));
    
    event.currentTarget.classList.add('selected');
    
    // Показываем подтверждение
    showCharacterModal(character);
}

// Показать модальное окно выбора персонажа
function showCharacterModal(character) {
    const modal = document.getElementById('characterModal');
    const modalBody = document.getElementById('modalBody');
    
    modalBody.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <div style="width: 80px; height: 80px; border-radius: 50%; background: #667eea; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center; color: white; font-size: 36px;">
                ${character.avatarUrl ? 
                  `<img src="${character.avatarUrl}" alt="${character.name}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` : 
                  `<i class="fas fa-user"></i>`}
            </div>
            <h4 style="margin-bottom: 5px;">${character.name}, ${character.age}</h4>
            <p style="color: #666; margin-bottom: 15px;">${character.personality}</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
            <p style="margin-bottom: 10px;"><strong>Описание:</strong> ${character.description}</p>
            <p style="margin-bottom: 10px;"><strong>Приветствие:</strong> "${character.welcomeMessage}"</p>
            <p><strong>Биография:</strong> ${character.bio}</p>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
            <div style="text-align: center; padding: 10px; background: #e3f2fd; border-radius: 8px;">
                <div style="font-size: 20px; color: #667eea; margin-bottom: 5px;">
                    <i class="fas fa-heart"></i>
                </div>
                <div style="font-size: 12px; color: #666;">Доверие: ${character.trustRequired}</div>
            </div>
            <div style="text-align: center; padding: 10px; background: #e3f2fd; border-radius: 8px;">
                <div style="font-size: 20px; color: #667eea; margin-bottom: 5px;">
                    <i class="fas fa-camera"></i>
                </div>
                <div style="font-size: 12px; color: #666;">Фото: ${character.photoLimit}</div>
            </div>
        </div>
    `;
    
    modal.classList.add('show');
}

// Закрыть модальное окно
function closeModal() {
    document.getElementById('characterModal').classList.remove('show');
}

// Подтвердить выбор персонажа
async function confirmCharacter() {
    if (!selectedCharacter) return;
    
    try {
        const telegramId = tg.initDataUnsafe?.user?.id || 0;
        
        if (!telegramId) {
            tg.showAlert('Ошибка: не найден ID пользователя');
            return;
        }
        
        const response = await fetch('/api/webapp/select-character', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegramId: telegramId,
                characterId: selectedCharacter._id
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Обновляем UI
            selectedCharacterId = selectedCharacter._id;
            document.getElementById('selectedCharacter').textContent = selectedCharacter.name;
            
            // Закрываем модальное окно
            closeModal();
            
            // Обновляем список персонажей
            loadCharacters();
            loadProfileStats();
            
            // Показываем уведомление
            tg.showAlert(`✅ Вы выбрали ${selectedCharacter.name}!`);
            
            // Добавляем сообщение в чат
            addMessage(`Вы выбрали персонажа: ${selectedCharacter.name}. ${selectedCharacter.welcomeMessage}`, 'bot');
        } else {
            tg.showAlert(`❌ Ошибка: ${data.error}`);
        }
    } catch (error) {
        console.error('Ошибка выбора персонажа:', error);
        tg.showAlert('❌ Ошибка выбора персонажа');
    }
}

// Отправка сообщения
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    // Проверяем, выбран ли персонаж
    if (!selectedCharacterId) {
        tg.showAlert('⚠️ Сначала выберите персонажа!');
        return;
    }
    
    // Добавляем сообщение пользователя в чат
    addMessage(message, 'user');
    messageInput.value = '';
    
    try {
        const telegramId = tg.initDataUnsafe?.user?.id || 0;
        
        if (!telegramId) {
            addMessage('Ошибка: не найден ID пользователя', 'bot');
            return;
        }
        
        // Отправляем на сервер
        const response = await fetch('/api/webapp/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegramId: telegramId,
                message: message
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Добавляем ответ бота
            addMessage(data.response, 'bot');
            
            // Обновляем статистику
            loadProfileStats();
        } else {
            addMessage(`❌ Ошибка: ${data.error}`, 'bot');
        }
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
        addMessage('❌ Ошибка подключения к серверу', 'bot');
    }
}

// Добавление сообщения в чат
function addMessage(text, sender) {
    const chatMessages = document.getElementById('chatMessages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const time = new Date().toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fas ${sender === 'user' ? 'fa-user' : 'fa-robot'}"></i>
        </div>
        <div class="message-content">
            <div class="message-text">${text}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    
    // Прокручиваем вниз
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Анимация
    messageDiv.style.animation = 'fadeIn 0.3s ease';
}

// Обработка нажатия Enter
function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// Проверка здоровья системы
async function checkHealth() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        
        if (data.status === 'OK') {
            tg.showAlert(`✅ Система работает нормально\nВремя: ${new Date(data.timestamp).toLocaleString('ru-RU')}`);
        } else {
            tg.showAlert(`❌ Проблемы с системой: ${data.error}`);
        }
    } catch (error) {
        tg.showAlert('❌ Ошибка проверки здоровья системы');
    }
}

// Показать ошибку
function showError(message) {
    tg.showAlert(`❌ ${message}`);
}

// Запускаем приложение при загрузке страницы
document.addEventListener('DOMContentLoaded', initApp);