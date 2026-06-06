import { MonthlyIrradiance } from '@/types'

// KNMI data — average horizontal irradiance (kWh/m²) per month for Netherlands
// Source: KNMI climate normals, averaged across NL stations
export const NL_IRRADIANCE: MonthlyIrradiance[] = [
  { month: 1, label: 'Jan', kwh_m2: 22 },
  { month: 2, label: 'Feb', kwh_m2: 37 },
  { month: 3, label: 'Mar', kwh_m2: 77 },
  { month: 4, label: 'Apr', kwh_m2: 118 },
  { month: 5, label: 'May', kwh_m2: 157 },
  { month: 6, label: 'Jun', kwh_m2: 163 },
  { month: 7, label: 'Jul', kwh_m2: 155 },
  { month: 8, label: 'Aug', kwh_m2: 133 },
  { month: 9, label: 'Sep', kwh_m2: 84 },
  { month: 10, label: 'Oct', kwh_m2: 46 },
  { month: 11, label: 'Nov', kwh_m2: 22 },
  { month: 12, label: 'Dec', kwh_m2: 15 },
]

// South Africa — Johannesburg representative data (kWh/m²)
export const ZA_IRRADIANCE: MonthlyIrradiance[] = [
  { month: 1, label: 'Jan', kwh_m2: 193 },
  { month: 2, label: 'Feb', kwh_m2: 170 },
  { month: 3, label: 'Mar', kwh_m2: 172 },
  { month: 4, label: 'Apr', kwh_m2: 148 },
  { month: 5, label: 'May', kwh_m2: 138 },
  { month: 6, label: 'Jun', kwh_m2: 127 },
  { month: 7, label: 'Jul', kwh_m2: 141 },
  { month: 8, label: 'Aug', kwh_m2: 163 },
  { month: 9, label: 'Sep', kwh_m2: 181 },
  { month: 10, label: 'Oct', kwh_m2: 197 },
  { month: 11, label: 'Nov', kwh_m2: 197 },
  { month: 12, label: 'Dec', kwh_m2: 200 },
]

// Bug 9 — South African monthly irradiance factors by province (normalized,
// mean ≈ 1.0, so they can be plugged into the same `kwp * 3.5 * factor`
// simulation model used for NL). Derived from SAURAN / SolarGIS monthly GHI
// averages (Southern Hemisphere seasonality — summer peak Nov–Feb).
export const ZA_PROVINCE_MONTHLY_FACTORS: Record<string, number[]> = {
  Gauteng:        [1.28, 1.22, 1.14, 0.98, 0.84, 0.74, 0.80, 0.95, 1.10, 1.18, 1.22, 1.27],
  'Western Cape': [1.42, 1.34, 1.12, 0.86, 0.66, 0.56, 0.62, 0.78, 0.96, 1.16, 1.34, 1.46],
  'KwaZulu-Natal':[1.22, 1.18, 1.12, 1.00, 0.88, 0.80, 0.84, 0.94, 1.02, 1.08, 1.12, 1.18],
  'Eastern Cape': [1.24, 1.20, 1.12, 0.98, 0.86, 0.78, 0.82, 0.92, 1.02, 1.10, 1.16, 1.22],
}

export const ZA_PROVINCES = Object.keys(ZA_PROVINCE_MONTHLY_FACTORS)

// Generic normalized seasonal factor table derived from a province's data, used
// as the South African default when no province is configured (Gauteng — the
// most common installer market).
export const ZA_MONTHLY_FACTORS = ZA_PROVINCE_MONTHLY_FACTORS['Gauteng']

// NL normalized monthly factors (already used by the monitoring simulator)
export const NL_MONTHLY_FACTORS = [0.25, 0.42, 0.87, 1.34, 1.78, 1.85, 1.75, 1.51, 0.95, 0.52, 0.25, 0.17]

export function monthlyFactorsFor(market: 'NL' | 'ZA', province?: string | null): number[] {
  if (market === 'NL') return NL_MONTHLY_FACTORS
  if (province && ZA_PROVINCE_MONTHLY_FACTORS[province]) return ZA_PROVINCE_MONTHLY_FACTORS[province]
  return ZA_MONTHLY_FACTORS
}

// Orientation factor relative to optimal (south-facing, optimal tilt for NL ~35°)
export function orientationFactor(azimuthDeg: number, tiltDeg: number): number {
  // azimuth: 0=N, 90=E, 180=S, 270=W
  const azRad = (azimuthDeg * Math.PI) / 180
  const tiltRad = (tiltDeg * Math.PI) / 180
  // Simplified Hay-Davies model factor
  const southDeviation = Math.abs(azimuthDeg - 180)
  const azFactor = Math.cos((southDeviation * Math.PI) / 180)
  const tiltFactor = Math.sin(tiltRad + (50 * Math.PI) / 180) / Math.sin((85 * Math.PI) / 180)
  return Math.max(0.5, Math.min(1.0, azFactor * tiltFactor))
}

export function getIrradiance(market: 'NL' | 'ZA'): MonthlyIrradiance[] {
  return market === 'NL' ? NL_IRRADIANCE : ZA_IRRADIANCE
}
