# Guia de Implementacion: NPE y Codigo de Barras GS1-128

> Basado en la "Guia de Estandar Recibos de Pago 2020" de GS1 El Salvador (Publicacion 2.0, Enero 2020).
>
> Archivo fuente de la implementacion: `src/modules/facturacion/dte/builders/npe-barcode.util.ts`

---

## Tabla de Contenido

1. [Vision General](#1-vision-general)
2. [Dos Calculos Distintos](#2-dos-calculos-distintos)
3. [Codigo de Barras GS1-128](#3-codigo-de-barras-gs1-128)
4. [Numero de Pago Electronico (NPE)](#4-numero-de-pago-electronico-npe)
5. [Calculo del Digito Verificador (VR)](#5-calculo-del-digito-verificador-vr)
6. [Calculo del Caracter de Control del Barcode (CC)](#6-calculo-del-caracter-de-control-del-barcode-cc)
7. [Ejemplo Completo con Datos Reales](#7-ejemplo-completo-con-datos-reales)
8. [Integracion en AFIS](#8-integracion-en-afis)
9. [Referencia de Archivos](#9-referencia-de-archivos)

---

## 1. Vision General

El sistema genera dos representaciones de los datos de pago en cada factura:

- **Codigo de barras GS1-128**: imagen escaneable por lectores en bancos y financieras.
- **NPE (Numero de Pago Electronico)**: cadena numerica reducida para digitacion manual cuando no hay lector de barcode.

Ambos contienen la misma informacion (empresa, monto, fecha limite, referencia) pero en formatos distintos.

```
   FACTURA PDF
   +-----------------------------------------+
   |                                         |
   |   NPE: 0000 0250 6520 1507 0200 ...     |  <-- texto para digitacion manual
   |   |||||||||||||||||||||||||||||||||||     |  <-- imagen del barcode GS1-128
   |                                         |
   +-----------------------------------------+
```

---

## 2. Dos Calculos Distintos

No hay que confundir estos dos algoritmos:

| Concepto | CC (Caracter de Control) | VR (Verificador del NPE) |
|----------|--------------------------|--------------------------|
| **Que protege** | Integridad del codigo de barras | Integridad del NPE digitado |
| **Algoritmo** | MOD 103 (Seccion 8-9 de la guia) | Algoritmo base 10 (Anexo 2, pag. 19) |
| **Quien lo calcula** | La libreria `bwip-js` automaticamente | Nuestro codigo (`calculateNpeCheckDigit`) |
| **Donde se almacena** | Embebido en la imagen del barcode | Ultimo digito del string NPE |
| **Seccion de la guia** | Paginas 15-17 | Pagina 19 |

---

## 3. Codigo de Barras GS1-128

### 3.1 Estructura General (Seccion 3, pag. 7-9)

```
[Zona silencio] [Inicio C] [FNC1] [IA+Datos] [IA+Datos] ... [CC] [CP] [Zona silencio]
```

| Componente | Descripcion |
|------------|-------------|
| Zona de silencio | Area libre de 5mm minimo a cada lado |
| Inicio C | Indica codificacion numerica de doble densidad |
| FNC1 | Identifica la simbologia GS1-128 y separa campos variables |
| IA + Datos | Identificadores de Aplicacion seguidos de sus datos |
| CC | Caracter de Control (MOD 103, calculado por bwip-js) |
| CP | Caracter de Parada |

> Los caracteres Inicio C, FNC1, CC y CP van en las barras pero **no** en los caracteres legibles. Los genera automaticamente el software de barcode.

### 3.2 Identificadores de Aplicacion (IA)

El codigo se compone de una cadena de IAs y datos:

```
IA + DATOS + IA + DATOS + ...
```

Los IAs son prefijos de 2-4 digitos que indican:
- El **significado** de los datos (empresa, monto, fecha, referencia)
- El **tipo** de caracteres (numerico)
- La **longitud** de los datos (fija o variable)

Se escriben entre parentesis en el texto legible, pero los parentesis no van en el simbolo de barras.

### 3.3 Los 4 Segmentos del Barcode para El Salvador (Seccion 4, pag. 10-11)

| IA | Nombre | Longitud | Requisito | Descripcion |
|----|--------|----------|-----------|-------------|
| **415** | Numero de Localizacion (GLN) | Fijo: 13 digitos | Obligatorio | Codigo asignado por GS1 El Salvador. Identifica la empresa emisora. |
| **3902** | Cantidad a Pagar (USD) | Fijo: 10 digitos | Obligatorio | Monto en centavos (el "2" indica 2 decimales). Pad con ceros a la izquierda. |
| **96** | Fecha maxima de pago | Fijo: 8 digitos | Opcional | Formato AAAAMMDD. Solo para facturas a credito. |
| **8020** | Referencia del recibo | Variable: 2-24 digitos | Obligatorio | Identificador del usuario/factura asignado por la empresa. |

### 3.4 Reglas de Posicion (Seccion 5, pag. 12)

- IA 415 (GLN): **siempre primero**
- IA 8020 (Referencia): **siempre ultimo**
- IA 3902 y 96: van en medio (segunda y tercera posicion)
- Los opcionales **nunca** van al inicio ni al final

### 3.5 Ejemplo: Datos de la Guia (Seccion 8.2, pag. 16)

**Datos de entrada:**

```
GLN:            7419700000006
Monto:          $250.65
Fecha max pago: 02 de Julio de 2015
Referencia:     0704081998
```

**Construccion paso a paso:**

```
Segmento 1 - IA 415 (GLN, 13 digitos):
  GLN completo: 7419700000006
  Resultado: (415)7419700000006

Segmento 2 - IA 3902 (Monto USD):
  $250.65 x 100 = 25065 centavos
  Pad a 10 digitos: 0000025065
  Resultado: (3902)0000025065

Segmento 3 - IA 96 (Fecha):
  02/Jul/2015 en formato AAAAMMDD: 20150702
  Resultado: (96)20150702

Segmento 4 - IA 8020 (Referencia, variable):
  Referencia: 0704081998
  Resultado: (8020)0704081998
```

**Barcode final:**

```
(415)7419700000006(3902)0000025065(96)20150702(8020)0704081998
 ---  -------------  ----  ----------  --  --------  ----  ----------
 IA   GLN 13 dig     IA    monto 10d   IA  fecha 8d  IA    referencia
```

### 3.6 Conversion del Monto

El IA `3902` codifica el monto. El ultimo digito del IA (`2`) indica cuantos decimales tiene:

```
IA 3900 = 0 decimales (entero)
IA 3901 = 1 decimal
IA 3902 = 2 decimales  <-- USD, El Salvador
IA 3903 = 3 decimales
```

Para convertir:

```
monto_centavos = Math.round(monto_dolares * 100)
monto_barcode  = monto_centavos.toString().padStart(10, '0')
```

Ejemplos:

| Monto USD | x 100 | Pad a 10 | Barcode |
|-----------|-------|----------|---------|
| $20.00 | 2000 | 0000002000 | `(3902)0000002000` |
| $250.65 | 25065 | 0000025065 | `(3902)0000025065` |
| $1,500.00 | 150000 | 0000150000 | `(3902)0000150000` |

### 3.7 Modelos de Estructura (Seccion 5.1, pag. 12)

Dependiendo de que datos opcionales se incluyan:

```
Modelo 2 segmentos (solo GLN + referencia):
  (415)74197000______(8020)___________________

Modelo 3 segmentos (con monto):
  (415)74197000______(3902)0000000000(8020)___________________

Modelo 4 segmentos (con monto y fecha):
  (415)74197000______(3902)0000000000(96)YYYYMMDD(8020)___________________

Modelo 3 segmentos (con fecha, sin monto):
  (415)74197000______(96)YYYYMMDD(8020)___________________
```

En AFIS siempre usamos el **Modelo 4** (con monto y fecha) para facturas a credito, y el **Modelo 3** (con monto, sin fecha) para facturas de contado.

---

## 4. Numero de Pago Electronico (NPE)

### 4.1 Que es (Seccion 10, pag. 18)

El NPE es una version **reducida** del codigo de barras, disenada para ambientes sin lector de barcode. Permite al usuario pagar en una terminal bancaria digitando un numero mas corto.

Caracteristicas:
- Se imprime en **cuartetos** (grupos de 4 digitos) para facilitar la digitacion
- Se ubica en la **parte superior** del codigo de barras
- Lleva un **digito verificador (VR)** al final para detectar errores de digitacion

### 4.2 Tabla de Reduccion (Seccion 10.1.3, pag. 18)

Cada segmento del barcode se reduce segun esta tabla:

```
+--------+----------------------------+----------------------------+------------------------+
|   IA   | Barcode (datos completos)  | NPE (datos reducidos)      | Regla de reduccion     |
+--------+----------------------------+----------------------------+------------------------+
|  415   | 13 caracteres              | 4 caracteres               | Penultimos 4 del GLN   |
|  3902  | 10 caracteres              | 6 caracteres               | Ultimos 6 digitos      |
|  96    | 8 caracteres               | 8 caracteres               | Completo               |
|  8020  | 2-24 caracteres            | 2-24 caracteres            | Completo               |
+--------+----------------------------+----------------------------+------------------------+
```

### 4.3 Reduccion del GLN: "Penultimos 4"

El GLN tiene 13 digitos. Para el NPE se toman los **penultimos 4** (posiciones 9-12, descartando el ultimo):

```
GLN:  7  4  1  9  7  0  0  0  0  0  0  0  6
Pos:  1  2  3  4  5  6  7  8  9  10 11 12 13
                                 ^-----------^  ^
                                 penultimos 4   ultimo (descartado)
                                 = "0000"
```

En codigo: `gln.slice(-5, -1)`

**Otro ejemplo:**

```
GLN:  7  4  1  9  2  0  0  0  9  2  4  5  6
                                 ^-----------^
                                 = "9245"
```

### 4.4 Reduccion del Monto: "Ultimos 6"

El monto en el barcode tiene 10 digitos. Para el NPE se toman los **ultimos 6**:

```
Monto barcode: 0  0  0  0  0  2  5  0  6  5
                              ^--------------^
                              ultimos 6 = "025065"
```

En codigo: `amountFull.slice(-6)`

Ejemplos:

| Monto USD | Barcode (10 dig) | NPE (6 dig) |
|-----------|------------------|-------------|
| $20.00 | 0000002000 | 002000 |
| $250.65 | 0000025065 | 025065 |
| $1,500.00 | 0000150000 | 150000 |

> Nota: Montos >= $10,000.00 producen mas de 6 digitos en centavos (1000000), lo que trunca los ceros iniciales. Esto es correcto segun la guia.

### 4.5 Padding: El "0" que Hace Impar la Cadena

Segun el grafico de la pag. 18, si la concatenacion total de segmentos tiene longitud **par**, se inserta un `"0"` **antes de la referencia** para hacerla impar.

```
Ejemplo con datos de la guia:

Prefijo = GLN(4) + Monto(6) + Fecha(8) = "0000" + "025065" + "20150702" = 18 chars
Referencia = "0704081998" = 10 chars
Total = 18 + 10 = 28 chars (PAR)

Se inserta "0" entre prefijo y referencia:
Resultado = "000002506520150702" + "0" + "0704081998" = 29 chars (IMPAR)
                                   ^
                                   padding
```

La posicion del "0" se confirma en el grafico de la pag. 18:

```
NPE   0000 0250 6520 1507 02|0|0 7040 8199 83
                              ^
                   "0" Hace Impar la Cadena (segun el grafico)
```

En codigo:
```typescript
const prefix = `${glnSegment}${amountSegment}${dateSegment}`;
const totalLength = prefix.length + referenceSegment.length;
const pad = totalLength % 2 === 0 ? '0' : '';
const concatenated = `${prefix}${pad}${referenceSegment}`;
```

### 4.6 Estructura Final del NPE

```
[GLN 4 dig][Monto 6 dig][Fecha 8 dig][Pad 0?][Referencia variable][VR 1 dig]
```

Formateado en cuartetos para impresion:

```
XXXX XXXX XXXX XXXX XXXX XXXX XXXX XX
```

---

## 5. Calculo del Digito Verificador (VR)

### 5.1 Algoritmo (Anexo 2, pag. 19)

El VR se calcula sobre la cadena NPE **sin** el VR (es decir, antes de agregarlo). La iteracion es de **izquierda a derecha**.

**Paso 1** - Posiciones IMPARES (1, 3, 5, 7...): multiplicar el digito por 2. Si el producto es >= 10, **sumar 1** al producto.

**Paso 2** - Posiciones PARES (2, 4, 6, 8...): sumar el digito directamente.

**Paso 3** - Calcular VR:

```
A  = suma_impares + suma_pares
B  = floor(A / 10)
C  = B x 10
D  = A - C              <-- equivale a A % 10
E  = 10 - D
F  = floor(E / 10)
G  = F x 10
VR = E - G              <-- equivale a (10 - (A % 10)) % 10
```

> **ATENCION**: El algoritmo dice "sumar 1" cuando el producto >= 10, **no** "restar 9" como en el Luhn estandar. Esto da resultados diferentes:
>
> ```
> Luhn estandar: 7 x 2 = 14 --> 14 - 9 = 5
> Guia GS1 SV:  7 x 2 = 14 --> 14 + 1 = 15   <-- DIFERENTE
> ```

### 5.2 Ejemplo de la Guia (Anexo 2, pag. 19)

NPE sin Verificador: `1000 1433 4407 740`

Cadena: `100014334407740` (15 caracteres)

```
Pos  Digito  Tipo    Operacion          Resultado
---  ------  ------  -----------------  ---------
 1     1     Impar   1 x 2 = 2          2
 2     0     Par     directo            0
 3     0     Impar   0 x 2 = 0          0
 4     0     Par     directo            0
 5     1     Impar   1 x 2 = 2          2
 6     4     Par     directo            4
 7     3     Impar   3 x 2 = 6          6
 8     3     Par     directo            3
 9     4     Impar   4 x 2 = 8          8
10     4     Par     directo            4
11     0     Impar   0 x 2 = 0          0
12     7     Par     directo            7
13     7     Impar   7 x 2 = 14 (>=10)  14 + 1 = 15
14     4     Par     directo            4
15     0     Impar   0 x 2 = 0          0
```

```
Suma impares = 2+0+2+6+8+0+15+0 = 33
Suma pares   = 0+0+4+3+4+7+4    = 22

A = 33 + 22 = 55
B = floor(55 / 10) = 5
C = 5 x 10 = 50
D = 55 - 50 = 5
E = 10 - 5 = 5
F = floor(5 / 10) = 0
G = 0 x 10 = 0
VR = 5 - 0 = 5
```

**NPE final**: `1000 1433 4407 7405`

### 5.3 Casos Especiales del VR

Cuando `A % 10 = 0`:

```
A = 80
D = 80 - 80 = 0
E = 10 - 0 = 10
F = floor(10 / 10) = 1
G = 1 x 10 = 10
VR = 10 - 10 = 0    <-- VR es 0, no 10
```

Los pasos F y G existen para manejar este caso (evitar que VR sea 10).

---

## 6. Calculo del Caracter de Control del Barcode (CC)

### 6.1 Algoritmo MOD 103 (Seccion 8, pag. 15-17)

Este calculo lo realiza automaticamente `bwip-js`. Se documenta aqui como referencia.

El barcode se descompone en pares de digitos (Code C, doble densidad). Cada par se trata como un "caracter simbolizado":

```
Barcode: (415)7419700000006(3902)0000025065(96)20150702(8020)0704081998

Simbolo: Inicio C | FNC1 | 41 | 57 | 41 | 97 | 00 | 00 | 00 | 06 |
         FNC1 | 39 | 02 | 00 | 00 | 02 | 50 | 65 |
         FNC1 | 96 | 20 | 15 | 07 | 02 |
         FNC1 | 80 | 20 | 07 | 04 | 08 | 19 | 98 | CC | CP
```

### 6.2 Pasos

**Paso 1**: Asignar un **valor** a cada caracter segun la Tabla 1 (pag. 15):
- Digitos 00-99: valor = el numero mismo
- FNC1: valor = 102
- Inicio C: valor = 105

**Paso 2**: Asignar un **peso** (ponderacion) a cada posicion:
- Inicio C: peso = 1
- Primer caracter despues de Inicio: peso = 1 (ambos pesan 1)
- Siguientes caracteres: peso = 2, 3, 4, ..., n

**Paso 3**: Multiplicar valor x peso para cada caracter.

**Paso 4**: Sumar todos los productos.

**Paso 5**: Dividir entre 103.

**Paso 6**: El **residuo** es el CC.

### 6.3 Ejemplo de la Guia (Seccion 9, pag. 17)

```
Par de Digitos   Valor   Posicion   Valor x Posicion
--------------   -----   --------   ----------------
Inicio C          105       1            105
FNC1              102       1            102
41                 41       2             82
57                 57       3            171
41                 41       4            164
97                 97       5            485
00                  0       6              0
00                  0       7              0
00                  0       8              0
06                  6       9             54
39                 39      10            390
02                  2      11             22
00                  0      12              0
00                  0      13              0
02                  2      14             28
50                 50      15            750
65                 65      16           1040
96                 96      17           1632
20                 20      18            360
15                 15      19            285
07                  7      20            140
02                  2      21             42
80                 80      22           1760
20                 20      23            460
07                  7      24            168
04                  4      25            100
08                  8      26            208
19                 19      27            513
98                 98      28           2744
                                  -----------
                           Total:     11805
```

```
11805 / 103 = 114.61...
Residuo = 11805 - (114 x 103) = 11805 - 11742 = 63

CC = 63
```

> Si el residuo fuera 102, el CC seria el caracter FNC1.

---

## 7. Ejemplo Completo con Datos Reales

### 7.1 Datos de la Factura (INSERT de facturaDirecta)

```sql
id_factura_directa:  71232
total:               $20.00
condicion_operacion: 2 (CREDITO)
fecha_vencimiento:   2026-02-27
id_contrato:         8073
tipoDte:             01 (Factura Consumidor Final)
```

### 7.2 Barcode GS1-128

Asumiendo GLN = `7419200092456` (ejemplo):

```
Segmento 1 - IA 415 (GLN):
  (415)7419200092456

Segmento 2 - IA 3902 (Monto):
  $20.00 x 100 = 2000
  Pad a 10: "0000002000"
  (3902)0000002000

Segmento 3 - IA 96 (Fecha, incluida porque condicion=2):
  2026-02-27 -> "20260227"
  (96)20260227

Segmento 4 - IA 8020 (Referencia):
  id_contrato 8073, pad a 10: "0000008073"
  (8020)0000008073

BARCODE FINAL:
(415)7419200092456(3902)0000002000(96)20260227(8020)0000008073
```

### 7.3 NPE - Reduccion de Segmentos

```
+--------+-------------------+------------------+----------------------------+
|   IA   | Barcode           | NPE              | Operacion                  |
+--------+-------------------+------------------+----------------------------+
|  415   | 7419200092456     | 9245             | slice(-5, -1): "...9245|6" |
|  3902  | 0000002000        | 002000           | slice(-6): "...002000"     |
|  96    | 20260227          | 20260227         | completo                   |
|  8020  | 0000008073        | 0000008073       | completo                   |
+--------+-------------------+------------------+----------------------------+
```

### 7.4 NPE - Concatenacion y Padding

```
Prefijo = "9245" + "002000" + "20260227" = "924500200020260227"
                                            (18 caracteres)

Referencia = "0000008073"
              (10 caracteres)

Total = 18 + 10 = 28 (PAR) --> necesita padding "0"

Concatenado = "924500200020260227" + "0" + "0000008073"
            = "92450020002026022700000080073"
              (29 caracteres, IMPAR)
```

Visualmente:

```
9 2 4 5 0 0 2 0 0 0 2 0 2 6 0 2 2 7 0 0 0 0 0 0 0 8 0 7 3
+--GLN--+ +--monto--+ +----fecha----+ ^ +----referencia----+
                                      |
                                      "0" padding
```

### 7.5 NPE - Calculo del VR

Cadena: `92450020002026022700000080073` (29 caracteres)

```
Pos  Dig  Tipo    Operacion          Resultado
---  ---  ------  -----------------  ---------
 1    9   Impar   9x2=18 (>=10)     18+1 = 19
 2    2   Par     directo            2
 3    4   Impar   4x2=8             8
 4    5   Par     directo            5
 5    0   Impar   0x2=0             0
 6    0   Par     directo            0
 7    2   Impar   2x2=4             4
 8    0   Par     directo            0
 9    0   Impar   0x2=0             0
10    0   Par     directo            0
11    2   Impar   2x2=4             4
12    0   Par     directo            0
13    2   Impar   2x2=4             4
14    6   Par     directo            6
15    0   Impar   0x2=0             0
16    2   Par     directo            2
17    2   Impar   2x2=4             4
18    7   Par     directo            7
19    0   Impar   0x2=0             0
20    0   Par     directo            0
21    0   Impar   0x2=0             0
22    0   Par     directo            0
23    0   Impar   0x2=0             0
24    0   Par     directo            0
25    0   Impar   0x2=0             0
26    8   Par     directo            8
27    0   Impar   0x2=0             0
28    7   Par     directo            7
29    3   Impar   3x2=6             6
```

```
Suma impares = 19+8+0+4+0+4+4+0+4+0+0+0+0+0+0+6 = 49
Suma pares   = 2+5+0+0+0+0+6+2+7+0+0+0+8+7       = 37

A = 49 + 37 = 86
B = floor(86 / 10) = 8
C = 8 x 10 = 80
D = 86 - 80 = 6
E = 10 - 6 = 4
F = floor(4 / 10) = 0
G = 0 x 10 = 0
VR = 4 - 0 = 4
```

### 7.6 NPE Final

```
Cadena + VR = "92450020002026022700000080073" + "4"
            = "924500200020260227000000800734"
              (30 caracteres)

Formateado en cuartetos:
9245 0020 0020 2602 2700 0000 8007 34
```

### 7.7 Resumen Visual

```
         DATOS FACTURA 71232
         +---------------------+
         | total: $20.00       |
         | fecha: 2026-02-27   |
         | contrato: 8073      |
         | GLN: 7419200092456  |
         +----------+----------+
                    |
          +---------+---------+
          v                   v
     BARCODE GS1-128         NPE
     (datos completos)       (datos reducidos)
          |                   |
          v                   v
  (415)7419200092456     9245 (penultimos 4)
  (3902)0000002000       002000 (ultimos 6)
  (96)20260227           20260227 (completo)
  (8020)0000008073       0 (pad) + 0000008073
                         + VR = 4
          |                   |
          v                   v
     bwip-js genera      "9245 0020 0020
     imagen PNG           2602 2700 0000
     (CC MOD103 auto)     8007 34"
          |                   |
          +--------+----------+
                   v
            FACTURA PDF
  +-----------------------------------+
  | NPE: 9245 0020 0020 2602 ...     |
  | ||||||||||||||||||||||||||||||||  |
  +-----------------------------------+
```

---

## 8. Integracion en AFIS

### 8.1 Flujo de Generacion

El NPE se genera en dos momentos:

**Momento 1: Al crear la factura** (flujo normal)

```
crearFactura() / crearCobro()
  |
  +-> prepararParametrosBuild()
  |     Calcula NPE con calculateNpe()
  |     Lo asigna a buildParams.numPagoElectronico
  |
  +-> builder.build(buildParams)
  |     El builder (FC/CCF) coloca el NPE en resumen.numPagoElectronico
  |
  +-> guardarFactura()
        Guarda dte_json con el NPE incluido
```

**Momento 2: Al generar el PDF** (retroactivo para facturas sin NPE)

```
generatePdf(id)
  |
  +-> Parsea dte_json
  |
  +-> Si numPagoElectronico es null Y GLN esta configurado:
  |     Calcula NPE con calculateNpe()
  |     Actualiza dte_json en la BD
  |     Log: "NPE generado retroactivamente"
  |
  +-> prepareTemplateData()
  |     Genera imagen barcode con generateGs1128BarcodeBase64()
  |     Pasa barcodeImage y npeFormatted al template
  |
  +-> Renderiza PDF con jsReport
```

### 8.2 Referencia de la Factura (IA 8020)

El sistema determina la referencia segun el origen de la factura:

| Origen | Campo usado | Ejemplo |
|--------|-------------|---------|
| Factura de contrato | `id_contrato` padded a 10 | `0000008073` |
| Factura directa con cliente | `id_cliente_directo` padded a 10 | `0000001234` |
| Factura directa sin cliente | Digitos del `codigo_generacion` (UUID) | `22964449359` |

### 8.3 Cuando se Genera

| Condicion | Se genera NPE? | Incluye IA 96 (fecha)? |
|-----------|---------------|----------------------|
| GLN no configurado | No | N/A |
| tipoDte = 14 (FSE) | No | N/A |
| tipoDte = 05 (NC) | No | N/A |
| condicion_operacion = 1 (contado) | Si | No |
| condicion_operacion = 2 (credito) | Si | Si (fecha_vencimiento) |

### 8.4 Configuracion del GLN

El GLN se almacena en `GeneralData.gln` (campo agregado al schema Prisma). Es un numero de 13 digitos asignado por GS1 El Salvador que identifica de forma unica a la empresa emisora.

Para configurarlo:
```sql
UPDATE "GeneralData" SET gln = '7419XXXXXXXXX' WHERE id_general = 1;
```

O via Prisma Studio: `npx prisma studio` -> tabla GeneralData -> campo `gln`.

---

## 9. Referencia de Archivos

| Archivo | Descripcion |
|---------|-------------|
| `src/modules/facturacion/dte/builders/npe-barcode.util.ts` | Funciones puras: `calculateNpe`, `buildGs1128Data`, `generateGs1128BarcodeBase64`, `calculateNpeCheckDigit` |
| `src/modules/facturacion/factura-directa/factura-directa.service.ts` | Integracion en `prepararParametrosBuild()` y `prepareTemplateData()` |
| `src/modules/facturacion/services/cobros.service.ts` | Integracion en flujo de cobros (contratos) |
| `templates/facturacion/dte-factura.html` | Template jsRender con seccion de barcode |
| `prisma/schema.prisma` | Campo `gln` en modelo `GeneralData` |

### Funciones principales en `npe-barcode.util.ts`:

```typescript
// Calcula NPE formateado en cuartetos
calculateNpe(params: NpeParams): string

// Construye string de datos para el barcode GS1-128
buildGs1128Data(params: NpeParams): string

// Genera imagen PNG del barcode como data:image/png;base64,...
generateGs1128BarcodeBase64(barcodeData: string): Promise<string>

// Calcula el digito verificador VR (Anexo 2 de la guia)
calculateNpeCheckDigit(numericString: string): number
```

---

> **Documento de referencia**: "GS1 Estandar Codificacion Recibos de Pago", Publicacion 2.0, Draft, Enero 2020, GS1 El Salvador.
