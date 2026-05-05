import type { Feature, FeatureCollection } from 'geojson'
import type { Granularity } from './csv'
import { canonicalCountyName, normalizeText } from './normalize'

export function featureLookupKey(
  granularity: Granularity,
  f: Feature,
): string | null {
  const p = f.properties as Record<string, string | undefined> | null
  const countyLabel = p?.COUNTYNAME ?? p?.countyName ?? p?.name
  if (!countyLabel) return null
  const county = canonicalCountyName(countyLabel)
  if (granularity === 'county') return county
  if (!p?.name) return null
  return `${county}|${normalizeText(p.name)}`
}

export function allFeatureKeys(
  granularity: Granularity,
  collection: FeatureCollection,
): Set<string> {
  const s = new Set<string>()
  for (const feat of collection.features) {
    const k = featureLookupKey(granularity, feat)
    if (k) s.add(k)
  }
  return s
}
