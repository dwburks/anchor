<div align="center">

# Helmpad

**A self-hosted, offline-first note taking app — helm your thoughts.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker)](https://github.com/dwburks/anchor)

Helmpad is a fork of [Anchor](https://github.com/zhfahim/anchor) focused on iOS availability and reliability improvements. Notes are stored locally, editable offline, and synced across devices when online.

</div>


## What's Different From Anchor?

- **iOS App** — Available on the App Store (coming soon)
- **Backup & Restore** — Export/import your notes and tags as JSON from the mobile app or API
- **Sync Fixes** — Resolved UTC timestamp issues causing mobile-to-web sync failures
- **Foreground Sync** — Periodic sync while the app is in use
- **Debug Logging** — Gated behind `SYNC_DEBUG` environment variable


## Features

- **Rich Text Editor** — Bold, italic, underline, headings, lists, checkboxes
- **Note Sharing** — Share notes with other users (viewer or editor)
- **Tags** — Organize notes with custom tags and colors
- **Note Backgrounds** — Customize with solid colors and patterns
- **Pin & Archive** — Pin important notes, archive for later
- **Search** — Search locally by title or content
- **Trash** — Soft delete with recovery
- **Offline-First** — All edits work offline with local storage
- **Automatic Sync** — Changes sync across devices when online
- **Backup & Restore** — Export/import notes as JSON
- **Admin Panel** — User management, registration control, system stats


## Self-Hosting With Docker

### Using Pre-built Image (Recommended)

1. **Create a `docker-compose.yml` file:**
   ```yaml
   services:
     helmpad:
       image: ghcr.io/dwburks/anchor:latest
       container_name: helmpad
       restart: unless-stopped
       ports:
         - "3000:3000"
       volumes:
         - helmpad_data:/data

   volumes:
     helmpad_data:
   ```

2. **(Optional) Configure environment:**

   | Variable | Default | Description |
   |----------|---------|-------------|
   | `JWT_SECRET` | (auto-generated) | Auth token secret (persisted in `/data`) |
   | `PG_HOST` | (empty) | External Postgres host (leave empty for embedded) |
   | `PG_PORT` | `5432` | Postgres port |
   | `PG_USER` | `anchor` | Postgres username |
   | `PG_PASSWORD` | `password` | Postgres password |
   | `PG_DATABASE` | `anchor` | Database name |
   | `USER_SIGNUP` | (not set) | `disabled`, `enabled`, or `review`. If not set, admins control it via admin panel |

3. **Start the container:**
   ```bash
   docker compose up -d
   ```

4. **Access the app:**
   Open http://localhost:3000

### Building From Source

```bash
git clone https://github.com/dwburks/anchor.git
cd anchor
docker compose up -d
```


## Mobile App

### iOS

Coming soon to the App Store.

### Android

Build from source using Flutter, or download APKs from the upstream [Anchor releases](https://github.com/zhfahim/anchor/releases).


## Backup API

Authenticated users can export and import their data:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/backup/export` | Download your notes and tags as JSON |
| `POST` | `/api/backup/import` | Upload JSON backup (non-destructive, skips existing items) |
| `GET` | `/api/admin/backup` | Admin-only: full database dump (SQL) |


## Tech Stack

- **Backend**: Nest.js, PostgreSQL, Prisma
- **Mobile**: Flutter (iOS & Android)
- **Web**: Next.js, TypeScript


## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).

Helmpad is a fork of [Anchor](https://github.com/zhfahim/anchor) by [@zhfahim](https://github.com/zhfahim).
