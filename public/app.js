// Telegram Web App API
const tg = window.Telegram.WebApp;

// Global state
// Get user ID from Telegram WebApp - FIXED
let userId;
let girls = [];
let currentGirlIndex = 0;
let selectedGirl = null;
let sympathy = 0;

// Initialize
async function initApp() {
    // Get Telegram user ID
    if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        userId = tg.initDataUnsafe?.user?.id || 675257; // Fallback for testing

        // Save to localStorage
        localStorage.setItem('telegramUserId', userId);
    } else {
        // Get from localStorage or use test ID
        userId = localStorage.getItem('telegramUserId') || 675257;
    }

    console.log('👤 User ID:', userId);

    await loadGirls();
}

// Call init on page load
initApp();

// Debug logging
window.addEventListener('load', () => {
    console.log('🔍 DEBUG INFO:');
    console.log('User ID:', userId);
    console.log('LocalStorage userId:', localStorage.getItem('telegramUserId'));
    console.log('Telegram WebApp:', window.Telegram?.WebApp?.initDataUnsafe);
});


//Load girls
async function loadGirls() {
    try {
        console.log('🔍 Loading girls...');

        const response = await fetch('/api/webapp/characters');
        const data = await response.json();

        console.log('📦 Response:', data);

        if (!data.success) {
            throw new Error(data.error || 'Failed to load');
        }

        girls = data.characters || [];
        console.log(`✅ Loaded ${girls.length} girls`);

        if (girls.length === 0) {
            document.getElementById('cardStack').innerHTML = `
                <div style="color: white; text-align: center; padding: 40px;">
                    <h3>😢 Нет девушек</h3>
                    <p>Проверьте базу данных</p>
                </div>
            `;
        } else {
            renderCards();
        }
    } catch (error) {
        console.error('❌ Load error:', error);
        const stack = document.getElementById('cardStack');
        if (stack) {
            stack.innerHTML = `
                <div style="color: white; text-align: center; padding: 40px;">
                    <h3>❌ Ошибка</h3>
                    <p>${error.message}</p>
                    <button onclick="location.reload()" style="background: #f093fb; border: none; padding: 10px 20px; border-radius: 8px; color: white; margin-top: 20px; cursor: pointer;">
                        Перезагрузить
                    </button>
                </div>
            `;
        }
    }
}



// Render swipe cards
function renderCards() {
    const container = document.getElementById('swipeView');

    // Clear old cards
    const oldCards = container.querySelectorAll('.profile-card');
    oldCards.forEach(card => card.remove());

    if (currentGirlIndex >= girls.length) {
        showNoMore();
        return;
    }

    // Show next 3 cards
    for (let i = 0; i < 3 && currentGirlIndex + i < girls.length; i++) {
        const girl = girls[currentGirlIndex + i];
        const card = createCard(girl, i);
        container.appendChild(card);
    }

    // Setup drag on top card
    setupDrag();
}

// Create card element
function createCard(girl, index) {
    const card = document.createElement('div');
    card.className = 'profile-card';
    card.style.zIndex = 100 - index;
    card.style.transform = `scale(${1 - index * 0.05}) translateY(${index * 10}px)`;
    card.dataset.girlId = girl._id;

    card.innerHTML = `
        <img src="${girl.avatarUrl || 'https://i.pravatar.cc/400'}" alt="${girl.name}" class="card-image">
        <div class="card-overlay"></div>
        <div class="profile-info">
            <div class="profile-name">${girl.name}</div>
            <div class="profile-age">${girl.age} лет</div>
            <div class="profile-bio">${girl.description}</div>
        </div>
    `;

    return card;
}

// Setup drag & drop
let startX = 0, currentX = 0, isDragging = false;

function setupDrag() {
    const card = document.querySelector('.profile-card');
    if (!card) return;

    card.addEventListener('mousedown', dragStart);
    card.addEventListener('touchstart', dragStart);

    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag);

    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);
}

function dragStart(e) {
    isDragging = true;
    startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    currentX = startX;

    const card = e.currentTarget;
    card.classList.add('dragging');
}

function drag(e) {
    if (!isDragging) return;

    currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const deltaX = currentX - startX;

    const card = document.querySelector('.profile-card.dragging');
    if (!card) return;

    const rotation = deltaX * 0.1;
    card.style.transform = `translateX(${deltaX}px) rotate(${rotation}deg)`;
    card.style.opacity = 1 - Math.abs(deltaX) / 500;
}

function dragEnd() {
    if (!isDragging) return;
    isDragging = false;

    const card = document.querySelector('.profile-card.dragging');
    if (!card) return;

    const deltaX = currentX - startX;

    if (Math.abs(deltaX) > 100) {
        // Swipe threshold met
        const direction = deltaX > 0 ? 'like' : 'pass';
        card.classList.remove('dragging');
        swipeCard(direction);
    } else {
        // Reset position
        card.style.transform = '';
        card.style.opacity = '1';
        card.classList.remove('dragging');
    }
}

// Swipe card (like/pass) - FIXED
function swipeCard(action) {
    const card = document.querySelector('.profile-card');
    if (!card) return;

    const girlId = card.dataset.girlId;
    const girl = girls.find(g => g._id === girlId);

    // Animate swipe
    if (action === 'like') {
        card.classList.add('swipe-right');
    } else {
        card.classList.add('swipe-left');
    }

    // Save to backend
    fetch('/api/webapp/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            telegramId: userId,
            characterId: girlId,
            action: action
        })
    }).catch(err => console.error('Match save error:', err));

    setTimeout(() => {
        card.remove();
        currentGirlIndex++;

        if (action === 'like') {
            // Open chat with selected girl
            selectGirl(girl);
        } else {
            // Load next card
            renderCards();
        }
    }, 300);
}


// Select girl and open chat
async function selectGirl(girl) {
    selectedGirl = girl;

    try {
        // Save selection to backend
        await fetch('/api/webapp/select-character', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId: userId,
                characterId: girl._id
            })
        });

        // Load sympathy
        const userRes = await fetch(`/api/webapp/user/${userId}`);
        const userData = await userRes.json();
        sympathy = userData.user?.sympathy?.get(girl._id) || 0;

        openChat();
    } catch (error) {
        console.error('Error selecting girl:', error);
        openChat();
    }
}

// Open chat - FIXED history loading
async function openChat() {
    document.getElementById('swipeView').style.display = 'none';
    document.getElementById('actionButtons').style.display = 'none';
    document.getElementById('matchesView').style.display = 'none';
    document.getElementById('chatView').style.display = 'flex';

    document.getElementById('chatGirlName').textContent = selectedGirl.name;
    document.getElementById('chatGirlAvatar').style.backgroundImage = `url('${selectedGirl.avatarUrl}')`;

    // Clear existing messages
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = '';

    try {
        // Load chat history from DB
        const historyRes = await fetch(`/api/webapp/chat-history/${userId}/${selectedGirl._id}`);
        const historyData = await historyRes.json();

        console.log('📜 Loaded history:', historyData);

        sympathy = historyData.sympathy || 0;
        updateSympathyBar();

        if (historyData.success && historyData.history && historyData.history.length > 0) {
            // Add all messages from history
            historyData.history.forEach(msg => {
                addMessage(msg.message, msg.sender);
            });

            console.log(`✅ Loaded ${historyData.history.length} messages`);
        } else {
            // No history - show welcome message
            addMessage(selectedGirl.welcomeMessage || 'Привет! 💕', 'bot');
        }

        // Scroll to bottom
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);

    } catch (error) {
        console.error('❌ Error loading history:', error);
        addMessage(selectedGirl.welcomeMessage || 'Привет! 💕', 'bot');
    }
}



// Back to swipe view
function backToSwipe() {
    document.getElementById('chatView').style.display = 'none';
    document.getElementById('swipeView').style.display = 'flex';
    document.getElementById('actionButtons').style.display = 'flex';

    selectedGirl = null;
    sympathy = 0;

    // Clear chat
    document.getElementById('chatMessages').innerHTML = '';

    renderCards();
}

// Send message - FIXED to save both messages
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();

    if (!message || !selectedGirl) return;

    // Add user message to UI
    addMessage(message, 'user');
    input.value = '';

    try {
        // 1. Save user message to DB
        const saveUserRes = await fetch('/api/webapp/save-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId: userId,
                characterId: selectedGirl._id,
                message: message,
                sender: 'user'
            })
        });

        const saveUserData = await saveUserRes.json();

        if (saveUserData.success && saveUserData.sympathy !== undefined) {
            sympathy = saveUserData.sympathy;
            updateSympathyBar();
        }

        // 2. Get AI response
        const chatRes = await fetch('/api/webapp/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId: userId,
                message: message
            })
        });

        const chatData = await chatRes.json();

        if (chatData.success && chatData.response) {
            // 3. Add bot message to UI
            setTimeout(async () => {
                addMessage(chatData.response, 'bot');

                // 4. Save bot message to DB
                await fetch('/api/webapp/save-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        telegramId: userId,
                        characterId: selectedGirl._id,
                        message: chatData.response,
                        sender: 'bot'
                    })
                });

                console.log('✅ Both messages saved');
            }, 500);
        } else {
            addMessage('Ошибка получения ответа 😢', 'bot');
        }
    } catch (error) {
        console.error('❌ Error sending message:', error);
        addMessage('Ошибка отправки 😢', 'bot');
    }
}



// Add message to chat
function addMessage(text, sender) {
    const container = document.getElementById('chatMessages');

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.innerHTML = `
        <div class="message-bubble">${text}</div>
    `;

    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// Request photo
async function requestPhoto() {
    if (!selectedGirl) return;

    if (sympathy < 10) {
        tg.showAlert(`Нужно больше симпатии! (${sympathy}/10)`);
        return;
    }

    try {
        const response = await fetch('/api/webapp/request-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId: userId,
                characterId: selectedGirl._id
            })
        });

        const data = await response.json();

        if (data.success && data.photo) {
            showPhoto(data.photo);
            addMessage('Вот моё фото! 📸💕', 'bot');
        } else {
            tg.showAlert(data.message || `Попробуй позже! Шанс: ${Math.floor(sympathy)}%`);
            addMessage(data.message || 'Пока не готова делиться фото 🙈', 'bot');
        }
    } catch (error) {
        console.error('Error requesting photo:', error);
        tg.showAlert('Ошибка запроса фото');
    }
}

// Show photo modal
function showPhoto(photoUrl) {
    document.getElementById('photoImage').src = photoUrl;
    document.getElementById('photoModal').style.display = 'flex';
}

// Close photo modal
function closePhotoModal() {
    document.getElementById('photoModal').style.display = 'none';
}

// Update sympathy bar
function updateSympathyBar() {
    const fillPercent = Math.min(100, sympathy);
    document.getElementById('sympathyFill').style.width = `${fillPercent}%`;
    document.getElementById('sympathyText').textContent = `Симпатия: ${sympathy}`;
}

// Show no more cards
function showNoMore() {
    document.getElementById('noMore').style.display = 'block';
    document.getElementById('actionButtons').style.display = 'none';
}

// Handle enter key in chat
function handleEnter(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
}
// Navigate to matches view
function showMatches() {
    document.getElementById('swipeView').style.display = 'none';
    document.getElementById('actionButtons').style.display = 'none';
    document.getElementById('chatView').style.display = 'none';
    document.getElementById('matchesView').style.display = 'flex';

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.nav-item')[1].classList.add('active');

    loadMatches();
}

// Navigate back to swipe
function showSwipe() {
    document.getElementById('swipeView').style.display = 'flex';
    document.getElementById('actionButtons').style.display = 'flex';
    document.getElementById('chatView').style.display = 'none';
    document.getElementById('matchesView').style.display = 'none';

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.nav-item')[0].classList.add('active');
}


// Load matches from backend - FIXED
// Load matches - WITH DEBUG LOGGING
async function loadMatches() {
    try {
        console.log('🔍 Loading matches for user:', userId);

        document.getElementById('matchesLoading').style.display = 'block';
        document.getElementById('noMatches').style.display = 'none';

        const matchesRes = await fetch(`/api/webapp/matches/${userId}`);
        const matchesData = await matchesRes.json();

        console.log('📦 Matches response:', matchesData);

        const matchesList = document.getElementById('matchesList');

        if (!matchesData.success || matchesData.matches.length === 0) {
            console.log('❌ No matches to display');
            document.getElementById('noMatches').style.display = 'block';
            document.getElementById('matchesLoading').style.display = 'none';
            return;
        }

        const existingCards = matchesList.querySelectorAll('.match-card');
        existingCards.forEach(card => card.remove());

        const userRes = await fetch(`/api/webapp/user/${userId}`);
        const userData = await userRes.json();

        console.log('👤 User data:', userData);

        matchesData.matches.forEach(girl => {
            const sympathy = userData.user?.sympathy?.[girl._id] || 0;
            const lastMessage = girl.welcomeMessage || 'Привет! 💕';

            const card = document.createElement('div');
            card.className = 'match-card';
            card.onclick = () => selectGirlFromMatches(girl);

            card.innerHTML = `
                <div class="match-avatar" style="background-image: url('${girl.avatarUrl}')"></div>
                <div class="match-info">
                    <div class="match-name">${girl.name}</div>
                    <div class="match-age">${girl.age} лет</div>
                    <div class="match-preview">${lastMessage}</div>
                </div>
                <div class="match-meta">
                    <div class="match-time">Сейчас</div>
                    <div class="match-sympathy">
                        <i class="fas fa-heart"></i>
                        <span>${sympathy}</span>
                    </div>
                </div>
            `;

            matchesList.appendChild(card);
        });

        console.log(`✅ Rendered ${matchesData.matches.length} match cards`);
        document.getElementById('matchesLoading').style.display = 'none';

    } catch (error) {
        console.error('❌ Error loading matches:', error);
        document.getElementById('noMatches').style.display = 'block';
        document.getElementById('matchesLoading').style.display = 'none';
    }
}



// Open chat from matches
async function selectGirlFromMatches(girl) {
    selectedGirl = girl;

    try {
        await fetch('/api/webapp/select-character', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId: userId,
                characterId: girl._id
            })
        });

        const userRes = await fetch(`/api/webapp/user/${userId}`);
        const userData = await userRes.json();
        sympathy = userData.user?.totalMessages || 0;

        // Hide matches, show chat
        document.getElementById('matchesView').style.display = 'none';
        openChat();

    } catch (error) {
        console.error('Error:', error);
        openChat();
    }
}
// Reset and reload cards
function resetCards() {
    currentGirlIndex = 0;
    const stack = document.getElementById('cardStack');
    stack.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><br><br>Загрузка девушек...</div>';
    loadGirls();
}


// Start app
document.addEventListener('DOMContentLoaded', initApp);
