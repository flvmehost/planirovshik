import type { CSSProperties } from 'react'
import { compactMoney } from '../lib/format'
import type { CardSummary } from '../types'

interface Props {
  cards: CardSummary[]
  total: number
  scope: string
  onSelect: (scope: string) => void
}

export function CardCarousel({ cards, total, scope, onSelect }: Props) {
  return (
    <div className="card-carousel" role="tablist" aria-label="Выбор карты">
      <button
        type="button"
        role="tab"
        aria-selected={scope === 'all'}
        className={`card-tile card-tile--all${scope === 'all' ? ' is-selected' : ''}`}
        onClick={() => onSelect('all')}
      >
        <span className="card-tile__bank">Все карты</span>
        <strong className="card-tile__amount mono">{compactMoney(total)}</strong>
        <span className="card-tile__meta">{cards.length} активн. · сумма</span>
      </button>

      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          role="tab"
          aria-selected={scope === card.id}
          className={`card-tile${scope === card.id ? ' is-selected' : ''}`}
          style={{ '--card-color': card.color } as CSSProperties}
          onClick={() => onSelect(card.id)}
        >
          <span className="card-tile__bank">{card.bank}</span>
          <strong className="card-tile__amount mono">{compactMoney(card.balance)}</strong>
          <span className="card-tile__meta">•••• {card.last4 || '0000'}</span>
        </button>
      ))}
    </div>
  )
}
