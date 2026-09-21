/**
 * Live end-to-end proof of the delegation layer against the running stack.
 *
 *  1. Register two agents (parent + child) with generated RSA keypairs
 *  2. Parent: keypair auth loop (challenge → sign → JWT)
 *  3. Grant the parent database:customers_table read+write
 *  4. Mint a delegated token for the child (narrowed to read-only)
 *  5. Child check:  read  → allowed   (covered by narrowed scopes)
 *  6. Child check:  write → denied    (narrowing enforced server-side)
 *  7. Revoke the delegation → child check now denied (delegation_revoked)
 *
 * Usage: BASE=http://localhost:4000 ORG=<uuid> KEY=<ak_…> node scripts/delegation-e2e.js
 * (run from backend/ so node_modules resolves)
 */
const crypto = require('crypto');

const BASE = process.env.BASE || 'http://localhost:4000';
const ORG = process.env.ORG || '00000000-0000-4000-8000-000000000001';
const KEY = process.env.KEY;
if (!KEY) {
  console.error('KEY env var required (control-plane API key, ak_…)');
  process.exit(1);
}

const H = {
  'content-type': 'application/json',
  authorization: `Bearer ${KEY}`,
};

async function api(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  return json;
}

function assert(cond, label) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`  ok  ${label}`);
}

(async () => {
  console.log('Delegation live E2E\n');

  // 1. Two agents with generated keypairs
  const { generateKeyPairSync } = crypto;
  const mk = (name) => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    return { privateKey, publicKey, name };
  };
  const parent = mk('delegation-parent-' + Date.now().toString(36));
  const child = mk('delegation-child-' + Date.now().toString(36));

  const parentReg = await api('POST', '/v1/agents', { org_id: ORG, name: parent.name, public_key: parent.publicKey });
  const childReg = await api('POST', '/v1/agents', { org_id: ORG, name: child.name, public_key: child.publicKey });
  parentReg.id = parentReg.agent_id ?? parentReg.id;
  childReg.id = childReg.agent_id ?? childReg.id;
  console.log(`  registered parent ${parentReg.id} / child ${childReg.id}`);

  // 2. Grant the parent read+write on customers_table (BEFORE minting its
  //    token — the token snapshots the grant scopes at issuance).
  const grant = await api('POST', '/v1/grants', {
    agent_id: parentReg.id,
    resource_type: 'database',
    resource_pattern: 'customers_table',
    allowed_actions: ['read', 'write'],
  });
  assert((grant.grant_id || grant.id) && grant.status === 'active', 'grant created for parent');

  // 3. Parent auth loop: challenge → sign → exchange
  const ch = await api('GET', `/v1/tokens/challenge?agent_id=${parentReg.id}`);
  const signer = crypto.createSign('SHA256');
  signer.update(ch.nonce);
  const signature = signer.sign(parent.privateKey, 'base64');
  const tok = await api('POST', '/v1/tokens', {
    agent_id: parentReg.id,
    signed_challenge: signature,
    challenge_nonce: ch.nonce,
  });
  assert(tok.token && tok.token.split('.').length === 3, 'parent JWT issued (RS256, 3 segments)');
  const parentToken = tok.token;

  // 4. Mint the delegated token, narrowed to read-only
  const delegation = await api('POST', '/v1/delegation', {
    parent_token: parentToken,
    child_agent_id: childReg.id,
    scopes: [{ resource_type: 'database', resource_pattern: 'customers_table', allowed_actions: ['read'] }],
    ttl_minutes: 5,
    purpose: 'live-e2e proof',
  });
  assert(delegation.token && delegation.depth === 1, `delegated token minted (depth ${delegation.depth})`);
  const childToken = delegation.token;

  // 5. Child read → allowed
  const read = await api('POST', '/v1/permissions/check', {
    token: childToken,
    resource_type: 'database',
    resource_id: 'customers_table',
    action: 'read',
  });
  assert(read.allowed === true, 'child READ allowed (authority derived from root grants)');

  // 6. Child write → denied by narrowing
  const write = await api('POST', '/v1/permissions/check', {
    token: childToken,
    resource_type: 'database',
    resource_id: 'customers_table',
    action: 'write',
  });
  assert(write.allowed === false, `child WRITE denied (narrowed scopes enforced) — reason: ${write.reason}`);
  assert(
    write.reason === 'no_matching_grant',
    'denial reason is no_matching_grant (narrowing filtered the grant out)',
  );

  // 7. Revoke → child denied
  await api('POST', `/v1/delegation/${delegation.delegation_id}/revoke`, { reason: 'proof complete' });
  const after = await api('POST', '/v1/permissions/check', {
    token: childToken,
    resource_type: 'database',
    resource_id: 'customers_table',
    action: 'read',
  });
  assert(after.allowed === false, 'child check after REVOCATION denied');
  assert(after.reason === 'delegation_revoked', `reason: ${after.reason}`);

  console.log('\nAll delegation assertions passed.');
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
