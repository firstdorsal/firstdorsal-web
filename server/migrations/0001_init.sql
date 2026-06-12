-- Grundschema Phase 1: Kunden, Konversationen (eine je Kunde),
-- Text-Nachrichten, Magic-Links und Sessions. Zeitstempel als
-- Unix-Sekunden (INTEGER). Attachments folgen in Phase 2.

CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL
);

CREATE TABLE conversations (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER NOT NULL UNIQUE REFERENCES customers (id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    last_message_at INTEGER
);

CREATE TABLE messages (
    id INTEGER PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('customer', 'operator')),
    kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'image', 'voice')),
    body_text TEXT,
    attachment_id INTEGER,
    created_at INTEGER NOT NULL,
    read_at INTEGER
);

CREATE INDEX idx_messages_conversation ON messages (conversation_id, id);

-- Einmal-Tokens für die Anmeldung: nur der SHA-256-Hash wird gespeichert.
CREATE TABLE magic_links (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN ('customer', 'operator')),
    lang TEXT NOT NULL DEFAULT 'de',
    token_hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER
);

CREATE TABLE sessions (
    id INTEGER PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('customer', 'operator')),
    email TEXT NOT NULL,
    customer_id INTEGER REFERENCES customers (id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);
