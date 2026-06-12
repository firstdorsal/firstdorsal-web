import { useEffect, useState } from "react";

/**
 * Live-Countdown zum Festivalstart – "Countdown zum Festival"
 * (Konzept: Vorabkommunikation, Channel-Postings & Mailings).
 */

const TARGET = new Date("2026-08-28T16:00:00+02:00").getTime();

type Parts = { days: number; hours: number; minutes: number; seconds: number };

function diff(): Parts {
  const ms = Math.max(0, TARGET - Date.now());
  const s = Math.floor(ms / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function Countdown() {
  const [t, setT] = useState<Parts>(() => diff());

  useEffect(() => {
    const id = setInterval(() => setT(diff()), 1000);
    return () => clearInterval(id);
  }, []);

  const items: Array<[string, number]> = [
    ["Tage", t.days],
    ["Std", t.hours],
    ["Min", t.minutes],
    ["Sek", t.seconds],
  ];

  return (
    <div className="cd" role="timer" aria-label="Countdown bis zum Festival">
      {items.map(([label, value]) => (
        <div className="cd__cell" key={label}>
          <span className="cd__num">{pad(value)}</span>
          <span className="cd__label">{label}</span>
        </div>
      ))}
      <style>{`
        .cd {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.6rem;
          width: 100%;
        }
        .cd__cell {
          background: linear-gradient(180deg, rgba(116,45,247,0.16), rgba(19,18,23,0.7));
          border: 1px solid #2a2832;
          border-radius: 10px;
          padding: 1.1rem 0.5rem 0.7rem;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .cd__cell::before {
          content: "";
          position: absolute;
          inset: 0 0 auto 0;
          height: 2px;
          background: linear-gradient(90deg, #742df7, #44f72d);
        }
        .cd__num {
          display: block;
          font-family: "Anton", sans-serif;
          font-size: clamp(2.2rem, 9vw, 3.6rem);
          line-height: 1;
          color: #f3f1f6;
          font-variant-numeric: tabular-nums;
          letter-spacing: 1px;
        }
        .cd__label {
          display: block;
          margin-top: 0.45rem;
          font-family: "Roboto Mono", monospace;
          font-size: 0.66rem;
          font-weight: 700;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: #44f72d;
        }
      `}</style>
    </div>
  );
}
