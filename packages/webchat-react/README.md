# @webchat/react

Markenneutrale React-Oberfläche für den [`webchat`](../../server)-Dienst:
das schwebende **Kunden-Widget**, das **Operator-Panel** und die
**WebRTC-Anruf**-Schicht (Sprache, Video, Screensharing) samt
PWA-Offline-Outbox. Pendant zum wiederverwendbaren Rust-Backend – andere
Projekte können dieselbe Oberfläche einbinden, ohne den Chat neu zu
bauen.

In diesem Monorepo wird das Paket als pnpm-Workspace eingebunden
(`workspace:*`) und sein TypeScript-Quelltext direkt konsumiert; ein
separater Build-Schritt entfällt, weil der Bundler des Hosts
(Astro/Vite) mit transpiliert.

## Verwendung

```tsx
import { ChatWidget } from '@webchat/react'

export default function App() {
  return <ChatWidget lang="de" />
}
```

Das Operator-Panel liegt typischerweise auf einer eigenen, nicht
indizierten Route (clientseitig gerendert):

```tsx
import { AdminChat } from '@webchat/react'

<AdminChat />
```

## Konfiguration

Der Client spricht den Dienst standardmäßig unter Same-Origin `/chat`
an. Ein abweichender Basis-Pfad wird einmalig – vor dem Mounten der
Komponenten – gesetzt:

```ts
import { configureWebchat } from '@webchat/react'

configureWebchat({ basePath: '/support' })
// REST: /support/api/...   WebSocket: wss://<host>/support/ws
```

### `ChatWidget`-Props

| Prop          | Standard          | Bedeutung                                        |
| ------------- | ----------------- | ------------------------------------------------ |
| `lang`        | `'de'`            | Sprache der Oberfläche (`'de'` \| `'en'`).        |
| `brandName`   | `'firstdorsal'`   | Anzeigename des Betreibers bei fremden Nachrichten. |
| `agentName`   | `'Paul'`          | Name des Ansprechpartners im Intro-Text.          |
| `privacyHref` | `'/datenschutz'`  | Ziel des Datenschutz-Links im Einwilligungshinweis. |
| `adminHref`   | `'/chat/admin/'`  | Ziel des Links zur Operator-Verwaltung.           |

## Styling

Die Komponenten sind mit **Tailwind CSS v4** gestaltet und greifen auf
Design-Tokens (CSS-Custom-Properties wie `--color-card`, `--color-brand`
…) zurück. Zwei Voraussetzungen im konsumierenden Projekt:

1. **Tokens bereitstellen.** Entweder über das eigene Theme oder das
   mitgelieferte Basis-Theme:

   ```css
   @import 'tailwindcss';
   @import '@webchat/react/theme.css';
   ```

2. **Quelldateien scannen**, damit Tailwind die genutzten Klassen
   erzeugt (Pakete unter `node_modules` werden sonst übersprungen):

   ```css
   @source '../node_modules/@webchat/react/src';
   ```

## Peer-Abhängigkeiten

`react` und `react-dom` (jeweils ≥ 19) stellt das einbindende Projekt.
