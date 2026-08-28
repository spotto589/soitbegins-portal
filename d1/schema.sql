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
