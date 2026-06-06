'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Loader, MapPin, Square, RotateCcw, Save, Check } from 'lucide-react'
import SolarApiOverlay from './SolarApiOverlay'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

interface Props {
  address: string
  clientId: string
  projectId?: string
}

// Bug 2 — only lat/lng are persisted; pixel positions are derived fresh from the
// current map bounds on every render so polygons stay aligned after pan/zoom.
interface PolygonPoint { lat: number; lng: number }

declare global {
  interface Window {
    google: any
    initMap: () => void
  }
}

const PANEL_SIZE_M2 = 1.7 // ~1.7m² per panel
const KWP_PER_PANEL = 0.41

export default function RoofAssessment({ address, clientId, projectId }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapInstance = useRef<any>(null)
  const [loading, setLoading] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [polygon, setPolygon] = useState<PolygonPoint[]>([])
  const [roofArea, setRoofArea] = useState<number | null>(null)
  const [maxPanels, setMaxPanels] = useState<number | null>(null)
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [tab, setTab] = useState<'map' | 'solar'>('map')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const supabase = createSupabaseClient()

  async function loadMap() {
    setLoading(true)
    try {
      // Bug 4 — geocode via our server-side proxy so the Maps key never appears
      // in a browser network request
      const geoRes = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`)
      const geoData = await geoRes.json()
      if (!geoRes.ok || geoData.error) throw new Error(geoData.error ?? 'Address not found')

      const loc = { lat: geoData.lat, lng: geoData.lng }
      setCenter(loc)

      // Integration 26 — drawing library removed; polygon drawing is handled by
      // our own canvas overlay, not the Maps Drawing Manager
      if (!window.google) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`
          script.onload = () => resolve()
          script.onerror = reject
          document.head.appendChild(script)
        })
      }

      const map = new window.google.maps.Map(mapRef.current, {
        center: loc,
        zoom: 19,
        mapTypeId: 'satellite',
        tilt: 0,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [],
      })
      mapInstance.current = map
      setMapLoaded(true)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function startDrawing() {
    setDrawing(true)
    setPolygon([])
    setRoofArea(null)
    setMaxPanels(null)
    setSaved(false)
  }

  // Bug 3 — convert a click in CSS pixels to lat/lng using the canvas's actual
  // rendered size (not a hardcoded 800x400)
  function pixelToLatLng(px: number, py: number): { lat: number; lng: number } | null {
    const map = mapInstance.current
    const mapDiv = mapRef.current
    if (!map || !mapDiv) return null
    const mapBounds = map.getBounds()
    if (!mapBounds) return null

    const sw = mapBounds.getSouthWest()
    const ne = mapBounds.getNorthEast()
    const mapW = mapDiv.clientWidth
    const mapH = mapDiv.clientHeight

    const lngFraction = px / mapW
    const latFraction = 1 - py / mapH
    return {
      lng: sw.lng() + (ne.lng() - sw.lng()) * lngFraction,
      lat: sw.lat() + (ne.lat() - sw.lat()) * latFraction,
    }
  }

  // Inverse of pixelToLatLng — used to redraw stored lat/lng points at their
  // correct on-screen position for the *current* pan/zoom state
  function latLngToPixel(lat: number, lng: number): { x: number; y: number } | null {
    const map = mapInstance.current
    const mapDiv = mapRef.current
    if (!map || !mapDiv) return null
    const mapBounds = map.getBounds()
    if (!mapBounds) return null

    const sw = mapBounds.getSouthWest()
    const ne = mapBounds.getNorthEast()
    const mapW = mapDiv.clientWidth
    const mapH = mapDiv.clientHeight

    const lngFraction = (lng - sw.lng()) / (ne.lng() - sw.lng())
    const latFraction = (lat - sw.lat()) / (ne.lat() - sw.lat())
    return { x: lngFraction * mapW, y: (1 - latFraction) * mapH }
  }

  function handleMapClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing || !mapInstance.current || !canvasRef.current) return
    const bounds = canvasRef.current.getBoundingClientRect()
    const px = e.clientX - bounds.left
    const py = e.clientY - bounds.top

    const point = pixelToLatLng(px, py)
    if (!point) return
    setPolygon(prev => [...prev, point])
  }

  function closePolygon() {
    if (polygon.length < 3) return
    setDrawing(false)
    const area = calculatePolygonArea(polygon)
    const usable = area * 0.75 // 75% usable accounting for obstacles
    const panels = Math.floor(usable / PANEL_SIZE_M2)
    setRoofArea(Math.round(usable))
    setMaxPanels(panels)
  }

  function resetPolygon() {
    setPolygon([])
    setRoofArea(null)
    setMaxPanels(null)
    setDrawing(false)
    setSaved(false)
  }

  // Spherical excess formula for polygon area in m²
  function calculatePolygonArea(pts: PolygonPoint[]): number {
    const R = 6371000
    let area = 0
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length
      const lat1 = (pts[i].lat * Math.PI) / 180
      const lat2 = (pts[j].lat * Math.PI) / 180
      const lng1 = (pts[i].lng * Math.PI) / 180
      const lng2 = (pts[j].lng * Math.PI) / 180
      area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2))
    }
    return Math.abs((area * R * R) / 2)
  }

  // Bug 3 — size the canvas's drawing buffer to match its actual rendered size
  // UI 40 — wrapped in useCallback with the correct dependency array
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

    // Bug 2 — recompute pixel positions from current map bounds every draw
    const pixels = polygon.map(p => latLngToPixel(p.lat, p.lng)).filter((p): p is { x: number; y: number } => !!p)
    if (pixels.length === 0) return

    ctx.strokeStyle = '#b8f04a'
    ctx.fillStyle = 'rgba(184, 240, 74, 0.15)'
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

  // Redraw on polygon changes, drawing-mode changes, and whenever the map's
  // viewport changes (pan/zoom) so the overlay tracks the satellite imagery —
  // this is what fixes Bug 2 and Bug 3 together
  useEffect(() => {
    redrawCanvas()
  }, [redrawCanvas])

  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return
    const map = mapInstance.current
    const listener = map.addListener('bounds_changed', () => redrawCanvas())
    return () => listener.remove()
  }, [mapLoaded, redrawCanvas])

  useEffect(() => {
    if (!mapLoaded) return
    const onResize = () => redrawCanvas()
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(() => redrawCanvas())
    if (mapRef.current) ro.observe(mapRef.current)
    return () => {
      window.removeEventListener('resize', onResize)
      ro.disconnect()
    }
  }, [mapLoaded, redrawCanvas])

  // Feature 18 — persist the roof assessment to the project record
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
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--sc-border)', background: 'var(--sc-surface)' }}>
      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'var(--sc-border)' }}>
        {(['map', 'solar'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2.5 text-xs transition-colors"
            style={{ color: tab === t ? 'var(--sc-accent)' : 'var(--sc-muted)', borderBottom: tab === t ? '1px solid var(--sc-accent)' : '1px solid transparent' }}>
            {t === 'map' ? '🛰 Satellite View' : '☀️ Solar API Analysis'}
          </button>
        ))}
      </div>

      {tab === 'map' && (
        <div>
          {/* Map container */}
          <div className="relative" style={{ height: 400 }}>
            {!mapLoaded ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: 'var(--sc-surface-2)' }}>
                <MapPin size={24} style={{ color: 'var(--sc-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--sc-muted)' }}>{address}</p>
                <button onClick={loadMap} disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                  style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}>
                  {loading ? <Loader size={14} className="animate-spin" /> : <MapPin size={14} />}
                  {loading ? 'Loading satellite…' : 'Load satellite view'}
                </button>
              </div>
            ) : (
              <>
                <div ref={mapRef} className="absolute inset-0" />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                  style={{ cursor: drawing ? 'crosshair' : 'default', pointerEvents: drawing ? 'all' : 'none' }}
                  onClick={handleMapClick}
                />
              </>
            )}
          </div>

          {/* Controls */}
          {mapLoaded && (
            <div className="p-4 border-t flex flex-col gap-3" style={{ borderColor: 'var(--sc-border)' }}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  {!drawing ? (
                    <button onClick={startDrawing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
                      style={{ background: 'var(--sc-accent)', color: 'var(--sc-bg)' }}>
                      <Square size={12} /> Draw roof polygon
                    </button>
                  ) : (
                    <button onClick={closePolygon}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
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
                    <span style={{ color: 'var(--sc-accent)' }}>Max panels: <strong>{maxPanels}</strong></span>
                    <span style={{ color: 'var(--sc-muted)' }}>≈ <strong style={{ color: 'var(--sc-text)' }}>{(maxPanels * KWP_PER_PANEL).toFixed(1)} kWp</strong></span>
                  </div>
                )}
              </div>

              {roofArea !== null && maxPanels !== null && (
                projectId ? (
                  <button onClick={saveToProject} disabled={saving}
                    className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                    style={{ background: saved ? 'var(--sc-surface-2)' : 'var(--sc-accent)', color: saved ? 'var(--sc-text)' : 'var(--sc-bg)', border: saved ? '1px solid var(--sc-border)' : 'none' }}>
                    {saving ? <Loader size={12} className="animate-spin" /> : saved ? <Check size={12} /> : <Save size={12} />}
                    {saving ? 'Saving…' : saved ? 'Saved to project' : 'Save roof area to project'}
                  </button>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--sc-muted)' }}>
                    Create a project for this client to save the assessed roof area and max system size.
                  </p>
                )
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'solar' && (
        <SolarApiOverlay address={address} center={center} />
      )}
    </div>
  )
}
