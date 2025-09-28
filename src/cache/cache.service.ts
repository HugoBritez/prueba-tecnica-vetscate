import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { MetricsService } from '../observability/metrics.service';

export interface CacheKeyStrategy {
  rooms: {
    all: string;
    byId: (id: number) => string;
    availability: (roomId: number, date: string) => string;
  };
  reservations: {
    byUserId: (userId: number) => string;
    byRoomId: (roomId: number) => string;
    byDateRange: (startDate: string, endDate: string) => string;
  };
  users: {
    profile: (userId: number) => string;
  };
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  // Cache key strategies for different entities
  public readonly keys: CacheKeyStrategy = {
    rooms: {
      all: 'rooms:all',
      byId: (id: number) => `rooms:${id}`,
      availability: (roomId: number, date: string) =>
        `rooms:${roomId}:availability:${date}`,
    },
    reservations: {
      byUserId: (userId: number) => `reservations:user:${userId}`,
      byRoomId: (roomId: number) => `reservations:room:${roomId}`,
      byDateRange: (startDate: string, endDate: string) =>
        `reservations:range:${startDate}:${endDate}`,
    },
    users: {
      profile: (userId: number) => `users:profile:${userId}`,
    },
  };

  // TTL configurations for different data types
  private readonly ttlConfig = {
    rooms: 3600000, // 1 hour - rooms don't change often
    roomAvailability: 300000, // 5 minutes - availability changes frequently
    reservations: 600000, // 10 minutes - moderate frequency
    userProfile: 1800000, // 30 minutes - user data changes occasionally
  };

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Gets a value from cache with metrics tracking.
   *
   * @param key - Cache key
   * @returns Promise resolving to cached value or undefined
   */
  async get<T>(key: string): Promise<T | undefined> {
    const startTime = Date.now();

    try {
      const value = await this.cacheManager.get<T>(key);
      const duration = (Date.now() - startTime) / 1000;

      // Track cache hit/miss metrics
      const status = value !== undefined ? 'hit' : 'miss';
      this.recordCacheMetrics('get', status, key, duration);

      if (value !== undefined) {
        this.logger.debug(`Cache HIT for key: ${key}`);
      } else {
        this.logger.debug(`Cache MISS for key: ${key}`);
      }

      return value;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.recordCacheMetrics('get', 'error', key, duration);
      this.logger.error(`Cache GET error for key ${key}:`, error);
      return undefined;
    }
  }

  /**
   * Sets a value in cache with custom TTL.
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in milliseconds (optional)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const startTime = Date.now();

    try {
      await this.cacheManager.set(key, value, ttl);
      const duration = (Date.now() - startTime) / 1000;

      this.recordCacheMetrics('set', 'success', key, duration);
      this.logger.debug(`Cache SET for key: ${key}, TTL: ${ttl || 'default'}`);
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.recordCacheMetrics('set', 'error', key, duration);
      this.logger.error(`Cache SET error for key ${key}:`, error);
    }
  }

  /**
   * Deletes a value from cache.
   *
   * @param key - Cache key to delete
   */
  async del(key: string): Promise<void> {
    const startTime = Date.now();

    try {
      await this.cacheManager.del(key);
      const duration = (Date.now() - startTime) / 1000;

      this.recordCacheMetrics('del', 'success', key, duration);
      this.logger.debug(`Cache DEL for key: ${key}`);
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.recordCacheMetrics('del', 'error', key, duration);
      this.logger.error(`Cache DEL error for key ${key}:`, error);
    }
  }

  /**
   * Invalidates cache entries by pattern.
   *
   * @param pattern - Pattern to match keys (e.g., 'rooms:*', 'reservations:user:123:*')
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Note: This is a simplified implementation
      // In production, you might want to use Redis SCAN for better performance
      const keys = await this.getKeysByPattern(pattern);

      if (keys.length > 0) {
        await Promise.all(keys.map((key) => this.del(key)));
        this.logger.debug(
          `Cache invalidated ${keys.length} keys matching pattern: ${pattern}`,
        );
      }

      const duration = (Date.now() - startTime) / 1000;
      this.recordCacheMetrics(
        'invalidate_pattern',
        'success',
        pattern,
        duration,
      );
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.recordCacheMetrics('invalidate_pattern', 'error', pattern, duration);
      this.logger.error(
        `Cache pattern invalidation error for ${pattern}:`,
        error,
      );
    }
  }

  /**
   * Caches room availability data.
   *
   * @param roomId - Room ID
   * @param date - Date string (YYYY-MM-DD)
   * @param isAvailable - Availability status
   * @param conflictingReservationId - ID of conflicting reservation if any
   */
  async cacheRoomAvailability(
    roomId: number,
    date: string,
    isAvailable: boolean,
    conflictingReservationId?: number,
  ): Promise<void> {
    const key = this.keys.rooms.availability(roomId, date);
    const data = {
      isAvailable,
      conflictingReservationId,
      cachedAt: new Date().toISOString(),
    };

    await this.set(key, data, this.ttlConfig.roomAvailability);
  }

  /**
   * Gets cached room availability.
   *
   * @param roomId - Room ID
   * @param date - Date string (YYYY-MM-DD)
   * @returns Cached availability data or undefined
   */
  async getRoomAvailability(roomId: number, date: string) {
    const key = this.keys.rooms.availability(roomId, date);
    return this.get<{
      isAvailable: boolean;
      conflictingReservationId?: number;
      cachedAt: string;
    }>(key);
  }

  /**
   * Invalidates all cache entries related to a specific room.
   * Called when room data changes or new reservations are made.
   *
   * @param roomId - Room ID
   */
  async invalidateRoomCache(roomId: number): Promise<void> {
    const patterns = [
      `rooms:${roomId}*`, // Room details
      `reservations:room:${roomId}*`, // Room reservations
    ];

    await Promise.all(
      patterns.map((pattern) => this.invalidatePattern(pattern)),
    );
    this.logger.debug(`Invalidated all cache for room ${roomId}`);
  }

  /**
   * Invalidates cache entries for a specific user.
   * Called when user makes/cancels reservations.
   *
   * @param userId - User ID
   */
  async invalidateUserCache(userId: number): Promise<void> {
    const patterns = [
      `users:profile:${userId}`,
      `reservations:user:${userId}*`,
    ];

    await Promise.all(
      patterns.map((pattern) => this.invalidatePattern(pattern)),
    );
    this.logger.debug(`Invalidated all cache for user ${userId}`);
  }

  /**
   * Generic cache-aside pattern implementation.
   * Gets data from cache or executes function and caches the result.
   *
   * @param key - Cache key
   * @param fetchFunction - Function to execute if cache miss
   * @param ttl - Time to live in milliseconds
   * @returns Cached or freshly fetched data
   */
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Cache miss - fetch data
    this.logger.debug(`Cache miss for ${key}, executing fetch function`);
    const data = await fetchFunction();

    // Cache the result
    await this.set(key, data, ttl);

    return data;
  }

  /**
   * Health check for Redis connection.
   *
   * @returns Promise resolving to connection status
   */
  async healthCheck(): Promise<{ status: string; latency?: number }> {
    const startTime = Date.now();

    try {
      const testKey = 'health:check';
      const testValue = { timestamp: Date.now() };

      await this.set(testKey, testValue, 5000); // 5 second TTL
      const retrieved = await this.get(testKey);
      await this.del(testKey);

      const latency = Date.now() - startTime;

      if (retrieved && typeof retrieved === 'object' && 'timestamp' in retrieved && retrieved.timestamp === testValue.timestamp) {
        return { status: 'healthy', latency };
      } else {
        return { status: 'unhealthy' };
      }
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return { status: 'unhealthy' };
    }
  }

  private getKeysByPattern(pattern: string): Promise<string[]> {
    // Simplified implementation - in production, use Redis SCAN
    // This is a placeholder that would need to be implemented based on your Redis client
    this.logger.warn(
      `Pattern-based key retrieval not fully implemented: ${pattern}`,
    );
    return Promise.resolve([]);
  }

  private recordCacheMetrics(
    operation: string,
    status: string,
    key: string,
    duration: number,
  ): void {
    // Extract cache type from key for better metrics segmentation
    const cacheType = key.split(':')[0] || 'unknown';

    // Record cache operation metrics
    this.metricsService.recordCacheOperation(
      operation,
      status,
      cacheType,
      duration,
    );
  }
}
