import Papa from 'papaparse'
import { isMeaningfulPlaceText } from './normalize'
import {
  matchCountyCsvCellToMapKey,
  matchTownCsvCellToMapKey,
} from './matchCountyKey'

export type Granularity = 'county' | 'township'

export type CsvSchema = {
  granularity: Granularity
  countyCol: string
  townCol: string | null
  valueCol: string
}

export type ParsedCsvTable = {
  headers: string[]
  rows: Record<string, string>[]
}

/** Parse BOM-tolerant CSV; returns header row + object rows */
export function parseCsvText(text: string): ParsedCsvTable {
  const bomStripped = text.replace(/^\uFEFF/, '')
  const parsed = Papa.parse<Record<string, string>>(bomStripped, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h: string) => h.trim(),
  })

  const headers =
    parsed.meta.fields?.filter(Boolean) ??
    (parsed.data[0] ? Object.keys(parsed.data[0]) : [])

  const rows = parsed.data.filter((row) =>
    headers.some((h) => row[h]?.trim()),
  )

  return { headers, rows }
}

/**
 * 依 CSV 左→右欄位順序固定對應：
 * — 兩欄：縣市、數值。
 * — 三欄：縣市、鄉鎮市區、數值。
 * — 超過三欄：第一欄縣市、最後一欄數值（可手動指定鄉鎮欄）。
 */
export function detectSchema(headers: string[], rows: Record<string, string>[]): CsvSchema | null {
  if (headers.length < 2 || rows.length === 0) return null

  const n = headers.length

  if (n === 2) {
    return {
      granularity: 'county',
      countyCol: headers[0],
      townCol: null,
      valueCol: headers[1],
    }
  }

  if (n === 3) {
    return {
      granularity: 'township',
      countyCol: headers[0],
      townCol: headers[1],
      valueCol: headers[2],
    }
  }

  return {
    granularity: 'county',
    countyCol: headers[0],
    townCol: null,
    valueCol: headers[n - 1],
  }
}

/** Build lookup keys consistent with county GeoJSON `featureLookupKey` */
export function rowToLookupKey(
  schema: CsvSchema,
  row: Record<string, string>,
  validKeys: Set<string>,
): string | null {
  const rawCounty = row[schema.countyCol]
  const v = parseNumber(row[schema.valueCol])
  if (!Number.isFinite(v) || !isMeaningfulPlaceText(rawCounty)) {
    return null
  }
  if (schema.granularity === 'county') {
    return matchCountyCsvCellToMapKey(String(rawCounty), validKeys)
  }
  if (!schema.townCol) return null
  const countyKeys = new Set<string>()
  for (const k of validKeys) {
    const county = k.split('|')[0]
    if (county) countyKeys.add(county)
  }
  const countyKey = matchCountyCsvCellToMapKey(String(rawCounty), countyKeys)
  if (!countyKey) return null
  return matchTownCsvCellToMapKey(
    countyKey,
    String(row[schema.townCol] ?? ''),
    validKeys,
  )
}

export function parseNumber(cell: string): number {
  const t = cell?.trim().replace(/,/g, '') ?? ''
  return Number(t)
}

export type BuildValuesResult = {
  valueByKey: Map<string, number>
  usedRows: number
}

export function buildValueByKey(
  schema: CsvSchema,
  rows: Record<string, string>[],
  validKeys: Set<string>,
): BuildValuesResult {
  const valueByKey = new Map<string, number>()
  let usedRows = 0

  for (const row of rows) {
    const key = rowToLookupKey(schema, row, validKeys)
    if (!key) continue
    const v = parseNumber(row[schema.valueCol])
    if (!Number.isFinite(v)) continue
    if (!validKeys.has(key)) continue

    usedRows++
    valueByKey.set(key, v)
  }

  return { valueByKey, usedRows }
}

export function extentFromValues(m: Map<string, number>): [number, number] {
  let min = Infinity
  let max = -Infinity
  for (const v of m.values()) {
    if (v < min) min = v
    if (v > max) max = v
  }
  if (!Number.isFinite(min)) return [0, 0]
  if (min === max) return [min, min + 1e-9]
  return [min, max]
}
