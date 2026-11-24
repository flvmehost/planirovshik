import { compactMoney, money } from '../lib/format'
import type { CategoryTotal } from '../hooks/useBudget'

interface Props {
  entries: CategoryTotal[]
  total: number
}

const RADIUS = 44
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function CategoryChart({ entries, total }: Props) {
  let offset = 0

  return (
    <section className="panel chart-card">
      <div className="panel-head">
        <div>
          <span className="eyebrow">РАСХОДЫ</span>
          <h3>По категориям</h3>
        </div>
        <span className="chart-total mono">{compactMoney(total)}</span>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon">📊</span>
          <p>Здесь появятся ваши расходы</p>
        </div>
      ) : (
        <div className="chart-content">
          <div className="donut-wrap">
            <svg viewBox="0 0 120 120" className="donut" aria-label="Диаграмма расходов по категориям">
              <circle cx="60" cy="60" r={RADIUS} className="donut-track" />
              {entries.map((entry) => {
                const length = (entry.share / 100) * CIRCUMFERENCE
                const dashOffset = offset
                offset += length
                return (
                  <circle
                    key={entry.id}
                    cx="60"
                    cy="60"
                    r={RADIUS}
                    fill="none"
                    stroke={entry.color}
                    strokeWidth="13"
                    strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                    strokeDashoffset={-dashOffset}
                    transform="rotate(-90 60 60)"
                  />
                )
              })}
              <text x="60" y="57" textAnchor="middle" className="donut-total mono">
                {compactMoney(total)}
              </text>
              <text x="60" y="73" textAnchor="middle" className="donut-caption">
                расходы
              </text>
            </svg>
          </div>

          <ul className="chart-legend">
            {entries.map((entry) => (
              <li key={entry.id}>
                <span className="legend-dot" style={{ background: entry.color }} />
                <span className="legend-label">{entry.emoji} {entry.label}</span>
                <span className="legend-value mono">{money(entry.amount)}</span>
                <span className="legend-share mono">{entry.share}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
