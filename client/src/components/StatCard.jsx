export default function StatCard({ label, value }) {
  return (
    <div className="card stat">
      <span className="label">{label}</span>
      <span className="value">{value ?? '–'}</span>
    </div>
  );
}
