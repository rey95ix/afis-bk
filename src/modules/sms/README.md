# Módulo de SMS - Integración con Twilio

Este módulo proporciona funcionalidades para enviar notificaciones SMS a clientes utilizando el servicio de Twilio.

## Tabla de Contenidos

- [Características](#características)
- [Configuración](#configuración)
- [Uso](#uso)
- [API Endpoints](#api-endpoints)
- [Ejemplos de Integración](#ejemplos-de-integración)
- [Tipos de Mensajes](#tipos-de-mensajes)
- [Historial y Auditoría](#historial-y-auditoría)
- [Costos](#costos)

## Características

✅ **Integración con Twilio** - API confiable para envío de SMS
✅ **Historial Completo** - Registro de todos los SMS enviados en base de datos
✅ **Plantillas Predefinidas** - Métodos específicos para cada tipo de notificación
✅ **Validación de Números** - Normalización automática a formato +503XXXXXXXX
✅ **Manejo de Errores** - Registro de fallos y reintentos
✅ **Auditoría** - Integración con sistema de logs
✅ **Referencias Cruzadas** - Vinculación con clientes, órdenes y tickets
✅ **Consulta de Estado** - Verificación de entrega con Twilio

## Configuración

### 1. Crear Cuenta en Twilio

1. Visita [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Crea una cuenta gratuita (incluye $15 USD de crédito)
3. Verifica tu correo electrónico y número de teléfono

### 2. Obtener Credenciales

1. Ve al [Console Dashboard](https://console.twilio.com/)
2. Copia tu **Account SID** y **Auth Token**
3. Ve a **Phone Numbers** → **Manage** → **Buy a number**
4. Compra un número o usa el número de prueba

### 3. Configurar Variables de Entorno

Agrega las siguientes variables a tu archivo `.env`:

```bash
# Credenciales de Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=tu_auth_token_aqui
TWILIO_PHONE_NUMBER=+1234567890
```

### 4. Aplicar Migración de Base de Datos

Si aún no has aplicado la migración:

```bash
npx prisma migrate deploy
npx prisma generate
```

## Uso

### Inyectar el Servicio

```typescript
import { SmsService } from '../sms/sms.service';

@Injectable()
export class MiServicio {
  constructor(private readonly smsService: SmsService) {}
}
```

### Enviar SMS Genérico

```typescript
await this.smsService.enviarSms({
  telefono_destino: '+50312345678',
  tipo_mensaje: TipoMensajeSms.GENERAL,
  mensaje: 'Hola, este es un mensaje de prueba',
  id_cliente: 1, // opcional
}, userId);
```

### Usar Plantillas Predefinidas

#### Notificar Factura Generada

```typescript
await this.smsService.enviarNotificacionFactura(
  '+50312345678',
  'FAC-2025-00123',
  125.50,
  'Juan Pérez',
  1, // id_cliente
  userId
);
```

#### Notificar Técnico en Camino

```typescript
await this.smsService.enviarNotificacionTecnicoEnCamino(
  '+50312345678',
  'Carlos López',
  'OT-202501-00005',
  '30 minutos',
  1, // id_cliente
  5, // id_orden_trabajo
  userId
);
```

#### Notificar Orden Asignada

```typescript
await this.smsService.enviarNotificacionOrdenAsignada(
  '+50312345678',
  'María González',
  'OT-202501-00005',
  'Carlos López',
  1, // id_cliente
  5, // id_orden_trabajo
  userId
);
```

#### Notificar Orden Agendada

```typescript
await this.smsService.enviarNotificacionOrdenAgendada(
  '+50312345678',
  'María González',
  'OT-202501-00005',
  '15 de Enero, 2025',
  '08:00 AM',
  '12:00 PM',
  1, // id_cliente
  5, // id_orden_trabajo
  userId
);
```

#### Notificar Orden Completada

```typescript
await this.smsService.enviarNotificacionOrdenCompletada(
  '+50312345678',
  'María González',
  'OT-202501-00005',
  1, // id_cliente
  5, // id_orden_trabajo
  userId
);
```

#### Notificar Ticket Creado

```typescript
await this.smsService.enviarNotificacionTicketCreado(
  '+50312345678',
  'María González',
  123, // número de ticket
  1, // id_cliente
  123, // id_ticket
  userId
);
```

## API Endpoints

### POST `/api/sms` - Enviar SMS

Envía un SMS personalizado.

**Body:**
```json
{
  "telefono_destino": "+50312345678",
  "tipo_mensaje": "GENERAL",
  "mensaje": "Tu mensaje aquí",
  "id_cliente": 1,
  "id_orden_trabajo": 5,
  "referencia_adicional": "FAC-2025-00123"
}
```

**Response:**
```json
{
  "success": true,
  "id_sms": 1,
  "twilio_sid": "SM1234567890abcdef",
  "estado": "ENVIADO",
  "mensaje": "SMS enviado exitosamente"
}
```

### GET `/api/sms` - Consultar Historial

Obtiene el historial de SMS con filtros opcionales.

**Query Params:**
- `id_cliente` - Filtrar por cliente
- `estado` - Filtrar por estado (PENDIENTE, ENVIADO, ENTREGADO, FALLIDO, EN_COLA)
- `tipo_mensaje` - Filtrar por tipo
- `telefono_destino` - Filtrar por teléfono
- `fecha_desde` - Fecha inicial (ISO 8601)
- `fecha_hasta` - Fecha final (ISO 8601)
- `page` - Número de página (default: 1)
- `limit` - Límite por página (default: 10)

**Response:**
```json
{
  "data": [
    {
      "id_sms": 1,
      "telefono_destino": "+50312345678",
      "tipo_mensaje": "TECNICO_EN_CAMINO",
      "mensaje": "Nuestro técnico está en camino...",
      "estado": "ENVIADO",
      "twilio_sid": "SM1234567890abcdef",
      "fecha_creacion": "2025-01-11T10:30:00Z",
      "fecha_envio": "2025-01-11T10:30:05Z",
      "cliente": {
        "id_cliente": 1,
        "titular": "María González"
      }
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 10,
    "totalPages": 15
  }
}
```

### GET `/api/sms/:id` - Detalle de SMS

Obtiene información detallada de un SMS específico.

### POST `/api/sms/:id/reenviar` - Reenviar SMS Fallido

Reintenta el envío de un SMS que falló.

### GET `/api/sms/twilio/estado/:sid` - Consultar Estado en Twilio

Consulta el estado actual de un mensaje directamente en Twilio.

### POST `/api/sms/notificaciones/*` - Endpoints de Conveniencia

Endpoints específicos para cada tipo de notificación:

- `/api/sms/notificaciones/factura`
- `/api/sms/notificaciones/tecnico-en-camino`
- `/api/sms/notificaciones/orden-asignada`
- `/api/sms/notificaciones/orden-agendada`
- `/api/sms/notificaciones/orden-completada`
- `/api/sms/notificaciones/ticket-creado`

## Ejemplos de Integración

### Desde el Servicio de Órdenes de Trabajo

```typescript
// ordenes-trabajo.service.ts

import { SmsService } from '../sms/sms.service';

@Injectable()
export class OrdenesTrabajoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly smsService: SmsService, // Inyectar servicio
  ) {}

  async asignarTecnico(idOrden: number, idTecnico: number, userId: number) {
    // ... lógica de asignación ...

    // Enviar notificación SMS al cliente
    const orden = await this.prisma.orden_trabajo.findUnique({
      where: { id_orden: idOrden },
      include: {
        cliente: true,
        tecnico_asignado: true,
      },
    });

    if (orden.cliente.telefono1) {
      try {
        await this.smsService.enviarNotificacionOrdenAsignada(
          orden.cliente.telefono1,
          orden.cliente.titular,
          orden.codigo,
          `${orden.tecnico_asignado.nombres} ${orden.tecnico_asignado.apellidos}`,
          orden.id_cliente,
          orden.id_orden,
          userId,
        );
      } catch (error) {
        // Log error pero no fallar la operación principal
        console.error('Error al enviar SMS:', error);
      }
    }

    return orden;
  }

  async cambiarEstadoEnRuta(idOrden: number, userId: number) {
    // ... cambiar estado a EN_RUTA ...

    // Notificar al cliente que el técnico va en camino
    const orden = await this.prisma.orden_trabajo.findUnique({
      where: { id_orden: idOrden },
      include: {
        cliente: true,
        tecnico_asignado: true,
      },
    });

    if (orden.cliente.telefono1) {
      await this.smsService.enviarNotificacionTecnicoEnCamino(
        orden.cliente.telefono1,
        `${orden.tecnico_asignado.nombres} ${orden.tecnico_asignado.apellidos}`,
        orden.codigo,
        '30 minutos', // Calcular ETA según ubicación
        orden.id_cliente,
        orden.id_orden,
        userId,
      );
    }

    return orden;
  }
}
```

### Desde el Módulo de Facturación

```typescript
// facturacion.service.ts

async generarFactura(facturaData: CreateFacturaDto, userId: number) {
  // ... generar factura ...

  const factura = await this.prisma.factura.create({ ... });

  // Enviar notificación SMS
  const cliente = await this.prisma.cliente.findUnique({
    where: { id_cliente: factura.id_cliente },
  });

  if (cliente.telefono1) {
    await this.smsService.enviarNotificacionFactura(
      cliente.telefono1,
      factura.numero_factura,
      factura.total,
      cliente.titular,
      cliente.id_cliente,
      userId,
    );
  }

  return factura;
}
```

## Tipos de Mensajes

El módulo soporta los siguientes tipos de mensajes:

| Tipo | Descripción | Ejemplo de Uso |
|------|-------------|----------------|
| `NOTIFICACION_FACTURA` | Factura generada | "Tu factura #12345 ha sido generada. Total: $45.50" |
| `TECNICO_EN_CAMINO` | Técnico en ruta | "Nuestro técnico Carlos está en camino. ETA: 30 min" |
| `ORDEN_TRABAJO_ASIGNADA` | Orden asignada | "Tu orden OT-202501-00005 ha sido asignada" |
| `ORDEN_TRABAJO_AGENDADA` | Visita agendada | "Tu visita está agendada para el 15/01/2025" |
| `ORDEN_TRABAJO_COMPLETADA` | Trabajo completado | "Tu orden OT-202501-00005 ha sido completada" |
| `TICKET_CREADO` | Ticket abierto | "Tu ticket #123 ha sido creado exitosamente" |
| `TICKET_ACTUALIZADO` | Ticket actualizado | "Tu ticket #123 ha sido actualizado" |
| `CAMBIO_ESTADO_SERVICIO` | Estado de servicio | "Tu servicio ha sido activado/suspendido" |
| `RECORDATORIO_PAGO` | Recordatorio | "Recordatorio: tienes un pago pendiente" |
| `PROMOCION` | Promocional | "¡Oferta especial! 20% de descuento" |
| `GENERAL` | Mensaje genérico | Cualquier mensaje personalizado |

## Historial y Auditoría

Cada SMS enviado se registra en la tabla `sms_historial` con:

- **Información del Destinatario:** Teléfono, cliente
- **Contenido:** Tipo de mensaje, texto completo
- **Referencias:** Orden de trabajo, ticket, factura
- **Estado de Envío:** PENDIENTE → ENVIADO → ENTREGADO / FALLIDO
- **Datos de Twilio:** SID, status, errores
- **Costos:** Precio y moneda
- **Auditoría:** Usuario que envió, intentos, timestamps

## Formato de Números de Teléfono

El módulo normaliza automáticamente los números de teléfono al formato de El Salvador:

- **Formato requerido:** `+503XXXXXXXX` (8 dígitos)
- **Ejemplos válidos:**
  - `+50312345678` ✅
  - `50312345678` ✅ (se agrega + automáticamente)
  - `12345678` ✅ (se agrega +503 automáticamente)
- **Ejemplos inválidos:**
  - `12345` ❌ (menos de 8 dígitos)
  - `+50412345678` ❌ (código de país incorrecto)

## Costos

Los costos aproximados de Twilio para El Salvador son:

- **Precio por SMS:** ~$0.0075 USD
- **Cuenta de prueba:** $15 USD de crédito gratuito
- **Límites de prueba:** Solo puedes enviar a números verificados
- **Producción:** Requiere cuenta de pago sin límites

**Ejemplo de costos mensuales:**

| Volumen Mensual | Costo Aproximado |
|-----------------|------------------|
| 100 SMS | $0.75 USD |
| 500 SMS | $3.75 USD |
| 1,000 SMS | $7.50 USD |
| 5,000 SMS | $37.50 USD |
| 10,000 SMS | $75.00 USD |

## Troubleshooting

### Error: "Servicio SMS no disponible"

**Causa:** Credenciales de Twilio no configuradas en `.env`

**Solución:** Verifica que las variables `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` y `TWILIO_PHONE_NUMBER` estén correctamente configuradas.

### Error: "Número de teléfono inválido"

**Causa:** Formato incorrecto del número de teléfono

**Solución:** Asegúrate de usar formato `+503XXXXXXXX` para El Salvador.

### SMS no se entrega

**Causa:** Puede ser por varios motivos (número inválido, sin crédito, número bloqueado)

**Solución:**
1. Consulta el estado en Twilio: `GET /api/sms/twilio/estado/:sid`
2. Revisa el historial de SMS: `GET /api/sms`
3. Verifica errores en `twilio_error_code` y `twilio_error_message`

### Error: "Client with ID X not found"

**Causa:** ID de cliente, orden o ticket no existe

**Solución:** Verifica que las referencias existan antes de enviar el SMS.

## Seguridad

⚠️ **IMPORTANTE:**

- Nunca expongas tus credenciales de Twilio en el código fuente
- Usa variables de entorno (`.env`) para almacenar credenciales
- No compartas tu Auth Token
- Rota tus credenciales periódicamente
- Usa HTTPS en producción

## Soporte

Para más información sobre Twilio:
- [Documentación oficial de Twilio](https://www.twilio.com/docs)
- [API Reference](https://www.twilio.com/docs/sms/api)
- [Pricing](https://www.twilio.com/pricing/messaging)
- [Console Dashboard](https://console.twilio.com/)

---

**Desarrollado para:** AFIS - Sistema ERP
**Fecha:** Enero 2025
**Versión:** 1.0.0
