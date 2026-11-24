import { useCallback, useEffect, useState } from 'react'
import type { Budget } from '../hooks/useBudget'
import { haptic, isTelegram, notify, setupMainButton } from '../lib/telegram'
import { Sheet } from './Sheet'

interface Props {
  budget: Budget
  onClose: () => void
  onSaved: (message: string) => void
}

export function GoalSheet({ budget, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(budget.state.goal.title)
  const [target, setTarget] = useState(String(budget.state.goal.target))

  const parsedTarget = Number(target.replace(/\s/g, '').replace(',', '.'))
  const valid = title.trim().length > 0 && Number.isFinite(parsedTarget) && parsedTarget > 0

  const save = useCallback(() => {
    if (!valid) {
      notify('error')
      return
    }
    budget.updateGoal({ title: title.trim(), target: Math.round(parsedTarget * 100) / 100 })
    haptic('medium')
    onSaved('Цель обновлена')
    onClose()
  }, [valid, title, parsedTarget, budget, onSaved, onClose])

  useEffect(() => setupMainButton('Сохранить', save), [save])

  return (
    <Sheet
      title="Цель накоплений"
      onClose={onClose}
      footer={
        isTelegram() ? null : (
          <button type="button" className="primary-button" disabled={!valid} onClick={save}>
            Сохранить
          </button>
        )
      }
    >
      <label className="field">
        <span className="field-label">Название цели</span>
        <input
          className="field-input"
          placeholder="Например, Отпуск"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">Хочу накопить</span>
        <div className="amount-field">
          <input
            className="mono"
            inputMode="decimal"
            placeholder="0"
            value={target}
            onChange={(event) => setTarget(event.target.value.replace(/[^\d.,\s]/g, ''))}
          />
          <span>₽</span>
        </div>
      </label>

      <p className="field-hint">Сумма цели не влияет на остаток: деньги откладываются отдельными операциями.</p>
    </Sheet>
  )
}
