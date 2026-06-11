import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { mailAdresse } from '@/lib/mail'
import type { Lang } from '@/lib/i18n'

const texte = {
  de: {
    kopieren: 'Adresse kopieren',
    kopiert: 'Adresse kopiert',
    aria: 'E-Mail-Adresse kopieren',
  },
  en: {
    kopieren: 'Copy address',
    kopiert: 'Address copied',
    aria: 'Copy email address',
  },
}

// Fängt die stillen Absprünge von mailto-Links ab: Wer keinen Mail-Client
// konfiguriert hat (Webmail!), kann die Adresse mit einem Klick kopieren.
// Die Adresse wird erst beim Klick zusammengesetzt (Scraper-Schutz) und
// steht weder im HTML noch im aria-Label.
export function CopyMail({
  variant = 'outline',
  lang = 'de',
}: {
  variant?: 'outline' | 'ghost'
  lang?: Lang
}) {
  const t = texte[lang]
  const [kopiert, setKopiert] = useState(false)

  const kopieren = async () => {
    const mail = mailAdresse()
    let ok = false
    try {
      await navigator.clipboard.writeText(mail)
      ok = true
    } catch {
      // Clipboard-API nicht verfügbar (unsicherer Kontext, alte Browser,
      // restriktive Policies) – Fallback über ein unsichtbares Textfeld.
      const feld = document.createElement('textarea')
      feld.value = mail
      feld.setAttribute('readonly', '')
      feld.style.position = 'fixed'
      feld.style.opacity = '0'
      document.body.appendChild(feld)
      feld.select()
      try {
        ok = document.execCommand('copy')
      } catch {
        ok = false
      }
      feld.remove()
    }
    if (ok) {
      setKopiert(true)
      setTimeout(() => setKopiert(false), 2000)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="lg"
      onClick={kopieren}
      className="label-caps h-11 px-7 tracking-[0.18em]"
      aria-label={t.aria}
    >
      {kopiert ? <Check className="text-brand" /> : <Copy />}
      {kopiert ? t.kopiert : t.kopieren}
    </Button>
  )
}
