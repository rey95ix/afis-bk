# WhatsApp Cloud API - Funcionalidades Pendientes de Implementar

> Análisis comparativo entre el módulo `afis-bk/src/modules/atencion-al-cliente/whatsapp-chat/` y la API de WhatsApp Cloud.
>
> **Fecha de análisis:** Diciembre 2024

---

## Resumen Ejecutivo

| Categoría | Implementado | Pendiente | % Completado |
|-----------|--------------|-----------|--------------|
| Mensajes Básicos | 7/7 | 0 | 100% |
| Mensajes Avanzados | 1/5 | 4 | 20% |
| Media | 4/5 | 1 | 80% |
| Templates | 4/4 | 0 | 100% |
| Flows | 0/8 | 8 | 0% |
| Gestión de Cuenta | 1/6 | 5 | 17% |
| Commerce | 0/4 | 4 | 0% |
| Utilidades | 1/5 | 4 | 20% |

**Total General: ~45% implementado**

---

## Funcionalidades Implementadas

| Funcionalidad | Estado | Ubicación en Código |
|---------------|--------|---------------------|
| Mensaje de texto | ✅ | `message/message.service.ts` |
| Mensaje con imagen | ✅ | `whatsapp-api/whatsapp-api.service.ts` |
| Mensaje con video | ✅ | `whatsapp-api/whatsapp-api.service.ts` |
| Mensaje con audio | ✅ | `whatsapp-api/whatsapp-api.service.ts` |
| Mensaje con documento | ✅ | `whatsapp-api/whatsapp-api.service.ts` |
| Mensaje de ubicación | ✅ | `message/message.service.ts` |
| Mensaje de contacto | ✅ | `message/message.service.ts` |
| Templates HSM | ✅ | `template/template.service.ts` |
| Sincronizar templates desde Meta | ✅ | `template/meta-template.service.ts` |
| Enviar template | ✅ | `template/template.service.ts` |
| Upload de media | ✅ | `message/message.service.ts` (MinIO) |
| Download de media | ✅ | `whatsapp-api/whatsapp-api.service.ts` |
| Marcar como leído | ✅ | `whatsapp-api/whatsapp-api.service.ts` |
| Webhooks entrantes | ✅ | `whatsapp-api/whatsapp-webhook.controller.ts` |
| Estados de mensaje | ✅ | `whatsapp-api/whatsapp-webhook.controller.ts` |
| Verificación webhook | ✅ | `whatsapp-api/whatsapp-api.service.ts` |

---

## Funcionalidades NO Implementadas

### 1. MENSAJES INTERACTIVOS (Prioridad: ALTA)

Permiten crear experiencias más ricas con botones y listas.

| Funcionalidad | Líneas Postman | Descripción | Prioridad |
|---------------|----------------|-------------|-----------|
| **Reply Buttons** | 5837-5925 | Botones de respuesta rápida (máx 3) | 🔴 Alta |
| **List Messages** | 5663-5749 | Menús desplegables con secciones | 🔴 Alta |
| **Reacciones** | 3111-3199 | Enviar emojis como reacción a mensajes | 🟡 Media |

**Payload ejemplo - Reply Buttons:**
```json
{
  "messaging_product": "whatsapp",
  "to": "{{phone}}",
  "type": "interactive",
  "interactive": {
    "type": "button",
    "body": { "text": "¿Cómo podemos ayudarte?" },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "btn-1", "title": "Soporte" }},
        { "type": "reply", "reply": { "id": "btn-2", "title": "Ventas" }}
      ]
    }
  }
}
```

**Payload ejemplo - List Messages:**
```json
{
  "messaging_product": "whatsapp",
  "to": "{{phone}}",
  "type": "interactive",
  "interactive": {
    "type": "list",
    "header": { "type": "text", "text": "Menú Principal" },
    "body": { "text": "Selecciona una opción:" },
    "action": {
      "button": "Ver opciones",
      "sections": [{
        "title": "Servicios",
        "rows": [
          { "id": "srv-1", "title": "Internet", "description": "Planes de fibra" },
          { "id": "srv-2", "title": "TV", "description": "Paquetes de TV" }
        ]
      }]
    }
  }
}
```

**Impacto:** Mejora significativa en UX. Permite crear menús de autoservicio.

---

### 2. STICKERS (Prioridad: BAJA)

| Funcionalidad | Líneas Postman | Descripción | Prioridad |
|---------------|----------------|-------------|-----------|
| Enviar sticker por ID | 4268-4360 | Sticker subido previamente | 🟢 Baja |
| Enviar sticker por URL | 4454-4546 | Sticker desde URL pública | 🟢 Baja |

**Restricciones:**
- Estáticos: 512x512px, máx 100KB, WebP
- Animados: 512x512px, máx 500KB, WebP

---

### 3. FLOWS (Prioridad: MEDIA)

Sistema de formularios conversacionales avanzados. Permite crear experiencias tipo "wizard".

| Funcionalidad | Líneas Postman | Descripción | Prioridad |
|---------------|----------------|-------------|-----------|
| Create Flow | 8617-8735 | Crear un nuevo flow | 🟡 Media |
| Get Flow | 8833-8893 | Obtener detalles de flow | 🟡 Media |
| List Flows | 8971-9019 | Listar flows de la cuenta | 🟡 Media |
| Update Flow JSON | 9023-9116 | Actualizar contenido del flow | 🟡 Media |
| Publish Flow | 9117-9167 | Publicar flow para producción | 🟡 Media |
| Send Flow | 9554-9832 | Enviar flow a usuario | 🟡 Media |
| Delete Flow | 9377-9427 | Eliminar flow | 🟡 Media |
| Get Flow Metrics | 10107-10422 | Métricas de uso del flow | 🟢 Baja |

**Categorías de Flow:**
- `SIGN_UP` - Registro de usuarios
- `SIGN_IN` - Inicio de sesión
- `APPOINTMENT_BOOKING` - Citas
- `LEAD_GENERATION` - Captación de leads
- `CONTACT_US` - Contacto
- `CUSTOMER_SUPPORT` - Soporte
- `SURVEY` - Encuestas
- `OTHER` - Otros

**Impacto:** Permite crear formularios complejos (encuestas, registro, soporte estructurado).

---

### 4. QR CODES (Prioridad: MEDIA)

Códigos QR para iniciar conversaciones.

| Funcionalidad | Líneas Postman | Descripción | Prioridad |
|---------------|----------------|-------------|-----------|
| Create QR Code | 12997-13146 | Crear código QR con mensaje | 🟡 Media |
| Get QR Code | 12257-12382 | Obtener QR existente | 🟡 Media |
| Get All QR Codes | 12383-12526 | Listar todos los QR | 🟡 Media |
| Get QR as SVG | 12685-12840 | Obtener imagen SVG | 🟡 Media |
| Get QR as PNG | 12841-12996 | Obtener imagen PNG | 🟡 Media |
| Update QR Code | 13147-13299 | Actualizar mensaje del QR | 🟡 Media |
| Delete QR Code | 13300-13452 | Eliminar QR | 🟡 Media |

**Impacto:** Marketing y atención presencial. QR en tiendas/oficinas.

---

### 5. COMMERCE / CATÁLOGO (Prioridad: BAJA)

Integración con catálogo de productos de Facebook/Meta.

| Funcionalidad | Líneas Postman | Descripción | Prioridad |
|---------------|----------------|-------------|-----------|
| Send Single Product | 6019-6107 | Enviar un producto | 🟢 Baja |
| Send Multi-Product | 6108-6194 | Enviar múltiples productos | 🟢 Baja |
| Send Catalog | 6195-6332 | Enviar catálogo completo | 🟢 Baja |
| Commerce Settings | 11640-11921 | Configurar comercio | 🟢 Baja |

**Nota:** Requiere configuración de Facebook Commerce Manager.

---

### 6. PAYMENTS API (Prioridad: BAJA)

Solo disponible en Singapur (SG) e India (IN).

| Funcionalidad | Líneas Postman | Descripción | Prioridad |
|---------------|----------------|-------------|-----------|
| Order Details (SG) | 11925-12011 | Enviar detalles de orden | 🟢 Baja |
| Order Status (SG) | 12012-12101 | Actualizar estado de orden | 🟢 Baja |
| Order Details (IN) | 12105-12177 | Enviar detalles de orden | 🟢 Baja |
| Order Status (IN) | 12178-12253 | Actualizar estado de orden | 🟢 Baja |

**Nota:** No aplica para Latinoamérica actualmente.

---

### 7. TYPING INDICATORS (Prioridad: MEDIA)

Indicadores de "escribiendo..." para mejor UX.

| Funcionalidad | Líneas Postman | Descripción | Prioridad |
|---------------|----------------|-------------|-----------|
| Send Typing Indicator | 11050-11197 | Mostrar "escribiendo..." | 🟡 Media |

**Payload:**
```json
{
  "messaging_product": "whatsapp",
  "status": "typing",
  "message_id": "{{wamid}}"
}
```

**Impacto:** Mejora percepción de respuesta humana, especialmente con IA.

---

### 8. BUSINESS PROFILE (Prioridad: BAJA)

Gestión del perfil de negocio.

| Funcionalidad | Líneas Postman | Descripción | Prioridad |
|---------------|----------------|-------------|-----------|
| Get Business Profile | 11473-11542 | Obtener perfil actual | 🟢 Baja |
| Update Business Profile | 11543-11639 | Actualizar info del negocio | 🟢 Baja |

**Campos actualizables:**
- `about` - Descripción
- `address` - Dirección
- `description` - Descripción larga
- `email` - Email de contacto
- `profile_picture_url` - Foto de perfil
- `websites` - Sitios web
- `vertical` - Industria

---

### 9. BLOCK USERS (Prioridad: BAJA)

Bloquear usuarios que hacen spam o abusan.

| Funcionalidad | Líneas Postman | Descripción | Prioridad |
|---------------|----------------|-------------|-----------|
| Get Blocked Users | 13949-14084 | Listar usuarios bloqueados | 🟢 Baja |
| Block User(s) | 14085-14226 | Bloquear uno o más usuarios | 🟢 Baja |
| Unblock User(s) | 14227-14371 | Desbloquear usuarios | 🟢 Baja |

---

### 10. ANALYTICS DE META (Prioridad: MEDIA)

Métricas directamente desde la API de Meta.

| Funcionalidad | Líneas Postman | Descripción | Prioridad |
|---------------|----------------|-------------|-----------|
| Get Analytics | 13603-13675 | Métricas generales | 🟡 Media |
| Get Conversation Analytics | 13676-13770 | Análisis de conversaciones | 🟡 Media |

**Nota:** El sistema ya tiene analytics propios, pero estos son los oficiales de Meta.

---

### 11. GESTIÓN AVANZADA DE CUENTA (Prioridad: BAJA)

| Funcionalidad | Líneas Postman | Descripción | Prioridad |
|---------------|----------------|-------------|-----------|
| Get Credit Lines | 13771-13845 | Ver líneas de crédito/billing | 🟢 Baja |
| Phone Number Verification | 1109-1296 | Verificar número con código | 🟢 Baja |
| Two-Step Verification | 1297-1410 | Configurar 2FA | 🟢 Baja |
| Display Name Status | 1006-1075 | Estado del nombre visible | 🟢 Baja |
| Business Compliance (IN) | 14372-14655 | Cumplimiento India | 🟢 Baja |

---

### 12. WEBHOOKS AVANZADOS (Prioridad: MEDIA)

Eventos adicionales de webhook no procesados.

| Evento | Líneas Postman | Descripción | Estado |
|--------|----------------|-------------|--------|
| Text Message | 1893-1934 | Mensaje de texto | ✅ Implementado |
| Image Message | 1956-1997 | Imagen recibida | ✅ Implementado |
| Sticker Message | 1977-2018 | Sticker recibido | ❌ Pendiente |
| Contact Message | 1998-2039 | Contacto recibido | ✅ Implementado |
| Location Message | 2019-2059 | Ubicación recibida | ✅ Implementado |
| Interactive Reply | 2102-2143 | Respuesta de botón/lista | ❌ Pendiente |
| Product Enquiry | 2290-2330 | Consulta de producto | ❌ Pendiente |
| Order Message | 2311-2377 | Mensaje de orden | ❌ Pendiente |
| Reaction | 1935-1955 | Reacción recibida | ❌ Pendiente |
| Message Deleted | 2248-2289 | Mensaje eliminado | ❌ Pendiente |

---

## Priorización Sugerida

### Fase 1: Quick Wins (Alta Prioridad)
1. **Reply Buttons** - Mejora inmediata en UX
2. **List Messages** - Menús de autoservicio
3. **Procesar Interactive Reply en webhook** - Complemento de lo anterior

### Fase 2: Mejoras de UX (Media Prioridad)
4. **Typing Indicators** - "Escribiendo..." antes de responder
5. **Reacciones** - Enviar y recibir reacciones
6. **QR Codes** - Para marketing presencial

### Fase 3: Funcionalidades Avanzadas (Media Prioridad)
7. **Flows** - Formularios conversacionales
8. **Analytics de Meta** - Complementar analytics propios

### Fase 4: Nice to Have (Baja Prioridad)
9. **Stickers** - Personalización
10. **Commerce/Catálogo** - Si aplica al negocio
11. **Business Profile** - Gestión desde el sistema
12. **Block Users** - Moderación

### No Aplica (Omitir)
- Payments API (no disponible en LATAM)
- Business Compliance India
- OnPrem Migration (ya están en Cloud)

---

## Referencias al Archivo Postman

Para buscar detalles específicos en `WhatsApp Cloud API.postman_collection.json`:

```bash
# Buscar sección de Interactive Messages
sed -n '5663,5925p' "WhatsApp Cloud API.postman_collection.json"

# Buscar sección de Flows
sed -n '8614,10423p' "WhatsApp Cloud API.postman_collection.json"

# Buscar sección de QR Codes
sed -n '12254,13452p' "WhatsApp Cloud API.postman_collection.json"

# Buscar estructura de webhooks
sed -n '1414,2377p' "WhatsApp Cloud API.postman_collection.json"
```

---

## Estimación de Esfuerzo

| Funcionalidad | Complejidad | Archivos a Modificar |
|---------------|-------------|----------------------|
| Reply Buttons | Baja | `whatsapp-api.service.ts`, `message.service.ts`, DTOs |
| List Messages | Baja | `whatsapp-api.service.ts`, `message.service.ts`, DTOs |
| Interactive Webhook | Media | `whatsapp-webhook.controller.ts`, `message.service.ts` |
| Typing Indicators | Baja | `whatsapp-api.service.ts` (nuevo método) |
| Reacciones | Baja | `whatsapp-api.service.ts`, `message.service.ts` |
| QR Codes | Media | Nuevo servicio + controller |
| Flows | Alta | Nuevo módulo completo |
| Commerce | Alta | Nuevo módulo + integración FB |

---

## Conclusión

El módulo actual cubre aproximadamente el **45%** de las funcionalidades de la API de WhatsApp Cloud. Las funcionalidades más críticas pendientes son:

1. **Mensajes interactivos (botones/listas)** - Esencial para UX moderna
2. **Procesamiento de respuestas interactivas** - Complemento necesario
3. **Typing indicators** - Mejora percepción de respuesta

Con la implementación de la Fase 1, se alcanzaría aproximadamente el **65%** de cobertura, cubriendo los casos de uso más comunes de atención al cliente.

---

**Última actualización:** Diciembre 2024
**Archivo Postman de referencia:** `WhatsApp Cloud API.postman_collection.json` (667KB)
