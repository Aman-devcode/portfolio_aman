import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode; onReload?: () => void };
type State = { failed: boolean };
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* Deliberately avoid exposing or logging component data. */ }
  render() {
    if (this.state.failed) return <main className="error-boundary" role="alert"><h1>Something went wrong.</h1><p>Please reload the page and try again.</p><button type="button" onClick={this.props.onReload || (() => window.location.reload())}>Reload page</button></main>;
    return this.props.children;
  }
}
