import { BadRequestException } from '@nestjs/common';
import { AUTH_REQUEST_KEY } from '../auth/api-key.guard';
import { resolveOrg } from '../auth/org-resolver';

/** True when the request carries a real API key (strict org resolution). */
export function isAuthenticated(request: any): boolean {
  return !!request?.[AUTH_REQUEST_KEY]?.org_id;
}

/**
 * Org for this call: from the bearer key when authenticated (client-supplied
 * org ids are ignored), else the demo fallback. Also used to reject stale
 * demo clients after AUTH_STRICT is enabled.
 */
export function orgFrom(request: any, requested: string | null | undefined): string {
  const org = resolveOrg(request, requested ?? undefined);
  if (!org) throw new BadRequestException('org_id is required');
  return org;
}
