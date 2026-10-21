const supported = new Set(['carton', 'pouch', 'bottle_label', 'sleeve']);
const aliases = new Map([
  ['carton', 'carton'],
  ['pouch', 'pouch'],
  ['bottle', 'bottle_label'],
  ['bottle label', 'bottle_label'],
  ['bottle_label', 'bottle_label'],
  ['sleeve', 'sleeve'],
]);

export function packageTypeFromSources(documents) {
  const values = (documents || [])
    .filter(document => document?.role === 'spec')
    .map(document => document?.data?.product?.package_type ?? document?.data?.product?.packageType)
    .map(value => aliases.get(String(value || '').trim().toLowerCase()))
    .filter(value => supported.has(value));
  return [...new Set(values)].length === 1 ? values[0] : null;
}
