import { useState } from 'react';

export default function EntryScreen({ onEnter, connStatus }) {
  const [nameInput, setNameInput] = useState('');

  const handleEnter = () => {
    const name = nameInput.trim();
    if (name) onEnter(name);
  };

  return (
    <div className="screen">
      <div className="card">
        <div className="brand">Chatea Conmigo</div>
        <p>Ingresa tu nombre para conectarte.</p>
        <input
          id="name-input"
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleEnter()}
          placeholder="Tu nombre..."
          autoFocus
        />
        <button id="enter-btn" onClick={handleEnter} style={{ marginTop: 14, width: '100%' }}>
          Entrar al chat
        </button>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 16, marginBottom: 0 }}>
          Estado: {connStatus}
        </p>
      </div>
    </div>
  );
}
