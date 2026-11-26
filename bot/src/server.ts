import { createHmac, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { getImport, importsCount } from './imports.js'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'X-Telegram-Init-Data, Content-Type',
  'Access-Control-Max-Age': '86400',
}

function send(res: ServerResponse, status: number, body: string, type = 'text/plain; charset=utf-8'): void {
  res.writeHead(status, { ...CORS_HEADERS, 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(body)
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  send(res, status, JSON.stringify(payload), 'application/json; charset=utf-8')
}

interface TelegramUser {
  id: number
}

/**
 * Проверяет подпись initData и возвращает пользователя.
 * Если заголовка нет — возвращает null (обычный браузер).
 */
function verifyInitData(initData: string, botToken: string): TelegramUser | null {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expected = createHmac('sha256', secret).update(dataCheckString).digest('hex')

  const left = Buffer.from(expected, 'utf8')
  const right = Buffer.from(hash, 'utf8')
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null
  }

  const rawUser = params.get('user')
  if (!rawUser) return null
  try {
    const user = JSON.parse(rawUser) as TelegramUser
    return typeof user.id === 'number' ? user : null
  } catch {
    return null
  }
}

export function startServer(botToken: string): void {
  const port = Number(process.env.PORT ?? 8080)
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const method = req.method ?? 'GET'

    if (method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS)
      res.end()
      return
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

    if (method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true, imports: importsCount() })
      return
    }

    const match = url.pathname.match(/^\/api\/import\/([A-Za-z0-9_-]{16,128})$/)
    if (method === 'GET' && match) {
      const item = getImport(match[1])
      if (!item) {
        sendJson(res, 404, { error: 'IMPORT_NOT_FOUND' })
        return
      }

      const initData = req.headers['x-telegram-init-data']
      if (typeof initData === 'string' && initData) {
        const user = verifyInitData(initData, botToken)
        if (!user || user.id !== item.userId) {
          sendJson(res, 403, { error: 'FORBIDDEN' })
          return
        }
      }

      res.writeHead(200, {
        ...CORS_HEADERS,
        'Content-Type': item.mimeType || 'application/pdf',
        'Content-Length': item.buffer.byteLength,
        'Content-Disposition': `inline; filename="${encodeURIComponent(item.fileName)}"`,
        'Cache-Control': 'no-store',
      })
      res.end(item.buffer)
      return
    }

    sendJson(res, 404, { error: 'NOT_FOUND' })
  })

  server.listen(port, '0.0.0.0', () => {
    console.log(`HTTP-сервер импорта слушает порт ${port}`)
  })

  server.on('error', (error) => {
    console.error('Ошибка HTTP-сервера:', error)
  })
}
