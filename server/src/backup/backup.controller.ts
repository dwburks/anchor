import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import archiver = require('archiver');
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

  @Get('backup/export/markdown')
  @UseGuards(JwtAuthGuard)
  async exportMarkdownZip(
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ) {
    const files = await this.backupService.exportUserMarkdown(userId);
    const date = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="anchor-markdown-${date}.zip"`,
    );

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    // Deduplicate filenames
    const usedNames = new Map<string, number>();
    for (const file of files) {
      let name = file.filename;
      const count = usedNames.get(name) || 0;
      if (count > 0) {
        name = name.replace('.md', `-${count}.md`);
      }
      usedNames.set(file.filename, count + 1);
      archive.append(file.content, { name });
    }

    await archive.finalize();
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
