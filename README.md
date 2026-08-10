# Church Welfare Management System — MVP

A production-shaped MVP that digitizes a church's welfare contribution program:
members contribute a fixed KSh 300 whenever another member's registered
beneficiary passes away, and administrators track who has paid, who hasn't,
and who has been suspended for missing three deadlines.

---

## 1. Technologies used

| Layer            | Choice                                   | Why |
|------------------|-------------------------------------------|-----|
| Framework        | Next.js 14 (App Router, TypeScript)      | Frontend + API routes in one deployable app — simple for a church to host |
| Database         | SQLite via Prisma ORM                    | Zero-config for local dev; swap the datasource to Postgres/MySQL for production with no model changes |
| Auth             | Custom JWT session cookies (`jose`) + bcrypt | Two very different login flows (admin password+OTP, member passwordless OTP) don't map cleanly onto standard providers |
| Styling          | Tailwind CSS                             | Fast, consistent design tokens; large touch targets for elderly users |
| Fonts            | Fraunces (display), Source Sans 3 (body), IBM Plex Mono (numbers) | Warm, dignified, highly legible |
| PDF generation   | pdfkit                                   | Pure-JS, no headless browser required for statements |
| Validation       | Zod                                      | Consistent request validation across all API routes |

---

## 2. Folder structure

```
church-welfare/
├── prisma/
│   ├── schema.prisma        # Full data model (see below)
│   └── seed.ts              # Creates a test admin + sample members/beneficiaries
├── src/
│   ├── middleware.ts         # Route protection for /admin and /member (pages + APIs)
│   ├── lib/
│   │   ├── db.ts             # Prisma client singleton
│   │   ├── auth.ts           # Session cookie sign/verify
│   │   ├── password.ts       # bcrypt hashing for admin passwords
│   │   ├── otp.ts            # OTP generation, hashing, verification
│   │   ├── notifications.ts  # Pluggable notification layer (placeholder/console today)
│   │   ├── contributions.ts  # Core business rules: open case, record payment,
│   │   │                     #   overdue sweep, suspension/reactivation
│   │   ├── pdf.ts            # Member statement PDF generator
│   │   └── validation.ts     # Zod schemas for every API input
│   ├── components/
│   │   ├── ui/                # Button, Card, Input, Badge, StatCard, LedgerBar
│   │   ├── AdminNav.tsx
│   │   └── MemberNav.tsx
│   └── app/
│       ├── page.tsx                       # Landing / role chooser
│       ├── login/admin/(...)              # Admin password + OTP flow
│       ├── login/member/(...)             # Member phone/email + OTP flow
│       ├── admin/
│       │   ├── dashboard/page.tsx
│       │   ├── members/ (list, new, [id])
│       │   ├── cases/   (list, new, [id])
│       │   └── reports/page.tsx
│       ├── member/
│       │   ├── dashboard/page.tsx
│       │   ├── beneficiaries/page.tsx
│       │   └── history/page.tsx
│       └── api/
│           ├── auth/{admin,member}/{login,verify}, logout
│           ├── admin/{members,beneficiaries,cases,reports,statement}
│           └── member/{me,statement}
├── .env.example
└── package.json
```

---

## 3. Database schema (see `prisma/schema.prisma` for the full source)

- **Admin** — email/password login.
- **Member** — `membershipNumber` (auto-generated `CWM-0001`), `status` (Active/Suspended),
  `missedCount`.
- **Beneficiary** — belongs to a Member; `status` Active/Archived.
- **ContributionCase** — one per beneficiary death; fixed `amountPerMember` (300),
  `deadline`, `status` Open/Closed.
- **Contribution** — one row per eligible member per case; `status` Pending → Paid,
  or Pending → Lapsed (deadline passed unpaid) → Paid (late payment clears it).
- **OtpCode** — hashed one-time codes with expiry and attempt limits, for both
  admin and member logins.
- **Notification** — a placeholder outbox (see §6) so real SMS/Email can be wired
  in later without touching business logic.

---

## 4. Features implemented

- Admin: email + password → email OTP → dashboard.
- Member: phone or email → OTP → dashboard (no password, as specified).
- Member registration & editing, activate/suspend, auto-generated membership numbers.
- Beneficiary registration, editing, and archiving after a claim.
- Opening a contribution case: pick member → pick their beneficiary → set deadline;
  amount is hard-coded server-side at KSh 300 and cannot be edited from any form.
- Live case progress: expected / collected / remaining, paid / pending / lapsed member lists.
- Manual payment recording by admin (M-Pesa-ready — see §7).
- Automatic missed-contribution tracking: 3 misses → auto-suspend; clearing all
  outstanding contributions → auto-reactivate (see `sweepOverdueContributions` and
  `maybeReactivateMember` in `src/lib/contributions.ts`).
- Member dashboard: active/outstanding/history, eligibility status, beneficiaries.
- Downloadable PDF statements for members (self-service) and admins (any member).
- Reports: totals, active/suspended, open/closed cases, expected/collected/outstanding.
- Notification placeholders: every OTP, case-opened, suspension, and reactivation
  event is logged to a `Notification` table and printed to the server console in
  development, so you can test full flows without real SMTP/SMS credentials.

---

## 5. Features left for Version 2

- Real SMS/Email delivery (swap `ConsoleNotificationProvider` in `src/lib/notifications.ts`).
- M-Pesa STK Push integration (the `Contribution` model and `recordPayment()` are
  already shaped so an M-Pesa callback can call the same function).
- Admin password reset / forgot-password flow.
- Multiple admin roles/permissions (currently a single flat Administrator role).
- Automated deadline reminders (the sweep function that detects overdue
  contributions runs on-demand today; a real cron/scheduled job would call it
  proactively and trigger reminder notifications before the deadline, not just after).
- CSV/Excel export for reports (currently print-to-PDF from the browser).
- Audit log of who changed what (member edits, suspensions, payment records).
- Automated tests (unit tests for `src/lib/contributions.ts` business rules would
  be the highest-value first addition).
- Rate limiting on OTP requests (currently limited only by attempt count + expiry).

---

## 6. Assumptions made

1. **Who contributes to a case**: every currently *Active* member **except** the
   affected member is asked to contribute (they're receiving support, not giving it).
2. **Suspension threshold resets on reactivation**: when a suspended member clears
   all outstanding contributions, their `missedCount` resets to 0 rather than
   persisting historically.
3. **Beneficiary archiving**: happens when the admin explicitly *closes* the case
   (a case can be closed before 100% collection, at the admin's discretion — the
   deadline is a target, not a hard lock).
4. **One open case per beneficiary at a time**: prevents duplicate cases for the
   same beneficiary while one is already in progress.
5. **OTP channel**: an identifier containing "@" is treated as email; otherwise
   as a phone number/SMS channel.
6. **No M-Pesa in v1**: per the brief, payments are recorded manually by the admin.

---

## 7. Designing for M-Pesa (later)

`recordPayment()` in `src/lib/contributions.ts` is the single place that marks a
contribution Paid. An M-Pesa STK Push callback route would simply call this same
function after confirming payment, instead of an admin clicking "Record payment."
No schema or UI changes are required to add it.

---

## 8. Running the project locally

**Prerequisites:** Node.js 18.18+ and npm.

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables (defaults work fine for local dev)
cp .env.example .env

# 3. Create the SQLite database and tables
npm run db:push

# 4. Seed a test admin and sample members/beneficiaries
npm run db:seed

# 5. Start the dev server
npm run dev
```

Then open **http://localhost:3000**.

**Test admin login:** `admin@church.org` / `Welfare@2026`
**Test member login:** phone `+254712000001` (or any seeded member)

Because no real SMTP/SMS provider is wired up yet, every OTP is printed to the
terminal running `npm run dev`, and — in development only — shown directly on
the verification screen in a "Development mode" banner, so you can test the
full login flow immediately.

> **Note on this build:** I built and reviewed this entire project in a sandboxed
> environment whose network is restricted to package registries, so I could not
> download Prisma's query-engine binary here to run `prisma generate`/the dev
> server end-to-end myself. That step just needs normal internet access, which
> your machine will have — `npm install` will complete it automatically. I did
> verify the dependency tree installs cleanly and reviewed every file by hand;
> if anything doesn't run smoothly on your first try, tell me the error and I'll
> fix it immediately.
