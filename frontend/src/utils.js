export function initials(text = '') {
  return text
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

const toDate = (value) =>
  new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value)

export function formatDate(value) {
  if (!value) return '—'
  return toDate(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(value) {
  if (!value) return '—'
  return toDate(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatMoney(amount, currency = 'USD') {
  if (amount === null || amount === undefined || amount === '') return '—'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
      Number(amount)
    )
  } catch {
    return `${currency} ${amount}`
  }
}