/**
 * CS Lab — Python runner.
 * Spawns the Pyodide worker on demand, forwards run requests,
 * enforces an execution timeout, and cleans up on unmount.
 */

export interface PythonRunResult {
  output: string;
  error: string;
  timedOut?: boolean;
}

const WORKER_URL = '/pyodide-worker.js';
const DEFAULT_TIMEOUT_MS = 15000;

export class PyRunner {
  private worker: Worker | null = null;
  private pending: Map<
    string,
    { resolve: (r: PythonRunResult) => void; timer: ReturnType<typeof setTimeout> | null; timeoutMs: number }
  > = new Map();
  private messageHandler: ((e: MessageEvent) => void) | null = null;

  private ensureWorker(): Worker {
    if (typeof window === 'undefined') {
      throw new Error('PyRunner is browser-only');
    }
    if (this.worker) return this.worker;

    const worker = new Worker(WORKER_URL);
    this.messageHandler = (event: MessageEvent) => {
      const data = event.data || {};
      if (data.type === 'result' && data.id && this.pending.has(data.id)) {
        const entry = this.pending.get(data.id)!;
        this.pending.delete(data.id);
        if (entry.timer) clearTimeout(entry.timer);
        entry.resolve({ output: data.output || '', error: data.error || '' });
      }
    };
    worker.addEventListener('message', this.messageHandler);
    this.worker = worker;
    return worker;
  }

  isReady(): boolean {
    return !!this.worker;
  }

  /** Warm up the runtime (called on first lab open). Resolves when Pyodide is loaded. */
  preload(): void {
    try {
      this.ensureWorker();
    } catch {
      // no-op; actual errors surface on run()
    }
  }

  run(code: string, stdin: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<PythonRunResult> {
    const worker = this.ensureWorker();
    const id = `run_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    return new Promise<PythonRunResult>((resolve) => {
      const entry: { resolve: (r: PythonRunResult) => void; timer: ReturnType<typeof setTimeout> | null; timeoutMs: number } = {
        resolve,
        timer: null,
        timeoutMs,
      };

      entry.timer = setTimeout(() => {
        // Kill and rebuild the worker — the only reliable way to stop runaway code.
        this.terminate();
        resolve({
          output: '',
          error: `Execution timed out after ${Math.round(timeoutMs / 1000)}s (possible infinite loop). The Python runtime was restarted.`,
          timedOut: true,
        });
      }, timeoutMs);

      this.pending.set(id, entry);
      worker.postMessage({ type: 'run', id, code, stdin });
    });
  }

  /** Terminate the worker; the next run boots a fresh runtime. */
  terminate(): void {
    this.pending.forEach((entry) => {
      if (entry.timer) clearTimeout(entry.timer);
      entry.resolve({
        output: '',
        error: 'Execution stopped.',
        timedOut: true,
      });
    });
    this.pending.clear();
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {}
      this.worker = null;
    }
  }

  dispose(): void {
    this.terminate();
  }
}
