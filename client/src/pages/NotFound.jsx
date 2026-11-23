import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="empty-state" style={{ border: 0, background: 'transparent', padding: '90px 20px' }}>
      <div className="serif" style={{ fontSize: 76, color: '#d9d4c9', letterSpacing: 6 }}>404</div>
      <h3>This page wandered off</h3>
      <p>The page you're looking for doesn't exist — but the collection is right here.</p>
      <Link className="btn" to="/" style={{ marginTop: 12 }}>Back to home</Link>
    </main>
  );
}
