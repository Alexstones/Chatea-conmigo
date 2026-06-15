import { useChatState } from './hooks/useChatState';
import { useWebSocket } from './hooks/useWebSocket';
import { fetchGraphQL } from './services/api';

import EntryScreen from './components/EntryScreen';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import ChatArea from './components/ChatArea';

export default function App() {
  const chatState = useChatState();
  const { sendWsMessage } = useWebSocket({ state: chatState });

  const {
    myName, myNameRef,
    stage,
    connStatus,
    users, search, setSearch,
    openChats, activeChat, setOpenChats, setActiveChat,
    msgMap, setMsgMap, msgMapRef,
    typingMap, unreadMap, setUnreadMap,
    enterChat, logout, closeChat
  } = chatState;

  const openChatHandler = async (userName) => {
    setActiveChat(userName);
    setOpenChats(prev => prev.includes(userName) ? prev : [...prev, userName]);
    setUnreadMap(prev => { const n = { ...prev }; delete n[userName]; return n; });

    const current = msgMapRef.current[userName];

    if (!current) {
      try {
        const query = `query M($user1:String!,$user2:String!){messages(user1:$user1,user2:$user2){id from to text createdAt status}}`;
        const { data } = await fetchGraphQL(query, { user1: myNameRef.current, user2: userName });
        const loaded = data?.messages || [];
        setMsgMap(prev => ({ ...prev, [userName]: loaded }));

        const last = [...loaded].reverse().find(m => m.from === userName);
        if (last) {
          sendWsMessage({ type: 'seen', to: userName, messageId: last.id });
        }
      } catch (e) {
        setMsgMap(prev => ({ ...prev, [userName]: prev[userName] || [] }));
        console.error('Error cargando historial', e);
      }
    } else {
      const last = [...current].reverse().find(m => m.from === userName);
      if (last) {
        sendWsMessage({ type: 'seen', to: userName, messageId: last.id });
      }
    }
  };

  const handleSendMessage = async (text) => {
    if (!activeChat) return;

    const optimistic = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      from: myName,
      to: activeChat,
      text,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    setMsgMap(prev => ({ ...prev, [activeChat]: [...(prev[activeChat] || []), optimistic] }));
    sendWsMessage({ type: 'private_message', to: activeChat, text });

    try {
      const mutation = `mutation S($from:String!,$to:String!,$text:String!){sendMessage(from:$from,to:$to,text:$text){id from to text createdAt status}}`;
      await fetchGraphQL(mutation, { from: myName, to: activeChat, text });
    } catch (e) {
      console.error('Error enviando mensaje', e);
    }
  };

  const handleTyping = () => {
    sendWsMessage({ type: 'typing', to: activeChat });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ENTRY SCREEN
  if (stage === 'entry') {
    return <EntryScreen onEnter={enterChat} connStatus={connStatus} />;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CHAT SCREEN
  const activeMsgs = activeChat ? (msgMap[activeChat] || []) : [];
  const activeUser = users.find(u => u.name === activeChat);
  const isTyping = activeChat ? !!typingMap[activeChat] : false;

  return (
    <div className="layout">
      <Sidebar
        myName={myName}
        connStatus={connStatus}
        users={users}
        search={search}
        setSearch={setSearch}
        activeChat={activeChat}
        openChats={openChats}
        unreadMap={unreadMap}
        onOpenChat={openChatHandler}
        onLogout={logout}
      />
      <main className="main-panel">
        <TabBar
          openChats={openChats}
          activeChat={activeChat}
          unreadMap={unreadMap}
          users={users}
          onOpenChat={openChatHandler}
          onCloseChat={closeChat}
        />
        <ChatArea
          myName={myName}
          activeChat={activeChat}
          activeUser={activeUser}
          activeMsgs={activeMsgs}
          isTyping={isTyping}
          onSendMessage={handleSendMessage}
          onTyping={handleTyping}
        />
      </main>
    </div>
  );
}