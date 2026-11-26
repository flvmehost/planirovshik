import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Budget } from '../hooks/useBudget'
import { money, todayLocal } from '../lib/format'
import { haptic, isTelegram, notify, setupMainButton } from '../lib/telegram'
import { Sheet } from './Sheet'

interface Props {
  budget: Budget
  mode: 'payment' | 'interest'
  creditId?: string
  onClose: () => void
  onSaved: (message: string) => void
}

function parseNumber(value: string): number {
  return Number(value.replace(/\s/g, '').replace(',', '.'))
}

function daysSince(date: string | undefined, createdAt: number): number {
  const start = date ? new Date(`${date}T00:00:00`).getTime() : createdAt
  if (!Number.isFinite(start)) return 0
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000))
}

export function CreditOperationSheet({ budget, mode, creditId, onClose, onSaved }: Props) {
  const availableCredits = useMemo(
    () => budget.creditSummaries.filter((credit) => !credit.archived || credit.remaining > 0),
    [budget.creditSummaries],
  )

  const [selectedCreditId, setSelectedCreditId] = useState(
    creditId ?? availableCredits.find((credit) => !credit.archived)?.id ?? availableCredits[0]?.id ?? '',
  )
  const [amount, setAmount] = useState('')
  const [cardId, setCardId] = useState(budget.activeCards[0]?.id ?? '')
  const [date, setDate] = useState(todayLocal())
  const [note, setNote] = useState('')

  const credit = availableCredits.find((item) => item.id === selectedCreditId)
  const card = budget.activeCards.find((item) => item.id === cardId)

  const suggestion = useMemo(() => {
    if (!credit || !credit.rate || !credit.remaining) return 0
    const days = daysSince(credit.lastAccrualDate || credit.firstPaymentDate || credit.dueDate, credit.createdAt)
    return Math.round((credit.remaining * credit.rate * days) / 100 / 365 * 100) / 100
  }, [credit])

  const applySuggestion = useCallback(() => {
    if (!suggestion) return
    setAmount(String(suggestion))
    haptic()
  }, [suggestion])

  useEffect(() => {
    if (mode === 'interest' && suggestion > 0) setAmount(String(suggestion))
    else setAmount('')
  }, [mode, selectedCreditId, suggestion])

  const parsedAmount = parseNumber(amount)
  const valid =
    Boolean(selectedCreditId) &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    (mode === 'interest' || Boolean(cardId))

  const overpay = credit && mode === 'payment' ? Math.max(0, parsedAmount - credit.remaining) : 0
  const shortfall = credit && card && mode === 'payment' ? Math.max(0, parsedAmount - card.balance) : 0

  const save = useCallback(() => {
    if (!valid) {
      notify('error')
      return
    }
    const isPayment = mode === 'payment'
    budget.addTransaction({
      type: isPayment ? 'creditPayment' : 'creditInterest',
      amount: Math.round(parsedAmount * 100) / 100,
      categoryId: isPayment ? 'credit-payment' : 'credit-interest',
      cardId: isPayment ? cardId : '',
      creditId: selectedCreditId,
      note: note.trim(),
      date,
    })
    if (!isPayment) budget.markCreditAccrued(selectedCreditId, date)
    haptic('medium')
    onSaved(isPayment ? 'Платёж по кредиту добавлен' : 'Проценты начислены')
    onClose()
  }, [
    valid,
    mode,
    parsedAmount,
    cardId,
    selectedCreditId,
    note,
    date,
    budget,
    onSaved,
    onClose,
  ])

  const saveRef = useRef(save)
  saveRef.current = save
  const mainButtonText = mode === 'payment' ? 'Погасить' : 'Начислить'
  useEffect(() => setupMainButton(mainButtonText, () => saveRef.current()), [mainButtonText])

  const title = mode === 'payment' ? 'Погашение кредита' : 'Начисление процентов'

  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        isTelegram() ? null : (
          <button type="button" className="primary-button" disabled={!valid} onClick={save}>
            {mainButtonText}
          </button>
        )
      }
    >
      <label className="field">
        <span className="field-label">Кредит</span>
        {availableCredits.length ? (
          <select
            className="field-input"
            value={selectedCreditId}
            onChange={(event) => setSelectedCreditId(event.target.value)}
          >
            {availableCredits.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.bank ? ` · ${item.bank}` : ''} · осталось {money(item.remaining, { decimals: true })}
              </option>
            ))}
          </select>
        ) : (
          <span className="field-hint">Сначала добавьте кредит во вкладке «Кредиты»</span>
        )}
      </label>

      {credit ? (
        <div className="credit-operation__info">
          <span>Остаток долга</span>
          <strong className="mono">{money(credit.remaining, { decimals: true })}</strong>
          {mode === 'interest' ? (
            <small>
              Ставка {credit.rate}%. Расчёт: {money(suggestion, { decimals: true })} за{' '}
              {daysSince(credit.lastAccrualDate || credit.firstPaymentDate || credit.dueDate, credit.createdAt)} дн.
            </small>
          ) : null}
        </div>
      ) : null}

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
        {mode === 'interest' && suggestion > 0 ? (
          <button type="button" className="text-button" onClick={applySuggestion}>
            Подставить расчёт
          </button>
        ) : null}
      </label>

      {mode === 'payment' ? (
        <label className="field">
          <span className="field-label">Карта-источник</span>
          {budget.activeCards.length ? (
            <select className="field-input" value={cardId} onChange={(event) => setCardId(event.target.value)}>
              {budget.activeCards.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label ? `${item.bank} · ${item.label}` : item.bank} · •••• {item.last4 || '0000'} ·{' '}
                  {money(item.balance, { decimals: true })}
                </option>
              ))}
            </select>
          ) : (
            <span className="field-hint">Сначала добавьте карту во вкладке «Карты»</span>
          )}
        </label>
      ) : null}

      <div className="field-row field-row--even">
        <label className="field">
          <span className="field-label">Дата</span>
          <input className="field-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Заметка</span>
          <input
            className="field-input"
            placeholder="Необязательно"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </div>

      {overpay > 0 ? (
        <p className="field-hint field-hint--warning">
          Сумма больше остатка долга. Кредит будет закрыт, переплата {money(overpay, { decimals: true })}.
        </p>
      ) : null}
      {shortfall > 0 ? (
        <p className="field-hint field-hint--warning">
          На карте не хватает {money(shortfall, { decimals: true })} — баланс уйдёт в минус.
        </p>
      ) : null}
    </Sheet>
  )
}
