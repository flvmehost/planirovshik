import { getWebApp } from './telegram'

const CONFIGURED_BASE = (import.meta.env.VITE_IMPORT_API_URL as string | undefined)?.trim()

/**
 * Адрес HTTP-эндпоинта бота. На GitHub Pages его нужно задать при сборке
 * через VITE_IMPORT_API_URL; локально по умолчанию используется :8080.
 */
export function importApiBase(): string {
  if (CONFIGURED_BASE) return CONFIGURED_BASE.replace(/\/+$/, '')
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8080'
  }
  return ''
}

export class ImportApiError extends Error {
  constructor(public readonly code: 'NOT_CONFIGURED' | 'NOT_FOUND' | 'FORBIDDEN' | 'FAILED') {
    super(code)
  }
}

/** Забирает PDF, который бот сохранил по токену из чата. */
export async function fetchStatementFile(token: string): Promise<File> {
  const base = importApiBase()
  if (!base) throw new ImportApiError('NOT_CONFIGURED')

  const initData = getWebApp()?.initData
  const response = await fetch(`${base}/api/import/${encodeURIComponent(token)}`, {
    headers: initData ? { 'X-Telegram-Init-Data': initData } : undefined,
  })

  if (response.status === 404) throw new ImportApiError('NOT_FOUND')
  if (response.status === 403) throw new ImportApiError('FORBIDDEN')
  if (!response.ok) throw new ImportApiError('FAILED')

  const blob = await response.blob()
  return new File([blob], 'statement.pdf', { type: 'application/pdf' })
}

export function importErrorMessage(error: unknown): string {
  if (error instanceof ImportApiError) {
    if (error.code === 'NOT_CONFIGURED') {
      return 'Импорт из чата не настроен: не указан адрес сервера бота. Загрузите PDF прямо здесь.'
    }
    if (error.code === 'NOT_FOUND') {
      return 'Выписка не найдена или срок её хранения истёк. Пришлите PDF боту заново.'
    }
    if (error.code === 'FORBIDDEN') {
      return 'Эта выписка привязана к другому аккаунту Telegram.'
    }
  }
  return 'Не удалось получить выписку из чата. Пришлите PDF боту заново или загрузите файл здесь.'
}

/** Читает токен из ?import=…, не меняя адресную строку. */
export function readImportToken(): string | null {
  if (typeof window === 'undefined') return null
  return new URL(window.location.href).searchParams.get('import')
}

/** Убирает токен из адресной строки, чтобы он не оставался в истории. */
export function clearImportToken(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (!url.searchParams.has('import')) return
  url.searchParams.delete('import')
  window.history.replaceState({}, '', url.toString())
}
