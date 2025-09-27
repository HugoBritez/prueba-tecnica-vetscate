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

## Endpoints Principales

### Autenticación (Públicos)
- `POST /auth/register` - Registro usuario
- `POST /auth/login` - Login con JWT

### Protegidos (requieren JWT)
- `GET /users/me` - Perfil usuario
- `POST /rooms` - Crear sala
- `GET /rooms` - Listar salas
- `POST /reservations` - Crear reserva
- `GET /reservations` - Mis reservas
- `GET /reservations/all` - Todas las reservas (solo ADMIN)

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

## Notas para Desarrollo

- Aplicación lista para demostración inmediata
- Docker configurado para desarrollo y producción
- CI/CD pipeline con GitHub Actions
- Código siguiendo principios Clean Code y SOLID
- Tests unitarios y e2e configurados
- Linting y formatting automático