// Node unit tests for the viewer-grant kernel the get-view-project Edge
// Function imports (supabase/functions/_shared/viewGrant.mjs). Plain ESM +
// Web Crypto, so Node 20's runner covers the same file Deno runs.
// Run with: npm run test:unit
const test = require('node:test');
const assert = require('node:assert');

const SECRET = 'test-secret-do-not-ship';
const TOKEN = '8f3c2a4e-1b9d-4c77-a0e2-6d5b1f0a9e21';
const NOW = 1757200000;

async function lib() {
  return import('./supabase/functions/_shared/viewGrant.mjs');
}

test('mint → verify round-trips the claims and binds to the token', async () => {
  const { mintViewGrant, verifyViewGrant } = await lib();
  const g = await mintViewGrant({ t: TOKEN, name: ' Behar Kraja ', email: 'Behar@Example.com', person: 'p-1' }, SECRET, NOW);
  assert.match(g, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  const v = await verifyViewGrant({ grant: g, secret: SECRET, token: TOKEN, nowSeconds: NOW + 60 });
  assert.strictEqual(v.ok, true);
  assert.deepStrictEqual(v.claims, { t: TOKEN, name: 'Behar Kraja', email: 'behar@example.com', person: 'p-1', via: 'pipetooling-sub-portal', iat: NOW, exp: NOW + 86400 });
});

test('a grant for another link, a stale one, a tampered one, or the wrong secret is refused', async () => {
  const { mintViewGrant, verifyViewGrant } = await lib();
  const g = await mintViewGrant({ t: TOKEN, name: 'Behar Kraja' }, SECRET, NOW);
  assert.strictEqual((await verifyViewGrant({ grant: g, secret: SECRET, token: 'other-token', nowSeconds: NOW })).reason, 'token_mismatch');
  assert.strictEqual((await verifyViewGrant({ grant: g, secret: SECRET, token: TOKEN, nowSeconds: NOW + 86400 })).reason, 'expired');
  assert.strictEqual((await verifyViewGrant({ grant: g, secret: 'another-secret', token: TOKEN, nowSeconds: NOW })).reason, 'bad_signature');
  // Tamper with the signature: refused. Tamper with the claims: refused too —
  // as bad_signature when it still decodes, as malformed when it no longer does.
  const dot = g.indexOf('.');
  const sigFlipped = g.slice(0, dot + 1) + (g[dot + 1] === 'A' ? 'B' : 'A') + g.slice(dot + 2);
  assert.strictEqual((await verifyViewGrant({ grant: sigFlipped, secret: SECRET, token: TOKEN, nowSeconds: NOW })).reason, 'bad_signature');
  const claimsFlipped = (g[0] === 'e' ? 'f' : 'e') + g.slice(1);
  assert.ok(['bad_signature', 'malformed'].includes((await verifyViewGrant({ grant: claimsFlipped, secret: SECRET, token: TOKEN, nowSeconds: NOW })).reason));
});

test('malformed input never throws', async () => {
  const { verifyViewGrant, parseViewGrant } = await lib();
  for (const bad of [undefined, null, '', 'nodot', '.', 'a.', '.b', 'not-base64!.sig', 'eyJ4IjoxfQ', 42]) {
    const v = await verifyViewGrant({ grant: bad, secret: SECRET, token: TOKEN, nowSeconds: NOW });
    assert.strictEqual(v.ok, false, String(bad));
    assert.ok(['malformed', 'bad_signature'].includes(v.reason), `${String(bad)} → ${v.reason}`);
  }
  assert.strictEqual(parseViewGrant('x.y.z')?.claims, undefined);
  assert.strictEqual((await verifyViewGrant({ grant: 'a.b', secret: '', token: TOKEN, nowSeconds: NOW })).reason, 'no_secret');
});

test('a grant from an unknown source, or one that claims more than a day, is refused', async () => {
  const { mintViewGrant, verifyViewGrant } = await lib();
  const odd = await mintViewGrant({ t: TOKEN, name: 'X', via: 'somewhere-else' }, SECRET, NOW);
  assert.strictEqual((await verifyViewGrant({ grant: odd, secret: SECRET, token: TOKEN, nowSeconds: NOW })).reason, 'unknown_source');
  const long = await mintViewGrant({ t: TOKEN, name: 'X', exp: NOW + 7 * 86400 }, SECRET, NOW);
  assert.strictEqual((await verifyViewGrant({ grant: long, secret: SECRET, token: TOKEN, nowSeconds: NOW })).reason, 'expired');
});

test('mint refuses to sign without a token, a name, or a secret', async () => {
  const { mintViewGrant } = await lib();
  await assert.rejects(() => mintViewGrant({ name: 'X' }, SECRET, NOW), /view token/);
  await assert.rejects(() => mintViewGrant({ t: TOKEN, name: '  ' }, SECRET, NOW), /viewer name/);
  await assert.rejects(() => mintViewGrant({ t: TOKEN, name: 'X' }, '', NOW), /secret/);
});
