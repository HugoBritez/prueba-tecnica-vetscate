Requerimientos mínimos (Obligatorios)
1. Usuarios
* Campos: id, name, email (único), password (encriptada).
* Endpoints:
   * Registro de usuario.
   * Login con JWT.
* Solo el usuario autenticado puede ver su perfil (/me).
2. Salas
* Campos: id, name (único), capacity.
* Endpoints:
   * Crear sala.
   * Listar salas.
3. Reservas
* Campos: id, roomId, userId, startTime, endTime.
* Validaciones:
   * Una sala no puede tener dos reservas que se solapen.
   * endTime debe ser mayor que startTime.
* Endpoints:
   * Crear reserva.
   * Listar reservas del usuario autenticado.
Requisitos Técnicos
* NestJS con TypeScript.
* Base de datos simple (SQLite en memoria o archivo).
* DTOs con validaciones (class-validator).
* Autenticación con JWT.
* Código organizado en módulos, controladores y servicios.
* Instrucciones claras en un README.md para correr el proyecto.
Opcional (Bonus, no obligatorio)
* Rol ADMIN que pueda ver todas las reservas.
* Documentar endpoints con Swagger.
* Tests unitarios en al menos un servicio.

