/**
 * Разбор текста банковской выписки Т-Банка.
 * Чистый модуль без DOM и Node API — используется и в мини-приложении, и в боте.
 */

export type ParsedType = 'income' | 'expense' | 'saving'

export interface ParsedRow {
  date: string
  amount: number
  type: ParsedType
  description: string
  cardLast4: string
  categoryKey: string
  suggestedSkip: boolean
  skipReason?: string
  sourceId: string
}

export interface ParsedStatement {
  rows: ParsedRow[]
  warnings: string[]
  declaredExpense: Record<string, number>
}

interface DraftRow extends Omit<ParsedRow, 'sourceId'> {
  rawDescription: string
}

const NOISE = [
  /^Дата и время/i,
  /^операции\b/i,
  /^обработки\b/i,
  /^Описание\b/i,
  /^Сумма\b/i,
  /^в валюте/i,
  /^Выписка по/i,
  /^Баланс на/i,
  /^Лимит кубышки/i,
  /^•/,
  /^Долг по кубышке/i,
  /^Штраф за просрочку/i,
  /^Плата за кубышку/i,
  /^Пополнения кубышки/i,
  /^Расходы из кубышки/i,
  /^Расходы:/i,
  /^Страница\b/i,
  /^\d+$/,
]

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function parseAmount(value: string): number {
  const normalized = value
    .replace(/\s/g, '')
    .replace(/\u00a0/g, '')
    .replace(',', '.')
    .replace(/^\+/, '')
  return Math.round(Number(normalized) * 100) / 100
}

function toIsoDate(day: string, month: string, year: string): string {
  return `20${year}-${month}-${day}`
}

function hash(input: string): string {
  let value = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return (value >>> 0).toString(36)
}

function categoryKey(description: string, type: ParsedType): string {
  const text = description.toLowerCase()
  if (type === 'income') {
    if (/зарплат|аванс/.test(text)) return 'salary'
    if (/подработ|фриланс/.test(text)) return 'freelance'
    if (/подар/.test(text)) return 'gift'
    return 'other-income'
  }
  if (/магнит|пятёрочка|пятерочка|перекресток|ермолино|алатырь|овощ|продукт|шаурма|вкусвилл|лента|ашан|дикси|самокат/.test(text)) {
    return 'food'
  }
  if (/такси|транспорт|bilet|метро|tpp|бензин|азс|лукойл|газпромнефть/.test(text)) {
    return 'transport'
  }
  if (/аптек|здоров|клиник|медиц|стомат/.test(text)) return 'health'
  if (/кафе|бар|ресторан|кофе|coffee|pizza|пицц/.test(text)) return 'food'
  if (/маркет|покупк|ozon|wildberries|яндекс маркет|shop|store/.test(text)) return 'shopping'
  if (/gamer|steam|игр|кино|театр|досуг|развлеч/.test(text)) return 'fun'
  if (/связь|mts|мтс|билайн|мегафон|теле2|интернет|topup|моб\.? ?связ/.test(text)) return 'home'
  if (/аренда|квартир|жкх|коммунал|управляющ|дом/.test(text)) return 'home'
  return 'other-expense'
}

function skipInfo(description: string, section: 'card' | 'saving'): { skip: boolean; reason?: string } {
  if (section === 'saving') {
    return { skip: true, reason: 'Операция по кубышке — перенесите в цель вручную' }
  }
  if (/кубышк/i.test(description)) {
    return { skip: true, reason: 'Перевод между картой и кубышкой' }
  }
  if (/^(Внутренний перевод|Перевод с договора)/i.test(description)) {
    return { skip: true, reason: 'Перевод между своими счетами' }
  }
  if (/^Внешний перевод по номеру телефона/i.test(description)) {
    return { skip: true, reason: 'Перевод по номеру телефона — проверьте' }
  }
  return { skip: false }
}

/**
 * Возвращает строки операций и предупреждения. Строки с suggestedSkip всё равно
 * попадают в результат: в интерфейсе их можно показать и при желании включить.
 */
export function parseStatementText(raw: string): ParsedStatement {
  const rows: DraftRow[] = []
  const warnings: string[] = []
  const declaredExpense: Record<string, number> = {}
  const computedExpense: Record<string, number> = {}

  let section: 'card' | 'saving' = 'card'
  let last4 = ''
  let current: DraftRow | null = null

  const lines = raw.replace(/\r/g, '').replace(/\f/g, '\n').split('\n')

  for (const original of lines) {
    const line = original.replace(/\u00a0/g, ' ').trimEnd()
    const trimmed = line.trim()
    if (!trimmed) {
      current = null
      continue
    }

    const cardHeader = trimmed.match(/Операции по карте №\s*\d+\*+(\d{4})/i)
    if (cardHeader) {
      section = 'card'
      last4 = cardHeader[1]
      current = null
      continue
    }

    if (/^Выписка по кубышке$/i.test(trimmed)) {
      section = 'saving'
      current = null
      continue
    }

    const declared = trimmed.match(/^Расходы:\s*([\d\s\u00a0]+[.,]\d{2})\s*₽/i)
    if (declared) {
      if (last4) declaredExpense[last4] = parseAmount(declared[1])
      current = null
      continue
    }

    const row = line.match(
      /^\s*(\d{2})\.(\d{2})\.(\d{2})(?:\s+(\d{2}):(\d{2}))?\s+(\d{2})\.(\d{2})\.(\d{2})\s+(.*)$/,
    )

    if (row) {
      const rest = row[9]
      const amounts = rest.match(
        /^(.*?)\s+([+-]?)\s*(\d{1,3}(?:[ \u00a0]\d{3})*[.,]\d{2})\s*₽\s+([+-]?)\s*(\d{1,3}(?:[ \u00a0]\d{3})*[.,]\d{2})\s*₽\s*$/,
      )
      if (!amounts) {
        warnings.push(`Не удалось разобрать сумму: ${trimmed}`)
        current = null
        continue
      }

      const description = clean(amounts[1])
      const signedAmount = `${amounts[2]}${amounts[3]}`
      const type: ParsedType = section === 'saving' ? 'saving' : amounts[2] === '+' ? 'income' : 'expense'
      const amount = parseAmount(signedAmount)
      if (!description || !Number.isFinite(amount) || amount <= 0) {
        warnings.push(`Пропущена строка с некорректной суммой: ${trimmed}`)
        current = null
        continue
      }

      const skip = skipInfo(description, section)
      const draft: DraftRow = {
        date: toIsoDate(row[1], row[2], row[3]),
        amount,
        type,
        description,
        cardLast4: section === 'card' ? last4 : '',
        categoryKey: categoryKey(description, type),
        suggestedSkip: skip.skip,
        skipReason: skip.reason,
        rawDescription: description,
      }
      rows.push(draft)
      current = draft

      // Банк не включает переводы в кубышку в итог «Расходы», поэтому и мы
      // не учитываем их в контрольной сумме.
      if (type === 'expense' && last4 && !/кубышк/i.test(description)) {
        computedExpense[last4] = (computedExpense[last4] ?? 0) + amount
      }
      continue
    }

    if (current && !NOISE.some((pattern) => pattern.test(trimmed))) {
      current.rawDescription = clean(`${current.rawDescription} ${trimmed}`)
      current.description = current.rawDescription
    }
  }

  const seen = new Map<string, number>()
  const result: ParsedRow[] = rows.map((draft) => {
    const base = hash(
      `${draft.date}|${draft.type}|${draft.amount.toFixed(2)}|${draft.cardLast4}|${draft.description.toLowerCase()}`,
    )
    // Одинаковые покупки в один день (например, несколько проездов) получают
    // порядковый номер, чтобы каждая оставалась отдельной операцией.
    const occurrence = (seen.get(base) ?? 0) + 1
    seen.set(base, occurrence)
    return {
      date: draft.date,
      amount: draft.amount,
      type: draft.type,
      description: draft.description,
      cardLast4: draft.cardLast4,
      categoryKey: draft.categoryKey,
      suggestedSkip: draft.suggestedSkip,
      skipReason: draft.skipReason,
      sourceId: `tbank-${base}-${occurrence}`,
    }
  })

  for (const [card, total] of Object.entries(declaredExpense)) {
    const computed = Math.round((computedExpense[card] ?? 0) * 100) / 100
    if (Math.abs(computed - total) > 0.01) {
      warnings.push(
        `Итог по карте •••• ${card}: в выписке ${total.toFixed(2)} ₽, распознано ${computed.toFixed(2)} ₽`,
      )
    }
  }

  if (!result.length) warnings.push('В файле не найдено операций по картам')

  return { rows: result, warnings, declaredExpense }
}
