import { Component, ErrorInfo, ReactNode } from 'react';
import { ActionableNotification } from '@carbon/react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 'var(--cds-spacing-05)' }}>
          <ActionableNotification
            kind="error"
            title="Something went wrong"
            subtitle={this.state.error?.message || 'A frontend error occurred.'}
            inline
            actionButtonLabel="Reload page"
            onActionButtonClick={() => window.location.reload()}
            hideCloseButton
          />
        </div>
      );
    }

    return this.props.children;
  }
}
