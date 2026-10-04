import { useState } from 'react'
import { request } from '../api'

export default function ResetPassword({ uid, token, navigate, notify }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await request('password/reset/', { method: 'POST', body: { uid, token, password } })
      notify('Password updated. Please log in.')
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">A</div>
        <h1>Accord</h1>
        <div className="auth-heading">
          <h2>Choose a new password</h2>
          <p>Use at least 8 characters.</p>
        </div>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={submit}>
          <label>
            New password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
          </label>
          <button className="auth-submit" disabled={busy}>
            {busy ? 'Please wait...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}