-- Phase 2/3: Bild- und Sprachnachrichten. Die Blobs liegen
-- content-addressed (SHA-256) unter DATA_DIR/uploads, hier nur Metadaten.
-- transcript_status ist NULL für Bilder und für Sprachnachrichten ohne
-- konfigurierten Whisper-Dienst.

CREATE TABLE attachments (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('image', 'voice')),
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    duration_ms INTEGER,
    transcript TEXT,
    transcript_status TEXT CHECK (transcript_status IN ('pending', 'done', 'failed')),
    created_at INTEGER NOT NULL
);
