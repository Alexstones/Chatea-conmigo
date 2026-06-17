const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'messages.json');

function getMessages() {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '[]');
  }
  return JSON.parse(fs.readFileSync(file));
}

function saveMessages(messages) {
  fs.writeFileSync(file, JSON.stringify(messages, null, 2));
}

const resolvers = {
  Query: {
    messages() {
      return getMessages();
    }
  },

  Mutation: {
    sendMessage(_, { author, text }) {
      const messages = getMessages();

      const message = {
        id: Date.now().toString(),
        author,
        text,
        createdAt: new Date().toISOString()
      };

      messages.push(message);
      saveMessages(messages);

      global.broadcastMessage(message);

      return message;
    }
  }
};

module.exports = { resolvers };