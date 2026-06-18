import {
  Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, UseGuards,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { AuthGuard } from '../common/auth.guard';
import { currentContext } from '../tenant/tenant-context';

@Controller('v1/properties/:propertyId/documents')
@UseGuards(AuthGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @HttpCode(202)
  upload(
    @Param('propertyId') propertyId: string,
    @Body() body: { filename?: string; contentBase64: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const bytes = Buffer.from(body.contentBase64 ?? '', 'base64');
    return this.documents.upload(
      currentContext(), propertyId, body.filename ?? 'fil', bytes, idempotencyKey,
    );
  }

  @Get(':documentId/status')
  status(@Param('documentId') documentId: string) {
    return this.documents.getStatus(currentContext(), documentId);
  }

  @Delete(':documentId')
  shred(@Param('documentId') documentId: string) {
    return this.documents.shred(currentContext(), documentId);
  }
}
