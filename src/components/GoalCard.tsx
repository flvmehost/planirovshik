import { haptic } from '../lib/telegram'
import { money } from '../lib/format'
import type { Goal } from '../types'

interface Props {
  goal: Goal
  saved: number
  onEdit: () => void
  onDeposit: () => void
}

export function GoalCard({ goal, saved, onEdit, onDeposit }: Props) {
  const target = Math.max(0, goal.target)
  const progress = target ? Math.min(100, Math.round((saved / target) * 100)) : 0
  const remaining = Math.max(0, target - saved)

  return (
    <section className="panel goal-card">
      <div className="panel-head">
        <div>
          <span className="eyebrow">ЦЕЛЬ НАКОПЛЕНИЙ</span>
          <h3>{goal.title || 'Без названия'}</h3>
        </div>
        <button className="text-button" type="button" onClick={onEdit}>
          Изменить
        </button>
      </div>

      <div className="goal-numbers">
        <strong className="goal-current mono">{money(saved)}</strong>
        <span className="goal-target mono">из {money(target)}</span>
      </div>

      <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress__fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="goal-footer">
        <span className="muted">
          {remaining > 0 ? <>Осталось <span className="mono">{money(remaining)}</span></> : 'Цель достигнута 🎉'}
        </span>
        <button
          className="pill-button"
          type="button"
          onClick={() => {
            haptic()
            onDeposit()
          }}
        >
          + Отложить
        </button>
      </div>
    </section>
  )
}
