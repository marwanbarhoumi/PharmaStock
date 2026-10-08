export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const escape = (value: string | number | null | undefined): string => {
    const raw = value === null || value === undefined ? '' : String(value)
    if (/[",\n\r]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`
    }
    return raw
  }

  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ]
  return `${lines.join('\n')}\n`
}
