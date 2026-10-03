import { useState } from 'react'
import { request } from '../api'

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function change(event) {
    const { name, value } = event.target
    setForm((previous) => ({ ...previous, [name]: value }))
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const data = await request(mode === 'login' ? 'login/' : 'register/', {
        method: 'POST',
        body: form,
      })
      onAuthed(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const isLogin = mode === 'login'

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">A</div>
        <h1>Accord</h1>
        <p className="auth-subtitle">Agreement workspace</p>

        <div className="auth-tabs">
          {['login', 'register'].map((m) => (
            <button
              key={m}
              type="button"
              className={mode === m ? 'active' : ''}
              onClick={() => {
                setMode(m)
                setError('')
              }}
            >
              {m === 'login' ? 'Login' : 'Register'}
            </button>
          ))}
        </div>

        <div className="auth-heading">
          <h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2>
          <p>
            {isLogin
              ? 'Login to manage your agreements.'
              : 'Start managing your agreements in one place.'}
          </p>
        </div>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={submit}>
          {!isLogin && (
            <label>
              Full name
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={change}
                placeholder="Mohammed Ahmed"
                autoComplete="name"
                required
              />
            </label>
          )}
          <label>
            Email address
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={change}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={change}
              placeholder="Enter your password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
            />
          </label>
          <button className="auth-submit" disabled={submitting}>
            {submitting ? 'Please wait...' : isLogin ? 'Login' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}