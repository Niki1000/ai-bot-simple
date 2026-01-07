// Telegram Web App API
const tg = window.Telegram.WebApp;

// Global state
let girls = [];
let currentGirlIndex = 0;
let selectedGirl = null;
let sympathy = 0;
let userId = null;

// Initialize
function initApp() {
    console.log('🚀 App started');
    
    tg.expand();
    tg.setHeaderColor('#667eea');
    tg.setBackgroundColor('#667eea');
    tg.MainButton.hide();
    
    // Get user ID
    userId = tg.initDataUnsafe?.user?.id || Math.floor(Math.random() * 1000000);
    
    if (tg.initDataUnsafe?.user?.first_name) {
        document.getElementById('userAvatar').innerHTML = 
            `<span>${tg.initDataUnsafe.user.first_name[0]}</span>`;
    }
    
    loadGirls();
}

// Load girls from API
async function loadGirls() {
    try {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('noMore').style.display = 'none';
        
        const response = await fetch('/api/webapp/characters');
        const data = await response.json();
        
        if (data.success && data.characters.length > 0) {
            girls = data.characters;
            currentGirlIndex = 0;
            renderCards();
        } else {
            showNoMore();
        }
    } catch (error) {
        console.error('Error loading girls:', error);
        tg.showAlert('Ошибка загрузки девушек');
        showNoMore();
    } finally {
        document.getElementById('loading').style.display = 'none';
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

// Swipe card (like/pass/super)
function swipeCard(action) {
    const card = document.querySelector('.profile-card');
    if (!card) return;
    
    const girlId = card.dataset.girlId;
    const girl = girls.find(g => g._id === girlId);
    
    // Animate swipe
    if (action === 'like' || action === 'super') {
        card.classList.add('swipe-right');
    } else {
        card.classList.add('swipe-left');
    }
    
    setTimeout(() => {
        card.remove();
        currentGirlIndex++;
        
        if (action === 'like' || action === 'super') {
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

// Open chat view
function openChat() {
    document.getElementById('swipeView').style.display = 'none';
    document.getElementById('actionButtons').style.display = 'none';
    document.getElementById('chatView').style.display = 'flex';
    
    document.getElementById('chatGirlName').textContent = selectedGirl.name;
    updateSympathyBar();
    
    // Add welcome message
    addMessage(selectedGirl.welcomeMessage || 'Привет! 💕', 'bot');
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

// Send message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message || !selectedGirl) return;
    
    addMessage(message, 'user');
    input.value = '';
    
    try {
        const response = await fetch('/api/webapp/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId: userId,
                message: message
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            sympathy++;
            updateSympathyBar();
            
            setTimeout(() => {
                addMessage(data.response, 'bot');
            }, 500);
        }
    } catch (error) {
        console.error('Error sending message:', error);
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

// Start app
document.addEventListener('DOMContentLoaded', initApp);
