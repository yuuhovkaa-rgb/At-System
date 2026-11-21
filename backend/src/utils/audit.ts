import { Request } from 'express';
import { prisma } from '../config/db';

type Json = Record<string, unknown> | null;

export async function audit(
  actor: { id: string } | string | null | undefined,
  action: string,
  entity: string,
  entityId?: string | null,
  before?: Json,
  after?: Json,
  req?: Request,
) {
  const userId = typeof actor === 'string' ? actor : actor?.id ?? null;
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId: entityId ?? null,
      before: (before ?? undefined) as never,
      after: (after ?? undefined) as never,
      ip: req?.ip ?? null,
    },
  });
}
