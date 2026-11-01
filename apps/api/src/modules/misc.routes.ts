import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { pageParams, param } from '../lib/http';
import { badRequest } from '../lib/errors';
import { authenticate, me } from '../middleware/auth';
import { ALLOWED_IMAGE_TYPES, saveImage } from '../services/storage';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get('/', async (req, res) => {
  const { skip, take, page, pageSize } = pageParams(req);
  const where = { userId: me(req).sub };
  const [rows, total, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, readAt: null } }),
  ]);
  res.json({
    data: rows.map((n) => ({ id: n.id, title: n.title, body: n.body, data: n.data, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() })),
    total,
    page,
    pageSize,
    unread,
  });
});

notificationsRouter.post('/read', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? (req.body.ids as string[]) : null;
  await prisma.notification.updateMany({
    where: { userId: me(req).sub, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED_IMAGE_TYPES.includes(file.mimetype)),
});

const FOLDERS = ['items', 'categories', 'banners', 'proofs', 'issues'];

export const uploadsRouter = Router();
uploadsRouter.post('/:folder', authenticate, upload.single('file'), async (req, res) => {
  const folder = param(req, 'folder');
  if (!FOLDERS.includes(folder)) throw badRequest('Unknown upload folder');
  if (!req.file) throw badRequest('Attach a JPG, PNG or WEBP image under 5 MB');
  res.status(201).json({ url: await saveImage(req.file, folder) });
});
