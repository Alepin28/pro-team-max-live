export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card">
      <div className="muted">{label}</div>
      <div className="stat">{value}</div>
      {hint ? <p>{hint}</p> : null}
    </div>
  );
}
