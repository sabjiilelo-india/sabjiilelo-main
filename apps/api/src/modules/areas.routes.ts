import { Router } from 'express';
import {
  adminCreateSchema,
  adminUpdateSchema,
  areaCreateSchema,
  areaSettingsSchema,
  areaUpdateSchema,
  todayIST,
  ymdToDate,
  ROLE_LABEL,
} from '@sabjiilelo/shared';
import { prisma } from '../lib/prisma';
import { body, param } from '../lib/http';
import { conflict, notFound } from '../lib/errors';
import { audit } from '../lib/audit';
import { revokeUserSessions } from '../lib/tokens';
import { areaInclude, staffInclude, toArea, toStaff } from '../lib/serializers';
import { authenticate, me, requirePermission, requireRole, scopeArea } from '../middleware/auth';

export const areasRouter = Router();
areasRouter.use(authenticate);

const DEFAULT_SLOTS = [
  { label: 'Morning', startTime: '07:00', endTime: '10:00', cutoffMinutesBefore: 600, capacity: 150, sort: 0 },
  { label: 'Evening', startTime: '17:00', endTime: '20:00', cutoffMinutesBefore: 240, capacity: 150, sort: 1 },
];

// ---------------------------------------------------------------- super admin: areas

areasRouter.get('/areas', requirePermission('manageAreas'), async (_req, res) => {
  const areas = await prisma.area.findMany({ include: areaInclude, orderBy: { createdAt: 'asc' } });
  res.json(areas.map(toArea));
});

areasRouter.post('/areas', requirePermission('manageAreas'), async (req, res) => {
  const { pincodes, ...data } = body(req, areaCreateSchema);
  const area = await prisma.area.create({
    data: {
      ...data,
      pincodes: { create: [...new Set(pincodes)].map((pincode) => ({ pincode })) },
      slots: { create: DEFAULT_SLOTS },
    },
    include: areaInclude,
  });
  await audit({ actorId: me(req).sub, areaId: area.id, action: 'area.create', entity: 'Area', entityId: area.id, data: { code: area.code } });
  res.status(201).json(toArea(area));
});

areasRouter.patch('/areas/:id', requirePermission('manageAreas'), async (req, res) => {
  const id = param(req, 'id');
  const { pincodes, ...data } = body(req, areaUpdateSchema);
  const area = await prisma.$transaction(async (tx) => {
    if (pincodes) {
      await tx.areaPincode.deleteMany({ where: { areaId: id } });
      await tx.areaPincode.createMany({ data: [...new Set(pincodes)].map((pincode) => ({ areaId: id, pincode })) });
    }
    return tx.area.update({ where: { id }, data, include: areaInclude });
  });
  await audit({ actorId: me(req).sub, areaId: id, action: 'area.update', entity: 'Area', entityId: id, data: req.body });
  res.json(toArea(area));
});

areasRouter.get('/superadmin/overview', requirePermission('manageAreas'), async (_req, res) => {
  const today = ymdToDate(todayIST());
  const areas = await prisma.area.findMany({ include: areaInclude, orderBy: { createdAt: 'asc' } });
  const [staff, todaysOrders, customers] = await Promise.all([
    prisma.user.groupBy({ by: ['areaId'], where: { areaId: { not: null }, role: { not: 'CUSTOMER' } }, _count: true }),
    prisma.order.groupBy({
      by: ['areaId'],
      where: { slotDate: today, status: { notIn: ['CANCELLED', 'PAYMENT_PENDING'] } },
      _count: true,
      _sum: { finalPayablePaise: true },
    }),
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
  ]);
  res.json({
    customers,
    areas: areas.map((a) => ({
      ...toArea(a),
      staffCount: staff.find((s) => s.areaId === a.id)?._count ?? 0,
      todayOrders: todaysOrders.find((o) => o.areaId === a.id)?._count ?? 0,
      todayRevenuePaise: todaysOrders.find((o) => o.areaId === a.id)?._sum.finalPayablePaise ?? 0,
    })),
  });
});

// ---------------------------------------------------------------- super admin: admins

areasRouter.get('/admins', requirePermission('manageAdmins'), async (_req, res) => {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    include: { ...staffInclude, area: { select: { id: true, code: true, name: true, city: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json(admins.map((a) => ({ ...toStaff(a), area: a.area })));
});

areasRouter.post('/admins', requirePermission('manageAdmins'), async (req, res) => {
  const input = body(req, adminCreateSchema);
  const area = await prisma.area.findUnique({ where: { id: input.areaId } });
  if (!area) throw notFound('Area');
  const existingAdmin = await prisma.user.findFirst({ where: { areaId: input.areaId, role: 'ADMIN' } });
  if (existingAdmin) throw conflict(`${area.name} already has an admin (${existingAdmin.phone})`);

  const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
  if (existing && existing.role !== 'CUSTOMER') {
    throw conflict(`This number is already registered as ${ROLE_LABEL[existing.role]}`);
  }
  const admin = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { role: 'ADMIN', areaId: input.areaId, name: input.name, createdById: me(req).sub },
        include: staffInclude,
      })
    : await prisma.user.create({
        data: { phone: input.phone, name: input.name, role: 'ADMIN', areaId: input.areaId, createdById: me(req).sub },
        include: staffInclude,
      });
  if (existing) await revokeUserSessions(existing.id);
  await audit({ actorId: me(req).sub, areaId: input.areaId, action: 'admin.create', entity: 'User', entityId: admin.id });
  res.status(201).json(toStaff(admin));
});

areasRouter.patch('/admins/:id', requirePermission('manageAdmins'), async (req, res) => {
  const id = param(req, 'id');
  const input = body(req, adminUpdateSchema);
  const current = await prisma.user.findFirst({ where: { id, role: 'ADMIN' } });
  if (!current) throw notFound('Admin');
  if (input.areaId && input.areaId !== current.areaId) {
    const taken = await prisma.user.findFirst({ where: { areaId: input.areaId, role: 'ADMIN' } });
    if (taken) throw conflict('That area already has an admin');
  }
  const admin = await prisma.user.update({ where: { id }, data: input, include: staffInclude });
  if (input.status === 'BLOCKED' || input.areaId) await revokeUserSessions(id);
  await audit({ actorId: me(req).sub, areaId: admin.areaId, action: 'admin.update', entity: 'User', entityId: id, data: input });
  res.json(toStaff(admin));
});

// ---------------------------------------------------------------- staff: own area

areasRouter.get('/area', async (req, res) => {
  const area = await prisma.area.findUnique({ where: { id: scopeArea(req) }, include: areaInclude });
  if (!area) throw notFound('Area');
  res.json(toArea(area));
});

areasRouter.patch('/area/settings', requireRole('ADMIN'), async (req, res) => {
  const areaId = scopeArea(req);
  const data = body(req, areaSettingsSchema);
  const area = await prisma.area.update({ where: { id: areaId }, data, include: areaInclude });
  await audit({ actorId: me(req).sub, areaId, action: 'area.settings', entity: 'Area', entityId: areaId, data });
  res.json(toArea(area));
});
