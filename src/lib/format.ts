const MINUS = '\u2212'

function group(value: number, decimals = 0): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(value))
}

/** 12 450 ₽, с копейками при наличии дробной части */
export function money(value: number, options: { sign?: boolean; decimals?: boolean } = {}): string {
  const decimals = options.decimals && !Number.isInteger(value) ? 2 : 0
  const rounded = Number(value.toFixed(decimals))
  const sign = options.sign ? (rounded > 0 ? '+' : rounded < 0 ? MINUS : '') : rounded < 0 ? MINUS : ''
  return `${sign}${group(rounded, decimals)} ₽`
}

/** Крупные суммы компактно: 1,2 млн ₽ */
export function compactMoney(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? MINUS : ''
  if (abs >= 1_000_000) {
    return `${sign}${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(abs / 1_000_000)} млн ₽`
  }
  return `${sign}${group(abs)} ₽`
}

export function percent(part: number, total: number): number {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

export function todayLocal(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export function dateLabel(date: string): string {
  const today = todayLocal()
  if (date === today) return 'Сегодня'
  const yesterday = new Date(new Date(today).getTime() - 86_400_000).toISOString().slice(0, 10)
  if (date === yesterday) return 'Вчера'
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00`))
}

export function longDate(date: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
}
