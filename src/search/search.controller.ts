import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { AuthGuard } from '../common/auth.guard';
import { currentContext } from '../tenant/tenant-context';

@Controller('v1/properties/:propertyId')
@UseGuards(AuthGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Post('search')
  doSearch(@Param('propertyId') propertyId: string, @Body() body: { query: string }) {
    return this.search.search(currentContext(), propertyId, body.query || '');
  }

  @Post('ask')
  doAsk(@Param('propertyId') propertyId: string, @Body() body: { question: string }) {
    return this.search.ask(currentContext(), propertyId, body.question || '');
  }
}
