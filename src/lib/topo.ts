import type { FeatureCollection } from 'geojson'
import type { Topology } from 'topojson-specification'
import { feature } from 'topojson-client'

/** 來自 gov 公開界線轉檔（幾何品質優於既有 g0v 2010 簡檔）；見 repo README 授權說明 */
const COUNTY_TOPO_URL =
  'https://raw.githubusercontent.com/jason2506/Taiwan.TopoJSON/master/topojson/counties.json'
const TOWN_TOPO_BASE =
  'https://raw.githubusercontent.com/jason2506/Taiwan.TopoJSON/master/topojson/towns'
const TOWN_COUNTY_CODES = [
  '09007',
  '09020',
  '10002',
  '10004',
  '10005',
  '10007',
  '10008',
  '10009',
  '10010',
  '10013',
  '10014',
  '10015',
  '10016',
  '10017',
  '10018',
  '10020',
  '63000',
  '64000',
  '65000',
  '66000',
  '67000',
  '68000',
] as const

let countyCache: FeatureCollection | null = null
let townCache: FeatureCollection | null = null

export async function loadCountyFeatures(): Promise<FeatureCollection> {
  if (countyCache) return countyCache
  const topo = (await fetch(COUNTY_TOPO_URL).then((r) =>
    r.json(),
  )) as Topology
  countyCache = feature(topo, topo.objects.map) as FeatureCollection
  return countyCache
}

export async function loadTownFeatures(): Promise<FeatureCollection> {
  if (townCache) return townCache

  const counties = await loadCountyFeatures()
  const countyNameByCode = new Map<string, string>()
  for (const f of counties.features) {
    const p = f.properties as Record<string, string | undefined> | null
    if (p?.id && p?.name) countyNameByCode.set(p.id, p.name)
  }

  const files = await Promise.all(
    TOWN_COUNTY_CODES.map(async (code) => {
      const url = `${TOWN_TOPO_BASE}/towns-${code}.json`
      const topo = (await fetch(url).then((r) => r.json())) as Topology
      return feature(topo, topo.objects.map) as FeatureCollection
    }),
  )

  const merged: FeatureCollection = {
    type: 'FeatureCollection',
    features: files.flatMap((fc) =>
      fc.features.map((f) => {
        const p = (f.properties ?? {}) as Record<string, string | undefined>
        const countyCode = p.id?.slice(0, 5) ?? ''
        const countyName = countyNameByCode.get(countyCode)
        return {
          ...f,
          properties: {
            ...p,
            COUNTYCODE: countyCode,
            COUNTYNAME: countyName,
          },
        }
      }),
    ),
  }

  townCache = merged
  return townCache
}
