import { useEffect, useMemo, useState } from 'react'
import { ChoroplethMap } from './components/ChoroplethMap'
import { allFeatureKeys } from './lib/geoKey'
import {
  buildValueByKey,
  detectSchema,
  extentFromValues,
  parseCsvText,
  type Granularity,
  type ParsedCsvTable,
} from './lib/csv'
import { loadCountyFeatures, loadTownFeatures } from './lib/topo'
import type { FeatureCollection } from 'geojson'
import './App.css'

const DEMO_CSV = `縣市,示範數值
台北市,280
新北市,420
桃園市,210
高雄市,360
金門縣,40
連江縣,15`

type ColumnBinding = {
  countyCol: string
  townCol: string
  valueCol: string
}

function emptyBinding(): ColumnBinding {
  return { countyCol: '', townCol: '', valueCol: '' }
}

function inferGranularity(binding: ColumnBinding): Granularity {
  return binding.townCol.trim() ? 'township' : 'county'
}

export default function App() {
  const [csvText, setCsvText] = useState(DEMO_CSV)
  const [editedBinding, setEditedBinding] = useState<ColumnBinding | null>(
    null,
  )

  const [countyFc, setCountyFc] = useState<FeatureCollection | null>(null)
  const [townFc, setTownFc] = useState<FeatureCollection | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([loadCountyFeatures(), loadTownFeatures()])
      .then(([county, town]) => {
        setCountyFc(county)
        setTownFc(town)
      })
      .catch((err: unknown) => {
        setGeoError(err instanceof Error ? err.message : '無法載入邊界檔')
      })
  }, [])

  const table: ParsedCsvTable | null = useMemo(() => {
    try {
      return csvText.trim() ? parseCsvText(csvText) : null
    } catch {
      return null
    }
  }, [csvText])

  const detected = useMemo(() => {
    if (!table || table.headers.length < 2 || table.rows.length === 0) {
      return null
    }
    return detectSchema(table.headers, table.rows)
  }, [table])

  const suggestedBinding = useMemo((): ColumnBinding => {
    if (!detected) return emptyBinding()
    return {
      townCol: detected.townCol ?? '',
      countyCol: detected.countyCol,
      valueCol: detected.valueCol,
    }
  }, [detected])

  const binding = editedBinding ?? suggestedBinding
  const granularity = inferGranularity(binding)
  const collection = granularity === 'township' ? townFc : countyFc

  const { valueByKey, minV, maxV, parseMsg } = useMemo(() => {
    if (!table || !collection) {
      return {
        valueByKey: new Map<string, number>(),
        minV: 0,
        maxV: 1,
        parseMsg: null as string | null,
      }
    }

    if (!binding.countyCol.trim() || !binding.valueCol.trim()) {
      return {
        valueByKey: new Map<string, number>(),
        minV: 0,
        maxV: 1,
        parseMsg: '請確認已選擇「縣市」與「數值」欄位。',
      }
    }

    if (granularity === 'township' && !binding.townCol.trim()) {
      return {
        valueByKey: new Map<string, number>(),
        minV: 0,
        maxV: 1,
        parseMsg: '鄉鎮市區層級請指定「鄉鎮市區」欄位。',
      }
    }

    const schema = {
      granularity,
      countyCol: binding.countyCol,
      townCol: granularity === 'township' ? binding.townCol : null,
      valueCol: binding.valueCol,
    }

    const validKeys = allFeatureKeys(granularity, collection)
    const built = buildValueByKey(schema, table.rows, validKeys)
    const [mn, mx] = extentFromValues(built.valueByKey)

    return {
      valueByKey: built.valueByKey,
      minV: mn,
      maxV: mx,
      parseMsg: null as string | null,
    }
  }, [table, collection, granularity, binding])

  const onPickFile = (file: File | undefined) => {
    if (!file) return
    file
      .text()
      .then((t) => {
        setCsvText(t)
        setEditedBinding(null)
      })
      .catch(() => {})
  }

  function updateBinding(patch: Partial<ColumnBinding>) {
    setEditedBinding((prev) => ({ ...(prev ?? suggestedBinding), ...patch }))
  }

  const slotTotal = collection
    ? allFeatureKeys(granularity, collection).size
    : 0

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>台灣熱區圖小工具</h1>
        <p className="app-lede">
          貼上或上傳 CSV：<strong>可支援縣市／鄉鎮市區</strong>
          。欄位預設採順序對應：2 欄（縣市＋數值）、3 欄（縣市＋鄉鎮市區＋數值）；超過 3
          欄預設第 1 與最後 1 欄，可手動調整。色階依數值區間自動上色。
        </p>
      </header>

      {geoError ? (
        <p className="banner error" role="alert">
          {geoError}
        </p>
      ) : null}

      <section className="panels">
        <div className="panel editor">
          <div className="csv-toolbar">
            <label className="file-btn">
              選擇 CSV 檔
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                className="sr-only"
                onChange={(e) => {
                  void onPickFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                setEditedBinding(null)
                setCsvText(DEMO_CSV)
              }}
            >
              載入示範資料
            </button>
          </div>

          <textarea
            className="csv-textarea"
            spellCheck={false}
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value)
              setEditedBinding(null)
            }}
            rows={14}
            placeholder="縣市,數值&#10;彰化縣,33.5"
          />

          {table?.headers?.length ? (
            <fieldset className="column-grid">
              <legend>欄位對應（依欄順序預填，可手動調整）</legend>
              <label>
                縣市
                <select
                  value={binding.countyCol}
                  onChange={(e) =>
                    updateBinding({ countyCol: e.target.value })
                  }
                >
                  <option value="">—</option>
                  {table.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                鄉鎮市區（留空＝縣市級）
                <select
                  value={binding.townCol}
                  onChange={(e) =>
                    updateBinding({ townCol: e.target.value })
                  }
                >
                  <option value="">（無）</option>
                  {table.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                數值
                <select
                  value={binding.valueCol}
                  onChange={(e) =>
                    updateBinding({ valueCol: e.target.value })
                  }
                >
                  <option value="">—</option>
                  {table.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
              <p className="grain-note">
                <strong>
                  {granularity === 'county' ? '縣市級' : '鄉鎮市區級'}
                </strong>
                （底圖來自{' '}
                <a
                  href="https://github.com/jason2506/Taiwan.TopoJSON"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Taiwan.TopoJSON
                </a>
                ，係內政部界線之精簡轉檔）。縣市欄可含
                <strong>區／鄉鎮後綴</strong>
                ，會對應到前一層縣市名；臺／台與零寬字元會自動忽略差異。若選鄉鎮欄，會按鄉鎮層上色。
              </p>
            </fieldset>
          ) : (
            <p className="hint">貼入含標題列的 CSV 後可對應欄位。</p>
          )}

          {parseMsg ? <p className="banner warn">{parseMsg}</p> : null}
        </div>

        <div className="panel map-panel">
          {collection ? (
            <>
              <ChoroplethMap
                collection={collection}
                granularity={granularity}
                valueByKey={valueByKey}
                minValue={minV}
                maxValue={maxV}
              />
              <p className="map-match-hint">
                成功上色區塊數：<strong>{valueByKey.size}</strong>
                ／約 {slotTotal}（目前底圖槽位）。
                「無資料」色代表 CSV{' '}
                <strong>沒有列出該區塊</strong>
                ，或該列因地名／數字格式不符而略過。
              </p>
            </>
          ) : (
            <p className="hint muted">載入邊界資料…</p>
          )}
        </div>
      </section>

      <footer className="footer-note">
        同一鍵（縣市或縣市＋鄉鎮）有多筆列時會以<strong>最後一筆</strong>
        為準；千分位逗號與 BOM 會自動處理。請盡量使用與開放資料一致的地名名稱。
      </footer>
    </div>
  )
}
