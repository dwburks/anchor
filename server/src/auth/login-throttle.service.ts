import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';

interface FailedAttempt {
  count: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

@Injectable()
export class LoginThrottleService {
  private readonly logger = new Logger(LoginThrottleService.name);
  private readonly failedAttempts = new Map<string, FailedAttempt>();

  // Configuration
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private readonly ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minute window for counting attempts
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Clean up stale entries every 5 minutes

  constructor() {
    // Periodically clean up expired entries to prevent memory leaks
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Check if a login attempt is allowed for the given key (email or IP).
   * Throws an exception if the account is locked.
   */
  checkAttempt(key: string): void {
    const attempt = this.failedAttempts.get(key);
    if (!attempt) return;

    const now = Date.now();

    // Check if currently locked out
    if (attempt.lockedUntil && now < attempt.lockedUntil) {
      const remainingMs = attempt.lockedUntil - now;
      const remainingMin = Math.ceil(remainingMs / 60000);
      this.logger.warn(`Login blocked for ${key} - locked for ${remainingMin} more minutes`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many failed login attempts. Please try again in ${remainingMin} minute${remainingMin !== 1 ? 's' : ''}.`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // If lockout has expired, reset
    if (attempt.lockedUntil && now >= attempt.lockedUntil) {
      this.failedAttempts.delete(key);
    }
  }

  /**
   * Record a failed login attempt. Locks the account if max attempts exceeded.
   */
  recordFailure(key: string): void {
    const now = Date.now();
    const attempt = this.failedAttempts.get(key);

    if (!attempt || now - attempt.firstAttempt > this.ATTEMPT_WINDOW_MS) {
      // Start a new window
      this.failedAttempts.set(key, {
        count: 1,
        firstAttempt: now,
        lockedUntil: null,
      });
      return;
    }

    attempt.count++;

    if (attempt.count >= this.MAX_ATTEMPTS) {
      attempt.lockedUntil = now + this.LOCKOUT_DURATION_MS;
      this.logger.warn(
        `Account locked for ${key} after ${attempt.count} failed attempts. Locked until ${new Date(attempt.lockedUntil).toISOString()}`,
      );
    }
  }

  /**
   * Clear failed attempts on successful login.
   */
  recordSuccess(key: string): void {
    this.failedAttempts.delete(key);
  }

  /**
   * Clean up expired entries to prevent memory leaks.
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, attempt] of this.failedAttempts.entries()) {
      const expired =
        (attempt.lockedUntil && now >= attempt.lockedUntil) ||
        (!attempt.lockedUntil && now - attempt.firstAttempt > this.ATTEMPT_WINDOW_MS);
      if (expired) {
        this.failedAttempts.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired login throttle entries`);
    }
  }
}
