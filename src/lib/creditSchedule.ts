import { todayLocal } from './format'

/** Прибавляет месяцы к дате, сохраняя день и ограничивая его последним днём месяца. */
export function addMonths(date: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const total = year * 12 + month + months
  const targetYear = Math.floor(total / 12)
  const targetMonth = total % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const paddedMonth = String(targetMonth + 1).padStart(2, '0')
  const paddedDay = String(Math.min(day, lastDay)).padStart(2, '0')
  return `${targetYear}-${paddedMonth}-${paddedDay}`
}

/** Срок в месяцах включая первый и последний платёжи. */
export function termMonthsBetween(first: string, last: string): number {
  const from = /^(\d{4})-(\d{2})/.exec(first)
  const to = /^(\d{4})-(\d{2})/.exec(last)
  if (!from || !to) return 1
  const months = (Number(to[1]) - Number(from[1])) * 12 + (Number(to[2]) - Number(from[2])) + 1
  return Math.max(1, months)
}

/** Дата следующего платежа по графику. Если график закончился — последняя дата. */
export function nextPaymentDate(first: string, termMonths: number, today = todayLocal()): string {
  if (!first || termMonths < 1) return ''
  for (let index = 0; index < termMonths; index += 1) {
    const date = addMonths(first, index)
    if (date >= today) return date
  }
  return addMonths(first, termMonths - 1)
}

export function shortDate(date: string): string {
  if (!date) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(new Date(`${date}T12:00:00`))
}
