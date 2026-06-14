use anyhow::Context;
use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

use crate::config::Config;

// Versand der Magic-Link-Mails über den vorhandenen SMTP-Account (TLS).
// Ohne SMTP_HOST (lokale Entwicklung) wird der Link nur geloggt; mit
// MAIL_FILE_DIR landen die Mails als Dateien auf der Platte – davon
// leben die Playwright-E2E-Tests. Markenname und Basis-URL kommen aus der
// Config, damit derselbe Code in mehreren Projekten neutral läuft.
enum Transport {
    Smtp {
        transport: AsyncSmtpTransport<Tokio1Executor>,
        from: String,
    },
    File(std::path::PathBuf),
    Log,
}

pub struct Mailer {
    transport: Transport,
    brand: String,
    public_url: String,
}

impl Mailer {
    pub fn new(cfg: &Config) -> anyhow::Result<Self> {
        let transport = Self::transport(cfg)?;
        Ok(Self {
            transport,
            brand: cfg.brand_name.clone(),
            public_url: cfg.public_url.clone(),
        })
    }

    fn transport(cfg: &Config) -> anyhow::Result<Transport> {
        if let Some(dir) = &cfg.mail_file_dir {
            std::fs::create_dir_all(dir).context("MAIL_FILE_DIR anlegen")?;
            tracing::warn!("MAIL_FILE_DIR gesetzt – Mails werden nur als Dateien abgelegt");
            return Ok(Transport::File(dir.clone()));
        }
        let Some(smtp) = &cfg.smtp else {
            tracing::warn!("SMTP_HOST nicht gesetzt – Magic-Links landen nur im Log");
            return Ok(Transport::Log);
        };
        let builder = if smtp.starttls {
            AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&smtp.host)?
        } else {
            AsyncSmtpTransport::<Tokio1Executor>::relay(&smtp.host)?
        };
        Ok(Transport::Smtp {
            transport: builder
                .port(smtp.port)
                .credentials(Credentials::new(smtp.user.clone(), smtp.password.clone()))
                .build(),
            from: cfg.mail_from.clone(),
        })
    }

    pub async fn send_magic_link(&self, to: &str, link: &str, lang: &str) -> anyhow::Result<()> {
        let brand = &self.brand;
        let url = &self.public_url;
        let (subject, body) = if lang == "en" {
            (
                format!("Your sign-in link for the {brand} chat"),
                format!(
                    "Hello,\n\nuse this link to sign in to the {brand} chat:\n\n{link}\n\n\
                     The link is valid for 30 minutes and can only be used once.\n\
                     If you did not request this, simply ignore this email.\n\n\
                     {brand}\n{url}"
                ),
            )
        } else {
            (
                format!("Ihr Anmeldelink für den {brand}-Chat"),
                format!(
                    "Guten Tag,\n\nmit diesem Link melden Sie sich im {brand}-Chat an:\n\n{link}\n\n\
                     Der Link ist 30 Minuten gültig und nur einmal verwendbar.\n\
                     Falls Sie keine Anmeldung angefordert haben, ignorieren Sie diese E-Mail einfach.\n\n\
                     {brand}\n{url}"
                ),
            )
        };

        match &self.transport {
            Transport::Log => {
                tracing::info!("Magic-Link für {to}: {link}");
                Ok(())
            }
            Transport::File(dir) => {
                let name = format!("{}-{}.txt", crate::db::now(), to.replace(['@', '/'], "_"));
                tokio::fs::write(dir.join(name), format!("To: {to}\nSubject: {subject}\n\n{body}"))
                    .await
                    .context("Mail-Datei schreiben")?;
                Ok(())
            }
            Transport::Smtp { transport, from } => {
                let msg = Message::builder()
                    .from(from.parse().context("MAIL_FROM unlesbar")?)
                    .to(to.parse().context("Empfängeradresse unlesbar")?)
                    .subject(subject)
                    .header(ContentType::TEXT_PLAIN)
                    .body(body)
                    .context("Mail bauen")?;
                transport.send(msg).await.context("SMTP-Versand")?;
                Ok(())
            }
        }
    }
}
