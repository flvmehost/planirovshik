import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { BottomNav, type Tab } from './components/BottomNav'
import { CardCarousel } from './components/CardCarousel'
import { CardSheet } from './components/CardSheet'
import { CategoryChart } from './components/CategoryChart'
import { CreditOperationSheet } from './components/CreditOperationSheet'
import { CreditSheet } from './components/CreditSheet'
import { GoalCard } from './components/GoalCard'
import { GoalSheet } from './components/GoalSheet'
import { ImportSheet } from './components/ImportSheet'
import { TransactionList } from './components/TransactionList'
import { TransactionSheet } from './components/TransactionSheet'
import { useBudget } from './hooks/useBudget'
import { shortDate } from './lib/creditSchedule'
import { compactMoney, money } from './lib/format'
import { clearImportToken, readImportToken } from './lib/importApi'
import { hideKeyboard, haptic, initTelegram, notify, watchVisualViewport } from './lib/telegram'
import type { Card, Credit, Transaction, TransactionType } from './types'

type SheetState =
  | { kind: 'transaction'; transaction?: Transaction; presetType?: TransactionType }
  | { kind: 'card'; card?: Card }
  | { kind: 'credit'; credit?: Credit }
  | { kind: 'creditOperation'; mode: 'payment' | 'interest'; creditId?: string }
  | { kind: 'goal' }
  | { kind: 'import'; token?: string }
  | null

interface ToastState {
  id: number
  message: string
  action?: { label: string; run: () => void }
}

function paymentWord(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'платёж'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'платежа'
  return 'платежей'
}

export default function App() {
  const budget = useBudget()
  const [tab, setTab] = useState<Tab>('home')
  const [importToken] = useState(() => readImportToken())
  const [sheet, setSheet] = useState<SheetState>(() =>
    importToken ? { kind: 'import', token: importToken } : null,
  )
  const [toast, setToast] = useState<ToastState | null>(null)
  const [, setThemeTick] = useState(0)

  useEffect(() => initTelegram(() => setThemeTick((value) => value + 1)), [])
  useEffect(() => watchVisualViewport(), [])
  useEffect(() => {
    if (importToken) clearImportToken()
  }, [importToken])

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

  const headerTitle =
    tab === 'home' ? 'Мой бюджет' : tab === 'history' ? 'История' : tab === 'cards' ? 'Мои карты' : 'Мои кредиты'
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
        {tab === 'credits' ? (
          <button className="add-button" type="button" onClick={() => { haptic(); setSheet({ kind: 'credit' }) }}>＋</button>
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
                <div><span>В кредит</span><strong className="mono">{money(budget.scoped.creditPaid)}</strong></div>
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
                credits={budget.state.credits}
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
              {budget.creditSummaries
                .filter((credit) => !credit.archived || credit.payments > 0 || credit.interest > 0)
                .map((credit) => (
                  <button
                    key={credit.id}
                    type="button"
                    className={budget.scope === `credit:${credit.id}` ? 'is-active' : ''}
                    onClick={() => budget.setScope(`credit:${credit.id}`)}
                  >
                    💳 {credit.name}
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
                credits={budget.state.credits}
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
            <section className="panel import-entry">
              <div>
                <span className="eyebrow">ИМПОРТ</span>
                <h3>Загрузить выписку</h3>
                <p className="muted">PDF из банка — операции добавятся списком на проверку</p>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  haptic()
                  setSheet({ kind: 'import' })
                }}
              >
                Выбрать файл
              </button>
            </section>

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
                    <span>💳 {money(card.creditPaid)}</span>
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

        {tab === 'credits' ? (
          <>
            <section className="panel total-card">
              <span className="eyebrow">ОСТАТОК ПО КРЕДИТАМ</span>
              <strong className="mono total-card__amount">{money(budget.totalCredit, { decimals: true })}</strong>
              <span className="muted">Чистые деньги: {money(budget.netWorth, { decimals: true })}</span>
            </section>

            <div className="credit-list">
              {budget.creditSummaries
                .filter((credit) => !credit.archived)
                .map((credit) => {
                  const total = credit.openingBalance + credit.interest
                  const progress = total > 0 ? Math.min(100, Math.round((credit.paid / total) * 100)) : 100
                  const remainingPayments = credit.remainingPayments
                  return (
                    <section className="panel credit-card" key={credit.id} style={{ '--card-color': credit.color } as CSSProperties}>
                      <div className="bank-card__head">
                        <div className="bank-card__title">
                          <span className="bank-card__mark" />
                          <div>
                            <strong>{credit.name}</strong>
                            <span>{credit.bank || 'Кредит'}</span>
                          </div>
                        </div>
                        <div className="bank-card__balance mono">{money(credit.remaining, { decimals: true })}</div>
                      </div>

                      <div className="credit-progress">
                        <div className="credit-progress__track">
                          <div className="credit-progress__fill" style={{ width: `${progress}%` }} />
                        </div>
                        <span>{progress}% выплачено</span>
                      </div>

                      <div className="bank-card__stats">
                        <span>Было {money(credit.openingBalance, { decimals: true })}</span>
                        <span>% {money(credit.interest, { decimals: true })}</span>
                        <span>Платеж {money(credit.monthlyPayment, { decimals: true })}</span>
                      </div>

                      {credit.firstPaymentDate && credit.lastPaymentDate ? (
                        <div className="credit-due">
                          Срок: {shortDate(credit.firstPaymentDate)} — {shortDate(credit.lastPaymentDate)} ·{' '}
                          {credit.termMonths} мес.
                        </div>
                      ) : null}

                      {credit.nextPaymentDate ? (
                        <div className="credit-due">Следующий платёж: {shortDate(credit.nextPaymentDate)}</div>
                      ) : null}

                      {remainingPayments > 0 ? (
                        <div className="credit-due">
                          Осталось {remainingPayments} {paymentWord(remainingPayments)}
                        </div>
                      ) : null}
                      {credit.overpay > 0 ? (
                        <div className="credit-due">Переплата: {money(credit.overpay, { decimals: true })}</div>
                      ) : null}

                      <div className="bank-card__actions">
                        <button
                          type="button"
                          disabled={credit.remaining <= 0}
                          onClick={() => {
                            haptic()
                            setSheet({ kind: 'creditOperation', mode: 'payment', creditId: credit.id })
                          }}
                        >
                          Погасить
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            haptic()
                            setSheet({ kind: 'creditOperation', mode: 'interest', creditId: credit.id })
                          }}
                        >
                          Проценты
                        </button>
                        <button type="button" onClick={() => setSheet({ kind: 'credit', credit })}>
                          Изменить
                        </button>
                      </div>
                      <div className="bank-card__actions bank-card__actions--secondary">
                        <button
                          type="button"
                          onClick={() => {
                            budget.updateCredit(credit.id, { archived: true })
                            showToast('Кредит закрыт', {
                              label: 'Вернуть',
                              run: () => budget.updateCredit(credit.id, { archived: false }),
                            })
                          }}
                        >
                          Закрыть
                        </button>
                      </div>
                    </section>
                  )
                })}
            </div>

            {budget.creditSummaries.some((credit) => credit.archived) ? (
              <section className="panel archive">
                <span className="eyebrow">ЗАКРЫТЫЕ КРЕДИТЫ</span>
                {budget.creditSummaries
                  .filter((credit) => credit.archived)
                  .map((credit) => (
                    <div className="archive-row" key={credit.id}>
                      <div>
                        <strong>{credit.name}</strong>
                        <span className="mono">{money(credit.remaining, { decimals: true })}</span>
                      </div>
                      <div className="archive-row__actions">
                        <button type="button" onClick={() => budget.updateCredit(credit.id, { archived: false })}>
                          Вернуть
                        </button>
                        <button
                          type="button"
                          className="danger-text"
                          onClick={() => {
                            if (!budget.deleteCredit(credit.id)) {
                              showToast('Удалите сначала операции по этому кредиту')
                            }
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
              </section>
            ) : null}

            {!budget.creditSummaries.length ? (
              <div className="empty-state">
                <span className="empty-state__icon">💳</span>
                <p>Добавьте кредит, чтобы отслеживать долг и платежи</p>
              </div>
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

      {sheet?.kind === 'credit' ? (
        <CreditSheet budget={budget} credit={sheet.credit} onClose={closeSheet} onSaved={handleSaved} />
      ) : null}

      {sheet?.kind === 'creditOperation' ? (
        <CreditOperationSheet
          budget={budget}
          mode={sheet.mode}
          creditId={sheet.creditId}
          onClose={closeSheet}
          onSaved={handleSaved}
        />
      ) : null}

      {sheet?.kind === 'goal' ? (
        <GoalSheet budget={budget} onClose={closeSheet} onSaved={handleSaved} />
      ) : null}

      {sheet?.kind === 'import' ? (
        <ImportSheet
          budget={budget}
          initialToken={sheet.token}
          onClose={closeSheet}
          onSaved={handleSaved}
        />
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
