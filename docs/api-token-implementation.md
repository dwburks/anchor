# API Token Authentication - Implementation Plan

## Overview
Add per-user API tokens for external integrations (Homarr widgets, automation scripts, CI/CD) based on [upstream PR #49](https://github.com/ZhFahim/anchor/pull/49) with security enhancements.

## Status
**✅ Merged to Upstream** (2026-02-15) - PR #49 merged to main without security enhancements.

**For Our Fork:** Base implementation available for merge. Security enhancements still planned.

## Why API Tokens?
- **Long-lived authentication**: JWT tokens expire after 15 minutes
- **External integrations**: Homarr dashboard widgets, automation scripts, CLI tools
- **Separation of concerns**: Dedicated tokens for machines vs. user sessions
- **Limit parameter**: Support `?limit=N` on notes endpoint for widget use cases

## Base Implementation (from upstream PR #49)

### 1. Database Schema Changes
```prisma
model User {
  // ... existing fields
  apiToken          String?        @unique
}
```

**Migration:**
```sql
ALTER TABLE "User" ADD COLUMN "apiToken" TEXT UNIQUE;
```

### 2. New Files to Create

**`server/src/auth/utils/generate-api-token.ts`**
```typescript
import * as crypto from 'crypto';

export const generateApiToken = () => {
  return crypto.randomBytes(32).toString('hex');
};
```

**`server/src/auth/notes-auth.guard.ts`**
- Replaces `JwtAuthGuard` on notes endpoints
- Accepts both JWT tokens and API tokens
- Try JWT first, fall back to API token lookup
- Same user validation (status = active)

### 3. Auth Service Methods

**`auth.service.ts`**
```typescript
async getApiToken(userId: string) {
  // Return existing token or generate new one
}

async regenerateApiToken(userId: string) {
  // Generate new token, invalidate old one
}

private async generateUniqueApiToken(): Promise<string> {
  // Retry up to 5 times to avoid collisions
}
```

### 4. API Endpoints

**`auth.controller.ts`**
```typescript
@UseGuards(JwtAuthGuard)
@Get('api-token')
getApiToken(@CurrentUser() user: User)

@UseGuards(JwtAuthGuard)
@Post('api-token/regenerate')
regenerateApiToken(@CurrentUser() user: User)
```

### 5. Notes Controller Changes

**Replace:**
```typescript
@UseGuards(JwtAuthGuard)
```

**With:**
```typescript
@UseGuards(NotesAuthGuard)
```

**Add limit parameter:**
```typescript
@Get()
findAll(
  @CurrentUser('id') userId: string,
  @Query('limit') limit?: string,
) {
  const parsedLimit = clampLimit(parseInt(limit));
  // clampLimit: min 1, max 200, default undefined
}
```

### 6. Module Updates

**`auth.module.ts`**
```typescript
providers: [AuthService, JwtStrategy, LoginThrottleService, NotesAuthGuard],
exports: [AuthService, LoginThrottleService, NotesAuthGuard],
```

**`notes.module.ts`**
```typescript
imports: [PrismaModule, AuthModule],  // Import AuthModule for NotesAuthGuard
```

## Security Enhancements (Recommended)

### ⚠️ Concerns with Base Implementation

1. **No Expiration** - Tokens never expire, permanent access if leaked
2. **Plaintext Storage** - Tokens stored unhashed in database
3. **No Audit Trail** - Token generation/regeneration not logged
4. **Same Rate Limits** - No differentiation between user/API traffic
5. **No Scopes** - API tokens have full user access

### 🔒 Minimal Security Hardening (2 hours)

#### 1. Token Expiration & Usage Tracking

**Schema:**
```prisma
model User {
  apiToken          String?   @unique
  apiTokenLastUsed  DateTime?
  apiTokenCreatedAt DateTime?
}
```

**Guard Logic:**
```typescript
// In notes-auth.guard.ts
if (user.apiTokenLastUsed) {
  const daysSinceUse = differenceInDays(new Date(), user.apiTokenLastUsed);
  if (daysSinceUse > 90) {
    throw new UnauthorizedException('API token expired due to inactivity');
  }
}

// Update last used timestamp
await this.prisma.user.update({
  where: { apiToken: token },
  data: { apiTokenLastUsed: new Date() },
});
```

**Cleanup Task:**
```typescript
// In auth.service.ts
@Cron('0 0 * * 0') // Weekly
async cleanupStaleTokens() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  await this.prisma.user.updateMany({
    where: {
      apiTokenLastUsed: { lt: cutoff },
      apiToken: { not: null },
    },
    data: { apiToken: null, apiTokenLastUsed: null },
  });
}
```

#### 2. Audit Logging

**Add to auth.controller.ts:**
```typescript
@Get('api-token')
async getApiToken(@CurrentUser() user: User) {
  const result = await this.authService.getApiToken(user.id);
  this.auditService.log({
    action: 'api_token_generated',
    actor: user.email,
  });
  return result;
}

@Post('api-token/regenerate')
async regenerateApiToken(@CurrentUser() user: User) {
  const result = await this.authService.regenerateApiToken(user.id);
  this.auditService.log({
    action: 'api_token_regenerated',
    actor: user.email,
  });
  return result;
}
```

**Track usage in guard:**
```typescript
// In notes-auth.guard.ts after successful API token auth
this.auditService.log({
  action: 'api_token_used',
  actor: user.email,
  ipAddress: request.ip,
});
```

#### 3. Stricter Rate Limiting

**Update auth.controller.ts:**
```typescript
@Throttle({ default: { ttl: 60000, limit: 2 } }) // 2/min
@Get('api-token')
getApiToken(@CurrentUser() user: User)

@Throttle({ default: { ttl: 3600000, limit: 5 } }) // 5/hour
@Post('api-token/regenerate')
regenerateApiToken(@CurrentUser() user: User)
```

**Consider separate throttle tier for API tokens in notes endpoints** (future work).

#### 4. Environment Configuration

**`.env.example`:**
```bash
# API Token Settings
API_TOKEN_INACTIVITY_DAYS=90  # Auto-revoke after N days of inactivity
```

### 🔐 Advanced Security (4-6 hours - deferred)

#### Token Hashing
**Problem:** Direct DB lookups by token value impossible with hashing.

**Approach 1 - HMAC:**
```typescript
// Generate: create random token, HMAC it, store HMAC
const token = crypto.randomBytes(32).toString('hex');
const hmac = crypto.createHmac('sha256', JWT_SECRET).update(token).digest('hex');
// Store hmac, return token

// Verify: HMAC incoming token, lookup by HMAC
const hmac = crypto.createHmac('sha256', JWT_SECRET).update(token).digest('hex');
const user = await prisma.user.findUnique({ where: { apiTokenHmac: hmac } });
```

**Approach 2 - Separate Token Table:**
```prisma
model ApiToken {
  id        String   @id @default(uuid())
  tokenHash String   @unique
  userId    String
  user      User     @relation(...)
  createdAt DateTime @default(now())
  lastUsed  DateTime?
  expiresAt DateTime
}
```

#### Scopes/Permissions
```prisma
model User {
  apiTokenScopes String? // JSON: ["notes:read", "notes:write"]
}
```

**Guard checks:**
```typescript
const requiredScope = this.reflector.get('apiScope', context.getHandler());
if (requiredScope && !user.apiTokenScopes?.includes(requiredScope)) {
  throw new ForbiddenException('Insufficient API token permissions');
}
```

## Implementation Checklist

### Phase 1: Base Feature (Minimal Hardening)
- [ ] Add `apiToken`, `apiTokenLastUsed`, `apiTokenCreatedAt` to User model
- [ ] Create migration
- [ ] Create `generate-api-token.ts` utility
- [ ] Create `NotesAuthGuard` (JWT + API token)
- [ ] Add `getApiToken()` and `regenerateApiToken()` to AuthService
- [ ] Add API token endpoints to AuthController
- [ ] Update NotesController to use NotesAuthGuard
- [ ] Add `limit` parameter to notes list endpoint
- [ ] Add audit logging for token operations
- [ ] Add rate limiting to token endpoints
- [ ] Add cleanup cron for stale tokens
- [ ] Add `API_TOKEN_INACTIVITY_DAYS` env var
- [ ] Update web UI Settings page (show/regenerate token)
- [ ] Update mobile Settings page (show/regenerate token)
- [ ] Document in README

### Phase 2: Advanced Security (Future)
- [ ] Implement token hashing (HMAC approach)
- [ ] Add scope-based permissions
- [ ] Add separate rate limiting tier for API tokens
- [ ] Admin view of all API tokens + revocation
- [ ] Token usage analytics dashboard

## Testing Plan

1. **Generate token**: `GET /api/auth/api-token` → Returns 64-char hex
2. **Use token**: `GET /api/notes` with `Authorization: Bearer {token}` → Returns notes
3. **Regenerate token**: `POST /api/auth/api-token/regenerate` → Old token invalidated
4. **Limit parameter**: `GET /api/notes?limit=10` → Returns max 10 notes
5. **Expiration**: Set token last used to 91 days ago → Auth fails
6. **Audit logs**: Check audit logs for token operations
7. **Rate limiting**: Exceed limits → 429 Too Many Requests

## Security Documentation for Users

**To include in README:**

> ### API Tokens
>
> API tokens allow external applications (dashboards, scripts) to access your notes.
>
> **Security Notes:**
> - Tokens expire after 90 days of inactivity
> - Treat tokens like passwords - never commit to git or share publicly
> - Regenerate immediately if token is compromised
> - Each user can have only one active token
> - Tokens have same permissions as your user account
>
> **Generate Token:**
> ```bash
> curl -H "Authorization: Bearer $JWT_TOKEN" \
>   http://localhost:3000/api/auth/api-token
> ```
>
> **Use Token:**
> ```bash
> curl -H "Authorization: Bearer $API_TOKEN" \
>   http://localhost:3000/api/notes?limit=10
> ```

## References

- Upstream PR: https://github.com/ZhFahim/anchor/pull/49
- Commit: https://github.com/ZhFahim/anchor/commit/d814c11
- Security discussion: (this document)

## Decision Log

- **2026-02-14**: Feature identified in upstream PR #49
- **2026-02-14**: Security analysis completed, minimal hardening approach chosen
- **2026-02-14**: Deferred to roadmap instead of immediate implementation

---

## Upstream Implementation Review (2026-02-15)

### What Was Merged

PR #49 was merged to upstream main with the following implementation:

#### Backend Changes:
1. **Database Migration**: `20260212000100_add_user_api_token`
   - Added `apiToken String? @unique` to User model

2. **New Files**:
   - `server/src/auth/auth.guard.ts` - Unified guard for JWT and API token auth
   - `server/src/auth/token-resolver.service.ts` - Service to resolve user from either token type
   - `server/src/auth/utils/generate-api-token.ts` - Token generation utility

3. **Auth Endpoints** (auth.controller.ts):
   - `GET /api/auth/api-token` - Get current API token (or null)
   - `POST /api/auth/api-token/regenerate` - Regenerate token
   - `DELETE /api/auth/api-token` - **Revoke token** (not in original PR!)

4. **Auth Service Methods** (auth.service.ts):
   - `getApiToken(userId)` - Returns existing token or null
   - `regenerateApiToken(userId)` - Generates new token, invalidates old
   - `revokeApiToken(userId)` - **New!** Sets token to null

5. **Notes API Enhancement**:
   - Added `limit` query parameter to `GET /api/notes`
   - Clamped between 1-200, defaults to undefined (all notes)

6. **Controller Updates**:
   - Replaced `JwtAuthGuard` with `AuthGuard` on:
     - NotesController
     - NoteSharesController
     - TagsController
     - UsersController
     - AdminController (some endpoints)

#### Frontend Changes:
1. **Web Settings Page** (web/app/(app)/settings/page.tsx):
   - Added "API Token" section with:
     - Token display (masked by default)
     - Copy to clipboard button
     - Regenerate button with confirmation dialog
     - Revoke button with confirmation dialog
   - Uses `useQuery` for token fetching
   - Confirmation dialogs for destructive actions

2. **API Client** (web/features/auth/api.ts):
   - `getApiToken()` - Fetch current token
   - `regenerateApiToken()` - Generate new token
   - `revokeApiToken()` - Delete token

### Key Differences from Original PR #49

1. **Added Revoke Endpoint**: 
   - Original PR only had get/regenerate
   - Merged version adds `DELETE /api/auth/api-token`
   - Allows users to disable API access entirely

2. **Better UX**:
   - Confirmation dialogs for regenerate/revoke
   - Toast notifications for all actions
   - Token visibility toggle

3. **Cleaner Architecture**:
   - Separate `TokenResolverService` for auth logic
   - Generic `AuthGuard` (not "NotesAuthGuard")
   - Applied to all resource controllers, not just notes

### Security Assessment

**Still Present** (unchanged from our analysis):
- ❌ No token expiration
- ❌ Plaintext storage in database
- ❌ No audit logging
- ❌ No rate limiting differences
- ❌ No scopes/permissions

**Improvements**:
- ✅ Added revoke capability (manual expiration)
- ✅ Confirmation dialogs (prevents accidental regeneration)

### Implementation Quality

**Positives**:
- Clean separation of concerns (`TokenResolverService`)
- Good error handling
- Consistent with existing patterns
- Comprehensive web UI

**Areas for Enhancement** (our planned additions):
- Token usage tracking (`apiTokenLastUsed`)
- Automatic expiration after inactivity
- Audit logging for token operations
- Rate limiting for API token endpoints
- Token hashing (HMAC approach)
- Scope-based permissions

### Migration Path for Our Fork

**Option 1: Merge Base + Add Enhancements**
1. Merge upstream API token implementation
2. Add our planned security enhancements incrementally
3. Update mobile app to show API token management

**Option 2: Wait for Security Improvements**
1. Keep tracking upstream
2. Propose security enhancements via PR
3. Merge once hardened

**Option 3: Fork Implementation with Enhancements**
1. Implement separately with all security features
2. Keep upstream compatibility for easy updates

**Recommendation**: Option 1 - Merge base, add minimal hardening (audit logging, usage tracking, auto-expiration)

