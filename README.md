<div align="center">

# Helmpad

**A self-hosted, offline-first note taking app.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker)](https://github.com/dwburks/anchor)

</div>

## About

Helmpad is a fork of [Anchor](https://github.com/zhfahim/anchor) — a self-hosted note taking app with offline-first sync. Your notes live on your own server, are editable without an internet connection, and sync automatically across devices when online.

This fork adds iOS support, backup/restore, brute force protection, and various sync reliability fixes.

## Quick Start

```yaml
# docker-compose.yml
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

```bash
docker compose up -d
# Open http://localhost:3000
# First registered user becomes admin
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | auto-generated | Auth token signing secret (persisted in `/data`) |
| `PG_HOST` | _(empty)_ | External Postgres host. Leave empty for embedded database |
| `PG_PORT` | `5432` | Postgres port |
| `PG_USER` | `anchor` | Postgres username |
| `PG_PASSWORD` | `password` | Postgres password |
| `PG_DATABASE` | `anchor` | Database name |
| `USER_SIGNUP` | _(not set)_ | `disabled`, `enabled`, or `review`. If unset, admins control via admin panel |
| `SYNC_DEBUG` | _(not set)_ | Set to `true` to enable verbose sync logging |

## Security

Helmpad is designed for multi-user self-hosting with strong data isolation:

- **Note isolation** — All data access is scoped by authenticated user. Users cannot read, modify, or delete another user's notes, tags, or shares through any API endpoint. Verified through full codebase security audit.
- **Rate limiting** — Global request throttling (60 req/min) with stricter limits on auth endpoints (login: 10/min, register: 5/min).
- **Brute force protection** — Accounts auto-lock for 15 minutes after 5 failed login attempts. No admin intervention required.
- **Password security** — Bcrypt hashing with 10 salt rounds. Passwords never included in API responses or JWT tokens.
- **Share permissions** — Notes can be shared as viewer or editor. Permission checks enforced at the service layer, not just the API layer.
- **Input validation** — All endpoints validate and sanitize input. Extra properties are rejected.
- **Security headers** — Helmet.js applied globally.

## Mobile App

**iOS** — Build from source with Flutter, or sideload via [Sideloadly](https://sideloadly.io). App Store release coming soon.

**Android** — Build from source, or download APKs from upstream [Anchor releases](https://github.com/zhfahim/anchor/releases).

## Backup & Restore

Export and import your data from the mobile app (Settings → Data) or via API:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/backup/export` | Download your notes and tags as JSON |
| `POST` | `/api/backup/import` | Import JSON backup (skips existing items) |
| `GET` | `/api/admin/backup` | Admin-only full database dump (SQL) |

## Building From Source

```bash
git clone https://github.com/dwburks/anchor.git
cd anchor
docker compose up -d
```

## Roadmap

- [ ] App Store release with custom icon
- [ ] Family sharing — shared spaces for household members
- [ ] CORS origin whitelist configuration
- [ ] Audit logging for admin actions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS, PostgreSQL, Prisma |
| Web | Next.js, TypeScript |
| Mobile | Flutter (iOS & Android) |

## License

[AGPL-3.0](LICENSE) — Helmpad is a fork of [Anchor](https://github.com/zhfahim/anchor) by [@zhfahim](https://github.com/zhfahim).
