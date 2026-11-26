export type TransactionType = 'income' | 'expense' | 'saving' | 'creditPayment' | 'creditInterest'

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

export interface Credit {
  id: string
  name: string
  bank: string
  openingBalance: number
  /** Годовая ставка в процентах. */
  rate: number
  monthlyPayment: number
  /** Дата следующего платежа, YYYY-MM-DD. */
  dueDate: string
  /** Дата последнего ручного начисления процентов, YYYY-MM-DD. */
  lastAccrualDate: string
  color: string
  archived: boolean
  createdAt: number
}

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  categoryId: string
  cardId: string
  /** Кредит, к которому относится платёж или начисление процентов. */
  creditId?: string
  note: string
  date: string // YYYY-MM-DD (локальная дата)
  createdAt: number
  /** Отпечаток строки выписки, чтобы не импортировать её повторно. */
  sourceId?: string
}

export interface Goal {
  title: string
  target: number
}

export interface BudgetState {
  version: 3
  cards: Card[]
  credits: Credit[]
  transactions: Transaction[]
  customCategories: Category[]
  goal: Goal
  updatedAt: number
}

export type TransactionInput = Omit<Transaction, 'id' | 'createdAt'>

export interface CardSummary extends Card {
  balance: number
  income: number
  expense: number
  saved: number
  creditPaid: number
}

export interface CreditSummary extends Credit {
  payments: number
  interest: number
  remaining: number
  paid: number
  overpay: number
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
