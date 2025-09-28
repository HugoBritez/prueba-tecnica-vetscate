import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
  HealthCheckResult,
} from '@nestjs/terminus';
import { Public } from '../auth/decorators/public.decorator';
import { CacheService } from '../cache/cache.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private cacheService: CacheService,
  ) {}

  /**
   * Comprehensive health check endpoint for application monitoring.
   *
   * Performs deep health checks across all critical application components:
   * - Database connectivity and response time
   * - Memory usage and heap statistics
   * - Application uptime and performance metrics
   *
   * @returns {Promise<HealthCheckResult>} Comprehensive health status with timing metrics
   *
   * **Monitoring Strategy:**
   * - Database: Validates connection with timeout threshold
   * - Memory: Monitors heap usage against configured limits
   * - Service: Tracks application uptime and readiness
   *
   * **Production Usage:**
   * - Load balancer health checks
   * - Kubernetes readiness/liveness probes
   * - Monitoring system integration (Prometheus, DataDog, etc.)
   *
   * @example
   * ```typescript
   * // Expected response structure:
   * {
   *   "status": "ok",
   *   "info": {
   *     "database": { "status": "up", "responseTime": "12ms" },
   *     "memory_heap": { "status": "up", "used": "45MB", "total": "128MB" }
   *   },
   *   "error": {},
   *   "details": { ... }
   * }
   * ```
   */
  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({
    summary: 'Application health check',
    description:
      'Comprehensive health monitoring endpoint for production systems',
  })
  @ApiResponse({
    status: 200,
    description: 'Health check successful - all systems operational',
  })
  @ApiResponse({
    status: 503,
    description: 'Health check failed - service degraded or unavailable',
  })
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      // Database connectivity with 3-second timeout
      () => this.db.pingCheck('database', { timeout: 3000 }),

      // Memory usage monitoring with 150MB heap limit
      async () => {
        const memUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
        const isHealthy = heapUsedMB < 150; // 150MB threshold

        if (!isHealthy) {
          throw new Error(`Memory usage too high: ${heapUsedMB}MB`);
        }

        return {
          memory_heap: {
            status: 'up',
            used: `${heapUsedMB}MB`,
            total: `${heapTotalMB}MB`,
            utilization: `${Math.round((heapUsedMB / heapTotalMB) * 100)}%`,
          },
        };
      },

      // Application uptime and basic service health
      async () => {
        const uptimeSeconds = Math.floor(process.uptime());
        const uptimeMinutes = Math.floor(uptimeSeconds / 60);

        return {
          service: {
            status: 'up',
            uptime: `${uptimeMinutes}m ${uptimeSeconds % 60}s`,
            pid: process.pid,
            version: process.version,
          },
        };
      },

      // Redis cache health check
      async () => {
        const cacheHealth = await this.cacheService.healthCheck();

        if (cacheHealth.status !== 'healthy') {
          throw new Error('Redis cache is unhealthy');
        }

        return {
          redis_cache: {
            status: 'up',
            latency: `${cacheHealth.latency}ms`,
            connection: 'active',
          },
        };
      },
    ]);
  }

  /**
   * Lightweight readiness probe for container orchestration.
   *
   * Fast endpoint optimized for frequent health checks by load balancers
   * and container orchestration platforms. Validates only critical dependencies
   * required for the application to serve requests.
   *
   * @returns {Promise<{ status: string, timestamp: string }>} Simple readiness status
   */
  @Get('ready')
  @Public()
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Lightweight endpoint for container orchestration readiness checks',
  })
  async ready(): Promise<{ status: string; timestamp: string }> {
    try {
      // Quick database ping without detailed metrics
      await this.db.pingCheck('database', { timeout: 1000 });
      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw error; // Let NestJS handle the 503 response
    }
  }

  /**
   * Liveness probe for container restart decisions.
   *
   * Basic endpoint that confirms the application process is responsive.
   * Used by orchestration platforms to determine if the container should be restarted.
   *
   * @returns {{ status: string, timestamp: string }} Basic liveness confirmation
   */
  @Get('live')
  @Public()
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Basic endpoint for container orchestration liveness checks',
  })
  async live(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }
}
