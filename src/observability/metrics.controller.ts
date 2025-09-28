import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * Prometheus metrics endpoint for monitoring and alerting.
   *
   * Exposes application and business metrics in Prometheus exposition format
   * for consumption by monitoring systems like Prometheus, Grafana, or DataDog.
   *
   * @returns {Promise<string>} Metrics in Prometheus format
   *
   * **Available Metrics:**
   * - HTTP request counts and durations by route/method/status
   * - Reservation operation metrics and success rates
   * - Concurrent booking attempt monitoring for race condition detection
   * - Database connection pool metrics
   * - Node.js runtime metrics (memory, CPU, GC)
   *
   * **Monitoring Integration:**
   * - Configure Prometheus to scrape this endpoint
   * - Set up alerts for high error rates or latency
   * - Create dashboards for business KPIs and system health
   *
   * @example
   * ```
   * # HELP vetscate_http_requests_total Total number of HTTP requests
   * # TYPE vetscate_http_requests_total counter
   * vetscate_http_requests_total{method="POST",route="/reservations",status_code="201"} 142
   * vetscate_http_requests_total{method="POST",route="/reservations",status_code="409"} 8
   *
   * # HELP vetscate_reservation_operations_total Total reservation operations
   * # TYPE vetscate_reservation_operations_total counter
   * vetscate_reservation_operations_total{operation="create",status="success",room_id="1"} 98
   * vetscate_reservation_operations_total{operation="create",status="conflict",room_id="1"} 4
   * ```
   */
  @Get()
  @Public()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({
    summary: 'Prometheus metrics endpoint',
    description:
      'Application and business metrics in Prometheus exposition format',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics successfully exported',
    content: {
      'text/plain': {
        schema: {
          type: 'string',
          example:
            '# HELP vetscate_http_requests_total Total HTTP requests\n# TYPE vetscate_http_requests_total counter\nvetscate_http_requests_total{method="GET",route="/health",status_code="200"} 1',
        },
      },
    },
  })
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
