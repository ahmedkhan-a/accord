import { useState } from 'react'
import { request } from '../api'

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('login') // login | register | forgot
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  function change(event) {
    const { name, value } = event.target
    setForm((previous) => ({ ...previous, [name]: value }))
    setError('')
  }

  function switchMode(next) {
    setMode(next)
    setError('')
    setInfo('')
  }

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'forgot') {
        const data = await request('password/forgot/', { method: 'POST', body: { email: form.email } })
        setInfo(data.message)
      } else {
        const data = await request(mode === 'login' ? 'login/' : 'register/', {
          method: 'POST',
          body: form,
        })
        onAuthed(data.user)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const titles = {
    login: ['Welcome back', 'Login to manage your agreements.'],
    register: ['Create your account', 'Start managing your agreements in one place.'],
    forgot: ['Reset your password', 'Enter your email and we will send you a reset link.'],
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">A</div>
        <h1>Accord</h1>
        <p className="auth-subtitle">Agreement workspace</p>

        {mode !== 'forgot' && (
          <div className="auth-tabs">
            {['login', 'register'].map((m) => (
              <button key={m} type="button" className={mode === m ? 'active' : ''} onClick={() => switchMode(m)}>
                {m === 'login' ? 'Login' : 'Register'}
              </button>
            ))}
          </div>
        )}

        <div className="auth-heading">
          <h2>{titles[mode][0]}</h2>
          <p>{titles[mode][1]}</p>
        </div>

        {error && <div className="error-box">{error}</div>}
        {info && <div className="banner ok">{info}</div>}

        <form onSubmit={submit}>
          {mode === 'register' && (
            <label>
              Full name
              <input type="text" name="name" value={form.name} onChange={change} placeholder="Mohammed Ahmed" autoComplete="name" required />
            </label>
          )}
          <label>
            Email address
            <input type="email" name="email" value={form.email} onChange={change} placeholder="you@example.com" autoComplete="email" required />
          </label>
          {mode !== 'forgot' && (
            <label>
              Password
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={change}
                placeholder="Enter your password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </label>
          )}
          <button className="auth-submit" disabled={submitting}>
            {submitting ? 'Please wait...' : mode === 'login' ? 'Login' : mode === 'register' ? 'Create account' : 'Send reset link'}
          </button>
        </form>

        {mode === 'login' && (
          <button type="button" className="clear-button link-row" onClick={() => switchMode('forgot')}>
            Forgot password?
          </button>
        )}
        {mode === 'forgot' && (
          <button type="button" className="clear-button link-row" onClick={() => switchMode('login')}>
            ← Back to login
          </button>
        )}
      </div>
    </div>
  )
}