import { geoBounds } from 'd3-geo'
import type { Feature, FeatureCollection } from 'geojson'

/**
 * 少數來源可能出現壞包圍框，導致 Mercator `fitSize` 把全圖縮成一點。
 * 只將「經緯度範圍合理」的 feature 餵給 fit，繪製仍用原始 collection。
 */
const FIT_LON = { min: 115, max: 127 } as const
const FIT_LAT = { min: 20, max: 28 } as const
/** 單一縣市級在包圍框上應遠小於此（度）；超過代表壞幾何或誤算 */
const MAX_REASONABLE_LON_SPAN = 25
const MAX_REASONABLE_LAT_SPAN = 16

const TAIWAN_FALLBACK_FC: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [FIT_LON.min, FIT_LAT.min],
            [FIT_LON.max, FIT_LAT.min],
            [FIT_LON.max, FIT_LAT.max],
            [FIT_LON.min, FIT_LAT.max],
            [FIT_LON.min, FIT_LAT.min],
          ],
        ],
      },
    },
  ],
}

function featureHasSaneFitBounds(f: Feature): boolean {
  try {
    const [[x0, y0], [x1, y1]] = geoBounds(f)
    const lonSpan = Math.abs(x1 - x0)
    const latSpan = Math.abs(y1 - y0)
    if (lonSpan >= MAX_REASONABLE_LON_SPAN) return false
    if (latSpan >= MAX_REASONABLE_LAT_SPAN) return false
    if (x0 < FIT_LON.min || x1 > FIT_LON.max) return false
    if (y0 < FIT_LAT.min || y1 > FIT_LAT.max) return false
    return Number.isFinite(lonSpan)
  } catch {
    return false
  }
}

/** 僅供 `geoMercator().fitSize` / `fitExtent` 的第二參數使用 */
export function featureCollectionForMercatorFit(
  fc: FeatureCollection,
): FeatureCollection {
  const sane = fc.features.filter(featureHasSaneFitBounds)
  if (sane.length >= 8) {
    return { type: 'FeatureCollection', features: sane }
  }
  return TAIWAN_FALLBACK_FC
}
