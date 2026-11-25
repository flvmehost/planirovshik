import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { BottomNav, type Tab } from './components/BottomNav'
import { CardCarousel } from './components/CardCarousel'
import { CardSheet } from './components/CardSheet'
import { CategoryChart } from './components/CategoryChart'
import { GoalCard } from './components/GoalCard'
import { GoalSheet } from './components/GoalSheet'
import { TransactionList } from './components/TransactionList'
import { TransactionSheet } from './components/TransactionSheet'
import { useBudget } from './hooks/useBudget'
import { compactMoney, money } from './lib/format'
import { hideKeyboard, haptic, initTelegram, notify, watchVisualViewport } from './lib/telegram'
import type { Card, Transaction, TransactionType } from './types'

type SheetState =
  | { kind: 'transaction'; transaction?: Transaction; presetType?: TransactionType }
  | { kind: 'card'; card?: Card }
  | { kind: 'goal' }
  | null

interface ToastState {
  id: number
  message: string
  action?: { label: string; run: () => void }
}

export default function App() {
  const budget = useBudget()
  const [tab, setTab] = useState<Tab>('home')
  const [sheet, setSheet] = useState<SheetState>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [, setThemeTick] = useState(0)

  useEffect(() => initTelegram(() => setThemeTick((value) => value + 1)), [])
  useEffect(() => watchVisualViewport(), [])

  const showToast = useCallback((message: string, action?: ToastState['action']) => {
    setToast({ id: Date.now(), message, action })
  }, [])

  const closeSheet = useCallback(() => {
    hideKeyboard()
    setSheet(null)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const openAdd = (presetType: TransactionType = 'expense') => {
    haptic()
    setSheet({ kind: 'transaction', presetType })
  }

  const handleDelete = (transaction: Transaction) => {
    const removed = budget.deleteTransaction(transaction.id)
    if (!removed) return
    notify('success')
    showToast('Операция удалена', { label: 'Отменить', run: () => budget.restoreTransaction(removed) })
  }

  const handleSaved = (message: string) => showToast(message)

  const headerTitle = tab === 'home' ? 'Мой бюджет' : tab === 'history' ? 'История' : 'Мои карты'
  const historyCards = budget.summaries.filter(
    (card) => !card.archived || budget.state.transactions.some((tx) => tx.cardId === card.id),
  )
  const archivedCards = budget.summaries.filter((card) => card.archived)

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <span className="eyebrow">ПЛАНИРОВЩИК</span>
          <h1>{headerTitle}</h1>
        </div>
        {tab === 'history' ? (
          <button className="add-button" type="button" onClick={() => openAdd()}>＋</button>
        ) : null}
        {tab === 'cards' ? (
          <button className="add-button" type="button" onClick={() => { haptic(); setSheet({ kind: 'card' }) }}>＋</button>
        ) : null}
      </header>

      <main className="content">
        {tab === 'home' ? (
          <>
            <CardCarousel cards={budget.activeCards} total={budget.totalBalance} scope={budget.scope} onSelect={(next) => { haptic(); budget.setScope(next) }} />

            <section className="panel hero">
              <span className="eyebrow">ОСТАТОК · {budget.scopeLabel.toUpperCase()}</span>
              <div className="hero-amount mono">
                {money(budget.scoped.balance, { decimals: true })}
              </div>
              <div className="hero-stats">
                <div><span>Доходы</span><strong className="mono text-positive">+{money(budget.scoped.income)}</strong></div>
                <div><span>Расходы</span><strong className="mono text-negative">−{money(budget.scoped.expense)}</strong></div>
                <div><span>В цель</span><strong className="mono">{money(budget.scoped.saved)}</strong></div>
              </div>
              {budget.activeCards.length > 1 ? (
                <div className="breakdown">
                  {budget.activeCards.map((card) => (
                    <span key={card.id}>
                      <i style={{ background: card.color } as CSSProperties} />
                      {card.label || card.bank}
                      <b className="mono">{compactMoney(card.balance)}</b>
                    </span>
                  ))}
                </div>
              ) : null}
            </section>

            <div className="quick-actions">
              <button type="button" onClick={() => openAdd('income')}>
                <span className="quick-icon quick-icon--income">↙</span>
                Доход
              </button>
              <button type="button" onClick={() => openAdd('expense')}>
                <span className="quick-icon quick-icon--expense">↗</span>
                Расход
              </button>
              <button type="button" onClick={() => openAdd('saving')}>
                <span className="quick-icon quick-icon--saving">◎</span>
                Отложить
              </button>
            </div>

            <GoalCard
              goal={budget.state.goal}
              saved={budget.goalSaved}
              onEdit={() => { haptic(); setSheet({ kind: 'goal' }) }}
              onDeposit={() => openAdd('saving')}
            />

            <CategoryChart entries={budget.expenseByCategory} total={budget.scoped.expense} />

            <section className="panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">ПОСЛЕДНИЕ ОПЕРАЦИИ</span>
                  <h3>{budget.scopeLabel}</h3>
                </div>
                <button className="text-button" type="button" onClick={() => setTab('history')}>Все</button>
              </div>
              <TransactionList
                transactions={budget.scoped.transactions.slice(0, 5)}
                cards={budget.state.cards}
                customCategories={budget.state.customCategories}
                onEdit={(transaction) => setSheet({ kind: 'transaction', transaction })}
                onDelete={handleDelete}
              />
            </section>
          </>
        ) : null}

        {tab === 'history' ? (
          <>
            <div className="scope-chips">
              <button
                type="button"
                className={budget.scope === 'all' ? 'is-active' : ''}
                onClick={() => budget.setScope('all')}
              >
                Все карты
              </button>
              {historyCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className={budget.scope === card.id ? 'is-active' : ''}
                  onClick={() => budget.setScope(card.id)}
                >
                  {card.label || card.bank}
                </button>
              ))}
            </div>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">ОПЕРАЦИИ</span>
                  <h3>{budget.scopeLabel}</h3>
                </div>
                <span className="mono muted">{compactMoney(budget.scoped.balance)}</span>
              </div>
              <TransactionList
                transactions={budget.scoped.transactions}
                cards={budget.state.cards}
                customCategories={budget.state.customCategories}
                onEdit={(transaction) => setSheet({ kind: 'transaction', transaction })}
                onDelete={handleDelete}
                emptyText="Добавьте первую операцию"
              />
            </section>
          </>
        ) : null}

        {tab === 'cards' ? (
          <>
            <section className="panel total-card">
              <span className="eyebrow">СУММА ПО ВСЕМ КАРТАМ</span>
              <strong className="mono total-card__amount">{money(budget.totalBalance, { decimals: true })}</strong>
              <span className="muted">{budget.activeCards.length} активн. · {archivedCards.length} в архиве</span>
            </section>

            <div className="cards-list">
              {budget.activeCards.map((card) => (
                <section className="panel bank-card" key={card.id} style={{ '--card-color': card.color } as CSSProperties}>
                  <div className="bank-card__head">
                    <div className="bank-card__title">
                      <span className="bank-card__mark" />
                      <div>
                        <strong>{card.bank}</strong>
                        <span>{card.label || 'Карта'} · •••• {card.last4 || '0000'}</span>
                      </div>
                    </div>
                    <div className="bank-card__balance mono">{money(card.balance, { decimals: true })}</div>
                  </div>
                  <div className="bank-card__stats">
                    <span>+{money(card.income)}</span>
                    <span>−{money(card.expense)}</span>
                    <span>◎ {money(card.saved)}</span>
                  </div>
                  <div className="bank-card__actions">
                    <button type="button" onClick={() => setSheet({ kind: 'card', card })}>Изменить</button>
                    <button
                      type="button"
                      disabled={budget.activeCards.length <= 1}
                      title={budget.activeCards.length <= 1 ? 'Оставьте хотя бы одну активную карту' : undefined}
                      onClick={() => {
                        budget.setCardArchived(card.id, true)
                        showToast('Карта скрыта, операции сохранены', {
                          label: 'Вернуть',
                          run: () => budget.setCardArchived(card.id, false),
                        })
                      }}
                    >
                      Скрыть
                    </button>
                  </div>
                </section>
              ))}
            </div>

            {archivedCards.length ? (
              <section className="panel archive">
                <span className="eyebrow">АРХИВ</span>
                {archivedCards.map((card) => {
                  const txCount = budget.state.transactions.filter((tx) => tx.cardId === card.id).length
                  return (
                    <div className="archive-row" key={card.id}>
                      <div>
                        <strong>{card.bank}</strong>
                        <span className="mono">{money(card.balance)}</span>
                      </div>
                      <div className="archive-row__actions">
                        <button type="button" onClick={() => budget.setCardArchived(card.id, false)}>Вернуть</button>
                        {txCount === 0 ? (
                          <button type="button" className="danger-text" onClick={() => budget.deleteCard(card.id)}>Удалить</button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </section>
            ) : null}
          </>
        ) : null}
      </main>

      <BottomNav active={tab} onChange={(next) => { haptic(); setTab(next) }} />

      {sheet?.kind === 'transaction' ? (
        <TransactionSheet
          budget={budget}
          transaction={sheet.transaction}
          presetType={sheet.presetType}
          onClose={closeSheet}
          onSaved={handleSaved}
          onDeleted={(transaction) => {
            closeSheet()
            handleDelete(transaction)
          }}
        />
      ) : null}

      {sheet?.kind === 'card' ? (
        <CardSheet budget={budget} card={sheet.card} onClose={closeSheet} onSaved={handleSaved} />
      ) : null}

      {sheet?.kind === 'goal' ? (
        <GoalSheet budget={budget} onClose={closeSheet} onSaved={handleSaved} />
      ) : null}

      {toast ? (
        <div className="toast" role="status" key={toast.id}>
          <span>{toast.message}</span>
          {toast.action ? (
            <button
              type="button"
              onClick={() => {
                toast.action?.run()
                setToast(null)
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
