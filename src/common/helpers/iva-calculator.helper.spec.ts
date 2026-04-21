import { calcularLinea, calcularTotales } from './iva-calculator.helper';

describe('iva-calculator', () => {
  describe('calcularLinea', () => {
    it('sin IVA incluido: costo=10 cant=1 => subtotal=10, iva=1.3, total=11.3', () => {
      const r = calcularLinea({ costo_unitario: 10, cantidad: 1 }, 0.13, false);
      expect(r.subtotal).toBe(10);
      expect(r.iva).toBe(1.3);
      expect(r.total).toBe(11.3);
    });

    it('con IVA incluido: costo=10 cant=1 => subtotal≈8.85, iva≈1.15, total=10', () => {
      const r = calcularLinea({ costo_unitario: 10, cantidad: 1 }, 0.13, true);
      expect(r.subtotal).toBe(8.8496);
      expect(r.iva).toBe(1.1504);
      expect(r.total).toBe(10);
    });

    it('respeta descuento: costo=100 cant=2 desc=20 sin IVA', () => {
      const r = calcularLinea(
        { costo_unitario: 100, cantidad: 2, descuento_monto: 20 },
        0.13,
        false,
      );
      expect(r.subtotal).toBe(180);
      expect(r.iva).toBe(23.4);
      expect(r.total).toBe(203.4);
    });

    it('respeta descuento: costo=100 cant=2 desc=20 con IVA incluido', () => {
      const r = calcularLinea(
        { costo_unitario: 100, cantidad: 2, descuento_monto: 20 },
        0.13,
        true,
      );
      expect(r.subtotal).toBe(159.292);
      expect(r.iva).toBe(20.708);
      expect(r.total).toBe(180);
    });
  });

  describe('calcularTotales', () => {
    it('header subtotal es SUM(costo*cant) bruto (sin restar descuento)', () => {
      const r = calcularTotales(
        [{ costo_unitario: 100, cantidad: 2, descuento_monto: 20 }],
        0.13,
        false,
      );
      expect(r.subtotal).toBe(200);
      expect(r.descuento).toBe(20);
    });

    it('flag=true: total header = bruto - descuento (sin sumar IVA adicional)', () => {
      const r = calcularTotales(
        [{ costo_unitario: 100, cantidad: 2, descuento_monto: 20 }],
        0.13,
        true,
      );
      expect(r.total).toBe(180);
      expect(r.iva).toBeCloseTo(20.708, 2);
    });

    it('flag=false: total header = bruto - descuento + IVA', () => {
      const r = calcularTotales(
        [{ costo_unitario: 100, cantidad: 2, descuento_monto: 20 }],
        0.13,
        false,
      );
      expect(r.total).toBe(203.4);
      expect(r.iva).toBe(23.4);
    });

    it('suma líneas correctamente con múltiples items', () => {
      const r = calcularTotales(
        [
          { costo_unitario: 10, cantidad: 1 },
          { costo_unitario: 20, cantidad: 2 },
        ],
        0.13,
        false,
      );
      expect(r.subtotal).toBe(50);
      expect(r.iva).toBe(6.5);
      expect(r.total).toBe(56.5);
    });

    it('tasa configurable: 15% en vez de 13%', () => {
      const r = calcularTotales(
        [{ costo_unitario: 100, cantidad: 1 }],
        0.15,
        false,
      );
      expect(r.iva).toBe(15);
      expect(r.total).toBe(115);
    });

    it('default flag=false cuando no se pasa', () => {
      const r = calcularTotales([{ costo_unitario: 10, cantidad: 1 }], 0.13);
      expect(r.precioConIvaIncluido).toBe(false);
      expect(r.total).toBe(11.3);
    });

    it('preserva invariante total = (bruto - descuento) cuando flag=true', () => {
      const r = calcularTotales(
        [
          { costo_unitario: 50, cantidad: 3, descuento_monto: 10 },
          { costo_unitario: 25, cantidad: 2 },
        ],
        0.13,
        true,
      );
      const bruto = 50 * 3 + 25 * 2;
      const desc = 10;
      expect(r.total).toBeCloseTo(bruto - desc, 2);
    });
  });
});
