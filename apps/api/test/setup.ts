import fs from 'node:fs';

if (fs.existsSync('.env')) process.loadEnvFile('.env');
process.env.NODE_ENV = 'test';
process.env.OTP_MODE = 'fixed';
process.env.RAZORPAY_KEY_ID = '';
process.env.RAZORPAY_KEY_SECRET = '';
