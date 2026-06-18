import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { PropertiesModule } from './properties/properties.module';
import { DocumentsModule } from './documents/documents.module';
import { IdentityModule } from './identity/identity.module';
import { HealthModule } from './health/health.module';
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
