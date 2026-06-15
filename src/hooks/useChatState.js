import { useState, useRef, useEffect } from 'react';

export function useChatState() {
  const [myName, setMyName] = useState('');
  const [stage, setStage] = useState('entry'); // 'entry' | 'chat'
  const [connStatus, setConnStatus] = useState('Desconectado');

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');

  const [openChats, setOpenChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);

  const [msgMap, setMsgMap] = useState({});
  const [typingMap, setTypingMap] = useState({});
  const [unreadMap, setUnreadMap] = useState({});

  const myNameRef = useRef(myName);
  const activeChatRef = useRef(activeChat);
  const msgMapRef = useRef({});

  useEffect(() => { myNameRef.current = myName; }, [myName]);
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);
  useEffect(() => { msgMapRef.current = msgMap; }, [msgMap]);

  const enterChat = (name) => {
    myNameRef.current = name;
    setMyName(name);
  };

  const logout = () => {
    setStage('entry');
    setMyName('');
    setOpenChats([]);
    setActiveChat(null);
  };

  const closeChat = (userName, e) => {
    e?.stopPropagation();
    setOpenChats(prev => prev.filter(n => n !== userName));
    if (activeChat === userName) {
      const remaining = openChats.filter(n => n !== userName);
      setActiveChat(remaining[remaining.length - 1] ?? null);
    }
  };

  return {
    myName, setMyName, myNameRef,
    stage, setStage,
    connStatus, setConnStatus,
    users, setUsers,
    search, setSearch,
    openChats, setOpenChats,
    activeChat, setActiveChat,
    msgMap, setMsgMap, msgMapRef,
    typingMap, setTypingMap,
    unreadMap, setUnreadMap,
    enterChat, logout, closeChat,
    activeChatRef
  };
}
