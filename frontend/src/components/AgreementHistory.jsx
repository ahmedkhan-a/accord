import { formatDateTime } from '../utils'

export default function AgreementHistory({ items = [] }) {
  return (
    <section className="panel">
      <span className="eyebrow">AUDIT TRAIL</span>
      <h3>History</h3>
      {items.length === 0 ? (
        <p className="muted">No activity yet.</p>
      ) : (
        <ul className="history">
          {items.map((h) => (
            <li key={h.id}>
              <strong>{h.label}</strong>
              <span>
                {h.actor} · {formatDateTime(h.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}