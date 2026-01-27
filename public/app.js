// Telegram Web App API
const tg = window.Telegram.WebApp;

// Global state
// Get user ID from Telegram WebApp - FIXED
let userId;
let girls = [];
let currentGirlIndex = 0;
let selectedGirl = null;
let sympathy = 0;
let lastReadMessages = {}; // Track last read message timestamp per character: { characterId: timestamp }
let isChatLoading = false; // Prevent multiple simultaneous chat loads

// ==================== API UTILITY FUNCTIONS ====================

/**
 * Enhanced fetch with retry logic and error handling
 * @param {string} url - API endpoint
 * @param {object} options - Fetch options
 * @param {number} maxRetries - Maximum retry attempts (default: 2)
 * @returns {Promise<Response>}
 */
async function apiFetch(url, options = {}, maxRetries = 2) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            // Check if response is ok (status 200-299)
            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { error: errorText || `HTTP ${response.status}` };
                }
                
                // Don't retry on client errors (4xx), only on server errors (5xx) or network issues
                if (response.status >= 400 && response.status < 500 && attempt < maxRetries) {
                    // Client error - retry once more
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                    continue;
                }
                
                throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response;
        } catch (error) {
            lastError = error;
            
            // Network error or timeout - retry
            if (attempt < maxRetries && (
                error.name === 'TypeError' || // Network error
                error.message.includes('Failed to fetch') ||
                error.message.includes('NetworkError')
            )) {
                const delay = 1000 * (attempt + 1); // Exponential backoff
                console.warn(`⚠️ API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`, error.message);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            // If it's the last attempt or not a network error, throw
            throw error;
        }
    }
    
    throw lastError;
}

/**
 * Safe JSON parsing with error handling
 * @param {Response} response - Fetch response object
 * @returns {Promise<object>}
 */
async function safeJsonParse(response) {
    try {
        const text = await response.text();
        if (!text) {
            return { success: false, error: 'Empty response from server' };
        }
        return JSON.parse(text);
    } catch (error) {
        console.error('❌ JSON parse error:', error);
        return { success: false, error: 'Invalid response format from server' };
    }
}

/**
 * Show user-friendly error message
 * @param {string} message - Error message
 * @param {boolean} isNetworkError - Whether it's a network error
 */
function showError(message, isNetworkError = false) {
    const errorMsg = isNetworkError 
        ? 'Проблема с интернетом. Проверьте соединение и попробуйте снова.'
        : message || 'Произошла ошибка. Попробуйте позже.';
    
    if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.showAlert(errorMsg);
    } else {
        // Fallback for non-Telegram environment
        alert(errorMsg);
    }
    
    console.error('❌ Error:', message);
}

// ==================== END API UTILITIES ====================

// Set Telegram user profile picture
function setTelegramProfilePicture(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
        
        if (tgUser.photo_url) {
            element.innerHTML = ''; // Remove icon
            element.style.backgroundImage = `url('${tgUser.photo_url}')`;
            element.style.backgroundSize = 'cover';
            element.style.backgroundPosition = 'center';
            console.log('✅ Loaded Telegram profile picture for', elementId);
        } else {
            // Keep default icon if no photo
            if (!element.innerHTML.includes('<i')) {
                element.innerHTML = '<i class="fas fa-user"></i>';
            }
            element.style.backgroundImage = '';
        }
    } else {
        // Fallback if Telegram API not available
        if (!element.innerHTML.includes('<i')) {
            element.innerHTML = '<i class="fas fa-user"></i>';
        }
        element.style.backgroundImage = '';
    }
}

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
        
        // Set header avatar profile picture
        setTelegramProfilePicture('userAvatar');
    } else {
        // Get from localStorage or use test ID
        userId = localStorage.getItem('telegramUserId') || 675257;
    }

    // Load last read messages from localStorage
    const savedLastRead = localStorage.getItem('lastReadMessages');
    if (savedLastRead) {
        try {
            lastReadMessages = JSON.parse(savedLastRead);
        } catch (e) {
            console.error('Failed to parse lastReadMessages:', e);
            lastReadMessages = {};
        }
    }

    console.log('👤 User ID:', userId);

    await loadGirls();
    
    // Update matches tab notification on init
    updateMatchesTabNotification();
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
        const response = await apiFetch(url);
        const data = await safeJsonParse(response);

        console.log('📦 Response:', data);

        if (!data.success) {
            throw new Error(data.error || 'Failed to load characters');
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
                        <button onclick="loadGirls()" style="background: #f093fb; border: none; padding: 10px 20px; border-radius: 8px; color: white; margin-top: 20px; cursor: pointer;">
                            Обновить
                        </button>
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
            const isNetworkError = error.message.includes('fetch') || error.message.includes('Network');
            swipeView.innerHTML = `
                <div style="color: white; text-align: center; padding: 40px;">
                    <h3>❌ ${isNetworkError ? 'Проблема с интернетом' : 'Ошибка загрузки'}</h3>
                    <p>${isNetworkError ? 'Проверьте соединение и попробуйте снова' : error.message}</p>
                    <button onclick="loadGirls()" style="background: #f093fb; border: none; padding: 10px 20px; border-radius: 8px; color: white; margin-top: 20px; cursor: pointer;">
                        Попробовать снова
                    </button>
                    <button onclick="location.reload()" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 10px 20px; border-radius: 8px; color: white; margin-top: 10px; cursor: pointer;">
                        Перезагрузить страницу
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

    // Save to backend (non-blocking - don't wait for response)
    apiFetch('/api/webapp/match', {
        method: 'POST',
        body: JSON.stringify({
            telegramId: userId,
            characterId: girlId,
            action: action
        })
    }, 1).catch(err => {
        console.error('❌ Match save error (non-critical):', err);
        // Don't show error to user - swipe animation already happened
    });

    setTimeout(() => {
        card.remove();
        currentGirlIndex++;

        // Just render next cards (no auto-open chat)
        renderCards();
        
        // Show success message for like
        if (action === 'like') {
            console.log(`✅ Liked ${girl.name} - check matches to chat!`);
        }
    }, 300);
}


// Select girl and open chat
async function selectGirl(girl) {
    selectedGirl = girl;

    try {
        // Save selection to backend (non-blocking)
        try {
            await apiFetch('/api/webapp/select-character', {
                method: 'POST',
                body: JSON.stringify({
                    telegramId: userId,
                    characterId: girl._id
                })
            }, 1);
        } catch (error) {
            console.error('❌ Failed to save selection (non-critical):', error);
        }

        // Load sympathy (non-blocking - use default if fails)
        try {
            const userRes = await apiFetch(`/api/webapp/user/${userId}`, {}, 1);
            const userData = await safeJsonParse(userRes);
            sympathy = userData.user?.sympathy?.[girl._id] || 0;
        } catch (error) {
            console.error('❌ Failed to load sympathy (non-critical):', error);
            sympathy = 0;
        }

        openChat();
    } catch (error) {
        console.error('❌ Unexpected error selecting girl:', error);
        // Still open chat even if selection save fails
        openChat();
    }
}

// Open chat - FIXED history loading
async function openChat() {
    // Prevent multiple simultaneous calls
    if (isChatLoading) {
        console.log('⚠️ Chat is already loading, skipping...');
        return;
    }

    if (!selectedGirl) {
        console.error('❌ No selected girl');
        return;
    }

    isChatLoading = true;

    document.getElementById('swipeView').style.display = 'none';
    document.getElementById('actionButtons').style.display = 'none';
    document.getElementById('matchesView').style.display = 'none';
    document.getElementById('chatView').style.display = 'flex';

    document.getElementById('chatGirlName').textContent = selectedGirl.name;
    document.getElementById('chatGirlAvatar').style.backgroundImage = `url('${selectedGirl.avatarUrl}')`;

    // Clear existing messages - but only if we're actually switching to a different girl
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) {
        console.error('❌ Chat messages container not found');
        isChatLoading = false;
        return;
    }
    
    // Store current girl ID to check if we're switching
    const currentGirlId = selectedGirl?._id;
    
    // Clear messages only if container exists
    messagesContainer.innerHTML = '';
    
    // Add a small delay to ensure DOM is ready before loading
    await new Promise(resolve => setTimeout(resolve, 10));

    try {
        // Load chat history from DB
        let historyData;
        try {
            const historyRes = await apiFetch(`/api/webapp/chat-history/${userId}/${selectedGirl._id}`);
            historyData = await safeJsonParse(historyRes);
        } catch (error) {
            console.error('❌ Error loading chat history:', error);
            // Show welcome message even if history load fails
            const welcomeMsg = selectedGirl.welcomeMessage || 'Привет! 💕';
            addMessage(welcomeMsg, 'bot');
            return;
        }

        console.log('📜 Loaded history:', historyData);

        sympathy = historyData.sympathy || 0;
        updateSympathyBar();

        if (historyData.success && historyData.history && historyData.history.length > 0) {
            // Double-check we still have the right girl selected
            if (!selectedGirl || selectedGirl._id !== currentGirlId) {
                console.warn('⚠️ Selected girl changed during load, aborting message load');
                isChatLoading = false;
                return;
            }
            
            // Verify container still exists
            if (!messagesContainer || !messagesContainer.parentNode) {
                console.error('❌ Messages container removed during load');
                isChatLoading = false;
                return;
            }
            
            // Add all messages from history with timestamps
            // Build messages synchronously first
            const messageElements = [];
            
            historyData.history.forEach((msg, index) => {
                // Create message element
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${msg.sender}`;
                
                const timeStr = msg.timestamp ? formatTimestamp(msg.timestamp) : formatTimestamp(new Date());
                
                // Parse thoughts and message for bot messages
                let messageContent = '';
                if (msg.sender === 'bot') {
                    const parsed = parseThoughtsAndMessage(msg.message);
                    if (parsed.hasThoughts) {
                        messageContent = `
                            <div class="message-thoughts">${parsed.thoughts}</div>
                            <div class="message-text">${parsed.message}</div>
                        `;
                    } else {
                        messageContent = `<div class="message-text">${parsed.message}</div>`;
                    }
                } else {
                    messageContent = `<div class="message-text">${msg.message}</div>`;
                }
                
                messageDiv.innerHTML = `
                    <div class="message-bubble">
                        ${messageContent}
                        <div class="message-time">${timeStr}</div>
                    </div>
                `;
                
                // Mark as loaded to ensure visibility
                messageDiv.classList.add('loaded');
                messageElements.push(messageDiv);
            });
            
            // Append all messages at once - directly, no async
            if (messagesContainer && messagesContainer.parentNode) {
                messageElements.forEach(msgEl => {
                    // Force immediate visibility before appending
                    msgEl.style.opacity = '1';
                    messagesContainer.appendChild(msgEl);
                });
                
                // Force a reflow to ensure messages are rendered
                messagesContainer.offsetHeight;
                
                // Mark all messages as read (update last read timestamp)
                const lastMessage = historyData.history[historyData.history.length - 1];
                if (lastMessage && lastMessage.timestamp) {
                    lastReadMessages[selectedGirl._id] = new Date(lastMessage.timestamp).getTime();
                    // Save to localStorage for persistence
                    localStorage.setItem('lastReadMessages', JSON.stringify(lastReadMessages));
                }

                // Scroll to bottom after messages are added
                setTimeout(() => {
                    if (messagesContainer && messagesContainer.parentNode) {
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                }, 100);
                
                console.log(`✅ Loaded ${historyData.history.length} messages into DOM (visible: ${messagesContainer.children.length})`);
            } else {
                console.error('❌ Messages container was removed before messages could be added');
            }
        } else {
            // No history - show welcome message and SAVE it to DB
            const welcomeMsg = selectedGirl.welcomeMessage || 'Привет! 💕';
            addMessage(welcomeMsg, 'bot');
            
            // Save welcome message to DB so it persists (non-blocking)
            try {
                await apiFetch('/api/webapp/save-message', {
                    method: 'POST',
                    body: JSON.stringify({
                        telegramId: userId,
                        characterId: selectedGirl._id,
                        message: welcomeMsg,
                        sender: 'bot'
                    })
                }, 1); // Only 1 retry for welcome message
                
                // Mark welcome message as read since we're opening the chat
                lastReadMessages[selectedGirl._id] = Date.now();
                localStorage.setItem('lastReadMessages', JSON.stringify(lastReadMessages));
                
                console.log('✅ Welcome message saved to DB');
            } catch (saveErr) {
                console.error('❌ Failed to save welcome message (non-critical):', saveErr);
                // Don't show error - welcome message is already displayed
            }
        }

        // Scroll to bottom (only if no history was loaded, as history loading handles its own scroll)
        if (!historyData.success || !historyData.history || historyData.history.length === 0) {
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 100);
        }

    } catch (error) {
        console.error('❌ Unexpected error in openChat:', error);
        // Fallback: show welcome message
        addMessage(selectedGirl.welcomeMessage || 'Привет! 💕', 'bot');
    } finally {
        // Always reset loading flag
        isChatLoading = false;
    }
}



// Back to matches view (from chat)
function backToSwipe() {
    document.getElementById('chatView').style.display = 'none';
    document.getElementById('swipeView').style.display = 'none';
    document.getElementById('actionButtons').style.display = 'none';
    document.getElementById('matchesView').style.display = 'flex';
    document.getElementById('userProfileView').style.display = 'none';

    selectedGirl = null;
    sympathy = 0;

    // Clear chat
    document.getElementById('chatMessages').innerHTML = '';

    // Update nav to matches
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.nav-item')[1].classList.add('active');

    // Reload matches list to refresh notifications
    loadMatches();
    
    // Update matches tab notification badge
    updateMatchesTabNotification();
}

// Calculate total unread messages across all matches
async function getTotalUnreadCount() {
    try {
        const userRes = await apiFetch(`/api/webapp/user/${userId}`, {}, 1);
        const userData = await safeJsonParse(userRes);
        
        if (!userData.success || !userData.user) return 0;
        
        const user = userData.user;
        const matchesRes = await apiFetch(`/api/webapp/matches/${userId}`, {}, 1);
        const matchesData = await safeJsonParse(matchesRes);
        
        if (!matchesData.success) return 0;
        
        let totalUnread = 0;
        
        matchesData.matches.forEach(girl => {
            const chatHistory = user.chatHistory?.[girl._id] || [];
            const lastReadTime = lastReadMessages[girl._id] || 0;
            
            if (chatHistory.length > 0) {
                const unread = chatHistory.filter(msg => {
                    if (msg.sender !== 'bot') return false;
                    const msgTime = new Date(msg.timestamp).getTime();
                    return msgTime > lastReadTime;
                }).length;
                
                totalUnread += unread;
            } else if (chatHistory.length === 0) {
                // Welcome message will be unread
                totalUnread += 1;
            }
        });
        
        return totalUnread;
    } catch (error) {
        console.error('Error calculating unread count:', error);
        return 0;
    }
}

// Update notification badge on matches tab
async function updateMatchesTabNotification() {
    const totalUnread = await getTotalUnreadCount();
    const matchesNavItem = document.querySelectorAll('.nav-item')[1];
    
    if (!matchesNavItem) return;
    
    // Remove existing badge
    const existingBadge = matchesNavItem.querySelector('.nav-notification-badge');
    if (existingBadge) {
        existingBadge.remove();
    }
    
    // Add badge if there are unread messages
    if (totalUnread > 0) {
        const badge = document.createElement('span');
        badge.className = 'nav-notification-badge';
        badge.textContent = totalUnread > 9 ? '9+' : totalUnread;
        matchesNavItem.appendChild(badge);
    }
}

// Send message - FIXED to save both messages
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();

    if (!message || !selectedGirl) return;

    // Add user message to UI immediately
    addMessage(message, 'user');
    input.value = '';
    
    // Disable input while processing
    input.disabled = true;

    try {
        // 1. Save user message to DB
        let saveUserData;
        try {
            const saveUserRes = await apiFetch('/api/webapp/save-message', {
                method: 'POST',
                body: JSON.stringify({
                    telegramId: userId,
                    characterId: selectedGirl._id,
                    message: message,
                    sender: 'user'
                })
            });
            saveUserData = await safeJsonParse(saveUserRes);
        } catch (error) {
            console.error('❌ Failed to save user message:', error);
            // Continue anyway - user message is already in UI
            saveUserData = { success: false };
        }

        if (saveUserData.success && saveUserData.sympathy !== undefined) {
            sympathy = saveUserData.sympathy;
            updateSympathyBar();
        }

        // 2. Show typing indicator while waiting for AI response
        showTypingIndicator();
        
        // Get AI response
        let chatData;
        try {
            const chatRes = await apiFetch('/api/webapp/chat', {
                method: 'POST',
                body: JSON.stringify({
                    telegramId: userId,
                    message: message
                })
            });
            chatData = await safeJsonParse(chatRes);
        } catch (error) {
            // Network or API error
            const isNetworkError = error.message.includes('fetch') || error.message.includes('Network');
            removeTypingIndicator();
            showError(isNetworkError ? 'Проблема с интернетом' : 'Ошибка получения ответа от AI', isNetworkError);
            addMessage('Извини, не могу ответить сейчас. Попробуй позже 😢', 'bot');
            input.disabled = false;
            return;
        }
        
        // Remove typing indicator
        removeTypingIndicator();

        if (chatData.success && chatData.response) {
            // Simulate typing delay for more natural feel
            setTimeout(async () => {
                // 3. Add bot message to UI
                addMessage(chatData.response, 'bot');

                // 4. Save bot message to DB (non-blocking - don't fail if this errors)
                try {
                    await apiFetch('/api/webapp/save-message', {
                        method: 'POST',
                        body: JSON.stringify({
                            telegramId: userId,
                            characterId: selectedGirl._id,
                            message: chatData.response,
                            sender: 'bot'
                        })
                    }, 1); // Only 1 retry for saving bot message
                } catch (saveError) {
                    console.error('❌ Failed to save bot message (non-critical):', saveError);
                    // Don't show error to user - message is already displayed
                }

                // Mark message as read since chat is open
                lastReadMessages[selectedGirl._id] = Date.now();
                localStorage.setItem('lastReadMessages', JSON.stringify(lastReadMessages));
                
                // Update matches tab notification
                updateMatchesTabNotification();

                console.log('✅ Message sent and saved');
            }, 800 + Math.random() * 700); // Random delay 800-1500ms for realism
        } else {
            // Show error message from API or default
            const errorMsg = chatData.response || chatData.error || 'Ошибка получения ответа 😢';
            addMessage(errorMsg, 'bot');
            console.error('❌ Chat API error:', chatData.error || 'Unknown error');
        }
    } catch (error) {
        console.error('❌ Unexpected error sending message:', error);
        removeTypingIndicator();
        const isNetworkError = error.message.includes('fetch') || error.message.includes('Network');
        showError('Ошибка отправки сообщения', isNetworkError);
        addMessage('Не удалось отправить сообщение. Попробуй еще раз 😢', 'bot');
    } finally {
        // Re-enable input
        input.disabled = false;
        input.focus();
    }
}



// Format timestamp to relative time
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) return 'только что';
    if (minutes < 60) return `${minutes} ${minutes === 1 ? 'мин' : 'мин'} назад`;
    if (hours < 24) return `${hours} ${hours === 1 ? 'час' : 'часов'} назад`;
    if (days < 7) return `${days} ${days === 1 ? 'день' : 'дней'} назад`;
    
    // For older messages, show date
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

// Parse thoughts and message from AI response
function parseThoughtsAndMessage(text) {
    // Check if response contains thoughts (separated by double newline or pattern)
    const parts = text.split(/\n\s*\n/);
    
    if (parts.length >= 2) {
        // Has thoughts and message
        return {
            hasThoughts: true,
            thoughts: parts[0].trim(),
            message: parts.slice(1).join('\n\n').trim()
        };
    }
    
    // Check for single newline pattern (thoughts\nmessage)
    const singleNewline = text.split('\n');
    if (singleNewline.length >= 2 && singleNewline[0].length > 20) {
        // Likely thoughts on first line, message on rest
        return {
            hasThoughts: true,
            thoughts: singleNewline[0].trim(),
            message: singleNewline.slice(1).join('\n').trim()
        };
    }
    
    // No thoughts, just regular message
    return {
        hasThoughts: false,
        thoughts: null,
        message: text
    };
}

// Add message to chat with timestamp
function addMessage(text, sender, timestamp = null) {
    const container = document.getElementById('chatMessages');
    
    if (!container) {
        console.error('❌ Chat messages container not found');
        return;
    }
    
    // Remove typing indicator if present
    removeTypingIndicator();

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const timeStr = timestamp ? formatTimestamp(timestamp) : formatTimestamp(new Date());
    
    // Parse thoughts and message for bot messages
    let messageContent = '';
    if (sender === 'bot') {
        const parsed = parseThoughtsAndMessage(text);
        if (parsed.hasThoughts) {
            messageContent = `
                <div class="message-thoughts">${parsed.thoughts}</div>
                <div class="message-text">${parsed.message}</div>
            `;
        } else {
            messageContent = `<div class="message-text">${parsed.message}</div>`;
        }
    } else {
        messageContent = `<div class="message-text">${text}</div>`;
    }
    
    messageDiv.innerHTML = `
        <div class="message-bubble">
            ${messageContent}
            <div class="message-time">${timeStr}</div>
        </div>
    `;
    
    // Mark as loaded to ensure visibility
    messageDiv.classList.add('loaded');

    // Ensure container still exists before appending
    if (container && container.parentNode) {
        container.appendChild(messageDiv);
        // Force immediate visibility
        messageDiv.style.opacity = '1';
        // Use requestAnimationFrame for smooth scrolling
        requestAnimationFrame(() => {
            if (container && container.parentNode) {
                container.scrollTop = container.scrollHeight;
            }
        });
    } else {
        console.error('❌ Chat container was removed before message could be added');
    }
}

// Show typing indicator
function showTypingIndicator() {
    const container = document.getElementById('chatMessages');
    
    // Remove existing typing indicator if any
    removeTypingIndicator();
    
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.className = 'message bot typing-indicator';
    typingDiv.innerHTML = `
        <div class="message-bubble typing-bubble">
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <div class="typing-text">${selectedGirl?.name || 'Она'} печатает...</div>
        </div>
    `;
    
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
}

// Remove typing indicator
function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
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
        const response = await apiFetch('/api/webapp/request-photo', {
            method: 'POST',
            body: JSON.stringify({
                telegramId: userId,
                characterId: selectedGirl._id
            })
        });

        const data = await safeJsonParse(response);

        if (data.success && data.photo) {
            showPhoto(data.photo, null);
            addMessage('Вот моё фото! 📸💕', 'bot');
        } else {
            const message = data.message || `Попробуй позже! Шанс: ${Math.floor(sympathy)}%`;
            showError(message, false);
            addMessage(data.message || 'Пока не готова делиться фото 🙈', 'bot');
        }
    } catch (error) {
        console.error('❌ Error requesting photo:', error);
        const isNetworkError = error.message.includes('fetch') || error.message.includes('Network');
        showError('Ошибка запроса фото', isNetworkError);
    }
}

// Show photo modal
function showPhoto(photoUrl, event) {
    // Stop any event propagation if event is provided
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    console.log('📸 showPhoto called with:', photoUrl);
    
    const photoModal = document.getElementById('photoModal');
    const photoImage = document.getElementById('photoImage');
    const characterProfileView = document.getElementById('characterProfileView');
    
    if (!photoModal || !photoImage) {
        console.error('❌ Photo modal elements not found');
        return;
    }
    
    // Set image source
    photoImage.src = photoUrl;
    
    // Add class to character profile to disable pointer events (but keep gallery items clickable)
    if (characterProfileView) {
        characterProfileView.classList.add('modal-open');
    }
    
    // Show modal with highest z-index
    photoModal.style.display = 'flex';
    photoModal.style.zIndex = '10000';
    photoModal.style.pointerEvents = 'auto';
    
    // Force modal to be on top
    setTimeout(() => {
        if (photoModal) {
            photoModal.style.display = 'flex';
            photoModal.style.zIndex = '10000';
            photoModal.style.visibility = 'visible';
        }
    }, 0);
    
    console.log('📸 Photo modal displayed, z-index:', photoModal.style.zIndex);
}

// Close photo modal
function closePhotoModal(event) {
    if (event) {
        event.stopPropagation();
    }
    
    const photoModal = document.getElementById('photoModal');
    const characterProfileView = document.getElementById('characterProfileView');
    
    if (photoModal) {
        photoModal.style.display = 'none';
        console.log('📸 Photo modal closed');
    }
    
    // Remove modal-open class from character profile
    if (characterProfileView) {
        characterProfileView.classList.remove('modal-open');
    }
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

    // Reload matches to show updated notifications
    loadMatches();
    
    // Update matches tab notification badge
    updateMatchesTabNotification();
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

        let matchesData;
        try {
            const matchesRes = await apiFetch(`/api/webapp/matches/${userId}`);
            matchesData = await safeJsonParse(matchesRes);
        } catch (error) {
            console.error('❌ Error loading matches:', error);
            document.getElementById('matchesLoading').style.display = 'none';
            const isNetworkError = error.message.includes('fetch') || error.message.includes('Network');
            showError(isNetworkError ? 'Проблема с интернетом при загрузке совпадений' : 'Ошибка загрузки совпадений', isNetworkError);
            return;
        }

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

        let userData;
        try {
            const userRes = await apiFetch(`/api/webapp/user/${userId}`);
            userData = await safeJsonParse(userRes);
        } catch (error) {
            console.error('❌ Error loading user data:', error);
            // Continue with matches even if user data fails - use defaults
            userData = { success: true, user: {} };
        }

        console.log('👤 User data:', userData);

        matchesData.matches.forEach(girl => {
            const sympathy = userData.user?.sympathy?.[girl._id] || 0;
            
            // Get last message from chat history, or fall back to welcome message
            const chatHistory = userData.user?.chatHistory?.[girl._id] || [];
            let lastMessage = girl.welcomeMessage || 'Привет! 💕';
            let lastMessageTime = null;
            if (chatHistory.length > 0) {
                const lastMsg = chatHistory[chatHistory.length - 1];
                lastMessage = lastMsg.message;
                lastMessageTime = lastMsg.timestamp;
            }
            
            // Calculate unread messages (bot messages after last read)
            const lastReadTime = lastReadMessages[girl._id] || 0;
            let unreadCount = 0;
            
            if (chatHistory.length > 0) {
                if (lastReadTime > 0) {
                    // Count bot messages after last read time
                    unreadCount = chatHistory.filter(msg => {
                        if (msg.sender !== 'bot') return false;
                        const msgTime = new Date(msg.timestamp).getTime();
                        return msgTime > lastReadTime;
                    }).length;
                } else {
                    // If never read, count all bot messages (including welcome)
                    unreadCount = chatHistory.filter(msg => msg.sender === 'bot').length;
                }
            } else {
                // No chat history yet - welcome message will be unread when it's sent
                unreadCount = 0;
            }
            
            // Truncate long messages for preview
            if (lastMessage.length > 40) {
                lastMessage = lastMessage.substring(0, 40) + '...';
            }

            const card = document.createElement('div');
            card.className = 'match-card';
            if (unreadCount > 0) {
                card.classList.add('has-notification');
            }
            card.onclick = () => selectGirlFromMatches(girl);

            card.innerHTML = `
                <div class="match-avatar" style="background-image: url('${girl.avatarUrl}')">
                    ${unreadCount > 0 ? `<div class="notification-badge">${unreadCount > 9 ? '9+' : unreadCount}</div>` : ''}
                </div>
                <div class="match-info">
                    <div class="match-name">
                        ${girl.name}
                        ${unreadCount > 0 ? '<span class="notification-dot"></span>' : ''}
                    </div>
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
        console.error('❌ Unexpected error in loadMatches:', error);
        document.getElementById('matchesLoading').style.display = 'none';
        const isNetworkError = error.message.includes('fetch') || error.message.includes('Network');
        showError('Ошибка загрузки совпадений', isNetworkError);
        // Show empty state as fallback
        document.getElementById('noMatches').style.display = 'block';
    }
}



// Open chat from matches
async function selectGirlFromMatches(girl) {
    selectedGirl = girl;

    try {
        try {
            await apiFetch('/api/webapp/select-character', {
                method: 'POST',
                body: JSON.stringify({
                    telegramId: userId,
                    characterId: girl._id
                })
            }, 1);
        } catch (error) {
            console.error('❌ Failed to save selection (non-critical):', error);
        }

        try {
            const userRes = await apiFetch(`/api/webapp/user/${userId}`, {}, 1);
            const userData = await safeJsonParse(userRes);
            sympathy = userData.user?.sympathy?.[girl._id] || 0;
        } catch (error) {
            console.error('❌ Failed to load sympathy (non-critical):', error);
            sympathy = 0;
        }

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
        const userRes = await apiFetch(`/api/webapp/user/${userId}`, {}, 1);
        const userData = await safeJsonParse(userRes);

        console.log('👤 User profile data:', userData);

        if (userData.success && userData.user) {
            const user = userData.user;
            
            // Set user ID
            document.getElementById('userProfileId').textContent = `ID: ${userId}`;
            
            // Get Telegram user info and profile picture
            if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
                const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
                const name = tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '');
                document.getElementById('userProfileName').textContent = name || 'Пользователь';
            }
            
            // Set profile picture using helper function
            setTelegramProfilePicture('userProfileAvatar');
            
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
        const matchesRes = await apiFetch(`/api/webapp/matches/${userId}`, {}, 1);
        const matchesData = await safeJsonParse(matchesRes);
        
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
        try {
            await apiFetch('/api/webapp/select-character', {
                method: 'POST',
                body: JSON.stringify({
                    telegramId: userId,
                    characterId: girl._id
                })
            }, 1);
        } catch (error) {
            console.error('❌ Failed to save selection (non-critical):', error);
        }
        
        try {
            const userRes = await apiFetch(`/api/webapp/user/${userId}`, {}, 1);
            const userData = await safeJsonParse(userRes);
            sympathy = userData.user?.sympathy?.[girl._id] || 0;
        } catch (error) {
            console.error('❌ Failed to load sympathy (non-critical):', error);
            sympathy = 0;
        }
        
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
        const res = await apiFetch('/api/webapp/add-credits', {
            method: 'POST',
            body: JSON.stringify({
                telegramId: userId,
                amount: 50
            })
        });
        
        const data = await safeJsonParse(res);
        
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
        const entRes = await apiFetch(`/api/webapp/user-entitlements/${userId}`, {}, 1);
        const entData = await safeJsonParse(entRes);
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
    avatarItem.onclick = (e) => {
        console.log('📸 Avatar clicked');
        e.stopPropagation();
        e.preventDefault();
        showPhoto(selectedGirl.avatarUrl, e);
        return false;
    };
    
    // Also add touch event for mobile
    avatarItem.ontouchstart = (e) => {
        console.log('📸 Avatar touched');
        e.stopPropagation();
        e.preventDefault();
        showPhoto(selectedGirl.avatarUrl, e);
        return false;
    };
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
                item.onclick = (e) => {
                    console.log('📸 Photo clicked:', photoUrl);
                    e.stopPropagation();
                    e.preventDefault();
                    showPhoto(photoUrl, e);
                    return false;
                };
                
                // Also add touch event for mobile
                item.ontouchstart = (e) => {
                    console.log('📸 Photo touched:', photoUrl);
                    e.stopPropagation();
                    e.preventDefault();
                    showPhoto(photoUrl, e);
                    return false;
                };
            } else {
                item.classList.add('locked');
                item.onclick = (e) => {
                    console.log('📸 Locked photo clicked:', photoUrl);
                    e.stopPropagation();
                    e.preventDefault();
                    handleLockedPhoto(photoUrl, e);
                    return false;
                };
                
                // Also add touch event for mobile
                item.ontouchstart = (e) => {
                    console.log('📸 Locked photo touched:', photoUrl);
                    e.stopPropagation();
                    e.preventDefault();
                    handleLockedPhoto(photoUrl, e);
                    return false;
                };
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
async function handleLockedPhoto(photoUrl, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
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
        const res = await apiFetch('/api/webapp/unlock-photo', {
            method: 'POST',
            body: JSON.stringify({
                telegramId: userId,
                characterId: selectedGirl._id,
                photoUrl: photoUrl
            })
        });
        
        const data = await safeJsonParse(res);
        
        if (data.success) {
            // Update local entitlements
            userEntitlements.credits = data.remainingCredits;
            if (!userEntitlements.unlockedPhotos[selectedGirl._id]) {
                userEntitlements.unlockedPhotos[selectedGirl._id] = [];
            }
            userEntitlements.unlockedPhotos[selectedGirl._id].push(photoUrl);
            
            // Show the photo
            showPhoto(photoUrl, null);
            
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
