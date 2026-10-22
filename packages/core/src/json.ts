export type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Reject values that JSON.stringify would silently alter or discard. */
export function assertJSON(value: unknown, active = new Set<object>()): asserts value is JSONValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object' || value === null) throw new Error('expected JSON-compatible data');
  if (active.has(value)) throw new Error('recursive values are not JSON-compatible');
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new Error('expected a JSON object');
  }
  if (Reflect.ownKeys(value).some(key => typeof key === 'symbol')) throw new Error('JSON object keys must be strings');
  active.add(value);
  for (const item of Array.isArray(value) ? value : Object.values(value)) assertJSON(item, active);
  active.delete(value);
}

/** Match Python/code point ordering without depending on the host locale. */
export function compareText(a: string, b: string): number {
  const left = Array.from(a, c => c.codePointAt(0)!);
  const right = Array.from(b, c => c.codePointAt(0)!);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return left.length - right.length;
}

export function sortedJSON(value: unknown): string {
  assertJSON(value);
  function sort(item: JSONValue): JSONValue {
    if (Array.isArray(item)) return item.map(sort);
    if (item !== null && typeof item === 'object') {
      return Object.fromEntries(Object.keys(item).sort(compareText).map(key => [key, sort(item[key])]));
    }
    return item;
  }
  return JSON.stringify(sort(value), null, 2) + '\n';
}
