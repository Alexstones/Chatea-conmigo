import { useState, useRef, useEffect } from 'react';
import { formatLastSeen, timeLabel } from '../services/formatters';

function StatusIcon({ status }) {
  if (status === 'seen')      return <span className="msg-status seen" title="Visto">✓✓ visto</span>;
  if (status === 'delivered') return <span className="msg-status delivered" title="Entregado">✓✓</span>;
  return <span className="msg-status pending" title="Pendiente">✓</span>;
}

export default function ChatArea({
  myName,
  activeChat,
  activeUser,
  activeMsgs,
  isTyping,
  onSendMessage,
  onTyping
}) {
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef(null);
  const typingDebounce = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMsgs, activeChat]);

  const handleDraft = (val) => {
    setDraft(val);
    if (!activeChat) return;
    onTyping();
    clearTimeout(typingDebounce.current);
  };

  const handleSendMessage = () => {
    if (!draft.trim()) return;
    onSendMessage(draft.trim());
    setDraft('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!activeChat) {
    return (
      <div className="no-chat">
        <div className="no-chat-icon">✉</div>
        <h2>Selecciona un usuario</h2>
        <p>Elige un contacto de la barra lateral para iniciar una conversación.<br />
          Puedes tener múltiples chats abiertos al mismo tiempo.</p>
      </div>
    );
  }

  return (
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
          onClick={handleSendMessage}
          disabled={!draft.trim()}
          className="send-btn"
        >
          Enviar ↑
        </button>
      </footer>
    </div>
  );
}
