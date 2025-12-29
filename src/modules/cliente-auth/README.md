# API de Autenticación de Clientes - Documentación Frontend

## Base URL

```
Desarrollo: http://localhost:4000/cliente-auth
Producción: https://api.tudominio.com/cliente-auth
```

## Headers Requeridos

### Requests sin autenticación
```http
Content-Type: application/json
```

### Requests con autenticación
```http
Content-Type: application/json
Authorization: Bearer <access_token>
```

---

## Flujos de Autenticación

### Flujo 1: Primera Vez (Activación de Cuenta)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Cliente       │     │   Backend       │     │   Email         │
│   (Frontend)    │     │   (API)         │     │   Service       │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  POST /solicitar-activacion                   │
         │  { dui: "12345678-9" }                        │
         │──────────────────────>│                       │
         │                       │                       │
         │                       │  Enviar token         │
         │                       │──────────────────────>│
         │                       │                       │
         │  { message: "..." }   │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │         (Cliente recibe email con link)       │
         │                       │                       │
         │  POST /activar-cuenta                         │
         │  { token, password, confirmar_password }      │
         │──────────────────────>│                       │
         │                       │                       │
         │  { message: "Cuenta activada" }               │
         │<──────────────────────│                       │
         │                       │                       │
         │  (Redirigir a login)  │                       │
```

### Flujo 2: Login Normal

```
┌─────────────────┐     ┌─────────────────┐
│   Cliente       │     │   Backend       │
│   (Frontend)    │     │   (API)         │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │  POST /login          │
         │  { identificador,     │
         │    password }         │
         │──────────────────────>│
         │                       │
         │  {                    │
         │    cliente: {...},    │
         │    access_token,      │
         │    refresh_token,     │
         │    expires_in         │
         │  }                    │
         │<──────────────────────│
         │                       │
         │  (Guardar tokens)     │
         │  (Redirigir a /home)  │
```

### Flujo 3: Refresh Token

```
┌─────────────────┐     ┌─────────────────┐
│   Cliente       │     │   Backend       │
│   (Frontend)    │     │   (API)         │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │  (Access token       │
         │   por expirar)        │
         │                       │
         │  POST /refresh-token  │
         │  { refresh_token }    │
         │  + Authorization      │
         │──────────────────────>│
         │                       │
         │  {                    │
         │    access_token,      │
         │    refresh_token,     │  (nuevo)
         │    expires_in         │
         │  }                    │
         │<──────────────────────│
         │                       │
         │  (Actualizar tokens)  │
```

### Flujo 4: Recuperar Contraseña

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Cliente       │     │   Backend       │     │   Email         │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  POST /forgot-password│                       │
         │  { identificador }    │                       │
         │──────────────────────>│                       │
         │                       │  Enviar token reset   │
         │                       │──────────────────────>│
         │  { message: "..." }   │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │         (Cliente recibe email con link)       │
         │                       │                       │
         │  POST /reset-password │                       │
         │  { token, password,   │                       │
         │    confirmar_password }                       │
         │──────────────────────>│                       │
         │                       │                       │
         │  { message: "..." }   │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │  (Redirigir a login)  │                       │
```

---

## Endpoints Detallados

### 1. Login

**POST** `/cliente-auth/login`

**Request:**
```json
{
  "identificador": "12345678-9",
  "password": "MiPassword123!",
  "fcm_token": "token_firebase_opcional"
}
```

> **Nota:** El `identificador` puede ser DUI o correo electrónico.

**Response Exitosa (200):**
```json
{
  "cliente": {
    "id_cliente": 1,
    "titular": "Juan Pérez",
    "dui": "12345678-9",
    "correo_electronico": "juan@email.com",
    "telefono1": "+50312345678",
    "ultimo_login": "2025-12-29T10:30:00.000Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "a1b2c3d4e5f6g7h8i9j0...",
  "token_type": "Bearer",
  "expires_in": 14400
}
```

**Errores:**

| Código | Descripción | Response |
|--------|-------------|----------|
| 401 | Credenciales inválidas | `{ "statusCode": 401, "message": "Credenciales inválidas" }` |
| 403 | Cuenta bloqueada | `{ "statusCode": 403, "message": "Cuenta bloqueada. Intente nuevamente en X minutos" }` |
| 403 | Cuenta no activada | `{ "statusCode": 403, "message": "Cuenta no activada. Solicite la activación de su cuenta" }` |
| 429 | Rate limit | `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests" }` |

---

### 2. Solicitar Activación de Cuenta

**POST** `/cliente-auth/solicitar-activacion`

**Request:**
```json
{
  "dui": "12345678-9"
}
```

**Response (200):**
```json
{
  "message": "Si el DUI está registrado, recibirá instrucciones por correo electrónico"
}
```

> **Nota de Seguridad:** La respuesta es siempre la misma para evitar enumeración de usuarios.

---

### 3. Activar Cuenta

**POST** `/cliente-auth/activar-cuenta`

**Request:**
```json
{
  "token": "abc123def456...",
  "password": "MiPassword123!",
  "confirmar_password": "MiPassword123!"
}
```

**Validaciones de Contraseña:**
- Mínimo 8 caracteres
- Al menos 1 letra mayúscula
- Al menos 1 letra minúscula
- Al menos 1 número
- Al menos 1 carácter especial (@$!%*?&)

**Response Exitosa (200):**
```json
{
  "message": "Cuenta activada exitosamente. Ya puede iniciar sesión"
}
```

**Errores:**

| Código | Descripción |
|--------|-------------|
| 400 | Token inválido o expirado |
| 400 | Las contraseñas no coinciden |
| 400 | La contraseña no cumple los requisitos |

---

### 4. Olvidé mi Contraseña

**POST** `/cliente-auth/forgot-password`

**Request:**
```json
{
  "identificador": "12345678-9"
}
```

**Response (200):**
```json
{
  "message": "Si el identificador está registrado, recibirá instrucciones para restablecer su contraseña"
}
```

---

### 5. Resetear Contraseña

**POST** `/cliente-auth/reset-password`

**Request:**
```json
{
  "token": "abc123def456...",
  "password": "NuevaPassword123!",
  "confirmar_password": "NuevaPassword123!"
}
```

**Response Exitosa (200):**
```json
{
  "message": "Contraseña restablecida exitosamente. Todas las sesiones han sido cerradas"
}
```

---

### 6. Renovar Access Token

**POST** `/cliente-auth/refresh-token`

**Headers:**
```http
Authorization: Bearer <access_token_actual>
```

**Request:**
```json
{
  "refresh_token": "a1b2c3d4e5f6g7h8i9j0..."
}
```

**Response Exitosa (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "nuevo_refresh_token...",
  "token_type": "Bearer",
  "expires_in": 14400
}
```

> **Nota:** El refresh token se rota en cada uso (Token Rotation).

---

### 7. Cerrar Sesión

**POST** `/cliente-auth/logout`

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "message": "Sesión cerrada exitosamente"
}
```

---

### 8. Cerrar Todas las Sesiones

**POST** `/cliente-auth/logout-all`

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "message": "Todas las sesiones han sido cerradas"
}
```

---

### 9. Obtener Perfil

**GET** `/cliente-auth/profile`

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "id_cliente": 1,
  "titular": "Juan Pérez",
  "fecha_nacimiento": "1990-05-15T00:00:00.000Z",
  "dui": "12345678-9",
  "nit": "0614-150590-101-2",
  "empresa_trabajo": "Empresa SA de CV",
  "correo_electronico": "juan@email.com",
  "telefono1": "+50312345678",
  "telefono2": null,
  "estado": "ACTIVO",
  "fecha_creacion": "2024-01-15T10:00:00.000Z",
  "ultimo_login": "2025-12-29T10:30:00.000Z",
  "direcciones": [
    {
      "id_cliente_direccion": 1,
      "direccion": "Col. Escalón, Calle Principal #123",
      "usar_para_instalacion": true,
      "usar_para_facturacion": true,
      "municipio": { "nombre": "San Salvador" },
      "departamento": { "nombre": "San Salvador" }
    }
  ],
  "datosfacturacion": [
    {
      "id_cliente_datos_facturacion": 1,
      "tipo": "PERSONA",
      "nombre_empresa": "Juan Pérez",
      "nit": "0614-150590-101-2",
      "correo_electronico": "juan@email.com"
    }
  ]
}
```

---

### 10. Cambiar Contraseña (Autenticado)

**PATCH** `/cliente-auth/change-password`

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "password_actual": "MiPasswordAnterior123!",
  "password_nuevo": "MiNuevaPassword456!",
  "confirmar_password": "MiNuevaPassword456!"
}
```

**Response (200):**
```json
{
  "message": "Contraseña actualizada exitosamente"
}
```

---

### 11. Listar Sesiones Activas

**GET** `/cliente-auth/sessions`

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "sesiones": [
    {
      "id_sesion": 1,
      "dispositivo": "Chrome en Windows",
      "ip_address": "192.168.1.100",
      "ultima_actividad": "2025-12-29T10:30:00.000Z",
      "fecha_creacion": "2025-12-29T08:00:00.000Z",
      "es_sesion_actual": true
    },
    {
      "id_sesion": 2,
      "dispositivo": "Safari en iOS",
      "ip_address": "192.168.1.101",
      "ultima_actividad": "2025-12-28T15:00:00.000Z",
      "fecha_creacion": "2025-12-28T14:00:00.000Z",
      "es_sesion_actual": false
    }
  ]
}
```

---

### 12. Revocar Sesión Específica

**DELETE** `/cliente-auth/sessions/:sessionId`

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "message": "Sesión revocada exitosamente"
}
```

---

## Manejo de Tokens en Frontend

### Almacenamiento Recomendado

```typescript
// auth-storage.service.ts
class TokenStorageService {
  private readonly ACCESS_TOKEN_KEY = 'cliente_access_token';
  private readonly REFRESH_TOKEN_KEY = 'cliente_refresh_token';
  private readonly EXPIRES_AT_KEY = 'cliente_token_expires_at';

  saveTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
    const expiresAt = Date.now() + (expiresIn * 1000);

    // Usar sessionStorage para mayor seguridad
    sessionStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    sessionStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    sessionStorage.setItem(this.EXPIRES_AT_KEY, expiresAt.toString());
  }

  getAccessToken(): string | null {
    return sessionStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return sessionStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  isTokenExpired(): boolean {
    const expiresAt = sessionStorage.getItem(this.EXPIRES_AT_KEY);
    if (!expiresAt) return true;

    // Considerar expirado 5 minutos antes
    return Date.now() >= (parseInt(expiresAt) - 300000);
  }

  clearTokens(): void {
    sessionStorage.removeItem(this.ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(this.REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(this.EXPIRES_AT_KEY);
  }
}
```

### Interceptor HTTP (Angular)

```typescript
// auth.interceptor.ts
@Injectable()
export class ClienteAuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<any>(null);

  constructor(
    private tokenService: TokenStorageService,
    private authService: ClienteAuthService,
    private router: Router
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // No agregar token a endpoints públicos
    if (this.isPublicEndpoint(request.url)) {
      return next.handle(request);
    }

    // Agregar token si existe
    const token = this.tokenService.getAccessToken();
    if (token) {
      request = this.addToken(request, token);
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && !this.isPublicEndpoint(request.url)) {
          return this.handle401Error(request, next);
        }
        return throwError(() => error);
      })
    );
  }

  private addToken(request: HttpRequest<any>, token: string): HttpRequest<any> {
    return request.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  private isPublicEndpoint(url: string): boolean {
    const publicEndpoints = [
      '/cliente-auth/login',
      '/cliente-auth/solicitar-activacion',
      '/cliente-auth/activar-cuenta',
      '/cliente-auth/forgot-password',
      '/cliente-auth/reset-password'
    ];
    return publicEndpoints.some(endpoint => url.includes(endpoint));
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      const refreshToken = this.tokenService.getRefreshToken();

      if (refreshToken) {
        return this.authService.refreshToken(refreshToken).pipe(
          switchMap((response: any) => {
            this.isRefreshing = false;
            this.tokenService.saveTokens(
              response.access_token,
              response.refresh_token,
              response.expires_in
            );
            this.refreshTokenSubject.next(response.access_token);
            return next.handle(this.addToken(request, response.access_token));
          }),
          catchError((err) => {
            this.isRefreshing = false;
            this.tokenService.clearTokens();
            this.router.navigate(['/auth/login']);
            return throwError(() => err);
          })
        );
      }
    }

    return this.refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(token => next.handle(this.addToken(request, token)))
    );
  }
}
```

---

## Códigos de Error HTTP

| Código | Significado | Acción Recomendada |
|--------|-------------|-------------------|
| 200 | Éxito | Procesar respuesta |
| 400 | Validación fallida | Mostrar mensaje de error |
| 401 | No autenticado | Intentar refresh o ir a login |
| 403 | Cuenta bloqueada/no activada | Mostrar mensaje específico |
| 404 | No encontrado | Mostrar error 404 |
| 429 | Rate limit | Deshabilitar botón temporalmente |
| 500 | Error interno | Mensaje genérico de error |

---

## Validaciones de Contraseña (Regex)

```typescript
// Para validar en frontend antes de enviar
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const validarPassword = (password: string): string[] => {
  const errores: string[] = [];

  if (password.length < 8) {
    errores.push('Debe tener al menos 8 caracteres');
  }
  if (!/[a-z]/.test(password)) {
    errores.push('Debe incluir al menos una letra minúscula');
  }
  if (!/[A-Z]/.test(password)) {
    errores.push('Debe incluir al menos una letra mayúscula');
  }
  if (!/\d/.test(password)) {
    errores.push('Debe incluir al menos un número');
  }
  if (!/[@$!%*?&]/.test(password)) {
    errores.push('Debe incluir al menos un carácter especial (@$!%*?&)');
  }

  return errores;
};
```

---

## Rutas Sugeridas para el Frontend

```typescript
const routes = [
  // Rutas públicas (sin autenticación)
  {
    path: 'auth',
    children: [
      { path: 'login', component: LoginComponent },
      { path: 'solicitar-activacion', component: SolicitarActivacionComponent },
      { path: 'activar-cuenta', component: ActivarCuentaComponent },
      { path: 'forgot-password', component: ForgotPasswordComponent },
      { path: 'reset-password', component: ResetPasswordComponent },
      { path: '', redirectTo: 'login', pathMatch: 'full' }
    ]
  },
  // Rutas protegidas (requieren autenticación)
  {
    path: 'portal',
    canActivate: [ClienteAuthGuard],
    children: [
      { path: 'home', component: HomeComponent },
      { path: 'facturas', component: FacturasComponent },
      { path: 'perfil', component: PerfilComponent },
      { path: 'cambiar-password', component: CambiarPasswordComponent },
      { path: 'sesiones', component: SesionesComponent },
      { path: '', redirectTo: 'home', pathMatch: 'full' }
    ]
  }
];
```

---

## Testing de Endpoints

### Con cURL

```bash
# Login
curl -X POST http://localhost:4000/cliente-auth/login \
  -H "Content-Type: application/json" \
  -d '{"identificador": "12345678-9", "password": "MiPassword123!"}'

# Profile (con token)
curl -X GET http://localhost:4000/cliente-auth/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Logout
curl -X POST http://localhost:4000/cliente-auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Consideraciones de Seguridad

1. **NUNCA** almacenar tokens en `localStorage` (vulnerable a XSS)
2. Usar `sessionStorage` o cookies HttpOnly
3. Implementar refresh token rotation
4. Limpiar tokens al cerrar sesión
5. No exponer información sensible en console.log en producción
6. Validar inputs antes de enviar al servidor
7. Usar HTTPS en producción

---

## Rate Limits

| Endpoint | Límite | Ventana |
|----------|--------|---------|
| `/login` | 5 intentos | 1 minuto |
| `/solicitar-activacion` | 3 intentos | 5 minutos |
| `/activar-cuenta` | 5 intentos | 5 minutos |
| `/forgot-password` | 3 intentos | 5 minutos |
| `/reset-password` | 5 intentos | 5 minutos |
| `/refresh-token` | 10 intentos | 1 minuto |
| `/change-password` | 3 intentos | 5 minutos |

---

## Bloqueo de Cuenta

- **Intentos permitidos:** 5 intentos de login fallidos
- **Duración del bloqueo:** 30 minutos
- **Desbloqueo automático:** Sí, después de 30 minutos
- **Desbloqueo manual:** Mediante reset de contraseña

---

## Tiempos de Expiración

| Token/Item | Expiración |
|------------|------------|
| Access Token | 4 horas |
| Refresh Token | 7 días |
| Token de Activación | 24 horas |
| Token de Reset Password | 30 minutos |

---

## Contacto

Para reportar problemas o solicitar cambios en la API, contactar al equipo de backend.
