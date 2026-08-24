import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class OrgGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userOrgId = request.user?.org_id;
    const resourceOrgId = request.params?.org_id || request.body?.org_id || request.query?.org_id;

    // If no org context, allow (for public endpoints)
    if (!userOrgId) {
      return true;
    }

    // Check if user has access to the resource's org
    if (resourceOrgId && userOrgId !== resourceOrgId) {
      throw new ForbiddenException('Access denied to this organization');
    }

    return true;
  }
}
