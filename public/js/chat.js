// ── CHAT STATE ──
let chatMessages = [];
let chatOpen     = false;
let chatTyping   = false;

function nowTime() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ── TOGGLE CHAT WINDOW ──
function toggleChat() {
  chatOpen = !chatOpen;
  const win = document.getElementById('chatWindow');
  const btn = document.getElementById('chatToggleBtn');
  win.style.display = chatOpen ? 'flex' : 'none';
  btn.innerHTML = chatOpen
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
  if (chatOpen) {
    setTimeout(() => document.getElementById('chatInput').focus(), 100);
  }
}

// ── SEND MESSAGE ──
async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text || chatTyping) return;

  input.value = '';
  input.style.height = 'auto';
  updateSendBtn();

  chatMessages.push({ role: 'user', content: text, time: nowTime() });
  renderChatMessages();
  scrollChatBottom();

  chatTyping = true;
  showTypingIndicator();

  try {
    const res  = await fetch('/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ messages: chatMessages })
    });
    const data = await res.json();

    if (data.error) {
      chatMessages.push({ role: 'assistant', content: '⚠️ ' + data.error, time: nowTime() });
    } else {
      chatMessages.push({ role: 'assistant', content: data.reply, time: nowTime() });
    }
  } catch (e) {
    chatMessages.push({ role: 'assistant', content: '⚠️ Connection error. Please try again.', time: nowTime() });
  }

  chatTyping = false;
  renderChatMessages();
  scrollChatBottom();
}

// ── BOT AVATAR SVG ──
function botAvatar() {
  return `
    <div style="width:32px; height:32px; border-radius:50%; background:#e8eaf6;
      display:flex; align-items:center; justify-content:center; flex-shrink:0;">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="#1B1F6B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    </div>`;
}

// ── RENDER MESSAGES ──
function renderChatMessages() {
  const body = document.getElementById('chatBody');
  body.innerHTML = chatMessages.map((m, i) => {
    const isUser  = m.role === 'user';
    const content = parseMessageContent(m.content, i);
    const time    = m.time || '';

    if (isUser) {
      return `
        <div class="chat-msg-in" style="display:flex; flex-direction:column; align-items:flex-end; margin-bottom:14px;">
          <div style="max-width:80%; padding:10px 14px;
            border-radius:18px 18px 4px 18px;
            background:#1B1F6B; color:#fff;
            font-size:13px; line-height:1.7; white-space:pre-wrap; word-break:break-word;">
            ${content}
          </div>
          ${time ? `<span style="font-size:10px; color:#9ca3af; margin-top:4px; padding-right:2px;">${time}</span>` : ''}
        </div>`;
    }

    return `
      <div class="chat-msg-in" style="display:flex; align-items:flex-start; gap:10px; margin-bottom:14px;">
        ${botAvatar()}
        <div style="flex:1; min-width:0;">
          <div style="max-width:100%; padding:10px 14px;
            border-radius:4px 18px 18px 18px;
            background:#fff; color:#1f2937;
            border:1px solid #e5e7eb;
            font-size:13px; line-height:1.7; white-space:pre-wrap; word-break:break-word;
            box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            ${content}
          </div>
          <div style="display:flex; align-items:center; gap:8px; margin-top:5px; padding-left:2px;">
            ${time ? `<span style="font-size:10px; color:#9ca3af;">${time}</span>` : ''}
            <button onclick="speakMessage(${i})" title="Read aloud" id="speakBtn_${i}"
              style="background:none; border:none; color:#9ca3af; cursor:pointer;
                padding:0; display:flex; align-items:center; gap:3px;
                font-size:10px; transition:color 0.15s;"
              onmouseover="this.style.color='#1B1F6B'"
              onmouseout="this.style.color='#9ca3af'">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              </svg>
            </button>
          </div>
        </div>
      </div>`;
  }).join('') + (chatTyping ? typingBubble() : '');

  if (window.lucide) lucide.createIcons();
}

// ── PARSE CSV BLOCKS ──
function parseMessageContent(text, msgIndex) {
  const csvNameMatch = text.match(/\[CSV_NAME\](.*?)\[\/CSV_NAME\]/s);
  const csvDataMatch = text.match(/\[CSV_START\]([\s\S]*?)\[\/CSV_END\]/s);

  if (csvDataMatch) {
    const filename = csvNameMatch ? csvNameMatch[1].trim() : 'export.csv';
    const csvData  = csvDataMatch[1].trim();

    window._csvStore = window._csvStore || {};
    window._csvStore[msgIndex] = { filename, data: csvData };

    let displayText = text
      .replace(/\[CSV_NAME\].*?\[\/CSV_NAME\]/s, '')
      .replace(/\[CSV_START\][\s\S]*?\[\/CSV_END\]/s, '')
      .trim();

    return `${escapeHtml(displayText)}
<div style="margin-top:10px; padding:10px 12px; background:#f0fdf4; border-radius:8px;
  border:1px solid #86efac; display:flex; align-items:center; gap:8px;">
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="#166534" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
  <div style="flex:1;">
    <div style="font-size:12px; font-weight:600; color:#166534;">${escapeHtml(filename)}</div>
    <div style="font-size:11px; color:#16a34a;">CSV file ready to download</div>
  </div>
  <button onclick="downloadCsv(${msgIndex})"
    style="padding:5px 12px; background:#16a34a; color:#fff; border:none;
      border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;
      transition:background 0.15s;"
    onmouseover="this.style.background='#15803d'"
    onmouseout="this.style.background='#16a34a'">Download</button>
</div>`;
  }

  return escapeHtml(text);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── DOWNLOAD CSV ──
function downloadCsv(msgIndex) {
  const store = window._csvStore && window._csvStore[msgIndex];
  if (!store) return;
  const blob = new Blob([store.data], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = store.filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── TYPING INDICATOR ──
function showTypingIndicator() {
  const body = document.getElementById('chatBody');
  body.innerHTML += typingBubble();
  scrollChatBottom();
}

function typingBubble() {
  return `
    <div id="typingIndicator" style="display:flex; align-items:flex-start; gap:10px; margin-bottom:12px;">
      ${botAvatar()}
      <div style="padding:12px 16px; background:#fff; border:1px solid #e5e7eb;
        border-radius:4px 18px 18px 18px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div style="display:flex; gap:4px; align-items:center; height:16px;">
          <div style="width:6px;height:6px;border-radius:50%;background:#9ca3af;animation:chatDot 1.2s infinite 0s;"></div>
          <div style="width:6px;height:6px;border-radius:50%;background:#9ca3af;animation:chatDot 1.2s infinite 0.2s;"></div>
          <div style="width:6px;height:6px;border-radius:50%;background:#9ca3af;animation:chatDot 1.2s infinite 0.4s;"></div>
        </div>
      </div>
    </div>`;
}

// ── TEXT TO SPEECH ──
function speakMessage(index) {
  if (!window.speechSynthesis) {
    showToast('Text-to-speech is not supported in this browser', 'error');
    return;
  }

  const text = index === -1
    ? 'Hello! How can I help you today?'
    : chatMessages[index]?.content;

  if (!text) return;

  // Stop any ongoing speech
  window.speechSynthesis.cancel();

  const clean = text.replace(/⚠️/g, '').replace(/[[\]]/g, '').trim();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = 0.92;
  utterance.pitch = 1;

  const btn = document.getElementById(`speakBtn_${index}`);
  if (btn) btn.style.color = '#1B1F6B';
  utterance.onend = () => { if (btn) btn.style.color = '#9ca3af'; };

  window.speechSynthesis.speak(utterance);
}

// ── SCROLL TO BOTTOM ──
function scrollChatBottom() {
  const body = document.getElementById('chatBody');
  if (body) body.scrollTop = body.scrollHeight;
}

// ── CLEAR CHAT ──
function clearChat() {
  chatMessages    = [];
  window._csvStore = {};
  window.speechSynthesis && window.speechSynthesis.cancel();
  document.getElementById('chatBody').innerHTML = chatWelcome();
}

// ── WELCOME SCREEN ──
function chatWelcome() {
  const chips = [
    { icon: '🔍', text: 'Find private schools in Quezon City' },
    { icon: '📄', text: 'Generate a CSV of schools in Metro Manila' },
    { icon: '✉️', text: 'Draft a follow-up email for a school' },
  ];
  return `
    <div style="display:flex; align-items:flex-start; gap:10px; margin-bottom:16px;" class="chat-msg-in">
      ${botAvatar()}
      <div>
        <div style="padding:10px 14px; background:#fff; color:#1f2937;
          border:1px solid #e5e7eb; border-radius:4px 18px 18px 18px;
          font-size:13px; line-height:1.7;
          box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          Hello! How can I help you today?
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-top:5px; padding-left:2px;">
          <span style="font-size:10px; color:#9ca3af;">${nowTime()}</span>
          <button onclick="speakMessage(-1)" title="Read aloud" id="speakBtn_-1"
            style="background:none; border:none; color:#9ca3af; cursor:pointer;
              padding:0; display:flex; align-items:center; transition:color 0.15s;"
            onmouseover="this.style.color='#1B1F6B'"
            onmouseout="this.style.color='#9ca3af'">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div style="margin-bottom:8px;">
      <div style="font-size:10px; color:#9ca3af; margin-bottom:6px; padding-left:2px; font-weight:500; text-transform:uppercase; letter-spacing:0.05em;">Suggestions</div>
      <div style="display:flex; flex-direction:column; gap:6px;">
        ${chips.map(c => `
          <button onclick="usePrompt('${c.text}')"
            style="padding:8px 12px; background:#fff; border:1px solid #e5e7eb;
              border-radius:10px; font-size:12px; color:#374151; cursor:pointer;
              text-align:left; display:flex; align-items:center; gap:8px;
              transition:all 0.15s; box-shadow:0 1px 2px rgba(0,0,0,0.04);"
            onmouseover="this.style.borderColor='#1B1F6B';this.style.color='#1B1F6B'"
            onmouseout="this.style.borderColor='#e5e7eb';this.style.color='#374151'">
            <span>${c.icon}</span><span>${c.text}</span>
          </button>`).join('')}
      </div>
    </div>`;
}

// ── USE SUGGESTION ──
function usePrompt(text) {
  const input = document.getElementById('chatInput');
  input.value = text;
  input.focus();
  chatInputResize(input);
  updateSendBtn();
}

// ── KEYBOARD SEND ──
function chatKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
}

// ── AUTO RESIZE TEXTAREA ──
function chatInputResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 96) + 'px';
  updateSendBtn();
}

// ── SEND BUTTON ACTIVE STATE ──
function updateSendBtn() {
  const input = document.getElementById('chatInput');
  const btn   = document.getElementById('chatSendBtn');
  if (!btn || !input) return;
  const hasText = input.value.trim().length > 0;
  btn.disabled             = !hasText;
  btn.style.background     = hasText ? '#1B1F6B' : '#d1d5db';
  btn.style.cursor         = hasText ? 'pointer'  : 'default';
}

// ── INJECT CHAT STYLES ──
(function injectChatStyles() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes chatDot {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30%            { transform: translateY(-4px); opacity: 1; }
    }
    @keyframes chatFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    #chatWindow { flex-direction: column; }
    #chatInput  { outline: none; }
    #chatToggleBtn:hover { transform: scale(1.08); }
    .chat-msg-in { animation: chatFadeIn 0.2s ease; }
    #chatBody::-webkit-scrollbar       { width: 4px; }
    #chatBody::-webkit-scrollbar-track { background: transparent; }
    #chatBody::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }
    #chatSendBtn:hover:not([disabled]) { background: #2334a8 !important; }
  `;
  document.head.appendChild(style);
})();
