import StatusBadge from './StatusBadge'
import { formatDate, formatDateTime, formatMoney } from '../utils'

const SECTIONS = [
  ['description', 'Description'],
  ['content', 'Agreement'],
  ['scope_of_work', 'Scope of work'],
  ['payment_terms', 'Payment terms'],
  ['delivery_terms', 'Delivery terms'],
  ['responsibilities', 'Responsibilities'],
  ['cancellation_terms', 'Cancellation terms'],
  ['additional_terms', 'Additional terms'],
]

function Party({ label, name, email, signature }) {
  return (
    <div className="doc-party">
      <span className="doc-label">{label}</span>
      <strong>{name || '—'}</strong>
      <small>{email || 'No email'}</small>
      <div className={`sig-state ${signature ? 'done' : ''}`}>
        {signature
          ? `Signed by ${signature.signed_name} · ${formatDateTime(signature.signed_at)}`
          : 'Not signed yet'}
      </div>
    </div>
  )
}

export default function AgreementDocument({ a }) {
  const sig = (role) => a.signatures?.find((s) => s.role === role)
  const facts = [
    ['Payment', a.payment_amount ? formatMoney(a.payment_amount, a.currency) : '—'],
    ['Start date', formatDate(a.start_date)],
    ['End date', formatDate(a.end_date)],
    ['Due date', formatDate(a.due_date)],
    ['Created', formatDate(a.created_at)],
    ['Last updated', formatDate(a.updated_at)],
  ]

  return (
    <article className="doc">
      <header className="doc-head">
        <div>
          <span className="eyebrow">
            {a.reference} · {a.agreement_type}
          </span>
          <h2>{a.title}</h2>
        </div>
        <StatusBadge status={a.status} />
      </header>

      {a.status === 'Rejected' && (
        <div className="error-box">
          Rejected{a.rejected_at ? ` on ${formatDate(a.rejected_at)}` : ''}.
          {a.rejection_reason ? ` Reason: ${a.rejection_reason}` : ''}
        </div>
      )}

      <div className="doc-parties">
        <Party label="Party 1" name={a.party_one_name} email={a.party_one_email} signature={sig('party_one')} />
        <Party label="Party 2" name={a.party_two_name} email={a.party_two_email} signature={sig('party_two')} />
      </div>

      <div className="doc-facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <span className="doc-label">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      {SECTIONS.map(
        ([key, title]) =>
          a[key]?.trim() && (
            <section className="doc-section" key={key}>
              <h4>{title}</h4>
              <p>{a[key]}</p>
            </section>
          )
      )}

      <p className="fineprint">
        Typed-name signatures are electronic acknowledgements recorded by Accord. They are not
        legal advice, and their enforceability varies by jurisdiction.
      </p>
    </article>
  )
}