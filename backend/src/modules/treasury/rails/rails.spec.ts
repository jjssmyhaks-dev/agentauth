import { ManualRailAdapter } from './manual.adapter';
import { X402RailAdapter } from './x402.adapter';
import { buildX402PaymentHeader, X402_NETWORKS } from './x402-signing';

const ctxBase = { org_id: 'org-1', environment: 'sandbox' as const, connection: { provider: 'manual', config: {} } };

describe('ManualRailAdapter', () => {
  const adapter = new ManualRailAdapter();

  it('prepares and issues an off-platform instruction', async () => {
    const prepared = await adapter.prepare(
      { amount_minor: '750000', asset_code: 'USDC', counterparty: { identifier: 'acme' } },
      ctxBase,
    );
    expect(prepared.rail).toBe('manual');
    const cred = await adapter.issueCredential(prepared, {
      token: 'tok', jti: 'j1', intent_id: 'i1', agent_id: 'a1', mandate_id: 'm1',
      max_amount_minor: '750000', asset_code: 'USDC', counterparty: 'acme',
      audience: 'rail:manual', expires_at: new Date(Date.now() + 60_000),
    }, ctxBase);
    expect(cred.kind).toBe('instruction');
    expect(cred.payload.spend_token).toBe('tok');
  });

  it('confirm records the evidence verbatim', async () => {
    const r = await adapter.confirm('i1', { rail_ref: 'utr-123' }, ctxBase);
    expect(r.ok).toBe(true);
    expect(r.provider_ref).toBe('utr-123');
  });

  it('reconcile flags captures without evidence', async () => {
    const report = await adapter.reconcile(
      [
        { intent_id: 'i1', amount_minor: '100', asset_code: 'INR', rail_ref: 'utr' },
        { intent_id: 'i2', amount_minor: '100', asset_code: 'INR', rail_ref: null },
      ],
      { from: new Date(), to: new Date() },
      ctxBase,
    );
    expect(report.checked).toBe(2);
    expect(report.mismatches).toHaveLength(1);
  });

  it('assertNotRevoked rejects revoked, consumed and expired tokens', async () => {
    const now = new Date();
    await expect(adapter.assertNotRevoked({} as any, { revoked_at: now, consumed_at: null, expires_at: now })).rejects.toThrow('revoked');
    await expect(adapter.assertNotRevoked({} as any, { revoked_at: null, consumed_at: now, expires_at: now })).rejects.toThrow('already used');
    await expect(adapter.assertNotRevoked({} as any, { revoked_at: null, consumed_at: null, expires_at: new Date(Date.now() - 1000) })).rejects.toThrow('expired');
  });
});

describe('X402RailAdapter', () => {
  const adapter = new X402RailAdapter();

  it('rejects non-USDC assets (no implicit FX)', async () => {
    await expect(
      adapter.prepare({ amount_minor: '100', asset_code: 'INR', counterparty: { identifier: 'x' }, rail_details: { network: 'base-sepolia', pay_to: '0xabc' } }, ctxBase),
    ).rejects.toThrow('USDC');
  });

  it('rejects unknown networks and missing rail details', async () => {
    await expect(
      adapter.prepare({ amount_minor: '100', asset_code: 'USDC', counterparty: { identifier: 'x' }, rail_details: {} }, ctxBase),
    ).rejects.toThrow('requires rail_details.network');
    await expect(
      adapter.prepare({ amount_minor: '100', asset_code: 'USDC', counterparty: { identifier: 'x' }, rail_details: { network: 'solana', pay_to: '0xabc' } }, ctxBase),
    ).rejects.toThrow('unsupported');
  });

  it('blocks mainnet networks on sandbox connections', async () => {
    await expect(
      adapter.prepare({ amount_minor: '100', asset_code: 'USDC', counterparty: { identifier: 'x' }, rail_details: { network: 'base', pay_to: '0xabc' } }, ctxBase),
    ).rejects.toThrow('live rail connection');
  });

  it('falls back to the bare spend token when no wallet key is connected', async () => {
    const cred = await adapter.issueCredential(
      { rail: 'x402', counterparty: { identifier: 'api.example.com' }, amount_minor: '750000', asset_code: 'USDC', details: { network: 'base-sepolia', pay_to: '0xabc' } },
      { token: 'tok', jti: 'j1', intent_id: 'i1', agent_id: 'a1', mandate_id: 'm1', max_amount_minor: '750000', asset_code: 'USDC', counterparty: 'api.example.com', audience: 'rail:x402', expires_at: new Date(Date.now() + 60_000) },
      ctxBase,
    );
    expect(cred.kind).toBe('spend_token');
  });
});

describe('x402 signing (EIP-3009 header)', () => {
  const TEST_KEY = '0x' + '11'.repeat(32); // deterministic anvil-style key

  it('network table ships testnet first and gates mainnet', () => {
    expect(X402_NETWORKS['base-sepolia'].testnet).toBe(true);
    expect(X402_NETWORKS['base'].testnet).toBe(false);
  });

  it('builds a base64url X-PAYMENT header signed by the wallet key', async () => {
    const { header, amount_minor } = await buildX402PaymentHeader(
      { network: 'base-sepolia', pay_to: '0x000000000000000000000000000000000000dEaD' },
      '750000',
      { private_key: TEST_KEY },
      'sandbox',
    );
    expect(header).toMatch(/^[A-Za-z0-9_-]+$/);
    const envelope = JSON.parse(Buffer.from(header, 'base64url').toString());
    expect(envelope.scheme).toBe('exact');
    expect(envelope.payload.authorization.value).toBeDefined();
    expect(BigInt(envelope.payload.authorization.value)).toBe(750000n);
    expect(amount_minor).toBe('750000');
  });

  it('caps the amount at the server-required minimum (never above the approved max)', async () => {
    const { amount_minor } = await buildX402PaymentHeader(
      { network: 'base-sepolia', pay_to: '0x000000000000000000000000000000000000dEaD', max_amount_required_minor: '500000' },
      '750000',
      { private_key: TEST_KEY },
      'sandbox',
    );
    expect(amount_minor).toBe('500000');
  });

  it('rejects a live environment against a testnet network', async () => {
    await expect(
      buildX402PaymentHeader({ network: 'base-sepolia', pay_to: '0xdEaD' }, '750000', { private_key: TEST_KEY }, 'live'),
    ).rejects.toThrow('live rail connection');
  });
});
