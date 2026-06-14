use std::path::PathBuf;

use anyhow::Context;

// Komplette Laufzeit-Konfiguration aus Umgebungsvariablen – die Secrets
// (SMTP-Zugang, Operator-Adressen) kommen im Deployment aus
// deployment/provided-secrets.env, alles andere hat Container-Defaults
// (siehe Dockerfile).
#[derive(Clone)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    /// false = implicit TLS (Port 465, Standard), true = STARTTLS.
    pub starttls: bool,
}

#[derive(Clone)]
pub struct Config {
    pub port: u16,
    /// Markenname für E-Mails (Betreff/Signatur) – markenneutral pro Projekt.
    pub brand_name: String,
    /// Basis-URL für Magic-Links, z. B. https://firstdorsal.eu
    pub public_url: String,
    /// Statisches Frontend, das mitausgeliefert wird. None = reiner
    /// API-/WebSocket-Dienst (Frontend kommt von woanders).
    pub static_dir: Option<PathBuf>,
    pub data_dir: PathBuf,
    pub mail_from: String,
    /// Ziel nach erfolgreichem Kunden-Login (deutsch / englisch).
    pub customer_redirect: String,
    pub customer_redirect_en: String,
    /// Ziel nach erfolgreichem Operator-Login.
    pub admin_redirect: String,
    /// None = lokale Entwicklung, Links landen nur im Log.
    pub smtp: Option<SmtpConfig>,
    /// Wer sich mit diesen Adressen anmeldet, bekommt Operator-Zugang.
    pub operator_emails: Vec<String>,
    /// Secure-Flag fürs Session-Cookie (aus, wenn PUBLIC_URL http:// ist).
    pub cookie_secure: bool,
    /// Basis-URL des Whisper-Dienstes (whisper-asr-webservice); None =
    /// Sprachnachrichten ohne Transkription.
    pub whisper_url: Option<String>,
    /// Erzwungene Transkriptionssprache (z. B. "de"); None = Autodetect.
    /// Kleine Modelle (E2E: tiny) brauchen die Hilfe, große nicht.
    pub whisper_language: Option<String>,
    /// Test-/Dev-Modus: Mails als Dateien in dieses Verzeichnis schreiben
    /// statt sie zu versenden (genutzt von den Playwright-E2E-Tests).
    pub mail_file_dir: Option<PathBuf>,
    /// WebRTC: STUN-URLs (z. B. "stun:turn.example.eu:3478"), kommagetrennt.
    pub stun_urls: Vec<String>,
    /// WebRTC: TURN-URLs (z. B. "turn:turn.example.eu:3478?transport=udp").
    pub turn_urls: Vec<String>,
    /// Shared Secret für coturns REST-Auth (`use-auth-secret`). None = nur
    /// STUN/Host-Kandidaten (kein Relay).
    pub turn_secret: Option<String>,
    /// Gültigkeitsdauer der TURN-Zugangsdaten in Sekunden.
    pub turn_ttl: i64,
    /// Nur für Tests: aktiviert den Seed-Endpoint (viele Nachrichten für
    /// die Performance-Tests des virtuellen Scrollens). Nie in Produktion.
    pub seed_enabled: bool,
}

fn env_list(key: &str) -> Vec<String> {
    env_or(key, "")
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key)
        .ok()
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| default.to_string())
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let public_url = env_or("PUBLIC_URL", "https://firstdorsal.eu")
            .trim_end_matches('/')
            .to_string();
        let smtp = match std::env::var("SMTP_HOST") {
            Ok(host) if !host.is_empty() => Some(SmtpConfig {
                host,
                port: env_or("SMTP_PORT", "465").parse().context("SMTP_PORT")?,
                user: std::env::var("SMTP_USER").context("SMTP_USER fehlt")?,
                password: std::env::var("SMTP_PASSWORD").context("SMTP_PASSWORD fehlt")?,
                starttls: env_or("SMTP_TLS", "implicit") == "starttls",
            }),
            _ => None,
        };
        Ok(Self {
            port: env_or("PORT", "8080").parse().context("PORT")?,
            brand_name: env_or("BRAND_NAME", "firstdorsal"),
            cookie_secure: public_url.starts_with("https://"),
            public_url,
            // Kein STATIC_DIR = reiner Backend-Dienst (kein Frontend).
            static_dir: std::env::var("STATIC_DIR")
                .ok()
                .filter(|v| !v.is_empty())
                .map(PathBuf::from),
            data_dir: env_or("DATA_DIR", "./data").into(),
            mail_from: env_or("MAIL_FROM", "firstdorsal <mail@firstdorsal.eu>"),
            customer_redirect: env_or("CUSTOMER_REDIRECT", "/?chat=open"),
            customer_redirect_en: env_or("CUSTOMER_REDIRECT_EN", "/en/?chat=open"),
            admin_redirect: env_or("ADMIN_REDIRECT", "/chat/admin/"),
            smtp,
            operator_emails: env_or("OPERATOR_EMAILS", "")
                .split(',')
                .map(|s| s.trim().to_ascii_lowercase())
                .filter(|s| !s.is_empty())
                .collect(),
            whisper_url: std::env::var("WHISPER_URL")
                .ok()
                .filter(|v| !v.is_empty())
                .map(|v| v.trim_end_matches('/').to_string()),
            whisper_language: std::env::var("WHISPER_LANGUAGE")
                .ok()
                .filter(|v| !v.is_empty()),
            mail_file_dir: std::env::var("MAIL_FILE_DIR")
                .ok()
                .filter(|v| !v.is_empty())
                .map(PathBuf::from),
            stun_urls: env_list("STUN_URLS"),
            turn_urls: env_list("TURN_URLS"),
            turn_secret: std::env::var("TURN_SECRET").ok().filter(|v| !v.is_empty()),
            turn_ttl: env_or("TURN_TTL", "3600").parse().unwrap_or(3600),
            seed_enabled: env_or("E2E_SEED", "") == "1",
        })
    }

    pub fn is_operator(&self, email: &str) -> bool {
        self.operator_emails.iter().any(|e| e == email)
    }
}
