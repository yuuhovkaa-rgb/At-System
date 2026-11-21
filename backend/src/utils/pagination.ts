import { z } from 'zod';

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  sort: z.string().max(40).optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export function paginate(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
export const pageMeta = (page: number, pageSize: number, total: number) => ({
  page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
});
/** Only allow sorting on whitelisted fields (prevents arbitrary column probing). */
export function orderBy<T extends string>(sort: string | undefined, order: 'asc' | 'desc', allowed: readonly T[], fallback: Record<string, 'asc' | 'desc'>) {
  return sort && (allowed as readonly string[]).includes(sort) ? { [sort]: order } : fallback;
}
