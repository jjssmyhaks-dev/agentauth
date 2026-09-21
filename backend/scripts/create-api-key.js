#!/usr/bin/env node
/**
 * Bootstrap / ops CLI: create an API key for an org without going through
 * the API (the API requires an existing key — this breaks that first cycle).
 *
 * Usage (from backend/):
 *   node scripts/create-api-key.js <org_id> <name> [admin|operator|auditor]
 *
 * Prints the raw key exactly once. The hash stored here matches
 * AuthService.authenticate (sha256 of the raw key, utf-8).
 */
const { Client } = require('pg');
const crypto = require('crypto');

(async () => {
  const [orgId, name, role = 'admin'] = process.argv.slice(2);
  if (!orgId || !name) {
    console.error('usage: node scripts/create-api-key.js <org_id> <name> [admin|operator|auditor]');
    process.exit(1);
  }
  const raw = `ak_${crypto.randomBytes(24).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
  const client = new Client({
    connectionString:
      process.env.DATABASE_URL || 'postgres://agentauth:agentauth@localhost:5432/agentauth',
  });
  await client.connect();
  const res = await client.query(
    `INSERT INTO api_keys (org_id, name, role, prefix, key_hash, status)
     VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id, created_at`,
    [orgId, name, role, raw.slice(0, 12), hash],
  );
  await client.end();
  console.log(JSON.stringify({ id: res.rows[0].id, role, key: raw }, null, 2));
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
