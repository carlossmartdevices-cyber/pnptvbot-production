CREATE TABLE ticket_ratings (
  id SERIAL PRIMARY KEY,
  ticket_user_id VARCHAR(255) REFERENCES support_topics(user_id),
  user_id BIGINT,
  rating INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
