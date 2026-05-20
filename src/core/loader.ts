/** Importer signature, injectable for testing. */
export type Importer = (url: string) => Promise<{ default: unknown }>;

const defaultImporter: Importer = (url) =>
  import(/* @vite-ignore */ url) as Promise<{ default: unknown }>;

/** Resolve base URL for chunks: explicit override, else strip filename from src. */
export function resolveAssetBase(scriptSrc: string, override?: string): string {
  if (override) return override;
  return scriptSrc.replace(/[^/]*$/, '');
}

/** Build a chunk loader bound to an assetBase, with cache + single retry. */
export function makeLoader(assetBase: string, importer: Importer = defaultImporter) {
  const cache = new Map<string, unknown>();
  return async function load(name: string): Promise<unknown> {
    if (cache.has(name)) return cache.get(name);
    const url = `${assetBase}chunks/${name}.esm.js`;
    let mod: { default: unknown };
    try {
      mod = await importer(url);
    } catch {
      mod = await importer(url); // retry once
    }
    cache.set(name, mod.default);
    return mod.default;
  };
}
