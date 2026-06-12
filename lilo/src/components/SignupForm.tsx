import { useState } from "react";

/**
 * "Save the Date"-Anmeldung für den WhatsApp/Telegram-Channel & Mail-Verteiler
 * (Messaging-Säulen aus dem Konzept). Reine UI/Frontend-Demo – ohne Backend
 * wird die Eingabe lokal als "vorgemerkt" bestätigt.
 */
export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!ok) {
      setError("Bitte eine gültige E-Mail eingeben.");
      return;
    }
    setError("");
    setDone(true);
  };

  if (done) {
    return (
      <div className="su su--done" role="status">
        <strong>Du bist dabei.</strong>
        <span>Save the Date ist notiert – wir melden uns laut.</span>
        <style>{css}</style>
      </div>
    );
  }

  return (
    <form className="su" onSubmit={submit} noValidate>
      <label className="su__label" htmlFor="su-email">
        E-Mail für Save&nbsp;the&nbsp;Date
      </label>
      <div className="su__row">
        <input
          id="su-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="du@beispiel.de"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!error}
        />
        <button type="submit">Eintragen</button>
      </div>
      {error ? <p className="su__err">{error}</p> : null}
      <style>{css}</style>
    </form>
  );
}

const css = `
  .su { width: 100%; max-width: 460px; }
  .su__label {
    display: block;
    font-family: "Roboto Mono", monospace;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: #44f72d;
    margin-bottom: 0.7rem;
  }
  .su__row { display: flex; gap: 0.5rem; }
  .su input {
    flex: 1;
    min-width: 0;
    background: #0a0a0c;
    border: 1px solid #2a2832;
    border-radius: 8px;
    padding: 0.85rem 1rem;
    color: #f3f1f6;
    font-family: "Roboto Mono", monospace;
    font-size: 0.95rem;
  }
  .su input:focus {
    outline: none;
    border-color: #742df7;
    box-shadow: 0 0 0 3px rgba(116,45,247,0.25);
  }
  .su button {
    flex: 0 0 auto;
    background: #44f72d;
    color: #06120a;
    border: none;
    border-radius: 8px;
    padding: 0 1.3rem;
    font-family: "Anton", sans-serif;
    font-size: 1rem;
    letter-spacing: 1px;
    text-transform: uppercase;
    cursor: pointer;
    transition: filter 0.2s ease, transform 0.05s ease;
  }
  .su button:hover { filter: brightness(1.1); }
  .su button:active { transform: translateY(1px); }
  .su__err {
    margin: 0.6rem 0 0;
    color: #ff6b6b;
    font-size: 0.8rem;
  }
  .su--done {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 1.1rem 1.3rem;
    border: 1px solid #3a9a38;
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(58,154,56,0.18), rgba(68,247,45,0.06));
  }
  .su--done strong {
    font-family: "Anton", sans-serif;
    font-size: 1.4rem;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #44f72d;
  }
  .su--done span { color: #a7a4b3; font-size: 0.9rem; }
`;
