import { strictEqual } from 'node:assert/strict';

// Entrypoint smoke test: when content-agent.ts is executed as the main module
// (how a Supabase Edge Function deployment runs it), the `import.meta.main`
// guard must still register the HTTP handler. We spawn the file as a real
// subprocess on 127.0.0.1:8000 and expect a 405 for GET (handler only allows
// POST). In-process imports (a wrapper module importing this file) are covered
// by the other test file, which imports the module without any server starting.
//
// Permission-aware: without `--allow-run` / `--allow-net` the test is skipped
// so plain `deno test tests/` stays green:
//   deno test --allow-net=127.0.0.1:8000 --allow-run tests/

const netAllowed = Deno.permissions.querySync({ name: 'net', host: '127.0.0.1:8000' }).state === 'granted';
const runAllowed = Deno.permissions.querySync({ name: 'run', command: Deno.execPath() }).state === 'granted';

Deno.test({
  name: 'edge entrypoint registers handler when run as main module',
  ignore: !(netAllowed && runAllowed),
  fn: async () => {
    const entry = new URL('../src/agents/content-agent.ts', import.meta.url);
    const child = new Deno.Command(Deno.execPath(), {
      args: ['run', '--allow-net=0.0.0.0:8000', entry.href],
      stdout: 'piped',
      stderr: 'piped',
    }).spawn();

    const cleanup = async () => {
      try { child.kill(); } catch (error) {
        if (!(error instanceof TypeError)) throw error;
      }
      const result = await child.output();
      if (result.code !== 0 && result.signal === null) {
        throw new Error(new TextDecoder().decode(result.stderr));
      }
    };
    try {
      let status = 0;
      let body = '';
      let responded = false;
      for (let i = 0; i < 50 && !responded; i++) {
        try {
          const r = await fetch('http://127.0.0.1:8000/');
          status = r.status;
          body = await r.text();
          responded = true;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
      strictEqual(responded, true, 'server did not come up on 127.0.0.1:8000');
      strictEqual(status, 405);
      strictEqual(body, 'Method Not Allowed');
    } finally {
      await cleanup();
    }
  },
});
