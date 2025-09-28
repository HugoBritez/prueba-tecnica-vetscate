import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const startTime = Date.now();
    const method = request.method;
    const route = this.extractRoute(request);

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - startTime) / 1000;
        const statusCode = response.statusCode;

        this.metricsService.recordHttpRequest(
          method,
          route,
          statusCode,
          duration,
        );
      }),
      catchError((error) => {
        const duration = (Date.now() - startTime) / 1000;
        const statusCode = error.status || 500;

        this.metricsService.recordHttpRequest(
          method,
          route,
          statusCode,
          duration,
        );
        throw error;
      }),
    );
  }

  private extractRoute(request: any): string {
    // Extract route pattern from request
    const route = request.route?.path;
    if (route) {
      return route;
    }

    // Fallback to URL pathname for non-decorated endpoints
    const url = request.url;
    if (url) {
      // Remove query parameters
      return url.split('?')[0];
    }

    return 'unknown';
  }
}
