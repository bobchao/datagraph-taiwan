/** Strip常見隱藏字元、括號註解，供縣市欄比對；並統一半形、臺→台 */
export function prepareCountyCell(raw: string): string {
  let s = String(raw).normalize('NFKC').trim()
  s = s.replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
  s = s.replace(/（[^）]*）/g, '')
  s = s.replace(/\([^)]*\)/g, '')
  s = s.replace(/\s+/g, '')
  s = s.replace(/臺/g, '台')
  return s
}

/** 一般文字正規化（數值以外的欄位亦可沿用） */
export function normalizeText(raw: string): string {
  let s = String(raw).normalize('NFKC').trim()
  s = s.replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
  s = s.replace(/\s+/g, '')
  s = s.replace(/臺/g, '台')
  return s
}

/** True when the cell looks like an actual place name (not CSV null sentinels) */
export function isMeaningfulPlaceText(raw: unknown): boolean {
  if (raw == null) return false
  const n = prepareCountyCell(String(raw))
  if (!n) return false
  const lower = n.toLowerCase()
  if (
    lower === 'null' ||
    lower === 'undefined' ||
    lower === 'na' ||
    lower === 'n/a'
  ) {
    return false
  }
  if (n === '-' || n === '—' || n === 'N/A') return false
  return true
}

/** Map legacy／底圖用字為單一比對鍵（縣市欄／底圖 `name`／`COUNTYNAME` 經同一規則） */
export function canonicalCountyName(raw: string): string {
  const n = prepareCountyCell(raw)
  const legacy = new Map<string, string>([
    ['台北縣', '新北市'],
    ['桃園縣', '桃園市'],
    ['台中縣', '台中市'],
    ['臺中縣', '台中市'],
    ['台南縣', '台南市'],
    ['臺南縣', '台南市'],
    ['高雄縣', '高雄市'],
  ])
  return legacy.get(n) ?? n
}
