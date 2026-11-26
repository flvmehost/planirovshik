import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Budget } from '../hooks/useBudget'
import { CARD_COLORS } from '../lib/categories'
import { todayLocal } from '../lib/format'
import { haptic, isTelegram, notify, setupMainButton } from '../lib/telegram'
import type { Credit } from '../types'
import { Sheet } from './Sheet'

interface Props {
  budget: Budget
  credit?: Credit
  onClose: () => void
  onSaved: (message: string) => void
}

function parseNumber(value: string): number {
  return Number(value.replace(/\s/g, '').replace(',', '.'))
}

export function CreditSheet({ budget, credit, onClose, onSaved }: Props) {
  const [name, setName] = useState(credit?.name ?? '')
  const [bank, setBank] = useState(credit?.bank ?? '')
  const [openingBalance, setOpeningBalance] = useState(credit ? String(credit.openingBalance) : '')
  const [rate, setRate] = useState(credit ? String(credit.rate) : '')
  const [monthlyPayment, setMonthlyPayment] = useState(
    credit && credit.monthlyPayment ? String(credit.monthlyPayment) : '',
  )
  const [dueDate, setDueDate] = useState(credit?.dueDate ?? '')
  const [color, setColor] = useState(credit?.color ?? CARD_COLORS[1])

  const parsedOpening = parseNumber(openingBalance)
  const parsedRate = rate.trim() ? parseNumber(rate) : 0
  const parsedPayment = monthlyPayment.trim() ? parseNumber(monthlyPayment) : 0
  const valid =
    name.trim().length > 0 &&
    Number.isFinite(parsedOpening) &&
    parsedOpening >= 0 &&
    Number.isFinite(parsedRate) &&
    parsedRate >= 0 &&
    Number.isFinite(parsedPayment) &&
    parsedPayment >= 0

  const save = useCallback(() => {
    if (!valid) {
      notify('error')
      return
    }
    const input = {
      name: name.trim(),
      bank: bank.trim(),
      openingBalance: Math.round(parsedOpening * 100) / 100,
      rate: Math.round(parsedRate * 100) / 100,
      monthlyPayment: Math.round(parsedPayment * 100) / 100,
      dueDate,
      lastAccrualDate: credit?.lastAccrualDate ?? todayLocal(),
      color,
    }
    if (credit) {
      budget.updateCredit(credit.id, input)
      onSaved('Кредит обновлён')
    } else {
      budget.addCredit(input)
      onSaved('Кредит добавлен')
    }
    haptic('medium')
    onClose()
  }, [valid, name, bank, parsedOpening, parsedRate, parsedPayment, dueDate, credit, color, budget, onSaved, onClose])

  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(
    () => setupMainButton(credit ? 'Сохранить' : 'Добавить', () => saveRef.current()),
    [credit],
  )

  return (
    <Sheet
      title={credit ? 'Редактировать кредит' : 'Новый кредит'}
      onClose={onClose}
      footer={
        isTelegram() ? null : (
          <button type="button" className="primary-button" disabled={!valid} onClick={save}>
            {credit ? 'Сохранить' : 'Добавить'}
          </button>
        )
      }
    >
      <label className="field">
        <span className="field-label">Название</span>
        <input
          className="field-input"
          placeholder="Например, Ипотека"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">Банк</span>
        <input
          className="field-input"
          placeholder="Необязательно"
          value={bank}
          onChange={(event) => setBank(event.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">Начальная задолженность</span>
        <div className="amount-field amount-field--small">
          <input
            className="mono"
            inputMode="decimal"
            placeholder="0"
            value={openingBalance}
            onChange={(event) => setOpeningBalance(event.target.value.replace(/[^\d.,\s]/g, ''))}
          />
          <span>₽</span>
        </div>
      </label>

      <div className="field-row field-row--even">
        <label className="field">
          <span className="field-label">Годовая ставка, %</span>
          <input
            className="field-input mono"
            inputMode="decimal"
            placeholder="0"
            value={rate}
            onChange={(event) => setRate(event.target.value.replace(/[^\d.,\s]/g, ''))}
          />
        </label>
        <label className="field">
          <span className="field-label">Платёж в месяц</span>
          <input
            className="field-input mono"
            inputMode="decimal"
            placeholder="0"
            value={monthlyPayment}
            onChange={(event) => setMonthlyPayment(event.target.value.replace(/[^\d.,\s]/g, ''))}
          />
        </label>
      </div>

      <label className="field">
        <span className="field-label">Дата следующего платежа</span>
        <input className="field-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
      </label>

      <div className="field">
        <span className="field-label">Цвет</span>
        <div className="color-picker color-picker--wrap">
          {CARD_COLORS.map((item) => (
            <button
              key={item}
              type="button"
              className={`color-dot${color === item ? ' is-active' : ''}`}
              style={{ '--dot-color': item } as CSSProperties}
              aria-label={`Цвет ${item}`}
              onClick={() => {
                haptic()
                setColor(item)
              }}
            />
          ))}
        </div>
      </div>

      <p className="field-hint">
        Остаток долга считается автоматически: начальная задолженность + начисленные проценты − платежи.
      </p>
    </Sheet>
  )
}
