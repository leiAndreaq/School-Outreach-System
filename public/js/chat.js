// ── CHAT STATE ──
let chatMessages   = [];
let chatOpen       = false;
let chatTyping     = false;

// ── TOGGLE CHAT WINDOW ──
function toggleChat() {
  chatOpen = !chatOpen;
  const win = document.getElementById('chatWindow');
  const btn = document.getElementById('chatToggleBtn');
  win.style.display = chatOpen ? 'flex' : 'none';
  btn.innerHTML = chatOpen
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
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

  chatMessages.push({ role: 'user', content: text });
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
      chatMessages.push({ role: 'assistant', content: '⚠️ ' + data.error });
    } else {
      chatMessages.push({ role: 'assistant', content: data.reply });
    }
  } catch (e) {
    chatMessages.push({ role: 'assistant', content: '⚠️ Connection error. Please try again.' });
  }

  chatTyping = false;
  renderChatMessages();
  scrollChatBottom();
}

// ── RENDER MESSAGES ──
function renderChatMessages() {
  const body = document.getElementById('chatBody');
  body.innerHTML = chatMessages.map((m, i) => {
    const isUser = m.role === 'user';
    const content = parseMessageContent(m.content, i);
    return `
      <div style="display:flex; flex-direction:column;
        align-items:${isUser ? 'flex-end' : 'flex-start'}; margin-bottom:12px;">
        ${!isUser ? `<div style="font-size:10px; color:#9ca3af; margin-bottom:3px; padding-left:4px;">
          PathFinder AI</div>` : ''}
        <div style="max-width:85%; padding:10px 14px; border-radius:${isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};
          background:${isUser ? '#1B1F6B' : '#f3f4f6'};
          color:${isUser ? '#ffffff' : '#1f2937'};
          font-size:13px; line-height:1.7; white-space:pre-wrap; word-break:break-word;">
          ${content}
        </div>
      </div>`;
  }).join('') + (chatTyping ? typingBubble() : '');

  // Re-render lucide icons if needed
  if (window.lucide) lucide.createIcons();
}

// ── PARSE CSV BLOCKS ──
function parseMessageContent(text, msgIndex) {
  const csvNameMatch  = text.match(/\[CSV_NAME\](.*?)\[\/CSV_NAME\]/s);
  const csvDataMatch  = text.match(/\[CSV_START\]([\s\S]*?)\[\/CSV_END\]/s);

  if (csvDataMatch) {
    const filename = csvNameMatch ? csvNameMatch[1].trim() : 'export.csv';
    const csvData  = csvDataMatch[1].trim();

    // Store CSV data for download
    window._csvStore = window._csvStore || {};
    window._csvStore[msgIndex] = { filename, data: csvData };

    // Remove the markers from display text
    let displayText = text
      .replace(/\[CSV_NAME\].*?\[\/CSV_NAME\]/s, '')
      .replace(/\[CSV_START\][\s\S]*?\[\/CSV_END\]/s, '')
      .trim();

    const escaped = escapeHtml(displayText);
    return `${escaped}
<div style="margin-top:10px; padding:10px 12px; background:#dcfce7; border-radius:8px;
  border:1px solid #86efac; display:flex; align-items:center; gap:8px;">
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="#166534" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
  <div style="flex:1;">
    <div style="font-size:12px; font-weight:600; color:#166534;">${escapeHtml(filename)}</div>
    <div style="font-size:11px; color:#166534;">CSV file ready</div>
  </div>
  <button onclick="downloadCsv(${msgIndex})"
    style="padding:5px 12px; background:#166534; color:#fff; border:none;
      border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">
    Download
  </button>
</div>`;
  }

  return escapeHtml(text);
}

function escapeHtml(text) {
  return text
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
    <div id="typingIndicator" style="display:flex; align-items:flex-start; margin-bottom:12px;">
      <div style="padding:10px 16px; background:#f3f4f6; border-radius:16px 16px 16px 4px;">
        <div style="display:flex; gap:4px; align-items:center; height:16px;">
          <div style="width:6px;height:6px;border-radius:50%;background:#9ca3af;
            animation:chatDot 1.2s infinite 0s;"></div>
          <div style="width:6px;height:6px;border-radius:50%;background:#9ca3af;
            animation:chatDot 1.2s infinite 0.2s;"></div>
          <div style="width:6px;height:6px;border-radius:50%;background:#9ca3af;
            animation:chatDot 1.2s infinite 0.4s;"></div>
        </div>
      </div>
    </div>`;
}

function scrollChatBottom() {
  const body = document.getElementById('chatBody');
  if (body) body.scrollTop = body.scrollHeight;
}

// ── CLEAR CHAT ──
function clearChat() {
  chatMessages = [];
  window._csvStore = {};
  renderChatMessages();
  document.getElementById('chatBody').innerHTML = chatWelcome();
}

function chatWelcome() {
  return `
    <div style="text-align:center; padding:24px 16px; color:#9ca3af;">
      <div style="font-size:28px; margin-bottom:8px;">🤖</div>
      <div style="font-size:13px; font-weight:600; color:#374151; margin-bottom:4px;">PathFinder AI Assistant</div>
      <div style="font-size:12px; line-height:1.6;">
        Ask me anything — research schools,<br>generate CSV files, draft emails, and more.
      </div>
      <div style="margin-top:16px; display:flex; flex-direction:column; gap:6px;">
        ${['Find private schools in Quezon City',
           'Generate a CSV of schools in Metro Manila',
           'Draft a follow-up email for a school'].map(s =>
          `<button onclick="usePrompt('${s}')"
            style="padding:7px 12px; background:#f3f4f6; border:1px solid #e5e7eb;
              border-radius:8px; font-size:11px; color:#374151; cursor:pointer;
              text-align:left; transition:background 0.15s;"
            onmouseover="this.style.background='#e5e7eb'"
            onmouseout="this.style.background='#f3f4f6'">
            ${s}
          </button>`
        ).join('')}
      </div>
    </div>`;
}

function usePrompt(text) {
  const input = document.getElementById('chatInput');
  input.value = text;
  input.focus();
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
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// ── INJECT CHAT STYLES ──
(function injectChatStyles() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes chatDot {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-4px); opacity: 1; }
    }
    #chatWindow { flex-direction: column; }
    #chatInput:focus { outline: none; }
    #chatToggleBtn:hover { transform: scale(1.08); }
  `;
  document.head.appendChild(style);
})();
