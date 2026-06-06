'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Loader, MapPin, Square, RotateCcw, Save, Check, Search, Sun, Zap, TrendingUp } from 'lucide-react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

interface Props {
  address: string
  clientId: string
  projectId?: string
}

interface PolygonPoint { lat: number; lng: number }

interface SolarPanel {
  center: { latitude: number; longitude: number }
  yearlyEnergyDcKwh: number
  orientation: 'PORTRAIT' | 'LANDSCAPE'
  segmentIndex: number
}

interface SolarResult {
  name: string
  maxPanels: number
  maxAreaM2: number
  maxSunshineHours: number
  carbonFactor: number
  panels: SolarPanel[]
  roofSegments: Array<{
    pitchDegrees: number
    azimuthDegrees: number
    yearlyEnergyDcKwh: number
    areaM2: number
  }>
  recommendedKwp: number
  annualOutputKwh: number
}

declare global {
  interface Window {
    google: any
    __solarcalc_maps_cb?: () => void
  }
}

const PANEL_SIZE_M2 = 1.7
const KWP_PER_PANEL = 0.41
const AC_DERATE = 0.82 // DC→AC conversion + system losses

// Module-level singleton so the script is injected exactly once per page load,
// even if multiple RoofAssessment instances mount or the component remounts.
let mapsLoadPromise: Promise<void> | null = null

function loadMapsApi(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'))
  if (window.google?.maps?.Map) return Promise.resolve()
  if (mapsLoadPromise) return mapsLoadPromise
  mapsLoadPromise = new Promise<void>((resolve, reject) => {
    const cb = '__solarcalc_maps_cb'
    ;(window as any)[cb] = () => {
      delete (window as any)[cb]
      resolve()
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=${cb}&loading=async`
    script.async = true
    script.onerror = () => {
      mapsLoadPromise = null
      reject(new Error('Failed to load Google Maps — check your API key and domain restrictions'))
    }
    document.head.appendChild(script)
  })
  return mapsLoadPromise
}

// PanelOverlay — renders coloured rectangles at each panel's lat/lng using
// OverlayView.fromLatLngToDivPixel for accurate Mercator-projected positions.
// This is far more reliable than converting to canvas pixels manually.
function createPanelOverlay(map: any, panels: SolarPanel[]): any {
  if (!panels.length || !window.google?.maps?.OverlayView) return null

  const maxEnergy = Math.max(...panels.map(p => p.yearlyEnergyDcKwh), 1)

  class PanelOverlay extends window.google.maps.OverlayView {
    private div: HTMLDivElement | null = null

    onAdd() {
      this.div = document.createElement('div')
      this.div.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;overflow:visible'
      const panes = this.getPanes()
      panes.overlayLayer.appendChild(this.div)
    }

    draw() {
      if (!this.div) return
      const proj = this.getProjection()
      if (!proj) return

      // Clear previous render
      this.div.innerHTML = ''

      panels.forEach(panel => {
        const pt = proj.fromLatLngToDivPixel(
          new window.google.maps.LatLng(panel.center.latitude, panel.center.longitude)
        )
        if (!pt) return

        const energyRatio = panel.yearlyEnergyDcKwh / maxEnergy
        // Green (#b8f04a) for high energy, amber for medium, dim for low
        const r = Math.round(184 * energyRatio + 200 * (1 - energyRatio))
        const g = Math.round(240 * energyRatio + 150 * (1 - energyRatio))
        const b = Math.round(74 * energyRatio + 50 * (1 - energyRatio))

        const el = document.createElement('div')
        const isPortrait = panel.orientation === 'PORTRAIT'
        const w = isPortrait ? 8 : 12
        const h = isPortrait ? 12 : 8
        el.style.cssText = [
          'position:absolute',
          `left:${pt.x - w / 2}px`,
          `top:${pt.y - h / 2}px`,
          `width:${w}px`,
          `height:${h}px`,
          `background:rgba(${r},${g},${b},0.75)`,
          'border:1px solid rgba(255,255,255,0.3)',
          'border-radius:1px',
          'pointer-events:none',
        ].join(';')
        this.div!.appendChild(el)
      })
    }

    onRemove() {
      if (this.div?.parentNode) {
        this.div.parentNode.removeChild(this.div)
        this.div = null
      }
    }
  }

  const overlay = new PanelOverlay()
  overlay.setMap(map)
  return overlay
}

export default function RoofAssessment({ address, clientId, projectId }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapInstance = useRef<any>(null)
  const panelOverlayRef = useRef<any>(null)

  const [searchAddress, setSearchAddress] = useState(address)
  const [mapLoading, setMapLoading] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState('')
  const [drawing, setDrawing] = useState(false)
  const [polygon, setPolygon] = useState<PolygonPoint[]>([])
  const [roofArea, setRoofArea] = useState<number | null>(null)
  const [maxPanels, setMaxPanels] = useState<number | null>(null)
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [tab, setTab] = useState<'map' | 'solar'>('map')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Solar tab state
  const [solarLoading, setSolarLoading] = useState(false)
  const [solarError, setSolarError] = useState('')
  const [solarResult, setSolarResult] = useState<SolarResult | null>(null)
  const [showPanels, setShowPanels] = useState(true)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  const supabase = createSupabaseClient()

  // ─── Geocode ──────────────────────────────────────────────────────────────
  async function geocode(addr: string): Promise<{ lat: number; lng: number; formatted: string }> {
    const res = await fetch(`/api/geocode?address=${encodeURIComponent(addr)}`)
    const json = await res.json()
    if (!res.ok || json.error) throw new Error(json.error ?? 'Address not found')
    return { lat: json.lat, lng: json.lng, formatted: json.formatted_address ?? addr }
  }

  // ─── Load / search map ────────────────────────────────────────────────────
  async function loadMap(addr?: string) {
    const target = addr ?? searchAddress
    if (!target.trim()) return
    setMapLoading(true)
    setMapError('')
    try {
      const { lat, lng } = await geocode(target)
      const loc = { lat, lng }
      setCenter(loc)

      await loadMapsApi(apiKey)

      if (!mapInstance.current) {
        // First load — create the map
        const map = new window.google.maps.Map(mapRef.current, {
          center: loc,
          zoom: 19,
          mapTypeId: 'satellite',
          tilt: 0,
          disableDefaultUI: true,
          zoomControl: true,
        })
        mapInstance.current = map
        setMapLoaded(true)
      } else {
        // Subsequent search — pan to new location, clear polygon
        mapInstance.current.setCenter(loc)
        mapInstance.current.setZoom(19)
        setPolygon([])
        setRoofArea(null)
        setMaxPanels(null)
        setSaved(false)
        removePanelOverlay()
      }
    } catch (err: any) {
      setMapError(err.message ?? 'Failed to load map')
    } finally {
      setMapLoading(false)
    }
  }

  function handleSearchKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') loadMap()
  }

  // ─── Polygon drawing ──────────────────────────────────────────────────────
  function pixelToLatLng(px: number, py: number): PolygonPoint | null {
    const map = mapInstance.current
    const div = mapRef.current
    if (!map || !div) return null
    const bounds = map.getBounds()
    if (!bounds) return null
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()
    const w = div.clientWidth
    const h = div.clientHeight
    return {
      lng: sw.lng() + (ne.lng() - sw.lng()) * (px / w),
      lat: sw.lat() + (ne.lat() - sw.lat()) * (1 - py / h),
    }
  }

  function latLngToPixel(lat: number, lng: number): { x: number; y: number } | null {
    const map = mapInstance.current
    const div = mapRef.current
    if (!map || !div) return null
    const bounds = map.getBounds()
    if (!bounds) return null
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()
    const w = div.clientWidth
    const h = div.clientHeight
    return {
      x: ((lng - sw.lng()) / (ne.lng() - sw.lng())) * w,
      y: (1 - (lat - sw.lat()) / (ne.lat() - sw.lat())) * h,
    }
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const point = pixelToLatLng(e.clientX - rect.left, e.clientY - rect.top)
    if (point) setPolygon(prev => [...prev, point])
  }

  function closePolygon() {
    if (polygon.length < 3) return
    setDrawing(false)
    const area = sphericalPolygonArea(polygon)
    const usable = area * 0.75
    setRoofArea(Math.round(usable))
    setMaxPanels(Math.floor(usable / PANEL_SIZE_M2))
  }

  function resetPolygon() {
    setPolygon([])
    setRoofArea(null)
    setMaxPanels(null)
    setDrawing(false)
    setSaved(false)
  }

  function sphericalPolygonArea(pts: PolygonPoint[]): number {
    const R = 6371000
    let area = 0
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length
      const lat1 = (pts[i].lat * Math.PI) / 180
      const lat2 = (pts[j].lat * Math.PI) / 180
      const dLng = ((pts[j].lng - pts[i].lng) * Math.PI) / 180
      area += dLng * (2 + Math.sin(lat1) + Math.sin(lat2))
    }
    return Math.abs((area * R * R) / 2)
  }

  // ─── Canvas redraw ────────────────────────────────────────────────────────
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = mapRef.current
    if (!canvas || !container) return

    const dpr = window.devicePixelRatio || 1
    const cssW = container.clientWidth
    const cssH = container.clientHeight
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr
      canvas.height = cssH * dpr
    }

    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)
    if (polygon.length === 0) return

    const pixels = polygon
      .map(p => latLngToPixel(p.lat, p.lng))
      .filter((p): p is { x: number; y: number } => !!p)
    if (!pixels.length) return

    ctx.strokeStyle = '#b8f04a'
    ctx.fillStyle = 'rgba(184,240,74,0.15)'
    ctx.lineWidth = 2
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(pixels[0].x, pixels[0].y)
    for (let i = 1; i < pixels.length; i++) ctx.lineTo(pixels[i].x, pixels[i].y)
    if (!drawing) ctx.closePath()
    ctx.stroke()
    if (!drawing) ctx.fill()

    pixels.forEach((pt, i) => {
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2)
      ctx.fillStyle = i === 0 ? '#b8f04a' : 'white'
      ctx.fill()
    })
  }, [polygon, drawing])

  useEffect(() => { redrawCanvas() }, [redrawCanvas])

  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return
    const listener = mapInstance.current.addListener('bounds_changed', redrawCanvas)
    return () => listener.remove()
  }, [mapLoaded, redrawCanvas])

  useEffect(() => {
    if (!mapLoaded) return
    const ro = new ResizeObserver(redrawCanvas)
    if (mapRef.current) ro.observe(mapRef.current)
    window.addEventListener('resize', redrawCanvas)
    return () => { ro.disconnect(); window.removeEventListener('resize', redrawCanvas) }
  }, [mapLoaded, redrawCanvas])

  // ─── Panel overlay management ─────────────────────────────────────────────
  function removePanelOverlay() {
    if (panelOverlayRef.current) {
      panelOverlayRef.current.setMap(null)
      panelOverlayRef.current = null
    }
  }

  function applyPanelOverlay(panels: SolarPanel[]) {
    removePanelOverlay()
    if (!mapInstance.current || !panels.length || !showPanels) return
    panelOverlayRef.current = createPanelOverlay(mapInstance.current, panels)
  }

  useEffect(() => {
    if (!solarResult) return
    if (showPanels && mapInstance.current) {
      applyPanelOverlay(solarResult.panels)
    } else {
      removePanelOverlay()
    }
  }, [showPanels, solarResult])

  // ─── Solar API fetch ──────────────────────────────────────────────────────
  async function runSolarAnalysis() {
    setSolarLoading(true)
    setSolarError('')
    setSolarResult(null)
    removePanelOverlay()

    try {
      // Geocode independently so Solar tab works even without visiting Map tab
      let coords = center
      if (!coords) {
        const geo = await geocode(searchAddress)
        coords = { lat: geo.lat, lng: geo.lng }
        setCenter(coords)
      }

      const res = await fetch(`/api/solar?lat=${coords.lat}&lng=${coords.lng}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Solar API error')

      // API returns: { name, solar_potential: { ..., solar_panels: [], roof_segment_stats: [] } }
      const sp = json.solar_potential ?? {}
      const rawPanels: any[] = sp.solar_panels ?? []
      const panels: SolarPanel[] = rawPanels.map((p: any) => ({
        center: p.center ?? { latitude: 0, longitude: 0 },
        yearlyEnergyDcKwh: p.yearlyEnergyDcKwh ?? 0,
        orientation: p.orientation ?? 'PORTRAIT',
        segmentIndex: p.segmentIndex ?? 0,
      }))
      const segments = (sp.roof_segment_stats ?? []).map((s: any) => ({
        pitchDegrees: s.pitch_degrees ?? 0,
        azimuthDegrees: s.azimuth_degrees ?? 180,
        yearlyEnergyDcKwh: s.yearly_energy_dc_kwh ?? 0,
        areaM2: 0, // not returned per-segment by the API route
      }))

      const maxPanelCount = sp.max_array_panels_count ?? 0
      const bestYearlyDc = panels.reduce((sum, p) => sum + p.yearlyEnergyDcKwh, 0)
      const recommendedKwp = Math.round(maxPanelCount * KWP_PER_PANEL * 10) / 10
      const annualOutputKwh = Math.round(bestYearlyDc * AC_DERATE)

      const result: SolarResult = {
        name: json.name ?? '',
        maxPanels: maxPanelCount,
        maxAreaM2: sp.max_array_area_meters2 ?? 0,
        maxSunshineHours: sp.max_sunshine_hours_per_year ?? 0,
        carbonFactor: sp.carbon_offset_factor_kg_per_mwh ?? 0,
        panels,
        roofSegments: segments,
        recommendedKwp,
        annualOutputKwh,
      }
      setSolarResult(result)

      // If map is already open on the map tab, render the overlay immediately
      if (mapInstance.current && showPanels) {
        applyPanelOverlay(panels)
      }
    } catch (err: any) {
      const msg: string = err.message ?? 'Unknown error'
      if (msg.includes('404') || msg.includes('NOT_FOUND')) {
        setSolarError('This address is outside Google Solar API coverage. Try a major city in NL or ZA, or zoom into a rooftop visible from satellite.')
      } else if (msg.includes('403') || msg.includes('REQUEST_DENIED')) {
        setSolarError('Solar API key error — ensure the Google Solar API is enabled in Google Cloud Console.')
      } else {
        setSolarError(msg)
      }
    } finally {
      setSolarLoading(false)
    }
  }

  // ─── Save to project ──────────────────────────────────────────────────────
  async function saveToProject() {
    if (!projectId || roofArea === null || maxPanels === null) return
    setSaving(true)
    try {
      const maxKwp = Math.round(maxPanels * KWP_PER_PANEL * 100) / 100
      const { error } = await supabase
        .from('projects')
        .update({ roof_area_m2: roofArea, max_kwp: maxKwp })
        .eq('id', projectId)
      if (error) throw error
      setSaved(true)
    } catch (err: any) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--sc-border)', background: 'var(--sc-surface)' }}>

      {/* Address search bar — always visible */}
      <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: 'var(--sc-border)', background: 'var(--sc-surface-2)' }}>
        <MapPin size={14} style={{ color: 'var(--sc-muted)', flexShrink: 0 }} />
        <input
          value={searchAddress}
          onChange={e => setSearchAddress(e.target.value)}
          onKeyDown={handleSearchKey}
          placeholder="Enter property address…"
          className="flex-1 text-sm bg-transparent outline-none"
          style={{ color: 'var(--sc-text)' }}
        />
        <button
          onClick={() => loadMap()}
          disabled={mapLoading || !searchAddress.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50 shrink-0"
          style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}>
          {mapLoading ? <Loader size={12} className="animate-spin" /> : <Search size={12} />}
          {mapLoading ? 'Loading…' : mapLoaded ? 'Go' : 'Load map'}
        </button>
      </div>

      {mapError && (
        <div className="px-4 py-2 text-xs" style={{ background: 'rgba(220,38,38,0.08)', color: '#f87171', borderBottom: '1px solid rgba(220,38,38,0.2)' }}>
          ⚠ {mapError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'var(--sc-border)' }}>
        {(['map', 'solar'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2.5 text-xs transition-colors"
            style={{
              color: tab === t ? 'var(--sc-accent)' : 'var(--sc-muted)',
              borderBottom: tab === t ? '2px solid var(--sc-accent)' : '2px solid transparent',
            }}>
            {t === 'map' ? '🛰 Satellite View' : '☀️ Solar Analysis'}
          </button>
        ))}
      </div>

      {/* ── Map tab ── */}
      {tab === 'map' && (
        <div>
          <div className="relative" style={{ height: 420 }}>
            {!mapLoaded ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: 'var(--sc-surface-2)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--sc-accent-bg)' }}>
                  <MapPin size={18} style={{ color: 'var(--sc-accent)' }} />
                </div>
                <p className="text-sm" style={{ color: 'var(--sc-text)' }}>Enter an address above and click Load map</p>
                <p className="text-xs text-center max-w-xs" style={{ color: 'var(--sc-muted)' }}>
                  Satellite imagery loads at zoom 19 so you can trace the exact roof outline
                </p>
              </div>
            ) : (
              <>
                <div ref={mapRef} className="absolute inset-0" />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                  style={{ cursor: drawing ? 'crosshair' : 'default', pointerEvents: drawing ? 'all' : 'none' }}
                  onClick={handleCanvasClick}
                />
              </>
            )}
          </div>

          {mapLoaded && (
            <div className="p-4 border-t space-y-3" style={{ borderColor: 'var(--sc-border)' }}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  {!drawing ? (
                    <button onClick={() => { setDrawing(true); setPolygon([]); setRoofArea(null); setMaxPanels(null); setSaved(false) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
                      style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}>
                      <Square size={12} /> Draw roof polygon
                    </button>
                  ) : (
                    <button onClick={closePolygon} disabled={polygon.length < 3}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                      style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}>
                      Close polygon ({polygon.length} pts)
                    </button>
                  )}
                  <button onClick={resetPolygon}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs"
                    style={{ background: 'var(--sc-surface-2)', color: 'var(--sc-muted)', border: '1px solid var(--sc-border)' }}>
                    <RotateCcw size={12} /> Reset
                  </button>
                </div>

                {roofArea !== null && maxPanels !== null && (
                  <div className="flex items-center gap-4 text-xs" style={{ fontFamily: 'DM Mono' }}>
                    <span style={{ color: 'var(--sc-muted)' }}>Usable area: <strong style={{ color: 'var(--sc-text)' }}>{roofArea} m²</strong></span>
                    <span style={{ color: 'var(--sc-accent)' }}>≈ <strong>{maxPanels} panels</strong></span>
                    <span style={{ color: 'var(--sc-accent)' }}>≈ <strong>{(maxPanels * KWP_PER_PANEL).toFixed(1)} kWp</strong></span>
                  </div>
                )}
              </div>

              {drawing && (
                <p className="text-xs" style={{ color: 'var(--sc-muted)' }}>
                  Click to add polygon vertices over the roof area. Click <strong style={{ color: 'var(--sc-text)' }}>Close polygon</strong> when done (min 3 points).
                </p>
              )}

              {roofArea !== null && maxPanels !== null && projectId && (
                <button onClick={saveToProject} disabled={saving}
                  className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                  style={{ background: saved ? 'var(--sc-surface-2)' : 'var(--sc-accent)', color: saved ? 'var(--sc-text)' : 'var(--sc-bg)', border: saved ? '1px solid var(--sc-border)' : 'none' }}>
                  {saving ? <Loader size={12} className="animate-spin" /> : saved ? <Check size={12} /> : <Save size={12} />}
                  {saving ? 'Saving…' : saved ? 'Saved to project' : 'Save roof area to project'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Solar Analysis tab ── */}
      {tab === 'solar' && (
        <div className="p-5 space-y-5">
          {!solarResult ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--sc-accent-bg)' }}>
                <Sun size={20} style={{ color: 'var(--sc-accent)' }} />
              </div>
              <div className="text-center">
                <p className="text-sm mb-1" style={{ color: 'var(--sc-text)' }}>Google Solar API Analysis</p>
                <p className="text-xs max-w-sm" style={{ color: 'var(--sc-muted)' }}>
                  3D roof modelling, shade analysis, and optimal panel placement from Google's solar data layer.
                  Works independently — no need to load the map tab first.
                </p>
              </div>
              {solarError && (
                <div className="text-xs px-4 py-2 rounded max-w-md text-center" style={{ background: 'rgba(220,38,38,0.08)', color: '#f87171', border: '1px solid rgba(220,38,38,0.2)' }}>
                  ⚠ {solarError}
                </div>
              )}
              <button onClick={runSolarAnalysis} disabled={solarLoading || !searchAddress.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}>
                {solarLoading ? <Loader size={14} className="animate-spin" /> : <Sun size={14} />}
                {solarLoading ? 'Analysing roof…' : 'Run solar analysis'}
              </button>
            </div>
          ) : (
            <SolarResults
              result={solarResult}
              showPanels={showPanels}
              onTogglePanels={() => setShowPanels(v => !v)}
              onMapTab={() => { setTab('map'); if (!mapLoaded) loadMap() }}
              onReset={() => { setSolarResult(null); setSolarError(''); removePanelOverlay() }}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Solar results panel ───────────────────────────────────────────────────
function SolarResults({ result, showPanels, onTogglePanels, onMapTab, onReset }: {
  result: SolarResult
  showPanels: boolean
  onTogglePanels: () => void
  onMapTab: () => void
  onReset: () => void
}) {
  const topSegments = [...result.roofSegments]
    .sort((a, b) => b.yearlyEnergyDcKwh - a.yearlyEnergyDcKwh)
    .slice(0, 5)
  const totalEnergy = result.roofSegments.reduce((s, seg) => s + seg.yearlyEnergyDcKwh, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs" style={{ color: 'var(--sc-muted)' }}>SOLAR POTENTIAL ANALYSIS</h3>
        <button onClick={onReset} className="text-xs" style={{ color: 'var(--sc-muted)' }}>Reset</button>
      </div>

      {/* Headline recommendation */}
      <div className="rounded-lg p-4 space-y-3" style={{ background: 'var(--sc-accent-bg)', border: '1px solid rgba(184,240,74,0.25)' }}>
        <p className="text-xs font-medium" style={{ color: 'var(--sc-accent)' }}>RECOMMENDED SYSTEM</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--sc-muted)' }}>System size</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--sc-accent)', fontFamily: 'DM Mono' }}>
              {result.recommendedKwp} kWp
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--sc-muted)' }}>{result.maxPanels} panels × 410W</p>
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--sc-muted)' }}>Est. annual output</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--sc-text)', fontFamily: 'DM Mono' }}>
              {result.annualOutputKwh.toLocaleString()} kWh
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--sc-muted)' }}>AC output incl. system losses</p>
          </div>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Roof area', value: `${result.maxAreaM2.toFixed(0)} m²`, icon: <Square size={13} /> },
          { label: 'Peak sun hours', value: `${result.maxSunshineHours.toFixed(0)} h/yr`, icon: <Sun size={13} /> },
          { label: 'CO₂ factor', value: `${result.carbonFactor} kg/MWh`, icon: <TrendingUp size={13} /> },
          { label: 'Panel positions', value: `${result.panels.length} mapped`, icon: <Zap size={13} /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="rounded p-3" style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)' }}>
            <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--sc-muted)' }}>
              {icon}
              <span className="text-xs">{label}</span>
            </div>
            <div className="text-sm font-medium" style={{ color: 'var(--sc-accent)', fontFamily: 'DM Mono' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Panel overlay toggle */}
      {result.panels.length > 0 && (
        <div className="flex items-center justify-between rounded p-3" style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)' }}>
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--sc-text)' }}>Panel placement overlay</p>
            <p className="text-xs" style={{ color: 'var(--sc-muted)' }}>
              {result.panels.length} panels mapped · colour-coded by annual energy output
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onTogglePanels}
              className="px-3 py-1.5 rounded text-xs font-medium"
              style={{ background: showPanels ? 'var(--sc-accent)' : 'var(--sc-surface)', color: showPanels ? 'var(--sc-bg)' : 'var(--sc-muted)', border: '1px solid var(--sc-border)' }}>
              {showPanels ? 'Showing' : 'Hidden'}
            </button>
            <button onClick={onMapTab}
              className="px-3 py-1.5 rounded text-xs"
              style={{ background: 'var(--sc-surface)', color: 'var(--sc-muted)', border: '1px solid var(--sc-border)' }}>
              View on map
            </button>
          </div>
        </div>
      )}

      {/* Roof segments */}
      <div>
        <h4 className="text-xs mb-3" style={{ color: 'var(--sc-muted)' }}>ROOF SEGMENTS (top by production)</h4>
        <div className="space-y-2">
          {topSegments.map((seg, i) => {
            const pct = totalEnergy > 0 ? (seg.yearlyEnergyDcKwh / totalEnergy) * 100 : 0
            return (
              <div key={i} className="rounded p-3" style={{ background: 'var(--sc-surface-2)', border: '1px solid var(--sc-border)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--sc-surface)', color: 'var(--sc-muted)' }}>
                      {azimuthLabel(seg.azimuthDegrees)} {seg.pitchDegrees.toFixed(0)}°
                    </span>
                    <span className="text-xs" style={{ color: 'var(--sc-text)' }}>
                      {seg.yearlyEnergyDcKwh.toFixed(0)} kWh/yr
                    </span>
                    <span className="text-xs" style={{ color: 'var(--sc-muted)' }}>
                      {seg.areaM2.toFixed(0)} m²
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--sc-muted)', fontFamily: 'DM Mono' }}>{pct.toFixed(0)}%</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--sc-border)' }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--sc-accent)' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-xs" style={{ color: 'var(--sc-muted)' }}>
        Data: Google Solar API · {result.name}
      </p>
    </div>
  )
}

function azimuthLabel(deg: number): string {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]
}
