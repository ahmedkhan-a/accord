import { useEffect, useState } from 'react'
import { request } from '../api'
import { TEMPLATES } from '../templates'

const TYPES = [
  'Service agreement', 'Retainer agreement', 'Statement of work',
  'Independent contractor', 'NDA', 'Other',
]

const EMPTY = {
  title: '', agreement_type: 'Service agreement', counterpart: '', party_two_email: '',
  party_one_name: '', party_one_email: '', description: '', content: '',
  scope_of_work: '', payment_terms: '', delivery_terms: '', responsibilities: '',
  cancellation_terms: '', additional_terms: '', payment_amount: '', currency: 'USD',
  start_date: '', end_date: '', due_date: '',
}

function Field({ label, error, wide, children }) {
  return (
    <label className={`field${wide ? ' wide' : ''}`}>
      <span>{label}</span>
      {children}
      {error && <em className="field-error">{error}</em>}
    </label>
  )
}

export default function AgreementEditor({ agreementId, user, navigate, notify, upsert }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(Boolean(agreementId))
  const [loadError, setLoadError] = useState('')
  const [locked, setLocked] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!agreementId) {
      setForm((f) => ({ ...f, party_one_name: user.name || '', party_one_email: user.email || '' }))
      return
    }
    request(`${agreementId}/`)
      .then((data) => {
        setLocked(!data.available_actions.includes('edit'))
        setForm(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, data[k] ?? ''])))
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false))
  }, [agreementId, user])

  const bind = (name) => ({
    name,
    value: form[name],
    onChange: (e) => {
      setForm((f) => ({ ...f, [name]: e.target.value }))
      setErrors((x) => ({ ...x, [name]: undefined }))
    },
  })

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const data = await request(agreementId ? `${agreementId}/` : '', {
        method: agreementId ? 'PUT' : 'POST',
        body: form,
      })
      upsert(data)
      notify(agreementId ? 'Changes saved.' : 'Draft saved.')
      navigate(`/agreements/${data.id}`)
    } catch (err) {
      setErrors(err.errors || {})
      notify(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const back = agreementId ? `/agreements/${agreementId}` : '/'

  if (loading) return <div className="empty"><div className="loader"></div></div>
  if (loadError) {
    return (
      <div className="empty">
        <div className="error-box">{loadError}</div>
        <button className="secondary-button" onClick={() => navigate('/')}>Back to dashboard</button>
      </div>
    )
  }
  if (locked) {
    return (
      <div className="empty">
        <h4>This agreement can't be edited</h4>
        <p>Only drafts can be edited. Reopen the agreement to change it.</p>
        <button className="secondary-button" onClick={() => navigate(back)}>Back to agreement</button>
      </div>
    )
  }

  return (
    <form className="form-card" onSubmit={save}>
      <button type="button" className="back-link" onClick={() => navigate(back)}>← Back</button>
      <span className="eyebrow">{agreementId ? 'EDIT DRAFT' : 'NEW AGREEMENT'}</span>
      <h2>{agreementId ? 'Edit agreement' : 'Create an agreement'}</h2>

            {!agreementId && (
        <label className="field" style={{ marginTop: 16 }}>
          <span>Start from a template (optional)</span>
          <select
            defaultValue=""
            onChange={(e) => {
              const t = TEMPLATES[e.target.value]
              if (t) setForm((f) => ({ ...f, ...t.fields, title: f.title || t.label }))
            }}
          >
            <option value="">Blank agreement</option>
            {Object.entries(TEMPLATES).map(([key, t]) => (
              <option key={key} value={key}>{t.label}</option>
            ))}
          </select>
        </label>
      )}

      <h4 className="form-group">Basics</h4>
      <div className="field-grid">
        <Field label="Agreement title *" error={errors.title} wide>
          <input {...bind('title')} placeholder="Website development project" required />
        </Field>
        <Field label="Agreement type">
          <select {...bind('agreement_type')}>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Due date" error={errors.due_date}>
          <input type="date" {...bind('due_date')} />
        </Field>
      </div>

      <h4 className="form-group">Parties</h4>
      <div className="field-grid">
        <Field label="Your name" error={errors.party_one_name}><input {...bind('party_one_name')} /></Field>
        <Field label="Your email" error={errors.party_one_email}><input type="email" {...bind('party_one_email')} /></Field>
        <Field label="Counterparty name *" error={errors.counterpart}>
          <input {...bind('counterpart')} placeholder="ABC Company" required />
        </Field>
        <Field label="Counterparty email" error={errors.party_two_email}>
          <input type="email" {...bind('party_two_email')} placeholder="client@example.com" />
        </Field>
      </div>

      <h4 className="form-group">Money and dates</h4>
      <div className="field-grid four">
        <Field label="Payment amount" error={errors.payment_amount}>
          <input type="number" min="0" step="0.01" {...bind('payment_amount')} />
        </Field>
        <Field label="Currency" error={errors.currency}>
          <input maxLength={3} {...bind('currency')} style={{ textTransform: 'uppercase' }} />
        </Field>
        <Field label="Start date" error={errors.start_date}><input type="date" {...bind('start_date')} /></Field>
        <Field label="End date" error={errors.end_date}><input type="date" {...bind('end_date')} /></Field>
      </div>

      <h4 className="form-group">Terms</h4>
      <div className="field-grid">
        <Field label="Description" error={errors.description} wide>
          <textarea rows={3} {...bind('description')} placeholder="A short summary of this agreement" />
        </Field>
        <Field label="Agreement content" error={errors.content} wide>
          <textarea rows={8} {...bind('content')} placeholder="Write the full agreement text here" />
        </Field>
        <Field label="Scope of work" error={errors.scope_of_work} wide><textarea rows={4} {...bind('scope_of_work')} /></Field>
        <Field label="Payment terms" error={errors.payment_terms} wide><textarea rows={3} {...bind('payment_terms')} /></Field>
        <Field label="Delivery terms" error={errors.delivery_terms} wide><textarea rows={3} {...bind('delivery_terms')} /></Field>
        <Field label="Responsibilities" error={errors.responsibilities} wide><textarea rows={3} {...bind('responsibilities')} /></Field>
        <Field label="Cancellation terms" error={errors.cancellation_terms} wide><textarea rows={3} {...bind('cancellation_terms')} /></Field>
        <Field label="Additional terms" error={errors.additional_terms} wide><textarea rows={3} {...bind('additional_terms')} /></Field>
      </div>

      <div className="modal-actions end">
        <button type="button" className="secondary-button" onClick={() => navigate(back)}>Cancel</button>
        <button className="primary-button" disabled={saving}>
          {saving ? 'Saving...' : agreementId ? 'Save changes' : 'Save draft'}
        </button>
      </div>
    </form>
  )
}