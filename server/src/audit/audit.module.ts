import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global() // Make AuditService available everywhere without importing
@Module({
  imports: [PrismaModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
