import { useMemo, useState } from 'react'
import StatusBadge from './StatusBadge'
import { formatDate, initials } from '../utils'

const STATUSES = [
  'Draft', 'Sent', 'Viewed', 'In Review', 'Awaiting Signature',
  'Partially Signed', 'Signed', 'Rejected', 'Expired',
]

const SORTS = {
  updated: ['Recently updated', (a, b) => b.updated_at.localeCompare(a.updated_at)],
  created: ['Newest first', (a, b) => b.created_at.localeCompare(a.created_at)],
  title: ['Title A–Z', (a, b) => a.title.localeCompare(b.title)],
  due: [
    'Due date (soonest)',
    (a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'),
  ],
}

function AgreementCard({ agreement, onOpen }) {
  return (
    <article
      className="agreement-card clickable"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      <div className="agreement-avatar">{initials(agreement.counterpart)}</div>
      <div className="agreement-content">
        <div>
          <h4>{agreement.title}</h4>
          <p>{agreement.agreement_type}</p>
        </div>
        <div className="counterpart">
          <span>With</span>
          <strong>{agreement.counterpart}</strong>
        </div>
        <StatusBadge status={agreement.status} />
        <div className="counterpart">
          <span>Due</span>
          <strong>{formatDate(agreement.due_date)}</strong>
        </div>
        <div className="counterpart">
          <span>Updated</span>
          <strong>{formatDate(agreement.updated_at)}</strong>
        </div>
      </div>
    </article>
  )
}

export default function Dashboard({ user, agreements, loading, error, onRetry, navigate }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [sort, setSort] = useState('updated')

  const visible = useMemo(() => {
    const query = search.toLowerCase().trim()
    return agreements
      .filter((a) => {
        const matchesText =
          !query ||
          a.title?.toLowerCase().includes(query) ||
          a.counterpart?.toLowerCase().includes(query) ||
          a.agreement_type?.toLowerCase().includes(query)
        return matchesText && (status === 'All' || a.status === status)
      })
      .sort(SORTS[sort][1])
  }, [agreements, search, status, sort])

  const count = (...names) => agreements.filter((a) => names.includes(a.status)).length
  const stats = [
    ['Total agreements', agreements.length, 'In your workspace'],
    ['Drafts', count('Draft'), 'Not sent yet'],
    ['Sent', count('Sent', 'Viewed', 'In Review'), 'With the other party'],
    ['Awaiting signature', count('Awaiting Signature', 'Partially Signed'), 'Ready to sign'],
    ['Signed', count('Signed'), 'Completed'],
    ['Rejected', count('Rejected'), 'Declined'],
  ]

  const filtering = search || status !== 'All'

  return (
    <>
      <section className="welcome">
        <div>
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h2>Welcome, {user.name || 'there'}.</h2>
          <p>Create, send and sign agreements from one simple workspace.</p>
        </div>
        <button className="primary-button" onClick={() => navigate('/agreements/new')}>
          + New agreement
        </button>
      </section>

      <section className="stats six">
        {stats.map(([label, value, hint]) => (
          <div className="stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </div>
        ))}
      </section>

      <section className="agreements">
        <div className="section-header">
          <div>
            <span className="eyebrow">AGREEMENTS</span>
            <h3>Your agreements</h3>
          </div>
          {filtering && (
            <button
              className="clear-button"
              onClick={() => {
                setSearch('')
                setStatus('All')
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="toolbar">
          <div className="search">
            <span>⌕</span>
            <input
              type="text"
              placeholder="Search by title, counterparty or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="toolbar-selects">
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="All">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
              {Object.entries(SORTS).map(([key, [label]]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <div className="empty">
            <div className="error-box">{error}</div>
            <button className="secondary-button" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : loading && agreements.length === 0 ? (
          <div className="empty">
            <div className="loader"></div>
            <p>Loading agreements...</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">{filtering ? '⌕' : '+'}</div>
            <h4>{filtering ? 'No matching agreements' : 'No agreements yet'}</h4>
            <p>
              {filtering
                ? 'Try a different search or status.'
                : 'Create your first agreement to get started.'}
            </p>
            {!filtering && (
              <button className="primary-button" onClick={() => navigate('/agreements/new')}>
                Create agreement
              </button>
            )}
          </div>
        ) : (
          <div className="agreement-list">
            {visible.map((a) => (
              <AgreementCard
                key={a.id}
                agreement={a}
                onOpen={() => navigate(`/agreements/${a.id}`)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  )
}