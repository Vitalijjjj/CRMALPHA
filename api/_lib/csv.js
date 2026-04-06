/**
 * Minimal CSV parser — handles quoted fields and commas inside quotes.
 */
function parseCSV(text) {
  const lines = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return []

  const headers = splitRow(lines[0])
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = splitRow(line)
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (values[i] || '').trim()]))
  })
}

function splitRow(line) {
  const result = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      result.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

/**
 * Serialise an array of objects to CSV string.
 */
function toCSV(rows, columns) {
  const escape = v => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const header = columns.map(c => c.label).join(',')
  const body = rows.map(r => columns.map(c => escape(r[c.key])).join(',')).join('\n')
  return header + '\n' + body
}

module.exports = { parseCSV, toCSV }
