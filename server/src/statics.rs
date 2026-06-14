use axum::extract::Request;
use axum::http::{header, HeaderValue};
use axum::middleware::{self, Next};
use axum::response::Response;
use axum::Router;
use tower_http::compression::CompressionLayer;
use tower_http::services::ServeDir;

use crate::config::Config;

// Statische Auslieferung des Astro-Builds als Fallback hinter den
// /chat-Routen – Nachbau der bisherigen sws.toml: HTML no-cache (immer
// revalidieren, billige 304er über Last-Modified), gehashte
// /_astro-Assets ein Jahr immutable, Icons einen Tag; dazu die
// Security-Header (vorher `security-headers = true`) und Kompression.
pub fn with_static_site(app: Router, cfg: &Config) -> Router {
    // Ohne STATIC_DIR bleibt der Dienst ein reiner API-/WebSocket-Server
    // (das Frontend kommt dann von woanders).
    let app = match &cfg.static_dir {
        Some(dir) => app.fallback_service(ServeDir::new(dir)),
        None => app,
    };
    app.layer(middleware::from_fn(headers_mw))
        .layer(CompressionLayer::new())
}

async fn headers_mw(req: Request, next: Next) -> Response {
    let path = req.uri().path().to_string();
    let mut res = next.run(req).await;
    let h = res.headers_mut();

    // Handler-eigene Cache-Strategien (z. B. Attachments) respektieren.
    let cache_gesetzt = h.contains_key(header::CACHE_CONTROL);
    let cache: &'static str = if path.starts_with("/chat/api")
        || path.starts_with("/chat/ws")
        || path.starts_with("/chat/login")
        || path == "/health"
    {
        "no-store"
    } else if path.starts_with("/_astro/") {
        "public, max-age=31536000, immutable"
    } else if [".png", ".ico", ".svg"].iter().any(|ext| path.ends_with(ext)) {
        "public, max-age=86400"
    } else {
        "no-cache"
    };
    if !cache_gesetzt {
        h.insert(header::CACHE_CONTROL, HeaderValue::from_static(cache));
    }

    h.insert(
        header::STRICT_TRANSPORT_SECURITY,
        HeaderValue::from_static("max-age=63072000; includeSubDomains; preload"),
    );
    h.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    h.insert(header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY"));
    h.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    res
}
