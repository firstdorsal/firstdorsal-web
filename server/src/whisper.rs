use std::path::PathBuf;
use std::time::Duration;

use anyhow::Context;
use serde_json::json;
use sqlx::Row as _;

use crate::SharedState;

// Self-hosted Transkription: Sprachnachrichten gehen asynchron an das
// whisper-asr-webservice (faster-whisper, CPU) im internen Netz –
// Audiodaten verlassen den Server nicht. encode=true lässt den Dienst
// per ffmpeg konvertieren, damit Browser-Formate (webm/opus, mp4)
// direkt funktionieren. Das Ergebnis wird nachgereicht: erst steht die
// Nachricht auf "pending", dann kommt das Transkript per WebSocket.

pub fn spawn_transcription(
    state: SharedState,
    attachment_id: i64,
    message_id: i64,
    conversation_id: i64,
    path: PathBuf,
    mime: String,
) {
    tokio::spawn(async move {
        let result = transcribe(&state, &path, &mime).await;
        let (status, transcript) = match result {
            Ok(text) => ("done", Some(text)),
            Err(e) => {
                tracing::error!("Transkription von Attachment {attachment_id}: {e:#}");
                ("failed", None)
            }
        };
        let updated = sqlx::query(
            "UPDATE attachments SET transcript = ?, transcript_status = ? WHERE id = ?",
        )
        .bind(&transcript)
        .bind(status)
        .bind(attachment_id)
        .execute(&state.db)
        .await;
        if let Err(e) = updated {
            tracing::error!("Transkript speichern: {e:#}");
            return;
        }
        // Konversation kann inzwischen gelöscht sein – dann still bleiben.
        let exists = sqlx::query("SELECT id FROM messages WHERE id = ?")
            .bind(message_id)
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten()
            .map(|row| row.get::<i64, _>("id"))
            .is_some();
        if exists {
            state.hub.publish(
                conversation_id,
                json!({
                    "type": "transcript",
                    "conversation_id": conversation_id,
                    "message_id": message_id,
                    "attachment_id": attachment_id,
                    "transcript": transcript,
                    "transcript_status": status,
                })
                .to_string(),
            );
        }
    });
}

async fn transcribe(state: &SharedState, path: &PathBuf, mime: &str) -> anyhow::Result<String> {
    let base = state
        .cfg
        .whisper_url
        .as_ref()
        .context("WHISPER_URL nicht konfiguriert")?;
    let bytes = tokio::fs::read(path).await.context("Audiodatei lesen")?;
    let part = reqwest::multipart::Part::bytes(bytes)
        .file_name("audio")
        .mime_str(mime.split(';').next().unwrap_or("audio/webm"))?;
    let form = reqwest::multipart::Form::new().part("audio_file", part);
    let language = state
        .cfg
        .whisper_language
        .as_ref()
        .map(|l| format!("&language={l}"))
        .unwrap_or_default();
    let res = reqwest::Client::new()
        .post(format!(
            "{base}/asr?task=transcribe&encode=true&output=json{language}"
        ))
        .multipart(form)
        // CPU-Inferenz darf dauern, aber nicht ewig.
        .timeout(Duration::from_secs(600))
        .send()
        .await
        .context("Whisper-Dienst erreichen")?
        .error_for_status()
        .context("Whisper-Dienst antwortet mit Fehler")?;
    let v: serde_json::Value = res.json().await.context("Whisper-Antwort parsen")?;
    let text = v
        .get("text")
        .and_then(|t| t.as_str())
        .context("Whisper-Antwort ohne text-Feld")?
        .trim()
        .to_string();
    Ok(text)
}
