use axum::extract::ws::{Message as WsMessage, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use sqlx::Row as _;
use tokio::sync::broadcast;

use crate::auth;
use crate::SharedState;

// Push-Kanal für neue Nachrichten: Der Server verteilt jede gespeicherte
// Nachricht über einen Broadcast an alle verbundenen Clients; Kunden
// sehen nur die eigene Konversation, der Operator alle. Gesendet wird
// ausschließlich über REST – der WebSocket ist reine Zustellung, damit
// Validierung und Persistenz an genau einer Stelle liegen.

#[derive(Clone)]
pub struct Event {
    pub conversation_id: i64,
    pub json: String,
}

pub struct Hub {
    tx: broadcast::Sender<Event>,
}

impl Hub {
    pub fn new() -> Self {
        Self {
            tx: broadcast::channel(256).0,
        }
    }

    pub fn publish(&self, conversation_id: i64, json: String) {
        // Err = gerade niemand verbunden, das ist in Ordnung.
        let _ = self.tx.send(Event {
            conversation_id,
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

    // None = Operator sieht alles; sonst nur die eigene Konversation.
    let filter: Option<i64> = if session.role == "operator" {
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

    upgrade.on_upgrade(move |socket| client_loop(socket, state, filter))
}

async fn client_loop(mut socket: WebSocket, state: SharedState, filter: Option<i64>) {
    let mut rx = state.hub.subscribe();
    loop {
        tokio::select! {
            ev = rx.recv() => match ev {
                Ok(ev) => {
                    if filter.is_none_or(|cid| cid == ev.conversation_id)
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
                // Eingehende Frames (Pings beantwortet axum selbst) nur
                // konsumieren, gesendet wird über REST.
                Some(Ok(_)) => continue,
                _ => break,
            },
        }
    }
}
