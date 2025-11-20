# Mail Module

## Propósito
Servicio de envío de emails para el sistema AFIS. Maneja el envío de correos transaccionales como reset de contraseñas, notificaciones, y otros emails del sistema.

## Estructura

```
mail/
├── mail.module.ts
└── mail.service.ts
```

## Tecnología
- **Librería**: Nodemailer
- **Protocolo**: SMTP
- **Templates**: HTML con estilos inline

## Configuración (.env)

```env
SMTP_HOST=smtp.gmail.com           # Servidor SMTP
SMTP_PORT=587                      # Puerto SMTP (587 para TLS, 465 para SSL)
SMTP_SECURE=false                  # true para SSL, false para TLS
SMTP_USER=your-email@example.com   # Usuario SMTP
SMTP_PASS=your-password            # Contraseña SMTP
SMTP_FROM=noreply@ixc.com          # Email remitente
FRONTEND_URL=http://localhost:3000 # URL del frontend (para links)
```

## Servicio Principal

### MailService

#### Métodos Públicos

##### `sendPasswordResetEmail(to: string, resetToken: string, userName: string)`

Envía email de recuperación de contraseña.

**Parámetros:**
- `to`: Email del destinatario
- `resetToken`: Token único de reset (UUID)
- `userName`: Nombre del usuario

**Funcionalidad:**
1. Construye URL de reset: `${FRONTEND_URL}/reset-password?token=${resetToken}`
2. Lee template HTML desde `/templates/auth/reset-password.html`
3. Reemplaza variables en template:
   - `{{userName}}` - Nombre del usuario
   - `{{resetLink}}` - URL completa de reset
4. Envía email usando Nodemailer
5. Retorna confirmación o error

**Template:**
```html
<!-- /templates/auth/reset-password.html -->
<html>
  <body>
    <h1>Hola {{userName}}</h1>
    <p>Has solicitado restablecer tu contraseña.</p>
    <p>Haz clic en el siguiente enlace para continuar:</p>
    <a href="{{resetLink}}">Restablecer contraseña</a>
    <p>Este enlace expira en 30 minutos.</p>
  </body>
</html>
```

**Errores comunes:**
- SMTP auth failed: Verificar credenciales
- Template not found: Verificar ruta del template
- Connection refused: Verificar host y puerto SMTP

#### Métodos Privados/Internos

##### `createTransporter()`
Crea y configura el transporter de Nodemailer con configuración SMTP.

##### `loadTemplate(templateName: string)`
Carga template HTML desde directorio `/templates/`.

## Uso en Otros Módulos

### Importación
```typescript
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  // ...
})
export class AuthModule {}
```

### Inyección
```typescript
import { MailService } from '../mail/mail.service';

constructor(private readonly mailService: MailService) {}
```

### Llamada
```typescript
await this.mailService.sendPasswordResetEmail(
  user.email,
  resetToken,
  user.nombres
);
```

## Templates

### Ubicación
Todos los templates de email están en: `/templates/` (raíz del proyecto, NO en `src/`)

### Estructura
```
templates/
└── auth/
    └── reset-password.html
```

### Variables de Template

Usar sintaxis de doble llave:
- `{{variable}}` - Reemplazado en tiempo de ejecución

### Estilos
- Usar estilos inline para compatibilidad con clientes de email
- Evitar CSS externo
- Usar tablas HTML para layouts

## Expandiendo el Módulo

### Agregar Nuevo Tipo de Email

1. **Crear template HTML** en `/templates/`
2. **Agregar método en MailService**:
   ```typescript
   async sendWelcomeEmail(to: string, userName: string) {
     const templatePath = path.join(process.cwd(), 'templates/auth/welcome.html');
     const html = fs.readFileSync(templatePath, 'utf-8')
       .replace('{{userName}}', userName);

     await this.transporter.sendMail({
       from: this.configService.get('SMTP_FROM'),
       to,
       subject: 'Bienvenido a AFIS',
       html
     });
   }
   ```
3. **Llamar desde módulo correspondiente**

## Mejores Prácticas

1. **Async/Await**: Todos los envíos son asíncronos
2. **Error Handling**: Siempre usar try/catch al enviar emails
3. **Templates**: Mantener templates separados del código
4. **Variables de entorno**: Nunca hardcodear credenciales SMTP
5. **Testing**: Usar servicios como Mailtrap para desarrollo
6. **HTML válido**: Validar HTML de templates para compatibilidad

## Proveedores SMTP Comunes

### Gmail
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
# Nota: Requiere "App Password" si 2FA está habilitado
```

### Outlook/Office 365
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
```

### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

### Mailtrap (Testing)
```env
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=your-mailtrap-user
SMTP_PASS=your-mailtrap-pass
```

## Dependencias

### NPM Packages
- `nodemailer` - Cliente SMTP
- `@nestjs/config` - Configuración de entorno

### Módulos Internos
- Ninguno (es un módulo de utilidad usado por otros)

## Troubleshooting

### Error: "Invalid login"
- Verificar SMTP_USER y SMTP_PASS
- Para Gmail: usar App Password
- Verificar que cuenta permita "Less secure apps"

### Error: "Connection timeout"
- Verificar SMTP_HOST y SMTP_PORT
- Verificar firewall/red
- Probar con puerto alternativo (465 vs 587)

### Emails no llegan
- Revisar carpeta de SPAM
- Verificar SMTP_FROM es válido
- Verificar logs del servidor SMTP

### Template no carga
- Verificar ruta: usar `process.cwd()` no `__dirname`
- Templates deben estar en `/templates/` (raíz)
- Verificar permisos de lectura

## Módulos que Usan Mail

| Módulo | Uso |
|--------|-----|
| `auth` | Password reset emails |

## Notas de Implementación

1. **Rutas de Templates**: Siempre usar `path.join(process.cwd(), 'templates/...')` para rutas absolutas
2. **Reemplazo de Variables**: Usar `.replace()` simple o librería de templates si se vuelve complejo
3. **Email Async**: Nunca bloquear la respuesta HTTP esperando el email, considerar queue para producción
4. **Rate Limiting**: Implementar rate limiting para prevenir spam si se exponen endpoints públicos
5. **Logging**: Registrar intentos de envío para debugging (sin incluir contenido sensible)
