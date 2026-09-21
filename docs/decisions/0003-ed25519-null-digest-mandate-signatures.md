# ADR 0003 — Mandate signatures: Ed25519 with a null digest over the canonical hash

**Status:** Accepted · **Date:** 2026-09-21 · **Scope:** M3 mandates

## Context

Mandate signatures (FR-ID-2) are produced over `sha256(canonicalJson(mandate fields))`. The platform's agent keys are Ed25519. Node's `crypto.verify('sha256', …)` throws `invalid digest` for Ed25519 keys — Ed25519 signs raw messages and requires a `null` digest parameter. An earlier implementation wrapped the call in a catch that masked the throw as "invalid signature", making every genuinely valid mandate signature fail.

## Decision

Signature verification selects the digest by key type: `null` for `ed25519` (verifying over the raw hash buffer), `'sha256'` for RSA/EC keys. The same rule applies to approval decisions (FR-APR-3). `canonicalJson` (sorted keys) is the single canonicalization of record; signers must reproduce it exactly.

## Consequences

- The mandate acceptance test signs with `crypto.sign(null, hashBuffer, key)` and passes; a tampered `hard_limits` payload fails verification.
- A regression test asserts both the accept and tamper-reject paths, so the digest rule cannot silently regress.
