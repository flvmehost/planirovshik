import type { ReactNode } from 'react'

export type Tab = 'home' | 'history' | 'cards' | 'credits'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

const ICONS: Record<Tab, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  history: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  cards: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="3" />
      <path d="M2 10h20M6 15h4" />
    </>
  ),
  credits: (
    <>
      <path d="M3 7h18v10H3z" />
      <path d="M7 12h10M12 9v6" />
    </>
  ),
}

const LABELS: Record<Tab, string> = {
  home: 'Главная',
  history: 'История',
  cards: 'Карты',
  credits: 'Кредиты',
}

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {(Object.keys(LABELS) as Tab[]).map((tab) => (
        <button
          key={tab}
          type="button"
          className={`nav-item${active === tab ? ' is-active' : ''}`}
          aria-current={active === tab ? 'page' : undefined}
          onClick={() => onChange(tab)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS[tab]}
          </svg>
          <span>{LABELS[tab]}</span>
        </button>
      ))}
    </nav>
  )
}
