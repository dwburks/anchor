import {
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BackupService } from './backup.service';

@Controller('api')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  // ── User endpoints ──────────────────────────────────────

  @Get('backup/export')
  @UseGuards(JwtAuthGuard)
  async exportUserBackup(
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ) {
    const data = await this.backupService.exportUserData(userId);
    const json = JSON.stringify(data, null, 2);
    const date = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="anchor-backup-${date}.json"`,
    );
    res.send(json);
  }

  @Post('backup/import')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async importUserBackup(
    @CurrentUser('id') userId: string,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    let data: any;
    try {
      data = JSON.parse(file.buffer.toString('utf-8'));
    } catch {
      throw new BadRequestException(
        'Invalid file: could not parse as JSON.',
      );
    }

    return this.backupService.importUserData(userId, data);
  }

  // ── Admin endpoints ─────────────────────────────────────

  @Get('admin/backup')
  @UseGuards(AdminGuard)
  async adminFullBackup(@Res() res: Response) {
    const dump = await this.backupService.adminFullBackup();
    const date = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'application/sql');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="anchor-full-backup-${date}.sql"`,
    );
    res.send(dump);
  }
}
