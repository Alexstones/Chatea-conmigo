// server/socket.js — sin pairing forzado, mensajes directos por usuario
const { WebSocketServer } = require('ws');
const {
  getMessages,
  saveMessages,
  getPendingMessagesForUser,
  updateMessageStatus,
  getUsers: loadPersistedUsers,
  saveUsers
} = require('./data/storage');

const users = new Map();
let persistedUsers = loadPersistedUsers();

// ─── helpers ────────────────────────────────────────────────────────────────

function formatUser(user) {
  return {
    name: user.name,
    online: !!user.online,
    lastSeen: user.lastSeen || null
  };
}

function getAllKnownUsers() {
  const all = new Map();
  persistedUsers.forEach((u) => all.set(u.name, { ...u }));
  users.forEach((u, name) =>
    all.set(name, { ...all.get(name), name, online: true, lastSeen: null })
  );
  return Array.from(all.values()).map(formatUser);
}

function persistUser(name, online, lastSeen = null) {
  const existing = persistedUsers.find((u) => u.name === name);
  if (existing) {
    existing.online = online;
    existing.lastSeen = lastSeen;
  } else {
    persistedUsers.push({ name, online, lastSeen });
  }
  saveUsers(persistedUsers);
}

function broadcastUsers() {
  const payload = JSON.stringify({ type: 'users', users: getAllKnownUsers() });
  for (const u of users.values()) {
    if (u.online && u.ws) {
      try { u.ws.send(payload); } catch (_) {}
    }
  }
}

function sendToUser(name, data) {
  const user = users.get(name);
  if (!user || !user.online || !user.ws) return false;
  try {
    user.ws.send(JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('WS send error ->', name, err.message);
    return false;
  }
}

function deliverPendingMessages(name) {
  const pending = getPendingMessagesForUser(name);
  pending.forEach((msg) => {
    const updated = updateMessageStatus(msg.id, 'delivered');
    if (!updated) return;
    sendToUser(name, { type: 'private_message', message: updated });
    sendToUser(updated.from, { type: 'message-status', messageId: updated.id, status: 'delivered' });
  });
}

// ─── socket server ───────────────────────────────────────────────────────────

function initSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('Conexión WebSocket abierta');

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        // ── JOIN ──────────────────────────────────────────────────────────
        if (data.type === 'join') {
          const name = String(data.name || '').trim();
          if (!name) {
            ws.send(JSON.stringify({ type: 'error', message: 'El nombre es obligatorio.' }));
            return;
          }

          // Si ya hay una sesión activa con ese nombre, la rechazamos
          const existing = users.get(name);
          if (existing?.online && existing.ws !== ws) {
            ws.send(JSON.stringify({ type: 'error', message: 'Ese nombre ya está en uso.' }));
            return;
          }

          // Si el mismo WS ya tenía otro nombre, lo limpiamos
          if (ws.userName && ws.userName !== name) {
            users.delete(ws.userName);
          }

          users.set(name, { name, ws, online: true, lastSeen: null });
          ws.userName = name;
          persistUser(name, true, null);

          // Confirmación al cliente que entró
          ws.send(JSON.stringify({ type: 'joined', name }));

          broadcastUsers();
          deliverPendingMessages(name);
          return;
        }

        if (!ws.userName) return;

        // ── PRIVATE MESSAGE ───────────────────────────────────────────────
        if (data.type === 'message' || data.type === 'private_message') {
          const from = ws.userName;
          const to = String(data.to || '').trim();
          const text = String(data.text || '').trim();
          if (!to || !text) return;

          const recipient = users.get(to);
          const isOnline = recipient?.online && !!recipient.ws;
          const status = isOnline ? 'delivered' : 'pending';

          const message = {
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            from,
            to,
            text,
            createdAt: new Date().toISOString(),
            status
          };

          const messages = getMessages();
          messages.push(message);
          saveMessages(messages);

          if (isOnline) {
            sendToUser(to, { type: 'private_message', message });
            ws.send(JSON.stringify({ type: 'message-status', messageId: message.id, status: 'delivered' }));
          } else {
            ws.send(JSON.stringify({ type: 'message-status', messageId: message.id, status: 'pending' }));
          }
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

          const updated = updateMessageStatus(messageId, 'seen');
          if (updated) {
            sendToUser(to, { type: 'message-status', messageId, status: 'seen' });
          }
          return;
        }

      } catch (err) {
        console.error('WS message error:', err);
      }
    });

    ws.on('close', () => {
      const name = ws.userName;
      if (name) {
        const existing = users.get(name);
        if (existing) {
          users.set(name, { ...existing, online: false, ws: null, lastSeen: new Date().toISOString() });
          persistUser(name, false, new Date().toISOString());
        }
        broadcastUsers();
      }
      console.log('Conexión WebSocket cerrada:', name || '(anónimo)');
    });
  });
}

module.exports = { initSocket, sendToUser, broadcastUsers };