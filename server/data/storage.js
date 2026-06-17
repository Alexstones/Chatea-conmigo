const fs = require('fs');
const path = require('path');

const messagesFile = path.join(__dirname, 'messages.json');
const usersFile = path.join(__dirname, 'users.json');

function ensureJsonFile(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
}

function readJson(filePath) {
  ensureJsonFile(filePath, []);
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error parseando JSON en ${filePath}:`, err);
    return [];
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getMessages() {
  return readJson(messagesFile);
}

function saveMessages(messages) {
  writeJson(messagesFile, messages);
}

function getMessageById(messageId) {
  const messages = getMessages();
  return messages.find((message) => String(message.id) === String(messageId));
}

function updateMessageStatus(messageId, status) {
  const messages = getMessages();
  const message = messages.find((msg) => String(msg.id) === String(messageId));
  if (!message) return null;
  message.status = status;
  writeJson(messagesFile, messages);
  return message;
}

function getPendingMessagesForUser(userName) {
  return getMessages().filter(
    (message) =>
      message.to === userName &&
      (message.status === 'pending' || message.status === 'sent')
  );
}

function getUsers() {
  return readJson(usersFile);
}

function saveUsers(users) {
  writeJson(usersFile, users);
}

module.exports = {
  getMessages,
  saveMessages,
  getMessageById,
  updateMessageStatus,
  getPendingMessagesForUser,
  getUsers,
  saveUsers
};
