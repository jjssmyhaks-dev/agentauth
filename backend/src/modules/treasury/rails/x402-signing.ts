/**
 * x402 payment-header construction (PRD §8.1, FR-PAY-4).
 *
 * Builds the `X-PAYMENT` payload the agent retries its request with, using the
 * customer's own wallet-provider signing key (non-custodial, §9.6 — the key is
 * supplied per-call by the rail connection, never stored by the platform).
 *
 * EIP-3009 `transferWithAuthorization` (USDC on EVM chains) is the transfer
 * scheme: a signed EIP-712 message authorizing the facilitator to move
 * `max_amount` to `pay_to`. Testnet first (Base Sepolia); mainnet networks are
 * listed but gated by `environment: 'live'` rail connections.
 *
 * NOTE: the exact X-PAYMENT envelope (version field, scheme names) must be
 * re-verified against the current x402 specification before any live-rail use
 * (PRD §0.5 — external facts are dated). The signing primitives here are
 * standard and testable independently of the envelope.
 */
import { privateKeyToAccount } from 'viem/accounts';
import { numberToHex } from 'viem';

export const X402_NETWORKS: Record<string, { chainId: number; name: string; testnet: boolean; asset: string; decimals: number }> = {
  'base-sepolia': { chainId: 84532, name: 'Base Sepolia', testnet: true, asset: 'USDC', decimals: 6 },
  'base': { chainId: 8453, name: 'Base', testnet: false, asset: 'USDC', decimals: 6 },
};

export interface X402Requirements {
  network: string;
  pay_to: string;
  asset?: string;
  /** The 402 response's maxAmountRequired, when the server supplied one. */
  max_amount_required_minor?: string;
}

export interface X402SigningKey {
  /** EVM private key from the customer's provider account (never persisted). */
  private_key: string;
}

/**
 * Build the base64url X-PAYMENT payload. Amount comes from the APPROVED intent
 * (min of authorized max and the server's requirement) — never from caller
 * input (T12: intent tampering).
 */
export async function buildX402PaymentHeader(
  requirements: X402Requirements,
  approvedAmountMinor: string,
  key: X402SigningKey,
  environment: 'sandbox' | 'live',
): Promise<{ header: string; network: string; amount_minor: string }> {
  const network = X402_NETWORKS[requirements.network];
  if (!network) throw new Error(`unsupported x402 network: ${requirements.network}`);
  if (network.testnet && environment === 'live') {
    throw new Error('testnet network cannot be used with a live rail connection');
  }
  if (!network.testnet && environment !== 'live') {
    throw new Error('mainnet networks require a live rail connection');
  }

  const account = privateKeyToAccount(key.private_key as `0x${string}`);

  const amounts = [BigInt(approvedAmountMinor)];
  if (requirements.max_amount_required_minor) amounts.push(BigInt(requirements.max_amount_required_minor));
  const amountMinor = amounts.reduce((a, b) => (a < b ? a : b));
  if (amountMinor <= 0n) throw new Error('payment amount must be positive');

  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 600); // 10 min window
  const nonce = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

  // EIP-712 typed data for EIP-3009 transferWithAuthorization (USDC v2 shape).
  const signature = await account.signTypedData({
    domain: {
      name: 'USD Coin',
      version: '2',
      chainId: network.chainId,
      verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base; testnet share the address on Base Sepolia
    },
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    message: {
      from: account.address,
      to: requirements.pay_to as `0x${string}`,
      value: amountMinor,
      validAfter: BigInt(Math.floor(Date.now() / 1000) - 60),
      validBefore,
      nonce: `0x${nonce}` as `0x${string}`,
    },
  });

  const envelope = {
    x402Version: 1,
    scheme: 'exact',
    network: requirements.network,
    payload: {
      signature,
      authorization: {
        from: account.address,
        to: requirements.pay_to,
        value: numberToHex(amountMinor),
        validAfter: (Math.floor(Date.now() / 1000) - 60).toString(),
        validBefore: validBefore.toString(),
        nonce: `0x${nonce}`,
      },
    },
  };

  return {
    header: Buffer.from(JSON.stringify(envelope)).toString('base64url'),
    network: requirements.network,
    amount_minor: amountMinor.toString(),
  };
}
