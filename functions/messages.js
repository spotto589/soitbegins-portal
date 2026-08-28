function renderPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>S!GNAL :: MESSAGES</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&display=swap');
  *{ margin:0; padding:0; box-sizing:border-box; }
  html, body{ min-height:100%; background:#0a0508; }
  body{
    font-family:'Chakra Petch',sans-serif;
    color:#e8e8e8;
  }
  .wrap{ max-width:920px; margin:0 auto; padding:2rem 1.25rem 4rem; }
  .eyebrow{
    font-size:11px; letter-spacing:0.3em; color:#39ff14; text-transform:uppercase;
    opacity:0.85; margin-bottom:0.5rem;
  }
  h1{ font-size:clamp(22px,4vw,32px); letter-spacing:0.05em; margin-bottom:1.5rem; }
  .back-link{ display:inline-block; margin-bottom:1.5rem; color:rgba(232,232,232,0.55); font-size:12px; letter-spacing:0.1em; text-decoration:none; }
  .back-link:hover{ color:#39ff14; }

  .connect-box{ text-align:center; padding:4rem 1rem; }
  .connect-box p{ color:rgba(232,232,232,0.65); margin-bottom:1.5rem; font-size:14px; }
  .connect-btn, .send-btn{
    background:transparent; border:1px solid rgba(57,255,20,0.55); color:#39ff14;
    font-family:inherit; font-size:14px; letter-spacing:0.12em; padding:0.8em 1.6em;
    cursor:pointer; text-transform:uppercase; transition:background 0.15s ease;
  }
  .connect-btn:hover, .send-btn:hover{ background:rgba(57,255,20,0.1); }
  .connect-btn:disabled, .send-btn:disabled{ opacity:0.4; cursor:default; }
  .connect-status{ margin-top:1rem; font-size:12px; color:rgba(232,232,232,0.5); min-height:1.2em; }

  .app{ display:none; }
  .app.show{ display:block; }

  .layout{ display:grid; grid-template-columns:280px 1fr; gap:1.5rem; }
  @media (max-width:700px){ .layout{ grid-template-columns:1fr; } }

  .inbox-panel, .thread-panel{
    border:1px solid rgba(57,255,20,0.25); background:rgba(57,255,20,0.03);
  }
  .panel-head{
    padding:0.9rem 1rem; border-bottom:1px solid rgba(57,255,20,0.2);
    font-size:11px; letter-spacing:0.2em; text-transform:uppercase; color:rgba(232,232,232,0.6);
  }
  .convo-list{ max-height:520px; overflow-y:auto; }
  .convo-row{
    display:block; width:100%; text-align:left; background:none; border:none;
    border-bottom:1px solid rgba(255,255,255,0.06); color:inherit; font-family:inherit;
    padding:0.8rem 1rem; cursor:pointer;
  }
  .convo-row:hover, .convo-row.active{ background:rgba(57,255,20,0.06); }
  .convo-wallet{ font-size:13px; letter-spacing:0.05em; display:flex; align-items:center; gap:0.5em; }
  .convo-unread{
    background:#39ff14; color:#0a0508; font-size:10px; font-weight:700;
    border-radius:999px; padding:0.1em 0.55em;
  }
  .convo-preview{
    margin-top:0.3rem; font-size:12px; color:rgba(232,232,232,0.5);
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .empty-note{ padding:1.5rem 1rem; font-size:12px; color:rgba(232,232,232,0.45); }

  .thread-panel{ display:flex; flex-direction:column; min-height:560px; }
  .thread-empty{
    flex:1; display:flex; align-items:center; justify-content:center;
    color:rgba(232,232,232,0.4); font-size:13px; padding:2rem;
  }
  .thread-body{ flex:1; overflow-y:auto; padding:1rem; display:flex; flex-direction:column; gap:0.6rem; }
  .msg-bubble{
    max-width:75%; padding:0.6em 0.9em; font-size:13px; line-height:1.5;
    border:1px solid rgba(255,255,255,0.1); word-wrap:break-word; white-space:pre-wrap;
  }
  .msg-bubble.mine{
    align-self:flex-end; background:rgba(57,255,20,0.12); border-color:rgba(57,255,20,0.35);
  }
  .msg-bubble.theirs{ align-self:flex-start; background:rgba(255,255,255,0.04); }
  .msg-time{ font-size:10px; color:rgba(232,232,232,0.35); margin-top:0.3em; }

  .composer{ display:flex; gap:0.6rem; padding:1rem; border-top:1px solid rgba(57,255,20,0.2); }
  .composer textarea{
    flex:1; resize:none; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.15);
    color:#e8e8e8; font-family:inherit; font-size:13px; padding:0.6em; min-height:2.6em; max-height:8em;
  }
  .composer textarea:focus{ outline:1px solid rgba(57,255,20,0.5); }
  .thread-error{ font-size:11px; color:#ff5a7a; padding:0 1rem 0.6rem; min-height:1.2em; }
</style>
</head>
<body>
  <div class="wrap">
    <a class="back-link" href="/board">&larr; BACK T0 FL0CK</a>
    <div class="eyebrow">S!GNAL_NODE :: PR!VATE CHANNEL</div>
    <h1>MESSAGES</h1>

    <div class="connect-box" id="connectBox">
      <p>C0NNECT Y0UR WALLET T0 READ AND SEND MESSAGES.</p>
      <button class="connect-btn" id="connectBtn">C0NNECT WALLET</button>
      <div class="connect-status" id="connectStatus"></div>
    </div>

    <div class="app" id="app">
      <div class="layout">
        <div class="inbox-panel">
          <div class="panel-head">C0NVERSAT!0NS</div>
          <div class="convo-list" id="convoList"><div class="empty-note">L0AD!NG...</div></div>
        </div>
        <div class="thread-panel">
          <div class="panel-head" id="threadHead">SELECT A C0NVERSAT!0N</div>
          <div class="thread-empty" id="threadEmpty">Pick someone on the left, or open a conversation from a listing to start one.</div>
          <div class="thread-body" id="threadBody" style="display:none;"></div>
          <div class="thread-error" id="threadError"></div>
          <div class="composer" id="composer" style="display:none;">
            <textarea id="composeText" maxlength="1000" placeholder="TYPE A MESSAGE..."></textarea>
            <button class="send-btn" id="sendBtn">SEND</button>
          </div>
        </div>
      </div>
    </div>
  </div>

<script src="https://xumm.app/assets/cdn/xumm-oauth2-pkce.min.js"></script>
<script>
  const XAMAN_API_KEY = 'c418ff7d-673f-4a7a-b797-3bb0413653f1';
  const connectBox = document.getElementById('connectBox');
  const connectBtn = document.getElementById('connectBtn');
  const connectStatus = document.getElementById('connectStatus');
  const appEl = document.getElementById('app');
  const convoList = document.getElementById('convoList');
  const threadHead = document.getElementById('threadHead');
  const threadEmpty = document.getElementById('threadEmpty');
  const threadBody = document.getElementById('threadBody');
  const threadError = document.getElementById('threadError');
  const composer = document.getElementById('composer');
  const composeText = document.getElementById('composeText');
  const sendBtn = document.getElementById('sendBtn');

  const params = new URLSearchParams(window.location.search);
  let activeWallet = params.get('to') || null;

  function shorten(addr){ return addr ? addr.slice(0,9) + '...' + addr.slice(-4) : ''; }
  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function fmtTime(unixSeconds){
    return new Date(unixSeconds * 1000).toLocaleString();
  }

  async function loadInbox(){
    const res = await fetch('/api/messages-inbox');
    if(!res.ok){ convoList.innerHTML = '<div class="empty-note">ERR://C0ULD N0T L0AD</div>'; return; }
    const data = await res.json();
    const items = data.items || [];
    if(!items.length && !activeWallet){
      convoList.innerHTML = '<div class="empty-note">N0 C0NVERSAT!0NS YET.</div>';
    } else {
      convoList.innerHTML = items.map(it => \`
        <button class="convo-row\${it.wallet === activeWallet ? ' active' : ''}" data-wallet="\${escapeHtml(it.wallet)}">
          <div class="convo-wallet">\${escapeHtml(it.walletShort)}\${it.unreadCount > 0 ? '<span class="convo-unread">' + it.unreadCount + '</span>' : ''}</div>
          <div class="convo-preview">\${it.lastFromMe ? 'Y0U: ' : ''}\${escapeHtml(it.lastMessage)}</div>
        </button>
      \`).join('');
      convoList.querySelectorAll('.convo-row').forEach(btn => {
        btn.addEventListener('click', () => openThread(btn.getAttribute('data-wallet')));
      });
    }
    // Deep link (?to=wallet) that isn't an existing conversation yet —
    // still worth opening so a fresh negotiation can start with an empty
    // thread, not just existing ones.
    if(activeWallet) openThread(activeWallet);
  }

  async function openThread(wallet){
    activeWallet = wallet;
    threadHead.textContent = shorten(wallet);
    threadEmpty.style.display = 'none';
    threadBody.style.display = 'flex';
    composer.style.display = 'flex';
    threadError.textContent = '';
    threadBody.innerHTML = '<div class="empty-note">L0AD!NG...</div>';
    convoList.querySelectorAll('.convo-row').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-wallet') === wallet);
    });

    const res = await fetch('/api/messages-thread?wallet=' + encodeURIComponent(wallet));
    if(!res.ok){ threadBody.innerHTML = '<div class="empty-note">ERR://C0ULD N0T L0AD THREAD</div>'; return; }
    const data = await res.json();
    const items = data.items || [];
    threadBody.innerHTML = items.length ? items.map(m => \`
      <div class="msg-bubble \${m.fromMe ? 'mine' : 'theirs'}">
        \${escapeHtml(m.body)}
        <div class="msg-time">\${fmtTime(m.createdAt)}</div>
      </div>
    \`).join('') : '<div class="empty-note">N0 MESSAGES YET — SAY HELL0.</div>';
    threadBody.scrollTop = threadBody.scrollHeight;
    loadInbox();
  }

  async function sendMessage(){
    const text = composeText.value.trim();
    if(!text || !activeWallet) return;
    sendBtn.disabled = true;
    threadError.textContent = '';
    try{
      const res = await fetch('/api/messages-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toWallet: activeWallet, body: text })
      });
      const data = await res.json();
      if(!res.ok || !data.ok){
        threadError.textContent = data.error === 'rate_limited'
          ? 'ERR://T00 MANY MESSAGES, SL0W D0WN'
          : data.error === 'message_too_long'
            ? 'ERR://MESSAGE T00 L0NG'
            : 'ERR://SEND FA!LED';
        return;
      }
      composeText.value = '';
      await openThread(activeWallet);
    } catch(e){
      threadError.textContent = 'ERR://SIGNAL_LOST';
    } finally {
      sendBtn.disabled = false;
    }
  }
  sendBtn.addEventListener('click', sendMessage);
  composeText.addEventListener('keydown', (e) => {
    if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); }
  });

  let xummAuth = null;
  function getAuth(){
    if(!xummAuth){
      xummAuth = new XummPkce(XAMAN_API_KEY, {
        implicit: true,
        rememberJwt: false,
        redirectUrl: window.location.origin + '/messages' + window.location.search
      });
      xummAuth.on('error', ()=>{
        connectStatus.textContent = 'ERR://LOGIN_ABORTED';
        connectBtn.disabled = false;
      });
      xummAuth.on('success', async ()=>{
        const state = await xummAuth.state();
        const jwt = state && state.jwt;
        if(!jwt){
          connectStatus.textContent = 'ERR://NO_WALLET_DATA';
          connectBtn.disabled = false;
          return;
        }
        try{
          const res = await fetch('/api/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jwt })
          });
          const data = await res.json();
          if(data.ok){
            connectBox.style.display = 'none';
            appEl.classList.add('show');
            loadInbox();
          } else {
            connectStatus.textContent = 'ERR://C0NNECT!0N FA!LED';
            connectBtn.disabled = false;
          }
        } catch(e){
          connectStatus.textContent = 'ERR://SIGNAL_LOST';
          connectBtn.disabled = false;
        }
      });
    }
    return xummAuth;
  }
  getAuth();
  connectBtn.addEventListener('click', ()=>{
    connectBtn.disabled = true;
    connectStatus.textContent = 'C0NNECT!NG...';
    getAuth().authorize();
  });

  // Already have a session from a prior visit (or from /board) — the
  // cookie is site-wide (Path=/), so just try the inbox straight away
  // rather than making the user reconnect.
  (async () => {
    const res = await fetch('/api/messages-inbox');
    if(res.status === 200){
      connectBox.style.display = 'none';
      appEl.classList.add('show');
      loadInbox();
    }
  })();
</script>
</body>
</html>`;
}

// Rendered the same regardless of session state — the client-side inbox
// fetch (see the script above) is what actually decides whether to show
// the connect prompt or the app, so this stays a static shell rather than
// checking the session cookie server-side just to decide the same thing
// the client immediately re-checks anyway.
export async function onRequestGet() {
  return new Response(renderPage(), { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
}
