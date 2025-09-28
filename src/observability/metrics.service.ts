import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  register,
  collectDefaultMetrics,
  Counter,
  Histogram,
  Gauge,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;
  private readonly reservationOperations: Counter<string>;
  private readonly concurrentReservationAttempts: Gauge<string>;
  private readonly databaseConnections: Gauge<string>;
  private readonly cacheOperations: Counter<string>;
  private readonly cacheOperationDuration: Histogram<string>;

  constructor() {
    // HTTP metrics
    this.httpRequestsTotal = new Counter({
      name: 'vetscate_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [register],
    });

    this.httpRequestDuration = new Histogram({
      name: 'vetscate_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [register],
    });

    // Business metrics
    this.reservationOperations = new Counter({
      name: 'vetscate_reservation_operations_total',
      help: 'Total number of reservation operations',
      labelNames: ['operation', 'status', 'room_id'],
      registers: [register],
    });

    this.concurrentReservationAttempts = new Gauge({
      name: 'vetscate_concurrent_reservation_attempts',
      help: 'Number of concurrent reservation attempts (race condition monitoring)',
      labelNames: ['room_id'],
      registers: [register],
    });

    // Infrastructure metrics
    this.databaseConnections = new Gauge({
      name: 'vetscate_database_connections_active',
      help: 'Number of active database connections',
      registers: [register],
    });

    // Cache metrics
    this.cacheOperations = new Counter({
      name: 'vetscate_cache_operations_total',
      help: 'Total number of cache operations',
      labelNames: ['operation', 'status', 'cache_type'],
      registers: [register],
    });

    this.cacheOperationDuration = new Histogram({
      name: 'vetscate_cache_operation_duration_seconds',
      help: 'Cache operation duration in seconds',
      labelNames: ['operation', 'cache_type'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [register],
    });
  }

  onModuleInit() {
    // Collect default Node.js metrics (memory, CPU, etc.)
    collectDefaultMetrics({ register });
  }

  /**
   * Records HTTP request metrics for observability.
   *
   * @param method - HTTP method (GET, POST, etc.)
   * @param route - API route pattern
   * @param statusCode - HTTP response status code
   * @param duration - Request duration in seconds
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
  ): void {
    this.httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode.toString(),
    });

    this.httpRequestDuration.observe({ method, route }, duration);
  }

  /**
   * Records reservation operation metrics for business intelligence.
   *
   * @param operation - Type of operation (create, cancel, modify)
   * @param status - Operation status (success, failed, conflict)
   * @param roomId - Room ID for segmentation
   */
  recordReservationOperation(
    operation: string,
    status: string,
    roomId?: number,
  ): void {
    this.reservationOperations.inc({
      operation,
      status,
      room_id: roomId?.toString() || 'unknown',
    });
  }

  /**
   * Tracks concurrent reservation attempts for race condition monitoring.
   *
   * @param roomId - Room ID being booked
   * @param increment - Whether to increment (true) or decrement (false)
   */
  trackConcurrentReservation(roomId: number, increment: boolean): void {
    if (increment) {
      this.concurrentReservationAttempts.inc({ room_id: roomId.toString() });
    } else {
      this.concurrentReservationAttempts.dec({ room_id: roomId.toString() });
    }
  }

  /**
   * Updates active database connection count.
   *
   * @param count - Current number of active connections
   */
  updateDatabaseConnections(count: number): void {
    this.databaseConnections.set(count);
  }

  /**
   * Gets all metrics in Prometheus format.
   *
   * @returns Promise resolving to metrics string in Prometheus exposition format
   */
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Records cache operation metrics for performance monitoring.
   *
   * @param operation - Type of cache operation (get, set, del, invalidate_pattern)
   * @param status - Operation status (hit, miss, success, error)
   * @param cacheType - Type of cache data (rooms, reservations, users)
   * @param duration - Operation duration in seconds
   */
  recordCacheOperation(
    operation: string,
    status: string,
    cacheType: string,
    duration: number,
  ): void {
    this.cacheOperations.inc({
      operation,
      status,
      cache_type: cacheType,
    });

    this.cacheOperationDuration.observe(
      { operation, cache_type: cacheType },
      duration,
    );
  }

  /**
   * Resets all metrics (useful for testing).
   */
  resetMetrics(): void {
    register.resetMetrics();
  }
}
