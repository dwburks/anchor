<div align="center">

<img src="https://raw.githubusercontent.com/zhfahim/anchor/main/web/public/icons/anchor_icon.png" alt="Anchor" width="120" height="120">

# Anchor

**An offline-first, self-hostable note taking application**

[![Version](https://img.shields.io/github/v/release/dwburks/anchor?label=version)](https://github.com/dwburks/anchor/releases)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker)](https://github.com/dwburks/anchor)

A fork of [Anchor](https://github.com/zhfahim/anchor) focused on iOS availability, security hardening, and reliability improvements. Notes are stored locally, editable offline, and synced across devices when online.

</div>

> **Naming:** The web app and server are **Anchor**. The mobile companion app is published as **[Helmpad](#mobile-app-helmpad)**.

## What's Different in This Fork

| Feature | Details |
|---------|---------|
| **Helmpad iOS App** | Flutter-based iOS companion app — sideload now, App Store coming soon |
| **Backup & Restore** | Export/import notes and tags as JSON from the mobile app or REST API |
| **Brute Force Protection** | Rate limiting on all endpoints, auto-lockout after 5 failed login attempts |
| **Sync Fixes** | Resolved UTC timestamp issues causing mobile-to-web sync failures |
| **Foreground Sync** | Periodic sync while the mobile app is in use |
| **AGPL Compliance** | Source code link in the mobile app Settings screen |

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
- **Admin Panel** — User management, registration control, system stats

## Screenshots

### Web App

<div align="center">
  <img src="https://raw.githubusercontent.com/zhfahim/anchor/main/.github/assets/screenshot-web-light.png" alt="Web Light Mode" width="45%">
  <img src="https://raw.githubusercontent.com/zhfahim/anchor/main/.github/assets/screenshot-web-dark.png" alt="Web Dark Mode" width="45%">
</div>

### Mobile App

<div align="center">
  <img src="https://raw.githubusercontent.com/zhfahim/anchor/main/.github/assets/screenshot-mobile-light.jpg" alt="Mobile Light Mode" width="20%">
  <img src="https://raw.githubusercontent.com/zhfahim/anchor/main/.github/assets/screenshot-mobile-dark.jpg" alt="Mobile Dark Mode" width="20%">
</div>

## Self-Hosting With Docker

### Using Pre-built Image (Recommended)

1. **Create a `docker-compose.yml` file:**
   ```yaml
   services:
     anchor:
       image: ghcr.io/dwburks/anchor:latest
       container_name: anchor
       restart: unless-stopped
       ports:
         - "3000:3000"
       volumes:
         - anchor_data:/data

   volumes:
     anchor_data:
   ```

2. **(Optional) Configure environment:**

   | Variable | Default | Description |
   |----------|---------|-------------|
   | `JWT_SECRET` | auto-generated | Auth token signing secret (persisted in `/data`) |
   | `PG_HOST` | _(empty)_ | External Postgres host (leave empty for embedded) |
   | `PG_PORT` | `5432` | Postgres port |
   | `PG_USER` | `anchor` | Postgres username |
   | `PG_PASSWORD` | `password` | Postgres password |
   | `PG_DATABASE` | `anchor` | Database name |
   | `USER_SIGNUP` | _(not set)_ | `disabled`, `enabled`, or `review`. If unset, admins control via admin panel |
   | `SYNC_DEBUG` | _(not set)_ | Set to `true` to enable verbose sync logging |

3. **Start the container:**
   ```bash
   docker compose up -d
   ```

4. **Access the app:** Open http://localhost:3000 — first registered user becomes admin.

### Building From Source

```bash
git clone https://github.com/dwburks/anchor.git
cd anchor
docker compose up -d
```

## Mobile App (Helmpad)

The mobile companion app is called **Helmpad** and lives in the `mobile/` directory.

**iOS** — Build from source with Flutter, or sideload via [Sideloadly](https://sideloadly.io). App Store release coming soon.

**Android** — Build from source, or download APKs from upstream [Anchor releases](https://github.com/zhfahim/anchor/releases).

## Backup & Restore

Export and import your data from Helmpad (Settings → Data) or via the REST API:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/backup/export` | Download your notes and tags as JSON |
| `POST` | `/api/backup/import` | Import JSON backup (skips existing items) |
| `GET` | `/api/admin/backup` | Admin-only full database dump (SQL) |

## Security

Designed for multi-user self-hosting with strong data isolation:

- **Note isolation** — All data access is scoped by authenticated user. Users cannot read, modify, or delete another user's notes, tags, or shares through any API endpoint.
- **Rate limiting** — Global request throttling (60 req/min) with stricter limits on auth endpoints (login: 10/min, register: 5/min).
- **Brute force protection** — Accounts auto-lock for 15 minutes after 5 failed login attempts. No admin intervention required.
- **Password security** — Bcrypt hashing with 10 salt rounds. Passwords never included in API responses or JWT tokens.
- **Share permissions** — Notes can be shared as viewer or editor. Permission checks enforced at the service layer.
- **Input validation** — All endpoints validate and sanitize input. Extra properties are rejected.
- **Security headers** — Helmet.js applied globally.

## Roadmap

### In Progress
- [ ] Helmpad App Store release with custom icon
- [ ] API token authentication for external integrations
  - [ ] Per-user API tokens with auto-expiration
  - [ ] Token usage tracking and audit logging
  - [ ] Rate limiting for API token endpoints
  - [ ] Optional scopes/permissions for tokens

### Planned
- [ ] Family sharing — shared spaces for household members
- [ ] CORS origin whitelist configuration

### Completed
- [x] Audit logging for admin actions (v0.9.0)
- [x] Backup & restore as JSON (v0.9.0)
- [x] Markdown export (v0.9.0)
- [x] Note duplicate/sorting (v0.9.0)
- [x] Brute force protection (v0.9.0)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS, PostgreSQL, Prisma |
| Web | Next.js, TypeScript |
| Mobile (Helmpad) | Flutter (iOS & Android) |

## License

[AGPL-3.0](LICENSE) — Fork of [Anchor](https://github.com/zhfahim/anchor) by [@zhfahim](https://github.com/zhfahim).
