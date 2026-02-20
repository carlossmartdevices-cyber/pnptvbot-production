import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, ChevronDown } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const { user } = useAuth();
  const { messages, connected, sendMessage, pushMessage } = useChat('general');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const initialLoadAttempted = useRef(false);

  // Load chat history from REST if Socket.IO isn't available
  useEffect(() => {
    if (open && !connected && !initialLoadAttempted.current && messages.length === 0) {
      initialLoadAttempted.current = true;
      api.getChatHistory('general')
        .then(data => {
          if (data.success && Array.isArray(data.messages)) {
            data.messages.forEach(msg => pushMessage(msg));
          }
        })
        .catch(err => {
          console.warn('Failed to load chat history:', err);
        });
    }
  }, [open, connected, messages.length]);

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !user) return;
    setInput('');
    if (connected) {
      sendMessage(text);
    } else {
      try {
        const res = await api.sendChatRest('general', text);
        if (res.message) pushMessage(res.message);
      } catch {
        // silently ignore
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="chat-widget-fab"
        title="Community Chat"
        aria-label="Open community chat"
      >
        {open ? <X size={22} /> : <MessageSquare size={22} />}
        {!open && messages.length > 0 && (
          <span className="chat-widget-badge" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="chat-widget-panel">
          <div className="chat-widget-header">
            <span>Community Chat</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`chat-status-dot ${connected ? 'connected' : 'disconnected'}`} />
              <button onClick={() => setOpen(false)} className="chat-close-btn">
                <ChevronDown size={18} />
              </button>
            </div>
          </div>

          <div className="chat-messages-list">
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>
                No messages yet. Say hi!
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`chat-message ${msg.user_id === user.id ? 'own' : ''}`}>
                {msg.user_id !== user.id && (
                  <div className="chat-message-author">{msg.first_name || msg.username}</div>
                )}
                <div className="chat-bubble">{msg.content}</div>
                <div className="chat-message-time">{timeAgo(msg.created_at)}</div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-row">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              maxLength={2000}
              className="chat-input"
            />
            <button onClick={handleSend} disabled={!input.trim()} className="chat-send-btn">
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
