type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
type NotificationStyle = 'error' | 'success' | 'warning'

interface SafeAreaInset {
  top: number
  bottom: number
  left: number
  right: number
}

interface ThemeParams {
  bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  secondary_bg_color?: string
  header_bg_color?: string
  bottom_bar_bg_color?: string
  accent_text_color?: string
  section_bg_color?: string
  destructive_text_color?: string
  [key: string]: string | undefined
}

interface MainButtonApi {
  setText(text: string): void
  show(): void
  hide(): void
  onClick(callback: () => void): void
  offClick(callback: () => void): void
  setColor?(color: string): void
  setTextColor?(color: string): void
}

interface BackButtonApi {
  show(): void
  hide(): void
  onClick(callback: () => void): void
  offClick(callback: () => void): void
}

interface CloudStorageApi {
  setItem(key: string, value: string, callback?: (error: string | null) => void): void
  getItem(key: string, callback: (error: string | null, value?: string) => void): void
}

interface WebApp {
  initData: string
  ready(): void
  expand(): void
  close(): void
  themeParams: ThemeParams
  colorScheme: 'light' | 'dark'
  viewportHeight: number
  viewportStableHeight?: number
  safeAreaInset?: SafeAreaInset
  hideKeyboard?(): void
  MainButton: MainButtonApi
  BackButton: BackButtonApi
  CloudStorage?: CloudStorageApi
  HapticFeedback?: {
    impactOccurred(style: HapticStyle): void
    notificationOccurred(style: NotificationStyle): void
  }
  setHeaderColor?(color: string): void
  setBackgroundColor?(color: string): void
  enableClosingConfirmation?(): void
  disableClosingConfirmation?(): void
  onEvent?(event: string, callback: (payload?: { isStateStable?: boolean }) => void): void
  offEvent?(event: string, callback: (payload?: { isStateStable?: boolean }) => void): void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: WebApp }
  }
}

export function getWebApp(): WebApp | undefined {
  return window.Telegram?.WebApp
}

/** Настоящий запуск внутри Telegram: вне мини-приложения SDK всё равно может быть загружен. */
export function isTelegram(): boolean {
  return Boolean(getWebApp()?.initData)
}

function applyTheme(): void {
  const tg = getWebApp()
  if (!tg) return
  const p = tg.themeParams
  const dark = tg.colorScheme === 'dark'
  const css = document.documentElement.style
  const set = (name: string, value?: string) => css.setProperty(name, value ?? '')

  set('--app-bg', p.bg_color ?? (dark ? '#101218' : '#f4f6f9'))
  set('--app-surface', p.secondary_bg_color ?? p.section_bg_color ?? (dark ? '#191c24' : '#ffffff'))
  set('--app-surface-2', p.section_bg_color ?? (dark ? '#212531' : '#f1f3f7'))
  set('--app-text', p.text_color ?? (dark ? '#f4f5f7' : '#151821'))
  set('--app-muted', p.hint_color ?? (dark ? '#9299aa' : '#78808f'))
  set('--app-accent', p.link_color ?? p.accent_text_color ?? (dark ? '#7aa7ff' : '#3b6fe0'))
  set('--app-accent-text', p.button_text_color ?? '#ffffff')
  set('--app-button', p.button_color ?? (dark ? '#7aa7ff' : '#3b6fe0'))
  set('--app-danger', p.destructive_text_color ?? '#e5484d')
  set('--app-positive', dark ? '#4fd18b' : '#249a62')
}

/** Telegram сам публикует CSS-переменные; дублируем стабильную высоту для старых версий. */
function applyViewport(): void {
  const tg = getWebApp()
  if (!tg) return
  const css = document.documentElement.style
  const stable = tg.viewportStableHeight ?? tg.viewportHeight
  if (Number.isFinite(stable)) {
    css.setProperty('--tg-viewport-stable-height', `${stable}px`)
  }
  const safe = tg.safeAreaInset
  if (safe) {
    css.setProperty('--tg-safe-top', `${safe.top}px`)
    css.setProperty('--tg-safe-bottom', `${safe.bottom}px`)
    css.setProperty('--tg-safe-left', `${safe.left}px`)
    css.setProperty('--tg-safe-right', `${safe.right}px`)
  }
}

export function initTelegram(onChange: () => void): () => void {
  const tg = getWebApp()
  if (!tg) return () => undefined

  tg.ready()
  tg.expand()
  applyTheme()
  applyViewport()

  const handleTheme = () => {
    applyTheme()
    applyViewport()
    onChange()
  }
  /* Пока анимация/клавиатура меняют viewport, пересчитывать layout нельзя. */
  const handleViewport = (payload?: { isStateStable?: boolean }) => {
    if (payload && payload.isStateStable === false) return
    applyViewport()
    onChange()
  }
  const handleSafeArea = () => {
    applyViewport()
    onChange()
  }

  tg.onEvent?.('themeChanged', handleTheme)
  tg.onEvent?.('viewportChanged', handleViewport)
  tg.onEvent?.('safeAreaChanged', handleSafeArea)

  return () => {
    tg.offEvent?.('themeChanged', handleTheme)
    tg.offEvent?.('viewportChanged', handleViewport)
    tg.offEvent?.('safeAreaChanged', handleSafeArea)
  }
}

export function haptic(style: HapticStyle = 'light'): void {
  getWebApp()?.HapticFeedback?.impactOccurred(style)
}

export function notify(type: NotificationStyle): void {
  getWebApp()?.HapticFeedback?.notificationOccurred(type)
}

export function hideKeyboard(): void {
  const tg = isTelegram() ? getWebApp() : undefined
  tg?.hideKeyboard?.()
}

export function setupMainButton(text: string, onClick: () => void): () => void {
  const tg = isTelegram() ? getWebApp() : undefined
  if (!tg) return () => undefined
  const button = tg.MainButton
  const p = tg.themeParams
  if (p.button_color) button.setColor?.(p.button_color)
  if (p.button_text_color) button.setTextColor?.(p.button_text_color)
  button.setText(text)
  button.show()
  button.onClick(onClick)
  return () => {
    button.offClick(onClick)
    button.hide()
  }
}

export function setupBackButton(onClick: () => void): () => void {
  const tg = isTelegram() ? getWebApp() : undefined
  if (!tg) return () => undefined
  tg.BackButton.show()
  tg.BackButton.onClick(onClick)
  return () => {
    tg.BackButton.offClick(onClick)
    tg.BackButton.hide()
  }
}

export function setClosingConfirmation(enabled: boolean): void {
  const tg = isTelegram() ? getWebApp() : undefined
  if (!tg) return
  if (enabled) tg.enableClosingConfirmation?.()
  else tg.disableClosingConfirmation?.()
}

export function cloudGet(key: string): Promise<string | null> {
  const storage = isTelegram() ? getWebApp()?.CloudStorage : undefined
  if (!storage) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      storage.getItem(key, (error, value) => resolve(error ? null : value ?? null))
    } catch {
      resolve(null)
    }
  })
}

export function cloudSet(key: string, value: string): Promise<void> {
  const storage = isTelegram() ? getWebApp()?.CloudStorage : undefined
  if (!storage) return Promise.resolve()
  return new Promise((resolve) => {
    try {
      storage.setItem(key, value, () => resolve())
    } catch {
      resolve()
    }
  })
}
