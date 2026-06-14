// Dünner Binär-Wrapper um die Bibliothek: Konfiguration aus der Umgebung
// lesen und den Dienst betriebsfertig starten. Die gesamte Logik liegt
// in lib.rs, damit der Chat-Dienst auch als Bibliothek in anderen
// Projekten eingebunden werden kann.
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    webchat::run(webchat::Config::from_env()?).await
}
