import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_SOLAR_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Solar API key not configured' }, { status: 500 })
  }

  const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=LOW&key=${apiKey}`

  try {
    const res = await fetch(url)
    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json({ error: err.error?.message ?? 'Solar API error' }, { status: res.status })
    }
    const data = await res.json()

    // Integration 27 — `roofSegmentStats[].stats.sunshineQuantiles` is annual
    // *sunlight* exposure (hours-equivalent percentiles), not energy output —
    // using it as `yearly_energy_dc_kwh` produced wildly wrong figures.
    // The Solar API only reports per-segment yearly DC energy inside
    // `solarPotential.solarPanelConfigs[].roofSegmentSummaries[]`, keyed by
    // `segmentIndex`. We take the largest config (the one matching
    // `maxArrayPanelsCount`, i.e. the full-roof layout) and build a
    // segmentIndex → yearlyEnergyDcKwh / panelsCount lookup from it.
    const configs: any[] = data.solarPotential?.solarPanelConfigs ?? []
    const bestConfig = configs.reduce((best: any, c: any) =>
      (!best || (c.panelsCount ?? 0) > (best.panelsCount ?? 0)) ? c : best, null)
    const segmentEnergyByIndex = new Map<number, number>()
    const segmentPanelsByIndex = new Map<number, number>()
    for (const summary of bestConfig?.roofSegmentSummaries ?? []) {
      if (typeof summary.segmentIndex === 'number') {
        segmentEnergyByIndex.set(summary.segmentIndex, summary.yearlyEnergyDcKwh ?? 0)
        segmentPanelsByIndex.set(summary.segmentIndex, summary.panelsCount ?? 0)
      }
    }

    return NextResponse.json({
      name: data.name,
      center: data.center,
      solar_potential: {
        max_array_panels_count: data.solarPotential?.maxArrayPanelsCount ?? 0,
        max_array_area_meters2: data.solarPotential?.maxArrayAreaMeters2 ?? 0,
        max_sunshine_hours_per_year: data.solarPotential?.maxSunshineHoursPerYear ?? 0,
        carbon_offset_factor_kg_per_mwh: data.solarPotential?.carbonOffsetFactorKgPerMwh ?? 0,
        roof_segment_stats: (data.solarPotential?.roofSegmentStats ?? []).map((s: any, i: number) => ({
          pitch_degrees: s.pitchDegrees ?? 0,
          azimuth_degrees: s.azimuthDegrees ?? 0,
          panel_count: segmentPanelsByIndex.get(i) ?? 0,
          yearly_energy_dc_kwh: segmentEnergyByIndex.get(i) ?? 0,
          bounding_box: s.boundingBox,
        })),
        solar_panels: (data.solarPotential?.solarPanels ?? []).map((p: any) => ({
          panelCount: 1,
          yearlyEnergyDcKwh: p.yearlyEnergyDcKwh ?? 0,
          segmentIndex: p.segmentIndex ?? 0,
          center: p.center,
          orientation: p.orientation,
        })),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
