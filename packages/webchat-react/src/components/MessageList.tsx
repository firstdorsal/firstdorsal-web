import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

import type { ChatMessage } from '../lib/chat'

// Virtualisierte Nachrichtenliste mit endlosem Scrollen nach oben: Es
// werden nur die sichtbaren Bubbles (plus etwas Überhang) ins DOM
// gerendert, egal wie lang der Verlauf ist – das hält große
// Konversationen mit Bildern/Videos flüssig. Variable Höhen misst der
// Virtualizer dynamisch.
//
// - Beim Scrollen an den Anfang werden ältere Nachrichten nachgeladen
//   (onLoadOlder); die Scrollposition wird über die zuvor oberste
//   Nachricht stabil gehalten (kein Springen).
// - Neue Nachrichten am Ende scrollen automatisch ins Bild, wenn man
//   ohnehin unten steht. `trailing` (z. B. Offline-Outbox) hängt unten an.

export interface TrailingItem {
  key: string
  node: ReactNode
}

const NEAR_TOP_PX = 120
const NEAR_BOTTOM_PX = 120

export function MessageList({
  messages,
  renderMessage,
  hasMore,
  onLoadOlder,
  trailing = [],
  empty,
}: {
  messages: ChatMessage[]
  renderMessage: (m: ChatMessage) => ReactNode
  hasMore: boolean
  onLoadOlder: () => void
  trailing?: TrailingItem[]
  empty?: ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const count = messages.length + trailing.length

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72,
    overscan: 8,
    getItemKey: (index) =>
      index < messages.length ? `m-${messages[index].id}` : trailing[index - messages.length].key,
  })

  // Anker zur Positions-Wahrung beim Voranstellen älterer Nachrichten.
  const loadingOlder = useRef(false)
  const anchorId = useRef<number | null>(null)
  const oldestId = messages[0]?.id ?? null
  const newestId = messages[messages.length - 1]?.id ?? null
  const prevNewestId = useRef<number | null>(null)
  const didInitialScroll = useRef(false)

  function nearBottom(): boolean {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
  }

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop < NEAR_TOP_PX && hasMore && !loadingOlder.current) {
      loadingOlder.current = true
      anchorId.current = oldestId
      onLoadOlder()
    }
  }

  // Nach dem Voranstellen älterer Nachrichten die zuvor oberste Nachricht
  // wieder an den oberen Rand setzen (per Index, robust gegen Messung).
  useLayoutEffect(() => {
    if (!loadingOlder.current || anchorId.current == null) return
    const idx = messages.findIndex((m) => m.id === anchorId.current)
    if (idx > 0) {
      virtualizer.scrollToIndex(idx, { align: 'start' })
      loadingOlder.current = false
      anchorId.current = null
    } else if (idx === 0) {
      // Keine weiteren geladen (z. B. Anfang erreicht) – Flag lösen.
      loadingOlder.current = false
      anchorId.current = null
    }
  }, [oldestId, messages, virtualizer])

  // Erst-Scroll ans Ende + Auto-Scroll bei neuer letzter Nachricht.
  useEffect(() => {
    if (count === 0) return
    if (!didInitialScroll.current) {
      virtualizer.scrollToIndex(count - 1, { align: 'end' })
      didInitialScroll.current = true
      prevNewestId.current = newestId
      return
    }
    const last = trailing.length > 0 || (newestId != null && newestId !== prevNewestId.current)
    if (last && nearBottom()) {
      virtualizer.scrollToIndex(count - 1, { align: 'end' })
    }
    prevNewestId.current = newestId
  }, [count, newestId, trailing.length, virtualizer])

  if (count === 0) {
    return <div className="flex-1 overflow-y-auto px-4 py-3">{empty}</div>
  }

  const items = virtualizer.getVirtualItems()
  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      data-testid="message-scroll"
      // Geladene Nachrichtenzahl (für Tests des endlosen Nachladens).
      data-loaded={messages.length}
      className="flex-1 overflow-y-auto px-4 py-3"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {items.map((vi) => {
          const isMessage = vi.index < messages.length
          return (
            <div
              key={vi.key}
              data-index={vi.index}
              data-testid="msg-row"
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vi.start}px)`,
                paddingBottom: 12,
              }}
            >
              {isMessage
                ? renderMessage(messages[vi.index])
                : trailing[vi.index - messages.length].node}
            </div>
          )
        })}
      </div>
    </div>
  )
}
