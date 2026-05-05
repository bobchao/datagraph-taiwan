import { canonicalCountyName, isMeaningfulPlaceText } from './normalize'
import { normalizeText } from './normalize'

/**
 * 將 CSV 縣市欄對應到與底圖 `featureLookupKey` 相同的鍵。
 * 支援：臺↔台、升格舊名（見 canonicalCountyName）、
 * 「台北市大安區」等前綴、僅「台北」補縣／市後綴（嘉義縣／嘉義市同時存在時不交給自動判斷）。
 */
export function matchCountyCsvCellToMapKey(
  csvCell: string,
  validKeys: Set<string>,
): string | null {
  if (!isMeaningfulPlaceText(csvCell)) return null

  const label = canonicalCountyName(csvCell)
  if (validKeys.has(label)) return label

  const longestFirst = [...validKeys].sort((a, b) => b.length - a.length)
  for (const k of longestFirst) {
    if (label.startsWith(k)) return k
  }

  if (!/[縣市]$/.test(label)) {
    const asCounty = `${label}縣`
    const asCity = `${label}市`
    const hasCounty = validKeys.has(asCounty)
    const hasCity = validKeys.has(asCity)
    if (hasCounty && hasCity) return null
    if (hasCounty) return asCounty
    if (hasCity) return asCity
  }

  return null
}

function normalizeTownLabel(raw: string): string {
  let s = normalizeText(raw)
  s = s.replace(/（[^）]*）/g, '')
  s = s.replace(/\([^)]*\)/g, '')
  return s
}

export function matchTownCsvCellToMapKey(
  countyKey: string,
  csvTownCell: string,
  validKeys: Set<string>,
): string | null {
  if (!isMeaningfulPlaceText(csvTownCell)) return null
  const townLabel = normalizeTownLabel(csvTownCell)
  if (!townLabel) return null
  const direct = `${countyKey}|${townLabel}`
  if (validKeys.has(direct)) return direct

  const prefix = `${countyKey}|`
  const towns = [...validKeys]
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.slice(prefix.length))
  for (const t of towns) {
    if (townLabel.startsWith(t) || t.startsWith(townLabel)) {
      return `${countyKey}|${t}`
    }
  }
  return null
}
