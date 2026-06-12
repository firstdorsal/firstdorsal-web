use anyhow::Context;
use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

use crate::config::Config;

// Versand der Magic-Link-Mails über den vorhandenen SMTP-Account (TLS).
// Ohne SMTP_HOST (lokale Entwicklung) wird der Link nur geloggt; mit
// MAIL_FILE_DIR landen die Mails als Dateien auf der Platte – davon
// leben die Playwright-E2E-Tests.
pub enum Mailer {
    Smtp {
        transport: AsyncSmtpTransport<Tokio1Executor>,
        from: String,
    },
    File(std::path::PathBuf),
    Log,
}

impl Mailer {
    pub fn new(cfg: &Config) -> anyhow::Result<Self> {
        if let Some(dir) = &cfg.mail_file_dir {
            std::fs::create_dir_all(dir).context("MAIL_FILE_DIR anlegen")?;
            tracing::warn!("MAIL_FILE_DIR gesetzt – Mails werden nur als Dateien abgelegt");
            return Ok(Self::File(dir.clone()));
        }
        let Some(smtp) = &cfg.smtp else {
            tracing::warn!("SMTP_HOST nicht gesetzt – Magic-Links landen nur im Log");
            return Ok(Self::Log);
        };
        let builder = if smtp.starttls {
            AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&smtp.host)?
        } else {
            AsyncSmtpTransport::<Tokio1Executor>::relay(&smtp.host)?
        };
        Ok(Self::Smtp {
            transport: builder
                .port(smtp.port)
                .credentials(Credentials::new(smtp.user.clone(), smtp.password.clone()))
                .build(),
            from: cfg.mail_from.clone(),
        })
    }

    pub async fn send_magic_link(&self, to: &str, link: &str, lang: &str) -> anyhow::Result<()> {
        let (subject, body) = if lang == "en" {
            (
                "Your sign-in link for the firstdorsal chat",
                format!(
                    "Hello,\n\nuse this link to sign in to the firstdorsal chat:\n\n{link}\n\n\
                     The link is valid for 30 minutes and can only be used once.\n\
                     If you did not request this, simply ignore this email.\n\n\
                     firstdorsal IT-Dienstleistungen\nhttps://firstdorsal.eu/en/"
                ),
            )
        } else {
            (
                "Ihr Anmeldelink für den firstdorsal-Chat",
                format!(
                    "Guten Tag,\n\nmit diesem Link melden Sie sich im firstdorsal-Chat an:\n\n{link}\n\n\
                     Der Link ist 30 Minuten gültig und nur einmal verwendbar.\n\
                     Falls Sie keine Anmeldung angefordert haben, ignorieren Sie diese E-Mail einfach.\n\n\
                     firstdorsal IT-Dienstleistungen\nhttps://firstdorsal.eu"
                ),
            )
        };

        match self {
            Self::Log => {
                tracing::info!("Magic-Link für {to}: {link}");
                Ok(())
            }
            Self::File(dir) => {
                let name = format!("{}-{}.txt", crate::db::now(), to.replace(['@', '/'], "_"));
                tokio::fs::write(dir.join(name), format!("To: {to}\nSubject: {subject}\n\n{body}"))
                    .await
                    .context("Mail-Datei schreiben")?;
                Ok(())
            }
            Self::Smtp { transport, from } => {
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
