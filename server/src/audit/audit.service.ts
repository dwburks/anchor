import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  action: string;
  actor?: string;
  target?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Log an audit event. Fire-and-forget — never throws.
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          actor: entry.actor,
          target: entry.target,
          details: entry.details ? JSON.stringify(entry.details) : null,
          ipAddress: entry.ipAddress,
        },
      });
    } catch (error) {
      // Audit logging should never break the main flow
      this.logger.error(`Failed to write audit log: ${error}`);
    }
  }

  /**
   * Query audit logs with pagination and optional filters.
   */
  async findAll(options: {
    skip?: number;
    take?: number;
    action?: string;
    actor?: string;
  }) {
    const { skip = 0, take = 50, action, actor } = options;

    const where: Record<string, unknown> = {};
    if (action) where.action = action;
    if (actor) where.actor = { contains: actor, mode: 'insensitive' };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      logs: logs.map((log) => ({
        ...log,
        details: log.details ? JSON.parse(log.details) : null,
      })),
      total,
      skip,
      take,
    };
  }
}
