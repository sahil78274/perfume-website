/**
 * Shown whenever a read-only catalogue call fell back to the bundled local
 * development catalogue (backend down or database not configured).
 */
export default function DevPreviewBanner({ className = '' }) {
  return (
    <div className={`dev-preview-banner ${className}`} role="status">
      <strong>Development preview</strong> — the backend or database is unavailable, so this page is
      showing the local sample catalogue. Prices, stock and orders from here are not real. Set{' '}
      <code>MONGODB_URI</code> and restart to go live.
    </div>
  );
}
