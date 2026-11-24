export type TransactionType = 'income' | 'expense' | 'saving'

export interface Category {
  id: string
  label: string
  emoji: string
  color: string
  kind: TransactionType
}

export interface Card {
  id: string
  bank: string
  label: string
  last4: string
  color: string
  openingBalance: number
  archived: boolean
  createdAt: number
}

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  categoryId: string
  cardId: string
  note: string
  date: string // YYYY-MM-DD (локальная дата)
  createdAt: number
}

export interface Goal {
  title: string
  target: number
}

export interface BudgetState {
  version: 1
  cards: Card[]
  transactions: Transaction[]
  goal: Goal
  updatedAt: number
}

export type TransactionInput = Omit<Transaction, 'id' | 'createdAt'>

export interface CardSummary extends Card {
  balance: number
  income: number
  expense: number
  saved: number
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
