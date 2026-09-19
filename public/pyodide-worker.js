/* CS Lab — Python execution worker (Pyodide).
 * Runs student code in isolation. The main thread may terminate this worker
 * at any time (timeout / Stop button) to kill runaway code.
 */

let pyodide = null;
let booting = null;

const PYODIDE_VERSION = '0.26.2';
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

function post(msg) {
  self.postMessage(msg);
}

async function ensurePyodide() {
  if (pyodide) return pyodide;
  if (!booting) {
    booting = (async () => {
      post({ type: 'status', message: 'Loading Python runtime…' });
      importScripts(PYODIDE_CDN + 'pyodide.js');
      pyodide = await loadPyodide({ indexURL: PYODIDE_CDN });
      post({ type: 'ready' });
      return pyodide;
    })();
    booting.catch(() => {
      booting = null;
      pyodide = null;
    });
  }
  return booting;
}

function makeStdinProvider(stdinText) {
  const lines = String(stdinText || '').split('\n');
  let idx = 0;
  return function () {
    if (idx < lines.length) {
      const line = lines[idx];
      idx += 1;
      return line;
    }
    // EOF — input() will raise EOFError, which the student will see.
    return '';
  };
}

async function runCode(id, code, stdinText) {
  const py = await ensurePyodide();
  py.setStdin({ stdin: makeStdinProvider(stdinText) });

  const runner = `
import sys, io, traceback, json

_out = io.StringIO()
_err = io.StringIO()
_old_out, _old_err = sys.stdout, sys.stderr
sys.stdout = _out
sys.stderr = _err
_error_text = ''
_exit_ok = True
try:
    exec(compile(_student_code, '<student>', 'exec'), _student_globals)
except BaseException:
    _exit_ok = False
    _error_text = traceback.format_exc(limit=None)
finally:
    sys.stdout, sys.stderr = _old_out, _old_err

json.dumps({
    'output': _out.getvalue(),
    'stderr': _err.getvalue(),
    'error': _error_text,
    'exit_ok': _exit_ok,
})
`;

  try {
    py.globals.set('_student_code', code);
    py.globals.set('_student_globals', py.toPy({}));
    const raw = await py.runPythonAsync(runner);
    const parsed = JSON.parse(raw);
    // Merge captured stderr into the error channel only when there is no traceback,
    // so real errors are never hidden but plain sys.stderr writes still surface.
    let errorText = parsed.error || '';
    if (!errorText && parsed.stderr) errorText = parsed.stderr;
    post({
      type: 'result',
      id,
      output: parsed.output || '',
      error: errorText,
    });
  } catch (err) {
    post({
      type: 'result',
      id,
      output: '',
      error: String(err && err.message ? err.message : err),
    });
  } finally {
    py.globals.delete('_student_code');
    py.globals.delete('_student_globals');
  }
}

self.onmessage = async (event) => {
  const data = event.data || {};
  if (data.type === 'run') {
    try {
      await runCode(data.id, data.code || '', data.stdin || '');
    } catch (err) {
      post({ type: 'error', id: data.id, message: String(err) });
    }
  }
};
