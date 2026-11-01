import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
/** The repo-level /public folder (the API runs from apps/api). Override with BRAND_ASSETS_DIR in deployments. */
export const BRAND_ASSETS_DIR = process.env.BRAND_ASSETS_DIR ?? path.resolve(process.cwd(), '../../public');

const useCloudinary = !!env.CLOUDINARY_URL;
if (useCloudinary) cloudinary.config({ secure: true });

const EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
export const ALLOWED_IMAGE_TYPES = Object.keys(EXT);

/** Stores an image and returns its public URL. Cloudinary when configured, local disk otherwise. */
export async function saveImage(file: { buffer: Buffer; mimetype: string }, folder: string): Promise<string> {
  if (useCloudinary) {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: `sabjiilelo/${folder}`, resource_type: 'image' }, (err, res) =>
          err || !res ? reject(err) : resolve(res),
        )
        .end(file.buffer);
    });
    return result.secure_url;
  }
  const dir = path.join(UPLOAD_DIR, folder);
  await fs.mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${EXT[file.mimetype] ?? ''}`;
  await fs.writeFile(path.join(dir, name), file.buffer);
  return `${env.PUBLIC_URL.replace(/\/$/, '')}/uploads/${folder}/${name}`;
}
