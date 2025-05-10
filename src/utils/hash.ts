import crypto from 'node:crypto'

export function hash(data: string, len?: number) {
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, len)
}
