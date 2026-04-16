# Guía de Desarrollo — Módulo OLT/ONT

> **Audiencia**: desarrolladores backend/frontend que van a extender o integrar el módulo OLT.
> **Última actualización**: 2026-04-09
> **Stack**: NestJS + Prisma + PostgreSQL + ssh2 (Huawei MA5680T CLI)

---

## Índice

1. [Propósito del módulo](#1-propósito-del-módulo)
2. [Arquitectura](#2-arquitectura)
3. [Modelo de datos](#3-modelo-de-datos)
4. [Flujo general de una operación](#4-flujo-general-de-una-operación)
5. [Conexión SSH y encriptación](#5-conexión-ssh-y-encriptación)
6. [Catálogo de endpoints](#6-catálogo-de-endpoints)
7. [Flujos end-to-end por caso de uso](#7-flujos-end-to-end-por-caso-de-uso)
8. [Sistema de permisos](#8-sistema-de-permisos)
9. [Auditoría de comandos (`olt_comando`)](#9-auditoría-de-comandos-olt_comando)
10. [Manejo de errores](#10-manejo-de-errores)
11. [Variables de entorno](#11-variables-de-entorno)
12. [Cómo extender el módulo](#12-cómo-extender-el-módulo)
13. [Pruebas y debugging](#13-pruebas-y-debugging)
14. [Deuda técnica conocida](#14-deuda-técnica-conocida)

---

## 1. Propósito del módulo

Gestiona la infraestructura FTTH/GPON de la red del ISP. Permite:

- **Administrar equipos OLT**: alta, baja, consulta, prueba de conexión (CRUD completo de `olt_equipo`).
- **Operar ONTs de clientes** vía SSH contra OLTs Huawei MA5680T:
  - Instalar ONT nuevo (alta de servicio)
  - Suspender / reactivar
  - Reiniciar
  - Cambiar equipo (swap físico)
  - Cambiar plan de tráfico (upgrade/downgrade)
  - Consultar IP WAN asignada
- **Auditar** cada comando ejecutado con su respuesta y estado.
- **Consultar catálogos**: tarjetas, modelos, perfiles de tráfico, slots disponibles.

Reemplaza scripts PHP legacy que usaban Telnet + binarios C++. Aporta: cifrado en tránsito (SSH), credenciales encriptadas en reposo (AES-256-GCM), auditoría, permisos granulares, validación de entrada.

---

## 2. Arquitectura

### Estructura de archivos

```
afis-bk/src/modules/olt/
├── dto/
│   ├── cambiar-equipo.dto.ts
│   ├── cambiar-plan-ont.dto.ts
│   ├── create-olt-equipo.dto.ts      ← CRUD equipos
│   ├── instalar-ont.dto.ts
│   ├── query-olt-equipo.dto.ts       ← CRUD equipos
│   └── update-olt-equipo.dto.ts      ← CRUD equipos
├── interfaces/
│   └── olt-command.interface.ts
├── olt-command-builder.service.ts    ← genera CLI Huawei
├── olt-connection.service.ts         ← SSH + AES-256-GCM
├── olt-equipo.controller.ts          ← CRUD REST de equipos
├── olt-equipo.service.ts             ← lógica CRUD equipos
├── olt.controller.ts                 ← endpoints de operaciones ONT
├── olt.module.ts                     ← wiring NestJS
├── olt.service.ts                    ← orquestación ONT
├── README.md                          ← documentación histórica
└── MODULE_GUIDE.md                    ← (este archivo)
```

### Responsabilidades

| Archivo | Responsabilidad |
|---|---|
| `olt.controller.ts` | Endpoints REST para operaciones sobre ONTs de clientes (`/olt/clientes/...`, `/olt/tarjetas`, etc.) |
| `olt-equipo.controller.ts` | Endpoints REST CRUD de equipos OLT (`/olt/equipos`) |
| `olt.service.ts` | Orquestación: resuelve contexto del cliente → construye comando CLI → ejecuta SSH → persiste resultado en BD |
| `olt-equipo.service.ts` | CRUD de `olt_equipo` + `olt_credencial`. Encripta credenciales. Nunca expone secretos. |
| `olt-command-builder.service.ts` | Genera strings de comandos CLI Huawei (puro, sin side effects) |
| `olt-connection.service.ts` | Abre sesión SSH con `ssh2`, envía comandos línea por línea, recolecta la salida. Encripta/desencripta credenciales con AES-256-GCM |
| `olt.module.ts` | Declaración del módulo NestJS |

### Dependencias externas

```typescript
// olt.module.ts
imports: [AuthModule, PrismaModule, ConfigModule]
controllers: [OltController, OltEquipoController]
providers: [OltService, OltEquipoService, OltConnectionService, OltCommandBuilderService]
exports: [OltService, OltEquipoService]
```

- `AuthModule` — provee `@Auth()` y `@RequirePermissions()`
- `PrismaModule` — acceso a BD vía `PrismaService`
- `ConfigModule` — lectura de env vars (`OLT_ENCRYPTION_KEY`, timeouts)

### Librerías npm

- `ssh2` — cliente SSH
- `@nestjs/swagger`, `class-validator`, `class-transformer` — validación y documentación
- Módulo nativo `crypto` — AES-256-GCM

---

## 3. Modelo de datos

Todas las tablas están en `afis-bk/prisma/schema.prisma` (líneas ~5183-5370).

### Diagrama ER simplificado

```
olt_equipo ─1:1─ olt_credencial          (credenciales SSH encriptadas)
    │
    ├─1:N─ olt_tarjeta                   (slots físicos)
    │          │
    │          └─1:N─ olt_cliente        (asignación ONT ↔ cliente)
    │                     │
    │                     ├─N:1─ cliente
    │                     └─N:1─ olt_modelo ─N:1─ olt_marca
    │
    └─1:N─ olt_comando                   (auditoría)

olt_cliente_ip ─N:1─ cliente             (IPs públicas/privadas asignadas)
                 └─N:1─ olt_red

olt_perfil_trafico                       (perfiles CIR/PIR/CBS/PBS)
olt_cambio_equipo                        (historial de swap físico)
```

### Tablas principales

#### `olt_equipo`
Representa un equipo físico OLT (e.g., "OLT1-Newtel").

| Campo | Tipo | Notas |
|---|---|---|
| `id_olt_equipo` | Int PK | — |
| `nombre` | VarChar(50) | Identificador humano |
| `ip_address` | VarChar(50) | IP de gestión (SSH) |
| `id_sucursal` | Int? | FK → `sucursales` |
| `legacy_id` | Int? unique | Origen sistema antiguo |
| `createdAt`, `updatedAt` | DateTime | — |

#### `olt_credencial` (1:1 con `olt_equipo`)
Credenciales SSH, **siempre encriptadas** con AES-256-GCM antes de persistirse.

| Campo | Tipo | Notas |
|---|---|---|
| `id_olt_credencial` | Int PK | — |
| `id_olt_equipo` | Int unique | FK → `olt_equipo` |
| `ssh_usuario` | VarChar(100) | **Encriptado** (`iv:authTag:ciphertext`) |
| `ssh_password` | VarChar(255) | **Encriptado** |
| `ssh_puerto` | Int, default 22 | Puerto SSH |
| `prompt_pattern` | VarChar(100) | Default `"OLT1-Newtel>"` |

> **⚠️ CRÍTICO**: nunca retornar `ssh_usuario` ni `ssh_password` en respuestas del API, ni siquiera encriptados. El `OltEquipoService` usa una proyección `includeSafe` que los omite.

#### `olt_tarjeta`
Slots físicos de un equipo.

| Campo | Tipo |
|---|---|
| `id_olt_tarjeta` | Int PK |
| `id_olt_equipo` | FK |
| `slot` | Int (número de slot físico) |
| `nombre`, `modelo` | VarChar |

#### `olt_cliente`
Asignación ONT ↔ cliente. Un registro por slot asignado/asignable.

| Campo | Tipo | Descripción |
|---|---|---|
| `id_olt_cliente` | Int PK | — |
| `id_cliente` | Int? | Null si el slot está libre |
| `id_olt_tarjeta` | Int | FK |
| `port` | Int | 0-15 (puerto GPON) |
| `ont` | Int | 0-127 (ONT ID) |
| `ont_status` | Int | 0 = inactivo, 1 = activo |
| `serviceport` | Int | 0-4095 |
| `serviceport_status` | Int | 0/1 |
| `id_olt_modelo` | Int? | FK |
| `sn` | VarChar(30) | Serial number (para auth SN) |
| `password` | VarChar(15) | LOID password (para auth LOID) |
| `vlan`, `user_vlan` | Int | VLANs 1-4094 |
| `fecha_activacion` | DateTime? | — |

#### `olt_comando`
Auditoría de todos los comandos ejecutados.

| Campo | Tipo | Descripción |
|---|---|---|
| `id_olt_comando` | Int PK | — |
| `id_olt_equipo` | Int | FK |
| `id_cliente` | Int? | — |
| `tipo_operacion` | VarChar(30) | `RESET`, `INSTALL`, `DEACTIVATE`, `ACTIVATE`, `DELETE`, `EQUIPMENT_CHANGE`, `PLAN_CHANGE`, `EQUIPMENT_CHANGE_DB_FAIL` |
| `comando` | Text | Comando CLI enviado |
| `estado` | Int | 0 = pendiente, 1 = exitoso, 2 = error |
| `respuesta` | Text? | Salida del equipo |
| `error_mensaje` | Text? | Mensaje de error si hubo |
| `id_usuario` | Int | Quién ejecutó |
| `createdAt` | DateTime | Cuándo se registró |
| `ejecutadoAt` | DateTime? | Cuándo terminó |

#### `olt_cambio_equipo`
Historial de swaps físicos (cambio de ONT por falla, upgrade, etc.).

---

## 4. Flujo general de una operación

Todas las operaciones sobre ONTs siguen el mismo patrón:

```
┌─────────────┐   HTTP + JWT   ┌─────────────┐
│  Cliente    │ ─────────────► │ OltController│
│  (frontend) │                │             │
└─────────────┘                └─────┬───────┘
                                     │ @RequirePermissions(...)
                                     ▼
                              ┌─────────────┐
                              │  OltService │
                              └─────┬───────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
     ┌────────────────┐  ┌──────────────────┐  ┌────────────────────┐
     │ 1. Prisma:     │  │ 2. CommandBuilder│  │ 3. ConnectionService│
     │    contexto    │  │    genera CLI    │  │    SSH → OLT        │
     │    del cliente │  │                  │  │                     │
     └────────────────┘  └──────────────────┘  └────────────────────┘
              │                     │                     │
              └─────────────────────┴─────────────────────┘
                                    ▼
                         ┌──────────────────────┐
                         │ 4. Prisma: registrar │
                         │    olt_comando       │
                         │    (estado=0→1/2)    │
                         └──────────────────────┘
                                    ▼
                         ┌──────────────────────┐
                         │ 5. Prisma: actualizar│
                         │    olt_cliente       │
                         │    (si aplica)       │
                         └──────────────────────┘
```

### Pasos detallados

1. **Resolver contexto** (`OltService.getClienteOltData`): encuentra el `olt_cliente` activo del cliente, con sus relaciones `tarjeta → equipo → credencial`. Lanza `NotFoundException` si no existe o `BadRequestException` si faltan credenciales SSH.
2. **Generar comando** (`OltCommandBuilderService`): produce el string de comandos CLI que se enviará al OLT. Es una función pura — no toca BD ni red.
3. **Pre-registrar `olt_comando`** (`registrarComando`): inserta fila con `estado=0` antes de ejecutar, para no perder trazabilidad si la conexión se cuelga.
4. **Ejecutar SSH** (`OltConnectionService.executeCommand`): abre conexión, envía comandos línea por línea con delays, recolecta salida, cierra.
5. **Actualizar `olt_comando`** (`actualizarComando`): pone `estado=1` (success) o `estado=2` (error) con la respuesta.
6. **Persistir cambios de dominio** en `olt_cliente` si la operación modifica el estado (instalar, cambiar equipo, etc.).

---

## 5. Conexión SSH y encriptación

### Apertura de sesión (`OltConnectionService.executeCommand`)

```
1. Consulta olt_credencial por id_olt_equipo
2. Decrypt ssh_usuario y ssh_password (AES-256-GCM)
3. Abre Client() de ssh2 con host, port, username, password
4. Configura algorithms legacy para compatibilidad con Huawei viejo:
   - KEX: diffie-hellman-group-exchange-sha256, group14-sha256, group14-sha1, group1-sha1
   - Ciphers: aes256-ctr, aes192-ctr, aes128-ctr, aes256-cbc, aes128-cbc, 3des-cbc
5. Al evento 'ready' abre un shell
6. Envía líneas del comando con OLT_COMMAND_DELAY (default 500ms) entre ellas
7. Después de la última línea espera OLT_RESPONSE_TIMEOUT (default 15s)
8. Envía 'quit\n' para cerrar
9. Resuelve { success, output, error? }
```

**Timeouts**:

| Env | Default | Descripción |
|---|---|---|
| `OLT_SSH_TIMEOUT` | 10000 ms | Tiempo para establecer la conexión SSH |
| `OLT_COMMAND_DELAY` | 500 ms | Pausa entre líneas de comando |
| `OLT_RESPONSE_TIMEOUT` | 15000 ms | Espera tras enviar la última línea |

El timeout global de la promesa es `OLT_SSH_TIMEOUT + OLT_RESPONSE_TIMEOUT` (≈25s).

### Encriptación AES-256-GCM

Formato almacenado: `"{iv_hex}:{authTag_hex}:{ciphertext_hex}"`.

```typescript
// Encriptar
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
let encrypted = cipher.update(text, 'utf8', 'hex');
encrypted += cipher.final('hex');
const authTag = cipher.getAuthTag().toString('hex');
return `${iv.toString('hex')}:${authTag}:${encrypted}`;

// Desencriptar: invierte el proceso
```

**Llave**: `OLT_ENCRYPTION_KEY` en `.env` — debe ser 32 bytes en hex (64 caracteres). Si falta o es inválida, el módulo lanza `InternalServerErrorException`.

Generar una llave nueva:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**⚠️ Rotar la llave requiere re-encriptar todas las credenciales existentes**. No está automatizado — hay que hacerlo con un script ad-hoc.

---

## 6. Catálogo de endpoints

**Prefijo base**: ninguno (los controllers definen sus propias rutas).
**Autenticación**: todos requieren JWT (`@Auth()` a nivel de controller).
**Swagger**: disponible en `http://localhost:4000/api`.

### 6.1 CRUD de equipos OLT — `OltEquipoController`

Base: `/olt/equipos`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `POST` | `/olt/equipos` | `olt.equipos:crear` | Crear equipo + credenciales SSH |
| `GET` | `/olt/equipos` | `olt.equipos:ver` | Listar equipos (paginado, con búsqueda) |
| `GET` | `/olt/equipos/:id` | `olt.equipos:ver` | Detalle de un equipo |
| `PUT` | `/olt/equipos/:id` | `olt.equipos:editar` | Actualizar datos y/o credenciales |
| `DELETE` | `/olt/equipos/:id` | `olt.equipos:eliminar` | Eliminar (sólo si no tiene dependencias) |
| `POST` | `/olt/equipos/:id/test-connection` | `olt.equipos:ver` | Probar SSH ejecutando `display version` |

### 6.2 Operaciones sobre ONTs — `OltController`

Base: `/olt`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `POST` | `/olt/clientes/:idCliente/reset` | `olt.gestion:reiniciar` | Reiniciar ONT |
| `GET` | `/olt/clientes/:idCliente/wan-info` | `olt.gestion:consultar` | Consultar info WAN (IP asignada) |
| `GET` | `/olt/clientes/:idCliente/info` | `olt.gestion:consultar` | Configuración OLT del cliente |
| `POST` | `/olt/clientes/:idCliente/instalar` | `olt.gestion:instalar` | Instalar ONT nuevo |
| `POST` | `/olt/clientes/:idCliente/suspender` | `olt.gestion:suspender` | Suspender ONT |
| `POST` | `/olt/clientes/:idCliente/activar` | `olt.gestion:activar` | Reactivar ONT |
| `POST` | `/olt/clientes/:idCliente/cambiar-equipo` | `olt.gestion:cambiar_equipo` | Swap físico de ONT |
| `POST` | `/olt/clientes/:idCliente/cambiar-plan` | `olt.gestion:cambiar_plan` | Cambiar perfil de tráfico |
| `GET` | `/olt/clientes/:idCliente/historial` | `olt.gestion:consultar` | Historial de comandos del cliente |
| `GET` | `/olt/clientes/:idCliente/cambios-equipo` | `olt.gestion:consultar` | Historial de cambios de equipo |
| `GET` | `/olt/tarjetas` | `olt.gestion:consultar` | Listar todas las tarjetas |
| `GET` | `/olt/modelos` | `olt.gestion:consultar` | Listar modelos de ONT |
| `GET` | `/olt/perfiles-trafico` | `olt.gestion:consultar` | Listar perfiles de tráfico |
| `GET` | `/olt/disponibles/:idTarjeta/:port` | `olt.gestion:consultar` | ONT IDs y service ports libres |

---

## 7. Flujos end-to-end por caso de uso

> Todas las peticiones requieren el header:
> ```
> Authorization: Bearer <JWT>
> ```

### 7.1 Registrar un equipo OLT nuevo

**Paso 1** — Crear el equipo con credenciales SSH:

```http
POST /olt/equipos
Content-Type: application/json

{
  "nombre": "OLT-Sucursal-Centro",
  "ip_address": "10.10.50.20",
  "id_sucursal": 3,
  "usuario": "root",
  "clave": "SuperSecreta123",
  "puerto": 22,
  "prompt_pattern": "OLT1-Newtel>"
}
```

**Respuesta 201**:
```json
{
  "id_olt_equipo": 7,
  "nombre": "OLT-Sucursal-Centro",
  "ip_address": "10.10.50.20",
  "id_sucursal": 3,
  "legacy_id": null,
  "createdAt": "2026-04-09T18:00:00.000Z",
  "updatedAt": "2026-04-09T18:00:00.000Z",
  "sucursal": { "id_sucursal": 3, "nombre": "Centro" },
  "credencial": {
    "id_olt_credencial": 7,
    "ssh_puerto": 22,
    "prompt_pattern": "OLT1-Newtel>",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "_count": { "tarjetas": 0, "comandos": 0 }
}
```

> Nótese que `ssh_usuario` y `ssh_password` **nunca** aparecen en la respuesta.

**Paso 2** — Verificar conectividad:

```http
POST /olt/equipos/7/test-connection
```

**Respuesta 200**:
```json
{
  "success": true,
  "error": null,
  "output": "MA5680T\r\nVRP (R) software, Version 5.160 ..."
}
```

Si el equipo no responde o las credenciales son incorrectas:
```json
{
  "success": false,
  "error": "All configured authentication methods failed",
  "output": ""
}
```

**Paso 3** — Alta de tarjetas. **Actualmente no existe endpoint para esto**; las tarjetas se crean directamente en BD (insertando en `olt_tarjeta`) o con `prisma studio`. Es deuda técnica conocida — ver sección 14.

### 7.2 Actualizar la clave SSH de un equipo

```http
PUT /olt/equipos/7
Content-Type: application/json

{
  "clave": "NuevaClaveRotada2026"
}
```

El `UpdateOltEquipoDto` extiende `PartialType(CreateOltEquipoDto)`, así que **todos los campos son opcionales**. Puedes enviar sólo lo que cambie.

Si quieres cambiar varios campos a la vez:
```json
{
  "ip_address": "10.10.50.21",
  "usuario": "admin",
  "clave": "OtraClave",
  "puerto": 2222
}
```

### 7.3 Consultar equipos con filtros

```http
GET /olt/equipos?page=1&limit=20&search=centro&id_sucursal=3
```

**Respuesta 200**:
```json
{
  "data": [
    { "id_olt_equipo": 7, "nombre": "OLT-Sucursal-Centro", ... }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

El campo `search` hace match case-insensitive en `nombre` y `ip_address`.

### 7.4 Eliminar un equipo

```http
DELETE /olt/equipos/7
```

**Respuesta 200** (si no tiene dependencias):
```json
{ "success": true, "message": "Equipo OLT 7 eliminado" }
```

**Respuesta 400** si tiene tarjetas o comandos asociados:
```json
{
  "statusCode": 400,
  "message": "No se puede eliminar: el equipo tiene 4 tarjeta(s) y 127 comando(s) asociado(s)"
}
```

> Esto es intencional. Borrar un equipo con historial de comandos destruye auditoría.

### 7.5 Instalar un ONT nuevo para un cliente

**Pre-requisitos**:
- El cliente existe en `cliente`.
- Existe una tarjeta (`olt_tarjeta`) en el equipo OLT que cubre la zona del cliente.
- Conoces `idOltTarjeta`, `port` (0-15), y el SN del ONT físico.

**Paso 1** — Consultar ONT IDs y service ports disponibles:

```http
GET /olt/disponibles/12/4
```

Donde `12` = `idOltTarjeta`, `4` = `port` GPON.

**Respuesta 200**:
```json
{
  "ontIds": [0, 1, 2, 3, 5, 6, 7, ...],
  "serviceports": [0, 1, 2, 3, 4, 5, 6, ...]
}
```

**Paso 2** — Consultar modelos disponibles:

```http
GET /olt/modelos
```

Devuelve la lista de `olt_modelo` con su `marca` (ZTE, Huawei, etc.).

**Paso 3** — Enviar la instalación:

```http
POST /olt/clientes/501/instalar
Content-Type: application/json

{
  "idOltTarjeta": 12,
  "port": 4,
  "ontId": 4,
  "serviceport": 7,
  "idOltModelo": 2,
  "tipoAuth": "SN",
  "sn": "HWTC12345678",
  "vlan": 100,
  "userVlan": 200
}
```

> **Nota**: el `idCliente` viene por URL; el controller lo inyecta en `dto.idCliente` antes de llamar al service, así que no lo envíes en el body.

**Flujo interno**:

```
1. Verificar que el slot (idOltTarjeta, port, ontId) no esté ocupado
2. Verificar que la tarjeta existe y tiene credenciales
3. Buscar el olt_modelo para obtener srvprofile_olt
4. Generar comando CLI con OltCommandBuilderService.buildInstallCommand()
5. Pre-registrar olt_comando con tipo='INSTALL'
6. Ejecutar SSH → recibe output
7. Actualizar olt_comando con resultado
8. Si success: update/create en olt_cliente con ont_status=1
9. Retornar { success, message, output }
```

**Respuesta 200**:
```json
{
  "success": true,
  "message": "ONT instalado exitosamente (Puerto 4, ONT 4)",
  "output": "OLT1-Newtel(config-if-gpon-0/12)#ont add 4 4 sn-auth \"HWTC12345678\" ..."
}
```

**Posibles errores**:
- `400` → El ONT ya está ocupado, o faltan credenciales SSH del equipo.
- `404` → Tarjeta no encontrada.
- `500` → SSH falló o el OLT rechazó el comando.

### 7.6 Reiniciar un ONT

```http
POST /olt/clientes/501/reset
```

El controller resuelve `idCliente=501` → busca su `olt_cliente` activo → ejecuta `ont reset` vía SSH.

**Respuesta**:
```json
{
  "success": true,
  "message": "ONT reiniciado exitosamente (Slot 0, Puerto 4, ONT 4)",
  "output": "..."
}
```

### 7.7 Suspender / reactivar un ONT

Para suspensión por mora o mantenimiento:

```http
POST /olt/clientes/501/suspender
```

Ejecuta `ont deactivate`. El estado lógico en `olt_cliente` **no cambia** en esta operación — sólo se manda el comando al OLT. Si tu flujo de negocio necesita persistir el estado lógico (e.g., para reportes), hazlo en el módulo que orquesta la mora.

Para reactivar:
```http
POST /olt/clientes/501/activar
```

### 7.8 Consultar la IP WAN asignada al ONT

```http
GET /olt/clientes/501/wan-info
```

Ejecuta `display ont wan-info` y retorna la salida cruda del OLT:
```json
{
  "idCliente": 501,
  "output": "Manage IP: 10.200.5.42 ..."
}
```

> El parsing del output queda del lado del consumidor. Si muchos módulos lo parsean, considera agregar un helper en `OltService`.

### 7.9 Cambiar el equipo físico (swap)

Caso típico: el ONT del cliente se daña, se instala uno nuevo, el técnico lo registra.

**Pre-requisito**: debe existir un registro `olt_cliente` con `ont_status=0` y `id_cliente=null` en el slot destino (puede ser el mismo slot reutilizado o uno nuevo).

```http
POST /olt/clientes/501/cambiar-equipo
Content-Type: application/json

{
  "idNuevoOltCliente": 7432,
  "idOltModeloNuevo": 3,
  "snNuevo": "HWTC99887766",
  "passwordNuevo": null,
  "vlanNuevo": 100,
  "userVlanNuevo": 200,
  "observacion": "Swap por falla óptica reportada en OT-2312"
}
```

**Flujo interno**:

```
1. Resolver contexto actual del cliente
2. Validar que el slot destino (idNuevoOltCliente) existe y está libre
3. SSH: ejecutar 'undo service-port' + 'ont delete' del equipo viejo
4. SSH: ejecutar 'ont add' del equipo nuevo + 'service-port' ...
5. Transacción DB (atómica):
   a. olt_cliente viejo → ont_status=0, id_cliente=null
   b. olt_cliente nuevo → ont_status=1, id_cliente=501, sn, vlan, etc.
   c. olt_cambio_equipo → registro histórico
```

> **⚠️ Importante**: los pasos 3-4 son **no-reversibles** (SSH). La transacción sólo abarca los pasos de BD (paso 5). Si el SSH succeed pero la transacción DB falla, el módulo registra un `olt_comando` con `tipo_operacion='EQUIPMENT_CHANGE_DB_FAIL'` y lanza 500. **Requiere intervención manual** para reconciliar: típicamente re-correr los updates de BD una vez investigada la causa.

### 7.10 Cambiar plan de tráfico

```http
POST /olt/clientes/501/cambiar-plan
Content-Type: application/json

{
  "idTraficoUp": 5,
  "idTraficoDown": 8
}
```

Donde `idTraficoUp` y `idTraficoDown` referencian `olt_perfil_trafico.id_olt_perfil_trafico` (consultable con `GET /olt/perfiles-trafico`).

### 7.11 Consultar historial de un cliente

```http
GET /olt/clientes/501/historial
```

Devuelve todos los `olt_comando` del cliente, ordenados por fecha descendente, con el usuario que ejecutó cada uno.

```http
GET /olt/clientes/501/cambios-equipo
```

Devuelve el historial específico de swaps físicos (tabla `olt_cambio_equipo`).

---

## 8. Sistema de permisos

Formato: `modulo.recurso:accion` (siempre underscores, nunca hyphens).

### Permisos del módulo OLT

**Operaciones ONT** (`olt.gestion:*`):

| Código | Descripción | Crítico | Auditoría |
|---|---|---|---|
| `olt.gestion:consultar` | Ver info, historial, disponibles | — | — |
| `olt.gestion:reiniciar` | Reiniciar ONT | — | ✓ |
| `olt.gestion:instalar` | Instalar ONT nuevo | ✓ | ✓ |
| `olt.gestion:suspender` | Suspender ONT | — | ✓ |
| `olt.gestion:activar` | Reactivar ONT | — | ✓ |
| `olt.gestion:cambiar_equipo` | Swap físico | ✓ | ✓ |
| `olt.gestion:cambiar_plan` | Cambiar perfil de tráfico | — | ✓ |

**CRUD de equipos** (`olt.equipos:*`):

| Código | Descripción | Crítico | Auditoría |
|---|---|---|---|
| `olt.equipos:ver` | Listar/consultar/test-connection | — | — |
| `olt.equipos:crear` | Registrar equipo + credenciales | ✓ | ✓ |
| `olt.equipos:editar` | Actualizar equipo/credenciales | ✓ | ✓ |
| `olt.equipos:eliminar` | Eliminar equipo sin dependencias | ✓ | ✓ |

**Ubicación**: `afis-bk/prisma/seeds/permisos/permisos.data.ts`.

**Aplicar**:
```bash
cd afis-bk
npm run seed:permisos       # desarrollo
npm run seed:prod           # producción
```

### Cómo usar en el frontend

```html
<button *hasPermission="'olt.equipos:crear'" (click)="abrirModal()">
  Nuevo equipo OLT
</button>
```

---

## 9. Auditoría de comandos (`olt_comando`)

Cada operación SSH produce exactamente un registro en `olt_comando`.

### Estados

| `estado` | Significado |
|---|---|
| `0` | Pre-registro: el comando fue construido pero aún no ejecutado (o se colgó) |
| `1` | Ejecutado con éxito |
| `2` | Error durante ejecución (ver `error_mensaje`) |

### Tipos de operación

`RESET`, `INSTALL`, `DEACTIVATE`, `ACTIVATE`, `DELETE`, `EQUIPMENT_CHANGE`, `PLAN_CHANGE`, `EQUIPMENT_CHANGE_DB_FAIL` (inconsistencia SSH↔DB).

### Queries útiles (debugging)

```sql
-- Últimos comandos fallidos
SELECT * FROM olt_comando WHERE estado = 2 ORDER BY "createdAt" DESC LIMIT 20;

-- Comandos colgados (pre-registrados pero nunca finalizados)
SELECT * FROM olt_comando WHERE estado = 0 AND "createdAt" < NOW() - INTERVAL '5 minutes';

-- Actividad de un equipo
SELECT tipo_operacion, COUNT(*) FROM olt_comando
  WHERE id_olt_equipo = 7 GROUP BY tipo_operacion;

-- Inconsistencias SSH↔DB que requieren intervención manual
SELECT * FROM olt_comando WHERE tipo_operacion = 'EQUIPMENT_CHANGE_DB_FAIL';
```

---

## 10. Manejo de errores

El módulo usa las excepciones estándar de NestJS, que se traducen a HTTP automáticamente:

| Excepción | HTTP | Cuándo |
|---|---|---|
| `BadRequestException` | 400 | Validación de dominio (slot ocupado, faltan credenciales, equipo en uso al eliminar) |
| `NotFoundException` | 404 | Cliente/equipo/tarjeta/slot no encontrado |
| `InternalServerErrorException` | 500 | Fallo de SSH, error de encriptación, inconsistencia DB post-SSH |

La validación de DTOs (class-validator) produce `400` con el detalle de los campos inválidos.

### Patrón estándar de respuesta de error (NestJS)

```json
{
  "statusCode": 400,
  "message": "El ONT 4 en puerto 4 ya está ocupado",
  "error": "Bad Request"
}
```

Para validaciones múltiples:
```json
{
  "statusCode": 400,
  "message": [
    "vlan must not be less than 1",
    "vlan must not be greater than 4094"
  ],
  "error": "Bad Request"
}
```

---

## 11. Variables de entorno

En `afis-bk/.env`:

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `OLT_ENCRYPTION_KEY` | **Sí** | — | 32 bytes hex (64 chars) para AES-256-GCM |
| `OLT_SSH_TIMEOUT` | No | 10000 | ms para establecer conexión SSH |
| `OLT_COMMAND_DELAY` | No | 500 | ms entre líneas de comando |
| `OLT_RESPONSE_TIMEOUT` | No | 15000 | ms de espera tras la última línea |

Generar clave nueva:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Agregarla al `.env`:
```
OLT_ENCRYPTION_KEY=a1b2c3d4e5f6...64chars
```

---

## 12. Cómo extender el módulo

### Agregar una operación ONT nueva (ejemplo: "reboot card")

1. **Interfaz de parámetros** en `interfaces/olt-command.interface.ts`:
   ```typescript
   export interface OltRebootCardParams {
     slot: number;
   }
   ```

2. **Generador de comando** en `olt-command-builder.service.ts`:
   ```typescript
   buildRebootCardCommand(params: OltRebootCardParams): string {
     return `enable\nconfig\nboard reset 0/${params.slot}\ny\nquit\nquit\n`;
   }
   ```

3. **DTO** (si la operación recibe datos del body): en `dto/reboot-card.dto.ts` con `class-validator`.

4. **Método en `OltService`**: replica el patrón de `resetOnt`:
   - Resolver contexto (`getClienteOltData` o similar)
   - Construir comando con el builder
   - `registrarComando(..., 'REBOOT_CARD', ...)`
   - `executeCommand`
   - `actualizarComando(..., success, output, error)`
   - Lanzar `InternalServerErrorException` si falla
   - Retornar `OltOperationResult`

5. **Endpoint en `OltController`**:
   ```typescript
   @RequirePermissions('olt.gestion:reiniciar_tarjeta')
   @Post('tarjetas/:idTarjeta/reboot')
   rebootCard(@Param('idTarjeta', ParseIntPipe) id: number, @GetUser('id_usuario') u: number) {
     return this.oltService.rebootCard(id, u);
   }
   ```

6. **Permiso** en `prisma/seeds/permisos/permisos.data.ts`:
   ```typescript
   crearPermisoCustom('olt', 'gestion', 'reiniciar_tarjeta', 'Reiniciar Tarjeta OLT',
     'Reinicia una tarjeta completa del OLT', { es_critico: true, requiere_auditoria: true }),
   ```

7. **Seed**: `npm run seed:permisos`.

8. **Swagger**: decorar con `@ApiOperation`, `@ApiResponse`.

### Agregar un CRUD para otra entidad OLT (ejemplo: `olt_tarjeta`)

Usa `olt-equipo.controller.ts` + `olt-equipo.service.ts` como plantilla. Pasos:

1. Crear `dto/create-olt-tarjeta.dto.ts`, `update-olt-tarjeta.dto.ts`, `query-olt-tarjeta.dto.ts`.
2. Crear `olt-tarjeta.service.ts` con `create/findAll/findOne/update/remove`.
3. Crear `olt-tarjeta.controller.ts` con los 5 endpoints + permisos.
4. Registrar en `olt.module.ts`.
5. Agregar permisos `olt.tarjetas:*` en el seed.
6. Correr `npm run build` para validar tipos.

### Si necesitas parsear la salida del OLT

El `output` viene crudo. Buenas prácticas:

- Crea un módulo de parsers bajo `olt/parsers/` con funciones puras.
- Ejemplo: `parseWanInfo(output: string): { ip: string; mac: string; ... }`.
- Testéalos con Jest usando fixtures de salidas reales.

---

## 13. Pruebas y debugging

### Build local

```bash
cd afis-bk
npm install
npx prisma generate
npm run build    # verifica tipos
```

### Arranque en desarrollo

```bash
npm run start:dev
# API: http://localhost:4000
# Swagger: http://localhost:4000/api
```

### Pruebas manuales con Swagger

1. Abrir `http://localhost:4000/api`.
2. Click en `Authorize` e ingresar `Bearer <tu-jwt>`.
3. Probar los endpoints bajo los tags `OLT - Equipos` y `Gestión OLT`.

### Pruebas manuales con `curl`

```bash
# 1. Login para obtener JWT
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo":"admin@afis.sv","password":"..."}' | jq -r .token)

# 2. Listar equipos
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/olt/equipos

# 3. Crear equipo
curl -X POST http://localhost:4000/olt/equipos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"TEST","ip_address":"10.0.0.1","usuario":"root","clave":"x"}'

# 4. Test connection
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/olt/equipos/1/test-connection
```

### Debugging de SSH

Si una operación falla con timeout:

1. Verificar alcance de red: `ping <ip_olt>` desde el servidor backend.
2. Verificar credenciales manualmente: `ssh usuario@ip_olt` usando la clave en texto plano.
3. Si SSH responde pero con algoritmos incompatibles, agregar el algoritmo faltante a la lista en `olt-connection.service.ts:162-178`.
4. Aumentar `OLT_RESPONSE_TIMEOUT` en `.env` si el equipo es lento.
5. Consultar `olt_comando.error_mensaje` para ver el mensaje exacto.

### Inspeccionar la BD

```bash
npx prisma studio
# Abre http://localhost:5555
# Tablas relevantes: olt_equipo, olt_credencial, olt_cliente, olt_comando, olt_cambio_equipo
```

### Validar que la encriptación funciona

```sql
SELECT id_olt_equipo, ssh_password FROM olt_credencial LIMIT 1;
```

El valor debe verse como `"a1b2...:f3e4...:9d8c..."` (tres bloques hex separados por `:`).

### Unit tests (pendiente)

El módulo **no tiene tests todavía**. Al agregar funcionalidad nueva, crear:

```
olt/
├── __tests__/
│   ├── olt.service.spec.ts
│   ├── olt-equipo.service.spec.ts
│   └── olt-command-builder.service.spec.ts
```

Usar Jest (ya está en el stack del proyecto). Mockear `PrismaService` y `OltConnectionService` para aislar la lógica.

---

## 14. Deuda técnica conocida

| # | Tema | Impacto | Sugerencia |
|---|---|---|---|
| 1 | Sin CRUD de `olt_tarjeta` | Operativo: alta de slots se hace manual en BD | Agregar siguiendo el patrón de `OltEquipoController` |
| 2 | Sin retry/backoff en SSH | Falla de red transitoria = operación fallida inmediata | Envolver `executeCommand` en retry con jitter |
| 3 | Sin rate limiting | Un cliente malicioso puede saturar OLT | `@nestjs/throttler` por usuario |
| 4 | Asignación de `serviceport` naive (0→4095) | Ineficiente con rangos sparse | Algoritmo con gap detection |
| 5 | Output del OLT sin parser estructurado | Consumidores deben parsear texto plano | Crear `olt/parsers/` |
| 6 | Sin tests unitarios | Refactors riesgosos | Agregar suite con Jest |
| 7 | Inconsistencia SSH↔DB en `cambiarEquipo` requiere intervención manual | Requiere operador DBA si falla | Considerar una cola de reconciliación |
| 8 | Rotación de `OLT_ENCRYPTION_KEY` no automatizada | Rotar llave = re-encriptar todo manualmente | Script CLI dedicado |
| 9 | `olt_comando` crece sin archivado | Tabla de auditoría crece indefinidamente | Archivar > 1 año a tabla histórica |
| 10 | Sin logging estructurado | Correlación cross-servicio difícil | Integrar con Pino + correlation IDs |

---

## Referencias

- **README histórico**: `afis-bk/src/modules/olt/README.md` — información complementaria de la migración desde el sistema PHP legacy.
- **Schema Prisma**: `afis-bk/prisma/schema.prisma` líneas 5183-5370.
- **Documentación CLI Huawei MA5680T**: `Mejorar_documento_GenieACS/Documentation_OLT_MA5680T_CLI.md`.
- **Plan de refactor aplicado**: `~/.claude/plans/hashed-cuddling-cascade.md`.
- **Permisos**: `afis-bk/prisma/seeds/permisos/permisos.data.ts` líneas 1277-1320.
- **Swagger en vivo**: `http://localhost:4000/api`.

---

**Mantenedor**: equipo backend AFIS.
**Preguntas frecuentes**: revisar `olt_comando` primero — 80% de los issues se diagnostican mirando el último comando fallido del cliente afectado.
