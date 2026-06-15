export default function TabBar({ openChats, activeChat, unreadMap, users, onOpenChat, onCloseChat }) {
  if (openChats.length === 0) return null;

  return (
    <div className="tabs-bar">
      {openChats.map(name => {
        const unread = unreadMap[name] || 0;
        const u = users.find(user => user.name === name);
        return (
          <button
            key={name}
            id={`tab-${name}`}
            className={`tab ${activeChat === name ? 'tab-active' : ''}`}
            onClick={() => onOpenChat(name)}
          >
            <span className={`tab-dot ${u?.online ? 'online' : 'offline'}`} />
            {name}
            {unread > 0 && <span className="tab-badge">{unread}</span>}
            <span
              className="tab-close"
              role="button"
              onClick={(e) => onCloseChat(name, e)}
              title="Cerrar"
            >✕</span>
          </button>
        );
      })}
    </div>
  );
}
