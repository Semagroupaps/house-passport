import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (e) {
      // Lad appen starte selv om databasen ikke er klar — Prisma forbinder lazily
      // ved første forespørgsel. Så undgår vi "no available server", og /health
      // viser db=down indtil databasen er oppe.
      this.logger.warn(`Kunne ikke forbinde til databasen ved opstart: ${String(e)}`);
    }
  }
}
