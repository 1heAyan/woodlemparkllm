/**
 * CS Lab — sql.js (SQLite WebAssembly) loader.
 *
 * Robust bootstrap: initSqlJs internally does `fetch(wasm)` with an XHR
 * fallback, but if the dev/prod server serves an HTML 404 page for the
 * .wasm path, both attempts fail with the confusing
 * "both async and sync fetching of the wasm failed" error.
 *
 * We therefore verify the asset availability ourselves first and pass the
 * *bytes* to sql.js via `wasmBinary`, eliminating any server-dependent
 * fetch path inside the library.
 */

import initSqlJs from 'sql.js';

let sqlJsPromise: Promise<any> | null = null;

async function loadWasmBinary(): Promise<Uint8Array> {
  // 1. Standard fetch (works in browsers, Next.js dev & prod).
  try {
    const res = await fetch('/vendor/sql-wasm.wasm', { cache: 'force-cache' });
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      // Guard against HTML error pages returned with 200 in odd setups.
      if (!ct.includes('text/html')) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 100000) return new Uint8Array(buf);
      }
    }
  } catch {
    // fall through
  }

  // 2. XHR fallback (older browsers / stricter CSP fetch rules).
  try {
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', '/vendor/sql-wasm.wasm', true);
      xhr.responseType = 'arraybuffer';
      xhr.onload = () => {
        if (xhr.status === 200 && xhr.response && xhr.response.byteLength > 100000) {
          resolve(new Uint8Array(xhr.response));
        } else {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send();
    });
    return bytes;
  } catch {
    // fall through
  }

  throw new Error(
    'The SQL engine files could not be loaded (sql-wasm.wasm). Refresh the page, and if it persists, ask IT to confirm /vendor/sql-wasm.wasm is deployed.'
  );
}

/** Get (or bootstrap) a shared sql.js module instance with the WASM bytes pre-loaded. */
export function getSqlJs(): Promise<any> {
  if (!sqlJsPromise) {
    sqlJsPromise = (async () => {
      const wasmBinary = await loadWasmBinary();
      return initSqlJs({
        wasmBinary,
        // Not used when wasmBinary is provided, but kept for safety.
        locateFile: (file: string) => `/vendor/${file.split('/').pop()}`,
      } as any);
    })();
    sqlJsPromise.catch(() => {
      sqlJsPromise = null;
    });
  }
  return sqlJsPromise;
}
