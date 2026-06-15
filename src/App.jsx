import { useEffect, useMemo, useRef, useState } from 'react';

const WS_URL = 'ws://localhost:4000/ws';
const GRAPHQL_URL = 'http://localhost:4000/graphql';

// ─── utils ──────────────────────────────────────────────────────────────────
function formatLastSeen(ts) {
  if (!ts) return 'Desconectado';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Hace unos segundos';
  if (mins === 1) return 'Hace 1 min';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  return hrs === 1 ? 'Hace 1 hora' : `Hace ${hrs} horas`;
}

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function StatusIcon({ status }) {
  if (status === 'seen')      return <span className="msg-status seen" title="Visto">✓✓ visto</span>;
  if (status === 'delivered') return <span className="msg-status delivered" title="Entregado">✓✓</span>;
  return <span className="msg-status pending" title="Pendiente">✓</span>;
}

// ─── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [myName, setMyName]       = useState('');
  const [stage, setStage]         = useState('entry'); // 'entry' | 'chat'
  const [nameInput, setNameInput] = useState('');
  const [connStatus, setConnStatus] = useState('Conectando...');

  const [users, setUsers]         = useState([]);      // lista completa de usuarios
  const [search, setSearch]       = useState('');

  // Conversaciones abiertas como pestañas
  const [openChats, setOpenChats]   = useState([]);    // string[]
  const [activeChat, setActiveChat] = useState(null);  // string | null

  // Mensajes por usuario: { [userName]: Message[] }
  const [msgMap, setMsgMap]         = useState({});
  const [typingMap, setTypingMap]   = useState({});
  const [unreadMap, setUnreadMap]   = useState({});

  // Ref siempre actualizado para evitar closures estancados
  const msgMapRef = useRef({});

  const wsRef          = useRef(null);
  const myNameRef      = useRef(myName);
  const activeChatRef  = useRef(activeChat);
  const typingTimers   = useRef({});
  const messagesEndRef = useRef(null);

  useEffect(() => { myNameRef.current = myName; },         [myName]);
  useEffect(() => { activeChatRef.current = activeChat; },  [activeChat]);
  useEffect(() => { msgMapRef.current = msgMap; },           [msgMap]);

  // ── WebSocket ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!myName) return; // Solo conectar si hay un nombre configurado

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen  = () => {
      setConnStatus('Conectado ✓');
      // En cuanto abre, nos registramos
      ws.send(JSON.stringify({ type: 'join', name: myName }));
    };
    
    ws.onerror = () => setConnStatus('Error de conexión');
    ws.onclose = () => setConnStatus('Desconectado');

    ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data);

      if (data.type === 'joined') {
        setStage('chat');
        return;
      }

      if (data.type === 'users') {
        setUsers(data.users.filter(u => u.name !== myNameRef.current));
        return;
      }

      if (data.type === 'error') {
        alert(data.message);
        // Si hay error al unirse (ej. nombre en uso), volvemos a la entrada
        setMyName('');
        setStage('entry');
        return;
      }

      if (data.type === 'private_message') {
        const msg = data.message;
        const partner = msg.from === myNameRef.current ? msg.to : msg.from;

        setMsgMap(prev => ({
          ...prev,
          [partner]: [...(prev[partner] || []), msg]
        }));

        // Si no es la pestaña activa, incrementar unread y abrir chat
        if (partner !== activeChatRef.current) {
          setUnreadMap(prev => ({ ...prev, [partner]: (prev[partner] || 0) + 1 }));
          setOpenChats(prev => prev.includes(partner) ? prev : [...prev, partner]);
        }

        // Marcar como visto si es la pestaña activa
        if (msg.from !== myNameRef.current && partner === activeChatRef.current) {
          ws.send(JSON.stringify({ type: 'seen', to: msg.from, messageId: msg.id }));
        }
        return;
      }

      if (data.type === 'message-status') {
        const { messageId, status } = data;
        setMsgMap(prev => {
          const updated = { ...prev };
          for (const key of Object.keys(updated)) {
            updated[key] = updated[key].map(m =>
              m.id === messageId ? { ...m, status } : m
            );
          }
          return updated;
        });
        return;
      }

      if (data.type === 'typing') {
        const from = data.from;
        setTypingMap(prev => ({ ...prev, [from]: true }));
        clearTimeout(typingTimers.current[from]);
        typingTimers.current[from] = setTimeout(() => {
          setTypingMap(prev => ({ ...prev, [from]: false }));
        }, 2000);
        return;
      }
    };

    return () => {
      ws.close();
      Object.values(typingTimers.current).forEach(clearTimeout);
    };
  }, [myName]);

  // Scroll al fondo cuando llegan mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgMap, activeChat]);

  // ── Acciones ───────────────────────────────────────────────────────────────
  const enterChat = () => {
    const name = nameInput.trim();
    if (!name) return;
    myNameRef.current = name;
    setMyName(name); // Esto disparará el useEffect del WebSocket
  };

  const openChat = async (userName) => {
    setActiveChat(userName);
    setOpenChats(prev => prev.includes(userName) ? prev : [...prev, userName]);
    setUnreadMap(prev => { const n = { ...prev }; delete n[userName]; return n; });

    const current = msgMapRef.current[userName];

    if (!current) {
      // Primera vez: cargar historial desde GraphQL
      try {
        const query = `query M($user1:String!,$user2:String!){messages(user1:$user1,user2:$user2){id from to text createdAt status}}`;
        const res = await fetch(GRAPHQL_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables: { user1: myNameRef.current, user2: userName } })
        });
        const { data } = await res.json();
        const loaded = data?.messages || [];
        setMsgMap(prev => ({ ...prev, [userName]: loaded }));

        const last = [...loaded].reverse().find(m => m.from === userName);
        if (last) {
          wsRef.current?.send(JSON.stringify({ type: 'seen', to: userName, messageId: last.id }));
        }
      } catch (e) {
        // Si falla GraphQL igual mostramos el chat vacío
        setMsgMap(prev => ({ ...prev, [userName]: prev[userName] || [] }));
        console.error('Error cargando historial', e);
      }
    } else {
      // Ya tenemos mensajes — marcar el último como visto
      const last = [...current].reverse().find(m => m.from === userName);
      if (last) {
        wsRef.current?.send(JSON.stringify({ type: 'seen', to: userName, messageId: last.id }));
      }
    }
  };

  const closeChat = (userName, e) => {
    e?.stopPropagation();
    setOpenChats(prev => prev.filter(n => n !== userName));
    if (activeChat === userName) {
      const remaining = openChats.filter(n => n !== userName);
      setActiveChat(remaining[remaining.length - 1] ?? null);
    }
  };

  const [draft, setDraft] = useState('');
  const typingDebounce = useRef(null);

  const handleDraft = (val) => {
    setDraft(val);
    if (!activeChat) return;
    wsRef.current?.send(JSON.stringify({ type: 'typing', to: activeChat }));
    clearTimeout(typingDebounce.current);
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !activeChat) return;

    const optimistic = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      from: myName,
      to: activeChat,
      text,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    setMsgMap(prev => ({ ...prev, [activeChat]: [...(prev[activeChat] || []), optimistic] }));
    setDraft('');

    wsRef.current?.send(JSON.stringify({ type: 'private_message', to: activeChat, text }));

    try {
      const mutation = `mutation S($from:String!,$to:String!,$text:String!){sendMessage(from:$from,to:$to,text:$text){id from to text createdAt status}}`;
      await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: mutation, variables: { from: myName, to: activeChat, text } })
      });
    } catch (e) {
      console.error('Error enviando mensaje', e);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const logout = () => {
    wsRef.current?.close();
    setStage('entry');
    setMyName('');
    setNameInput('');
    setOpenChats([]);
    setActiveChat(null);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    const sorted = [...users].sort((a, b) => {
      if (a.online === b.online) return a.name.localeCompare(b.name);
      return a.online ? -1 : 1;
    });
    return q ? sorted.filter(u => u.name.toLowerCase().includes(q)) : sorted;
  }, [users, search]);

  const activeMsgs   = activeChat ? (msgMap[activeChat] || []) : [];
  const activeUser   = users.find(u => u.name === activeChat);
  const isTyping     = activeChat ? !!typingMap[activeChat] : false;
  const totalUnread  = Object.values(unreadMap).reduce((a, b) => a + b, 0);

  // ══════════════════════════════════════════════════════════════════════════
  // ENTRY SCREEN
  if (stage === 'entry') {
    return (
      <div className="screen">
        <div className="card">
          <div className="brand">Chatea Conmigo</div>
          <p>Ingresa tu nombre para conectarte.</p>
          <input
            id="name-input"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && enterChat()}
            placeholder="Tu nombre..."
            autoFocus
          />
          <button id="enter-btn" onClick={enterChat} style={{ marginTop: 14, width: '100%' }}>
            Entrar al chat
          </button>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 16, marginBottom: 0 }}>
            Estado: {connStatus}
          </p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CHAT SCREEN
  return (
    <div className="layout">

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
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
              onClick={logout} 
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
                onClick={() => openChat(user.name)}
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

      {/* ── MAIN PANEL ──────────────────────────────────────────────────── */}
      <main className="main-panel">

        {/* Chat tabs */}
        {openChats.length > 0 && (
          <div className="tabs-bar">
            {openChats.map(name => {
              const unread = unreadMap[name] || 0;
              const u = users.find(u => u.name === name);
              return (
                <button
                  key={name}
                  id={`tab-${name}`}
                  className={`tab ${activeChat === name ? 'tab-active' : ''}`}
                  onClick={() => openChat(name)}
                >
                  <span className={`tab-dot ${u?.online ? 'online' : 'offline'}`} />
                  {name}
                  {unread > 0 && <span className="tab-badge">{unread}</span>}
                  <span
                    className="tab-close"
                    role="button"
                    onClick={(e) => closeChat(name, e)}
                    title="Cerrar"
                  >✕</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Chat panel */}
        {activeChat ? (
          <div className="chat-panel">
            {/* Header */}
            <div className="chat-header">
              <div className="avatar">{activeChat.charAt(0).toUpperCase()}</div>
              <div>
                <strong>Conversación con {activeChat}</strong>
                <div className="last-seen">
                  {activeUser?.online
                    ? '🟢 En línea'
                    : `⚫ ${formatLastSeen(activeUser?.lastSeen)}`}
                </div>
              </div>
            </div>

            {/* Messages */}
            <section className="messages" id="messages-panel">
              {activeMsgs.length === 0
                ? <div className="empty-hint">No hay mensajes aún. ¡Saluda!</div>
                : activeMsgs.map(msg => (
                  <article
                    key={msg.id}
                    className={`bubble ${msg.from === myName ? 'mine' : 'theirs'}`}
                  >
                    <div className="bubble-meta">
                      <span className="bubble-time">{timeLabel(msg.createdAt)}</span>
                    </div>
                    <p>{msg.text}</p>
                    {msg.from === myName && <StatusIcon status={msg.status} />}
                  </article>
                ))
              }
              {isTyping && (
                <div className="typing-indicator">
                  <span /><span /><span />
                  <em>{activeChat} está escribiendo...</em>
                </div>
              )}
              <div ref={messagesEndRef} />
            </section>

            {/* Composer */}
            <footer className="composer">
              <textarea
                id="message-input"
                value={draft}
                onChange={e => handleDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe un mensaje... (Enter para enviar)"
                rows={2}
              />
              <button
                id="send-btn"
                onClick={sendMessage}
                disabled={!draft.trim()}
                className="send-btn"
              >
                Enviar ↑
              </button>
            </footer>
          </div>
        ) : (
          <div className="no-chat">
            <div className="no-chat-icon">✉</div>
            <h2>Selecciona un usuario</h2>
            <p>Elige un contacto de la barra lateral para iniciar una conversación.<br />
              Puedes tener múltiples chats abiertos al mismo tiempo.</p>
          </div>
        )}
      </main>
    </div>
  );
}