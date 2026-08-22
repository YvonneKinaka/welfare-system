Church Welfare Management System

web application for managing church welfare members, beneficiaries, contribution cases and payments.

##-- Features

* Member and beneficiary management
* Welfare case and contribution tracking
* Member statements and reports
* OTP-based login
* Payment integration
* Tamasha API integration
* Admin and member dashboards

##-- Tech Stack

Next.js, TypeScript, Prisma, SQLite, Tailwind CSS and Tamasha API.

### Run locally

```bash
npm install
npm run db:push
npm run dev
```

Create a `.env` file using `.env.example` and add the required database, Tamasha and payment configuration.

The application runs at `http://localhost:3000`.
