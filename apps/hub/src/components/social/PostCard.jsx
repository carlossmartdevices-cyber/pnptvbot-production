import React, { useState } from 'react';
import { Heart, MessageCircle, Repeat2, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Link } from 'react-router-dom';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function PostCard({ post, onDeleted, onError }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState([]);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [avatarError, setAvatarError] = useState(false);

  const handleLike = async () => {
    const previousLiked = liked;
    const previousCount = likesCount;

    try {
      setLiked(!previousLiked);
      setLikesCount(c => !previousLiked ? c + 1 : Math.max(0, c - 1));

      const res = await api.toggleLike(post.id);
      setLiked(res.liked);
      setLikesCount(c => res.liked ? previousCount + 1 : Math.max(0, previousCount - 1));
    } catch (err) {
      // Revert state on error
      setLiked(previousLiked);
      setLikesCount(previousCount);
      console.error('Error toggling like:', err);
      showToast('Error al procesar el like', 'error');
      onError?.();
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Eliminar este post?')) return;
    try {
      await api.deletePost(post.id);
      showToast('Post eliminado exitosamente', 'success');
      onDeleted && onDeleted(post.id);
    } catch (err) {
      console.error('Error deleting post:', err);
      showToast('Error al eliminar el post', 'error');
      onError?.();
    }
  };

  const loadReplies = async () => {
    if (showReplies) { setShowReplies(false); return; }
    try {
      const res = await api.getReplies(post.id);
      setReplies(res.replies || []);
      setShowReplies(true);
    } catch (err) {
      console.error('Error loading replies:', err);
      showToast('Error al cargar las respuestas', 'error');
      onError?.();
    }
  };

  const submitReply = async () => {
    if (!replyText.trim()) return;
    try {
      await api.createPost({ content: replyText, replyToId: post.id });
      setReplyText('');
      setReplying(false);
      const res = await api.getReplies(post.id);
      setReplies(res.replies || []);
      setShowReplies(true);
      showToast('Respuesta agregada', 'success');
    } catch (err) {
      console.error('Error submitting reply:', err);
      showToast('Error al enviar la respuesta', 'error');
      onError?.();
    }
  };

  const getInitials = (firstName, username) => {
    const name = firstName || username || '?';
    return name[0].toUpperCase();
  };

  return (
    <div className="post-card">
      <div className="post-header">
        <div className="post-avatar">
          {post.author_photo_url && !avatarError ? (
            <img
              src={post.author_photo_url}
              alt={post.author_first_name || post.author_username}
              className="post-avatar-img"
              loading="lazy"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <div className="post-avatar-placeholder">
              {getInitials(post.author_first_name, post.author_username)}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <Link to={`/wall/${post.author_id}`} className="post-author-name">
            {post.author_first_name || post.author_username}
          </Link>
          {post.author_username && <span className="post-author-handle">@{post.author_username}</span>}
          <div className="post-time">{timeAgo(post.created_at)}</div>
        </div>
        {post.author_id === user?.id && (
          <button onClick={handleDelete} className="post-delete-btn" title="Delete">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {post.repost_content && (
        <div className="post-repost-preview">
          <Repeat2 size={12} style={{ opacity: 0.6 }} />
          <span>{post.repost_author_first_name || post.repost_author_username}: {post.repost_content.slice(0, 100)}</span>
        </div>
      )}

      <div className="post-content">{post.content}</div>

      {post.media_url && post.media_type === 'image' && (
        <img src={post.media_url} alt="" className="post-media" />
      )}

      {post.media_url && post.media_type === 'video' && (
        <video src={post.media_url} controls className="post-media" style={{ maxHeight: 400 }} />
      )}

      <div className="post-actions">
        <button onClick={handleLike} className={`post-action-btn ${liked ? 'liked' : ''}`}>
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
          <span>{likesCount}</span>
        </button>
        <button onClick={loadReplies} className="post-action-btn">
          <MessageCircle size={16} />
          <span>{post.replies_count || 0}</span>
        </button>
        <Link to={`/messages/${post.author_id}`} className="post-action-btn" style={{ textDecoration: 'none' }}>
          <MessageCircle size={16} style={{ opacity: 0 }} />
        </Link>
      </div>

      {showReplies && (
        <div className="post-replies">
          {replies.map(r => (
            <div key={r.id} className="reply-item">
              <span className="reply-author">{r.author_first_name || r.author_username}:</span>
              <span className="reply-content"> {r.content}</span>
            </div>
          ))}
          <button onClick={() => setReplying(r => !r)} className="post-action-btn" style={{ marginTop: 8 }}>
            {replying ? 'Cancel' : 'Reply'}
          </button>
          {replying && (
            <div className="reply-compose">
              <input
                type="text"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="reply-input"
                onKeyDown={e => e.key === 'Enter' && submitReply()}
              />
              <button onClick={submitReply} className="chat-send-btn" disabled={!replyText.trim()}>Reply</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
