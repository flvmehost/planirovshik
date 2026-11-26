import { useMemo, type CSSProperties } from 'react'
import { getCategory } from '../lib/categories'
import { dateLabel, money } from '../lib/format'
import type { Card, Category, Transaction } from '../types'

interface Props {
  transactions: Transaction[]
  cards: Card[]
  customCategories: Category[]
  onEdit: (transaction: Transaction) => void
  onDelete: (transaction: Transaction) => void
  emptyText?: string
}

export function TransactionList({
  transactions,
  cards,
  customCategories,
  onEdit,
  onDelete,
  emptyText = 'Операций пока нет',
}: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const tx of transactions) {
      const list = map.get(tx.date) ?? []
      list.push(tx)
      map.set(tx.date, list)
    }
    return [...map.entries()].map(([date, items]) => ({
      date,
      items,
      net: items.reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : -tx.amount), 0),
    }))
  }, [transactions])

  if (groups.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state__icon">🧾</span>
        <p>{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="transaction-groups">
      {groups.map((group) => (
        <section key={group.date} className="transaction-group">
          <div className="transaction-group__head">
            <span>{dateLabel(group.date)}</span>
            <span className={`mono ${group.net < 0 ? 'text-negative' : 'text-positive'}`}>
              {money(group.net, { sign: true, decimals: true })}
            </span>
          </div>

          {group.items.map((tx) => {
            const category = getCategory(tx.categoryId, customCategories, tx.type)
            const card = cards.find((item) => item.id === tx.cardId)
            return (
              <div className="transaction-row" key={tx.id}>
                <div
                  className="transaction-icon"
                  style={{ background: `${category.color}22`, color: category.color } as CSSProperties}
                >
                  {category.emoji}
                </div>
                <div className="transaction-info">
                  <strong>{category.label}</strong>
                  <span>
                    {tx.note || card?.bank || 'Карта'}
                    {card ? ` · •••• ${card.last4 || '0000'}` : ''}
                  </span>
                </div>
                <div className={`transaction-amount mono ${tx.type === 'income' ? 'text-positive' : 'text-negative'}`}>
                  {tx.type === 'income' ? '+' : '−'}{money(tx.amount, { decimals: true })}
                </div>
                <div className="transaction-actions">
                  <button type="button" className="icon-button small" aria-label="Редактировать" onClick={() => onEdit(tx)}>
                    ✎
                  </button>
                  <button type="button" className="icon-button small danger" aria-label="Удалить" onClick={() => onDelete(tx)}>
                    🗑
                  </button>
                </div>
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
