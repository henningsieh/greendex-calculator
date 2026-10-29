type Bundle = Record<string, object>;

type UnionToIntersection<U> = (
  U extends unknown ? (value: U) => void : never
) extends (value: infer Intersection) => void
  ? Intersection
  : never;

/** Merges domain bundles and rejects duplicate top-level namespaces. */
export function mergeMessages<const Bundles extends readonly Bundle[]>(
  bundles: Bundles,
): UnionToIntersection<Bundles[number]> {
  const merged: Bundle = {};
  for (const bundle of bundles) {
    for (const [namespace, value] of Object.entries(bundle)) {
      if (Object.hasOwn(merged, namespace)) {
        throw new Error(`Duplicate message namespace: ${namespace}`);
      }
      merged[namespace] = value;
    }
  }
  return merged as UnionToIntersection<Bundles[number]>;
}
