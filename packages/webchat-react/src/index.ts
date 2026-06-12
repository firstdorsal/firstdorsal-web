// Öffentliche API des Pakets @webchat/react.
//
// Markenneutrale React-Oberfläche für den webchat-Dienst: das schwebende
// Kunden-Widget, das Operator-Panel sowie die WebRTC-Anruf-Schicht. Der
// Basis-Pfad des Backends ist über configureWebchat() einstellbar
// (Standard `/chat`).

export { ChatWidget, type ChatWidgetProps } from './components/ChatWidget'
export { AdminChat } from './components/AdminChat'
export { CallPanel, type CallHandle } from './components/CallPanel'

export { configureWebchat, getBasePath, type WebchatConfig } from './config'

export type { Lang } from './i18n'

// Datentypen und der REST-/WebSocket-Client – nützlich, wenn ein
// Konsument eigene Oberflächen auf denselben Dienst aufsetzt.
export type {
  ChatRole,
  AttachmentKind,
  ChatAttachment,
  ChatMessage,
  ChatConversation,
  TranscriptEvent,
  SignalMessage,
  Me,
} from './lib/chat'
