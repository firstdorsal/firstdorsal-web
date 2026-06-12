use std::sync::atomic::{AtomicU64, Ordering};

use axum::extract::ws::{Message as WsMessage, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use serde_json::{json, Value};
use sqlx::Row as _;
use tokio::sync::broadcast;

use crate::auth;
use crate::SharedState;

// Der WebSocket erfüllt zwei Aufgaben:
//   1. Push neuer Chat-Nachrichten/Transkripte (server-originated,
//      sender_id 0) – gesendet wird der Inhalt selbst weiterhin per REST.
//   2. Relais für die WebRTC-Signalisierung von Sprach-/Videoanrufen:
//      Offer/Answer/ICE-Kandidaten/Call-Steuerung werden zwischen den
//      beiden Teilnehmern einer Konversation weitergereicht (nie an den
//      Absender zurück). Die Medien selbst laufen P2P, nicht über uns.

#[derive(Clone)]
pub struct Event {
    pub conversation_id: i64,
    /// Verbindungs-Id des Absenders; 0 = vom Server, wird an alle
    /// zugestellt. Echte Ids verhindern das Echo zum Absender.
    pub sender_id: u64,
    pub json: String,
}

pub struct Hub {
    tx: broadcast::Sender<Event>,
    next_id: AtomicU64,
}

impl Hub {
    pub fn new() -> Self {
        Self {
            tx: broadcast::channel(256).0,
            // Bei 1 starten, damit 0 dem Server vorbehalten bleibt.
            next_id: AtomicU64::new(1),
        }
    }

    fn next_id(&self) -> u64 {
        self.next_id.fetch_add(1, Ordering::Relaxed)
    }

    /// Server-Nachricht (Chat/Transkript) an alle in der Konversation.
    pub fn publish(&self, conversation_id: i64, json: String) {
        let _ = self.tx.send(Event {
            conversation_id,
            sender_id: 0,
            json,
        });
    }

    /// Signalisierung weiterreichen – an alle in der Konversation außer
    /// den Absender (bei 1:1 also genau die Gegenstelle).
    fn relay(&self, conversation_id: i64, sender_id: u64, json: String) {
        let _ = self.tx.send(Event {
            conversation_id,
            sender_id,
            json,
        });
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Event> {
        self.tx.subscribe()
    }
}

pub async fn handler(
    State(state): State<SharedState>,
    headers: HeaderMap,
    upgrade: WebSocketUpgrade,
) -> Response {
    let Some(session) = auth::session_from_headers(&state.db, &headers).await else {
        return StatusCode::UNAUTHORIZED.into_response();
    };

    let is_operator = session.role == "operator";
    // None = Operator sieht alles; sonst nur die eigene Konversation.
    let filter: Option<i64> = if is_operator {
        None
    } else {
        let row = sqlx::query("SELECT id FROM conversations WHERE customer_id = ?")
            .bind(session.customer_id.unwrap_or(-1))
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten();
        match row {
            Some(row) => Some(row.get::<i64, _>("id")),
            None => return StatusCode::UNAUTHORIZED.into_response(),
        }
    };

    upgrade.on_upgrade(move |socket| client_loop(socket, state, filter, is_operator))
}

async fn client_loop(
    mut socket: WebSocket,
    state: SharedState,
    filter: Option<i64>,
    is_operator: bool,
) {
    let my_id = state.hub.next_id();
    let mut rx = state.hub.subscribe();
    loop {
        tokio::select! {
            ev = rx.recv() => match ev {
                Ok(ev) => {
                    let fuer_mich = filter.is_none_or(|cid| cid == ev.conversation_id)
                        && ev.sender_id != my_id;
                    if fuer_mich
                        && socket.send(WsMessage::Text(ev.json.into())).await.is_err()
                    {
                        break;
                    }
                }
                // Überlauf: Clients laden den Verlauf beim (Re-)Connect
                // ohnehin per REST nach – einfach weitermachen.
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            },
            msg = socket.recv() => match msg {
                // Signalisierungs-Frames der Anruf-Funktion weiterreichen;
                // alles andere (Pings beantwortet axum selbst) ignorieren.
                Some(Ok(WsMessage::Text(text))) => {
                    handle_signal(&state, my_id, filter, is_operator, &text);
                }
                Some(Ok(_)) => continue,
                _ => break,
            },
        }
    }
}

// Eingehende Signalisierung validieren und an die Gegenstelle relayen.
// Kunden dürfen ausschließlich in ihre eigene Konversation signalisieren;
// der Operator gibt die Ziel-Konversation in der Nachricht an.
fn handle_signal(
    state: &SharedState,
    my_id: u64,
    filter: Option<i64>,
    is_operator: bool,
    text: &str,
) {
    let Ok(msg) = serde_json::from_str::<Value>(text) else {
        return;
    };
    if msg.get("type").and_then(Value::as_str) != Some("signal") {
        return;
    }
    let target = match filter {
        // Kunde: immer die eigene Konversation, egal was geschickt wurde.
        Some(cid) => cid,
        // Operator: Konversation aus der Nachricht.
        None if is_operator => match msg.get("conversation_id").and_then(Value::as_i64) {
            Some(cid) => cid,
            None => return,
        },
        None => return,
    };
    // Vom Absender beglaubigte Felder setzen, bevor weitergereicht wird.
    let mut out = msg;
    out["conversation_id"] = json!(target);
    out["from"] = json!(if is_operator { "operator" } else { "customer" });
    state.hub.relay(target, my_id, out.to_string());
}
