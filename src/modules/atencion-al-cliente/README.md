# Atención al Cliente Module

## Propósito
Gestiona operaciones de atención al cliente: registro de clientes, tickets de soporte, órdenes de trabajo para técnicos, agendamiento de visitas, y catálogos de diagnóstico/solución.

## Estructura del Módulo

```
atencion-al-cliente/
├── clientes/                      # Gestión de clientes
│   ├── cliente-direcciones/       # Direcciones de clientes
│   ├── cliente-datos-facturacion/ # Datos de facturación
│   └── cliente-documentos/        # Documentos de clientes
├── tickets/                       # Tickets de soporte
├── ordenes-trabajo/               # Órdenes de trabajo (OT)
├── agenda/                        # Agendamiento de visitas
├── catalogos/                     # Catálogos de diagnóstico/solución
└── reportes/                      # Reportes del módulo
```

---

## 1. CLIENTES

### Archivos
- `clientes/clientes.controller.ts`
- `clientes/clientes.service.ts`
- `cliente-direcciones.controller.ts`
- `cliente-datos-facturacion.controller.ts`
- `cliente-documentos.controller.ts`

### Endpoints Principales

#### Clientes
| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/atencion-al-cliente/clientes` | Listar clientes (paginado) | Sí |
| GET | `/atencion-al-cliente/clientes/:id` | Obtener cliente por ID | Sí |
| GET | `/atencion-al-cliente/clientes/buscar/dui/:dui` | Buscar por DUI | Sí |
| POST | `/atencion-al-cliente/clientes` | Crear cliente | Sí |
| PUT | `/atencion-al-cliente/clientes/:id` | Actualizar cliente | Sí |
| DELETE | `/atencion-al-cliente/clientes/:id` | Eliminar cliente (soft delete) | Sí |

#### Direcciones
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/clientes/:id_cliente/direcciones` | Listar direcciones del cliente |
| POST | `/clientes/:id_cliente/direcciones` | Agregar dirección |
| PUT | `/clientes/:id_cliente/direcciones/:id` | Actualizar dirección |
| DELETE | `/clientes/:id_cliente/direcciones/:id` | Eliminar dirección |

#### Datos de Facturación
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/clientes/:id_cliente/datos-facturacion` | Obtener datos de facturación |
| POST | `/clientes/:id_cliente/datos-facturacion` | Crear datos de facturación |
| PUT | `/clientes/:id_cliente/datos-facturacion/:id` | Actualizar datos |

#### Documentos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/clientes/:id_cliente/documentos` | Listar documentos |
| POST | `/clientes/:id_cliente/documentos` | Subir documento (multipart) |
| DELETE | `/clientes/:id_cliente/documentos/:id` | Eliminar documento |

### DTOs

#### CreateClienteDto
```typescript
{
  titular: string;                  // Nombre del titular
  dui?: string;                     // Documento único de identidad
  nit?: string;                     // Número de identificación tributaria
  correo_electronico?: string;
  telefono1: string;                // Teléfono principal (requerido)
  telefono2?: string;               // Teléfono secundario
  tipo_cliente?: string;            // RESIDENCIAL/EMPRESARIAL
  fecha_nacimiento?: Date;
  estado?: Estado;                  // Default: ACTIVO
}
```

#### CreateClienteDireccionDto
```typescript
{
  tipo_direccion: string;           // SERVICIO/FACTURACION/CONTACTO
  id_departamento: number;
  id_municipio: number;
  id_colonia?: number;
  direccion_detalle: string;
  referencia?: string;
  coordenadas_gps?: string;
  es_principal: boolean;
}
```

### Funcionalidades Clave

- **Búsqueda por DUI**: Endpoint dedicado para búsqueda rápida
- **Múltiples direcciones**: Un cliente puede tener varias direcciones (servicio, facturación, etc.)
- **Documentos**: Almacenamiento en MinIO de documentos del cliente (DUI, NIT, contratos, etc.)
- **Datos de facturación**: NRC, giro, nombre comercial para facturación electrónica

### Tablas
- `cliente`
- `cliente_direcciones`
- `cliente_datos_facturacion`
- `cliente_documentos`

---

## 2. TICKETS DE SOPORTE

### Archivos
- `tickets/tickets.controller.ts`
- `tickets/tickets.service.ts`

### Endpoints

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/api/tickets` | Listar tickets (filtros múltiples) | Sí |
| GET | `/api/tickets/:id` | Obtener ticket con detalles | Sí |
| POST | `/api/tickets` | Crear nuevo ticket | Sí |
| PUT | `/api/tickets/:id` | Actualizar ticket | Sí |
| POST | `/api/tickets/:id/escalar` | Escalar a orden de trabajo | Sí |

### DTOs

#### CreateTicketDto
```typescript
{
  id_cliente: number;
  canal: CanalContacto;             // TELEFONO/WHATSAPP/EMAIL/APP/WEB
  descripcion_problema: string;
  severidad: SeveridadTicket;       // BAJA/MEDIA/ALTA/CRITICA
  id_direccion_servicio: number;    // Dirección del servicio afectado
  diagnostico_inicial?: string;
  id_diagnostico_catalogo?: number;
  pruebas_remotas?: string;         // JSON con resultados de pruebas
  requiere_visita: boolean;
}
```

#### UpdateTicketDto
```typescript
{
  // Todos los campos opcionales
  estado?: EstadoTicket;
  diagnostico_inicial?: string;
  id_diagnostico_catalogo?: number;
  notas_internas?: string;
}
```

#### EscalarTicketDto
```typescript
{
  tipo: TipoOrdenTrabajo;           // INSTALACION/REPARACION/MANTENIMIENTO/etc
  id_tecnico_asignado?: number;
  observaciones?: string;
}
```

#### QueryTicketDto (filtros)
```typescript
{
  page?: number;
  limit?: number;
  estado?: EstadoTicket;
  id_cliente?: number;
  severidad?: SeveridadTicket;
  fecha_desde?: Date;
  fecha_hasta?: Date;
}
```

### Estados del Ticket (Máquina de Estados)

```
ABIERTO
  ↓
EN_DIAGNOSTICO
  ↓
ESCALADO (→ se crea Orden de Trabajo)
  ↓
CERRADO / CANCELADO
```

### Severidades

- `BAJA` - Problema menor, no afecta servicio
- `MEDIA` - Afecta calidad del servicio
- `ALTA` - Servicio degradado significativamente
- `CRITICA` - Sin servicio, requiere atención inmediata

### Canales de Contacto

- `TELEFONO` - Llamada telefónica
- `WHATSAPP` - Mensaje de WhatsApp
- `EMAIL` - Correo electrónico
- `APP` - Aplicación móvil del cliente
- `WEB` - Portal web

### Funcionalidades Clave

#### Escalamiento a Orden de Trabajo
Cuando un ticket requiere visita técnica:
1. Se marca el ticket como `ESCALADO`
2. Se crea automáticamente una Orden de Trabajo (OT)
3. La OT queda vinculada al ticket original
4. Se puede asignar técnico directamente o dejarlo pendiente

#### Diagnóstico Remoto
- Campo `pruebas_remotas` almacena JSON con resultados
- Catálogo de diagnósticos predefinidos
- Permite documentar troubleshooting antes de visita

### Tablas
- `ticket_soporte`

### Relaciones
- `cliente` - Cliente que reporta
- `cliente_direcciones` - Dirección del servicio
- `diagnostico_catalogo` - Catálogo de diagnósticos
- `orden_trabajo` - OT generada (si se escaló)

---

## 3. ÓRDENES DE TRABAJO (OT)

### Archivos
- `ordenes-trabajo/ordenes-trabajo.controller.ts`
- `ordenes-trabajo/ordenes-trabajo.service.ts`

### Endpoints Principales

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/api/ordenes` | Listar órdenes (filtros) | Sí |
| GET | `/api/ordenes/:id` | Obtener orden con todos los detalles | Sí |
| POST | `/api/ordenes` | Crear orden de trabajo | Sí |
| PUT | `/api/ordenes/:id` | Actualizar orden | Sí |
| POST | `/api/ordenes/:id/asignar` | Asignar técnico | Sí |
| POST | `/api/ordenes/:id/agendar` | Agendar visita | Sí |
| POST | `/api/ordenes/:id/reprogramar` | Reprogramar visita | Sí |
| POST | `/api/ordenes/:id/cambiar-estado` | Cambiar estado manualmente | Sí |
| POST | `/api/ordenes/:id/iniciar` | Iniciar trabajo (técnico) | Sí |
| POST | `/api/ordenes/:id/cerrar` | Cerrar orden | Sí |
| POST | `/api/ordenes/:id/actividades` | Agregar actividad realizada | Sí |
| PUT | `/api/ordenes/:id/actividades/:idActividad` | Actualizar actividad | Sí |
| POST | `/api/ordenes/:id/materiales` | Agregar material usado | Sí |
| DELETE | `/api/ordenes/:id/materiales/:idMaterial` | Quitar material | Sí |
| POST | `/api/ordenes/:id/evidencias` | Subir evidencia (foto/video/etc) | Sí |
| GET | `/api/ordenes/:id/evidencias` | Listar evidencias | Sí |

### DTOs

#### CreateOrdenDto
```typescript
{
  tipo: TipoOrdenTrabajo;          // INSTALACION/REPARACION/MANTENIMIENTO/etc
  id_cliente: number;
  id_direccion_servicio: number;
  id_ticket?: number;              // Si viene de escalamiento de ticket
  id_tecnico_asignado?: number;
  observaciones_tecnico?: string;
  prioridad?: string;              // BAJA/MEDIA/ALTA/URGENTE
}
```

#### AsignarOrdenDto
```typescript
{
  id_tecnico_asignado: number;
  observaciones?: string;
}
```

#### AgendarOrdenDto
```typescript
{
  fecha_inicio: Date;              // Inicio de ventana
  fecha_fin: Date;                 // Fin de ventana
  observaciones?: string;
}
```

#### ReprogramarOrdenDto
```typescript
{
  fecha_inicio: Date;
  fecha_fin: Date;
  motivo_reprogramacion: string;
}
```

#### IniciarOrdenDto
```typescript
{
  fecha_llegada?: Date;
  fecha_inicio: Date;
  observaciones?: string;
}
```

#### CerrarOrdenDto
```typescript
{
  resultado: ResultadoOrden;       // RESUELTO/NO_RESUELTO
  notas_cierre: string;
  id_motivo_cierre?: number;       // Catálogo de motivos
  calificacion_cliente?: number;   // 1-5 estrellas
  archivos?: Express.Multer.File[]; // Documentos adjuntos
}
```

#### CreateActividadDto
```typescript
{
  descripcion: string;
  id_solucion_catalogo?: number;
  valores_medidos_json?: string;   // Ej: {"potencia": -25, "atenuacion": 3}
}
```

#### CreateMaterialDto
```typescript
{
  sku: string;
  nombre: string;
  cantidad: number;
  serie?: string;                  // Si el material tiene número de serie
  costo_unitario?: number;
}
```

#### CreateEvidenciaDto
```typescript
{
  tipo: TipoEvidencia;             // FOTO/VIDEO/SPEEDTEST/FIRMA/AUDIO
  url: string;                     // URL del archivo en MinIO
  metadata_json?: string;          // Metadata adicional
}
```

### Estados de la Orden (Máquina de Estados)

```
PENDIENTE_ASIGNACION
  ↓
ASIGNADA (técnico asignado)
  ↓
AGENDADA (fecha/hora programada)
  ↓
EN_RUTA (técnico en camino)
  ↓
EN_PROGRESO (técnico trabajando)
  ↓
COMPLETADA / CANCELADA / REPROGRAMADA
```

### Tipos de Orden

- `INSTALACION` - Instalación de nuevo servicio
- `REPARACION` - Reparación de falla
- `MANTENIMIENTO` - Mantenimiento preventivo
- `RETIRO` - Retiro de equipo
- `CAMBIO_EQUIPO` - Cambio de equipo
- `REUBICACION` - Reubicación de servicio
- `UPGRADE` - Mejora de servicio

### Código de Orden Auto-generado

Formato: `OT-YYYYMM-#####`

Ejemplo: `OT-202501-00001`

- `OT` - Prefijo fijo
- `YYYYMM` - Año y mes
- `#####` - Secuencial del mes (5 dígitos)

### Funcionalidades Clave

#### Ciclo de Vida Completo
1. **Creación**: Manual o automática (desde ticket escalado)
2. **Asignación**: Se asigna técnico
3. **Agendamiento**: Se programa visita en agenda
4. **Ejecución**:
   - Técnico marca inicio
   - Registra actividades realizadas
   - Agrega materiales usados
   - Sube evidencias (fotos, videos, speedtests)
5. **Cierre**:
   - Resultado (resuelto/no resuelto)
   - Calificación del cliente
   - Documentos finales

#### Tracking de Materiales
- Registro de materiales usados en la orden
- Soporte para materiales con serie (ONUs, routers)
- Vinculación con inventario
- Costeo de materiales

#### Evidencias
Tipos de evidencia soportados:
- **FOTO**: Fotos del sitio, equipo, instalación
- **VIDEO**: Videos de prueba, instalación
- **SPEEDTEST**: Capturas de pruebas de velocidad
- **FIRMA**: Firma digital del cliente
- **AUDIO**: Grabaciones de audio (si aplica)

Almacenamiento: MinIO

Límites:
- Imágenes: JPG, PNG, GIF
- Videos: MP4, máximo 10MB
- PDFs para documentos

#### Actividades
- Log detallado de todas las actividades realizadas
- Vinculación con catálogo de soluciones
- Valores medidos (potencia óptica, señal, velocidad, etc.)
- Timestamping automático

#### Historial de Estados
Tabla `ot_historial_estado` mantiene registro completo de:
- Todos los cambios de estado
- Usuario que realizó el cambio
- Timestamp
- Observaciones

### Tablas
- `orden_trabajo` - Orden principal
- `ot_actividades` - Actividades realizadas
- `ot_materiales` - Materiales usados
- `ot_evidencias` - Evidencias multimedia
- `ot_historial_estado` - Historial de cambios de estado

### Relaciones
- `cliente` - Cliente del servicio
- `cliente_direcciones` - Dirección de servicio
- `ticket_soporte` - Ticket origen (si aplica)
- `usuarios` - Técnico asignado
- `agenda` - Cita agendada
- `solucion_catalogo` - Soluciones aplicadas
- `motivo_cierre_catalogo` - Motivo de cierre

---

## 4. AGENDA

### Archivos
- `agenda/agenda.controller.ts`
- `agenda/agenda.service.ts`

### Propósito
Gestiona el agendamiento de visitas técnicas asociadas a órdenes de trabajo.

### Funcionalidades
- Programación de citas con ventanas de tiempo
- Vinculación con órdenes de trabajo
- Reprogramación de citas
- Filtrado por técnico, fecha, sucursal

### Campos Clave
```typescript
{
  id_orden_trabajo: number;
  id_tecnico: number;
  fecha_inicio: Date;          // Inicio de ventana
  fecha_fin: Date;             // Fin de ventana
  estado: EstadoAgenda;        // PROGRAMADA/COMPLETADA/CANCELADA/REPROGRAMADA
  motivo_reprogramacion?: string;
}
```

### Tabla
- `agenda`

---

## 5. CATÁLOGOS

### Archivos
- `catalogos/catalogos.controller.ts`
- `catalogos/catalogos.service.ts`

### Propósito
Gestiona catálogos predefinidos para estandarizar diagnósticos, soluciones y motivos de cierre.

### Tipos de Catálogos

#### Diagnóstico
- Problemas comunes identificados
- Síntomas reportados
- Causas probables
Tabla: `diagnostico_catalogo`

#### Solución
- Acciones correctivas aplicadas
- Procedimientos ejecutados
- Configuraciones realizadas
Tabla: `solucion_catalogo`

#### Motivos de Cierre
- Razones de cierre de orden
- Clasificación de resultados
- Causas de no resolución
Tabla: `motivo_cierre_catalogo`

### Uso
- Estandarización de terminología
- Reportes y estadísticas
- Análisis de problemas recurrentes
- KPIs de resolución

---

## 6. REPORTES

### Archivos
- `reportes/reportes.controller.ts`
- `reportes/reportes.service.ts`

### Propósito
Generación de reportes del módulo de atención al cliente.

### Tipos de Reportes
- Tickets por período
- Órdenes de trabajo por técnico
- Tiempo promedio de resolución
- Satisfacción del cliente
- Materiales más usados
- Problemas recurrentes

---

## Reglas de Negocio Importantes

### Workflow Ticket → Orden de Trabajo

1. Ticket reportado por cliente
2. Diagnóstico remoto
3. Si requiere visita → Escalar a OT
4. OT se crea automáticamente vinculada al ticket
5. Ticket queda en estado `ESCALADO`
6. OT sigue su propio ciclo de vida
7. Al cerrar OT, se puede cerrar ticket relacionado

### Validaciones

- Cliente debe existir y estar ACTIVO
- Dirección de servicio debe pertenecer al cliente
- Técnico asignado debe ser usuario ACTIVO
- No se puede cerrar OT sin haber iniciado
- Reprogramación requiere motivo válido
- Materiales con serie deben existir en inventario

### Restricciones de Estado

- Solo se puede asignar técnico en estados `PENDIENTE_ASIGNACION` o `ASIGNADA`
- Solo se puede agendar si tiene técnico asignado
- Solo técnico asignado puede iniciar la orden
- Solo se pueden agregar actividades/materiales en estado `EN_PROGRESO`
- Solo se puede cerrar desde estado `EN_PROGRESO`

---

## Dependencias de Módulos

- `PrismaModule` - Base de datos
- `AuthModule` - Autenticación
- `MinioModule` - Almacenamiento de archivos
- `AdministracionModule` - Datos geográficos, usuarios

---

## Notas de Implementación

1. **Códigos de OT**: Se generan automáticamente en formato `OT-YYYYMM-#####`
2. **Evidencias**: Subir a MinIO antes de crear registro en base de datos
3. **Materiales con Serie**: Validar disponibilidad en inventario antes de agregar
4. **Estados**: Usar transiciones válidas según máquina de estados
5. **Reprogramaciones**: Registrar en historial cada reprogramación
6. **Calificaciones**: Opcional al cerrar, escala 1-5
7. **Múltiples Direcciones**: Cliente puede tener varias direcciones, especificar cuál en ticket/OT
