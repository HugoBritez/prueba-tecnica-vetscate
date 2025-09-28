# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Descripción del Proyecto

Sistema de reservas de salas desarrollado con NestJS y TypeScript para prueba técnica. Implementa autenticación JWT, gestión de usuarios, salas y reservas con validaciones de solapamiento.

## Comandos de Desarrollo

### Ejecución y Build
- `npm run build` - Construir aplicación con NestJS CLI
- `npm run start` - Iniciar aplicación
- `npm run start:dev` - Modo desarrollo con hot-reload
- `npm run start:debug` - Modo debug con watch
- `npm run start:prod` - Ejecutar build de producción

### Calidad de Código
- `npm run lint` - Ejecutar ESLint con auto-fix
- `npm run format` - Formatear código con Prettier

### Testing
- `npm run test` - Tests unitarios con Jest
- `npm run test:watch` - Tests en modo watch
- `npm run test:cov` - Tests con cobertura
- `npm run test:e2e` - Tests end-to-end

### Docker
- `docker-compose up --build` - Desarrollo con Docker
- `docker-compose -f docker-compose.prod.yml up` - Producción

## Arquitectura del Sistema

### Módulos Principales
- **auth/**: Autenticación JWT (registro, login, guards, estrategias)
- **users/**: Gestión de usuarios y perfiles
- **rooms/**: CRUD de salas con validaciones
- **reservations/**: Sistema de reservas con validaciones de solapamiento
- **health/**: Health checks comprensivos y monitoreo de sistema
- **observability/**: Métricas, logging estructurado y observabilidad

### Entidades y Relaciones
- **User**: id, name, email (único), password (hash), role (USER/ADMIN)
- **Room**: id, name (único), capacity
- **Reservation**: id, roomId, userId, startTime, endTime
- Relaciones: User 1:N Reservations, Room 1:N Reservations

### Patrones Implementados
- **Clean Code**: Principios SOLID aplicados
- **DTOs**: Validaciones con class-validator
- **Guards**: JwtAuthGuard, AdminGuard
- **Decorators**: @Public, @CurrentUser
- **Services**: Separación de lógica de negocio
- **Race Condition Prevention**: Locking pesimista y transacciones SERIALIZABLE
- **Observability**: Health checks, métricas Prometheus, logging estructurado
- **Interceptors**: Captura automática de métricas HTTP

## Endpoints Principales

### Autenticación (Públicos)
- `POST /auth/register` - Registro usuario
- `POST /auth/login` - Login con JWT

### Protegidos (requieren JWT)
- `GET /users/me` - Perfil usuario
- `POST /rooms` - Crear sala
- `GET /rooms` - Listar salas
- `POST /reservations` - Crear reserva (legacy - puede tener race conditions)
- `POST /reservations/secure` - Crear reserva con protección contra race conditions
- `GET /reservations` - Mis reservas
- `GET /reservations/all` - Todas las reservas (solo ADMIN)

### Observabilidad y Monitoreo (Públicos)
- `GET /health` - Health check comprensivo con métricas detalladas
- `GET /health/ready` - Readiness probe para orquestadores de contenedores
- `GET /health/live` - Liveness probe básico
- `GET /metrics` - Métricas Prometheus para monitoreo

## Validaciones Implementadas

### Reglas de Negocio
- Email único para usuarios
- Nombre único para salas
- No solapamiento de reservas en misma sala
- endTime > startTime
- Reservas no pueden ser en el pasado

### Seguridad
- Passwords hasheadas con bcrypt (12 rounds)
- JWT con expiración 24h
- Input validation con class-validator
- Guards para protección de rutas

## Base de Datos

- **SQLite** en archivo local (`database.sqlite`)
- **TypeORM** con sincronización automática en desarrollo
- **Entidades** con decoradores y relaciones
- **Migrations** automáticas (synchronize: true)

## Configuración

### Variables de Entorno
- `JWT_SECRET` - Clave secreta JWT (requerida en producción)
- `PORT` - Puerto aplicación (default: 3000)
- `NODE_ENV` - Entorno (development/production)

### Documentación
- **Swagger** disponible en `/api`
- **Health check** en `/` (endpoint público)

## Mejoras de Nivel Senior Implementadas

### 🔒 **Prevención de Race Conditions**
- **ReservationTransactionService**: Implementación con locking pesimista
- **Transacciones SERIALIZABLE**: Máximo nivel de aislamiento en PostgreSQL
- **Bloqueo exclusivo por sala**: `setLock('pessimistic_write')` sobre Room entities
- **Logging estructurado**: Correlation IDs para trazabilidad completa
- **Endpoint seguro**: `/reservations/secure` con protección completa vs concurrencia

#### Estrategia Anti-Race Condition:
1. Adquiere lock exclusivo sobre la sala específica
2. Valida restricciones de tiempo dentro de la transacción
3. Verifica solapamientos con la sala aún bloqueada
4. Crea reserva atómicamente antes de liberar el lock
5. Requests concurrentes esperan el lock → validación falla → ConflictException

### 📊 **Observabilidad Comprensiva**

#### Health Checks Multi-Nivel
- **`/health`**: Health check completo con métricas detalladas
  - Conectividad de base de datos (timeout 3s)
  - Monitoreo de memoria heap (límite 150MB)
  - Métricas de uptime y versión del proceso
- **`/health/ready`**: Readiness probe optimizado para load balancers
- **`/health/live`**: Liveness probe básico para orchestradores

#### Sistema de Métricas Prometheus
- **Métricas HTTP**: Contadores y histogramas por método/ruta/status
- **Métricas de Negocio**: Operaciones de reserva (success/conflict/failed)
- **Monitoreo de Concurrencia**: Tracking de intentos simultáneos por sala
- **Métricas de Infraestructura**: Conexiones DB, memoria, CPU, GC
- **Endpoint**: `/metrics` en formato Prometheus exposition

#### Logging Estructurado
- **Correlation IDs**: Trazabilidad end-to-end de requests
- **Context enriquecido**: userId, roomId, timestamps, duración
- **Eventos específicos**: RESERVATION_ATTEMPT_START, SUCCESS, FAILED, CONFLICT
- **Structured format**: JSON logs para facilitar parsing y alertas

#### Interceptor de Métricas Automático
- **MetricsInterceptor**: Captura transparente de todas las HTTP requests
- **Timing automático**: Duración de requests sin código adicional
- **Error tracking**: Métricas diferenciadas por código de estado
- **Route extraction**: Patrones de ruta limpia para agregación

### 🏗️ **Arquitectura de Producción**

#### Dependencias Agregadas
```json
{
  "@nestjs/terminus": "^11.0.0",    // Health checks
  "@nestjs/axios": "^4.0.1",        // HTTP client para health checks
  "prom-client": "^15.1.3"          // Métricas Prometheus
}
```

#### Integración Global
- **Global Interceptor**: Métricas automáticas en todas las rutas
- **Global Module**: ObservabilityModule disponible en toda la app
- **Typed interfaces**: Full TypeScript support para métricas

#### Métricas de Negocio Implementadas
```typescript
// Ejemplos de métricas expuestas:
vetscate_http_requests_total{method="POST",route="/reservations/secure",status_code="201"} 142
vetscate_http_requests_total{method="POST",route="/reservations/secure",status_code="409"} 8
vetscate_reservation_operations_total{operation="create",status="success",room_id="1"} 98
vetscate_reservation_operations_total{operation="create",status="conflict",room_id="1"} 4
vetscate_concurrent_reservation_attempts{room_id="1"} 0
```

### 📋 **Para Deployment Completo**
1. **Docker Rebuild**: `docker-compose up --build` para incluir nuevas dependencias
2. **Prometheus Setup**: Configurar scraping del endpoint `/metrics`
3. **Grafana Dashboards**: Visualización de métricas de negocio y sistema
4. **Alerting**: Configurar alertas para high error rates y race conditions
5. **Log Aggregation**: Elasticsearch/Loki para análisis de correlation IDs

## Notas para Desarrollo

- Aplicación lista para demostración inmediata
- Docker configurado para desarrollo y producción
- CI/CD pipeline con GitHub Actions
- Código siguiendo principios Clean Code y SOLID
- Tests unitarios y e2e configurados
- Linting y formatting automático
- **Observabilidad de nivel enterprise** implementada
- **Prevención robusta de race conditions** en operaciones críticas