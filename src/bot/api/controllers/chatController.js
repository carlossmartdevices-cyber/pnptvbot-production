const { query } = require('../../../config/postgres');
const logger = require('../../../utils/logger');

const authGuard = (req, res) => {
  const user = req.session?.user;
  if (!user) { res.status(401).json({ error: 'Not authenticated' }); return null; }
  return user;
};

// Get chat history for a room (REST fallback)
const getChatHistory = async (req, res) => {
  const user = authGuard(req, res); if (!user) return;
  const room = req.params.room || 'general';
  const { cursor } = req.query;
  try {
    const { rows } = await query(
      `SELECT id, room, user_id, username, first_name, photo_url, content, created_at
       FROM chat_messages
       WHERE room=$1 AND is_deleted=false
         ${cursor ? 'AND created_at < $2' : ''}
       ORDER BY created_at DESC LIMIT 50`,
      cursor ? [room, cursor] : [room]
    );
    return res.json({ success: true, messages: rows.reverse() });
  } catch (err) {
    logger.error('getChatHistory error', err);
    return res.status(500).json({ error: 'Failed to load chat history' });
  }
};

module.exports = { getChatHistory };
