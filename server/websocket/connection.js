const { WebSocketServer } = require('ws');
const { handleMessage, sendToUser, broadcastUsers } = require('./messageHandlers');
const userService = require('../services/userService');
const chatService = require('../services/chatService');

function initSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Conectar el broadcaster del chat service con la función real de envío
  chatService.setBroadcaster(sendToUser);

  wss.on('connection', (ws) => {
    console.log('Conexión WebSocket abierta');

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        handleMessage(ws, data);
      } catch (err) {
        console.error('WS message error:', err);
      }
    });

    ws.on('close', () => {
      const name = ws.userName;
      if (name) {
        userService.removeSocket(name);
        broadcastUsers();
      }
      console.log('Conexión WebSocket cerrada:', name || '(anónimo)');
    });
  });
}

module.exports = { initSocket };
