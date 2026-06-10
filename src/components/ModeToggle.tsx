import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'

// Interaktive Insel: schaltet die .dark-Klasse am <html> um und merkt sich die
// Wahl in localStorage. Das initiale Theme setzt das Inline-Skript im Layout
// (verhindert Flackern beim Laden).
export function ModeToggle() {
  const toggle = () => {
    const isDark = document.documentElement.classList.toggle('dark')
    localStorage.setItem('fd-theme', isDark ? 'dark' : 'light')
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label="Hell/Dunkel umschalten"
    >
      <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Hell/Dunkel umschalten</span>
    </Button>
  )
}
