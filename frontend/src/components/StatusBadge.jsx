export default function StatusBadge({ status }) {
  const cls = (status || '').toLowerCase().replaceAll(' ', '-')
  return <span className={`status status-${cls}`}>{status}</span>
}