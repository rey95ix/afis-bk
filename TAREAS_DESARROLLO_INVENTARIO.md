# AFIS - Cumplimiento Politicas Inventario

**Proyecto:** Implementacion de mejoras al modulo de inventario para cumplir con las politicas establecidas
**Referencia:** COMPARATIVA_POLITICAS_INVENTARIO.md
**Total de Tareas:** 23
**Fecha:** Diciembre 2024

---

## Instrucciones para Notion

Para importar estas tareas a Notion:
1. Crear una base de datos con columnas: Nombre | Estado | Track | Prioridad
2. Copiar cada tarea de la seccion correspondiente
3. Estado inicial: "Pendiente"

---

## TAREAS PRIORIDAD ALTA

### Backend - Alta Prioridad

```
Nombre: schema.prisma - agregar campos ROP a catalogo (lead_time_dias, demanda_promedio_diaria, stock_seguridad, punto_reorden)
Track: Backend
Prioridad: Alta
Estado: Pendiente
Descripcion: Agregar al modelo catalogo los campos necesarios para calcular el Punto de Reorden (ROP) y Stock de Seguridad (SS) segun la politica de inventario.
Archivos: prisma/schema.prisma
```

```
Nombre: items-inventario.service - implementar logica FIFO en asignacion de series
Track: Backend
Prioridad: Alta
Estado: Pendiente
Descripcion: Implementar sistema First-In-First-Out para asignacion de series. Los equipos mas antiguos (fecha_ingreso ASC) deben asignarse primero para evitar obsolescencia.
Archivos: src/modules/inventario/items-inventario/items-inventario.service.ts
```

```
Nombre: items-inventario.service - crear endpoint GET /alertas-stock-bajo
Track: Backend
Prioridad: Alta
Estado: Pendiente
Descripcion: Crear endpoint que retorne items con cantidad_disponible <= cantidad_minima para alertar sobre productos que necesitan reposicion.
Archivos: src/modules/inventario/items-inventario/items-inventario.controller.ts, items-inventario.service.ts
```

```
Nombre: items-inventario.service - calcular ROP automatico (D_prom * LT + SS)
Track: Backend
Prioridad: Alta
Estado: Pendiente
Descripcion: Implementar calculo automatico del Punto de Reorden usando formula: ROP = (Demanda Promedio Diaria * Lead Time) + Stock Seguridad
Archivos: src/modules/inventario/items-inventario/items-inventario.service.ts
```

```
Nombre: schema.prisma - agregar estados EN_REPARACION, EN_INSPECCION a estado_inventario
Track: Backend
Prioridad: Alta
Estado: Pendiente
Descripcion: Agregar nuevos estados al enum estado_inventario para manejar equipos devueltos que requieren revision antes de volver a estar disponibles.
Archivos: prisma/schema.prisma
```

```
Nombre: requisiciones.service - implementar workflow inspeccion post-devolucion
Track: Backend
Prioridad: Alta
Estado: Pendiente
Descripcion: Crear flujo de trabajo para equipos devueltos: Devolucion -> Estado EN_INSPECCION -> (DISPONIBLE | EN_REPARACION | DEFECTUOSO)
Archivos: src/modules/inventario/requisiciones/requisiciones.service.ts
```

### Frontend - Alta Prioridad

```
Nombre: devoluciones.component - crear flujo de inspeccion post-devolucion
Track: Frontend
Prioridad: Alta
Estado: Pendiente
Descripcion: Crear interfaz para el proceso de inspeccion de equipos devueltos con opciones de clasificacion (Reutilizable, Reparacion, Dano Permanente)
Archivos: src/app/components/inventario/devoluciones/ (nuevo)
```

```
Nombre: series.component - mostrar estado EN_REPARACION, EN_INSPECCION
Track: Frontend
Prioridad: Alta
Estado: Pendiente
Descripcion: Actualizar componente de series para mostrar los nuevos estados con badges/iconos apropiados y filtros correspondientes.
Archivos: src/app/components/inventario/items-inventario/
```

---

## TAREAS PRIORIDAD MEDIA

### Backend - Media Prioridad

```
Nombre: metricas-inventario.service - implementar calculo automatico de KPIs
Track: Backend
Prioridad: Media
Estado: Pendiente
Descripcion: Crear servicio para calcular y almacenar metricas de inventario periodicamente (diario/semanal/mensual)
Archivos: src/modules/inventario/metricas-inventario/ (nuevo o existente)
```

```
Nombre: metricas-inventario.service - calcular Precision Inventario (%)
Track: Backend
Prioridad: Media
Estado: Pendiente
Descripcion: Implementar formula: (Inventario Fisico / Inventario Sistema) * 100. Objetivo > 98%
Archivos: src/modules/inventario/metricas-inventario/
```

```
Nombre: metricas-inventario.service - calcular Tasa de Rotacion
Track: Backend
Prioridad: Media
Estado: Pendiente
Descripcion: Implementar formula: Costo de Bienes Vendidos / Inventario Promedio. Usar movimientos tipo SALIDA.
Archivos: src/modules/inventario/metricas-inventario/
```

```
Nombre: metricas-inventario.service - calcular Stock-Out Rate
Track: Backend
Prioridad: Media
Estado: Pendiente
Descripcion: Calcular frecuencia de ordenes/OT que no se pudieron completar por falta de stock. Objetivo: 0%
Archivos: src/modules/inventario/metricas-inventario/
```

```
Nombre: schema.prisma - agregar vida_util_meses a catalogo
Track: Backend
Prioridad: Media
Estado: Pendiente
Descripcion: Agregar campo para definir la vida util de cada producto y poder identificar equipos obsoletos
Archivos: prisma/schema.prisma
```

```
Nombre: items-inventario.service - crear endpoint GET /items-obsoletos (vida util vencida)
Track: Backend
Prioridad: Media
Estado: Pendiente
Descripcion: Endpoint que retorne series cuya fecha_ingreso + vida_util ha sido superada
Archivos: src/modules/inventario/items-inventario/
```

```
Nombre: auditorias-inventario.service - agregar programacion automatica trimestral
Track: Backend
Prioridad: Media
Estado: Pendiente
Descripcion: Crear sistema de programacion automatica de auditorias completas cada trimestre
Archivos: src/modules/inventario/auditorias-inventario/
```

```
Nombre: ordenes-salida.service - agregar tipo DESTRUCCION_CERTIFICADA
Track: Backend
Prioridad: Media
Estado: Pendiente
Descripcion: Agregar tipo de orden de salida para equipos que requieren destruccion certificada por seguridad
Archivos: prisma/schema.prisma, src/modules/inventario/ordenes-salida/
```

### Frontend - Media Prioridad

```
Nombre: dashboard-inventario - crear vista de alertas stock bajo
Track: Frontend
Prioridad: Media
Estado: Pendiente
Descripcion: Crear componente/vista que muestre lista de productos bajo el punto de reorden con acciones rapidas
Archivos: src/app/components/inventario/dashboard/
```

```
Nombre: dashboard-inventario - crear graficos de KPIs
Track: Frontend
Prioridad: Media
Estado: Pendiente
Descripcion: Crear graficos para visualizar: Precision Inventario, Tasa Rotacion, Stock-Out Rate, Items bajo minimo
Archivos: src/app/components/inventario/dashboard/
```

```
Nombre: catalogo.component - agregar campos ROP/SS en formulario
Track: Frontend
Prioridad: Media
Estado: Pendiente
Descripcion: Actualizar formulario de catalogo para incluir campos de Lead Time, Demanda Promedio, Stock Seguridad
Archivos: src/app/components/inventario/catalogo/
```

```
Nombre: items-inventario.component - mostrar indicador FIFO (antiguedad)
Track: Frontend
Prioridad: Media
Estado: Pendiente
Descripcion: Agregar columna/indicador que muestre la antiguedad de cada serie y destaque las mas antiguas
Archivos: src/app/components/inventario/items-inventario/
```

```
Nombre: auditorias.component - agregar boton programar auditoria trimestral
Track: Frontend
Prioridad: Media
Estado: Pendiente
Descripcion: Agregar funcionalidad para programar auditorias con frecuencia predefinida
Archivos: src/app/components/inventario/auditorias-inventario/
```

---

## TAREAS PRIORIDAD BAJA

### Backend - Baja Prioridad

```
Nombre: compras.service - agregar campo estado_fisico en recepcion
Track: Backend
Prioridad: Baja
Estado: Pendiente
Descripcion: Agregar campo opcional para registrar el estado fisico de los equipos al momento de la recepcion
Archivos: prisma/schema.prisma, src/modules/inventario/compras/
```

```
Nombre: salidas-temporales-ot - considerar integracion firma digital
Track: Backend
Prioridad: Baja
Estado: Pendiente
Descripcion: Evaluar e implementar sistema de firma digital para reemplazar la foto del formulario fisico
Archivos: src/modules/inventario/salidas-temporales-ot/
```

---

## RESUMEN POR TRACK

| Track | Alta | Media | Baja | Total |
|-------|------|-------|------|-------|
| Backend | 6 | 8 | 2 | **16** |
| Frontend | 2 | 5 | 0 | **7** |
| **Total** | **8** | **13** | **2** | **23** |

---

## ORDEN DE IMPLEMENTACION SUGERIDO

### Fase 1: Infraestructura (Schema y Estados)
1. schema.prisma - agregar campos ROP a catalogo
2. schema.prisma - agregar estados EN_REPARACION, EN_INSPECCION
3. schema.prisma - agregar vida_util_meses

### Fase 2: Logica de Negocio Backend
4. items-inventario.service - implementar logica FIFO
5. items-inventario.service - crear endpoint alertas-stock-bajo
6. items-inventario.service - calcular ROP automatico
7. requisiciones.service - workflow inspeccion post-devolucion

### Fase 3: KPIs y Metricas
8. metricas-inventario.service - calculo automatico KPIs
9. metricas-inventario.service - Precision Inventario
10. metricas-inventario.service - Tasa de Rotacion
11. metricas-inventario.service - Stock-Out Rate

### Fase 4: Frontend Critico
12. series.component - mostrar nuevos estados
13. devoluciones.component - flujo inspeccion

### Fase 5: Frontend Dashboard
14. dashboard-inventario - alertas stock bajo
15. dashboard-inventario - graficos KPIs
16. catalogo.component - campos ROP/SS
17. items-inventario.component - indicador FIFO

### Fase 6: Mejoras Adicionales
18. auditorias - programacion trimestral
19. ordenes-salida - tipo DESTRUCCION_CERTIFICADA
20. items-inventario - endpoint items-obsoletos
21. auditorias.component - boton programar

### Fase 7: Opcionales
22. compras - campo estado_fisico
23. salidas-temporales - firma digital

---

## ARCHIVOS CLAVE A MODIFICAR

### Prisma Schema
- `prisma/schema.prisma`
  - Modificar: enum estado_inventario
  - Modificar: model catalogo
  - Modificar: enum tipo_orden_salida

### Backend Services
- `src/modules/inventario/items-inventario/items-inventario.service.ts`
- `src/modules/inventario/items-inventario/items-inventario.controller.ts`
- `src/modules/inventario/requisiciones/requisiciones.service.ts`
- `src/modules/inventario/auditorias-inventario/auditorias-inventario.service.ts`
- `src/modules/inventario/ordenes-salida/ordenes-salida.service.ts`
- `src/modules/inventario/compras/compras.service.ts`
- `src/modules/inventario/metricas-inventario/` (nuevo modulo)

### Frontend Components
- `src/app/components/inventario/dashboard/` (nuevo o modificar)
- `src/app/components/inventario/catalogo/`
- `src/app/components/inventario/items-inventario/`
- `src/app/components/inventario/auditorias-inventario/`
- `src/app/components/inventario/devoluciones/` (nuevo)

---

## CRITERIOS DE ACEPTACION GLOBALES

- Todos los cambios de schema requieren migracion de Prisma
- Nuevos endpoints deben documentarse con Swagger
- Frontend debe incluir validaciones de formulario
- Tests unitarios para logica critica (FIFO, ROP)
- Cumplir con politica de inventario documentada

---

*Documento generado para importacion manual a Notion*
*Referencia: COMPARATIVA_POLITICAS_INVENTARIO.md*
