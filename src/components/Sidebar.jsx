import { useMemo } from 'react';
import { formatLastSeen } from '../services/formatters';

export default function Sidebar({
  myName,
  connStatus,
  users,
  search,
  setSearch,
  activeChat,
  openChats,
  unreadMap,
  onOpenChat,
  onLogout
}) {
  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    const sorted = [...users].sort((a, b) => {
      if (a.online === b.online) return a.name.localeCompare(b.name);
      return a.online ? -1 : 1;
    });
    return q ? sorted.filter(u => u.name.toLowerCase().includes(q)) : sorted;
  }, [users, search]);

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="brand">Chatea Conmigo</div>
        <div className="sidebar-profile">
          <div className="avatar">{myName.charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <strong>{myName}</strong>
            <div className="online-dot">🟢 En línea</div>
          </div>
          <button 
            onClick={onLogout} 
            style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '8px', background: 'rgba(248,113,113,0.15)', color: '#f87171' }}
            title="Cambiar de usuario"
          >
            Salir
          </button>
        </div>
        <input
          className="search-input"
          placeholder="🔍 Buscar usuarios..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="user-list">
        {filteredUsers.length === 0 && (
          <div className="empty-hint">Sin usuarios todavía</div>
        )}
        {filteredUsers.map(user => {
          const unread = unreadMap[user.name] || 0;
          const isActive = activeChat === user.name;
          const isOpen = openChats.includes(user.name);
          return (
            <button
              key={user.name}
              id={`user-${user.name}`}
              className={`user-row ${isActive ? 'active' : ''} ${isOpen && !isActive ? 'open' : ''}`}
              onClick={() => onOpenChat(user.name)}
            >
              <div className="avatar sm">
                {user.name.charAt(0).toUpperCase()}
                <span className={`status-dot ${user.online ? 'online' : 'offline'}`} />
              </div>
              <div className="user-info">
                <strong>{user.name}</strong>
                <span className="last-seen">
                  {user.online ? '🟢 En línea' : `⚫ ${formatLastSeen(user.lastSeen)}`}
                </span>
              </div>
              {unread > 0 && <span className="badge">{unread}</span>}
            </button>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <span>{connStatus}</span>
      </div>
    </aside>
  );
}
