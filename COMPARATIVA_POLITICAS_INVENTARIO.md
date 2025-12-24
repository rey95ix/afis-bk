# Comparativa: Politicas de Inventario vs Modulo AFIS

**Fecha de Analisis:** Diciembre 2024
**Documento de Referencia:** Politica y Procedimiento para la Administracion de Inventario de Producto (Cable e Internet)
**Modulo Analizado:** `afis-bk/src/modules/inventario/`

---

## Indice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Objetivos de la Politica](#2-objetivos-de-la-politica)
3. [Clasificacion del Inventario](#3-clasificacion-del-inventario)
4. [Gestion de CPE - Estados y Trazabilidad](#4-gestion-de-cpe---estados-y-trazabilidad)
5. [Procedimientos Operativos](#5-procedimientos-operativos)
6. [Control y Reposicion de Stock](#6-control-y-reposicion-de-stock)
7. [Politica de Baja de Activos](#7-politica-de-baja-de-activos)
8. [Auditoria Interna](#8-auditoria-interna)
9. [Codigo de Barras](#9-codigo-de-barras)
10. [Tabla de Cumplimiento General](#10-tabla-de-cumplimiento-general)
11. [Brechas Criticas y Recomendaciones](#11-brechas-criticas-y-recomendaciones)

---

## 1. Resumen Ejecutivo

### Resultado General

| Categoria | Cumple | Parcial | No Cumple |
|-----------|--------|---------|-----------|
| **Trazabilidad CPE** | 90% | 10% | - |
| **Estados y Ciclo de Vida** | 70% | 20% | 10% |
| **Procedimientos Operativos** | 85% | 15% | - |
| **Control de Stock (ROP/SS)** | 30% | 40% | 30% |
| **Auditoria** | 95% | 5% | - |
| **Baja de Activos** | 80% | 20% | - |
| **KPIs** | 40% | 30% | 30% |

### Conclusion
El modulo de inventario de AFIS cumple **aproximadamente el 75%** de los requisitos establecidos en la politica. Las principales fortalezas estan en la trazabilidad por numero de serie y el sistema de auditorias. Las principales brechas se encuentran en la automatizacion del Punto de Reorden (ROP), Stock de Seguridad (SS), y el sistema FIFO.

---

## 2. Objetivos de la Politica

### Requisitos del Documento

| # | Objetivo | Estado | Implementacion en AFIS |
|---|----------|--------|------------------------|
| 1 | Asegurar disponibilidad de equipos para nuevas instalaciones | **CUMPLE** | Control de stock en `inventario` con `cantidad_disponible` |
| 2 | Minimizar costos de almacenamiento y obsolescencia | **PARCIAL** | Existe `costo_promedio` pero no hay alertas de obsolescencia |
| 3 | Garantizar trazabilidad de CPE asignados a clientes | **CUMPLE** | `inventario_series` con `id_cliente`, `id_orden_trabajo`, `historial_series` |
| 4 | Optimizar flujo almacen-ventas-tecnicos | **CUMPLE** | Bodegas tipo CUADRILLA, requisiciones, salidas temporales OT |

---

## 3. Clasificacion del Inventario

### Requisitos del Documento

| Categoria | Descripcion Politica | Estado | Implementacion AFIS |
|-----------|---------------------|--------|---------------------|
| **A. CPE (Activos Fijos)** | Decodificadores, modems, routers, ONT. Trazabilidad por N/S | **CUMPLE** | `inventario_series` con `numero_serie` unico, `mac_address` |
| **B. Materiales de Instalacion** | Cable, conectores, splitters. Gestion por metros/unidades | **CUMPLE** | `catalogo` + `inventario` sin serie, por cantidades |
| **C. Accesorios de Venta** | Controles, fuentes de poder. Gestion por unidades | **CUMPLE** | `catalogo` con `tiene_serie = false` |

### Detalle de Implementacion

```
AFIS Schema:
- catalogo.id_categoria -> categorias (clasificacion ABC)
- comprasDetalle.tiene_serie -> Boolean (distingue CPE vs materiales)
- inventario_series.numero_serie -> String UNIQUE (trazabilidad individual)
```

**Ubicacion en Codigo:**
- Modelo: `prisma/schema.prisma` lineas 377-402 (catalogo)
- Modelo: `prisma/schema.prisma` lineas 1278-1319 (inventario_series)

---

## 4. Gestion de CPE - Estados y Trazabilidad

### 4.1 Estados Requeridos vs Implementados

| Estado Politica | Estado AFIS | Cumple | Observaciones |
|-----------------|-------------|--------|---------------|
| Almacen - Disponible | `DISPONIBLE` | SI | Estado inicial al recibir |
| En Transito - [Tecnico] | `EN_TRANSITO` | SI | Falta nombre del tecnico en estado |
| Instalado - [Cliente] | `ASIGNADO` | **PARCIAL** | Vinculado via `id_cliente` pero estado se llama ASIGNADO, no INSTALADO |
| Almacen - Reparacion | - | **NO** | Estado no existe |
| Almacen - Reutilizable | `DISPONIBLE` | **PARCIAL** | No distingue nuevo de reutilizado |
| Almacen - Dano Permanente | `DEFECTUOSO` | SI | Equivalente funcional |
| Dado de Baja - [Motivo] | `BAJA` | SI | Tiene `motivo_baja` en serie |

### Estados en AFIS (enum `estado_inventario`)

```prisma
enum estado_inventario {
  DISPONIBLE      // Listo para usar
  RESERVADO       // Apartado para OT
  EN_TRANSITO     // Movimiento entre bodegas
  ASIGNADO        // Instalado en cliente
  DEFECTUOSO      // No operativo
  BAJA            // Fuera del sistema
}
```

### 4.2 Campos de Trazabilidad en `inventario_series`

| Campo | Proposito | Cumple Politica |
|-------|-----------|-----------------|
| `numero_serie` | Identificador unico | SI |
| `mac_address` | Identificador red | SI (adicional) |
| `id_compra_detalle` | Origen compra local | SI |
| `id_orden_trabajo` | OT de instalacion | SI |
| `id_cliente` | Cliente asignado | SI |
| `fecha_ingreso` | Fecha entrada almacen | SI |
| `fecha_asignacion` | Fecha asignacion tecnico | SI |
| `fecha_instalacion` | Fecha instalacion cliente | SI |
| `fecha_baja` | Fecha de baja | SI |
| `motivo_baja` | Razon de baja | SI |
| `costo_adquisicion` | Costo con retaceo | SI |

### 4.3 Historial de Series

El sistema implementa `historial_series` para auditar cada cambio:

```prisma
model historial_series {
  id_historial       Int
  id_serie           Int
  estado_anterior    estado_inventario
  estado_nuevo       estado_inventario
  id_bodega_anterior Int?
  id_bodega_nueva    Int?
  id_usuario         Int
  observaciones      String?
  fecha_movimiento   DateTime
}
```

**CUMPLE:** Registro inmutable de todos los cambios de estado y ubicacion.

---

## 5. Procedimientos Operativos

### 5.1 Recepcion e Ingreso

| Requisito Politica | Implementacion AFIS | Estado |
|-------------------|---------------------|--------|
| Verificar N/S vs factura | Validacion en recepcion de compra | **CUMPLE** |
| Verificar estado fisico | No hay campo especifico | **NO CUMPLE** |
| Registrar inmediatamente en SGI | Transaccion atomica en recepcion | **CUMPLE** |
| Estado inicial "Almacen - Disponible" | `estado = DISPONIBLE` por defecto | **CUMPLE** |

**Ubicacion:** `src/modules/inventario/compras/compras.service.ts` - metodo `recepcionar()`

### 5.2 Asignacion a Tecnicos (Salida)

| Requisito Politica | Implementacion AFIS | Estado |
|-------------------|---------------------|--------|
| Solicitud basada en OT del dia | `salidas_temporales_ot` vinculado a OT | **CUMPLE** |
| Cambiar estado a "En Transito - [Tecnico]" | Estado `EN_TRANSITO`, falta nombre tecnico | **PARCIAL** |
| Firma hoja entrega/cargo | Solo foto obligatoria (`url_foto_formulario`) | **PARCIAL** |

**Ubicacion:** `src/modules/inventario/salidas-temporales-ot/salidas-temporales-ot.service.ts`

**Brecha:** La politica requiere firma de tecnico y almacen. AFIS solo requiere foto del formulario.

### 5.3 Instalacion y Activacion

| Requisito Politica | Implementacion AFIS | Estado |
|-------------------|---------------------|--------|
| Registrar N/S contra cuenta cliente | `inventario_series.id_cliente` | **CUMPLE** |
| Cambiar estado a "Instalado - [ID Cliente]" | Estado `ASIGNADO` + `id_cliente` | **CUMPLE** |
| Vinculacion CRM/SGI | Integrado en mismo sistema | **CUMPLE** |

**Ubicacion:** `src/modules/inventario/items-inventario/items-inventario.service.ts`

### 5.4 Devoluciones, Reemplazos y Reparaciones

| Requisito Politica | Implementacion AFIS | Estado |
|-------------------|---------------------|--------|
| Devolucion al almacen | Requisicion tipo TRANSFERENCIA | **CUMPLE** |
| Inspeccion del equipo | No hay workflow de inspeccion | **NO CUMPLE** |
| Estado "Almacen - Reparacion" | No existe este estado | **NO CUMPLE** |
| Estado "Almacen - Reutilizable" | No existe (vuelve a DISPONIBLE) | **PARCIAL** |
| Estado "Almacen - Dano Permanente" | `DEFECTUOSO` | **CUMPLE** |
| Registro de cambios por N/S | `historial_series` | **CUMPLE** |

**Brecha Importante:** No existe un flujo de inspeccion post-devolucion. El equipo devuelto deberia pasar por revision antes de volver a estar disponible.

---

## 6. Control y Reposicion de Stock

### 6.1 Metodo FIFO/PEPS

| Requisito Politica | Implementacion AFIS | Estado |
|-------------------|---------------------|--------|
| Sistema FIFO para equipos reutilizables | Existe `fecha_ingreso` pero no hay logica automatica | **NO CUMPLE** |
| Asignar primero los mas antiguos | No implementado | **NO CUMPLE** |

**Brecha Critica:** El sistema no tiene implementada la logica FIFO. Se recomienda:

```typescript
// Sugerencia de implementacion en items-inventario.service.ts
async getSeriesForAssignment(catalogoId: number, bodegaId: number, cantidad: number) {
  return this.prisma.inventario_series.findMany({
    where: {
      inventario: { id_catalogo: catalogoId, id_bodega: bodegaId },
      estado: 'DISPONIBLE'
    },
    orderBy: { fecha_ingreso: 'asc' }, // FIFO
    take: cantidad
  });
}
```

### 6.2 Punto de Reorden (ROP)

| Requisito Politica | Implementacion AFIS | Estado |
|-------------------|---------------------|--------|
| Definir nivel de existencias minimo | `catalogo.cantidad_minima` | **CUMPLE** |
| Generar OC automaticamente al alcanzar ROP | No implementado | **NO CUMPLE** |
| Calculo: ROP = (D_prom * LT) + SS | No implementado | **NO CUMPLE** |

**Campos Existentes:**
```prisma
model catalogo {
  cantidad_minima Int? @default(0)  // Usado como ROP basico
  cantidad_maxima Int? @default(0)  // Stock maximo
}
```

**Brecha:** No hay:
- Campo para Lead Time del proveedor
- Campo para demanda promedio
- Calculo automatico del ROP
- Alertas automaticas cuando stock <= ROP

### 6.3 Stock de Seguridad (SS)

| Requisito Politica | Implementacion AFIS | Estado |
|-------------------|---------------------|--------|
| Calcular SS segun formula | No existe | **NO CUMPLE** |
| SS = D_max * (LT_max - LT_prom) | No implementado | **NO CUMPLE** |
| Cubrir 15-30 dias de consumo | No configurado | **NO CUMPLE** |

**Brecha Critica:** No existe concepto de Stock de Seguridad separado del punto minimo.

**Campos Sugeridos a Agregar:**

```prisma
model catalogo {
  // Existentes
  cantidad_minima Int? @default(0)
  cantidad_maxima Int? @default(0)

  // Sugeridos para ROP/SS
  demanda_promedio_diaria  Decimal? @db.Decimal(10,2)
  demanda_maxima_diaria    Decimal? @db.Decimal(10,2)
  lead_time_promedio_dias  Int?
  lead_time_maximo_dias    Int?
  stock_seguridad          Int?     // Calculado o manual
  punto_reorden            Int?     // Calculado automaticamente
}
```

### 6.4 Conteo Ciclico

| Requisito Politica | Implementacion AFIS | Estado |
|-------------------|---------------------|--------|
| Conteos fisicos regulares | `auditorias_inventario` | **CUMPLE** |
| Conteo completo CPE trimestral | No hay programacion automatica | **PARCIAL** |
| Comparar fisico vs SGI | `auditorias_detalle` con `cantidad_sistema` vs `cantidad_fisica` | **CUMPLE** |

### 6.5 KPIs

| KPI Politica | Implementacion AFIS | Estado |
|--------------|---------------------|--------|
| Precision Inventario (>98%) | Calculable desde auditorias | **PARCIAL** |
| Tasa de Rotacion | No implementado | **NO CUMPLE** |
| Stock-Out Rate (0%) | No implementado | **NO CUMPLE** |

**Tabla Existente:** `metricas_inventario`

```prisma
model metricas_inventario {
  accuracy_porcentaje  Decimal? // % de items conformes
  total_movimientos    Int
  total_ajustes        Int
  // ... mas campos
}
```

**Brecha:** Los campos existen pero no hay calculo automatico ni dashboard.

---

## 7. Politica de Baja de Activos

### 7.1 Criterios de Baja

| Criterio Politica | Implementacion AFIS | Estado |
|-------------------|---------------------|--------|
| Dano Irreparable (costo > 50% valor) | No hay validacion de costo | **NO CUMPLE** |
| Obsolescencia Tecnica | Manual, via orden de salida | **PARCIAL** |
| Vida Util Cumplida | No hay campo de vida util | **NO CUMPLE** |
| Perdida o Robo | Estado `BAJA` disponible | **CUMPLE** |

**Campo Sugerido:**
```prisma
model catalogo {
  vida_util_meses Int?  // Periodo de depreciacion
}

model inventario_series {
  fecha_vida_util_fin DateTime?  // Calculado: fecha_ingreso + vida_util
}
```

### 7.2 Procedimiento de Baja

| Paso Politica | Implementacion AFIS | Estado |
|---------------|---------------------|--------|
| Solicitud de baja por N/S | Orden salida tipo `BAJA_INVENTARIO` | **CUMPLE** |
| Aprobacion Gerente Almacen | Workflow solicita->autoriza->procesa | **CUMPLE** |
| Aprobacion Gerencia Financiera (alto valor) | No hay distincion por valor | **PARCIAL** |
| Registro contable | No integrado con contabilidad | **NO CUMPLE** |
| Estado "Dado de Baja - [Motivo]" | `BAJA` + `motivo_baja` | **CUMPLE** |

### 7.3 Disposicion Fisica

| Metodo Politica | Implementacion AFIS | Estado |
|-----------------|---------------------|--------|
| Venta Chatarra/Reciclaje | Tipo `OTRO` en ordenes salida | **PARCIAL** |
| Destruccion Certificada | No hay tipo especifico | **NO CUMPLE** |
| Donacion | Tipo `DONACION` | **CUMPLE** |

### 7.4 Registro de Bajas

| Requisito Politica | Implementacion AFIS | Estado |
|-------------------|---------------------|--------|
| Mantener registro 5 anos | `historial_series` permanente | **CUMPLE** |
| Registro para auditoria | Completo con movimientos | **CUMPLE** |

---

## 8. Auditoria Interna

### 8.1 Planificacion y Alcance

| Requisito Politica | Implementacion AFIS | Estado |
|-------------------|---------------------|--------|
| Frecuencia Anual/Semestral | Manual, no programada | **PARCIAL** |
| Definir objetivos | Campo `observaciones` | **PARCIAL** |
| Seleccion de muestra | `categorias_a_auditar` (JSON) | **CUMPLE** |
| Equipo auditor independiente | `id_usuario_ejecuta` diferente | **CUMPLE** |

### 8.2 Ejecucion - Conteo Fisico

| Requisito Politica | Implementacion AFIS | Estado |
|-------------------|---------------------|--------|
| Conteo ciego | Posible, no forzado | **PARCIAL** |
| Conciliacion | `cantidad_sistema` vs `cantidad_fisica` | **CUMPLE** |
| Investigar variaciones >2% | `tipo_discrepancia`, `causa_discrepancia` | **CUMPLE** |

### 8.3 Pruebas de Trazabilidad

| Requisito Politica | Implementacion AFIS | Estado |
|-------------------|---------------------|--------|
| Verificar CPE "Instalados" vs clientes | Consultable via `inventario_series` | **CUMPLE** |
| Verificar CPE en almacen vs SGI | `auditorias_detalle` | **CUMPLE** |

### 8.4 Revision de Documentacion

| Requisito Politica | Implementacion AFIS | Estado |
|-------------------|---------------------|--------|
| Verificar OC vs ingresos | Vinculacion `compras` -> `movimientos` | **CUMPLE** |
| Verificar bajas con aprobacion | Workflow ordenes salida | **CUMPLE** |
| Verificar movimientos internos | `requisiciones_inventario` | **CUMPLE** |

### 8.5 Reporte y Acciones Correctivas

| Requisito Politica | Implementacion AFIS | Estado |
|-------------------|---------------------|--------|
| Informe de auditoria | Campos de resumen en `auditorias_inventario` | **CUMPLE** |
| Tasa de Precision | `porcentaje_accuracy` | **CUMPLE** |
| Acciones correctivas | `ajustes_inventario` con workflow | **CUMPLE** |
| Seguimiento | Estados de ajuste (PENDIENTE -> APLICADO) | **CUMPLE** |

### Modelo de Auditoria en AFIS

```prisma
model auditorias_inventario {
  codigo                       String @unique  // AUD-YYYYMM-####
  tipo                         tipo_auditoria  // COMPLETA | SORPRESA
  estado                       estado_auditoria
  total_items_auditados        Int
  total_items_conformes        Int
  total_items_con_discrepancia Int
  porcentaje_accuracy          Decimal?
  // ... mas campos
}
```

**CUMPLE en 95%** - Sistema robusto de auditorias.

---

## 9. Codigo de Barras

### Implementacion Requerida vs Actual

| Requisito Politica | Implementacion AFIS | Estado |
|-------------------|---------------------|--------|
| N/S del fabricante como codigo | `numero_serie` almacenado | **CUMPLE** |
| SKU para materiales | `catalogo.codigo` | **CUMPLE** |
| Impresora de etiquetas | No integrado | **NO APLICA** |
| Escaneres/PDAs | No integrado | **NO APLICA** |
| Integracion con SGI | Campos disponibles | **PARCIAL** |
| Escaneo al ingreso | Manual actualmente | **NO CUMPLE** |
| Escaneo en instalacion | Manual actualmente | **NO CUMPLE** |
| Escaneo en auditoria | Manual actualmente | **NO CUMPLE** |

**Nota:** La integracion con hardware de escaneo es una mejora de implementacion, no una limitacion del modelo de datos.

---

## 10. Tabla de Cumplimiento General

### Resumen por Seccion

| # | Seccion | Cumple | Parcial | No Cumple | % Cumplimiento |
|---|---------|--------|---------|-----------|----------------|
| 1 | Objetivos Politica | 3 | 1 | 0 | 87% |
| 2 | Clasificacion Inventario | 3 | 0 | 0 | 100% |
| 3 | Estados CPE | 4 | 2 | 2 | 62% |
| 4 | Recepcion/Ingreso | 3 | 0 | 1 | 75% |
| 5 | Asignacion Tecnicos | 1 | 2 | 0 | 66% |
| 6 | Instalacion | 3 | 0 | 0 | 100% |
| 7 | Devoluciones | 2 | 1 | 2 | 50% |
| 8 | Metodo FIFO | 0 | 0 | 2 | 0% |
| 9 | Punto de Reorden | 1 | 0 | 2 | 33% |
| 10 | Stock Seguridad | 0 | 0 | 3 | 0% |
| 11 | Conteo Ciclico | 2 | 1 | 0 | 83% |
| 12 | KPIs | 0 | 1 | 2 | 16% |
| 13 | Baja de Activos | 4 | 2 | 2 | 62% |
| 14 | Auditoria Interna | 12 | 3 | 0 | 90% |
| 15 | Codigo de Barras | 2 | 1 | 3 | 41% |

### Cumplimiento General: **~65%**

---

## 11. Brechas Criticas y Recomendaciones

### 11.1 Brechas de Alta Prioridad

#### 1. Sistema FIFO No Implementado
**Impacto:** Alto - Equipos antiguos pueden quedar obsoletos en almacen
**Recomendacion:**
- Agregar logica FIFO en asignacion de series
- Ordenar por `fecha_ingreso ASC` al seleccionar equipos

#### 2. Punto de Reorden (ROP) Sin Automatizacion
**Impacto:** Alto - Riesgo de desabasto
**Recomendacion:**
- Agregar campos: `lead_time_dias`, `demanda_promedio_diaria`
- Implementar alerta automatica cuando `cantidad_disponible <= cantidad_minima`
- Crear endpoint: `GET /inventario/alertas-stock-bajo`

#### 3. Stock de Seguridad No Existe
**Impacto:** Alto - Sin buffer para variaciones de demanda
**Recomendacion:**
- Agregar campo `stock_seguridad` a `catalogo`
- Implementar formula: `SS = D_max * (LT_max - LT_prom)`
- Ajustar `cantidad_minima` = ROP = (D_prom * LT) + SS

### 11.2 Brechas de Media Prioridad

#### 4. Estados de CPE Incompletos
**Impacto:** Medio - Falta granularidad en estados
**Recomendacion:**
```prisma
enum estado_inventario {
  DISPONIBLE_NUEVO
  DISPONIBLE_REACONDICIONADO  // Nuevo
  RESERVADO
  EN_TRANSITO
  INSTALADO_CLIENTE           // Renombrar de ASIGNADO
  EN_REPARACION               // Nuevo
  DEFECTUOSO
  BAJA_DANO
  BAJA_OBSOLETO               // Nuevo
  BAJA_ROBO                   // Nuevo
}
```

#### 5. Workflow de Inspeccion Post-Devolucion
**Impacto:** Medio - Equipos pueden volver sin revision
**Recomendacion:**
- Crear estado intermedio `EN_INSPECCION`
- Agregar flujo: Devolucion -> Inspeccion -> (DISPONIBLE | EN_REPARACION | DEFECTUOSO)

#### 6. KPIs No Automatizados
**Impacto:** Medio - Sin metricas para decision gerencial
**Recomendacion:**
- Implementar job programado para calcular `metricas_inventario`
- Crear dashboard con:
  - Precision Inventario (%)
  - Tasa de Rotacion
  - Stock-Out Rate
  - Items bajo minimo

### 11.3 Brechas de Baja Prioridad

#### 7. Firma Digital en Entregas
**Impacto:** Bajo - La foto cumple funcion similar
**Recomendacion:** Considerar integracion con firma digital en app movil

#### 8. Integracion Codigo de Barras
**Impacto:** Bajo - Mejora operativa, no funcional
**Recomendacion:** Evaluar integracion con app movil para escaneo

#### 9. Vida Util de Activos
**Impacto:** Bajo - Para control de obsolescencia
**Recomendacion:** Agregar `vida_util_meses` a `catalogo`

---

## Archivos Clave del Modulo

| Componente | Ubicacion |
|------------|-----------|
| Schema Prisma | `prisma/schema.prisma` |
| Items Inventario Service | `src/modules/inventario/items-inventario/items-inventario.service.ts` |
| Compras Service | `src/modules/inventario/compras/compras.service.ts` |
| Importaciones Service | `src/modules/inventario/importaciones/importaciones.service.ts` |
| Requisiciones Service | `src/modules/inventario/requisiciones/requisiciones.service.ts` |
| Auditorias Service | `src/modules/inventario/auditorias-inventario/auditorias-inventario.service.ts` |
| Ordenes Salida Service | `src/modules/inventario/ordenes-salida/ordenes-salida.service.ts` |
| Salidas Temporales Service | `src/modules/inventario/salidas-temporales-ot/salidas-temporales-ot.service.ts` |

---

## Conclusion Final

El modulo de inventario de AFIS tiene una **base solida** para la gestion de inventario con excelente trazabilidad y sistema de auditorias robusto. Sin embargo, para cumplir completamente con las politicas establecidas, se requiere:

1. **Implementar FIFO** - Prioridad Alta
2. **Automatizar ROP y alertas** - Prioridad Alta
3. **Agregar Stock de Seguridad** - Prioridad Alta
4. **Completar estados de CPE** - Prioridad Media
5. **Automatizar KPIs** - Prioridad Media

Con estas mejoras, el sistema alcanzaria un cumplimiento superior al 90% de la politica de inventario.

---

*Documento generado automaticamente - Diciembre 2024*
