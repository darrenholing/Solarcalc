import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { monthlyFactorsFor } from '@/lib/irradiance'
import { Market } from '@/types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const period = searchParams.get('period') ?? 'week'

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = await createClient()
  // Bug 9 — walk installation → project → client → installer to detect the
  // installer's configured market (and province, for ZA irradiance factors)
  const { data: installation } = await supabase
    .from('installations')
    .select('*, project:projects(system_size_kwp, annual_output_kwh, client:clients(installer:users(market, province)))')
    .eq('id', id)
    .single()

  if (!installation) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const kwp = installation.project?.system_size_kwp ?? 0
  const installer = installation.project?.client?.installer
  const market: Market = (installer?.market as Market) ?? 'NL'
  const province: string | null = installer?.province ?? null

  // Try Victron VRM API
  if (installation.inverter_type === 'victron' && installation.monitoring_api_key && installation.system_id) {
    try {
      const victronData = await fetchVictronData(installation.monitoring_api_key, installation.system_id, period)
      if (victronData) return NextResponse.json(victronData)
    } catch (err) {
      console.error('Victron VRM fetch failed:', err)
    }
  }

  // Try SolarEdge API
  if (installation.inverter_type === 'solaredge' && installation.monitoring_api_key && installation.system_id) {
    try {
      const seData = await fetchSolarEdgeData(installation.monitoring_api_key, installation.system_id, period)
      if (seData) return NextResponse.json(seData)
    } catch (err) {
      console.error('SolarEdge fetch failed:', err)
    }
  }

  // Fallback: simulated data based on market-correct irradiance + system size
  const data = generateSimulatedData(period, kwp, market, province)
  return NextResponse.json({ data, live_watts: null, simulated: true })
}

// Feature 20 — Victron VRM v2 field mapping. The `stats` endpoint returns
// `records` as a map of series name → array of `[timestampSeconds, value]`
// tuples (not bare numbers), and live power comes from the separate
// `widgets/Overview` (a.k.a. diagnostics) endpoint, not from `stats`.
async function fetchVictronData(token: string, siteId: string, period: string) {
  const interval = period === 'day' ? 'hours' : 'days'
  const count = period === 'day' ? 24 : period === 'week' ? 7 : 30
  const end = Math.floor(Date.now() / 1000)
  const start = end - count * (interval === 'hours' ? 3600 : 86400)

  const headers = { 'X-Authorization': `Token ${token}` }

  const statsRes = await fetch(
    `https://vrmapi.victronenergy.com/v2/installations/${siteId}/stats?type=consumption&interval=${interval}&start=${start}&end=${end}&attributeCodes[]=solar_yield`,
    { headers }
  )
  if (!statsRes.ok) return null
  const statsJson = await statsRes.json()

  // VRM returns { success, records: { solar_yield: [[ts, value], ...], ... } }
  // Different installation types expose different attribute keys, so look for
  // the first series that looks like a [timestamp, value] tuple array.
  const records = statsJson.records ?? {}
  const seriesKey = Object.keys(records).find(k => Array.isArray(records[k]) && Array.isArray(records[k][0]))
  const series: Array<[number, number]> = seriesKey ? records[seriesKey] : []

  const data = series.slice(-count).map(([ts, value], i) => ({
    label: labelForTimestamp(ts, period),
    actual: typeof value === 'number' ? Math.round(value * 10) / 10 : 0,
    expected: 0,
  }))

  // Live power lives on the installation's diagnostics/overview widget, not stats
  let liveWatts: number | null = null
  try {
    const overviewRes = await fetch(
      `https://vrmapi.victronenergy.com/v2/installations/${siteId}/diagnostics?count=1`,
      { headers }
    )
    if (overviewRes.ok) {
      const overviewJson = await overviewRes.json()
      const records = overviewJson.records ?? []
      const pv = records.find((r: any) => r.code === 'PVP' || r.description === 'PV - Power' || r.idDataAttribute === 442)
      liveWatts = pv ? Number(pv.formattedValue ?? pv.rawValue) : null
    }
  } catch {
    // Live power is best-effort — historical data above is the important part
  }

  if (data.length === 0) return null
  return { data, live_watts: liveWatts }
}

async function fetchSolarEdgeData(apiKey: string, siteId: string, period: string) {
  const end = new Date()
  const start = new Date()
  if (period === 'day') start.setDate(start.getDate() - 1)
  else if (period === 'week') start.setDate(start.getDate() - 7)
  else start.setMonth(start.getMonth() - 1)

  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const timeUnit = period === 'day' ? 'HOUR' : 'DAY'
  const url = `https://monitoringapi.solaredge.com/site/${siteId}/energy?timeUnit=${timeUnit}&startDate=${fmt(start)}&endDate=${fmt(end)}&api_key=${apiKey}`

  const res = await fetch(url)
  if (!res.ok) return null
  const json = await res.json()
  const values = json.energy?.values ?? []
  if (values.length === 0) return null

  return {
    data: values.map((v: any, i: number) => ({
      label: labelFor(period, i, values.length),
      actual: (v.value ?? 0) / 1000,
      expected: 0,
    })),
    live_watts: null,
  }
}

// Bug 9 / Feature 21 — market-aware simulation with a guaranteed non-empty,
// finite factor table (no more hardcoded NL irradiance for ZA installers, and
// no Math.max(...[]) crashes downstream)
function generateSimulatedData(period: string, kwp: number, market: Market, province: string | null) {
  const monthlyFactors = monthlyFactorsFor(market, province)
  const now = new Date()
  const count = period === 'day' ? 24 : period === 'week' ? 7 : 30

  // Southern hemisphere seasons are inverted relative to the factor table's
  // calendar-month indexing — monthlyFactorsFor already returns ZA factors
  // indexed by calendar month (Jan=index 0), so no further adjustment needed.
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now)
    if (period === 'day') { d.setHours(now.getHours() - (count - 1 - i)) }
    else { d.setDate(now.getDate() - (count - 1 - i)) }

    const monthFactor = monthlyFactors[d.getMonth()] ?? 1
    const dailyExpected = kwp * 3.5 * monthFactor
    const actual = period === 'day'
      ? Math.max(0, dailyExpected * (Math.sin(((i - 5) / 14) * Math.PI) + (Math.random() - 0.5) * 0.1)) / 24
      : dailyExpected * (0.85 + Math.random() * 0.3)

    return {
      label: labelFor(period, i, count),
      actual: Math.round(actual * 10) / 10,
      expected: Math.round(dailyExpected * (period === 'day' ? (1 / 24) : 1) * 10) / 10,
    }
  })
}

function labelFor(period: string, i: number, total: number): string {
  const d = new Date()
  if (period === 'day') {
    d.setHours(d.getHours() - (total - 1 - i))
    return `${d.getHours()}:00`
  } else {
    d.setDate(d.getDate() - (total - 1 - i))
    return period === 'month' ? d.getDate().toString() : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
  }
}

function labelForTimestamp(tsSeconds: number, period: string): string {
  const d = new Date(tsSeconds * 1000)
  if (period === 'day') return `${d.getHours()}:00`
  if (period === 'month') return d.getDate().toString()
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
}
