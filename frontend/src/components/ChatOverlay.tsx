'use client';
import { useState, useEffect, useRef } from 'react';
import { API_URL } from '@/utils/api';

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
      fetch(`${API_URL}/api/chat/history/${rideId}`, {
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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[5000] flex items-center justify-center sm:p-5">
      <div className="bg-white sm:rounded-[2.5rem] w-full sm:max-w-md h-full sm:h-[600px] flex flex-col overflow-hidden shadow-2xl shadow-slate-900/10 animate-in slide-in-from-bottom duration-300">
        
        {/* Header */}
        <div className="p-6 sm:p-8 bg-[#0f172a] text-white flex justify-between items-center">
          <div>
            <h3 className="text-lg sm:text-xl font-black mb-1">Secure Chat 💬</h3>
            <p className="text-[10px] sm:text-[11px] opacity-60 font-bold uppercase tracking-widest">End-to-end encrypted</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center font-black transition-colors">×</button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 bg-slate-50 no-scrollbar">
          {messages.length === 0 ? (
            <div className="text-center my-auto px-10">
              <span className="text-5xl block mb-6 animate-bounce">👋</span>
              <p className="font-black text-slate-300 text-sm leading-relaxed italic">Start a safe conversation with your partner.</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`max-w-[85%] px-5 py-3.5 rounded-3xl text-sm font-black shadow-sm ring-4 ring-white/50 ${
                m.senderId === currentUserId 
                ? 'self-end bg-[#0f172a] text-white rounded-tr-none' 
                : 'self-start bg-white text-[#0f172a] rounded-tl-none'
              }`}>
                {m.text}
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} className="p-5 sm:p-6 bg-white border-t border-slate-100 flex gap-3">
          <input 
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-6 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:border-[#e11d48] focus:bg-white outline-none font-black text-sm transition-all placeholder:text-slate-300"
          />
          <button type="submit" className="w-14 h-14 rounded-2xl bg-[#0f172a] text-white text-xl flex items-center justify-center hover:bg-slate-800 transition-all active:scale-90 shadow-lg shadow-slate-200">
            ➢
          </button>
        </form>
      </div>
    </div>
  );
}
