import type { Request } from 'express';
import type { ZodType, ZodTypeDef } from 'zod';
import { badRequest } from './errors';

export function parse<T>(schema: ZodType<T, ZodTypeDef, unknown>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    const field = first?.path.join('.');
    throw badRequest(first ? (field ? `${field}: ${first.message}` : first.message) : 'Invalid input', r.error.flatten());
  }
  return r.data;
}

export const body = <T>(req: Request, schema: ZodType<T, ZodTypeDef, unknown>) => parse(schema, req.body);

export function q(req: Request, key: string): string | undefined {
  const v = req.query[key];
  return typeof v === 'string' && v.length ? v : undefined;
}

export function param(req: Request, key: string): string {
  return String(req.params[key]);
}

export function pageParams(req: Request) {
  const page = Math.max(1, Number(q(req, 'page') ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q(req, 'pageSize') ?? 25) || 25));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
export const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
