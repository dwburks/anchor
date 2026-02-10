import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { execSync } from 'child_process';
import { PrismaService } from '../prisma/prisma.service';

interface BackupTag {
  id: string;
  name: string;
  color: string | null;
}

interface BackupNote {
  id: string;
  title: string;
  content: string | null;
  isPinned: boolean;
  isArchived: boolean;
  background: string | null;
  state: string;
  tagIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface BackupData {
  version: string;
  exportedAt: string;
  app: string;
  notes: BackupNote[];
  tags: BackupTag[];
}

@Injectable()
export class BackupService {
  constructor(private prisma: PrismaService) {}

  async exportUserData(userId: string): Promise<BackupData> {
    const [notes, tags] = await Promise.all([
      this.prisma.note.findMany({
        where: {
          userId,
          state: { not: 'deleted' },
        },
        include: {
          tags: { select: { id: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.tag.findMany({
        where: {
          userId,
          isDeleted: false,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      app: 'anchor',
      notes: notes.map((note) => ({
        id: note.id,
        title: note.title,
        content: note.content,
        isPinned: note.isPinned,
        isArchived: note.isArchived,
        background: note.background,
        state: note.state,
        tagIds: note.tags.map((t) => t.id),
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      })),
      tags: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
      })),
    };
  }

  async importUserData(
    userId: string,
    data: BackupData,
  ): Promise<{
    imported: { notes: number; tags: number };
    skipped: { notes: number; tags: number };
  }> {
    // Validate structure
    if (!data || typeof data !== 'object') {
      throw new BadRequestException(
        'Invalid backup file: expected a JSON object.',
      );
    }

    if (data.app !== 'anchor' || !data.version) {
      throw new BadRequestException(
        'Invalid backup file. Expected an Anchor backup JSON.',
      );
    }

    if (!Array.isArray(data.notes) || !Array.isArray(data.tags)) {
      throw new BadRequestException(
        'Invalid backup format: missing notes or tags array.',
      );
    }

    // Enforce size limits to prevent OOM
    if (data.notes.length > 10000) {
      throw new BadRequestException(
        'Backup too large: max 10,000 notes per import.',
      );
    }
    if (data.tags.length > 1000) {
      throw new BadRequestException(
        'Backup too large: max 1,000 tags per import.',
      );
    }

    // Validate that notes and tags have required fields
    for (const note of data.notes) {
      if (!note || typeof note !== 'object' || !note.id || !note.title) {
        throw new BadRequestException(
          'Invalid backup: each note must have an id and title.',
        );
      }
    }
    for (const tag of data.tags) {
      if (!tag || typeof tag !== 'object' || !tag.id || !tag.name) {
        throw new BadRequestException(
          'Invalid backup: each tag must have an id and name.',
        );
      }
    }

    const result = {
      imported: { notes: 0, tags: 0 },
      skipped: { notes: 0, tags: 0 },
    };

    // Map from backup tag ID → actual tag ID (for resolving renames/conflicts)
    const tagIdMap = new Map<string, string>();

    await this.prisma.$transaction(async (tx) => {
      // --- Import tags first (notes reference them) ---
      for (const tag of data.tags) {
        // Check if tag already exists by ID
        const existingById = await tx.tag.findFirst({
          where: { id: tag.id, userId },
        });

        if (existingById) {
          tagIdMap.set(tag.id, existingById.id);
          result.skipped.tags++;
          continue;
        }

        // Check if tag exists by name (unique constraint: [userId, name])
        const existingByName = await tx.tag.findFirst({
          where: { userId, name: tag.name, isDeleted: false },
        });

        if (existingByName) {
          // Map the backup tag ID to the existing tag with the same name
          tagIdMap.set(tag.id, existingByName.id);
          result.skipped.tags++;
          continue;
        }

        // Create new tag with original ID
        const created = await tx.tag.create({
          data: {
            id: tag.id,
            name: tag.name,
            color: tag.color,
            userId,
          },
        });
        tagIdMap.set(tag.id, created.id);
        result.imported.tags++;
      }

      // --- Import notes ---
      for (const note of data.notes) {
        // Check if note already exists by ID
        const existing = await tx.note.findFirst({
          where: { id: note.id, userId },
        });

        if (existing) {
          result.skipped.notes++;
          continue;
        }

        // Resolve tag IDs through the mapping
        const resolvedTagIds = (note.tagIds || [])
          .map((id) => tagIdMap.get(id))
          .filter((id): id is string => id !== undefined);

        await tx.note.create({
          data: {
            id: note.id,
            title: note.title,
            content: note.content,
            isPinned: note.isPinned ?? false,
            isArchived: note.isArchived ?? false,
            background: note.background,
            state: (note.state as any) ?? 'active',
            userId,
            tags: resolvedTagIds.length
              ? { connect: resolvedTagIds.map((id) => ({ id })) }
              : undefined,
          },
        });
        result.imported.notes++;
      }
    });

    return result;
  }

  async adminFullBackup(): Promise<Buffer> {
    const pgUser = process.env.PG_USER || 'anchor';
    const pgDatabase = process.env.PG_DATABASE || 'anchor';
    const pgHost = process.env.PG_HOST || '127.0.0.1';
    const pgPort = process.env.PG_PORT || '5432';

    try {
      const dump = execSync(
        `pg_dump -h ${pgHost} -p ${pgPort} -U ${pgUser} -d ${pgDatabase} --clean --if-exists`,
        {
          env: {
            ...process.env,
            PGPASSWORD: process.env.PG_PASSWORD || '',
          },
          maxBuffer: 100 * 1024 * 1024, // 100MB
        },
      );
      return Buffer.from(dump);
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to create database backup. Is pg_dump available?',
      );
    }
  }
}
