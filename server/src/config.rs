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
    /// Basis-URL für Magic-Links, z. B. https://firstdorsal.eu
    pub public_url: String,
    pub static_dir: PathBuf,
    pub data_dir: PathBuf,
    pub mail_from: String,
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
            cookie_secure: public_url.starts_with("https://"),
            public_url,
            static_dir: env_or("STATIC_DIR", "../dist").into(),
            data_dir: env_or("DATA_DIR", "./data").into(),
            mail_from: env_or("MAIL_FROM", "firstdorsal <mail@firstdorsal.eu>"),
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
        })
    }

    pub fn is_operator(&self, email: &str) -> bool {
        self.operator_emails.iter().any(|e| e == email)
    }
}
