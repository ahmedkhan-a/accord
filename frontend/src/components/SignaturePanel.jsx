import { useState } from 'react'

export default function SignaturePanel({ roleLabel, defaultName = '', defaultEmail = '', needsEmail = false, busy, onSign }) {
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [consent, setConsent] = useState(false)

  function submit(event) {
    event.preventDefault()
    const payload = { signed_name: name, consent }
    if (needsEmail) payload.signer_email = email
    onSign(payload)
  }

  return (
    <form className="panel" onSubmit={submit}>
      <span className="eyebrow">SIGN AS {roleLabel.toUpperCase()}</span>
      <h3>Add your signature</h3>
      <label className="field">
        <span>Type your full name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
      </label>
      {name.trim() && <div className="sig-preview">{name}</div>}
      {needsEmail && (
        <label className="field">
          <span>Your email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
      )}
      <label className="check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>I agree to sign this agreement electronically by typing my name.</span>
      </label>
      <button className="primary-button" disabled={busy || !consent || name.trim().length < 2}>
        {busy ? 'Signing...' : 'Sign agreement'}
      </button>
    </form>
  )
}