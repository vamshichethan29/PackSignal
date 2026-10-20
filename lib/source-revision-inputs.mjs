const REPLACEABLE_ROLES = new Set(['spec', 'rules', 'claims']);

export async function buildSourceRevisionInputs(previousFiles, replacements, readOriginal) {
  if (!Array.isArray(replacements) || replacements.length < 1 || replacements.length > 7) {
    throw new Error('Choose one or more product specifications, checklists, or claims sources to add or replace.');
  }
  const existing = new Map((previousFiles || []).map(file => [file.id, file]));
  const selected = new Map();
  const additions = [];
  for (const replacement of replacements) {
    if (!replacement || typeof replacement !== 'object') throw new Error('Choose a source file to add or replace.');
    if (!replacement.replacesFileId) {
      if (!REPLACEABLE_ROLES.has(replacement.role)) throw new Error('New references must be product specifications, checklists, or claims sources.');
      additions.push({ name: replacement.name, role: replacement.role, base64: replacement.base64 });
      continue;
    }
    const target = existing.get(replacement.replacesFileId);
    if (!target || !REPLACEABLE_ROLES.has(target.role)) {
      throw new Error('Choose an existing product specification, checklist, or claims source to replace.');
    }
    if (selected.has(target.id)) throw new Error('Replace each source file only once per update.');
    selected.set(target.id, replacement);
  }
  if (existing.size + additions.length > 8) throw new Error('A review can contain up to eight files. Replace an existing reference or add fewer files.');

  const retained = await Promise.all((previousFiles || []).map(async file => {
    const replacement = selected.get(file.id);
    if (replacement) {
      if (replacement.role && replacement.role !== file.role) {
        throw new Error('A replacement must keep the source role of the selected file.');
      }
      return { name: replacement.name, role: file.role, base64: replacement.base64 };
    }
    const bytes = await readOriginal(file);
    return { name: file.name, role: file.role, base64: bytes.toString('base64'), ...(file.captureFaces ? {captureFaces:structuredClone(file.captureFaces)} : {}) };
  }));
  return [...retained, ...additions];
}
