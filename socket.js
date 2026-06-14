const { WebSocketServer } = require('ws');

const users = new Map();
const waitingQueue = [];

function initSocket(server) {
  const wss = new WebSocketServer({
    server,
    path: '/ws'
  });

  function pairUsers() {
    while (waitingQueue.length >= 2) {
      const user1 = waitingQueue.shift();
      const user2 = waitingQueue.shift();

      user1.partner = user2.ws;
      user2.partner = user1.ws;

      user1.ws.send(
        JSON.stringify({
          type: 'matched',
          partner: user2.name
        })
      );

      user2.ws.send(
        JSON.stringify({
          type: 'matched',
          partner: user1.name
        })
      );

      console.log(`Emparejados: ${user1.name} <-> ${user2.name}`);
    }
  }

  wss.on('connection', (ws) => {
    console.log('Usuario conectado');

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        // Usuario entra al sistema
        if (data.type === 'join') {
          users.set(ws, {
            name: data.name,
            partner: null
          });

          waitingQueue.push({
            ws,
            name: data.name
          });

          ws.send(
            JSON.stringify({
              type: 'waiting'
            })
          );

          pairUsers();
        }

        // Mensaje privado
        if (data.type === 'message') {
          const user = users.get(ws);

          if (!user || !user.partner) return;

          user.partner.send(
            JSON.stringify({
              type: 'message',
              author: user.name,
              text: data.text,
              createdAt: new Date().toISOString()
            })
          );
        }

        // Indicador escribiendo...
        if (data.type === 'typing') {
          const user = users.get(ws);

          if (!user || !user.partner) return;

          user.partner.send(
            JSON.stringify({
              type: 'typing',
              author: user.name
            })
          );
        }
      } catch (err) {
        console.error(err);
      }
    });

    ws.on('close', () => {
      const user = users.get(ws);

      if (user?.partner) {
        try {
          user.partner.send(
            JSON.stringify({
              type: 'partner-disconnected'
            })
          );
        } catch (e) {}
      }

      const index = waitingQueue.findIndex(
        (u) => u.ws === ws
      );

      if (index !== -1) {
        waitingQueue.splice(index, 1);
      }

      users.delete(ws);

      console.log('Usuario desconectado');
    });
  });
}

module.exports = { initSocket };