// Ein Binary für alles: liefert das statisch gebaute Astro-dist/ aus
// (Ersatz für den static-web-server) und bedient den Kunden-Chat unter
// /chat/api/** (REST) und /chat/ws (WebSocket). Siehe
// docs/chat-feature-plan.md.
mod api;
mod auth;
mod config;
mod db;
mod mail;
mod statics;
mod ws;

use std::sync::Arc;

use anyhow::Context;
use tokio::net::TcpListener;
use tracing_subscriber::EnvFilter;

pub struct AppState {
    pub cfg: config::Config,
    pub db: sqlx::SqlitePool,
    pub hub: ws::Hub,
    pub mailer: mail::Mailer,
    pub limiter: auth::RateLimiter,
}

pub type SharedState = Arc<AppState>;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let cfg = config::Config::from_env()?;
    std::fs::create_dir_all(&cfg.data_dir)
        .with_context(|| format!("DATA_DIR anlegen: {}", cfg.data_dir.display()))?;

    let db = db::connect(&cfg.data_dir).await?;
    let mailer = mail::Mailer::new(&cfg)?;
    let state: SharedState = Arc::new(AppState {
        hub: ws::Hub::new(),
        limiter: auth::RateLimiter::new(),
        cfg,
        db,
        mailer,
    });

    let app = statics::with_static_site(api::router(state.clone()), &state.cfg);

    // Dual-Stack wie zuvor beim sws: "::" nimmt IPv6 und v4-mapped IPv4 an.
    // Fallback auf reines IPv4 für Umgebungen ohne IPv6.
    let addr_v6 = format!("[::]:{}", state.cfg.port);
    let addr_v4 = format!("0.0.0.0:{}", state.cfg.port);
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
    tracing::info!("firstdorsal-server lauscht auf {addr}");
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
