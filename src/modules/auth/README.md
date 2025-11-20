# Auth Module

## Propósito
Maneja autenticación, autorización, gestión de contraseñas y operaciones JWT para todo el sistema AFIS.

## Estructura de Archivos

### Controladores
- `auth.controller.ts` - Endpoints de autenticación y gestión de contraseñas

### Servicios
- `auth.service.ts` - Lógica de negocio de autenticación

### Estrategias
- `jwt.strategy.ts` - Estrategia Passport para validación JWT

### Guards
- `user-role.guard.ts` - Guard para validación de roles

### Decoradores
- `auth.decorator.ts` - Decorador @Auth() para proteger rutas
- `get-user.decorators.ts` - Decorador @GetUser() para extraer usuario del JWT
- `role-protected.decorator.ts` - Decorador para protección por roles

### Interfaces
- `jwt-payload.interface.ts` - Estructura del payload JWT
- `valid-roles.interface.ts` - Definición de roles válidos

## Endpoints Principales

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/auth/sign-in` | Login con credenciales | No |
| POST | `/auth/forgot-password` | Solicitar reset de contraseña | No |
| POST | `/auth/reset-password` | Resetear contraseña con token | No |
| PATCH | `/auth/change-password` | Cambiar contraseña (autenticado) | Sí |
| POST | `/auth/sign-in-with-token` | Validar JWT y obtener estado de sesión | Sí |

## DTOs Principales

### CreateAuthDto (Login)
```typescript
{
  usuario: string;
  password: string;
}
```

### ForgotPasswordDto
```typescript
{
  email: string;
}
```

### ResetPasswordDto
```typescript
{
  token: string;
  password: string; // Min 8 chars, 1 mayúscula, 1 minúscula, 1 número
}
```

### ChangePasswordDto
```typescript
{
  oldPassword: string;
  newPassword: string; // Min 8 chars, 1 mayúscula, 1 minúscula, 1 número
}
```

### ResponseLoginDto
```typescript
{
  usuario: Usuario;
  token: string;
  general: GeneralData; // Configuración del sistema
}
```

## Servicios y Métodos Clave

### AuthService

#### `login(createAuthDto: CreateAuthDto)`
- Valida credenciales contra base de datos
- Verifica que usuario esté ACTIVO
- Compara password hasheado con bcrypt
- Genera token JWT
- Registra intento de login en bitácora
- Delay de 2 segundos para prevenir fuerza bruta
- Retorna: usuario + token + configuración general

#### `forgotPassword(forgotPasswordDto: ForgotPasswordDto)`
- Busca usuario por email
- Genera token aleatorio de reset (UUID)
- Establece expiración de 30 minutos
- Envía email con link de reset
- Retorna: mensaje de confirmación

#### `resetPassword(resetPasswordDto: ResetPasswordDto)`
- Valida token de reset
- Verifica que no haya expirado (30 min)
- Hashea nueva contraseña con bcrypt (10 rounds)
- Actualiza contraseña
- Invalida token de reset
- Retorna: mensaje de confirmación

#### `changePassword(id_usuario: number, changePasswordDto: ChangePasswordDto)`
- Valida contraseña actual
- Verifica formato de nueva contraseña
- Hashea nueva contraseña con bcrypt
- Actualiza en base de datos
- Retorna: mensaje de confirmación

#### `checkStatus(usuario: Usuario)`
- Renueva token JWT
- Retorna: nuevo token

#### `getJwtToken(payload: JwtPayload)` (privado)
- Genera token JWT firmado
- Payload: `{ id_usuario, id_sucursal }`
- Expiración: 8 horas

## Reglas de Negocio Importantes

### Seguridad de Contraseñas
- **Hashing**: bcrypt con 10 rounds
- **Requisitos**:
  - Mínimo 8 caracteres
  - Al menos 1 letra mayúscula
  - Al menos 1 letra minúscula
  - Al menos 1 número
- **Validación**: Usando class-validator decorators

### Tokens JWT
- **Expiración**: 8 horas
- **Secret**: Variable de entorno `JWT_SECRET`
- **Payload**:
  ```typescript
  {
    id_usuario: number;
    id_sucursal: number;
  }
  ```

### Tokens de Reset de Contraseña
- **Generación**: UUID aleatorio
- **Expiración**: 30 minutos desde creación
- **Uso único**: Se invalida después de usar
- **Almacenamiento**: Campos en tabla `usuarios`:
  - `reset_password_token`
  - `reset_password_expires`

### Control de Acceso
- Solo usuarios con `estado = 'ACTIVO'` pueden hacer login
- Delay de 2 segundos en login para prevenir ataques de fuerza bruta
- Todos los intentos de login se registran en bitácora (éxito/fallo)

### Auditoría
- **Tabla de bitácora**: `log`
- **Eventos registrados**:
  - Login exitoso
  - Login fallido (credenciales incorrectas)
  - Login fallido (usuario inactivo)
  - Reset de contraseña solicitado
  - Reset de contraseña completado
  - Cambio de contraseña

## Decoradores de Uso Común

### @Auth(...roles)
Protege rutas y opcionalmente valida roles:
```typescript
@Auth() // Solo requiere autenticación
@Auth(ValidRoles.admin) // Requiere rol admin
@Auth(ValidRoles.admin, ValidRoles.supervisor) // Requiere admin O supervisor
```

### @GetUser()
Extrae el usuario autenticado del request:
```typescript
@GetUser() usuario: Usuario
@GetUser('id_usuario') id: number
@GetUser('id_sucursal') idSucursal: number
```

### @RoleProtected(...roles)
Define roles requeridos (usado internamente por @Auth):
```typescript
@RoleProtected(ValidRoles.admin)
```

## Tablas de Base de Datos

### Principales
- `usuarios` - Usuarios del sistema con credenciales
- `log` - Bitácora de acciones del sistema
- `general_data` - Configuración general del sistema

### Campos Relevantes en `usuarios`
- `usuario` - Username para login
- `password` - Password hasheado (bcrypt)
- `email` - Email para recuperación
- `estado` - ACTIVO/INACTIVO/SUSPENDIDO
- `reset_password_token` - Token temporal de reset
- `reset_password_expires` - Fecha de expiración del token
- `id_sucursal` - Sucursal asignada (para JWT payload)
- `id_rol` - Rol del usuario (para autorización)

## Dependencias de Módulos

- `PrismaModule` - Acceso a base de datos
- `JwtModule` - Generación y validación de tokens
- `PassportModule` - Framework de autenticación
- `MailModule` - Envío de emails de reset de contraseña

## Configuración (.env)

```env
JWT_SECRET=your-secret-key-here
JWT_EXPIRATION=8h
FRONTEND_URL=http://localhost:3000
```

## Notas de Implementación

1. **Password Hashing**: Siempre usar bcrypt, nunca almacenar contraseñas en texto plano
2. **Email de Reset**: El link se construye como `${FRONTEND_URL}/reset-password?token=${token}`
3. **Renovación de Token**: El endpoint `sign-in-with-token` permite renovar tokens antes de que expiren
4. **Roles**: Definidos en `valid-roles.interface.ts`, sincronizados con tabla `roles`
5. **Guards**: El `UserRoleGuard` verifica roles después de que `JwtStrategy` valida el token
