import { useEffect, useMemo, useRef, useState } from 'react';

const WS_URL = 'ws://localhost:4000/ws';
const GRAPHQL_URL = 'http://localhost:4000/graphql';

function formatLastSeen(timestamp) {
  if (!timestamp) return 'Desconectado';
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Hace unos segundos';
  if (minutes === 1) return 'Hace 1 min';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? 'Hace 1 hora' : `Hace ${hours} horas`;
}

function App() {
  const [name, setName] = useState('');
  const [stage, setStage] = useState('entry');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [typingFrom, setTypingFrom] = useState('');
  const [search, setSearch] = useState('');
  const [statusMessage, setStatusMessage] = useState('Conectando...');
  const [unreadCounts, setUnreadCounts] = useState({});

  const socketRef = useRef(null);
  const typingTimeout = useRef(null);
  const messagesEnd = useRef(null);
  const nameRef = useRef(name);
  const selectedUserRef = useRef(selectedUser);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setStatusMessage('Conectado al servidor');
    };

    ws.onerror = () => {
      setStatusMessage('Error en la conexión WebSocket');
    };

    ws.onclose = () => {
      setStatusMessage('Conexión cerrada');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'users') {
        const filtered = data.users.filter((user) => user.name !== nameRef.current);
        setUsers(filtered);
        return;
      }

      if (data.type === 'joined') {
        setStatusMessage(`Bienvenido, ${data.name}`);
        setStage('chat');
        return;
      }

      if (data.type === 'error') {
        alert(data.message);
        return;
      }

      if (data.type === 'private_message') {
        const incoming = data.message;
        if (incoming.from === selectedUserRef.current || incoming.to === nameRef.current) {
          setMessages((prev) => [...prev, incoming]);
        }

        if (incoming.from !== selectedUserRef.current) {
          setUnreadCounts((prev) => ({
            ...prev,
            [incoming.from]: (prev[incoming.from] || 0) + 1
          }));
        }

        return;
      }

      if (data.type === 'typing') {
        if (data.from === selectedUserRef.current) {
          setTypingFrom(data.from);
          clearTimeout(typingTimeout.current);
          typingTimeout.current = setTimeout(() => {
            setTypingFrom('');
          }, 1400);
        }
        return;
      }

      if (data.type === 'seen') {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.messageId
              ? { ...msg, status: 'seen' }
              : msg
          )
        );
        return;
      }
    };

    socketRef.current = ws;
    return () => {
      ws.close();
      clearTimeout(typingTimeout.current);
    };
  }, []);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) =>
      user.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search]);

  const enterChat = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setName(trimmed);
    socketRef.current?.send(
      JSON.stringify({ type: 'join', name: trimmed })
    );
  };

  const loadMessages = async (otherUser) => {
    if (!otherUser) return;

    setSelectedUser(otherUser);
    setUnreadCounts((prev) => {
      const updated = { ...prev };
      delete updated[otherUser];
      return updated;
    });

    try {
      const query = `query Messages($user1: String!, $user2: String!) { messages(user1: $user1, user2: $user2) { id from to text createdAt status } }`;
      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { user1: name, user2: otherUser }
        })
      });
      const result = await response.json();
      const loadedMessages = result.data?.messages || [];
      setMessages(loadedMessages);
      const latestIncoming = [...loadedMessages]
        .reverse()
        .find((message) => message.from === otherUser);

      if (latestIncoming) {
        socketRef.current?.send(
          JSON.stringify({
            type: 'seen',
            to: otherUser,
            messageId: latestIncoming.id
          })
        );
      }
    } catch (error) {
      console.error('Error cargando historial', error);
    }
  };

  const sendMessage = async () => {
    if (!draft.trim() || !selectedUser) return;

    const newMessage = {
      id: Date.now().toString(),
      from: name,
      to: selectedUser,
      text: draft.trim(),
      createdAt: new Date().toISOString(),
      status: 'sent'
    };

    setMessages((prev) => [...prev, newMessage]);
    setDraft('');

    socketRef.current?.send(
      JSON.stringify({
        type: 'private_message',
        to: selectedUser,
        text: newMessage.text
      })
    );

    try {
      const mutation = `mutation SendMessage($from: String!, $to: String!, $text: String!) { sendMessage(from: $from, to: $to, text: $text) { id from to text createdAt status } }`;
      await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: mutation,
          variables: {
            from: name,
            to: selectedUser,
            text: newMessage.text
          }
        })
      });
    } catch (error) {
      console.error('Error enviando mensaje', error);
    }
  };

  const handleTyping = (value) => {
    setDraft(value);
    if (!selectedUser) return;
    socketRef.current?.send(
      JSON.stringify({ type: 'typing', to: selectedUser })
    );
  };

  const connectionInfo = users.some((user) => user.online)
    ? 'Esperando que elijas un usuario conectado'
    : 'Ningún usuario conectado todavía';

  if (stage === 'entry') {
    return (
      <div className="screen">
        <div className="card">
          <div className="brand">Chat Privado</div>
          <p>Ingresa tu nombre para conectarte al chat privado.</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
          />
          <button onClick={enterChat}>Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen chat-screen">
      <aside className="sidebar">
        <div className="brand">Chat Privado</div>
        <p className="status">{statusMessage}</p>
        <div className="sidebar-profile">
          <div className="user-avatar">{name.charAt(0).toUpperCase()}</div>
          <div>
            <strong>{name}</strong>
            <div className="status-text">🟢 En línea</div>
          </div>
        </div>

        <input
          className="user-search"
          placeholder="Buscar usuarios"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="user-list">
          {filteredUsers.length === 0 && (
            <div className="empty-state">{connectionInfo}</div>
          )}

          {filteredUsers.map((user) => (
            <button
              key={user.name}
              className={`user-card ${user.name === selectedUser ? 'active' : ''}`}
              onClick={() => loadMessages(user.name)}
            >
              <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
              <div className="user-meta">
                <strong>{user.name}</strong>
                <span>
                  {user.online
                    ? '🟢 En línea'
                    : `⚫ ${formatLastSeen(user.lastSeen)}`}
                </span>
              </div>
              {unreadCounts[user.name] > 0 && (
                <span className="unread-count">
                  {unreadCounts[user.name]}
                </span>
              )}
            </button>
          ))}
        </div>
      </aside>

      <main className="chat-panel">
        <div className="chat-header">
          <div>
            <div className="brand">{selectedUser ? `Conversación con ${selectedUser}` : 'Selecciona un usuario'}</div>
            <p>{selectedUser ? 'Historial privado 1 a 1' : 'Elige un contacto para abrir la conversación'}</p>
          </div>
        </div>

        <section className="messages">
          {selectedUser ? (
            messages.length > 0 ? (
              messages.map((message) => (
                <article
                  key={message.id}
                  className={`bubble ${message.from === name ? 'mine' : ''}`}
                >
                  <div className="bubble-top">
                    <span>{message.from}</span>
                    <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <p>{message.text}</p>
                  {message.from === name && (
                    <div className="message-meta">
                      {message.status === 'seen' ? '✓✓ visto' : '✓'}
                    </div>
                  )}
                </article>
              ))
            ) : (
              <div className="empty-state">No hay mensajes en esta conversación aún.</div>
            )
          ) : (
            <div className="empty-state">Selecciona un usuario para iniciar un chat privado.</div>
          )}
          <div ref={messagesEnd} />
        </section>

        <footer className="composer">
          <textarea
            value={draft}
            onChange={(e) => handleTyping(e.target.value)}
            placeholder={selectedUser ? 'Escribe un mensaje...' : 'Selecciona un usuario primero'}
            disabled={!selectedUser}
          />
          <button onClick={sendMessage} disabled={!selectedUser || !draft.trim()}>
            Enviar
          </button>
        </footer>

        {typingFrom && selectedUser && (
          <div className="typing-banner">{typingFrom} está escribiendo...</div>
        )}
      </main>
    </div>
  );
}

export default App;