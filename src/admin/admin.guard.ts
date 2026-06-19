import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import { AdminService } from './admin.service';
import { currentContext } from '../tenant/tenant-context';

/** Tillader kun administratorer (isAdmin-flag eller ADMIN_EMAILS-allowlist). */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly admin: AdminService) {}
  async canActivate(): Promise<boolean> {
    const actor = await this.admin.resolveAdmin(currentContext().personId);
    if (!actor) throw new ForbiddenException('Kræver administratoradgang');
    return true;
  }
}
