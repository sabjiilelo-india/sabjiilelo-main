import { Router } from 'express';
import { ROLE_LABEL, staffCreateSchema, staffUpdateSchema, type Role } from '@sabjiilelo/shared';
import { prisma } from '../lib/prisma';
import { body, param, q } from '../lib/http';
import { badRequest, conflict, notFound } from '../lib/errors';
import { audit } from '../lib/audit';
import { revokeUserSessions } from '../lib/tokens';
import { staffInclude, toStaff } from '../lib/serializers';
import { assertSameArea, authenticate, me, requirePermission, scopeArea } from '../middleware/auth';

export const staffRouter = Router();
staffRouter.use(authenticate);

const STAFF_ROLES: Role[] = ['MANAGER', 'ACCOUNTANT', 'HR', 'DELIVERY', 'VENDOR'];

staffRouter.get('/', requirePermission('manageStaff'), async (req, res) => {
  const role = q(req, 'role') as Role | undefined;
  const users = await prisma.user.findMany({
    where: { areaId: scopeArea(req), role: role && STAFF_ROLES.includes(role) ? role : { in: STAFF_ROLES } },
    include: staffInclude,
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
  });
  res.json(users.map(toStaff));
});

staffRouter.post('/', requirePermission('manageStaff'), async (req, res) => {
  const areaId = scopeArea(req);
  const input = body(req, staffCreateSchema);
  if (input.role === 'VENDOR' && !input.vendor) throw badRequest('Vendor business details are required');

  const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
  // One role per user: a customer can be promoted to staff, anyone else is already taken.
  if (existing && existing.role !== 'CUSTOMER') {
    throw conflict(`This number is already registered as ${ROLE_LABEL[existing.role]}`);
  }

  const user = await prisma.$transaction(async (tx) => {
    const data = { name: input.name, role: input.role, areaId, createdById: me(req).sub };
    const u = existing
      ? await tx.user.update({ where: { id: existing.id }, data })
      : await tx.user.create({ data: { ...data, phone: input.phone } });
    if (input.role === 'VENDOR' && input.vendor) {
      await tx.vendor.upsert({
        where: { userId: u.id },
        update: { ...input.vendor, areaId },
        create: { ...input.vendor, userId: u.id, areaId },
      });
    }
    return tx.user.findUniqueOrThrow({ where: { id: u.id }, include: staffInclude });
  });
  if (existing) await revokeUserSessions(existing.id);
  await audit({ actorId: me(req).sub, areaId, action: 'staff.create', entity: 'User', entityId: user.id, data: { role: input.role } });
  res.status(201).json(toStaff(user));
});

staffRouter.patch('/:id', requirePermission('manageStaff'), async (req, res) => {
  const id = param(req, 'id');
  const input = body(req, staffUpdateSchema);
  const current = await prisma.user.findUnique({ where: { id }, include: staffInclude });
  if (!current || !STAFF_ROLES.includes(current.role)) throw notFound('Staff member');
  assertSameArea(req, current.areaId);

  const nextRole = input.role ?? current.role;
  if (nextRole === 'VENDOR' && !current.vendor && !input.vendor?.businessName) {
    throw badRequest('Vendor business details are required');
  }

  const user = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { name: input.name, role: input.role, status: input.status, isOnline: input.status === 'BLOCKED' ? false : undefined },
    });
    if (nextRole === 'VENDOR' && input.vendor) {
      await tx.vendor.upsert({
        where: { userId: id },
        update: input.vendor,
        create: { businessName: input.vendor.businessName!, ...input.vendor, userId: id, areaId: current.areaId! },
      });
    }
    return tx.user.findUniqueOrThrow({ where: { id }, include: staffInclude });
  });
  if (input.status === 'BLOCKED' || (input.role && input.role !== current.role)) await revokeUserSessions(id);
  await audit({ actorId: me(req).sub, areaId: current.areaId, action: 'staff.update', entity: 'User', entityId: id, data: input });
  res.json(toStaff(user));
});
