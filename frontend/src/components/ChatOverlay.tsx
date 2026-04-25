'use client';
import { useState, useEffect, useRef } from 'react';

interface Message {
  _id: string;
  senderId: string;
  text: string;
  createdAt: string;
  rideId?: string;
}

interface ChatOverlayProps {
  rideId: string;
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
  socket: any;
}

export default function ChatOverlay({ rideId, currentUserId, isOpen, onClose, socket }: ChatOverlayProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && rideId) {
      // Fetch history
      fetch(`http://127.0.0.1:5001/api/chat/history/${rideId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('customerToken') || localStorage.getItem('driverToken')}` }
      })
      .then(res => res.json())
      .then(data => setMessages(data))
      .catch(err => console.error('Chat history error:', err));

      // Join room
      socket?.emit('join-chat', rideId);
    }
  }, [isOpen, rideId, socket]);

  useEffect(() => {
    if (!socket) return;
    socket.on('receive-chat-message', (msg: Message) => {
      if (msg.rideId === rideId || (msg as any).rideId === rideId) {
        setMessages(prev => [...prev, msg]);
      }
    });
    return () => { socket.off('receive-chat-message'); };
  }, [socket, rideId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !socket) return;
    
    socket.emit('send-chat-message', {
      rideId,
      senderId: currentUserId,
      text: text.trim()
    });
    setText('');
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '32px', width: '100%', maxWidth: '440px', height: '600px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        
        {/* Header */}
        <div style={{ padding: '24px', background: '#111827', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900 }}>Secure Chat 💬</h3>
            <p style={{ margin: 0, fontSize: '11px', opacity: 0.7, fontWeight: 600 }}>End-to-end encrypted for your safety</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 900 }}>×</button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#f8fafc' }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', margin: 'auto', color: '#94a3b8' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>👋</span>
              <p style={{ fontWeight: 600, fontSize: '14px' }}>Start a safe conversation with your driver/passenger.</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} style={{ 
                alignSelf: m.senderId === currentUserId ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                padding: '12px 18px',
                borderRadius: m.senderId === currentUserId ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                background: m.senderId === currentUserId ? '#111827' : '#fff',
                color: m.senderId === currentUserId ? '#fff' : '#111827',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                fontSize: '14px',
                fontWeight: 600,
                position: 'relative'
              }}>
                {m.text}
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} style={{ padding: '20px', background: '#fff', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '12px' }}>
          <input 
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            style={{ flex: 1, padding: '14px 20px', borderRadius: '16px', border: '1.5px solid #e2e8f0', background: '#f8fafc', fontWeight: 600, fontSize: '14px', outline: 'none' }}
          />
          <button type="submit" style={{ width: '48px', height: '48px', borderRadius: '16px', border: 'none', background: '#111827', color: '#fff', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ➢
          </button>
        </form>
      </div>
    </div>
  );
}
