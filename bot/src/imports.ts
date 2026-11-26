import { randomBytes } from 'node:crypto'

export interface StoredImport {
  token: string
  userId: number
  fileName: string
  mimeType: string
  buffer: Buffer
  createdAt: number
}

const TTL_MS = 60 * 60 * 1000
const MAX_BYTES = 20 * 1024 * 1024

const store = new Map<string, StoredImport>()

/** Убирает просроченные выписки, чтобы память не росла. */
function cleanup(now = Date.now()): void {
  for (const [token, item] of store) {
    if (now - item.createdAt > TTL_MS) store.delete(token)
  }
}

setInterval(cleanup, 10 * 60 * 1000).unref()

export function storeImport(
  userId: number,
  fileName: string,
  mimeType: string,
  buffer: Buffer,
): string {
  cleanup()
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error('FILE_TOO_LARGE')
  }
  const token = randomBytes(18).toString('base64url')
  store.set(token, {
    token,
    userId,
    fileName,
    mimeType,
    buffer,
    createdAt: Date.now(),
  })
  return token
}

export function getImport(token: string): StoredImport | undefined {
  cleanup()
  return store.get(token)
}

export function dropImport(token: string): void {
  store.delete(token)
}

export function importsCount(): number {
  cleanup()
  return store.size
}
