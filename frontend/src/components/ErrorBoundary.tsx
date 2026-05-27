import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  fallback: (err: Error, reset: () => void) => ReactNode;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log for debugging — surfaces in the browser devtools console.
    // eslint-disable-next-line no-console
    console.error('Render error caught by ErrorBoundary:', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error, this.reset);
    }
    return this.props.children;
  }
}
