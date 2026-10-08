export function buildDocumentNumber(prefix: string): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.floor(Math.random() * 100_000)
    .toString()
    .padStart(5, '0')
  return `${prefix}-${date}-${rand}`
}
