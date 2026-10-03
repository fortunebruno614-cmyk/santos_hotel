# Keeping the Database & Storage Updated on GitHub

How Santo Hotel teammates share database changes and media through the repo.

## What gets shared, and how

| Thing | Source of truth | How it travels |
| ----- | --------------- | -------------- |
| Schema / tables | `prisma/schema.prisma` + `prisma/migrations/**` | commit + push (recommended) |
| Baseline demo data | `prisma/seed.ts` (`npm run db:seed`) | run after `db:migrate` |
| Full local dev data | `dumps/santos_hotel.dump` | `npm run db:dump` → commit → teammate `npm run db:restore` |
| Media / room photos | `media/**` | commit + push (use Git LFS for large files) |

Golden rule: **structure goes through migrations; data/media go through dumps and `media/`.**
Never change the database by hand.

## Daily workflow

```bash
git pull                # get teammates' latest schema + dumps + media
npm install             # postinstall regenerates the Prisma client
npm run db:migrate      # apply any new migrations
npm run db:restore      # optional: load the committed dev-data snapshot
npm run dev
```

Push checklist:

```bash
npm run lint && npm run typecheck
npm run db:dump         # only if you changed dev data others need
git add -A && git commit -m "…" && git push
```

## 1. Schema changes (everyone does this)

When you change `prisma/schema.prisma`:

```bash
npm run db:migrate -- --name add_bookings
git add prisma/schema.prisma prisma/migrations
git commit -m "db: add bookings tables"
git push
```

Teammates just `git pull && npm run db:migrate`. Migrations are ordered, versioned
and safe to replay from an empty database.

## 2. Sharing dev data (dumps)

Use this when the team needs the same demo bookings/rooms locally.

**Publish your data:**

```bash
npm run db:dump                 # writes dumps/santos_hotel.dump (custom format)
git add dumps/santos_hotel.dump
git commit -m "db: refresh dev data snapshot"
git push
```

**Load new data:**

```bash
git pull
npm run db:restore              # DROPS and recreates objects in your local DB
```

Rules:

- Dev/demo data only. **Never dump a database containing real guest data** (privacy).
- Prefer small, purposeful snapshots (rooms, rates, a few demo bookings).
- Binary dumps can't be merged: if both sides changed data, pull first, then re-dump.
- `pg_dump`/`pg_restore` must be installed (`brew install libpq` or `postgresql@14`).
- If dumps start getting large, see "Large files" below or move to object storage (P7).

## 3. Media / storage (room images, documents)

All shared media lives under `media/`, organised by category:

```
media/
  rooms/101.jpg
  rooms/102.jpg
  room-types/deluxe-king.jpg
  promotions/summer-2026.jpg
```

**Publish:**

```bash
cp my-photo.jpg media/rooms/101.jpg
git add media/
git commit -m "media: add room 101 photo"
git push
```

Teammates get them with `git pull`. Keep filenames lowercase, hyphenated and stable
(`101.jpg`, not `IMG_4821 final.JPG`).

### Large files (Git LFS)

If media files are bigger than a few MB, track them with Git LFS once:

```bash
brew install git-lfs
git lfs install
git lfs track "media/**"
git add .gitattributes
git commit -m "chore: track media with Git LFS"
```

Then add/commit media normally — LFS stores blobs outside the repo history.
Teammates run `git lfs pull` after cloning.

### Note for later phases

The app will serve room images from this media store once the room-image feature
lands (P7). If the hotel later needs CMS-style uploads, we can move to S3/Supabase
storage without changing the DB schema.

## Do / Don't

| Do | Don't |
| -- | ----- |
| Commit migrations with every schema change | Edit tables manually with SQL |
| Keep dumps small and dev-only | Commit production data or real guest info |
| Commit `.env.example` / `.env` baseline (dev creds) | Put real secrets in `.env` (it's tracked) |
| Put per-machine creds in `.env.local` | Edit `.env` for your machine and commit it |
| Use Git LFS for large media | Commit multi-hundred-MB files |
