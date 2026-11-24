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
]

export function categoriesFor(kind: TransactionType): Category[] {
  return CATEGORIES.filter((category) => category.kind === kind)
}

export function getCategory(id: string): Category {
  return CATEGORIES.find((category) => category.id === id) ?? CATEGORIES[6]
}

export const CARD_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#10B981', '#64748B']
