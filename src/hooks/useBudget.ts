import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getCategory } from '../lib/categories'
import { hydrateFromCloud, loadLocal, loadScope, saveLocal, saveScope, scheduleCloudSync } from '../lib/storage'
import type {
  BudgetState,
  Card,
  CardSummary,
  Category,
  Credit,
  CreditSummary,
  Goal,
  Transaction,
  TransactionInput,
} from '../types'
import { newId } from '../types'

export interface CategoryTotal {
  id: string
  label: string
  emoji: string
  color: string
  amount: number
  share: number
}

function stamp(previous: number): number {
  return Math.max(Date.now(), previous + 1)
}

export function useBudget() {
  const [state, setState] = useState<BudgetState>(() => loadLocal())
  const [scope, setScopeState] = useState<string>(() => loadScope())
  const [hydrated, setHydrated] = useState(false)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    let alive = true
    void hydrateFromCloud(loadLocal()).then((next) => {
      if (!alive) return
      setState(next)
      setHydrated(true)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    saveLocal(state)
    if (hydrated) scheduleCloudSync(state)
  }, [state, hydrated])

  const setScope = useCallback((next: string) => {
    setScopeState(next)
    saveScope(next)
  }, [])

  const summaries = useMemo<CardSummary[]>(
    () =>
      state.cards.map((card) => {
        let income = 0
        let expense = 0
        let saved = 0
        let creditPaid = 0
        for (const tx of state.transactions) {
          if (tx.cardId !== card.id) continue
          if (tx.type === 'income') income += tx.amount
          else if (tx.type === 'expense') expense += tx.amount
          else if (tx.type === 'saving') saved += tx.amount
          else if (tx.type === 'creditPayment') creditPaid += tx.amount
        }
        return {
          ...card,
          income,
          expense,
          saved,
          creditPaid,
          balance: card.openingBalance + income - expense - saved - creditPaid,
        }
      }),
    [state.cards, state.transactions],
  )

  const creditSummaries = useMemo<CreditSummary[]>(
    () =>
      state.credits.map((credit) => {
        let payments = 0
        let interest = 0
        for (const tx of state.transactions) {
          if (tx.creditId !== credit.id) continue
          if (tx.type === 'creditPayment') payments += tx.amount
          else if (tx.type === 'creditInterest') interest += tx.amount
        }
        const debt = credit.openingBalance + interest
        return {
          ...credit,
          payments,
          interest,
          remaining: Math.max(0, debt - payments),
          paid: Math.min(debt, payments),
          overpay: Math.max(0, payments - debt),
        }
      }),
    [state.credits, state.transactions],
  )

  const totalBalance = useMemo(() => summaries.reduce((sum, card) => sum + card.balance, 0), [summaries])
  const activeCards = useMemo(() => summaries.filter((card) => !card.archived), [summaries])
  const totalCredit = useMemo(
    () => creditSummaries.reduce((sum, credit) => sum + credit.remaining, 0),
    [creditSummaries],
  )
  const netWorth = useMemo(() => totalBalance - totalCredit, [totalBalance, totalCredit])

  const scoped = useMemo(() => {
    const creditScope = scope.startsWith('credit:') ? scope.slice(7) : null
    const transactions = creditScope
      ? state.transactions.filter((tx) => tx.creditId === creditScope)
      : scope === 'all'
        ? state.transactions
        : state.transactions.filter((tx) => tx.cardId === scope)
    const income = transactions.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0)
    const expense = transactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0)
    const saved = transactions.filter((tx) => tx.type === 'saving').reduce((sum, tx) => sum + tx.amount, 0)
    const creditPaid = transactions
      .filter((tx) => tx.type === 'creditPayment')
      .reduce((sum, tx) => sum + tx.amount, 0)
    const cards = creditScope
      ? []
      : scope === 'all'
        ? summaries
        : summaries.filter((card) => card.id === scope)
    return {
      transactions: [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
      income,
      expense,
      saved,
      creditPaid,
      balance: creditScope
        ? creditSummaries.find((credit) => credit.id === creditScope)?.remaining ?? 0
        : cards.reduce((sum, card) => sum + card.balance, 0),
      cards,
    }
  }, [scope, state.transactions, summaries, creditSummaries])

  const goalSaved = useMemo(
    () => state.transactions.filter((tx) => tx.type === 'saving').reduce((sum, tx) => sum + tx.amount, 0),
    [state.transactions],
  )

  const expenseByCategory = useMemo<CategoryTotal[]>(() => {
    const totals = new Map<string, number>()
    for (const tx of scoped.transactions) {
      if (tx.type !== 'expense') continue
      totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + tx.amount)
    }
    return [...totals.entries()]
      .map(([id, amount]) => {
        const category = getCategory(id, state.customCategories, 'expense')
        return {
          id,
          label: category.label,
          emoji: category.emoji,
          color: category.color,
          amount,
          share: scoped.expense ? Math.round((amount / scoped.expense) * 100) : 0,
        }
      })
      .sort((a, b) => b.amount - a.amount)
  }, [scoped, state.customCategories])

  const addCard = useCallback((input: Omit<Card, 'id' | 'createdAt' | 'archived'>) => {
    const id = newId()
    setState((prev) => ({
      ...prev,
      cards: [...prev.cards, { ...input, id, archived: false, createdAt: Date.now() }],
      updatedAt: stamp(prev.updatedAt),
    }))
    setScope(id)
    return id
  }, [])

  const updateCard = useCallback((id: string, patch: Partial<Omit<Card, 'id' | 'createdAt'>>) => {
    setState((prev) => ({
      ...prev,
      cards: prev.cards.map((card) => (card.id === id ? { ...card, ...patch } : card)),
      updatedAt: stamp(prev.updatedAt),
    }))
  }, [])

  const setCardArchived = useCallback((id: string, archived: boolean) => {
    setState((prev) => {
      const activeCount = prev.cards.filter((card) => !card.archived).length
      if (archived && activeCount <= 1) return prev
      return {
        ...prev,
        cards: prev.cards.map((card) => (card.id === id ? { ...card, archived } : card)),
        updatedAt: stamp(prev.updatedAt),
      }
    })
    if (archived && scope === id) setScope('all')
  }, [scope, setScope])

  const addCredit = useCallback((input: Omit<Credit, 'id' | 'createdAt' | 'archived'>) => {
    const id = newId()
    setState((prev) => ({
      ...prev,
      credits: [...prev.credits, { ...input, id, archived: false, createdAt: Date.now() }],
      updatedAt: stamp(prev.updatedAt),
    }))
    return id
  }, [])

  const updateCredit = useCallback((id: string, patch: Partial<Omit<Credit, 'id' | 'createdAt'>>) => {
    setState((prev) => ({
      ...prev,
      credits: prev.credits.map((credit) => (credit.id === id ? { ...credit, ...patch } : credit)),
      updatedAt: stamp(prev.updatedAt),
    }))
  }, [])

  const deleteCredit = useCallback((id: string) => {
    if (stateRef.current.transactions.some((tx) => tx.creditId === id)) return false
    setState((prev) => ({
      ...prev,
      credits: prev.credits.filter((credit) => credit.id !== id),
      updatedAt: stamp(prev.updatedAt),
    }))
    if (scope === `credit:${id}`) setScope('all')
    return true
  }, [scope, setScope])

  const markCreditAccrued = useCallback((id: string, date: string) => {
    setState((prev) => ({
      ...prev,
      credits: prev.credits.map((credit) => (credit.id === id ? { ...credit, lastAccrualDate: date } : credit)),
      updatedAt: stamp(prev.updatedAt),
    }))
  }, [])

  const addCategory = useCallback((input: Omit<Category, 'id'>) => {
    const id = `custom-${newId()}`
    setState((prev) => ({
      ...prev,
      customCategories: [...prev.customCategories, { ...input, id }],
      updatedAt: stamp(prev.updatedAt),
    }))
    return id
  }, [])

  const updateCategory = useCallback((id: string, patch: Partial<Pick<Category, 'label' | 'emoji' | 'color'>>) => {
    if (!id.startsWith('custom-')) return
    setState((prev) => ({
      ...prev,
      customCategories: prev.customCategories.map((category) =>
        category.id === id ? { ...category, ...patch } : category,
      ),
      updatedAt: stamp(prev.updatedAt),
    }))
  }, [])

  const deleteCategory = useCallback((id: string) => {
    const category = stateRef.current.customCategories.find((item) => item.id === id)
    if (!category) return false
    const fallback = category.kind === 'income' ? 'other-income' : category.kind === 'saving' ? 'goal' : 'other-expense'
    setState((prev) => ({
      ...prev,
      customCategories: prev.customCategories.filter((item) => item.id !== id),
      transactions: prev.transactions.map((tx) =>
        tx.categoryId === id ? { ...tx, categoryId: fallback } : tx,
      ),
      updatedAt: stamp(prev.updatedAt),
    }))
    return true
  }, [])

  const deleteCard = useCallback((id: string) => {
    if (stateRef.current.transactions.some((tx) => tx.cardId === id)) return false
    setState((prev) => ({
      ...prev,
      cards: prev.cards.filter((card) => card.id !== id),
      updatedAt: stamp(prev.updatedAt),
    }))
    if (scope === id) setScope('all')
    return true
  }, [scope, setScope])

  const addTransaction = useCallback((input: TransactionInput) => {
    const id = newId()
    setState((prev) => ({
      ...prev,
      transactions: [...prev.transactions, { ...input, id, createdAt: Date.now() }],
      updatedAt: stamp(prev.updatedAt),
    }))
    return id
  }, [])

  const addTransactions = useCallback((inputs: TransactionInput[]) => {
    if (!inputs.length) return 0
    const now = Date.now()
    setState((prev) => ({
      ...prev,
      transactions: [
        ...prev.transactions,
        ...inputs.map((input, index) => ({ ...input, id: newId(), createdAt: now + index })),
      ],
      updatedAt: stamp(prev.updatedAt),
    }))
    return inputs.length
  }, [])

  const updateTransaction = useCallback((id: string, input: TransactionInput) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((tx) => (tx.id === id ? { ...tx, ...input } : tx)),
      updatedAt: stamp(prev.updatedAt),
    }))
  }, [])

  const deleteTransaction = useCallback((id: string) => {
    const removed = stateRef.current.transactions.find((tx) => tx.id === id)
    if (!removed) return undefined
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((tx) => tx.id !== id),
      updatedAt: stamp(prev.updatedAt),
    }))
    return removed
  }, [])

  const restoreTransaction = useCallback((transaction: Transaction) => {
    setState((prev) => ({
      ...prev,
      transactions: [...prev.transactions, transaction],
      updatedAt: stamp(prev.updatedAt),
    }))
  }, [])

  const updateGoal = useCallback((patch: Partial<Goal>) => {
    setState((prev) => ({
      ...prev,
      goal: { ...prev.goal, ...patch },
      updatedAt: stamp(prev.updatedAt),
    }))
  }, [])

  const scopeLabel = scope.startsWith('credit:')
    ? state.credits.find((credit) => credit.id === scope.slice(7))?.name ?? 'Кредит'
    : scope === 'all'
      ? 'Все карты'
      : summaries.find((card) => card.id === scope)?.bank ?? 'Карта'

  return {
    state,
    hydrated,
    scope,
    setScope,
    scopeLabel,
    summaries,
    activeCards,
    totalBalance,
    creditSummaries,
    totalCredit,
    netWorth,
    scoped,
    goalSaved,
    expenseByCategory,
    addCard,
    updateCard,
    setCardArchived,
    deleteCard,
    addCredit,
    updateCredit,
    deleteCredit,
    markCreditAccrued,
    addCategory,
    updateCategory,
    deleteCategory,
    addTransaction,
    addTransactions,
    updateTransaction,
    deleteTransaction,
    restoreTransaction,
    updateGoal,
  }
}

export type Budget = ReturnType<typeof useBudget>
