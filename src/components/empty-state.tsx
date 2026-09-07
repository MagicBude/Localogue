export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="empty-state">
      <p>{message}</p>
      {hint ? <p className="empty-state__hint">{hint}</p> : null}
    </div>
  );
}
