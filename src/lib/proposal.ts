import { jsPDF } from 'jspdf'
import { Market } from '@/types'
import { NL_IRRADIANCE, ZA_IRRADIANCE } from './irradiance'

interface ProposalData {
  project: any
  installer: any
  market: Market
}

// UI 37 — fetch the installer's uploaded logo (stored in the public `logos`
// bucket, referenced by `users.logo`) and convert it to a data URL so jsPDF
// can embed it. Best-effort: any failure (missing logo, CORS, bad format)
// just falls back to the text-only header.
async function loadLogoDataUrl(url?: string | null): Promise<{ dataUrl: string; format: string } | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const format = blob.type.includes('png') ? 'PNG' : blob.type.includes('webp') ? 'WEBP' : 'JPEG'
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    return { dataUrl, format }
  } catch {
    return null
  }
}

export async function generateProposalPDF({ project, installer, market }: ProposalData): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const currency = market === 'NL' ? '€' : 'R'
  // UI 36 — locale follows the installer's configured market
  const locale = market === 'ZA' ? 'en-ZA' : 'nl-NL'

  // Colors
  const BG = [13, 15, 14] as const
  const SURFACE = [20, 23, 22] as const
  const ACCENT = [184, 240, 74] as const
  const TEXT = [232, 237, 233] as const
  const MUTED = [138, 148, 144] as const

  // Dark background
  doc.setFillColor(...BG)
  doc.rect(0, 0, W, 297, 'F')

  // Header bar
  doc.setFillColor(...SURFACE)
  doc.rect(0, 0, W, 45, 'F')

  // Accent stripe
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, 4, 45, 'F')

  // UI 37 — installer logo (uploaded on the settings page → `logos` bucket →
  // `users.logo`), rendered to the left of the company name when present
  const logo = await loadLogoDataUrl(installer?.logo)
  const textX = logo ? 34 : 14
  if (logo) {
    try {
      doc.addImage(logo.dataUrl, logo.format, 14, 10, 16, 16)
    } catch {
      // Malformed image data — silently fall back to text-only header
    }
  }

  // Company logo/name
  doc.setTextColor(...ACCENT)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(installer?.company ?? 'SolarCalc', textX, 18)

  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.text('Solar Installation Proposal', textX, 26)

  // Client info top right
  doc.setTextColor(...TEXT)
  doc.setFontSize(10)
  doc.text(project.client?.name ?? '', W - 15, 14, { align: 'right' })
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(project.client?.address ?? '', W - 15, 21, { align: 'right' })
  doc.text(new Date().toLocaleDateString(locale), W - 15, 28, { align: 'right' })

  let y = 55

  // Title
  doc.setTextColor(...TEXT)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('Solar System Design', 15, y)
  y += 10

  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.text(`Prepared by ${installer?.name ?? ''} · ${installer?.email ?? ''}`, 15, y)
  y += 12

  // System specs section
  y = addSection(doc, 'SYSTEM SPECIFICATIONS', y, BG, SURFACE, ACCENT, MUTED)

  const specs = [
    ['System size', `${project.system_size_kwp} kWp`],
    ['Panel count', `${project.panel_count} × ${project.panel_wattage}W panels`],
    ['Annual output', `${project.annual_output_kwh?.toLocaleString()} kWh`],
    ['Roof orientation', `${orientationName(project.roof_orientation)}`],
    ['Roof tilt', `${project.roof_tilt}°`],
    ...(market === 'NL' && project.system_size_kwp > 15 ? [['SDE++ eligible', 'Yes (system > 15 kWp)']] : []),
  ]

  y = addTable(doc, specs, y, TEXT, MUTED, SURFACE)
  y += 8

  // Financial section
  y = addSection(doc, 'FINANCIAL SUMMARY', y, BG, SURFACE, ACCENT, MUTED)

  const financials = [
    ['System cost (excl. tax)', `${currency}${(project.total_cost - (project.btw_amount ?? 0)).toLocaleString()}`],
    ...(market === 'NL' ? [['BTW (21%)', `€${(project.btw_amount ?? 0).toLocaleString()}`]] : []),
    ['Total investment', `${currency}${project.total_cost?.toLocaleString()}`],
    ['Annual savings', `${currency}${project.annual_savings?.toLocaleString()}`],
    ['Payback period', `${project.payback_years} years`],
    ['25-year net return', `${currency}${(project.annual_savings * 25 - project.total_cost).toLocaleString()} est.`],
    ['CO₂ offset per year', `${(project.co2_offset_kg / 1000).toFixed(1)} tonnes`],
  ]

  y = addTable(doc, financials, y, TEXT, MUTED, SURFACE)
  y += 8

  // Monthly production bar chart
  y = addSection(doc, 'MONTHLY PRODUCTION ESTIMATE (kWh)', y, BG, SURFACE, ACCENT, MUTED)

  const irradiance = market === 'NL' ? NL_IRRADIANCE : ZA_IRRADIANCE
  const chartX = 15
  const chartW = W - 30
  const chartH = 35

  // Bug 7 / Feature 21 — monthly_output is now always stored on the project at
  // save time; guard against it being missing/empty so Math.max never returns
  // -Infinity, and never fall back to raw irradiance as an energy value
  const monthlyOutput: number[] = (project.monthly_output && project.monthly_output.length === 12)
    ? project.monthly_output
    : new Array(12).fill(0)
  const maxVal = monthlyOutput.length > 0 ? Math.max(...monthlyOutput, 1) : 1

  // Chart background
  doc.setFillColor(...SURFACE)
  doc.roundedRect(chartX, y, chartW, chartH + 8, 3, 3, 'F')

  irradiance.forEach((m, i) => {
    const barW = chartW / 12 - 2
    const barX = chartX + i * (chartW / 12) + 1
    const barH = (monthlyOutput[i] / maxVal) * (chartH - 8)
    const barY = y + chartH - barH

    doc.setFillColor(...ACCENT)
    doc.roundedRect(barX, barY, barW, barH, 1, 1, 'F')

    doc.setFontSize(6)
    doc.setTextColor(...MUTED)
    doc.text(m.label, barX + barW / 2, y + chartH + 5, { align: 'center' })
  })
  y += chartH + 14

  // Signature block
  if (y < 240) {
    y = Math.max(y, 230)
    doc.setDrawColor(...MUTED)
    doc.setLineWidth(0.3)
    doc.line(15, y, 90, y)
    doc.line(120, y, 195, y)
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text('Client signature', 15, y + 5)
    doc.text('Date', 120, y + 5)
    doc.text(project.client?.name ?? '', 15, y + 10)
    doc.setFontSize(7)
    doc.text('This proposal is valid for 30 days.', 15, y + 18)
  }

  // Footer
  doc.setFillColor(...SURFACE)
  doc.rect(0, 282, W, 15, 'F')
  doc.setFillColor(...ACCENT)
  doc.rect(0, 282, 4, 15, 'F')
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text(`Generated by SolarCalc · ${installer?.company ?? ''} · ${new Date().toISOString().split('T')[0]}`, 10, 291)
  doc.text('Page 1 of 1', W - 10, 291, { align: 'right' })

  return doc.output('blob')
}

function addSection(doc: jsPDF, title: string, y: number, bg: readonly number[], surface: readonly number[], accent: readonly number[], muted: readonly number[]): number {
  doc.setFillColor(...(accent as [number, number, number]))
  doc.rect(15, y, 3, 5, 'F')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...(accent as [number, number, number]))
  doc.text(title, 21, y + 4)
  doc.setFont('helvetica', 'normal')
  return y + 10
}

function addTable(doc: jsPDF, rows: string[][], y: number, text: readonly number[], muted: readonly number[], surface: readonly number[]): number {
  rows.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      doc.setFillColor(...(surface as [number, number, number]))
      doc.rect(15, y - 3, 180, 6.5, 'F')
    }
    doc.setFontSize(8)
    doc.setTextColor(...(muted as [number, number, number]))
    doc.text(label, 18, y + 1)
    doc.setTextColor(...(text as [number, number, number]))
    doc.text(value, 192, y + 1, { align: 'right' })
    y += 7
  })
  return y
}

function orientationName(deg: number): string {
  const dirs: Record<number, string> = { 0: 'North', 45: 'North-East', 90: 'East', 135: 'South-East', 180: 'South', 225: 'South-West', 270: 'West', 315: 'North-West' }
  return dirs[deg] ?? `${deg}°`
}
