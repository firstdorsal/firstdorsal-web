use std::time::Duration;

use axum::extract::{DefaultBodyLimit, Multipart, Path, Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{Html, IntoResponse, Redirect, Response};
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::sqlite::SqliteRow;
use sqlx::Row as _;

use crate::auth::{self, Session};
use crate::db::now;
use crate::SharedState;

// REST-API des Chats. Kundenrouten sind implizit auf die eigene
// Konversation beschränkt (eine je Kunde), Admin-Routen verlangen eine
// Operator-Session (Allowlist OPERATOR_EMAILS).

pub fn router(state: SharedState) -> Router {
    Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/chat/login", get(login))
        .route("/chat/ws", get(crate::ws::handler))
        .route("/chat/api/auth/request", post(auth_request))
        .route("/chat/api/auth/logout", post(logout))
        .route("/chat/api/me", get(me))
        .route("/chat/api/ice", get(ice))
        .route("/chat/api/messages", get(customer_messages).post(customer_send))
        .route("/chat/api/messages/media", post(customer_send_media))
        .route("/chat/api/attachments/{id}", get(get_attachment))
        .route("/chat/api/admin/conversations", get(admin_conversations))
        .route(
            "/chat/api/admin/conversations/{id}/messages",
            get(admin_messages).post(admin_send),
        )
        .route("/chat/api/admin/conversations/{id}/media", post(admin_send_media))
        .route("/chat/api/admin/conversations/{id}", delete(admin_delete))
        // Nur in Tests aktiv (E2E_SEED=1): füllt eine Konversation mit
        // vielen Nachrichten inkl. Medien für die Performance-Tests.
        .route("/chat/api/test/seed", post(seed))
        // Uploads bis MAX_UPLOAD_BYTES (Videos!), plus Multipart-Overhead.
        .layer(DefaultBodyLimit::max(MAX_UPLOAD_BYTES + 1024 * 1024))
        .with_state(state)
}

// Obergrenze für jeden Upload – großzügig genug für kurze Videos. Wer
// größere Dateien teilen muss, lädt sie extern hoch und schickt den Link.
const MAX_UPLOAD_BYTES: usize = 100 * 1024 * 1024;

// Art eines Anhangs aus dem MIME-Typ ableiten. Alles ist erlaubt; die
// Kategorie steuert nur die Darstellung (Bild/Audio/Video inline,
// alles andere als Download). SVG zählt bewusst als generische Datei
// (kann Skripte enthalten – wird deshalb nie inline gerendert).
fn attachment_kind(mime: &str) -> &'static str {
    match mime {
        "image/svg+xml" => "file",
        m if m.starts_with("image/") => "image",
        m if m.starts_with("audio/") => "voice",
        m if m.starts_with("video/") => "video",
        _ => "file",
    }
}

/// Anhänge dürfen nur dann im Browser dargestellt werden (inline), wenn
/// das gefahrlos ist – sonst erzwingt der Download-Header die Speicherung.
fn inline_safe(mime: &str) -> bool {
    mime == "application/pdf"
        || (mime != "image/svg+xml"
            && (mime.starts_with("image/")
                || mime.starts_with("audio/")
                || mime.starts_with("video/")))
}

/// Dateiname auf einen Zeilen-tauglichen, harmlosen Rest reduzieren.
fn sanitize_filename(name: &str) -> String {
    let base = name.rsplit(['/', '\\']).next().unwrap_or(name);
    let cleaned: String = base
        .chars()
        .filter(|c| !c.is_control() && *c != '"')
        .take(200)
        .collect();
    if cleaned.trim().is_empty() {
        "datei".to_string()
    } else {
        cleaned
    }
}

// Fehler als knappes JSON; interne Fehler landen im Log, nicht beim Client.
struct ApiError(StatusCode, &'static str);

type ApiResult<T> = Result<T, ApiError>;

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({ "error": self.1 }))).into_response()
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(e: sqlx::Error) -> Self {
        tracing::error!("DB-Fehler: {e:#}");
        ApiError(StatusCode::INTERNAL_SERVER_ERROR, "internal")
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(e: anyhow::Error) -> Self {
        tracing::error!("interner Fehler: {e:#}");
        ApiError(StatusCode::INTERNAL_SERVER_ERROR, "internal")
    }
}

const UNAUTHORIZED: ApiError = ApiError(StatusCode::UNAUTHORIZED, "unauthorized");

async fn require_operator(state: &SharedState, headers: &HeaderMap) -> ApiResult<Session> {
    match auth::session_from_headers(&state.db, headers).await {
        Some(s) if s.role == "operator" => Ok(s),
        _ => Err(UNAUTHORIZED),
    }
}

/// Kunden-Session inklusive der zugehörigen Konversations-Id.
async fn require_customer(state: &SharedState, headers: &HeaderMap) -> ApiResult<(Session, i64)> {
    let session = auth::session_from_headers(&state.db, headers)
        .await
        .ok_or(UNAUTHORIZED)?;
    if session.role != "customer" {
        return Err(UNAUTHORIZED);
    }
    let row = sqlx::query("SELECT id FROM conversations WHERE customer_id = ?")
        .bind(session.customer_id.unwrap_or(-1))
        .fetch_optional(&state.db)
        .await?
        .ok_or(UNAUTHORIZED)?;
    let conversation_id: i64 = row.get("id");
    Ok((session, conversation_id))
}

// ---------- Auth ----------

#[derive(Deserialize)]
struct AuthRequest {
    email: String,
    #[serde(default)]
    lang: String,
}

async fn auth_request(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Json(req): Json<AuthRequest>,
) -> ApiResult<Json<Value>> {
    let email = req.email.trim().to_ascii_lowercase();
    if !auth::valid_email(&email) {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY, "invalid_email"));
    }
    let lang = if req.lang == "en" { "en" } else { "de" };

    // Rate-Limits gegen Mail-Bombing: pro Adresse und pro Client-IP
    // (X-Forwarded-For setzt Traefik).
    let ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .unwrap_or("unbekannt")
        .trim()
        .to_string();
    let window = Duration::from_secs(15 * 60);
    if !state.limiter.allow(&format!("email:{email}"), 3, window)
        || !state.limiter.allow(&format!("ip:{ip}"), 12, window)
    {
        return Err(ApiError(StatusCode::TOO_MANY_REQUESTS, "rate_limited"));
    }

    let purpose = if state.cfg.is_operator(&email) {
        "operator"
    } else {
        "customer"
    };
    let token = auth::new_token();
    sqlx::query(
        "INSERT INTO magic_links (email, purpose, lang, token_hash, created_at, expires_at) \
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&email)
    .bind(purpose)
    .bind(lang)
    .bind(auth::token_hash(&token))
    .bind(now())
    .bind(now() + auth::MAGIC_LINK_TTL)
    .execute(&state.db)
    .await?;

    let link = format!("{}/chat/login?token={token}", state.cfg.public_url);
    state
        .mailer
        .send_magic_link(&email, &link, lang)
        .await
        .map_err(|e| {
            tracing::error!("Mailversand an {email}: {e:#}");
            ApiError(StatusCode::BAD_GATEWAY, "mail_failed")
        })?;
    Ok(Json(json!({ "ok": true })))
}

#[derive(Deserialize)]
struct LoginQuery {
    token: String,
}

// Knappe zweisprachige Hinweisseite für abgelaufene/benutzte Links –
// bewusst ohne Layout, der Nutzer soll einfach neu anfordern.
const LINK_INVALID_HTML: &str = "<!doctype html><html lang=\"de\"><meta charset=\"utf-8\">\
<title>Link ungültig – firstdorsal</title>\
<body style=\"font-family:system-ui;max-width:36rem;margin:4rem auto;padding:0 1rem\">\
<h1>Link ungültig oder abgelaufen</h1>\
<p>Bitte fordern Sie im Chat auf <a href=\"/\">firstdorsal.eu</a> einen neuen Anmeldelink an.</p>\
<p lang=\"en\"><em>This sign-in link is invalid or has expired. Please request a new one \
in the chat at <a href=\"/en/\">firstdorsal.eu/en/</a>.</em></p></body></html>";

async fn login(
    State(state): State<SharedState>,
    Query(q): Query<LoginQuery>,
) -> ApiResult<Response> {
    let row = sqlx::query(
        "SELECT id, email, purpose, lang FROM magic_links \
         WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?",
    )
    .bind(auth::token_hash(&q.token))
    .bind(now())
    .fetch_optional(&state.db)
    .await?;
    let Some(row) = row else {
        return Ok((StatusCode::GONE, Html(LINK_INVALID_HTML)).into_response());
    };
    let (link_id, email, purpose, lang): (i64, String, String, String) = (
        row.get("id"),
        row.get("email"),
        row.get("purpose"),
        row.get("lang"),
    );
    sqlx::query("UPDATE magic_links SET used_at = ? WHERE id = ?")
        .bind(now())
        .bind(link_id)
        .execute(&state.db)
        .await?;

    let (customer_id, redirect) = if purpose == "operator" {
        (None, "/chat/admin/".to_string())
    } else {
        // Kunde und Konversation beim ersten Login anlegen.
        sqlx::query(
            "INSERT INTO customers (email, created_at, last_seen_at) VALUES (?, ?, ?) \
             ON CONFLICT(email) DO UPDATE SET last_seen_at = excluded.last_seen_at",
        )
        .bind(&email)
        .bind(now())
        .bind(now())
        .execute(&state.db)
        .await?;
        let customer_id: i64 = sqlx::query("SELECT id FROM customers WHERE email = ?")
            .bind(&email)
            .fetch_one(&state.db)
            .await?
            .get("id");
        sqlx::query("INSERT OR IGNORE INTO conversations (customer_id, created_at) VALUES (?, ?)")
            .bind(customer_id)
            .bind(now())
            .execute(&state.db)
            .await?;
        // Zurück auf die Seite, das Widget öffnet sich über ?chat=open.
        let target = if lang == "en" { "/en/?chat=open" } else { "/?chat=open" };
        (Some(customer_id), target.to_string())
    };

    let token = auth::create_session(&state.db, &purpose, &email, customer_id).await?;
    let cookie = auth::session_cookie(&token, state.cfg.cookie_secure, auth::SESSION_TTL);
    Ok(([(header::SET_COOKIE, cookie)], Redirect::to(&redirect)).into_response())
}

async fn logout(State(state): State<SharedState>, headers: HeaderMap) -> ApiResult<Response> {
    auth::delete_session(&state.db, &headers).await;
    let cookie = auth::session_cookie("", state.cfg.cookie_secure, 0);
    Ok(([(header::SET_COOKIE, cookie)], Json(json!({ "ok": true }))).into_response())
}

async fn me(State(state): State<SharedState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let session = auth::session_from_headers(&state.db, &headers)
        .await
        .ok_or(UNAUTHORIZED)?;
    Ok(Json(json!({ "role": session.role, "email": session.email })))
}

/// ICE-Server (STUN/TURN) für die WebRTC-Anrufe – nur für Angemeldete,
/// da die TURN-Zugangsdaten zeitlich begrenzt mitgeliefert werden.
async fn ice(State(state): State<SharedState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    auth::session_from_headers(&state.db, &headers)
        .await
        .ok_or(UNAUTHORIZED)?;
    Ok(Json(crate::turn::ice_servers(&state.cfg)))
}

// ---------- Nachrichten ----------

fn message_json(row: &SqliteRow) -> Value {
    // LEFT JOIN auf attachments: a_id NULL = reine Textnachricht.
    let attachment = row
        .get::<Option<i64>, _>("a_id")
        .map(|a_id| {
            json!({
                "id": a_id,
                "kind": row.get::<String, _>("a_kind"),
                "mime": row.get::<String, _>("a_mime"),
                "size": row.get::<i64, _>("a_size"),
                "filename": row.get::<Option<String>, _>("a_filename"),
                "transcript": row.get::<Option<String>, _>("a_transcript"),
                "transcript_status": row.get::<Option<String>, _>("a_status"),
            })
        })
        .unwrap_or(Value::Null);
    json!({
        "id": row.get::<i64, _>("id"),
        "conversation_id": row.get::<i64, _>("conversation_id"),
        "sender": row.get::<String, _>("sender"),
        "kind": row.get::<String, _>("kind"),
        "body_text": row.get::<Option<String>, _>("body_text"),
        "created_at": row.get::<i64, _>("created_at"),
        "attachment": attachment,
    })
}

const MESSAGE_SELECT: &str = "SELECT m.id, m.conversation_id, m.sender, m.kind, m.body_text, \
            m.created_at, a.id AS a_id, a.kind AS a_kind, a.mime AS a_mime, a.size AS a_size, \
            a.filename AS a_filename, a.transcript AS a_transcript, a.transcript_status AS a_status \
     FROM messages m LEFT JOIN attachments a ON a.id = m.attachment_id";

// Cursor-Pagination für endloses Scrollen: ohne `before` die neuesten
// `limit` Nachrichten, mit `before` die nächstälteren davor. Zurück
// kommt immer aufsteigend (älteste zuerst), damit der Client sie oben
// voranstellen kann.
const PAGE_DEFAULT: i64 = 30;
const PAGE_MAX: i64 = 100;

#[derive(Deserialize)]
struct Page {
    before: Option<i64>,
    limit: Option<i64>,
}

async fn list_messages(
    state: &SharedState,
    conversation_id: i64,
    page: &Page,
) -> ApiResult<Json<Value>> {
    let limit = page.limit.unwrap_or(PAGE_DEFAULT).clamp(1, PAGE_MAX);
    let before = page.before.unwrap_or(i64::MAX);
    let mut rows = sqlx::query(&format!(
        "{MESSAGE_SELECT} WHERE m.conversation_id = ? AND m.id < ? ORDER BY m.id DESC LIMIT ?"
    ))
    .bind(conversation_id)
    .bind(before)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;
    rows.reverse(); // DESC geladen, aufsteigend zurückgeben
    Ok(Json(Value::Array(rows.iter().map(message_json).collect())))
}

/// Persistiert eine Textnachricht und verteilt sie über den Hub.
async fn insert_message(
    state: &SharedState,
    conversation_id: i64,
    sender: &str,
    text: &str,
) -> ApiResult<Value> {
    let text = text.trim();
    if text.is_empty() || text.chars().count() > 4000 {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY, "invalid_text"));
    }
    let created_at = now();
    let id = sqlx::query(
        "INSERT INTO messages (conversation_id, sender, kind, body_text, created_at) \
         VALUES (?, ?, 'text', ?, ?)",
    )
    .bind(conversation_id)
    .bind(sender)
    .bind(text)
    .bind(created_at)
    .execute(&state.db)
    .await?
    .last_insert_rowid();
    sqlx::query("UPDATE conversations SET last_message_at = ? WHERE id = ?")
        .bind(created_at)
        .bind(conversation_id)
        .execute(&state.db)
        .await?;

    let msg = json!({
        "id": id,
        "conversation_id": conversation_id,
        "sender": sender,
        "kind": "text",
        "body_text": text,
        "created_at": created_at,
        "attachment": Value::Null,
    });
    state
        .hub
        .publish(conversation_id, json!({ "type": "message", "message": msg }).to_string());
    Ok(msg)
}

/// Nimmt das Multipart-Feld "file" an, legt den Blob content-addressed
/// unter DATA_DIR/uploads ab und hängt ihn als Bild-, Sprach-, Video-
/// oder generische Dateinachricht an die Konversation. Sprachnachrichten
/// gehen anschließend asynchron zur Transkription.
async fn save_media(
    state: &SharedState,
    conversation_id: i64,
    sender: &str,
    mut multipart: Multipart,
) -> ApiResult<Value> {
    let field = loop {
        match multipart.next_field().await {
            Ok(Some(f)) if f.name() == Some("file") => break f,
            Ok(Some(_)) => continue,
            _ => return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY, "missing_file")),
        }
    };
    let filename = field.file_name().map(sanitize_filename);
    // MediaRecorder liefert z. B. "audio/webm;codecs=opus" – für die
    // Kategorie zählt der Basistyp; fehlt er, generische Datei.
    let mime_full = field.content_type().unwrap_or("").to_string();
    let mut mime = mime_full.split(';').next().unwrap_or("").trim().to_string();
    if mime.is_empty() {
        mime = "application/octet-stream".to_string();
    }
    let kind = attachment_kind(&mime);
    let bytes = field
        .bytes()
        .await
        .map_err(|_| ApiError(StatusCode::PAYLOAD_TOO_LARGE, "too_large"))?;
    if bytes.is_empty() || bytes.len() > MAX_UPLOAD_BYTES {
        return Err(ApiError(StatusCode::PAYLOAD_TOO_LARGE, "too_large"));
    }

    let sha256: String = {
        use sha2::{Digest, Sha256};
        Sha256::digest(&bytes).iter().map(|b| format!("{b:02x}")).collect()
    };
    let uploads = state.cfg.data_dir.join("uploads");
    tokio::fs::create_dir_all(&uploads)
        .await
        .map_err(|e| ApiError::from(anyhow::Error::from(e)))?;
    let blob_path = uploads.join(&sha256);
    if tokio::fs::metadata(&blob_path).await.is_err() {
        tokio::fs::write(&blob_path, &bytes)
            .await
            .map_err(|e| ApiError::from(anyhow::Error::from(e)))?;
    }

    // Transkription nur, wenn ein Whisper-Dienst konfiguriert ist.
    let transcript_status = (kind == "voice" && state.cfg.whisper_url.is_some()).then_some("pending");
    let created_at = now();
    let attachment_id = sqlx::query(
        "INSERT INTO attachments (kind, mime, size, sha256, filename, transcript_status, created_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(kind)
    .bind(&mime)
    .bind(bytes.len() as i64)
    .bind(&sha256)
    .bind(&filename)
    .bind(transcript_status)
    .bind(created_at)
    .execute(&state.db)
    .await?
    .last_insert_rowid();
    let message_id = sqlx::query(
        "INSERT INTO messages (conversation_id, sender, kind, attachment_id, created_at) \
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(conversation_id)
    .bind(sender)
    .bind(kind)
    .bind(attachment_id)
    .bind(created_at)
    .execute(&state.db)
    .await?
    .last_insert_rowid();
    sqlx::query("UPDATE conversations SET last_message_at = ? WHERE id = ?")
        .bind(created_at)
        .bind(conversation_id)
        .execute(&state.db)
        .await?;

    let msg = json!({
        "id": message_id,
        "conversation_id": conversation_id,
        "sender": sender,
        "kind": kind,
        "body_text": Value::Null,
        "created_at": created_at,
        "attachment": {
            "id": attachment_id,
            "kind": kind,
            "mime": mime,
            "size": bytes.len(),
            "filename": filename,
            "transcript": Value::Null,
            "transcript_status": transcript_status,
        },
    });
    state
        .hub
        .publish(conversation_id, json!({ "type": "message", "message": msg }).to_string());

    if transcript_status.is_some() {
        crate::whisper::spawn_transcription(
            state.clone(),
            attachment_id,
            message_id,
            conversation_id,
            blob_path,
            mime_full,
        );
    }
    Ok(msg)
}

/// Liefert einen Upload aus – Kunden nur aus der eigenen Konversation.
async fn get_attachment(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Path(id): Path<i64>,
) -> ApiResult<Response> {
    let session = auth::session_from_headers(&state.db, &headers)
        .await
        .ok_or(UNAUTHORIZED)?;
    let row = sqlx::query(
        "SELECT a.mime, a.sha256, a.filename, m.conversation_id FROM attachments a \
         JOIN messages m ON m.attachment_id = a.id WHERE a.id = ?",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(ApiError(StatusCode::NOT_FOUND, "not_found"))?;
    if session.role != "operator" {
        let own = sqlx::query("SELECT id FROM conversations WHERE customer_id = ?")
            .bind(session.customer_id.unwrap_or(-1))
            .fetch_optional(&state.db)
            .await?
            .map(|r| r.get::<i64, _>("id"));
        if own != Some(row.get::<i64, _>("conversation_id")) {
            return Err(ApiError(StatusCode::NOT_FOUND, "not_found"));
        }
    }
    let mime: String = row.get("mime");
    let sha256: String = row.get("sha256");
    let filename: Option<String> = row.get("filename");
    // Nur gefahrlose Medientypen inline anzeigen; alles andere als
    // Download erzwingen (verhindert z. B. HTML/SVG-XSS aus Uploads).
    let name = filename.as_deref().map(sanitize_filename).unwrap_or_else(|| "datei".into());
    let disposition = if inline_safe(&mime) {
        format!("inline; filename=\"{name}\"")
    } else {
        format!("attachment; filename=\"{name}\"")
    };
    // application/octet-stream verhindert MIME-Sniffing für unsichere Typen.
    let served_mime = if inline_safe(&mime) { mime } else { "application/octet-stream".to_string() };
    let bytes = tokio::fs::read(state.cfg.data_dir.join("uploads").join(&sha256))
        .await
        .map_err(|e| ApiError::from(anyhow::Error::from(e)))?;
    Ok((
        [
            (header::CONTENT_TYPE, served_mime),
            (header::CONTENT_DISPOSITION, disposition),
            // Content-addressed: darf der Browser dauerhaft (privat) cachen.
            (header::CACHE_CONTROL, "private, max-age=31536000, immutable".to_string()),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff".to_string()),
        ],
        bytes,
    )
        .into_response())
}

#[derive(Deserialize)]
struct SendBody {
    text: String,
}

async fn customer_messages(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Query(page): Query<Page>,
) -> ApiResult<Json<Value>> {
    let (_, conversation_id) = require_customer(&state, &headers).await?;
    // Beim Erstabruf (ohne Cursor) gelten Operator-Nachrichten als gelesen.
    if page.before.is_none() {
        sqlx::query(
            "UPDATE messages SET read_at = ? \
             WHERE conversation_id = ? AND sender = 'operator' AND read_at IS NULL",
        )
        .bind(now())
        .bind(conversation_id)
        .execute(&state.db)
        .await?;
    }
    list_messages(&state, conversation_id, &page).await
}

async fn customer_send(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Json(body): Json<SendBody>,
) -> ApiResult<Json<Value>> {
    let (_, conversation_id) = require_customer(&state, &headers).await?;
    let msg = insert_message(&state, conversation_id, "customer", &body.text).await?;
    Ok(Json(msg))
}

async fn customer_send_media(
    State(state): State<SharedState>,
    headers: HeaderMap,
    multipart: Multipart,
) -> ApiResult<Json<Value>> {
    let (_, conversation_id) = require_customer(&state, &headers).await?;
    let msg = save_media(&state, conversation_id, "customer", multipart).await?;
    Ok(Json(msg))
}

// ---------- Admin ----------

async fn admin_conversations(
    State(state): State<SharedState>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    require_operator(&state, &headers).await?;
    let rows = sqlx::query(
        "SELECT c.id, cu.email, c.created_at, c.last_message_at, \
                (SELECT COUNT(*) FROM messages m \
                  WHERE m.conversation_id = c.id AND m.sender = 'customer' \
                    AND m.read_at IS NULL) AS unread, \
                (SELECT m.body_text FROM messages m \
                  WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_text \
         FROM conversations c JOIN customers cu ON cu.id = c.customer_id \
         ORDER BY COALESCE(c.last_message_at, c.created_at) DESC",
    )
    .fetch_all(&state.db)
    .await?;
    let list: Vec<Value> = rows
        .iter()
        .map(|row| {
            json!({
                "id": row.get::<i64, _>("id"),
                "email": row.get::<String, _>("email"),
                "created_at": row.get::<i64, _>("created_at"),
                "last_message_at": row.get::<Option<i64>, _>("last_message_at"),
                "unread": row.get::<i64, _>("unread"),
                "last_text": row.get::<Option<String>, _>("last_text"),
            })
        })
        .collect();
    Ok(Json(Value::Array(list)))
}

async fn conversation_exists(state: &SharedState, id: i64) -> ApiResult<()> {
    sqlx::query("SELECT id FROM conversations WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .map(|_| ())
        .ok_or(ApiError(StatusCode::NOT_FOUND, "not_found"))
}

async fn admin_messages(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Path(id): Path<i64>,
    Query(page): Query<Page>,
) -> ApiResult<Json<Value>> {
    require_operator(&state, &headers).await?;
    conversation_exists(&state, id).await?;
    // Beim Erstabruf (ohne Cursor) gelten Kunden-Nachrichten als gelesen.
    if page.before.is_none() {
        sqlx::query(
            "UPDATE messages SET read_at = ? \
             WHERE conversation_id = ? AND sender = 'customer' AND read_at IS NULL",
        )
        .bind(now())
        .bind(id)
        .execute(&state.db)
        .await?;
    }
    list_messages(&state, id, &page).await
}

async fn admin_send(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Path(id): Path<i64>,
    Json(body): Json<SendBody>,
) -> ApiResult<Json<Value>> {
    require_operator(&state, &headers).await?;
    conversation_exists(&state, id).await?;
    let msg = insert_message(&state, id, "operator", &body.text).await?;
    Ok(Json(msg))
}

async fn admin_send_media(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Path(id): Path<i64>,
    multipart: Multipart,
) -> ApiResult<Json<Value>> {
    require_operator(&state, &headers).await?;
    conversation_exists(&state, id).await?;
    let msg = save_media(&state, id, "operator", multipart).await?;
    Ok(Json(msg))
}

// ---------- Test-Seed (nur mit E2E_SEED=1) ----------

#[derive(Deserialize)]
struct SeedBody {
    email: String,
    count: i64,
}

// 1x1-PNG und winziges Datenstück als geteilte Blobs – die Performance-
// Tests prüfen die Virtualisierung der Liste, nicht die Medieninhalte.
const SEED_PNG: &[u8] = &[
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0xfc, 0xcf, 0xc0, 0x50,
    0x0f, 0x00, 0x04, 0x85, 0x01, 0x80, 0x84, 0xa9, 0x8c, 0x21, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
    0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
];

async fn write_seed_blob(state: &SharedState, bytes: &[u8]) -> ApiResult<String> {
    let sha256: String = {
        use sha2::{Digest, Sha256};
        Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect()
    };
    let uploads = state.cfg.data_dir.join("uploads");
    tokio::fs::create_dir_all(&uploads)
        .await
        .map_err(|e| ApiError::from(anyhow::Error::from(e)))?;
    tokio::fs::write(uploads.join(&sha256), bytes)
        .await
        .map_err(|e| ApiError::from(anyhow::Error::from(e)))?;
    Ok(sha256)
}

/// Füllt die Konversation einer (Test-)Adresse mit `count` Nachrichten:
/// abwechselnd Text, Bild und Video, damit die virtualisierte Liste mit
/// gemischten Höhen unter Last getestet wird. Bild und Video teilen sich
/// je einen Blob.
async fn seed(
    State(state): State<SharedState>,
    Json(body): Json<SeedBody>,
) -> ApiResult<Json<Value>> {
    if !state.cfg.seed_enabled {
        return Err(ApiError(StatusCode::NOT_FOUND, "not_found"));
    }
    let email = body.email.trim().to_ascii_lowercase();
    let count = body.count.clamp(1, 10_000);

    sqlx::query(
        "INSERT INTO customers (email, created_at, last_seen_at) VALUES (?, ?, ?) \
         ON CONFLICT(email) DO NOTHING",
    )
    .bind(&email)
    .bind(now())
    .bind(now())
    .execute(&state.db)
    .await?;
    let customer_id: i64 = sqlx::query("SELECT id FROM customers WHERE email = ?")
        .bind(&email)
        .fetch_one(&state.db)
        .await?
        .get("id");
    sqlx::query("INSERT OR IGNORE INTO conversations (customer_id, created_at) VALUES (?, ?)")
        .bind(customer_id)
        .bind(now())
        .execute(&state.db)
        .await?;
    let conversation_id: i64 = sqlx::query("SELECT id FROM conversations WHERE customer_id = ?")
        .bind(customer_id)
        .fetch_one(&state.db)
        .await?
        .get("id");

    let sha = write_seed_blob(&state, SEED_PNG).await?;
    let img_id: i64 = sqlx::query(
        "INSERT INTO attachments (kind, mime, size, sha256, filename, created_at) \
         VALUES ('image', 'image/png', ?, ?, 'seed.png', ?)",
    )
    .bind(SEED_PNG.len() as i64)
    .bind(&sha)
    .bind(now())
    .execute(&state.db)
    .await?
    .last_insert_rowid();
    // Für „video" denselben Blob als video/mp4 referenzieren (reine
    // Last-/Layout-Probe – der Player rendert die Kachel).
    let vid_id: i64 = sqlx::query(
        "INSERT INTO attachments (kind, mime, size, sha256, filename, created_at) \
         VALUES ('video', 'video/mp4', ?, ?, 'seed.mp4', ?)",
    )
    .bind(SEED_PNG.len() as i64)
    .bind(&sha)
    .bind(now())
    .execute(&state.db)
    .await?
    .last_insert_rowid();

    let mut tx = state.db.begin().await.map_err(ApiError::from)?;
    for i in 0..count {
        let created_at = now();
        let sender = if i % 2 == 0 { "customer" } else { "operator" };
        match i % 3 {
            0 => {
                sqlx::query(
                    "INSERT INTO messages (conversation_id, sender, kind, body_text, created_at) \
                     VALUES (?, ?, 'text', ?, ?)",
                )
                .bind(conversation_id)
                .bind(sender)
                .bind(format!("Seed-Nachricht Nummer {i}"))
                .bind(created_at)
                .execute(&mut *tx)
                .await
                .map_err(ApiError::from)?;
            }
            1 => {
                sqlx::query(
                    "INSERT INTO messages (conversation_id, sender, kind, attachment_id, created_at) \
                     VALUES (?, ?, 'image', ?, ?)",
                )
                .bind(conversation_id)
                .bind(sender)
                .bind(img_id)
                .bind(created_at)
                .execute(&mut *tx)
                .await
                .map_err(ApiError::from)?;
            }
            _ => {
                sqlx::query(
                    "INSERT INTO messages (conversation_id, sender, kind, attachment_id, created_at) \
                     VALUES (?, ?, 'video', ?, ?)",
                )
                .bind(conversation_id)
                .bind(sender)
                .bind(vid_id)
                .bind(created_at)
                .execute(&mut *tx)
                .await
                .map_err(ApiError::from)?;
            }
        }
    }
    tx.commit().await.map_err(ApiError::from)?;
    sqlx::query("UPDATE conversations SET last_message_at = ? WHERE id = ?")
        .bind(now())
        .bind(conversation_id)
        .execute(&state.db)
        .await?;

    Ok(Json(json!({ "conversation_id": conversation_id, "inserted": count })))
}

/// Manuelles Löschen einer Konversation (DSGVO: Löschung auf Anfrage);
/// Nachrichten hängen per ON DELETE CASCADE dran, Attachments und ihre
/// Blobs werden explizit mit entfernt (sofern kein anderes Attachment
/// denselben content-addressed Blob nutzt).
async fn admin_delete(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Path(id): Path<i64>,
) -> ApiResult<Json<Value>> {
    require_operator(&state, &headers).await?;
    conversation_exists(&state, id).await?;

    let attachments = sqlx::query(
        "SELECT a.id, a.sha256 FROM attachments a \
         JOIN messages m ON m.attachment_id = a.id WHERE m.conversation_id = ?",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;
    sqlx::query("DELETE FROM conversations WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await?;
    for row in &attachments {
        let (attachment_id, sha256): (i64, String) = (row.get("id"), row.get("sha256"));
        sqlx::query("DELETE FROM attachments WHERE id = ?")
            .bind(attachment_id)
            .execute(&state.db)
            .await?;
        let verbleibend: i64 = sqlx::query("SELECT COUNT(*) AS n FROM attachments WHERE sha256 = ?")
            .bind(&sha256)
            .fetch_one(&state.db)
            .await?
            .get("n");
        if verbleibend == 0 {
            let _ = tokio::fs::remove_file(state.cfg.data_dir.join("uploads").join(&sha256)).await;
        }
    }
    Ok(Json(json!({ "ok": true })))
}
