import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { setClosingConfirmation, setupBackButton } from '../lib/telegram'

interface SheetProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function Sheet({ title, onClose, children, footer }: SheetProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    document.body.classList.add('sheet-open')
    setClosingConfirmation(true)
    const cleanupBack = setupBackButton(onClose)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('sheet-open')
      setClosingConfirmation(false)
      cleanupBack()
    }
  }, [onClose])

  return createPortal(
    <div
      className="sheet-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grabber" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer ? <div className="sheet-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
