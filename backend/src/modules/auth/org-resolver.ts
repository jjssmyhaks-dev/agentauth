import { AUTH_REQUEST_KEY } from './api-key.guard';

/**
 * Resolve the org a control-plane call acts on.
 *
 * - Authenticated (real API key): the org comes from the key — any
 *   client-supplied org id (header/query/body) is IGNORED. This closes the
 *   x-org-id spoofing hole.
 * - Demo fallback (no API key, AUTH_STRICT=false): the requested org id is
 *   honored so the dashboard/E2E demo flows keep working; it is bound to the
 *   seeded demo org either way.
 */
export function resolveOrg(request: any, requestedOrgId?: string | null): string {
  const auth = request?.[AUTH_REQUEST_KEY];
  if (auth?.org_id) return auth.org_id;
  return requestedOrgId || '';
}
