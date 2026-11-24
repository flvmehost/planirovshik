import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Budget } from '../hooks/useBudget'
import { categoriesFor } from '../lib/categories'
import { todayLocal } from '../lib/format'
import { haptic, isTelegram, notify, setupMainButton } from '../lib/telegram'
import type { Transaction, TransactionType } from '../types'
import { Sheet } from './Sheet'

interface Props {
  budget: Budget
  transaction?: Transaction
  presetType?: TransactionType
  onClose: () => void
  onSaved: (message: string) => void
  onDeleted: (transaction: Transaction) => void
}

const TYPE_TABS: { id: TransactionType; label: string }[] = [
  { id: 'expense', label: '− Расход' },
  { id: 'income', label: '+ Доход' },
  { id: 'saving', label: '→ В цель' },
]

export function TransactionSheet({ budget, transaction, presetType, onClose, onSaved, onDeleted }: Props) {
  const availableCards = useMemo(
    () => budget.summaries.filter((card) => !card.archived || card.id === transaction?.cardId),
    [budget.summaries, transaction],
  )

  const [type, setType] = useState<TransactionType>(transaction?.type ?? presetType ?? 'expense')
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '')
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? categoriesFor(presetType ?? 'expense')[0].id)
  const [cardId, setCardId] = useState(
    transaction?.cardId ?? (budget.scope !== 'all' ? budget.scope : budget.activeCards[0]?.id ?? ''),
  )
  const [note, setNote] = useState(transaction?.note ?? '')
  const [date, setDate] = useState(transaction?.date ?? todayLocal())

  const parsedAmount = Number(amount.replace(/\s/g, '').replace(',', '.'))
  const valid = Number.isFinite(parsedAmount) && parsedAmount > 0 && Boolean(categoryId) && Boolean(cardId)

  const changeType = (next: TransactionType) => {
    haptic()
    setType(next)
    setCategoryId(categoriesFor(next)[0].id)
  }

  const save = useCallback(() => {
    if (!valid) {
      notify('error')
      return
    }
    const input = {
      type,
      amount: Math.round(parsedAmount * 100) / 100,
      categoryId,
      cardId,
      note: note.trim(),
      date,
    }
    if (transaction) {
      budget.updateTransaction(transaction.id, input)
      onSaved('Операция обновлена')
    } else {
      budget.addTransaction(input)
      onSaved(type === 'saving' ? 'Отложено в цель' : type === 'income' ? 'Доход добавлен' : 'Расход добавлен')
    }
    haptic('medium')
    onClose()
  }, [valid, parsedAmount, type, categoryId, cardId, note, date, transaction, budget, onSaved, onClose])

  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(
    () => setupMainButton(transaction ? 'Сохранить' : 'Добавить', () => saveRef.current()),
    [transaction],
  )

  const title = transaction ? 'Редактировать операцию' : 'Новая операция'

  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        isTelegram() ? null : (
          <button type="button" className="primary-button" disabled={!valid} onClick={save}>
            {transaction ? 'Сохранить' : 'Добавить'}
          </button>
        )
      }
    >
      <div className="segmented">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={type === tab.id ? 'is-active' : ''}
            onClick={() => changeType(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <label className="field">
        <span className="field-label">Сумма</span>
        <div className="amount-field">
          <input
            className="mono"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^\d.,\s]/g, ''))}
          />
          <span>₽</span>
        </div>
      </label>

      <div className="field">
        <span className="field-label">Категория</span>
        <div className="chip-grid">
          {categoriesFor(type).map((category) => (
            <button
              key={category.id}
              type="button"
              className={`chip${categoryId === category.id ? ' is-active' : ''}`}
              onClick={() => {
                haptic()
                setCategoryId(category.id)
              }}
            >
              <span>{category.emoji}</span>
              {category.label}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span className="field-label">Карта</span>
        {availableCards.length ? (
          <select className="field-input" value={cardId} onChange={(event) => setCardId(event.target.value)}>
            {availableCards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.label ? `${card.bank} · ${card.label}` : card.bank} · •••• {card.last4 || '0000'}
              </option>
            ))}
          </select>
        ) : (
          <span className="field-hint">Сначала добавьте карту во вкладке «Карты»</span>
        )}
      </label>

      <div className="field-row">
        <label className="field">
          <span className="field-label">Дата</span>
          <input className="field-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="field field--grow">
          <span className="field-label">Заметка</span>
          <input
            className="field-input"
            placeholder="Необязательно"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </div>

      {transaction ? (
        <button type="button" className="danger-button" onClick={() => onDeleted(transaction)}>
          Удалить операцию
        </button>
      ) : null}
    </Sheet>
  )
}
