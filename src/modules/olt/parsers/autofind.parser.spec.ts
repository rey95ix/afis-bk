import { parseAutofindOutput } from './autofind.parser';

describe('parseAutofindOutput', () => {
  it('returns [] for empty input', () => {
    expect(parseAutofindOutput('')).toEqual([]);
  });

  it('returns [] when output says there is no autofind ONT', () => {
    const raw = `
      huawei(config)#display ont autofind all
      Failure: There is no autofind ONT
      huawei(config)#
    `;
    expect(parseAutofindOutput(raw)).toEqual([]);
  });

  it('parses a single ONT block', () => {
    const raw = `
huawei(config)#display ont autofind all
  ----------------------------------------------------------------------------
  Number       : 1
  F/S/P        : 0/2/1
  Ont SN       : 485754430058E5C0 (HWTC-0058E5C0)
  Password     : 0x00000000000000000000
  Loid         :
  VendorID     : HWTC
  Ont Version             : 220.A
  Ont SoftwareVersion     : V5R019C10S105
  Ont EquipmentID         : HG8245H
  Ont autofind time       : 2024-01-15 10:30:45
  ----------------------------------------------------------------------------
huawei(config)#
    `;
    const result = parseAutofindOutput(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      frame: 0,
      slot: 2,
      port: 1,
      number: 1,
      serialNumber: '485754430058E5C0',
      vendorId: 'HWTC',
      equipmentId: 'HG8245H',
      version: '220.A',
      softwareVersion: 'V5R019C10S105',
      discoveredAt: '2024-01-15 10:30:45',
    });
    expect(result[0].password).toBeUndefined();
    expect(result[0].loid).toBeUndefined();
  });

  it('parses multiple ONT blocks across different slots/ports', () => {
    const raw = `
  ----------------------------------------------------------------------------
  Number       : 1
  F/S/P        : 0/2/1
  Ont SN       : 485754430058E5C0
  VendorID     : HWTC
  Ont EquipmentID : HG8245H
  ----------------------------------------------------------------------------
  Number       : 2
  F/S/P        : 0/2/3
  Ont SN       : 48575443AABBCCDD
  VendorID     : HWTC
  Ont EquipmentID : EG8145V5
  ----------------------------------------------------------------------------
  Number       : 3
  F/S/P        : 0/3/0
  Ont SN       : 48575443FFEEDDCC
  VendorID     : HWTC
  ----------------------------------------------------------------------------
    `;
    const result = parseAutofindOutput(raw);
    expect(result).toHaveLength(3);
    expect(result.map((o) => `${o.frame}/${o.slot}/${o.port}`)).toEqual([
      '0/2/1',
      '0/2/3',
      '0/3/0',
    ]);
    expect(result[1].equipmentId).toBe('EG8145V5');
  });

  it('ignores blocks without F/S/P or SN', () => {
    const raw = `
  ----------------------------------------------------------------------------
  Number       : 1
  VendorID     : HWTC
  ----------------------------------------------------------------------------
    `;
    expect(parseAutofindOutput(raw)).toEqual([]);
  });

  it('keeps a non-zero password when present', () => {
    const raw = `
  ----------------------------------------------------------------------------
  Number       : 1
  F/S/P        : 0/1/2
  Ont SN       : 48575443DEADBEEF
  Password     : 1234567890ABCDEF
  ----------------------------------------------------------------------------
    `;
    const result = parseAutofindOutput(raw);
    expect(result[0].password).toBe('1234567890ABCDEF');
  });
});
