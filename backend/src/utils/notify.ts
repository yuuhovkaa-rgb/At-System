import { prisma } from '../config/db';

export async function notify(userIds: string[], type: string, params: Record<string, unknown> = {}) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  await prisma.notification.createMany({
    data: ids.map((userId) => ({ userId, type, params: params as never })),
  });
}

export async function adminIds() {
  const rows = await prisma.user.findMany({ where: { role: { name: 'ADMIN' }, isActive: true }, select: { id: true } });
  return rows.map((r) => r.id);
}
