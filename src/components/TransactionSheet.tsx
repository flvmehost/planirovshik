import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Budget } from '../hooks/useBudget'
import { categoriesFor, CATEGORY_COLORS, CATEGORY_EMOJIS } from '../lib/categories'
import { todayLocal } from '../lib/format'
import { haptic, isTelegram, notify, setupMainButton } from '../lib/telegram'
import type { Category, Transaction, TransactionType } from '../types'
import { Sheet } from './Sheet'

interface Props {
  budget: Budget
  transaction?: Transaction
  presetType?: TransactionType
  onClose: () => void
  onSaved: (message: string) => void
  onDeleted: (transaction: Transaction) => void
}

const TYPE_TABS: { id: TransactionType; label: string }[] = [
  { id: 'expense', label: '− Расход' },
  { id: 'income', label: '+ Доход' },
  { id: 'saving', label: '→ В цель' },
]

type CategoryDraft =
  | { mode: 'create'; label: string; emoji: string; color: string }
  | { mode: 'edit'; id: string; label: string; emoji: string; color: string }

export function TransactionSheet({ budget, transaction, presetType, onClose, onSaved, onDeleted }: Props) {
  const availableCards = useMemo(
    () => budget.summaries.filter((card) => !card.archived || card.id === transaction?.cardId),
    [budget.summaries, transaction],
  )

  const [type, setType] = useState<TransactionType>(transaction?.type ?? presetType ?? 'expense')
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '')
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? categoriesFor(presetType ?? 'expense')[0].id)
  const [cardId, setCardId] = useState(
    transaction?.cardId ?? (budget.scope !== 'all' ? budget.scope : budget.activeCards[0]?.id ?? ''),
  )
  const [note, setNote] = useState(transaction?.note ?? '')
  const [date, setDate] = useState(transaction?.date ?? todayLocal())
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null)

  const categories = useMemo(
    () => categoriesFor(type, budget.state.customCategories),
    [type, budget.state.customCategories],
  )
  const selectedCustom = budget.state.customCategories.find((category) => category.id === categoryId)

  const parsedAmount = Number(amount.replace(/\s/g, '').replace(',', '.'))
  const valid = Number.isFinite(parsedAmount) && parsedAmount > 0 && Boolean(categoryId) && Boolean(cardId)

  const changeType = (next: TransactionType) => {
    haptic()
    setType(next)
    setCategoryDraft(null)
    setCategoryId(categoriesFor(next)[0].id)
  }

  const openCreateCategory = () => {
    haptic()
    setCategoryDraft({ mode: 'create', label: '', emoji: '✨', color: CATEGORY_COLORS[0] })
  }

  const openEditCategory = (category: Category) => {
    haptic()
    setCategoryDraft({
      mode: 'edit',
      id: category.id,
      label: category.label,
      emoji: category.emoji,
      color: category.color,
    })
  }

  const patchDraft = (patch: Partial<Pick<CategoryDraft, 'label' | 'emoji' | 'color'>>) => {
    setCategoryDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const saveCategory = useCallback(() => {
    if (!categoryDraft || !categoryDraft.label.trim()) {
      notify('error')
      return
    }
    const input = {
      label: categoryDraft.label.trim(),
      emoji: categoryDraft.emoji,
      color: categoryDraft.color,
    }
    if (categoryDraft.mode === 'create') {
      const id = budget.addCategory({ ...input, kind: type })
      setCategoryId(id)
      onSaved('Категория добавлена')
    } else {
      budget.updateCategory(categoryDraft.id, input)
      onSaved('Категория обновлена')
    }
    setCategoryDraft(null)
    haptic('medium')
  }, [categoryDraft, type, budget, onSaved])

  const deleteSelectedCategory = useCallback(() => {
    if (!categoryDraft || categoryDraft.mode !== 'edit') return
    const removed = budget.deleteCategory(categoryDraft.id)
    if (!removed) return
    if (categoryId === categoryDraft.id) setCategoryId(categoriesFor(type)[0].id)
    setCategoryDraft(null)
    haptic('medium')
    onSaved('Категория удалена, операции перенесены в «Прочее»')
  }, [categoryDraft, categoryId, type, budget, onSaved])

  const save = useCallback(() => {
    if (!valid) {
      notify('error')
      return
    }
    const input = {
      type,
      amount: Math.round(parsedAmount * 100) / 100,
      categoryId,
      cardId,
      note: note.trim(),
      date,
    }
    if (transaction) {
      budget.updateTransaction(transaction.id, input)
      onSaved('Операция обновлена')
    } else {
      budget.addTransaction(input)
      onSaved(type === 'saving' ? 'Отложено в цель' : type === 'income' ? 'Доход добавлен' : 'Расход добавлен')
    }
    haptic('medium')
    onClose()
  }, [valid, parsedAmount, type, categoryId, cardId, note, date, transaction, budget, onSaved, onClose])

  const actionRef = useRef(save)
  actionRef.current = categoryDraft ? saveCategory : save
  const mainButtonText = categoryDraft
    ? categoryDraft.mode === 'create' ? 'Создать категорию' : 'Сохранить категорию'
    : transaction ? 'Сохранить' : 'Добавить'
  useEffect(
    () => setupMainButton(mainButtonText, () => actionRef.current()),
    [mainButtonText],
  )

  const title = transaction ? 'Редактировать операцию' : 'Новая операция'

  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        isTelegram() ? null : categoryDraft ? (
          <button
            type="button"
            className="primary-button"
            disabled={!categoryDraft.label.trim()}
            onClick={saveCategory}
          >
            {categoryDraft.mode === 'create' ? 'Создать категорию' : 'Сохранить категорию'}
          </button>
        ) : (
          <button type="button" className="primary-button" disabled={!valid} onClick={save}>
            {transaction ? 'Сохранить' : 'Добавить'}
          </button>
        )
      }
    >
      <div className="sheet-pin">
        <div className="segmented">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={type === tab.id ? 'is-active' : ''}
              onClick={() => changeType(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <label className="field">
          <span className="field-label">Сумма</span>
          <div className="amount-field">
            <input
              className="mono"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^\d.,\s]/g, ''))}
            />
            <span>₽</span>
          </div>
        </label>
      </div>

      <div className="field">
        <span className="field-label">Категория</span>
        <div className="chip-grid">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`chip${categoryId === category.id ? ' is-active' : ''}`}
              onClick={() => {
                haptic()
                setCategoryId(category.id)
                setCategoryDraft(null)
              }}
            >
              <span>{category.emoji}</span>
              {category.label}
            </button>
          ))}
          {type !== 'saving' ? (
            <button type="button" className="chip chip--add" onClick={openCreateCategory}>
              ＋ Своя
            </button>
          ) : null}
        </div>
        {selectedCustom && !categoryDraft ? (
          <button type="button" className="text-button category-tools" onClick={() => openEditCategory(selectedCustom)}>
            Изменить категорию
          </button>
        ) : null}
      </div>

      {categoryDraft ? (
        <div className="category-editor">
          <label className="field">
            <span className="field-label">Название категории</span>
            <input
              className="field-input"
              placeholder="Например, Кафе"
              maxLength={24}
              value={categoryDraft.label}
              onChange={(event) => patchDraft({ label: event.target.value })}
            />
          </label>

          <div className="field">
            <span className="field-label">Эмодзи</span>
            <div className="emoji-row">
              {CATEGORY_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`emoji-option${categoryDraft.emoji === emoji ? ' is-active' : ''}`}
                  aria-label={`Эмодзи ${emoji}`}
                  onClick={() => patchDraft({ emoji })}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field-label">Цвет</span>
            <div className="color-picker color-picker--wrap">
              {CATEGORY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-dot${categoryDraft.color === color ? ' is-active' : ''}`}
                  style={{ '--dot-color': color } as CSSProperties}
                  aria-label={`Цвет ${color}`}
                  onClick={() => patchDraft({ color })}
                />
              ))}
            </div>
          </div>

          <div className="category-editor__actions">
            <button
              type="button"
              className="primary-button"
              disabled={!categoryDraft.label.trim()}
              onClick={saveCategory}
            >
              {categoryDraft.mode === 'create' ? 'Создать' : 'Сохранить'}
            </button>
            <button type="button" className="text-button" onClick={() => setCategoryDraft(null)}>
              Отмена
            </button>
            {categoryDraft.mode === 'edit' ? (
              <button type="button" className="text-button danger-text" onClick={deleteSelectedCategory}>
                Удалить
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <label className="field">
        <span className="field-label">Карта</span>
        {availableCards.length ? (
          <select className="field-input" value={cardId} onChange={(event) => setCardId(event.target.value)}>
            {availableCards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.label ? `${card.bank} · ${card.label}` : card.bank} · •••• {card.last4 || '0000'}
              </option>
            ))}
          </select>
        ) : (
          <span className="field-hint">Сначала добавьте карту во вкладке «Карты»</span>
        )}
      </label>

      <div className="field-row field-row--even">
        <label className="field">
          <span className="field-label">Дата</span>
          <input className="field-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Заметка</span>
          <input
            className="field-input"
            placeholder="Необязательно"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </div>

      {transaction ? (
        <button type="button" className="danger-button" onClick={() => onDeleted(transaction)}>
          Удалить операцию
        </button>
      ) : null}
    </Sheet>
  )
}
