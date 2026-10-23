const chatToggle = document.getElementById('chat-toggle');
const chatPanel = document.getElementById('chat-panel');
const chatClose = document.getElementById('chat-close');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');
const chatSend = document.getElementById('chat-send');

let chatHistory = [];
let chatBusy = false;

const CHAT_ENDPOINTS = ['/api/chat', 'chat.php'];

const ICON_CHAT = '<i class="fa-solid fa-comment-dots"></i>';
const ICON_CLOSE = '<i class="fa-solid fa-chevron-down"></i>';

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderMarkdown(text) {
    let html = escapeHtml(text);
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\n/g, '<br>');
    return html;
}

function addMessage(text, who) {
    const row = document.createElement('div');
    row.className = `chat-msg chat-msg--${who}`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.innerHTML = renderMarkdown(text);

    row.appendChild(bubble);
    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return row;
}

function showTyping() {
    const row = document.createElement('div');
    row.className = 'chat-msg chat-msg--bot chat-typing-row';
    row.innerHTML = '<div class="chat-bubble chat-typing"><span></span><span></span><span></span></div>';
    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return row;
}

function openChat() {
    chatPanel.classList.add('open');
    chatToggle.classList.add('active');
    chatToggle.innerHTML = ICON_CLOSE;
    document.body.classList.add('chat-open');
    setTimeout(() => chatInput.focus(), 250);
}

function closeChat() {
    chatPanel.classList.remove('open');
    chatToggle.classList.remove('active');
    chatToggle.innerHTML = ICON_CHAT;
    document.body.classList.remove('chat-open');
}

chatToggle.addEventListener('click', () => {
    if (chatPanel.classList.contains('open')) {
        closeChat();
    } else {
        openChat();
    }
});

chatClose.addEventListener('click', closeChat);

async function sendMessage(text) {
    if (chatBusy) return;
    const message = text.trim();
    if (!message) return;

    chatBusy = true;
    chatSend.disabled = true;

    addMessage(message, 'user');
    chatInput.value = '';
    chatInput.style.height = 'auto';

    const typing = showTyping();

    let handled = false;

    for (const endpoint of CHAT_ENDPOINTS) {
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, history: chatHistory })
            });

            if (!res.ok) {
                continue;
            }

            const data = await res.json();
            if (data.error) {
                continue;
            }

            typing.remove();
            addMessage(data.reply, 'bot');
            chatHistory.push({ role: 'user', text: message });
            chatHistory.push({ role: 'model', text: data.reply });
            if (chatHistory.length > 20) {
                chatHistory = chatHistory.slice(-20);
            }
            handled = true;
            break;
        } catch (err) {
            continue;
        }
    }

    if (!handled) {
        typing.remove();
        addMessage('Koneksi gagal. Pastikan server berjalan lalu coba lagi.', 'bot');
    }

    chatBusy = false;
    chatSend.disabled = false;
    chatInput.focus();
}

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage(chatInput.value);
});

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(chatInput.value);
    }
});

chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
});

document.querySelectorAll('.chat-suggest').forEach((btn) => {
    btn.addEventListener('click', () => {
        sendMessage(btn.textContent);
    });
});

addMessage('Hai! Saya asisten virtual Swandy. Tanya apa saja soal portofolio, proyek, atau cara menghubungi dia.', 'bot');

// Close chat when guestbook opens
window.addEventListener('guestbook:open', closeChat);