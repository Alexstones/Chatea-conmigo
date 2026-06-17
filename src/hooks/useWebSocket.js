import { useEffect, useRef } from 'react';

// Magia pura: Si estamos en local usa localhost, si es Render usa la URL real
const IS_DEV = import.meta.env.DEV;
const WS_URL = IS_DEV 
  ? 'ws://localhost:4000/ws' 
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

export function useWebSocket({ state }) {
  const wsRef = useRef(null);
  const typingTimers = useRef({});

  const {
    myName, myNameRef,
    setConnStatus, setStage, setUsers, setMyName,
    setMsgMap, setUnreadMap, setOpenChats,
    activeChatRef, setTypingMap
  } = state;

  useEffect(() => {
    if (!myName) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnStatus('Conectado ✓');
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

        if (partner !== activeChatRef.current) {
          setUnreadMap(prev => ({ ...prev, [partner]: (prev[partner] || 0) + 1 }));
          setOpenChats(prev => prev.includes(partner) ? prev : [...prev, partner]);
        }

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

  const sendWsMessage = (msg) => {
    wsRef.current?.send(JSON.stringify(msg));
  };

  const closeWs = () => {
    wsRef.current?.close();
  };

  return { sendWsMessage, closeWs };
}