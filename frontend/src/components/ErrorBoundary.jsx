import { Component } from 'react';

// Shows a readable message instead of a blank white screen if a page throws while rendering.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card" role="alert">
        <h3>Something went wrong on this page</h3>
        <p className="muted">The rest of the app is still working. Try reloading, or open another page from the sidebar.</p>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#f4f5fa', padding: 12, borderRadius: 8, fontSize: 12.5 }}>
          {String(this.state.error?.message || this.state.error)}
        </pre>
        <button className="btn" onClick={() => window.location.reload()}>Reload page</button>
      </div>
    );
  }
}
