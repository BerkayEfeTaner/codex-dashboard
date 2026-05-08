import { Info } from 'lucide-react';

export function EmptyState({ title, description }) {
  return (
    <div className="empty-state" role="status">
      <Info size={20} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}
