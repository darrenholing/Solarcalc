import { NextRequest, NextResponse } from 'next/server'

// Proxy for the NASA POWER API — avoids CORS issues in the browser and keeps
// the request origin clean (NASA's API is public, no key required).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
  }

  const url = [
    'https://power.larc.nasa.gov/api/temporal/monthly/point',
    `?parameters=ALLSKY_SFC_SW_DWN`,
    `&community=RE`,
    `&longitude=${lng}`,
    `&latitude=${lat}`,
    `&format=JSON`,
    `&start=2020`,
    `&end=2022`,
  ].join('')

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      // NASA POWER can be slow — give it 20 s
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: `NASA POWER API responded with ${res.status}: ${text.slice(0, 200)}` },
        { status: 502 },
      )
    }

    const data = await res.json()

    // NASA POWER returns data keyed by year then month (YYYYMM).
    // Shape: data.properties.parameter.ALLSKY_SFC_SW_DWN = { "202001": 3.45, ... }
    const raw: Record<string, number> =
      data?.properties?.parameter?.ALLSKY_SFC_SW_DWN ?? {}

    if (!Object.keys(raw).length) {
      return NextResponse.json({ error: 'No solar data returned for this location' }, { status: 404 })
    }

    // Average across years for each calendar month (1–12).
    // NASA uses -999 as a fill value for missing data — exclude those.
    const monthSums: number[] = new Array(12).fill(0)
    const monthCounts: number[] = new Array(12).fill(0)

    for (const [key, value] of Object.entries(raw)) {
      if (value === -999 || value == null) continue
      const month = parseInt(key.slice(4), 10) - 1 // 0-indexed
      if (month < 0 || month > 11) continue
      monthSums[month] += value
      monthCounts[month] += 1
    }

    const monthly = monthSums.map((sum, i) =>
      monthCounts[i] > 0 ? Math.round((sum / monthCounts[i]) * 100) / 100 : 0,
    )

    const validMonths = monthly.filter(v => v > 0)
    const annualAvg =
      validMonths.length > 0
        ? Math.round((validMonths.reduce((a, b) => a + b, 0) / validMonths.length) * 100) / 100
        : 0

    return NextResponse.json({
      monthly,        // 12-element array, kWh/m²/day, Jan→Dec
      annualAvg,      // mean of the 12 monthly averages
      location: {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        name: data?.geometry
          ? `${parseFloat(lat).toFixed(4)}°, ${parseFloat(lng).toFixed(4)}°`
          : `${lat}, ${lng}`,
      },
      meta: {
        source: 'NASA POWER v2.5',
        period: '2020–2022 monthly average',
        parameter: 'ALLSKY_SFC_SW_DWN (all-sky surface shortwave downward irradiance)',
        units: 'kWh/m²/day',
      },
    })
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      return NextResponse.json({ error: 'NASA POWER API timed out — try again in a moment' }, { status: 504 })
    }
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
