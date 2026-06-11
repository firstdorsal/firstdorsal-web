import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { mailAdresse, mailtoHref } from '@/lib/mail'
import type { Lang } from '@/lib/i18n'

const texte = {
  de: { platzhalter: 'E-Mail schreiben' },
  en: { platzhalter: 'Write an email' },
}

// Spam-Scraper-Schutz: Der mailto-Link entsteht erst nach der Hydration im
// Browser; im servergerenderten HTML steht weder Adresse noch mailto.
// Ohne JS führt der Link zur Kontakt-Sektion (dort steht die Adresse
// entity-kodiert im Footer der Seite).
export function MailLink({ lang = 'de' }: { lang?: Lang }) {
  const [href, setHref] = useState<string>()

  useEffect(() => {
    setHref(mailtoHref())
  }, [])

  return (
    <Button size="lg" className="label-caps h-11 px-7 tracking-[0.18em]" asChild>
      <a href={href ?? '#kontakt'}>
        {href ? mailAdresse() : texte[lang].platzhalter}
        <ArrowRight />
      </a>
    </Button>
  )
}
