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
let messageBroadcaster = null;
const waitingQueue = [];
let persistedUsers = loadPersistedUsers();

function getUser(name) {
  return users.get(name);
}

function formatUser(user) {
  return {
    name: user.name,
    online: !!user.online,
    lastSeen: user.lastSeen || null
  };
}

function getAllKnownUsers() {
  const all = new Map();
  persistedUsers.forEach((user) => {
    all.set(user.name, { ...user });
  });

  users.forEach((user, name) => {
    all.set(name, { ...all.get(name), name, online: true, lastSeen: null });
  });

  return Array.from(all.values()).map(formatUser);
}

function persistUser(name, online, lastSeen = null) {
  const existing = persistedUsers.find((user) => user.name === name);
  if (existing) {
    existing.online = online;
    existing.lastSeen = lastSeen;
  } else {
    persistedUsers.push({ name, online, lastSeen });
  }
  saveUsers(persistedUsers);
}

function deliverPendingMessages(name) {
  const pending = getPendingMessagesForUser(name);
  if (!pending.length) return;

  pending.forEach((message) => {
    const updated = updateMessageStatus(message.id, 'delivered');
    if (!updated) return;

    sendToUser(name, { type: 'private_message', message: updated });
    sendToUser(updated.from, {
      type: 'message-status',
      messageId: updated.id,
      status: 'delivered'
    });
  });
}

function broadcastUsers() {
  const payload = getAllKnownUsers().map(formatUser);
  const data = JSON.stringify({ type: 'users', users: payload });

  for (const user of users.values()) {
    if (user.online) {
      user.ws.send(data);
    }
  }
}

function setMessageBroadcaster(fn) {
  messageBroadcaster = fn;
}

function broadcastMessage(message) {
  if (typeof messageBroadcaster === 'function') {
    messageBroadcaster(message);
  }
}

function sendToUser(name, data) {
  const user = getUser(name);
  if (!user || !user.online) return false;

  try {
    user.ws.send(JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('Error enviando WS a', name, err);
    return false;
  }
}

function initSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('Usuario conectado');

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        if (data.type === 'join') {
          const name = String(data.name || '').trim();
          if (!name) {
            ws.send(JSON.stringify({ type: 'error', message: 'El nombre es obligatorio.' }));
            return;
          }

          const oldName = ws.userName;
          if (oldName && oldName !== name) {
            users.delete(oldName);
            const oldQueueIndex = waitingQueue.indexOf(oldName);
            if (oldQueueIndex !== -1) waitingQueue.splice(oldQueueIndex, 1);
          }

          const existing = users.get(name);
          if (existing?.online && existing.ws !== ws) {
            ws.send(JSON.stringify({ type: 'error', message: 'Ese nombre ya está en uso.' }));
            return;
          }

          // register user
          users.set(name, {
            name,
            ws,
            online: true,
            lastSeen: null,
            partner: null
          });

          ws.userName = name;
          persistUser(name, true, null);

          // if someone is waiting, pair them
          if (waitingQueue.length > 0) {
            const otherName = waitingQueue.shift();
            const other = users.get(otherName);

            if (other && other.online) {
              users.get(name).partner = otherName;
              other.partner = name;

              // notify both
              ws.send(JSON.stringify({ type: 'matched', partner: otherName }));
              other.ws.send(JSON.stringify({ type: 'matched', partner: name }));
              console.log(`Emparejados: ${name} <-> ${otherName}`);
            } else {
              // other went offline, push this user to waiting
              waitingQueue.push(name);
              ws.send(JSON.stringify({ type: 'waiting' }));
            }
          } else {
            // no one waiting, add to queue
            waitingQueue.push(name);
            ws.send(JSON.stringify({ type: 'waiting' }));
          }

          broadcastUsers();
          deliverPendingMessages(name);
          return;
        }

        if (!ws.userName) return;

        // message sent to partner (pairing mode) - compatible with previous client
        if (data.type === 'message' || data.type === 'private_message') {
          const from = ws.userName;
          const user = users.get(from);
          const partnerName = user?.partner || String(data.to || '').trim();
          const text = String(data.text || '').trim();
          if (!partnerName || !text) return;

          const partner = users.get(partnerName);
          const isOnline = partner?.online && !!partner.ws;
          const status = isOnline ? 'delivered' : 'pending';

          const message = {
            id: Date.now().toString(),
            from,
            to: partnerName,
            text,
            createdAt: new Date().toISOString(),
            status
          };

          const messages = getMessages();
          messages.push(message);
          saveMessages(messages);

          // Send to recipient only
          if (isOnline) {
            const payload = { type: 'private_message', message };
            sendToUser(partnerName, payload);
            ws.send(JSON.stringify({ type: 'message-status', messageId: message.id, status: 'delivered' }));
          } else {
            ws.send(JSON.stringify({ type: 'message-status', messageId: message.id, status: 'pending' }));
          }
          return;
        }

        // typing indicator to partner
        if (data.type === 'typing') {
          const from = ws.userName;
          const user = users.get(from);
          const partnerName = user?.partner;
          if (!partnerName) return;

          sendToUser(partnerName, { type: 'typing', from });
          return;
        }

        // seen notification to partner
        if (data.type === 'seen') {
          const from = ws.userName;
          const user = users.get(from);
          const partnerName = user?.partner;
          const messageId = String(data.messageId || '').trim();
          if (!partnerName || !messageId) return;

          sendToUser(partnerName, { type: 'seen', from, messageId });
          return;
        }
      } catch (err) {
        console.error(err);
      }
    });

    ws.on('close', () => {
      const name = ws.userName;
      if (name) {
        const existing = users.get(name);
        if (existing) {
          const partnerName = existing.partner;
          if (partnerName) {
            const partner = users.get(partnerName);
            if (partner && partner.online && partner.ws) {
              try {
                partner.ws.send(JSON.stringify({ type: 'partner-disconnected' }));
              } catch (e) {}

              partner.partner = null;
              waitingQueue.push(partnerName);
            }
          }

          users.set(name, {
            ...existing,
            online: false,
            ws: null,
            lastSeen: new Date().toISOString(),
            partner: null
          });
          persistUser(name, false, new Date().toISOString());
        }

        const idx = waitingQueue.indexOf(name);
        if (idx !== -1) waitingQueue.splice(idx, 1);

        broadcastUsers();
      }

      console.log('Usuario desconectado');
    });
  });
}

module.exports = {
  initSocket,
  setMessageBroadcaster,
  sendToUser,
  getUser,
  broadcastUsers,
  broadcastMessage
};