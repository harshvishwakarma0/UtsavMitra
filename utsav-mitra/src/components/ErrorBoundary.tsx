import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught React error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="grid h-screen place-items-center bg-surface p-6 text-center text-text">
          <div className="max-w-md space-y-4 rounded-xl border border-border bg-surface-2 p-6 shadow-lg">
            <div className="text-4xl">⚠️</div>
            <h1 className="text-xl font-bold text-danger">Something went wrong</h1>
            <p className="text-sm text-text-dim">
              {this.state.error?.message || "An unexpected error occurred in the application."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = "/";
              }}
              className="rounded-xl bg-primary px-4 py-2 font-semibold text-black"
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
