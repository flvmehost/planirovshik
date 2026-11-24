import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import type { Budget } from '../hooks/useBudget'
import { CARD_COLORS } from '../lib/categories'
import { haptic, isTelegram, notify, setupMainButton } from '../lib/telegram'
import type { Card } from '../types'
import { Sheet } from './Sheet'

interface Props {
  budget: Budget
  card?: Card
  onClose: () => void
  onSaved: (message: string) => void
}

export function CardSheet({ budget, card, onClose, onSaved }: Props) {
  const [bank, setBank] = useState(card?.bank ?? '')
  const [label, setLabel] = useState(card?.label ?? '')
  const [last4, setLast4] = useState(card?.last4 ?? '')
  const [color, setColor] = useState(card?.color ?? CARD_COLORS[0])
  const [openingBalance, setOpeningBalance] = useState(card ? String(card.openingBalance) : '')

  const parsedBalance = Number(openingBalance.replace(/\s/g, '').replace(',', '.'))
  const valid = bank.trim().length > 0 && Number.isFinite(parsedBalance)

  const save = useCallback(() => {
    if (!valid) {
      notify('error')
      return
    }
    const input = {
      bank: bank.trim(),
      label: label.trim(),
      last4: last4.replace(/\D/g, '').slice(0, 4),
      color,
      openingBalance: Math.round(parsedBalance * 100) / 100,
    }
    if (card) {
      budget.updateCard(card.id, input)
      onSaved('Карта обновлена')
    } else {
      budget.addCard(input)
      onSaved('Карта добавлена')
    }
    haptic('medium')
    onClose()
  }, [valid, bank, label, last4, color, parsedBalance, card, budget, onSaved, onClose])

  useEffect(() => setupMainButton(card ? 'Сохранить' : 'Добавить', save), [save, card])

  return (
    <Sheet
      title={card ? 'Редактировать карту' : 'Новая карта'}
      onClose={onClose}
      footer={
        isTelegram() ? null : (
          <button type="button" className="primary-button" disabled={!valid} onClick={save}>
            {card ? 'Сохранить' : 'Добавить'}
          </button>
        )
      }
    >
      <label className="field">
        <span className="field-label">Банк</span>
        <input
          className="field-input"
          placeholder="Например, Т-Банк"
          value={bank}
          onChange={(event) => setBank(event.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">Название карты</span>
        <input
          className="field-input"
          placeholder="Например, Зарплатная"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>

      <div className="field-row">
        <label className="field">
          <span className="field-label">Последние 4 цифры</span>
          <input
            className="field-input mono"
            inputMode="numeric"
            placeholder="4242"
            value={last4}
            onChange={(event) => setLast4(event.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </label>
        <label className="field field--grow">
          <span className="field-label">Остаток на карте</span>
          <div className="amount-field amount-field--small">
            <input
              className="mono"
              inputMode="decimal"
              placeholder="0"
              value={openingBalance}
              onChange={(event) => setOpeningBalance(event.target.value.replace(/[^\d.,\s-]/g, ''))}
            />
            <span>₽</span>
          </div>
        </label>
      </div>

      <div className="field">
        <span className="field-label">Цвет карты</span>
        <div className="color-picker">
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

      <p className="field-hint">Остаток меняется операциями. Стартовую сумму можно откорректировать позже.</p>
    </Sheet>
  )
}
