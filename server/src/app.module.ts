import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { NotesModule } from './notes/notes.module';
import { TagsModule } from './tags/tags.module';
import { TasksModule } from './tasks/tasks.module';
import { HealthModule } from './health/health.module';
import { AdminModule } from './admin/admin.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';
import { BackupModule } from './backup/backup.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60000, // 1 minute window
          limit: 60, // 60 requests per minute globally
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    NotesModule,
    TagsModule,
    TasksModule,
    HealthModule,
    AdminModule,
    SettingsModule,
    UsersModule,
    BackupModule,
    AuditModule,
  ],
})
export class AppModule {}
