-- Wallet-to-wallet messaging. One row per message, both directions of a
-- conversation live in the same table (sender/recipient swap per row) --
-- a "thread" with wallet X is just every row where sender or recipient is
-- X and the other side is me, ordered by created_at.
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at INTEGER
);

-- Inbox listing: "every message I've received, newest first" and the
-- unread count both filter/sort on recipient+created_at.
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient, created_at);

-- Thread view and the per-sender rate-limit check both filter on sender.
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender, created_at);

-- Contact book (2026-09-28): one row per saved wallet, per owner.
CREATE TABLE IF NOT EXISTS contacts (
  owner TEXT NOT NULL,
  wallet TEXT NOT NULL,
  nickname TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (owner, wallet)
);

-- Group chats (2026-09-28). rule = 'collection' | 'trait' | 'open' — see
-- functions/_chat.js for who may join each kind.
CREATE TABLE IF NOT EXISTS chat_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  owner TEXT NOT NULL,
  rule TEXT NOT NULL,
  collection TEXT,
  trait_type TEXT,
  trait_value TEXT,
  created_at INTEGER NOT NULL
);

-- last_read_id = the newest group message id this member has seen.
CREATE TABLE IF NOT EXISTS chat_group_members (
  group_id INTEGER NOT NULL,
  wallet TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  last_read_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (group_id, wallet)
);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_wallet ON chat_group_members(wallet);

CREATE TABLE IF NOT EXISTS chat_group_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  sender TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_group_messages_group ON chat_group_messages(group_id, id);
CREATE INDEX IF NOT EXISTS idx_chat_group_messages_sender ON chat_group_messages(sender, created_at);
