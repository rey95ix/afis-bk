# Guía de Integración Frontend - Facturación DTE

Esta guía explica cómo integrar el módulo de facturación desde una aplicación frontend (Angular, React, Vue, etc.).

## Tabla de Contenidos

1. [Prerrequisitos](#prerrequisitos)
2. [Interfaces TypeScript](#interfaces-typescript)
3. [Flujo Típico de Facturación](#flujo-típico-de-facturación)
4. [Ejemplos de Código Angular](#ejemplos-de-código-angular)
5. [Manejo de Estados](#manejo-de-estados)
6. [Manejo de Errores](#manejo-de-errores)
7. [Casos de Uso Comunes](#casos-de-uso-comunes)
8. [Troubleshooting](#troubleshooting)

---

## Prerrequisitos

### Autenticación

El usuario debe estar autenticado y tener un JWT válido.

```typescript
// Headers requeridos en todas las peticiones
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

### Datos del Contrato

Antes de facturar, el contrato debe:
- Existir en el sistema
- Tener estado válido: `INSTALADO_ACTIVO`, `EN_MORA` o `VELOCIDAD_REDUCIDA`
- El cliente debe tener datos de facturación configurados

---

## Interfaces TypeScript

### Request: Crear Cobro

```typescript
// Item de factura
interface ItemCobro {
  tipoItem: 1 | 2 | 3 | 4;  // 1=Bien, 2=Servicio, 3=Ambos, 4=Tributo
  codigo?: string;
  descripcion: string;
  cantidad: number;
  uniMedida: number;        // 59=Servicio, 99=Otro
  precioUnitario: number;
  descuento?: number;
  esGravado?: boolean;      // default: true
  esExento?: boolean;       // default: false
  esNoSujeto?: boolean;     // default: false
  idCatalogo?: number;
}

// Pago (requerido si condicionOperacion !== 1)
interface PagoCobro {
  codigo: string;           // '01'=Efectivo, '02'=Tarjeta, etc.
  monto: number;
  referencia?: string;
  plazo?: string;
  periodo?: number;
}

// Request completo
interface CrearCobroRequest {
  idContrato: number;
  idClienteFacturacion?: number;
  idSucursal?: number;
  periodoFacturado: string;
  items: ItemCobro[];
  condicionOperacion?: 1 | 2 | 3;  // 1=Contado, 2=Crédito, 3=Otro
  pagos?: PagoCobro[];
  aplicarMora?: boolean;
  observaciones?: string;
  numPagoElectronico?: string;
}
```

### Response: Crear Cobro

```typescript
interface CrearCobroResponse {
  success: boolean;
  idDte?: number;
  codigoGeneracion?: string;
  numeroControl?: string;
  estado?: 'PROCESADO' | 'RECHAZADO' | 'BORRADOR' | 'FIRMADO';
  selloRecibido?: string;
  totalPagar?: number;
  error?: string;
  errores?: string[];
}
```

### Request: Anular Cobro

```typescript
interface AnularCobroRequest {
  idDte: number;
  tipoAnulacion: 1 | 2 | 3;  // 1=Error, 2=Rescindir, 3=Otro
  motivoAnulacion?: string;   // Requerido si tipoAnulacion=3
  nombreResponsable: string;
  tipoDocResponsable: string; // '36'=NIT, '13'=DUI
  numDocResponsable: string;
  nombreSolicita: string;
  tipoDocSolicita: string;
  numDocSolicita: string;
  codigoGeneracionReemplazo?: string;  // UUID si tipoAnulacion=1
}
```

### Response: Anular Cobro

```typescript
interface AnularCobroResponse {
  success: boolean;
  idAnulacion?: number;
  codigoGeneracionAnulacion?: string;
  estado?: 'PROCESADA' | 'RECHAZADA' | 'PENDIENTE' | 'FIRMADA';
  selloRecibido?: string;
  error?: string;
  errores?: string[];
}
```

### Response: Listar DTEs

```typescript
interface DteListItem {
  id_dte: number;
  codigo_generacion: string;
  numero_control: string;
  tipo_dte: '01' | '03';
  estado: EstadoDte;
  fecha_emision: string;
  total_pagar: number;
  sello_recepcion?: string;
  cliente: {
    titular: string;
  };
  contrato: {
    codigo: string;
  };
}

interface ListarDtesResponse {
  items: DteListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type EstadoDte = 'BORRADOR' | 'FIRMADO' | 'TRANSMITIDO' | 'PROCESADO' | 'RECHAZADO' | 'INVALIDADO';
```

---

## Flujo Típico de Facturación

### Paso 1: Obtener datos del contrato

```typescript
// GET /atencion-al-cliente/contratos/:id
const contrato = await this.contratoService.getById(idContrato);

// Verificar estado
if (!['INSTALADO_ACTIVO', 'EN_MORA', 'VELOCIDAD_REDUCIDA'].includes(contrato.estado)) {
  throw new Error('El contrato no está activo para facturación');
}
```

### Paso 2: Preparar items de la factura

```typescript
const items: ItemCobro[] = [
  {
    tipoItem: 2,                                    // Servicio
    descripcion: `Internet 10 Mbps - ${periodo}`,
    cantidad: 1,
    uniMedida: 59,                                  // Servicio
    precioUnitario: contrato.plan.precio,
    esGravado: true
  }
];

// Agregar cargos adicionales si existen
if (contrato.cargoInstalacion > 0) {
  items.push({
    tipoItem: 2,
    descripcion: 'Cargo por instalación',
    cantidad: 1,
    uniMedida: 59,
    precioUnitario: contrato.cargoInstalacion,
    esGravado: true
  });
}
```

### Paso 3: Crear la factura

```typescript
const request: CrearCobroRequest = {
  idContrato: contrato.id_contrato,
  periodoFacturado: 'Enero 2025',
  items: items,
  condicionOperacion: 1,  // Contado
  aplicarMora: false
};

const response = await this.facturacionService.crearCobro(request);
```

### Paso 4: Manejar respuesta

```typescript
if (response.success) {
  // Factura creada exitosamente
  console.log('Factura creada:', response.numeroControl);
  console.log('Sello MH:', response.selloRecibido);
  console.log('Total:', response.totalPagar);

  // Mostrar al usuario
  this.mostrarExito({
    mensaje: 'Factura emitida correctamente',
    numeroControl: response.numeroControl,
    total: response.totalPagar
  });
} else {
  // Error en la factura
  console.error('Error:', response.error);
  console.error('Detalles:', response.errores);

  // Mostrar errores al usuario
  this.mostrarError({
    mensaje: response.error,
    detalles: response.errores
  });
}
```

---

## Ejemplos de Código Angular

### Servicio de Facturación

```typescript
// facturacion.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class FacturacionService {
  private readonly API_URL = `${environment.apiUrl}/facturacion`;

  constructor(private http: HttpClient) {}

  // ============ COBROS ============

  crearCobro(data: CrearCobroRequest): Observable<CrearCobroResponse> {
    return this.http.post<CrearCobroResponse>(
      `${this.API_URL}/cobros`,
      data
    );
  }

  listarCobros(filtros: ListarCobrosParams): Observable<ListarDtesResponse> {
    let params = new HttpParams();

    if (filtros.idContrato) params = params.set('idContrato', filtros.idContrato.toString());
    if (filtros.idCliente) params = params.set('idCliente', filtros.idCliente.toString());
    if (filtros.tipoDte) params = params.set('tipoDte', filtros.tipoDte);
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.fechaDesde) params = params.set('fechaDesde', filtros.fechaDesde);
    if (filtros.fechaHasta) params = params.set('fechaHasta', filtros.fechaHasta);
    if (filtros.page) params = params.set('page', filtros.page.toString());
    if (filtros.limit) params = params.set('limit', filtros.limit.toString());

    return this.http.get<ListarDtesResponse>(
      `${this.API_URL}/cobros`,
      { params }
    );
  }

  obtenerCobro(id: number): Observable<DteDetalle> {
    return this.http.get<DteDetalle>(`${this.API_URL}/cobros/${id}`);
  }

  // ============ ANULACIONES ============

  anularCobro(data: AnularCobroRequest): Observable<AnularCobroResponse> {
    return this.http.post<AnularCobroResponse>(
      `${this.API_URL}/anulaciones`,
      data
    );
  }

  listarAnulaciones(filtros: ListarAnulacionesParams): Observable<ListarAnulacionesResponse> {
    let params = new HttpParams();

    if (filtros.idDte) params = params.set('idDte', filtros.idDte.toString());
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.fechaDesde) params = params.set('fechaDesde', filtros.fechaDesde);
    if (filtros.fechaHasta) params = params.set('fechaHasta', filtros.fechaHasta);
    if (filtros.page) params = params.set('page', filtros.page.toString());
    if (filtros.limit) params = params.set('limit', filtros.limit.toString());

    return this.http.get<ListarAnulacionesResponse>(
      `${this.API_URL}/anulaciones`,
      { params }
    );
  }

  obtenerAnulacion(id: number): Observable<AnulacionDetalle> {
    return this.http.get<AnulacionDetalle>(`${this.API_URL}/anulaciones/${id}`);
  }
}
```

### Componente de Crear Factura

```typescript
// crear-factura.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { FacturacionService } from '@services/facturacion.service';

@Component({
  selector: 'app-crear-factura',
  templateUrl: './crear-factura.component.html'
})
export class CrearFacturaComponent implements OnInit {
  form: FormGroup;
  loading = false;
  contrato: any;

  constructor(
    private fb: FormBuilder,
    private facturacionService: FacturacionService,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.initForm();
  }

  initForm() {
    this.form = this.fb.group({
      idContrato: [null, Validators.required],
      periodoFacturado: ['', Validators.required],
      items: this.fb.array([]),
      condicionOperacion: [1],
      aplicarMora: [false],
      observaciones: ['']
    });
  }

  get items(): FormArray {
    return this.form.get('items') as FormArray;
  }

  agregarItem() {
    const item = this.fb.group({
      tipoItem: [2, Validators.required],
      descripcion: ['', Validators.required],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      uniMedida: [59],
      precioUnitario: [0, [Validators.required, Validators.min(0)]],
      descuento: [0],
      esGravado: [true],
      esExento: [false],
      esNoSujeto: [false]
    });
    this.items.push(item);
  }

  removerItem(index: number) {
    this.items.removeAt(index);
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;

    try {
      const request: CrearCobroRequest = this.form.value;
      const response = await this.facturacionService.crearCobro(request).toPromise();

      if (response.success) {
        this.toastr.success(
          `Factura ${response.numeroControl} emitida correctamente`,
          'Éxito'
        );
        // Navegar al detalle o lista
        this.router.navigate(['/facturacion/cobros', response.idDte]);
      } else {
        this.toastr.error(response.error, 'Error al emitir factura');
        if (response.errores?.length) {
          response.errores.forEach(err => this.toastr.warning(err));
        }
      }
    } catch (error) {
      this.handleError(error);
    } finally {
      this.loading = false;
    }
  }

  private handleError(error: any) {
    if (error.status === 400) {
      this.toastr.error('Datos inválidos', 'Error de validación');
    } else if (error.status === 404) {
      this.toastr.error('Contrato no encontrado', 'Error');
    } else if (error.status === 409) {
      this.toastr.error('Ya existe factura para este período', 'Conflicto');
    } else {
      this.toastr.error('Error inesperado', 'Error');
    }
  }
}
```

### Componente de Anular Factura

```typescript
// anular-factura.component.ts
import { Component, Input } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FacturacionService } from '@services/facturacion.service';

@Component({
  selector: 'app-anular-factura',
  templateUrl: './anular-factura.component.html'
})
export class AnularFacturaComponent {
  @Input() dte: DteDetalle;

  form: FormGroup;
  loading = false;

  tiposAnulacion = [
    { value: 1, label: 'Error en información del DTE' },
    { value: 2, label: 'Rescindir la operación' },
    { value: 3, label: 'Otro motivo' }
  ];

  tiposDocumento = [
    { value: '36', label: 'NIT' },
    { value: '13', label: 'DUI' },
    { value: '02', label: 'Carnet de Residente' },
    { value: '03', label: 'Pasaporte' }
  ];

  constructor(
    private fb: FormBuilder,
    private facturacionService: FacturacionService,
    private toastr: ToastrService
  ) {
    this.initForm();
  }

  initForm() {
    this.form = this.fb.group({
      tipoAnulacion: [2, Validators.required],
      motivoAnulacion: [''],
      nombreResponsable: ['', [Validators.required, Validators.maxLength(200)]],
      tipoDocResponsable: ['36', Validators.required],
      numDocResponsable: ['', [Validators.required, Validators.maxLength(25)]],
      nombreSolicita: ['', [Validators.required, Validators.maxLength(200)]],
      tipoDocSolicita: ['13', Validators.required],
      numDocSolicita: ['', [Validators.required, Validators.maxLength(25)]],
      codigoGeneracionReemplazo: ['']
    });

    // Validaciones condicionales
    this.form.get('tipoAnulacion').valueChanges.subscribe(tipo => {
      const motivoControl = this.form.get('motivoAnulacion');
      const reemplazoControl = this.form.get('codigoGeneracionReemplazo');

      if (tipo === 3) {
        motivoControl.setValidators([Validators.required, Validators.maxLength(250)]);
      } else {
        motivoControl.clearValidators();
      }

      if (tipo === 1) {
        reemplazoControl.setValidators([Validators.required]);
      } else {
        reemplazoControl.clearValidators();
      }

      motivoControl.updateValueAndValidity();
      reemplazoControl.updateValueAndValidity();
    });
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;

    try {
      const request: AnularCobroRequest = {
        idDte: this.dte.id_dte,
        ...this.form.value
      };

      const response = await this.facturacionService.anularCobro(request).toPromise();

      if (response.success) {
        this.toastr.success('Factura anulada correctamente', 'Éxito');
        this.modalRef.close(true);
      } else {
        this.toastr.error(response.error, 'Error al anular');
        if (response.errores?.length) {
          response.errores.forEach(err => this.toastr.warning(err));
        }
      }
    } catch (error) {
      this.handleError(error);
    } finally {
      this.loading = false;
    }
  }
}
```

---

## Manejo de Estados

### Estados de DTE

| Estado | Descripción | Color sugerido | Acciones disponibles |
|--------|-------------|----------------|---------------------|
| `BORRADOR` | Guardado, pendiente de firma | Gris | Reintentar firma |
| `FIRMADO` | Firmado, pendiente de transmisión | Amarillo | Reintentar transmisión |
| `TRANSMITIDO` | En proceso en MH | Azul | Esperar |
| `PROCESADO` | Aceptado por MH | Verde | Ver, Anular, Descargar |
| `RECHAZADO` | Rechazado por MH | Rojo | Ver errores, Reintentar |
| `INVALIDADO` | Anulado | Negro | Solo lectura |

### Componente de Badge de Estado

```typescript
// estado-dte.component.ts
@Component({
  selector: 'app-estado-dte',
  template: `
    <span [class]="'badge badge-' + colorEstado">
      {{ estado }}
    </span>
  `
})
export class EstadoDteComponent {
  @Input() estado: EstadoDte;

  get colorEstado(): string {
    const colores: Record<EstadoDte, string> = {
      BORRADOR: 'secondary',
      FIRMADO: 'warning',
      TRANSMITIDO: 'info',
      PROCESADO: 'success',
      RECHAZADO: 'danger',
      INVALIDADO: 'dark'
    };
    return colores[this.estado] || 'secondary';
  }
}
```

---

## Manejo de Errores

### Códigos de Error HTTP

| Código | Descripción | Acción sugerida |
|--------|-------------|-----------------|
| 400 | Datos inválidos | Revisar formulario |
| 401 | No autorizado | Redirigir a login |
| 404 | No encontrado | Verificar ID |
| 409 | Conflicto | Mostrar mensaje específico |
| 500 | Error servidor | Reintentar o contactar soporte |

### Interceptor de Errores

```typescript
// error.interceptor.ts
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    private toastr: ToastrService,
    private router: Router
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.url?.includes('/facturacion/')) {
          this.handleFacturacionError(error);
        }
        return throwError(error);
      })
    );
  }

  private handleFacturacionError(error: HttpErrorResponse) {
    switch (error.status) {
      case 400:
        this.toastr.error(
          error.error?.message || 'Datos inválidos',
          'Error de validación'
        );
        break;
      case 404:
        this.toastr.error('Recurso no encontrado', 'Error');
        break;
      case 409:
        this.toastr.warning(
          error.error?.message || 'Conflicto con datos existentes',
          'Advertencia'
        );
        break;
      default:
        this.toastr.error('Error inesperado', 'Error');
    }
  }
}
```

---

## Casos de Uso Comunes

### 1. Factura Simple (Contado)

```typescript
const request: CrearCobroRequest = {
  idContrato: 123,
  periodoFacturado: 'Enero 2025',
  items: [
    {
      tipoItem: 2,
      descripcion: 'Internet 10 Mbps - Enero 2025',
      cantidad: 1,
      uniMedida: 59,
      precioUnitario: 25.00,
      esGravado: true
    }
  ],
  condicionOperacion: 1  // Contado
};
```

### 2. Factura con Crédito

```typescript
const request: CrearCobroRequest = {
  idContrato: 123,
  periodoFacturado: 'Enero 2025',
  items: [...],
  condicionOperacion: 2,  // Crédito
  pagos: [
    {
      codigo: '05',       // Transferencia
      monto: 25.00,
      plazo: '02',        // Meses
      periodo: 1          // 1 mes
    }
  ]
};
```

### 3. Factura con Mora Automática

```typescript
const request: CrearCobroRequest = {
  idContrato: 123,
  periodoFacturado: 'Febrero 2025',
  items: [...],
  condicionOperacion: 1,
  aplicarMora: true  // Sistema calculará mora automáticamente
};

// El backend agregará un item de mora si hay facturas vencidas
```

### 4. Anular por Error (con Reemplazo)

```typescript
// Primero crear la factura correcta
const nuevaFactura = await facturacionService.crearCobro({...});

// Luego anular la incorrecta
const anulacion: AnularCobroRequest = {
  idDte: 123,
  tipoAnulacion: 1,
  nombreResponsable: 'Roberto García',
  tipoDocResponsable: '36',
  numDocResponsable: '0614-123456-789-0',
  nombreSolicita: 'Cliente X',
  tipoDocSolicita: '13',
  numDocSolicita: '12345678-9',
  codigoGeneracionReemplazo: nuevaFactura.codigoGeneracion
};
```

### 5. Anular por Rescindir Operación

```typescript
const anulacion: AnularCobroRequest = {
  idDte: 123,
  tipoAnulacion: 2,  // Rescindir
  nombreResponsable: 'Roberto García',
  tipoDocResponsable: '36',
  numDocResponsable: '0614-123456-789-0',
  nombreSolicita: 'Cliente X',
  tipoDocSolicita: '13',
  numDocSolicita: '12345678-9'
};
```

### 6. Anular por Otro Motivo

```typescript
const anulacion: AnularCobroRequest = {
  idDte: 123,
  tipoAnulacion: 3,  // Otro
  motivoAnulacion: 'Aclaración con el cliente sobre el servicio',
  nombreResponsable: 'Roberto García',
  tipoDocResponsable: '36',
  numDocResponsable: '0614-123456-789-0',
  nombreSolicita: 'Cliente X',
  tipoDocSolicita: '13',
  numDocSolicita: '12345678-9'
};
```

---

## Troubleshooting

### Error 400: "El contrato no está activo"

**Causa:** El contrato tiene estado diferente a INSTALADO_ACTIVO, EN_MORA o VELOCIDAD_REDUCIDA.

**Solución:** Verificar estado del contrato antes de facturar.

```typescript
const estadosValidos = ['INSTALADO_ACTIVO', 'EN_MORA', 'VELOCIDAD_REDUCIDA'];
if (!estadosValidos.includes(contrato.estado)) {
  this.toastr.error(`Contrato en estado ${contrato.estado}, no se puede facturar`);
  return;
}
```

### Error 400: "Cliente sin datos de facturación"

**Causa:** El cliente no tiene configurados los datos de facturación.

**Solución:** Dirigir al usuario a completar datos de facturación del cliente.

### Error 404: "Contrato no encontrado"

**Causa:** ID de contrato inválido.

**Solución:** Verificar que el ID sea correcto.

### Error 409: "Ya existe factura para este período"

**Causa:** Ya se emitió una factura para el mismo contrato y período.

**Solución:** Verificar facturas existentes o usar diferente descripción de período.

### Error 409: "DTE ya fue anulado"

**Causa:** Intentando anular un DTE que ya tiene anulación procesada.

**Solución:** Verificar estado del DTE antes de anular.

### Error 400: "Plazo de anulación expirado"

**Causa:** Se superó el plazo para anular (90 días para FC, 1 día para CCF).

**Solución:** No se puede anular. Considerar emitir nota de crédito si aplica.

### Error: "API_FIRMADOR no disponible"

**Causa:** Servicio de firma digital no está ejecutándose.

**Solución:** Contactar administrador de sistemas para verificar servicio.

### Error: "Timeout en transmisión MH"

**Causa:** Ministerio de Hacienda no responde en tiempo.

**Solución:** El sistema reintentará automáticamente. Si persiste, contactar soporte.

---

## Recursos Adicionales

- [API.md](./API.md) - Referencia completa de endpoints
- [FLUJOS.md](./FLUJOS.md) - Diagramas de flujo de negocio
- [../CLAUDE.md](../CLAUDE.md) - Documentación técnica del módulo
