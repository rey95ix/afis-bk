# Modulo WhatsApp Chat

Sistema completo de gestion de chats de WhatsApp Business con integracion de IA para atencion automatizada al cliente.

## Descripcion General

Este modulo proporciona:
- **Gestion de Chats**: CRUD completo de conversaciones con clientes via WhatsApp
- **Mensajeria**: Envio/recepcion de mensajes (texto, imagen, video, audio, documentos)
- **Integracion IA**: Respuestas automaticas con OpenAI/Claude y motor de reglas
- **Asignacion de Agentes**: Sistema de asignacion y reasignacion de chats
- **Analytics**: Metricas de rendimiento, tiempos de respuesta, satisfaccion
- **Webhook WhatsApp**: Recepcion de eventos en tiempo real

---

## Estructura de Directorios

```
whatsapp-chat/
├── whatsapp-chat.module.ts
│
├── analytics/
│   ├── analytics.controller.ts
│   └── analytics.service.ts
│
├── assignment/
│   ├── assignment.controller.ts
│   ├── assignment.service.ts
│   └── dto/
│       ├── assign-chat.dto.ts
│       └── index.ts
│
├── chat/
│   ├── chat.controller.ts
│   ├── chat.service.ts
│   └── dto/
│       ├── create-chat.dto.ts
│       ├── query-chat.dto.ts
│       ├── update-chat.dto.ts
│       └── index.ts
│
├── ia/
│   ├── ia-config.controller.ts
│   ├── ia-config.service.ts
│   ├── ia-rule.controller.ts
│   ├── ia-rule.service.ts
│   ├── openai-chat.service.ts
│   ├── rule-engine.service.ts
│   └── dto/
│       ├── create-ia-config.dto.ts
│       ├── create-ia-rule.dto.ts
│       ├── test-ia.dto.ts
│       ├── update-ia-config.dto.ts
│       ├── update-ia-rule.dto.ts
│       └── index.ts
│
├── message/
│   ├── message.controller.ts
│   ├── message.service.ts
│   └── dto/
│       ├── query-message.dto.ts
│       ├── send-message.dto.ts
│       └── index.ts
│
└── whatsapp-api/
    ├── whatsapp-api.service.ts
    ├── whatsapp-webhook.controller.ts
    └── dto/
        ├── webhook-payload.dto.ts
        └── index.ts
```

---

## Endpoints API

**Base URL:** `/api/atencion-al-cliente/whatsapp-chat`

### ChatController - `/chats`

| Metodo | Endpoint | Permiso | Descripcion |
|--------|----------|---------|-------------|
| `POST` | `/` | `whatsapp_chat:crear` | Iniciar nuevo chat con cliente |
| `GET` | `/` | `whatsapp_chat:ver` | Listar chats con filtros y paginacion |
| `GET` | `/stats` | `whatsapp_chat:ver` | Estadisticas generales de chats |
| `GET` | `/:id` | `whatsapp_chat:ver` | Obtener chat por ID con mensajes |
| `PATCH` | `/:id` | `whatsapp_chat:editar` | Actualizar chat (estado, tags, asignado) |
| `POST` | `/:id/close` | `whatsapp_chat:editar` | Cerrar chat con metricas finales |
| `POST` | `/:id/read` | `whatsapp_chat:editar` | Marcar chat como leido |

### MessageController - `/chats/:chatId/messages`

| Metodo | Endpoint | Permiso | Descripcion |
|--------|----------|---------|-------------|
| `POST` | `/` | `whatsapp_chat:crear` | Enviar mensaje (texto o multimedia) |
| `GET` | `/` | `whatsapp_chat:ver` | Listar mensajes paginados |
| `GET` | `/new` | `whatsapp_chat:ver` | Obtener mensajes nuevos (polling) |
| `GET` | `/:id` | `whatsapp_chat:ver` | Obtener mensaje por ID |

### AssignmentController - `/chats/:chatId/assign`

| Metodo | Endpoint | Permiso | Descripcion |
|--------|----------|---------|-------------|
| `POST` | `/` | `whatsapp_chat:asignar` | Asignar chat a usuario |
| `DELETE` | `/` | `whatsapp_chat:asignar` | Desasignar chat |
| `GET` | `/history` | `whatsapp_chat:ver` | Historial de asignaciones |

### AgentsController - `/agents`

| Metodo | Endpoint | Permiso | Descripcion |
|--------|----------|---------|-------------|
| `GET` | `/` | `whatsapp_chat:ver` | Listar agentes disponibles con carga |

### IaConfigController - `/ia-config`

| Metodo | Endpoint | Permiso | Descripcion |
|--------|----------|---------|-------------|
| `POST` | `/` | `whatsapp_ia:configurar` | Crear configuracion de IA |
| `GET` | `/` | `whatsapp_ia:ver` | Listar todas las configuraciones |
| `GET` | `/active` | `whatsapp_ia:ver` | Obtener configuracion activa |
| `GET` | `/:id` | `whatsapp_ia:ver` | Obtener configuracion por ID |
| `PATCH` | `/:id` | `whatsapp_ia:configurar` | Actualizar configuracion |
| `DELETE` | `/:id` | `whatsapp_ia:configurar` | Eliminar configuracion |
| `POST` | `/:id/activate` | `whatsapp_ia:configurar` | Activar configuracion |
| `POST` | `/:id/duplicate` | `whatsapp_ia:configurar` | Duplicar configuracion |
| `POST` | `/test` | `whatsapp_ia:configurar` | Probar IA con mensaje |

### IaRuleController - `/ia-rules`

| Metodo | Endpoint | Permiso | Descripcion |
|--------|----------|---------|-------------|
| `POST` | `/` | `whatsapp_ia:configurar` | Crear regla de IA |
| `GET` | `/` | `whatsapp_ia:ver` | Listar reglas (requiere `config_id`) |
| `GET` | `/active` | `whatsapp_ia:ver` | Listar reglas activas |
| `GET` | `/:id` | `whatsapp_ia:ver` | Obtener regla por ID |
| `PATCH` | `/:id` | `whatsapp_ia:configurar` | Actualizar regla |
| `DELETE` | `/:id` | `whatsapp_ia:configurar` | Eliminar regla |
| `POST` | `/reorder` | `whatsapp_ia:configurar` | Reordenar prioridades |
| `POST` | `/:id/duplicate` | `whatsapp_ia:configurar` | Duplicar regla |
| `POST` | `/test` | `whatsapp_ia:configurar` | Evaluar mensaje contra reglas |

### AnalyticsController - `/analytics`

| Metodo | Endpoint | Permiso | Descripcion |
|--------|----------|---------|-------------|
| `GET` | `/overview` | `whatsapp_chat:ver` | Metricas generales |
| `GET` | `/agent-performance` | `whatsapp_chat:ver` | Rendimiento por agente |
| `GET` | `/ia-stats` | `whatsapp_ia:ver` | Estadisticas de uso de IA |
| `GET` | `/chat/:chatId` | `whatsapp_chat:ver` | Metricas de un chat |
| `GET` | `/trends` | `whatsapp_chat:ver` | Tendencias por periodo |

### WhatsAppWebhookController - `/webhook`

| Metodo | Endpoint | Auth | Descripcion |
|--------|----------|------|-------------|
| `GET` | `/` | No | Verificacion de webhook (challenge) |
| `POST` | `/` | Signature | Recibir eventos de WhatsApp |

---

## Servicios

### ChatService
Gestion del ciclo de vida de chats.

```typescript
create(dto, userId)              // Crear chat
findAll(queryDto)                // Listar con filtros
findOne(id, includeMessages)     // Obtener por ID
update(id, dto, userId)          // Actualizar
close(id, userId, razon)         // Cerrar con metricas
markAsRead(chatId)               // Resetear no leidos
findOrCreateByPhone(telefono)    // Buscar/crear desde webhook
getStats(userId?)                // Estadisticas
```

### MessageService
Gestion de mensajes.

```typescript
sendMessage(chatId, dto, userId)     // Enviar mensaje
receiveMessage(chatId, ...)          // Recibir del webhook
saveIAMessage(chatId, contenido)     // Guardar mensaje IA
findAll(chatId, queryDto)            // Listar paginado
getNewMessages(chatId, since)        // Polling
updateStatus(whatsappMsgId, status)  // Actualizar estado
```

### AssignmentService
Asignacion de chats a agentes.

```typescript
assignChat(chatId, dto, assignedById)    // Asignar
unassignChat(chatId, dto, userId)        // Desasignar
getHistory(chatId)                       // Historial
getAvailableAgents()                     // Agentes con carga
```

### IaConfigService
Configuraciones de IA.

```typescript
create(dto, userId)          // Crear config
findAll()                    // Listar todas
getActive()                  // Obtener activa
activate(id, userId)         // Activar (desactiva otras)
duplicate(id, userId)        // Duplicar
```

### IaRuleService
Reglas automaticas de IA.

```typescript
create(dto, userId)                      // Crear regla
findAllByConfig(configId)                // Por configuracion
findAllActive()                          // Activas ordenadas
reorder(configId, ruleIds, userId)       // Cambiar prioridades
incrementExecutionCount(ruleId)          // Contador ejecuciones
```

### RuleEngineService
Motor de evaluacion de reglas.

```typescript
evaluateMessage(context)                 // Evaluar contra reglas
evaluateConditions(conditions, logica)   // AND/OR
evaluateCondition(condition, context)    // Condicion individual
```

### OpenAIChatService
Integracion con OpenAI.

```typescript
generateResponse(chatId, userMessage)    // Generar respuesta
testConfiguration(mensaje, configId)     // Probar config
getConversationHistory(chatId, limit)    // Historial
checkEscalationConditions(...)           // Evaluar escalado
```

### WhatsAppApiService
Cliente de WhatsApp Business API.

```typescript
verifyWebhook(mode, token, challenge)    // Verificar webhook
verifyWebhookSignature(rawBody, sig)     // Verificar firma
sendTextMessage(to, text)                // Enviar texto
sendImageMessage(to, url, caption)       // Enviar imagen
sendDocumentMessage(to, url, caption)    // Enviar documento
markAsRead(messageId)                    // Marcar leido
```

### AnalyticsService
Metricas y reportes.

```typescript
getOverview(range?)                  // Metricas generales
getAgentPerformance(range?)          // Por agente
getIAStats(range?)                   // Uso de IA
getChatMetrics(chatId)               // Metricas de chat
getTrends(periodo?)                  // Tendencias
```

---

## DTOs

### CreateChatDto
```typescript
{
  telefono_cliente: string;        // "+50370001234" (E.164)
  id_cliente?: number;             // Vincular a cliente existente
  nombre_cliente?: string;
  mensaje_inicial?: string;
  id_usuario_asignado?: number;
  ia_habilitada?: boolean;         // Default: true
  tags?: string[];
}
```

### UpdateChatDto
```typescript
{
  estado?: 'ABIERTO' | 'PENDIENTE' | 'CERRADO' | 'IA_MANEJANDO';
  id_usuario_asignado?: number;
  ia_habilitada?: boolean;
  tags?: string[];
  nombre_cliente?: string;
  id_cliente?: number;
}
```

### QueryChatDto
```typescript
{
  page?: number;                   // Default: 1
  limit?: number;                  // Default: 20
  search?: string;                 // Buscar por telefono/nombre
  estado?: string;
  id_usuario_asignado?: number;
  sin_asignar?: boolean;
  id_cliente?: number;
  tags?: string[];                 // Separados por coma
  fecha_desde?: string;            // ISO date
  fecha_hasta?: string;
  sort_by?: 'ultimo_mensaje_at' | 'fecha_creacion' | 'mensajes_no_leidos';
  sort_order?: 'asc' | 'desc';
}
```

### SendMessageDto
```typescript
{
  contenido: string;               // Requerido
  tipo?: 'TEXTO' | 'IMAGEN' | 'VIDEO' | 'AUDIO' | 'DOCUMENTO';
  url_media?: string;
  tipo_media?: string;             // MIME type
}
```

### AssignChatDto
```typescript
{
  id_usuario: number;              // Requerido
  razon?: string;
}
```

### CreateIaConfigDto
```typescript
{
  nombre: string;                  // Requerido
  descripcion?: string;
  activo?: boolean;                // Default: false
  proveedor?: 'OPENAI' | 'CLAUDE' | 'CUSTOM';
  modelo?: string;                 // Default: 'gpt-4'
  api_key?: string;                // Se encripta
  temperatura?: number;            // 0-2, Default: 0.7
  max_tokens?: number;             // 50-4000, Default: 500
  system_prompt: string;           // Requerido
  ventana_contexto?: number;       // 1-50, Default: 10
  fallback_a_humano?: boolean;     // Default: true
  condiciones_fallback?: object;
  delay_respuesta_seg?: number;    // 0-30, Default: 2
  horario_atencion?: object;
}
```

### CreateIaRuleDto
```typescript
{
  id_config: number;               // Requerido
  nombre: string;                  // Requerido
  descripcion?: string;
  prioridad?: number;              // Mayor = primero
  activo?: boolean;                // Default: true
  condiciones: RuleCondition[];    // Requerido
  logica_condiciones?: 'AND' | 'OR';
  acciones: RuleAction[];          // Requerido
}

// RuleCondition
{
  type: 'CONTAINS_KEYWORD' | 'REGEX_MATCH' | 'MESSAGE_COUNT' | 'TIME_OF_DAY' | 'SENTIMENT';
  value: any;
  operator?: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in';
  negate?: boolean;
}

// RuleAction
{
  type: 'RESPOND_TEXT' | 'RESPOND_AI' | 'ASSIGN_TO_USER' | 'ADD_TAG' | 'ESCALATE' | 'CLOSE_CHAT';
  params: any;
  delay?: number;                  // Segundos
}
```

---

## Modelos de Base de Datos

### whatsapp_chat
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id_chat` | Int (PK) | ID interno |
| `whatsapp_chat_id` | String (UK) | ID externo WhatsApp |
| `telefono_cliente` | String | Telefono E.164 |
| `nombre_cliente` | String? | Nombre del cliente |
| `estado` | Enum | ABIERTO, PENDIENTE, CERRADO, IA_MANEJANDO |
| `id_usuario_asignado` | Int? (FK) | Usuario asignado |
| `id_cliente` | Int? (FK) | Cliente vinculado |
| `ultimo_mensaje_at` | DateTime? | Timestamp ultimo mensaje |
| `preview_ultimo_mensaje` | String? | Preview del mensaje |
| `mensajes_no_leidos` | Int | Contador no leidos |
| `ia_habilitada` | Boolean | IA activa en chat |
| `ia_mensajes_count` | Int | Mensajes respondidos por IA |
| `tags` | String[] | Etiquetas |
| `fecha_creacion` | DateTime | Creacion |
| `fecha_cierre` | DateTime? | Cierre |

### whatsapp_message
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id_message` | Int (PK) | ID interno |
| `id_chat` | Int (FK) | Chat padre |
| `whatsapp_message_id` | String (UK) | ID WhatsApp |
| `direccion` | Enum | ENTRANTE, SALIENTE |
| `tipo` | Enum | TEXTO, IMAGEN, VIDEO, AUDIO, DOCUMENTO, etc. |
| `contenido` | Text | Contenido del mensaje |
| `url_media` | String? | URL multimedia |
| `estado` | Enum | PENDIENTE, ENVIADO, ENTREGADO, LEIDO, FALLIDO |
| `id_usuario_envia` | Int? (FK) | Usuario que envia |
| `es_de_ia` | Boolean | Generado por IA |
| `id_regla_ia` | Int? (FK) | Regla que lo genero |
| `confianza_ia` | Float? | Score de confianza |

### whatsapp_ia_config
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id_config` | Int (PK) | ID |
| `nombre` | String | Nombre config |
| `activo` | Boolean | Solo una activa |
| `proveedor` | Enum | OPENAI, CLAUDE, CUSTOM |
| `modelo` | String | Modelo a usar |
| `api_key` | String | API key encriptada |
| `temperatura` | Float | Creatividad (0-2) |
| `max_tokens` | Int | Longitud maxima |
| `system_prompt` | Text | Prompt del sistema |
| `ventana_contexto` | Int | Mensajes de contexto |
| `fallback_a_humano` | Boolean | Escalar si no puede |

### whatsapp_ia_rule
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id_regla` | Int (PK) | ID |
| `id_config` | Int (FK) | Configuracion padre |
| `nombre` | String | Nombre regla |
| `prioridad` | Int | Orden (mayor primero) |
| `activo` | Boolean | Regla activa |
| `condiciones` | JSON | Array de condiciones |
| `logica_condiciones` | Enum | AND, OR |
| `acciones` | JSON | Array de acciones |
| `ejecuciones_count` | Int | Veces ejecutada |

### whatsapp_chat_assignment
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id_asignacion` | Int (PK) | ID |
| `id_chat` | Int (FK) | Chat |
| `id_usuario` | Int (FK) | Usuario asignado |
| `id_asignado_por` | Int? (FK) | Quien asigno |
| `fecha_asignacion` | DateTime | Cuando |
| `fecha_desasignacion` | DateTime? | Cuando termino |
| `razon` | String? | Motivo |
| `activo` | Boolean | Asignacion vigente |

### whatsapp_chat_metrics
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id_metrica` | Int (PK) | ID |
| `id_chat` | Int (FK, UK) | Chat (1:1) |
| `tiempo_primera_respuesta` | Int? | Segundos |
| `tiempo_respuesta_promedio` | Int? | Segundos |
| `total_mensajes` | Int | Total |
| `mensajes_agente` | Int | Por agentes |
| `mensajes_ia` | Int | Por IA |
| `mensajes_cliente` | Int | Del cliente |
| `duracion` | Int? | Segundos total |
| `puntuacion_satisfaccion` | Int? | 1-5 |
| `fue_escalado` | Boolean | Si escalo a humano |

---

## Variables de Entorno

### Requeridas
```env
# WhatsApp Business API
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxx
WHATSAPP_WEBHOOK_VERIFY_TOKEN=mi_token_secreto

# OpenAI (para IA)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Opcionales
```env
# Configuracion adicional
WHATSAPP_API_VERSION=v18.0
WHATSAPP_MESSAGE_TIMEOUT=30000
WHATSAPP_RETRY_ATTEMPTS=3

# IA
OPENAI_MODEL=gpt-4
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=500
```

---

## Flujos de Trabajo

### Flujo de Chat
```
1. Cliente envia mensaje a WhatsApp
2. Webhook recibe evento POST /webhook
3. Se verifica firma HMAC-SHA256
4. Se busca/crea chat por telefono
5. Se guarda mensaje entrante
6. Si ia_habilitada:
   a. RuleEngine evalua reglas
   b. Si match -> ejecuta acciones
   c. Si no -> OpenAI genera respuesta
   d. Se envia respuesta via WhatsApp API
7. Se actualizan metricas
```

### Flujo de Asignacion
```
1. POST /chats/:id/assign con id_usuario
2. Se desactivan asignaciones previas
3. Se crea nueva asignacion activa
4. Se actualiza id_usuario_asignado en chat
5. Chat cambia a estado ABIERTO
6. Se deshabilita IA automaticamente
```

### Flujo de IA
```
1. Mensaje entrante activa evaluacion
2. RuleEngine.evaluateMessage():
   - Obtiene reglas activas ordenadas por prioridad
   - Evalua condiciones (AND/OR)
   - Primera regla que matchea gana
3. Si hay match:
   - Ejecuta acciones de la regla
   - Incrementa contador de ejecuciones
4. Si no hay match:
   - OpenAI genera respuesta con contexto
   - Evalua si debe escalar a humano
5. Se guarda mensaje con es_de_ia=true
```

---

## Permisos

| Permiso | Descripcion |
|---------|-------------|
| `atencion_cliente.whatsapp_chat:ver` | Ver chats y mensajes |
| `atencion_cliente.whatsapp_chat:crear` | Crear chats, enviar mensajes |
| `atencion_cliente.whatsapp_chat:editar` | Actualizar, cerrar chats |
| `atencion_cliente.whatsapp_chat:asignar` | Asignar/desasignar chats |
| `atencion_cliente.whatsapp_ia:ver` | Ver configuraciones y stats IA |
| `atencion_cliente.whatsapp_ia:configurar` | Crear/editar configs y reglas |

---

## Notas Importantes

### Estados de Chat
- `PENDIENTE`: Nuevo chat sin asignar
- `ABIERTO`: Chat asignado a un agente
- `IA_MANEJANDO`: Chat siendo atendido por IA
- `CERRADO`: Chat finalizado

### Tipos de Mensaje
- `TEXTO`: Mensaje de texto plano
- `IMAGEN`: Imagen con caption opcional
- `VIDEO`: Video con caption opcional
- `AUDIO`: Mensaje de voz
- `DOCUMENTO`: Archivo adjunto
- `UBICACION`: Coordenadas GPS
- `CONTACTO`: Tarjeta vCard

### Seguridad
- JWT requerido en todos los endpoints (excepto webhook)
- Webhook verifica firma HMAC-SHA256
- API keys se encriptan en base de datos
- No se loguean datos sensibles
