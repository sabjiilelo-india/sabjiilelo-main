import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from './prisma';
import { logger } from './logger';

export async function audit(
  entry: { actorId?: string | null; areaId?: string | null; action: string; entity: string; entityId?: string | null; data?: unknown },
  tx: Tx = prisma,
) {
  try {
    await tx.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        areaId: entry.areaId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        data: (entry.data ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    logger.warn({ err }, 'audit log write failed');
  }
}
