// Wiederverwendbarer Chat-Backend-Dienst (axum): Magic-Link-Login per
// SMTP, SQLite, WebSocket-Push, Bild-/Video-/Datei-Uploads, self-hosted
// Transkription (Whisper) und WebRTC-Anruf-Signalisierung. Die optionale
// Auslieferung eines statischen Frontends (STATIC_DIR) macht ihn auch zum
// Ein-Container-Ersatz für einen Webserver – ohne STATIC_DIR ist er ein
// reiner API-/WebSocket-Dienst hinter einem beliebigen Frontend.
//
// Einbindung als Bibliothek:
//     let cfg = webchat::Config::from_env()?;
//     webchat::run(cfg).await?;        // betriebsfertig (Bind + Shutdown)
// oder feingranular:
//     let state = webchat::AppState::init(cfg).await?;
//     let app = webchat::build_router(state);   // axum::Router zum Mounten
//
// Konfiguration ausschließlich über Umgebungsvariablen (siehe config.rs
// und server/README.md), damit derselbe Dienst markenneutral in mehreren
// Projekten läuft.

pub mod api;
pub mod auth;
pub mod config;
pub mod db;
pub mod mail;
pub mod statics;
pub mod turn;
pub mod whisper;
pub mod ws;

use std::sync::Arc;

use anyhow::Context;
use axum::Router;
use tokio::net::TcpListener;

pub use config::Config;

pub struct AppState {
    pub cfg: config::Config,
    pub db: sqlx::SqlitePool,
    pub hub: ws::Hub,
    pub mailer: mail::Mailer,
    pub limiter: auth::RateLimiter,
}

pub type SharedState = Arc<AppState>;

impl AppState {
    /// Datenbank öffnen/migrieren, Mailer aufbauen, Zustand bereitstellen.
    pub async fn init(cfg: config::Config) -> anyhow::Result<SharedState> {
        std::fs::create_dir_all(&cfg.data_dir)
            .with_context(|| format!("DATA_DIR anlegen: {}", cfg.data_dir.display()))?;
        let db = db::connect(&cfg.data_dir).await?;
        let mailer = mail::Mailer::new(&cfg)?;
        Ok(Arc::new(AppState {
            hub: ws::Hub::new(),
            limiter: auth::RateLimiter::new(),
            cfg,
            db,
            mailer,
        }))
    }
}

/// Fertiger axum-Router (Chat-API/WS + optional statisches Frontend),
/// bereit zum Servieren oder zum Mounten unter einer eigenen App.
pub fn build_router(state: SharedState) -> Router {
    statics::with_static_site(api::router(state.clone()), &state.cfg)
}

/// Betriebsfertig: Zustand initialisieren, Port binden (Dual-Stack mit
/// IPv4-Fallback) und bis zum Shutdown-Signal servieren.
pub async fn run(cfg: config::Config) -> anyhow::Result<()> {
    let port = cfg.port;
    let state = AppState::init(cfg).await?;
    let app = build_router(state);

    // "::" nimmt IPv6 und v4-mapped IPv4 an; Fallback auf reines IPv4.
    let addr_v6 = format!("[::]:{port}");
    let addr_v4 = format!("0.0.0.0:{port}");
    let (listener, addr) = match TcpListener::bind(&addr_v6).await {
        Ok(l) => (l, addr_v6),
        Err(e) => {
            tracing::warn!("kein IPv6 ({e}), binde {addr_v4}");
            (
                TcpListener::bind(&addr_v4)
                    .await
                    .with_context(|| format!("Port binden: {addr_v4}"))?,
                addr_v4,
            )
        }
    };
    tracing::info!("webchat lauscht auf {addr}");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

// SIGTERM (docker stop) und Strg-C sauber behandeln, damit laufende
// Antworten noch zu Ende gehen.
async fn shutdown_signal() {
    let ctrl_c = tokio::signal::ctrl_c();
    let mut term = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        .expect("SIGTERM-Handler");
    tokio::select! {
        _ = ctrl_c => {}
        _ = term.recv() => {}
    }
}
