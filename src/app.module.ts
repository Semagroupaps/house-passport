import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { PropertiesModule } from './properties/properties.module';
import { DocumentsModule } from './documents/documents.module';
import { IdentityModule } from './identity/identity.module';
import { HealthModule } from './health/health.module';
import { TenantContextMiddleware } from './tenant/tenant-context.middleware';

@Module({
  imports: [
    RedisModule,
    AuthModule,
    PropertiesModule,
    DocumentsModule,
    IdentityModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
