/**
 * DPoP-style proof verification for the treasury authorize path (PRD §9.3,
 * T2 mitigation). The agent signs sha256(canonical request body) with its
 * registered Ed25519 key; `x-agentauth-proof` carries the base64 signature.
 *
 * The canonicalization here MUST match sdk/src/treasury.ts (sorted keys,
 * recursive) — it is the same function, restated, because the backend does
 * not import from the SDK package. `verifyProof` fails closed: any error,
 * missing key, stale timestamp or replayed nonce yields a denial, never a
 * bypass.
 */
import * as crypto from 'crypto';

/** ±5 minutes: generous for clock skew, tight enough to shrink the replay window. */
const PROOF_MAX_AGE_MS = 5 * 60 * 1000;
const PROOF_FUTURE_TOLERANCE_MS = 60 * 1000;

/** Recursive sorted-key JSON — byte-identical to canonicalJson in policy-schema.ts. */
export function canonicalizeBody(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalizeBody).join(',') + ']';
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value as object).sort();
    return (
      '{' +
      keys
        .map((k) => JSON.stringify(k) + ':' + canonicalizeBody((value as Record<string, unknown>)[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

/** The canonical request hash the proof must sign over. */
export function requestHashFor(body: unknown): string {
  return crypto.createHash('sha256').update(canonicalizeBody(body)).digest('hex');
}

export interface ProofCheckInput {
  /** Raw body as received (the controller passes the validated DTO). */
  body: unknown;
  /** base64 Ed25519 signature from the `x-agentauth-proof` header. */
  proof: string | null | undefined;
  /** The agent's registered PEM public key (SPKI). */
  agentPublicKeyPem: string | null | undefined;
  /** Server receive time (injected for tests). */
  now?: Date;
  /** Repo-like gate for replay detection: was this exact proof consumed before? */
  wasNonceUsed?: (nonce: string) => Promise<boolean>;
}

export type ProofCheckResult =
  | { ok: true; request_hash: string; nonce: string; proof_ts: Date }
  | { ok: false; code: 'proof_missing' | 'proof_invalid' | 'proof_stale' | 'proof_replayed'; message: string };

/**
 * Verify a DPoP-style proof. Throws never — every failure is a typed result
 * so the caller can deny deterministically.
 */
export async function verifyProof(input: ProofCheckInput): Promise<ProofCheckResult> {
  const now = input.now ?? new Date();
  if (!input.proof) {
    return { ok: false, code: 'proof_missing', message: 'x-agentauth-proof header is required for payment authorization' };
  }
  if (!input.agentPublicKeyPem) {
    return { ok: false, code: 'proof_invalid', message: 'Agent has no registered public key to verify the proof against' };
  }

  let requestHash: string;
  let proofTs: Date | null = null;
  let signature: Buffer;
  try {
    requestHash = requestHashFor(input.body);
    // Two accepted forms (SDK parity):
    //  - "<base64sig>"                legacy/plain — freshness comes solely
    //    from the nonce table (proof_ts = now on accept).
    //  - "<base64sig>.<issued_at_ms>" current — adds a ±5 min freshness window.
    const parts = input.proof.split('.');
    if (parts.length === 2) {
      const [sigB64, tsMs] = parts;
      if (!sigB64 || !/^\d+$/.test(tsMs ?? '')) {
        return { ok: false, code: 'proof_invalid', message: 'Malformed proof (expected "<base64sig>" or "<base64sig>.<issued_at_ms>")' };
      }
      proofTs = new Date(Number(tsMs));
      signature = Buffer.from(sigB64, 'base64');
    } else if (parts.length === 1) {
      signature = Buffer.from(parts[0], 'base64');
    } else {
      return { ok: false, code: 'proof_invalid', message: 'Malformed proof header' };
    }
  } catch {
    return { ok: false, code: 'proof_invalid', message: 'Proof could not be decoded' };
  }

  if (proofTs !== null) {
    if (Number.isNaN(proofTs.getTime())) {
      return { ok: false, code: 'proof_invalid', message: 'Proof timestamp is not a valid number' };
    }
    const age = now.getTime() - proofTs.getTime();
    if (age > PROOF_MAX_AGE_MS) {
      return { ok: false, code: 'proof_stale', message: `Proof is ${Math.round(age / 1000)}s old (max ${PROOF_MAX_AGE_MS / 1000}s)` };
    }
    if (-age > PROOF_FUTURE_TOLERANCE_MS) {
      return { ok: false, code: 'proof_stale', message: 'Proof timestamp is too far in the future' };
    }
  }

  let signatureValid = false;
  try {
    const publicKey = crypto.createPublicKey({ key: input.agentPublicKeyPem, format: 'pem', type: 'spki' });
    // Ed25519 requires a null digest (raw message); RSA/EC keys take sha256.
    const digest = publicKey.asymmetricKeyType === 'ed25519' ? null : 'sha256';
    signatureValid = crypto.verify(
      digest as 'sha256' | null,
      Buffer.from(requestHash, 'hex'),
      publicKey,
      signature,
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    return { ok: false, code: 'proof_invalid', message: 'Proof signature does not verify against the agent key' };
  }

  const nonce = crypto.createHash('sha256').update(`${requestHash}:${input.proof}`).digest('hex');
  if (input.wasNonceUsed && (await input.wasNonceUsed(nonce))) {
    return { ok: false, code: 'proof_replayed', message: 'This exact proof was already consumed (replay rejected)' };
  }

  return { ok: true, request_hash: requestHash, nonce, proof_ts: proofTs ?? now };
}
