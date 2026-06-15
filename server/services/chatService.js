const messageRepository = require('../data/messageRepository');
const userService = require('./userService');

class ChatService {
  constructor() {
    this.messageBroadcaster = null; // Para inyectar el método de enviar por WS
  }

  setBroadcaster(fn) {
    this.messageBroadcaster = fn; // fn(name, data) -> boolean
  }

  sendPrivateMessage(from, to, text) {
    const recipient = userService.getSocketInfo(to);
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

    messageRepository.save(message);

    if (isOnline && this.messageBroadcaster) {
      this.messageBroadcaster(to, { type: 'private_message', message });
    }

    return message;
  }

  deliverPendingMessages(userName) {
    if (!this.messageBroadcaster) return;

    const pending = messageRepository.findPendingForUser(userName);
    pending.forEach((msg) => {
      const updated = messageRepository.updateStatus(msg.id, 'delivered');
      if (!updated) return;
      
      this.messageBroadcaster(userName, { type: 'private_message', message: updated });
      this.messageBroadcaster(updated.from, { type: 'message-status', messageId: updated.id, status: 'delivered' });
    });
  }

  markAsSeen(messageId, to) {
    const updated = messageRepository.updateStatus(messageId, 'seen');
    if (updated && this.messageBroadcaster) {
      this.messageBroadcaster(to, { type: 'message-status', messageId, status: 'seen' });
    }
    return updated;
  }
}

module.exports = new ChatService();
