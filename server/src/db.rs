use std::path::Path;

use anyhow::Context;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use sqlx::SqlitePool;

// SQLite als einzige Datenhaltung: eine Datei auf dem /data-Volume,
// WAL-Modus für nebenläufige Leser, Migrationen ins Binary eingebettet.
pub async fn connect(data_dir: &Path) -> anyhow::Result<SqlitePool> {
    let opts = SqliteConnectOptions::new()
        .filename(data_dir.join("chat.db"))
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(opts)
        .await
        .context("SQLite öffnen")?;
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .context("Migrationen ausführen")?;
    Ok(pool)
}

/// Aktuelle Zeit als Unix-Sekunden – das einheitliche Zeitformat der DB.
pub fn now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("Systemzeit vor 1970")
        .as_secs() as i64
}
