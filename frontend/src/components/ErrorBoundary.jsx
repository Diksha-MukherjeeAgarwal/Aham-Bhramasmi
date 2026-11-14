import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    if (this.props.onError) this.props.onError(error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="notice notice--error" role="alert">
          <p>The 3D view could not start. The image frames and the list below still work.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
