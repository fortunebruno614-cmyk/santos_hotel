# Santo Hotel

Single-tenant hotel booking web application: public guest side (search → view → book → pay → confirmation) and a protected staff/admin side (rooms, availability, reservations, guests, payments, reports).

## Stack

- Next.js 16 (App Router, TypeScript) — React 19
- PostgreSQL + Prisma 7 (`@prisma/adapter-pg`)
- Tailwind CSS 4
- ESLint

## Quick start

```bash
npm install
cp .env.example .env     # adjust DATABASE_URL for your Postgres
createdb santos_hotel
npm run db:migrate
npm run db:smoke         # → "Database connection OK. Hotel rows: 0"
npm run dev              # http://localhost:3000
```

Full instructions (Docker DB, Prisma 7 notes, scripts): [docs/setup.md](docs/setup.md).

## Documentation

- [Development pipeline & phases](docs/DEVELOPMENT_PLAN.md) — the build plan (P0–P9) and current phase
- [Open questions](docs/OPEN_QUESTIONS.md) — hotel business decisions pending confirmation
- [Setup guide](docs/setup.md)
- [DB & storage sync](docs/DB_AND_STORAGE.md) — keeping database and media updated on GitHub
- Training guides (PDFs) in `docs/`

## Current status

- **P0 Environment Setup** — done: Next.js + Postgres + Prisma wiring, first migration `init_hotels`, DB smoke test.
- **P2 Database & Domain Model** — in progress: `Hotel` entity migrated; remaining entities per `docs/DEVELOPMENT_PLAN.md` §P2.

## Migration workflow

1. Edit `prisma/schema.prisma`.
2. `npm run db:migrate -- --name <migration_name>`.
3. Commit the schema and the generated `prisma/migrations/**` together.

Never change the database by hand — every change is a committed migration.
