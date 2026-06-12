use std::time::Duration;

use axum::extract::{Path, Query, State};
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
        .route("/chat/api/messages", get(customer_messages).post(customer_send))
        .route("/chat/api/admin/conversations", get(admin_conversations))
        .route(
            "/chat/api/admin/conversations/{id}/messages",
            get(admin_messages).post(admin_send),
        )
        .route("/chat/api/admin/conversations/{id}", delete(admin_delete))
        .with_state(state)
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

// ---------- Nachrichten ----------

fn message_json(row: &SqliteRow) -> Value {
    json!({
        "id": row.get::<i64, _>("id"),
        "conversation_id": row.get::<i64, _>("conversation_id"),
        "sender": row.get::<String, _>("sender"),
        "kind": row.get::<String, _>("kind"),
        "body_text": row.get::<Option<String>, _>("body_text"),
        "created_at": row.get::<i64, _>("created_at"),
    })
}

async fn list_messages(state: &SharedState, conversation_id: i64) -> ApiResult<Json<Value>> {
    let rows = sqlx::query(
        "SELECT id, conversation_id, sender, kind, body_text, created_at \
         FROM messages WHERE conversation_id = ? ORDER BY id LIMIT 500",
    )
    .bind(conversation_id)
    .fetch_all(&state.db)
    .await?;
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
    });
    state
        .hub
        .publish(conversation_id, json!({ "type": "message", "message": msg }).to_string());
    Ok(msg)
}

#[derive(Deserialize)]
struct SendBody {
    text: String,
}

async fn customer_messages(
    State(state): State<SharedState>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    let (_, conversation_id) = require_customer(&state, &headers).await?;
    // Operator-Nachrichten gelten mit dem Abruf als gelesen.
    sqlx::query(
        "UPDATE messages SET read_at = ? \
         WHERE conversation_id = ? AND sender = 'operator' AND read_at IS NULL",
    )
    .bind(now())
    .bind(conversation_id)
    .execute(&state.db)
    .await?;
    list_messages(&state, conversation_id).await
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
) -> ApiResult<Json<Value>> {
    require_operator(&state, &headers).await?;
    conversation_exists(&state, id).await?;
    // Kunden-Nachrichten gelten mit dem Abruf als gelesen.
    sqlx::query(
        "UPDATE messages SET read_at = ? \
         WHERE conversation_id = ? AND sender = 'customer' AND read_at IS NULL",
    )
    .bind(now())
    .bind(id)
    .execute(&state.db)
    .await?;
    list_messages(&state, id).await
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

/// Manuelles Löschen einer Konversation (DSGVO: Löschung auf Anfrage);
/// Nachrichten hängen per ON DELETE CASCADE dran.
async fn admin_delete(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Path(id): Path<i64>,
) -> ApiResult<Json<Value>> {
    require_operator(&state, &headers).await?;
    conversation_exists(&state, id).await?;
    sqlx::query("DELETE FROM conversations WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(json!({ "ok": true })))
}
