import {
  BadRequestException, ConflictException, Injectable, Logger,
  OnModuleDestroy, UnauthorizedException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { signToken, jwtSecretIsDefault } from './jwt';
import { hashPassword, verifyPassword } from './password';

/**
 * Den betroede identitetsudsteder. Bruger en admin-forbindelse til register/login
 * (præcis dét en ekstern IdP som Clerk/Auth0 ellers ville gøre). Al efterfølgende
 * dataadgang sker via almindelig hp_app-forbindelse og er RLS-styret.
 */
@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);
  private readonly admin = new PrismaClient({
    datasources: { db: { url: process.env.ADMIN_DATABASE_URL } },
  });

  constructor() {
    if (jwtSecretIsDefault()) {
      this.logger.warn('JWT_SECRET er ikke sat — bruger usikker standard. Sæt JWT_SECRET i produktion!');
    }
  }

  async register(email: string, password: string, displayName?: string) {
    const mail = (email || '').trim().toLowerCase();
    if (!mail.includes('@') || mail.length < 4) throw new BadRequestException('Ugyldig e-mail');
    if (!password || password.length < 8) throw new BadRequestException('Adgangskoden skal være mindst 8 tegn');
    const existing = await (this.admin as any).person.findUnique({ where: { email: mail } });
    if (existing) throw new ConflictException('E-mailen er allerede i brug');
    const person = await (this.admin as any).person.create({
      data: { email: mail, passwordHash: hashPassword(password), displayName: displayName?.trim() || mail.split('@')[0] },
    });
    return { token: signToken(person.id), person: this.publicPerson(person) };
  }

  async login(email: string, password: string) {
    const mail = (email || '').trim().toLowerCase();
    const person = await (this.admin as any).person.findUnique({ where: { email: mail } });
    if (!person || !person.passwordHash || !verifyPassword(password, person.passwordHash)) {
      throw new UnauthorizedException('Forkert e-mail eller adgangskode');
    }
    return { token: signToken(person.id), person: this.publicPerson(person) };
  }

  private publicPerson(p: any) {
    return { id: p.id, email: p.email, displayName: p.displayName, isMitidVerified: p.isMitidVerified };
  }

  async onModuleDestroy() {
    await this.admin.$disconnect();
  }
}
