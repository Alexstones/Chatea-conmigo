const userRepository = require('../data/userRepository');

class UserService {
  constructor() {
    this.activeSockets = new Map(); // name -> { ws, online, lastSeen }
  }

  formatUser(user) {
    return {
      name: user.name,
      online: !!user.online,
      lastSeen: user.lastSeen || null
    };
  }

  getAllKnownUsers() {
    const all = new Map();
    // Leer los guardados
    userRepository.readAll().forEach((u) => all.set(u.name, { ...u }));
    // Mezclar con los activos en memoria
    this.activeSockets.forEach((u, name) => {
      all.set(name, { ...all.get(name), name, online: true, lastSeen: null });
    });
    return Array.from(all.values()).map(this.formatUser);
  }

  persistUser(name, online, lastSeen = null) {
    const users = userRepository.readAll();
    const existing = users.find((u) => u.name === name);
    if (existing) {
      existing.online = online;
      existing.lastSeen = lastSeen;
    } else {
      users.push({ name, online, lastSeen });
    }
    userRepository.saveAll(users);
  }

  registerSocket(name, ws) {
    this.activeSockets.set(name, { name, ws, online: true, lastSeen: null });
    this.persistUser(name, true, null);
  }

  removeSocket(name) {
    const existing = this.activeSockets.get(name);
    if (existing) {
      const now = new Date().toISOString();
      this.activeSockets.set(name, { ...existing, online: false, ws: null, lastSeen: now });
      this.persistUser(name, false, now);
    }
  }

  getSocketInfo(name) {
    return this.activeSockets.get(name);
  }

  deleteSocketName(name) {
    this.activeSockets.delete(name);
  }
}

module.exports = new UserService();
