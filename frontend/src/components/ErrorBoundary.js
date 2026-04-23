import { Component } from "react";
import { Warning, ArrowCounterClockwise } from "@phosphor-icons/react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 text-center">
          <div className="p-4 bg-[#9E473D10] rounded-full">
            <Warning size={40} className="text-[var(--error)]" weight="duotone" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-medium text-[var(--text-primary)] mb-1">Something went wrong</h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-sm">
              {this.state.error?.message || "An unexpected error occurred on this page."}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)]"
          >
            <ArrowCounterClockwise size={16} /> Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
