import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import type { Budget } from '../hooks/useBudget'
import { categoriesFor } from '../lib/categories'
import { money } from '../lib/format'
import { fetchStatementFile, importErrorMessage } from '../lib/importApi'
import { extractPdfText } from '../lib/pdf'
import { parseStatementText, type ParsedRow, type ParsedType } from '../../shared/statement'
import { haptic, isTelegram, notify, setupMainButton } from '../lib/telegram'
import { Sheet } from './Sheet'

interface Props {
  budget: Budget
  /** Токен из чата бота: ?import=… */
  initialToken?: string
  onClose: () => void
  onSaved: (message: string) => void
}

interface ReviewRow {
  key: string
  sourceId: string
  date: string
  amount: string
  type: ParsedType
  description: string
  last4: string
  cardId: string
  categoryId: string
  selected: boolean
  duplicate: boolean
  skipReason?: string
}

function amountValue(value: string): number {
  return Math.round(Number(value.replace(/\s/g, '').replace(',', '.')) * 100) / 100
}

function shortDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day}.${month}.${year.slice(2)}`
}

function signOf(type: ParsedType): string {
  return type === 'income' ? '+' : type === 'expense' ? '−' : ''
}

export function ImportSheet({ budget, initialToken, onClose, onSaved }: Props) {
  const [stage, setStage] = useState<'pick' | 'loading' | 'review'>(initialToken ? 'loading' : 'pick')
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const cards = useMemo(
    () => budget.summaries.filter((card) => !card.archived),
    [budget.summaries],
  )

  const selected = rows.filter((row) => row.selected)
  const selectedCount = selected.length

  const loadFile = useCallback(
    async (file: File) => {
      setError(null)
      setStage('loading')
      try {
        const text = await extractPdfText(file)
        const parsed = parseStatementText(text)
        if (!parsed.rows.length) {
          setError('В файле не найдено операций. Проверьте, что это выписка по карте.')
          setStage('pick')
          return
        }
        const existing = new Set(
          budget.state.transactions.map((transaction) => transaction.sourceId).filter(Boolean),
        )
        setRows(
          parsed.rows.map((row: ParsedRow, index: number) => {
            const card =
              cards.find((item) => item.last4 && item.last4 === row.cardLast4) ?? cards[0]
            const available = categoriesFor(row.type, budget.state.customCategories)
            const category =
              available.find((item) => item.id === row.categoryKey) ??
              available.find((item) => item.id === 'other-expense') ??
              available[0]
            const duplicate = existing.has(row.sourceId)
            return {
              key: `${row.sourceId}-${index}`,
              sourceId: row.sourceId,
              date: row.date,
              amount: String(row.amount),
              type: row.type,
              description: row.description,
              last4: row.cardLast4,
              cardId: card?.id ?? '',
              categoryId: category?.id ?? '',
              selected: !row.suggestedSkip && !duplicate,
              duplicate,
              skipReason: row.skipReason,
            }
          }),
        )
        setWarnings(parsed.warnings)
        setStage('review')
      } catch (cause) {
        console.error(cause)
        setError('Не удалось прочитать PDF. Попробуйте другую выписку.')
        setStage('pick')
      }
    },
    [budget.state.transactions, budget.state.customCategories, cards],
  )

  const handleFile = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setError('Пока поддерживаются только PDF-выписки.')
        return
      }
      void loadFile(file)
    },
    [loadFile],
  )

  useEffect(() => {
    if (!initialToken || !budget.hydrated) return
    let alive = true
    void fetchStatementFile(initialToken)
      .then((file) => {
        if (!alive) return
        return loadFile(file)
      })
      .catch((cause) => {
        if (!alive) return
        console.error(cause)
        setError(importErrorMessage(cause))
        setStage('pick')
      })
    return () => {
      alive = false
    }
    // Токен одноразовый: повторно загружать его при изменении зависимостей не нужно.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialToken, budget.hydrated])

  const patchRow = (key: string, patch: Partial<ReviewRow>) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const save = useCallback(() => {
    const chosen = rows.filter(
      (row) =>
        row.selected &&
        row.cardId &&
        row.categoryId &&
        Number.isFinite(amountValue(row.amount)) &&
        amountValue(row.amount) > 0,
    )
    if (!chosen.length) {
      notify('error')
      return
    }
    const added = budget.addTransactions(
      chosen.map((row) => ({
        type: row.type,
        amount: amountValue(row.amount),
        categoryId: row.categoryId,
        cardId: row.cardId,
        note: row.description,
        date: row.date,
        sourceId: row.sourceId,
      })),
    )
    haptic('medium')
    onSaved(`Добавлено операций: ${added}`)
    onClose()
  }, [rows, budget, onSaved, onClose])

  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    if (stage !== 'review') return
    return setupMainButton(`Добавить ${selectedCount}`, () => saveRef.current())
  }, [stage, selectedCount])

  return (
    <Sheet
      title="Импорт выписки"
      onClose={onClose}
      footer={
        isTelegram() || stage !== 'review' ? null : (
          <button type="button" className="primary-button" disabled={!selectedCount} onClick={save}>
            Добавить {selectedCount}
          </button>
        )
      }
    >
      {stage === 'pick' ? (
        <div className="import-pick">
          <div className="import-pick__icon">📄</div>
          <h3>PDF-выписка Т-Банка</h3>
          <p className="muted">
            Загрузите выписку по карте — операции появятся списком. Их можно проверить, выбрать карту и
            категорию, а лишние переводы — отключить.
          </p>
          <p className="field-hint">
            Можно и просто прислать PDF боту в чат — он пришлёт кнопку с этим списком.
          </p>
          <label className={`primary-button import-file-button${budget.hydrated ? '' : ' is-disabled'}`}>
            {budget.hydrated ? 'Выбрать PDF' : 'Загружаю данные…'}
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFile}
              disabled={!budget.hydrated}
              hidden
            />
          </label>
          {error ? <p className="field-hint danger-text">{error}</p> : null}
        </div>
      ) : null}

      {stage === 'loading' ? (
        <div className="import-pick">
          <div className="import-pick__icon">⏳</div>
          <h3>Читаю выписку…</h3>
          <p className="muted">Это займёт пару секунд.</p>
        </div>
      ) : null}

      {stage === 'review' ? (
        <>
          <div className="import-summary">
            <div>
              <span className="eyebrow">НАЙДЕНО</span>
              <strong>{rows.length} операций</strong>
            </div>
            <div>
              <span className="eyebrow">ВЫБРАНО</span>
              <strong>{selectedCount}</strong>
            </div>
            <div>
              <span className="eyebrow">СУММА</span>
              <strong className="mono">
                {money(
                  selected.reduce(
                    (sum, row) => sum + (row.type === 'income' ? amountValue(row.amount) : -amountValue(row.amount)),
                    0,
                  ),
                )}
              </strong>
            </div>
          </div>

          {warnings.length ? (
            <div className="import-warnings">
              {warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          {!cards.length ? (
            <p className="field-hint danger-text">Сначала добавьте хотя бы одну карту.</p>
          ) : null}

          <div className="import-list">
            {rows.map((row) => (
              <div
                className={`import-row${row.selected ? ' is-selected' : ''}${row.duplicate ? ' is-duplicate' : ''}`}
                key={row.key}
              >
                <label className="import-check">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={(event) => patchRow(row.key, { selected: event.target.checked })}
                  />
                </label>
                <div className="import-row__main">
                  <div className="import-row__top">
                    <strong>{row.description}</strong>
                    <span className={`mono ${row.type === 'income' ? 'text-positive' : 'text-negative'}`}>
                      {signOf(row.type)}
                      {money(amountValue(row.amount))}
                    </span>
                  </div>
                  <div className="import-row__meta">
                    <span>{shortDate(row.date)}</span>
                    <span>•••• {row.last4 || '—'}</span>
                    {row.duplicate ? <span className="import-badge">уже добавлено</span> : null}
                    {row.skipReason ? <span className="import-badge">{row.skipReason}</span> : null}
                  </div>
                  <div className="import-row__controls">
                    <select
                      className="import-select"
                      value={row.cardId}
                      onChange={(event) => patchRow(row.key, { cardId: event.target.value })}
                    >
                      {cards.map((card) => (
                        <option key={card.id} value={card.id}>
                          {card.label || card.bank} •••• {card.last4 || '0000'}
                        </option>
                      ))}
                    </select>
                    <select
                      className="import-select"
                      value={row.categoryId}
                      onChange={(event) => patchRow(row.key, { categoryId: event.target.value })}
                    >
                      {categoriesFor(row.type, budget.state.customCategories).map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.emoji} {category.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </Sheet>
  )
}
