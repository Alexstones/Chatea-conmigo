const userService = require('../services/userService');
const chatService = require('../services/chatService');

function sendToUser(name, data) {
  const user = userService.getSocketInfo(name);
  if (!user || !user.online || !user.ws) return false;
  try {
    user.ws.send(JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('WS send error ->', name, err.message);
    return false;
  }
}

function broadcastUsers() {
  const payload = JSON.stringify({ type: 'users', users: userService.getAllKnownUsers() });
  const allSockets = userService.activeSockets;
  for (const u of allSockets.values()) {
    if (u.online && u.ws) {
      try { u.ws.send(payload); } catch (_) {}
    }
  }
}

function handleMessage(ws, data) {
  // ── JOIN ──────────────────────────────────────────────────────────
  if (data.type === 'join') {
    const name = String(data.name || '').trim();
    if (!name) {
      ws.send(JSON.stringify({ type: 'error', message: 'El nombre es obligatorio.' }));
      return;
    }

    const existing = userService.getSocketInfo(name);
    if (existing?.online && existing.ws !== ws) {
      ws.send(JSON.stringify({ type: 'error', message: 'Ese nombre ya está en uso.' }));
      return;
    }

    if (ws.userName && ws.userName !== name) {
      userService.deleteSocketName(ws.userName);
    }

    userService.registerSocket(name, ws);
    ws.userName = name;

    ws.send(JSON.stringify({ type: 'joined', name }));
    broadcastUsers();
    chatService.deliverPendingMessages(name);
    return;
  }

  if (!ws.userName) return;

  // ── PRIVATE MESSAGE ───────────────────────────────────────────────
  if (data.type === 'message' || data.type === 'private_message') {
    const from = ws.userName;
    const to = String(data.to || '').trim();
    const text = String(data.text || '').trim();
    if (!to || !text) return;

    const message = chatService.sendPrivateMessage(from, to, text);
    
    // Si se guardó como delivered, el chatService ya lo envió al destinatario
    // Solo notificamos al que envió el estado
    ws.send(JSON.stringify({ type: 'message-status', messageId: message.id, status: message.status }));
    return;
  }

  // ── TYPING ────────────────────────────────────────────────────────
  if (data.type === 'typing') {
    const to = String(data.to || '').trim();
    if (!to) return;
    sendToUser(to, { type: 'typing', from: ws.userName });
    return;
  }

  // ── SEEN ──────────────────────────────────────────────────────────
  if (data.type === 'seen') {
    const to = String(data.to || '').trim();
    const messageId = String(data.messageId || '').trim();
    if (!to || !messageId) return;

    chatService.markAsSeen(messageId, to);
    return;
  }
}

module.exports = {
  handleMessage,
  sendToUser,
  broadcastUsers
};
