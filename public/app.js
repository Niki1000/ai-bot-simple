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

// Call init on page load (removed duplicate - handled by DOMContentLoaded)

// Debug logging
window.addEventListener('load', () => {
    console.log('🔍 DEBUG INFO:');
    console.log('User ID:', userId);
    console.log('LocalStorage userId:', localStorage.getItem('telegramUserId'));
    console.log('Telegram WebApp:', window.Telegram?.WebApp?.initDataUnsafe);
});

//yebagi
//Load girls
async function loadGirls() {
    try {
        console.log('🔍 Loading girls...');

        // Pass telegramId to filter out already liked characters with chat history
        const url = `/api/webapp/characters${userId ? `?telegramId=${userId}` : ''}`;
        const response = await fetch(url);
        const data = await response.json();

        console.log('📦 Response:', data);

        if (!data.success) {
            throw new Error(data.error || 'Failed to load');
        }

        girls = data.characters || [];
        console.log(`✅ Loaded ${girls.length} girls`);

        if (girls.length === 0) {
            const swipeView = document.getElementById('swipeView');
            if (swipeView) {
                swipeView.innerHTML = `
                    <div style="color: white; text-align: center; padding: 40px;">
                        <h3>😢 Нет девушек</h3>
                        <p>Проверьте базу данных</p>
                    </div>
                `;
            }
        } else {
            renderCards();
        }
    } catch (error) {
        console.error('❌ Load error:', error);
        const swipeView = document.getElementById('swipeView');
        if (swipeView) {
            swipeView.innerHTML = `
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

    // Hide loading spinner
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
    }

    // Check if we've run out of cards
    if (currentGirlIndex >= girls.length) {
        showNoMore();
        return;
    }

    // Hide "no more cards" message if it was showing
    const noMoreCards = document.getElementById('noMoreCards');
    if (noMoreCards) {
        noMoreCards.style.display = 'none';
    }

    // Show next 3 cards (stacked)
    for (let i = 0; i < 3 && currentGirlIndex + i < girls.length; i++) {
        const girl = girls[currentGirlIndex + i];
        const card = createCard(girl, i);
        container.appendChild(card);
    }

    // Setup drag on top card
    setupDrag();
    
    console.log(`🃏 Rendered cards. Index: ${currentGirlIndex}/${girls.length}`);
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
            <div class="profile-bio">${girl.bio || girl.description || ''}</div>
        </div>
    `;

    return card;
}

// Setup drag & drop
let startX = 0, currentX = 0, isDragging = false;
let dragListenersInitialized = false;

function setupDrag() {
    const card = document.querySelector('.profile-card');
    if (!card) return;

    // Add listeners to the current card
    card.addEventListener('mousedown', dragStart);
    card.addEventListener('touchstart', dragStart);

    // Initialize document-level listeners only once
    if (!dragListenersInitialized) {
        document.addEventListener('mousemove', drag);
        document.addEventListener('touchmove', drag);
        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('touchend', dragEnd);
        dragListenersInitialized = true;
    }
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
        sympathy = userData.user?.sympathy?.[girl._id] || 0;

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
            // No history - show welcome message and SAVE it to DB
            const welcomeMsg = selectedGirl.welcomeMessage || 'Привет! 💕';
            addMessage(welcomeMsg, 'bot');
            
            // Save welcome message to DB so it persists
            try {
                await fetch('/api/webapp/save-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        telegramId: userId,
                        characterId: selectedGirl._id,
                        message: welcomeMsg,
                        sender: 'bot'
                    })
                });
                console.log('✅ Welcome message saved to DB');
            } catch (saveErr) {
                console.error('❌ Failed to save welcome message:', saveErr);
            }
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
        if (window.Telegram?.WebApp) {
            tg.showAlert(`Нужно больше симпатии! (${sympathy}/10)`);
        } else {
            alert(`Нужно больше симпатии! (${sympathy}/10)`);
        }
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
            const message = data.message || `Попробуй позже! Шанс: ${Math.floor(sympathy)}%`;
            if (window.Telegram?.WebApp) {
                tg.showAlert(message);
            } else {
                alert(message);
            }
            addMessage(data.message || 'Пока не готова делиться фото 🙈', 'bot');
        }
    } catch (error) {
        console.error('Error requesting photo:', error);
        if (window.Telegram?.WebApp) {
            tg.showAlert('Ошибка запроса фото');
        } else {
            alert('Ошибка запроса фото');
        }
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
    // Hide loading spinner if visible
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
    }
    
    // Show the "no more cards" UI
    const noMoreCards = document.getElementById('noMoreCards');
    if (noMoreCards) {
        noMoreCards.style.display = 'flex';
        noMoreCards.style.flexDirection = 'column';
        noMoreCards.style.alignItems = 'center';
        noMoreCards.style.justifyContent = 'center';
        noMoreCards.style.textAlign = 'center';
        noMoreCards.style.color = 'white';
        noMoreCards.style.padding = '40px';
    }
    
    // Hide action buttons
    document.getElementById('actionButtons').style.display = 'none';
    
    console.log('📭 No more cards to show');
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
    document.getElementById('userProfileView').style.display = 'none';

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
    document.getElementById('userProfileView').style.display = 'none';

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
            
            // Get last message from chat history, or fall back to welcome message
            const chatHistory = userData.user?.chatHistory?.[girl._id] || [];
            let lastMessage = girl.welcomeMessage || 'Привет! 💕';
            if (chatHistory.length > 0) {
                const lastMsg = chatHistory[chatHistory.length - 1];
                lastMessage = lastMsg.message;
            }
            
            // Truncate long messages for preview
            if (lastMessage.length > 40) {
                lastMessage = lastMessage.substring(0, 40) + '...';
            }

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
        sympathy = userData.user?.sympathy?.[girl._id] || 0;

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
    console.log('🔄 Resetting cards...');
    currentGirlIndex = 0;
    
    // Hide "no more cards" UI
    const noMoreCards = document.getElementById('noMoreCards');
    if (noMoreCards) {
        noMoreCards.style.display = 'none';
    }
    
    // Show action buttons again
    document.getElementById('actionButtons').style.display = 'flex';
    
    // If we still have girls loaded, just re-render them
    if (girls.length > 0) {
        console.log(`✅ Re-rendering ${girls.length} existing girls`);
        renderCards();
    } else {
        // Otherwise, reload from server
        const swipeView = document.getElementById('swipeView');
        if (swipeView) {
            // Clear existing cards first
            const oldCards = swipeView.querySelectorAll('.profile-card');
            oldCards.forEach(card => card.remove());
            
            // Show loading
            let loading = document.getElementById('loading');
            if (!loading) {
                loading = document.createElement('div');
                loading.id = 'loading';
                loading.className = 'loading';
                loading.innerHTML = '<i class="fas fa-spinner fa-spin"></i><br><br>Загрузка девушек...';
                swipeView.appendChild(loading);
            }
            loading.style.display = 'block';
        }
        loadGirls();
    }
}


// ==================== USER PROFILE ====================

// Show user profile view
async function showUserProfile() {
    document.getElementById('swipeView').style.display = 'none';
    document.getElementById('actionButtons').style.display = 'none';
    document.getElementById('chatView').style.display = 'none';
    document.getElementById('matchesView').style.display = 'none';
    document.getElementById('userProfileView').style.display = 'flex';

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.nav-item')[2].classList.add('active');

    // Load user data
    try {
        const userRes = await fetch(`/api/webapp/user/${userId}`);
        const userData = await userRes.json();

        console.log('👤 User profile data:', userData);

        if (userData.success && userData.user) {
            const user = userData.user;
            
            // Set user ID
            document.getElementById('userProfileId').textContent = `ID: ${userId}`;
            
            // Try to get Telegram name
            if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
                const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
                const name = tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '');
                document.getElementById('userProfileName').textContent = name || 'Пользователь';
            }
            
            // Stats
            const matchesCount = user.likes?.length || 0;
            const messagesCount = user.totalMessages || 0;
            
            // Calculate total sympathy across all characters
            let totalSympathy = 0;
            if (user.sympathy) {
                Object.values(user.sympathy).forEach(val => {
                    totalSympathy += val;
                });
            }
            
            document.getElementById('userMatchesCount').textContent = matchesCount;
            document.getElementById('userMessagesCount').textContent = messagesCount;
            document.getElementById('userTotalSympathy').textContent = totalSympathy;
            
            // Subscription status and credits
            const subLevel = user.subscriptionLevel || 'free';
            const credits = user.credits || 0;
            
            const statusBadge = document.querySelector('.status-badge');
            if (subLevel === 'premium') {
                statusBadge.textContent = 'Premium';
                statusBadge.className = 'status-badge premium';
            } else {
                statusBadge.textContent = 'Бесплатно';
                statusBadge.className = 'status-badge free';
            }
            
            // Update credits display
            document.getElementById('userCreditsCount').textContent = credits;
            
            // Update local cache
            userEntitlements.credits = credits;
            userEntitlements.subscriptionLevel = subLevel;
            userEntitlements.unlockedPhotos = user.unlockedPhotos || {};
            
            // Load recent chats
            loadRecentChats(user);
        }
    } catch (error) {
        console.error('❌ Error loading user profile:', error);
    }
}

// Load recent chats for user profile
async function loadRecentChats(user) {
    const container = document.getElementById('userRecentChats');
    
    if (!user.likes || user.likes.length === 0) {
        container.innerHTML = '<div class="no-recent">Начни общение с девушками!</div>';
        return;
    }
    
    try {
        // Get matches data
        const matchesRes = await fetch(`/api/webapp/matches/${userId}`);
        const matchesData = await matchesRes.json();
        
        if (!matchesData.success || matchesData.matches.length === 0) {
            container.innerHTML = '<div class="no-recent">Начни общение с девушками!</div>';
            return;
        }
        
        container.innerHTML = '';
        
        // Show up to 3 recent matches
        const recentMatches = matchesData.matches.slice(0, 3);
        
        recentMatches.forEach(girl => {
            const chatHistory = user.chatHistory?.[girl._id] || [];
            let lastMessage = girl.welcomeMessage || 'Привет! 💕';
            
            if (chatHistory.length > 0) {
                lastMessage = chatHistory[chatHistory.length - 1].message;
            }
            
            if (lastMessage.length > 30) {
                lastMessage = lastMessage.substring(0, 30) + '...';
            }
            
            const item = document.createElement('div');
            item.className = 'recent-chat-item';
            item.onclick = () => openChatFromProfile(girl);
            
            item.innerHTML = `
                <div class="recent-chat-avatar" style="background-image: url('${girl.avatarUrl}')"></div>
                <div class="recent-chat-info">
                    <div class="recent-chat-name">${girl.name}</div>
                    <div class="recent-chat-preview">${lastMessage}</div>
                </div>
            `;
            
            container.appendChild(item);
        });
        
    } catch (error) {
        console.error('❌ Error loading recent chats:', error);
        container.innerHTML = '<div class="no-recent">Ошибка загрузки</div>';
    }
}

// Open chat from user profile
async function openChatFromProfile(girl) {
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
        sympathy = userData.user?.sympathy?.[girl._id] || 0;
        
        document.getElementById('userProfileView').style.display = 'none';
        openChat();
        
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('userProfileView').style.display = 'none';
        openChat();
    }
}

// Show upgrade modal (placeholder)
function showUpgradeModal() {
    const message = '🚀 Premium скоро!\n\nФункция Premium подписки находится в разработке. Следите за обновлениями!';
    if (window.Telegram?.WebApp) {
        tg.showAlert(message);
    } else {
        alert(message);
    }
}

// Get test credits (demo function)
async function getTestCredits() {
    try {
        const res = await fetch('/api/webapp/add-credits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId: userId,
                amount: 50
            })
        });
        
        const data = await res.json();
        
        if (data.success) {
            // Update local cache
            userEntitlements.credits = data.credits;
            
            // Update UI
            document.getElementById('userCreditsCount').textContent = data.credits;
            
            const msg = `🎁 Получено 50 кредитов!\n\nВсего: ${data.credits} кредитов`;
            if (window.Telegram?.WebApp) {
                tg.showAlert(msg);
            } else {
                alert(msg);
            }
            
            console.log('💰 Credits added. Total:', data.credits);
        }
    } catch (error) {
        console.error('❌ Error adding credits:', error);
    }
}

// Show settings (placeholder)
function showSettings() {
    const message = '⚙️ Настройки\n\nЭтот раздел находится в разработке.';
    if (window.Telegram?.WebApp) {
        tg.showAlert(message);
    } else {
        alert(message);
    }
}

// ==================== CHARACTER PROFILE ====================

// User entitlements cache
let userEntitlements = {
    subscriptionLevel: 'free',
    credits: 0,
    unlockedPhotos: {}
};

// Open character profile view
async function openCharacterProfile() {
    if (!selectedGirl) return;
    
    console.log('👤 Opening profile for:', selectedGirl.name);
    
    // Load user entitlements first
    try {
        const entRes = await fetch(`/api/webapp/user-entitlements/${userId}`);
        const entData = await entRes.json();
        if (entData.success) {
            userEntitlements = entData;
            console.log('🔑 Entitlements loaded:', userEntitlements);
        }
    } catch (e) {
        console.error('Failed to load entitlements:', e);
    }
    
    // Populate profile data
    document.getElementById('profileViewName').textContent = selectedGirl.name;
    document.getElementById('profileName').textContent = selectedGirl.name;
    document.getElementById('profileAge').textContent = `${selectedGirl.age} лет`;
    document.getElementById('profileBio').textContent = selectedGirl.bio || 'Информация отсутствует';
    document.getElementById('profilePersonality').textContent = selectedGirl.personality || 'Узнай меня лучше в чате! 💕';
    document.getElementById('profileSympathy').textContent = sympathy;
    
    // Fake compatibility based on sympathy (for now)
    const compatibility = Math.min(99, 50 + Math.floor(sympathy * 2));
    document.getElementById('profileCompatibility').textContent = `${compatibility}%`;
    
    // Set main photo
    const mainPhoto = document.getElementById('profileMainPhoto');
    mainPhoto.style.backgroundImage = `url('${selectedGirl.avatarUrl}')`;
    
    // Populate gallery with unlock status
    const galleryContainer = document.getElementById('profileGallery');
    galleryContainer.innerHTML = '';
    
    // Get unlocked photos for this character
    const unlockedForChar = userEntitlements.unlockedPhotos?.[selectedGirl._id] || [];
    const isPremium = userEntitlements.subscriptionLevel === 'premium';
    
    // Add avatar as first photo (always unlocked)
    const avatarItem = document.createElement('div');
    avatarItem.className = 'gallery-item';
    avatarItem.style.backgroundImage = `url('${selectedGirl.avatarUrl}')`;
    avatarItem.onclick = () => showPhoto(selectedGirl.avatarUrl);
    galleryContainer.appendChild(avatarItem);
    
    // Add other photos from character
    if (selectedGirl.photos && selectedGirl.photos.length > 0) {
        selectedGirl.photos.forEach((photoUrl, index) => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.style.backgroundImage = `url('${photoUrl}')`;
            
            // First photo always free, others check unlock status
            const isUnlocked = index === 0 || isPremium || unlockedForChar.includes(photoUrl);
            
            if (isUnlocked) {
                item.onclick = () => showPhoto(photoUrl);
            } else {
                item.classList.add('locked');
                item.onclick = () => handleLockedPhoto(photoUrl);
            }
            
            galleryContainer.appendChild(item);
        });
    }
    
    // Show profile view
    document.getElementById('characterProfileView').style.display = 'flex';
}

// Close character profile view
function closeCharacterProfile() {
    document.getElementById('characterProfileView').style.display = 'none';
}

// Handle locked photo click
async function handleLockedPhoto(photoUrl) {
    const credits = userEntitlements.credits || 0;
    
    if (credits >= 10) {
        // User has credits - offer to unlock
        const confirmMsg = `Разблокировать фото за 10 кредитов?\n\nУ вас: ${credits} кредитов`;
        
        if (window.Telegram?.WebApp) {
            tg.showConfirm(confirmMsg, async (confirmed) => {
                if (confirmed) {
                    await unlockPhoto(photoUrl);
                }
            });
        } else {
            if (confirm(confirmMsg)) {
                await unlockPhoto(photoUrl);
            }
        }
    } else {
        // Not enough credits
        const message = `🔒 Фото заблокировано\n\nНужно 10 кредитов для разблокировки.\nУ вас: ${credits} кредитов\n\nОформите Premium или получите больше кредитов!`;
        if (window.Telegram?.WebApp) {
            tg.showAlert(message);
        } else {
            alert(message);
        }
    }
}

// Unlock photo
async function unlockPhoto(photoUrl) {
    try {
        const res = await fetch('/api/webapp/unlock-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId: userId,
                characterId: selectedGirl._id,
                photoUrl: photoUrl
            })
        });
        
        const data = await res.json();
        
        if (data.success) {
            // Update local entitlements
            userEntitlements.credits = data.remainingCredits;
            if (!userEntitlements.unlockedPhotos[selectedGirl._id]) {
                userEntitlements.unlockedPhotos[selectedGirl._id] = [];
            }
            userEntitlements.unlockedPhotos[selectedGirl._id].push(photoUrl);
            
            // Show the photo
            showPhoto(photoUrl);
            
            // Refresh the gallery to update lock states
            openCharacterProfile();
            
            console.log('✅ Photo unlocked! Remaining credits:', data.remainingCredits);
        } else {
            const errMsg = data.error || 'Не удалось разблокировать фото';
            if (window.Telegram?.WebApp) {
                tg.showAlert(errMsg);
            } else {
                alert(errMsg);
            }
        }
    } catch (error) {
        console.error('❌ Unlock error:', error);
        if (window.Telegram?.WebApp) {
            tg.showAlert('Ошибка при разблокировке');
        } else {
            alert('Ошибка при разблокировке');
        }
    }
}

// Show locked photo message (legacy, kept for compatibility)
function showLockedPhotoMessage() {
    const message = 'Эта фотография заблокирована 🔒\nНабери больше симпатии или оформи подписку!';
    if (window.Telegram?.WebApp) {
        tg.showAlert(message);
    } else {
        alert(message);
    }
}

// Start app
document.addEventListener('DOMContentLoaded', initApp);
