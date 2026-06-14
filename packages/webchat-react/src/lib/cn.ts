import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Tailwind-Klassen zusammenführen (Konflikte gewinnt die letzte). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
