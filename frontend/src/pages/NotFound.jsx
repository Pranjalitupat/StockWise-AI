import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <div className="card">
      <EmptyState
        title="404: page not found"
        text="The page you are looking for doesn't exist or was moved."
        action={<Link to="/" className="btn">Back to dashboard</Link>}
      />
    </div>
  );
}
