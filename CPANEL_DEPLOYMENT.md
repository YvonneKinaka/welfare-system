# cPanel Deployment Guide

This is a Next.js server application. It must run through cPanel's **Setup Node.js App**; do not deploy it as a static website.

## cPanel application settings

- Node.js: 20.x (or the newest version supported by the account)
- Environment: `Production`
- Application root: `welfare-system`
- Startup file: `server.js`
- Application URL: the Welfare domain or subdomain

The startup file listens on cPanel's `PORT` value. Do not hard-code a port in cPanel.

## Upload and install

Upload the repository into the application root, excluding `node_modules`, `.next`, `.env`, and local database files. Then open cPanel Terminal:

```bash
cd ~/welfare-system
npm install
npx prisma generate
npx prisma db push
npm run build
```

If this is a new database and seed data is required:

```bash
npm run db:seed
```

Restart the application from **Setup Node.js App** after building.

## Environment variables

Create `.env` in the application root. Start from `.env.example` and replace every placeholder. At minimum configure:

```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="a-long-random-production-secret"
APP_URL="https://welfare.example.com"
NODE_ENV="production"
TAMASHA_API_URL="https://api.tamashaportal.co.ke/api/v1/"
TAMASHA_GUARD_NAME="estate"
TAMASHA_MEMBER_GUARD_NAME="welfare"
TAMASHA_ESTATE_ID="78"
```

Never commit `.env`, database files, passwords, OTPs, or provider credentials.

## Smoke test

After restart, verify the admin login, member login, OTP, member creation, member payment link, public payment page, payment confirmation, and transaction listing. If the app returns a 500, check the Node application error log in cPanel first.
