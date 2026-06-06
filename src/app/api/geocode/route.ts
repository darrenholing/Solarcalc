import { NextRequest, NextResponse } from 'next/server'

// Bug 4 — Proxy geocoding through the server so the Maps API key never reaches the browser.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')

  if (!address) {
    return NextResponse.json({ error: 'address required' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Geocoding API key not configured' }, { status: 500 })
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`

  try {
    const res = await fetch(url)
    const data = await res.json()

    if (data.status !== 'OK' || !data.results?.[0]) {
      return NextResponse.json({ error: data.error_message ?? 'Address not found' }, { status: 404 })
    }

    const { lat, lng } = data.results[0].geometry.location
    return NextResponse.json({ lat, lng, formatted_address: data.results[0].formatted_address })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Geocoding failed' }, { status: 500 })
  }
}
