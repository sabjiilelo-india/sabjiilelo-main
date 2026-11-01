import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8),
  REFRESH_SECRET: z.string().min(8),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  PUBLIC_URL: z.string().default('http://localhost:4000'),
  OTP_MODE: z.enum(['fixed', 'msg91']).default('fixed'),
  OTP_FIXED: z.string().default('9999'),
  SUPERADMIN_USERNAME: z.string().default('superadmin'),
  SUPERADMIN_PASSWORD: z.string().default('Sabjii@123'),
  SUPERADMIN_PHONE: z.string().default('9000000000'),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),
  // Either the combined CLOUDINARY_URL (cloudinary://KEY:SECRET@CLOUD) or the three parts below.
  CLOUDINARY_URL: z.string().optional().default(''),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  EXPO_ACCESS_TOKEN: z.string().optional().default(''),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  razorpayEnabled: !!(parsed.data.RAZORPAY_KEY_ID && parsed.data.RAZORPAY_KEY_SECRET),
  cloudinaryEnabled: !!parsed.data.CLOUDINARY_URL || !!(parsed.data.CLOUDINARY_CLOUD_NAME && parsed.data.CLOUDINARY_API_KEY && parsed.data.CLOUDINARY_API_SECRET),
};
