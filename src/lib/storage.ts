import type { BudgetState } from '../types'
import { cloudGet, cloudSet } from './telegram'

const STATE_KEY = 'planirovshik.budget.v1'
const SCOPE_KEY = 'planirovshik.scope.v1'

export function defaultState(): BudgetState {
  return {
    version: 1,
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
    transactions: [],
    goal: { title: 'Цель накоплений', target: 100_000 },
    updatedAt: Date.now(),
  }
}

function isValidState(value: unknown): value is BudgetState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<BudgetState>
  return (
    state.version === 1 &&
    Array.isArray(state.cards) &&
    Array.isArray(state.transactions) &&
    Boolean(state.goal) &&
    typeof state.goal?.target === 'number'
  )
}

export function loadLocal(): BudgetState {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (!raw) return defaultState()
    const parsed: unknown = JSON.parse(raw)
    return isValidState(parsed) ? parsed : defaultState()
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
    const parsed: unknown = JSON.parse(raw)
    if (isValidState(parsed) && parsed.updatedAt > local.updatedAt) {
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
