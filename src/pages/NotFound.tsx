import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container">
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <h1>Page Not Found</h1>
        <p style={{ color: '#6b7280', margin: '12px 0 24px 0' }}>
          The page you are looking for does not exist or has been moved.
        </p>
        <Link to="/" className="btn">
          Go back to dashboard
        </Link>
      </div>
    </div>
  );
}
