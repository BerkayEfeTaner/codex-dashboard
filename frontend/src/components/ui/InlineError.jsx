import { AlertTriangle } from 'lucide-react';
import { Alert } from 'reactstrap';

export function InlineError({ title = 'Error', message }) {
  if (!message) {
    return null;
  }

  return (
    <Alert color="warning" className="inline-error" role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
    </Alert>
  );
}
