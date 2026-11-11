// Minimal WebDriver BiDi client for Firefox (Node 22+, built-in WebSocket).
// Firefox must run with --remote-debugging-port=<port>.

export async function connect(port = 9333) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.id != null && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.type === 'error') reject(new Error(`${data.error}: ${data.message}`));
      else resolve(data.result);
    } else if (data.type === 'event') {
      for (const l of listeners) l(data);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject: (e) => reject(new Error(method + ': ' + e.message)) });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send('session.new', { capabilities: {} });

  const b = {
    send,
    on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    async close() { try { await send('session.end'); } catch {} ws.close(); },

    async context() {
      const { contexts } = await send('browsingContext.getTree', { maxDepth: 0 });
      return contexts[0].context;
    },
    async newTab() {
      return (await send('browsingContext.create', { type: 'tab' })).context;
    },
    goto: (context, url) => send('browsingContext.navigate', { context, url, wait: 'complete' }),

    // Run JS in the page; returns the plain value.
    async eval(context, expression) {
      const r = await send('script.evaluate', {
        target: { context }, expression, awaitPromise: true, resultOwnership: 'none',
      });
      if (r.type === 'exception') throw new Error('page exception: ' + r.exceptionDetails.text);
      return unwrap(r.result);
    },

    async screenshot(context) {
      return Buffer.from((await send('browsingContext.captureScreenshot', { context })).data, 'base64');
    },

    // Smooth mouse move (real pointer events: triggers hover), optional click.
    async mouse(context, x, y, { click = false, duration = 400 } = {}) {
      const actions = [{ type: 'pointerMove', x: Math.round(x), y: Math.round(y), duration }];
      if (click) actions.push({ type: 'pointerDown', button: 0 }, { type: 'pointerUp', button: 0 });
      await send('input.performActions', {
        context, actions: [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions }],
      });
    },
  };
  return b;
}

function unwrap(v) {
  if (!v) return v;
  switch (v.type) {
    case 'undefined': return undefined;
    case 'null': return null;
    case 'string': case 'number': case 'boolean': return v.value;
    case 'array': return v.value.map(unwrap);
    case 'object': return Object.fromEntries(v.value.map(([k, val]) => [typeof k === 'string' ? k : unwrap(k), unwrap(val)]));
    default: return v.value ?? v.type;
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
