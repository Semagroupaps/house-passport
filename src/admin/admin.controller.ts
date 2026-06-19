import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { AuthGuard } from '../common/auth.guard';
import { currentContext } from '../tenant/tenant-context';

@Controller('v1/admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** Bekræfter at den indloggede bruger er admin (til UI-gating). */
  @Get('me')
  async me() {
    return this.admin.resolveAdmin(currentContext().personId);
  }

  @Get('overview')
  overview() { return this.admin.overview(); }

  @Get('pipeline')
  pipeline() { return this.admin.pipeline(); }

  @Get('dead-letter')
  deadLetter() { return this.admin.deadLetter(); }

  @Post('dead-letter/:id/requeue')
  requeue(@Param('id') id: string) { return this.admin.requeueDeadLetter(id); }

  @Post('dead-letter/:id/discard')
  discard(@Param('id') id: string) { return this.admin.discardDeadLetter(id); }

  @Get('documents')
  documents(@Query('status') status?: string) { return this.admin.documents(status || 'failed'); }

  @Post('documents/:id/retry')
  retry(@Param('id') id: string) { return this.admin.retryDocument(id); }

  @Post('users/:id/admin')
  setAdmin(@Param('id') id: string, @Body() body: { isAdmin: boolean }) {
    return this.admin.setAdmin(id, body.isAdmin !== false);
  }
}
