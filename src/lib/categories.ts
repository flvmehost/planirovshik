import type { Category, TransactionType } from '../types'

export const CATEGORIES: Category[] = [
  { id: 'food', label: 'Еда', emoji: '🍔', color: '#FF9F43', kind: 'expense' },
  { id: 'transport', label: 'Транспорт', emoji: '🚕', color: '#5B8DEF', kind: 'expense' },
  { id: 'home', label: 'Дом', emoji: '🏠', color: '#8B7CF6', kind: 'expense' },
  { id: 'shopping', label: 'Покупки', emoji: '🛍️', color: '#F4719B', kind: 'expense' },
  { id: 'health', label: 'Здоровье', emoji: '💊', color: '#35C7A2', kind: 'expense' },
  { id: 'fun', label: 'Досуг', emoji: '🎉', color: '#FFC93C', kind: 'expense' },
  { id: 'other-expense', label: 'Прочее', emoji: '📦', color: '#9AA3B2', kind: 'expense' },
  { id: 'salary', label: 'Зарплата', emoji: '💼', color: '#34C759', kind: 'income' },
  { id: 'freelance', label: 'Подработка', emoji: '💻', color: '#3BA7FF', kind: 'income' },
  { id: 'gift', label: 'Подарки', emoji: '🎁', color: '#F4719B', kind: 'income' },
  { id: 'other-income', label: 'Прочее', emoji: '💰', color: '#9AA3B2', kind: 'income' },
  { id: 'goal', label: 'В цель', emoji: '🎯', color: '#A78BFA', kind: 'saving' },
  { id: 'reserve', label: 'Резерв', emoji: '🏦', color: '#35C7A2', kind: 'saving' },
  { id: 'credit-payment', label: 'В кредит', emoji: '💳', color: '#F97316', kind: 'creditPayment' },
  { id: 'credit-interest', label: 'Проценты', emoji: '📈', color: '#EC4899', kind: 'creditInterest' },
]

/** Эмодзи и цвета для пользовательских категорий. */
export const CATEGORY_EMOJIS = [
  '✨', '🍕', '☕', '🛒', '🚌', '🏠', '💡', '📱',
  '🎮', '🏋️', '🎁', '💼', '💻', '🐾', '🎓', '✈️',
]

export const CARD_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#10B981', '#64748B']

export const CATEGORY_COLORS = [...CARD_COLORS, '#FF9F43', '#FFC93C', '#35C7A2', '#A78BFA']

export function categoriesFor(kind: TransactionType, custom: Category[] = []): Category[] {
  return [...CATEGORIES, ...custom].filter((category) => category.kind === kind)
}

export function getCategory(id: string, custom: Category[] = [], kind: TransactionType = 'expense'): Category {
  const found = [...CATEGORIES, ...custom].find((category) => category.id === id)
  if (found) return found
  const fallback =
    kind === 'income'
      ? 'other-income'
      : kind === 'saving'
        ? 'goal'
        : kind === 'creditPayment'
          ? 'credit-payment'
          : kind === 'creditInterest'
            ? 'credit-interest'
            : 'other-expense'
  return CATEGORIES.find((category) => category.id === fallback) ?? CATEGORIES[6]
}
