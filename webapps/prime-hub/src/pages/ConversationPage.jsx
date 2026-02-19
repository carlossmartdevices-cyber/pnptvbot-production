import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useDMSocket } from '../hooks/useChat';
import { Send, ArrowLeft } from 'lucide-react';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function ConversationPage() {
  const { partnerId } = useParams();
  const { user: me } = useAuth();
  const [partner, setPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  const onReceived = useCallback((msg) => {
    if (msg.sender_id === partnerId || msg.sender?.id === partnerId) {
      setMessages(prev => [...prev, msg]);
    }
  }, [partnerId]);

  const { sendDM, sendTyping } = useDMSocket(onReceived);

  useEffect(() => {
    Promise.all([
      api.getDMPartnerInfo(partnerId),
      api.getConversation(partnerId),
    ]).then(([partnerRes, convRes]) => {
      setPartner(partnerRes.user);
      setMessages(convRes.messages || []);
    }).catch(() => {});
  }, [partnerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    sendDM(partnerId, text);
    // Optimistically add message
    setMessages(prev => [...prev, {
      id: `tmp-${Date.now()}`,
      sender_id: me.id,
      recipient_id: partnerId,
      content: text,
      created_at: new Date().toISOString(),
    }]);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    else sendTyping(partnerId);
  };

  return (
    <Layout>
      <div className="conv-header">
        <Link to="/messages" className="conv-back-btn">
          <ArrowLeft size={20} />
        </Link>
        <div className="conv-partner-name">
          {partner ? (partner.first_name || partner.username) : 'Loading...'}
          {partner?.username && <span className="post-author-handle"> @{partner.username}</span>}
        </div>
      </div>

      <div className="conv-messages">
        {messages.map((msg, i) => (
          <div key={msg.id || i} className={`dm-message ${msg.sender_id === me?.id ? 'own' : 'other'}`}>
            <div className="dm-bubble">{msg.content}</div>
            <div className="dm-time">{timeAgo(msg.created_at)}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="conv-input-row">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          maxLength={2000}
          className="chat-input"
          style={{ flex: 1 }}
        />
        <button onClick={handleSend} disabled={!input.trim()} className="chat-send-btn">
          <Send size={16} />
        </button>
      </div>
    </Layout>
  );
}
