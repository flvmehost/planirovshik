import type { BudgetState, Category, Credit, TransactionType } from '../types'
import { cloudGet, cloudSet } from './telegram'

const STATE_KEY = 'planirovshik.budget.v1'
const SCOPE_KEY = 'planirovshik.scope.v1'
const TYPES: TransactionType[] = ['income', 'expense', 'saving', 'creditPayment', 'creditInterest']

export function defaultState(): BudgetState {
  return {
    version: 3,
    cards: [
      {
        id: 'default-card',
        bank: 'Моя карта',
        label: 'Основная',
        last4: '0000',
        color: '#3B82F6',
        openingBalance: 0,
        archived: false,
        createdAt: Date.now(),
      },
    ],
    credits: [],
    transactions: [],
    customCategories: [],
    goal: { title: 'Цель накоплений', target: 100_000 },
    updatedAt: Date.now(),
  }
}

function readCategories(value: unknown): Category[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Category => {
    if (!item || typeof item !== 'object') return false
    const category = item as Partial<Category>
    return (
      typeof category.id === 'string' &&
      category.id.startsWith('custom-') &&
      typeof category.label === 'string' &&
      category.label.trim().length > 0 &&
      typeof category.emoji === 'string' &&
      typeof category.color === 'string' &&
      TYPES.includes(category.kind as TransactionType)
    )
  })
}

function readCredits(value: unknown): Credit[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Credit => {
      if (!item || typeof item !== 'object') return false
      const credit = item as Partial<Credit>
      return (
        typeof credit.id === 'string' &&
        typeof credit.name === 'string' &&
        credit.name.trim().length > 0 &&
        typeof credit.openingBalance === 'number'
      )
    })
    .map((credit) => ({
      ...credit,
      bank: credit.bank ?? '',
      rate: typeof credit.rate === 'number' ? credit.rate : 0,
      monthlyPayment: typeof credit.monthlyPayment === 'number' ? credit.monthlyPayment : 0,
      dueDate: credit.dueDate ?? '',
      lastAccrualDate: credit.lastAccrualDate ?? '',
      color: credit.color ?? '#F97316',
      archived: credit.archived ?? false,
      createdAt: typeof credit.createdAt === 'number' ? credit.createdAt : Date.now(),
    }))
}

/** Читает состояние любой поддерживаемой версии и приводит его к текущей. */
interface StoredState {
  version?: number
  cards?: unknown
  credits?: unknown
  transactions?: unknown
  customCategories?: unknown
  goal?: { title?: string; target?: number }
  updatedAt?: number
}

function migrateState(value: unknown): BudgetState | null {
  if (!value || typeof value !== 'object') return null
  const state = value as StoredState
  if (state.version !== 1 && state.version !== 2 && state.version !== 3) return null
  if (!Array.isArray(state.cards) || !Array.isArray(state.transactions)) return null
  if (!state.goal || typeof state.goal.target !== 'number') return null
  return {
    version: 3,
    cards: state.cards as BudgetState['cards'],
    credits: readCredits(state.credits),
    transactions: state.transactions as BudgetState['transactions'],
    customCategories: readCategories(state.customCategories),
    goal: { title: state.goal.title ?? 'Цель накоплений', target: state.goal.target },
    updatedAt: typeof state.updatedAt === 'number' ? state.updatedAt : Date.now(),
  }
}

export function loadLocal(): BudgetState {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (!raw) return defaultState()
    const parsed: unknown = JSON.parse(raw)
    return migrateState(parsed) ?? defaultState()
  } catch {
    return defaultState()
  }
}

export function saveLocal(state: BudgetState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    // Приватный режим WebView может запретить запись — работает облако.
  }
}

export function loadScope(): string {
  try {
    return localStorage.getItem(SCOPE_KEY) ?? 'all'
  } catch {
    return 'all'
  }
}

export function saveScope(scope: string): void {
  try {
    localStorage.setItem(SCOPE_KEY, scope)
  } catch {
    // Игнорируем.
  }
}

/** Берём более свежую версию из Telegram CloudStorage, если она есть. */
export async function hydrateFromCloud(local: BudgetState): Promise<BudgetState> {
  const raw = await cloudGet(STATE_KEY)
  if (!raw) {
    await cloudSet(STATE_KEY, JSON.stringify(local))
    return local
  }
  try {
    const parsed = migrateState(JSON.parse(raw))
    if (parsed && parsed.updatedAt > local.updatedAt) {
      saveLocal(parsed)
      return parsed
    }
  } catch {
    // Битые данные в облаке не мешают локальной версии.
  }
  await cloudSet(STATE_KEY, JSON.stringify(local))
  return local
}

let syncTimer: number | undefined

export function scheduleCloudSync(state: BudgetState, delay = 600): void {
  window.clearTimeout(syncTimer)
  syncTimer = window.setTimeout(() => {
    void cloudSet(STATE_KEY, JSON.stringify(state))
  }, delay)
}
