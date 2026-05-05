import {
  type CSSProperties,
  type ReactElement,
  useMemo,
  useRef,
  useState,
} from 'react'
import { geoPath, geoMercator } from 'd3-geo'
import { scaleSequential } from 'd3-scale'
import { interpolateYlGnBu } from 'd3-scale-chromatic'
import type { Feature, FeatureCollection } from 'geojson'
import type { Granularity } from '../lib/csv'
import { featureCollectionForMercatorFit } from '../lib/mapFit'
import { featureLookupKey } from '../lib/geoKey'

type Props = {
  collection: FeatureCollection
  granularity: Granularity
  valueByKey: Map<string, number>
  minValue: number
  maxValue: number
}

const W = 720
const H = 920

export function ChoroplethMap({
  collection,
  granularity,
  valueByKey,
  minValue,
  maxValue,
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{
    x: number
    y: number
    title: string
    value?: number
  } | null>(null)

  const legendStyle = useMemo(() => {
    const mid = scaleSequential(
      [minValue, maxValue],
      interpolateYlGnBu as (t: number) => string,
    )
    return {
      '--legend-lo': mid(minValue),
      '--legend-hi': mid(maxValue),
    } as CSSProperties
  }, [minValue, maxValue])

  const paths = useMemo(() => {
    const projection = geoMercator()
      .fitSize([W, H], featureCollectionForMercatorFit(collection))
      .precision(88)
    const pathGen = geoPath(projection)

    const color = scaleSequential(
      [minValue, maxValue],
      interpolateYlGnBu as (t: number) => string,
    )

    const noData = 'var(--map-no-data)'
    const stroke = 'var(--map-stroke)'
    const strokeW = granularity === 'county' ? 1.05 : 0.65

    const elems: ReactElement[] = []
    for (let i = 0; i < collection.features.length; i++) {
      const f = collection.features[i] as Feature
      const dPath = pathGen(f)
      if (!dPath) continue
      const lookupKey = featureLookupKey(granularity, f)
      const raw =
        lookupKey != null ? valueByKey.get(lookupKey) : undefined
      const fill =
        raw !== undefined && Number.isFinite(raw) ? color(raw) : noData
      const p = f.properties as Record<string, string | undefined>
      const tipTitle =
        granularity === 'township'
          ? `${p?.COUNTYNAME ?? p?.countyName ?? ''} ${p?.name ?? ''}`.trim()
          : (p?.COUNTYNAME ?? p?.countyName ?? p?.name ?? '')

      elems.push(
        <path
          key={lookupKey ?? `${granularity}-${i}`}
          d={dPath}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeW}
          strokeLinejoin="round"
          cursor="crosshair"
          onMouseLeave={() => setTip(null)}
          onMouseMove={(e) => {
            const shell = shellRef.current
            if (!shell) return
            const r = shell.getBoundingClientRect()
            setTip({
              x: e.clientX - r.left,
              y: e.clientY - r.top,
              title: tipTitle,
              value: raw,
            })
          }}
        />,
      )
    }

    return elems
  }, [collection, granularity, valueByKey, minValue, maxValue])

  const fmt =
    Number.isInteger(minValue) && Number.isInteger(maxValue)
      ? new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 })
      : new Intl.NumberFormat('zh-TW', { maximumSignificantDigits: 4 })

  return (
    <div ref={shellRef} className="map-shell" style={legendStyle}>
      <svg
        className="choropleth-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Taiwan choropleth"
      >
        <g>{paths}</g>
      </svg>

      <div className="map-legend">
        <div className="map-legend-gradient" />
        <div className="map-legend-labels">
          <span>{fmt.format(minValue)}</span>
          <span>{fmt.format(maxValue)}</span>
        </div>
        <span className="map-legend-hint">
          色相由資料區間自動對應（linear sequential，YlGnBu）
        </span>
      </div>

      {tip ? (
        <div
          className="map-tooltip"
          style={{ left: tip.x + 12, top: tip.y + 12 }}
        >
          <strong>{tip.title}</strong>
          <div>
            {tip.value !== undefined
              ? fmt.format(tip.value)
              : '（無對應數值）'}
          </div>
        </div>
      ) : null}
    </div>
  )
}
