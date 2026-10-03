export const API_URL = 'http://localhost:8000/api/agreements/'

let onUnauthorized = () => {}
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

export class ApiError extends Error {
  constructor(message, status = 0, errors = {}) {
    super(message)
    this.status = status
    this.errors = errors || {}
  }
}

const FALLBACK = {
  400: 'Some of the information is not valid.',
  401: 'Please log in to continue.',
  403: 'You do not have permission to do that.',
  404: 'We could not find what you were looking for.',
  405: 'That action is not supported.',
  409: 'That action is not allowed in the current state.',
  500: 'Something went wrong on the server. Please try again.',
}

async function send(path, options) {
  try {
    return await fetch(API_URL + path, { credentials: 'include', ...options })
  } catch {
    throw new ApiError(
      'Cannot reach the server. Make sure the backend is running on port 8000.'
    )
  }
}

async function toError(response) {
  let data = null
  try {
    data = await response.json()
  } catch {
    /* response was not JSON */
  }
  if (response.status === 401) onUnauthorized()
  return new ApiError(
    data?.error || FALLBACK[response.status] || `Request failed (${response.status}).`,
    response.status,
    data?.errors
  )
}

export async function request(path, { method = 'GET', body } = {}) {
  const hasBody = body !== undefined
  const response = await send(path, {
    method,
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) throw await toError(response)
  return response.json()
}

export async function downloadPdf(path, filename) {
  const response = await send(path, {})
  if (!response.ok) throw await toError(response)
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}