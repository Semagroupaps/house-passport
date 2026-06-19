import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { PropertiesModule } from './properties/properties.module';
import { DocumentsModule } from './documents/documents.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { WarrantiesModule } from './warranties/warranties.module';
import { IdentityModule } from './identity/identity.module';
import { HealthModule } from './health/health.module';
import { SearchModule } from './search/search.module';
import { AdminModule } from './admin/admin.module';
import { SharingModule } from './sharing/sharing.module';
import { TransferModule } from './transfer/transfer.module';
import { DemoModule } from './demo/demo.module';
import { TenantContextMiddleware } from './tenant/tenant-context.middleware';

@Module({
  imports: [
    // Serverer forsiden (public/index.html) på roden; API'et lever under /v1 og /health
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/v1*', '/health*'],
    }),
    RedisModule,
    AuthModule,
    PropertiesModule,
    DocumentsModule,
    SearchModule,
    AdminModule,
    SharingModule,
    TransferModule,
    MaintenanceModule,
    WarrantiesModule,
    IdentityModule,
    HealthModule,
    // Demo-session kun når DEMO_MODE=true (skal være false i produktion)
    ...(process.env.DEMO_MODE === 'true' ? [DemoModule] : []),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('/v1*', '/health');
  }
}
