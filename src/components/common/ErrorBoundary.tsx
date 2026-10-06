import { Component, ErrorInfo, ReactNode } from 'react';
import { RotateCcw, Download, ShieldAlert, Home } from 'lucide-react';
import { exportBinaryFile } from '../../lib/services/backupService.ts';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('StockForge Uncaught Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.href = '/dashboard';
  };

  private handleDownloadEmergencyBackup = () => {
    try {
      const binary = exportBinaryFile();
      const blob = new Blob([binary.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const dateStr = now.toISOString().replace(/[:.]/g, '-');
      a.download = `stockforge-emergency-backup-${dateStr}.sqlite`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export emergency backup:', err);
      alert('Could not export emergency backup: Database may not be loaded yet.');
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6 selection:bg-rose-500/30">
          <div className="max-w-lg w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-neutral-100">
                  Application Encountered an Error
                </h1>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Your offline database is safe. You can recover or download an emergency backup.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs space-y-2">
              <div className="font-mono text-rose-400 font-semibold break-words">
                {this.state.error?.message || 'An unexpected runtime error occurred.'}
              </div>
              {this.state.errorInfo?.componentStack && (
                <details className="mt-2 text-[11px] text-neutral-500 font-mono">
                  <summary className="cursor-pointer text-neutral-400 hover:text-neutral-200 transition-colors">
                    View Component Stack
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap p-2 bg-neutral-900 rounded border border-neutral-850 text-neutral-400 text-[10px]">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            {/* Recovery Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Try Again</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors cursor-pointer border border-neutral-700"
              >
                <Home className="w-4 h-4" />
                <span>Return to Dashboard</span>
              </button>
            </div>

            {/* Emergency Download Button */}
            <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
              <span>Protect your business data:</span>
              <button
                type="button"
                onClick={this.handleDownloadEmergencyBackup}
                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .sqlite Backup</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
