/**
 * Browser key generation for agent registration.
 *
 * When the dashboard talks to the real API, a registered agent needs a real
 * PEM public key — the backend verifies challenge signatures against it
 * (crypto.createVerify('SHA256'), PKCS#1 v1.5). Placeholder strings like
 * "ed25519_pk_..." would make it impossible for any agent to authenticate.
 */
export async function generateAgentPublicKeyPem(): Promise<string> {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(spki)));
  const body = b64.replace(/(.{64})/g, "$1\n").trimEnd();
  return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`;
}

/** Deterministic placeholder for mock/demo mode (not a real key). */
export function mockPublicKey(): string {
  return "ed25519_pk_" + Math.random().toString(36).slice(2, 14);
}
