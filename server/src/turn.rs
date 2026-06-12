use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use hmac::{Hmac, Mac};
use serde_json::{json, Value};
use sha1::Sha1;

use crate::config::Config;
use crate::db::now;

// ICE-Server-Liste für die WebRTC-Anrufe. STUN findet die öffentliche
// Adresse, TURN relayt notfalls die Medien (wenn direkte P2P-Wege durch
// NAT/Firewall blockiert sind). Für TURN nutzt coturn die zeitlich
// begrenzten REST-Zugangsdaten (`use-auth-secret`): username = Ablaufzeit,
// password = base64(HMAC-SHA1(secret, username)). So müssen keine festen
// TURN-Passwörter im Client liegen.
pub fn ice_servers(cfg: &Config) -> Value {
    let mut servers: Vec<Value> = Vec::new();

    if !cfg.stun_urls.is_empty() {
        servers.push(json!({ "urls": cfg.stun_urls }));
    }

    if let Some(secret) = &cfg.turn_secret {
        if !cfg.turn_urls.is_empty() {
            let username = format!("{}", now() + cfg.turn_ttl);
            let credential = hmac_base64(secret, &username);
            servers.push(json!({
                "urls": cfg.turn_urls,
                "username": username,
                "credential": credential,
            }));
        }
    }

    json!({ "iceServers": servers })
}

fn hmac_base64(secret: &str, msg: &str) -> String {
    let mut mac = Hmac::<Sha1>::new_from_slice(secret.as_bytes()).expect("HMAC akzeptiert jede Länge");
    mac.update(msg.as_bytes());
    STANDARD.encode(mac.finalize().into_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rest_credential_ist_deterministisch() {
        let a = hmac_base64("secret", "12345");
        // Reproduzierbar (coturn muss dasselbe errechnen) …
        assert_eq!(a, hmac_base64("secret", "12345"));
        // … hängt aber an Secret und Username …
        assert_ne!(a, hmac_base64("anderes", "12345"));
        assert_ne!(a, hmac_base64("secret", "99999"));
        // … und ist base64 von 20 SHA-1-Bytes (28 Zeichen mit Padding).
        assert_eq!(a.len(), 28);
    }
}
