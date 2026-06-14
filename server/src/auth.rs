use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use axum::http::HeaderMap;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine as _;
use rand::RngCore;
use sha2::{Digest, Sha256};
use sqlx::Row as _;
use sqlx::SqlitePool;

use crate::db::now;

// Magic-Link-Anmeldung: Einmal-Token per Mail, in der DB liegt nur der
// SHA-256-Hash. Nach dem Klick gibt es eine Session (eigenes Token,
// ebenfalls nur als Hash gespeichert) im HttpOnly-Cookie.

pub const SESSION_COOKIE: &str = "fd_session";
pub const SESSION_TTL: i64 = 60 * 60 * 24 * 90; // 90 Tage
pub const MAGIC_LINK_TTL: i64 = 60 * 30; // 30 Minuten

/// 32 Zufallsbytes, base64url – als Magic-Link- und Session-Token.
pub fn new_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

pub fn token_hash(token: &str) -> String {
    let digest = Sha256::digest(token.as_bytes());
    digest.iter().map(|b| format!("{b:02x}")).collect()
}

/// Bewusst lax: nur grobe Plausibilität, die echte Prüfung ist der
/// Magic-Link selbst (wer die Mail nicht empfängt, kommt nicht rein).
pub fn valid_email(email: &str) -> bool {
    let Some((local, domain)) = email.split_once('@') else {
        return false;
    };
    !local.is_empty()
        && domain.contains('.')
        && !domain.starts_with('.')
        && !domain.ends_with('.')
        && email.len() <= 254
        && !email.contains(|c: char| c.is_whitespace())
}

pub struct Session {
    pub role: String, // "customer" | "operator"
    pub email: String,
    pub customer_id: Option<i64>,
}

fn cookie_token(headers: &HeaderMap) -> Option<String> {
    let cookies = headers.get(axum::http::header::COOKIE)?.to_str().ok()?;
    cookies.split(';').find_map(|c| {
        let (k, v) = c.trim().split_once('=')?;
        (k == SESSION_COOKIE).then(|| v.to_string())
    })
}

pub async fn session_from_headers(db: &SqlitePool, headers: &HeaderMap) -> Option<Session> {
    let token = cookie_token(headers)?;
    let row = sqlx::query(
        "SELECT role, email, customer_id FROM sessions \
         WHERE token_hash = ? AND expires_at > ?",
    )
    .bind(token_hash(&token))
    .bind(now())
    .fetch_optional(db)
    .await
    .ok()??;
    Some(Session {
        role: row.get("role"),
        email: row.get("email"),
        customer_id: row.get("customer_id"),
    })
}

/// Legt eine Session an und gibt das (unverhashte) Token fürs Cookie zurück.
pub async fn create_session(
    db: &SqlitePool,
    role: &str,
    email: &str,
    customer_id: Option<i64>,
) -> anyhow::Result<String> {
    let token = new_token();
    sqlx::query(
        "INSERT INTO sessions (token_hash, role, email, customer_id, created_at, expires_at) \
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(token_hash(&token))
    .bind(role)
    .bind(email)
    .bind(customer_id)
    .bind(now())
    .bind(now() + SESSION_TTL)
    .execute(db)
    .await?;
    Ok(token)
}

pub async fn delete_session(db: &SqlitePool, headers: &HeaderMap) {
    if let Some(token) = cookie_token(headers) {
        let _ = sqlx::query("DELETE FROM sessions WHERE token_hash = ?")
            .bind(token_hash(&token))
            .execute(db)
            .await;
    }
}

pub fn session_cookie(token: &str, secure: bool, max_age: i64) -> String {
    let secure_flag = if secure { "; Secure" } else { "" };
    format!("{SESSION_COOKIE}={token}; Path=/; HttpOnly{secure_flag}; SameSite=Lax; Max-Age={max_age}")
}

/// Schiebefenster-Rate-Limit im Speicher – reicht für einen einzelnen
/// Prozess und schützt den Magic-Link-Versand vor Mail-Bombing.
pub struct RateLimiter {
    hits: Mutex<HashMap<String, Vec<Instant>>>,
}

impl RateLimiter {
    pub fn new() -> Self {
        Self {
            hits: Mutex::new(HashMap::new()),
        }
    }

    pub fn allow(&self, key: &str, max: usize, window: Duration) -> bool {
        let mut map = self.hits.lock().expect("RateLimiter-Lock");
        let entry = map.entry(key.to_string()).or_default();
        let cutoff = Instant::now().checked_sub(window);
        entry.retain(|t| cutoff.is_none_or(|c| *t > c));
        if entry.len() >= max {
            return false;
        }
        entry.push(Instant::now());
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_ist_lang_und_einmalig() {
        let a = new_token();
        let b = new_token();
        assert_eq!(a.len(), 43); // 32 Bytes base64url ohne Padding
        assert_ne!(a, b);
    }

    #[test]
    fn hash_ist_stabil_und_hex() {
        let h = token_hash("test");
        assert_eq!(h, token_hash("test"));
        assert_eq!(h.len(), 64);
        assert!(h.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn email_plausibilitaet() {
        assert!(valid_email("kunde@example.org"));
        assert!(valid_email("a.b+c@sub.example.co"));
        assert!(!valid_email("ohne-at.example.org"));
        assert!(!valid_email("@example.org"));
        assert!(!valid_email("kunde@ohnepunkt"));
        assert!(!valid_email("kunde@.example.org"));
        assert!(!valid_email("leer zeichen@example.org"));
    }

    #[test]
    fn rate_limiter_blockt_ab_maximum() {
        let rl = RateLimiter::new();
        let window = Duration::from_secs(60);
        assert!(rl.allow("k", 2, window));
        assert!(rl.allow("k", 2, window));
        assert!(!rl.allow("k", 2, window));
        // Anderer Schlüssel ist unabhängig.
        assert!(rl.allow("anders", 2, window));
    }
}
