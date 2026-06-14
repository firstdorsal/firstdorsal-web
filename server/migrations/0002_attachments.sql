-- Anhänge jeder Art: Bilder, Sprachnachrichten, Videos und generische
-- Dateien. Die Blobs liegen content-addressed (SHA-256) unter
-- DATA_DIR/uploads, hier nur Metadaten. filename ist der (bereinigte)
-- Originalname für den Download. transcript_status ist NULL für alles
-- außer Sprachnachrichten mit konfiguriertem Whisper-Dienst.

CREATE TABLE attachments (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('image', 'voice', 'video', 'file')),
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    filename TEXT,
    duration_ms INTEGER,
    transcript TEXT,
    transcript_status TEXT CHECK (transcript_status IN ('pending', 'done', 'failed')),
    created_at INTEGER NOT NULL
);
