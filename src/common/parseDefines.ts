import { objectify } from 'radashi'

export function parseDefines(define?: string[]) {
  if (!define) {
    return undefined
  }
  return objectify(
    define.map(d => d.split(':') as [string, string?]),
    ([key]) => key,
    ([, value]) =>
      value ? (isNaN(parseFloat(value)) ? JSON.stringify(value) : value) : ''
  )
}
