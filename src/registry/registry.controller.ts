import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { DawaAddressService } from './dawa-address.service';
import { REGISTRY_ADAPTER, RegistryAdapter } from './registry.interface';

@Controller('v1/registry')
@UseGuards(AuthGuard)
export class RegistryController {
  constructor(
    private readonly dawa: DawaAddressService,
    @Inject(REGISTRY_ADAPTER) private readonly registry: RegistryAdapter,
  ) {}

  @Get('address-autocomplete')
  autocomplete(@Query('q') q: string) {
    return this.dawa.autocomplete(q || '');
  }

  @Get('lookup')
  lookup(@Query('address') address: string) {
    return this.registry.lookupByAddress(address || '');
  }
}
