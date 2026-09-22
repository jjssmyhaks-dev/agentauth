import { generateKeyPairSync, sign as edSign } from 'crypto';
import { verifyProof, requestHashFor, type ProofCheckInput } from './proof-verification';

/**
 * Unit tests for the DPoP-style proof verifier (T2 mitigation, PRD §9.3).
 * The signature contract mirrors sdk/src/treasury.ts signProof():
 * Ed25519 over the raw 32 bytes of sha256(canonical body), proof header
 * "<base64sig>.<issued_at_ms>" (legacy plain "<base64sig>" also accepted).
 */

// Fresh throwaway keypair per test run — never a real agent key.
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const PUBLIC_KEY_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();

function signProof(body: unknown, issuedAtMs: number): string {
  const hash = requestHashFor(body);
  const sig = edSign(null, Buffer.from(hash, 'hex'), privateKey).toString('base64');
  return `${sig}.${issuedAtMs}`;
}

describe('verifyProof (DPoP-style proof of possession)', () => {
  const body = { agent_id: 'agent-1', amount: { value: '0.75', asset: 'USDC' }, rail: 'x402' };
  const now = new Date('2026-09-22T12:00:00.000Z');

  it('accepts a valid timestamped proof and returns the request hash', async () => {
    const input: ProofCheckInput = {
      body,
      proof: signProof(body, now.getTime()),
      agentPublicKeyPem: PUBLIC_KEY_PEM,
      now,
    };
    const res = await verifyProof(input);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.request_hash).toBe(requestHashFor(body));
      expect(res.proof_ts.getTime()).toBe(now.getTime());
      expect(res.nonce).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('accepts the legacy plain form (no timestamp) and stamps proof_ts = now', async () => {
    const hash = requestHashFor(body);
    const sig = edSign(null, Buffer.from(hash, 'hex'), privateKey).toString('base64');
    const res = await verifyProof({ body, proof: sig, agentPublicKeyPem: PUBLIC_KEY_PEM, now });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.proof_ts.getTime()).toBe(now.getTime());
  });

  it('rejects a tampered body (amount inflated after signing)', async () => {
    const signed = { ...body, amount: { value: '0.75', asset: 'USDC' } };
    const sent = { ...body, amount: { value: '975.00', asset: 'USDC' } };
    const res = await verifyProof({
      body: sent,
      proof: signProof(signed, now.getTime()),
      agentPublicKeyPem: PUBLIC_KEY_PEM,
      now,
    });
    expect(res).toMatchObject({ ok: false, code: 'proof_invalid' });
  });

  it('rejects a proof older than the freshness window', async () => {
    const stale = new Date(now.getTime() - 10 * 60_000);
    const res = await verifyProof({
      body,
      proof: signProof(body, stale.getTime()),
      agentPublicKeyPem: PUBLIC_KEY_PEM,
      now,
    });
    expect(res).toMatchObject({ ok: false, code: 'proof_stale' });
  });

  it('rejects a proof too far in the future', async () => {
    const future = new Date(now.getTime() + 10 * 60_000);
    const res = await verifyProof({
      body,
      proof: signProof(body, future.getTime()),
      agentPublicKeyPem: PUBLIC_KEY_PEM,
      now,
    });
    expect(res).toMatchObject({ ok: false, code: 'proof_stale' });
  });

  it('fails closed on a missing proof header', async () => {
    const res = await verifyProof({ body, proof: null, agentPublicKeyPem: PUBLIC_KEY_PEM, now });
    expect(res).toMatchObject({ ok: false, code: 'proof_missing' });
  });

  it('fails closed when the agent has no registered key', async () => {
    const res = await verifyProof({
      body,
      proof: signProof(body, now.getTime()),
      agentPublicKeyPem: null,
      now,
    });
    expect(res).toMatchObject({ ok: false, code: 'proof_invalid' });
  });

  it('fails closed on a signature from a different key', async () => {
    const { privateKey: other } = generateKeyPairSync('ed25519');
    const hash = requestHashFor(body);
    const sig = edSign(null, Buffer.from(hash, 'hex'), other).toString('base64');
    const res = await verifyProof({
      body,
      proof: `${sig}.${now.getTime()}`,
      agentPublicKeyPem: PUBLIC_KEY_PEM,
      now,
    });
    expect(res).toMatchObject({ ok: false, code: 'proof_invalid' });
  });

  it('fails closed on garbage proof bytes (with a fresh timestamp)', async () => {
    const res = await verifyProof({
      body,
      proof: `!!!not-a-signature!!!.${now.getTime()}`,
      agentPublicKeyPem: PUBLIC_KEY_PEM,
      now,
    });
    expect(res).toMatchObject({ ok: false, code: 'proof_invalid' });
  });

  it('rejects a replayed proof when the nonce was already consumed', async () => {
    const proof = signProof(body, now.getTime());
    const seen = new Set<string>();
    const wasNonceUsed = async (nonce: string) => seen.has(nonce);

    const first = await verifyProof({ body, proof, agentPublicKeyPem: PUBLIC_KEY_PEM, now, wasNonceUsed });
    expect(first.ok).toBe(true);
    if (first.ok) seen.add(first.nonce);

    const second = await verifyProof({ body, proof, agentPublicKeyPem: PUBLIC_KEY_PEM, now, wasNonceUsed });
    expect(second).toMatchObject({ ok: false, code: 'proof_replayed' });
  });

  it('derives distinct nonces for distinct bodies (no cross-request collisions)', async () => {
    const bodyB = { ...body, amount: { value: '0.76', asset: 'USDC' } };
    const a = await verifyProof({ body, proof: signProof(body, now.getTime()), agentPublicKeyPem: PUBLIC_KEY_PEM, now });
    const b = await verifyProof({ body: bodyB, proof: signProof(bodyB, now.getTime()), agentPublicKeyPem: PUBLIC_KEY_PEM, now });
    if (a.ok && b.ok) expect(a.nonce).not.toBe(b.nonce);
    else throw new Error('both proofs should verify');
  });
});
