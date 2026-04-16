import { DiscoveredOnt } from '../interfaces/olt-command.interface';

/**
 * Parses the raw CLI output of `display ont autofind all` from a Huawei MA5680T.
 *
 * Each discovered ONT is emitted as a block with `key : value` pairs and blocks
 * are separated by long `---` lines. A leading `Number : N` line marks the start
 * of a new block. If the OLT has no ONTs in autofind state it returns an empty
 * array (also when the output contains "no autofind ONT").
 */
export function parseAutofindOutput(raw: string): DiscoveredOnt[] {
  if (!raw || /no\s+autofind\s+ont/i.test(raw)) return [];

  const lines = raw.split(/\r?\n/);
  const blocks: Record<string, string>[] = [];
  let current: Record<string, string> | null = null;

  const flush = () => {
    if (current && Object.keys(current).length > 0) blocks.push(current);
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^-{3,}/.test(line)) {
      flush();
      continue;
    }

    const kvMatch = line.match(/^([A-Za-z][A-Za-z0-9 /.]*?)\s*:\s*(.*)$/);
    if (!kvMatch) continue;

    const key = kvMatch[1].trim().toLowerCase();
    const value = kvMatch[2].trim();

    if (key === 'number') {
      flush();
      current = {};
      current[key] = value;
      continue;
    }

    if (!current) current = {};
    current[key] = value;
  }
  flush();

  const results: DiscoveredOnt[] = [];
  for (const block of blocks) {
    const fsp = block['f/s/p'];
    const sn = block['ont sn'] || block['sn'];
    if (!fsp || !sn) continue;

    const fspParts = fsp.split('/').map((p) => parseInt(p.trim(), 10));
    if (fspParts.length !== 3 || fspParts.some((n) => Number.isNaN(n))) continue;

    const serialNumber = sn.split(/\s+/)[0];
    const numberStr = block['number'];
    const number = numberStr ? parseInt(numberStr, 10) : 0;

    const password = cleanOptional(block['password']);
    const loid = cleanOptional(block['loid']);

    results.push({
      frame: fspParts[0],
      slot: fspParts[1],
      port: fspParts[2],
      number: Number.isNaN(number) ? 0 : number,
      serialNumber,
      password,
      loid,
      vendorId: cleanOptional(block['vendorid']),
      equipmentId: cleanOptional(block['ont equipmentid']),
      version: cleanOptional(block['ont version']),
      softwareVersion: cleanOptional(block['ont softwareversion']),
      discoveredAt: cleanOptional(block['ont autofind time']),
    });
  }

  return results;
}

function cleanOptional(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^0x0+$/i.test(trimmed)) return undefined;
  return trimmed;
}
