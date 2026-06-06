export type Market = 'NL' | 'ZA'

export interface User {
  id: string
  name: string
  company: string
  email: string
  logo?: string
  subscription_tier: 'free' | 'pro' | 'platform'
  market: Market
  province?: ZAProvince | null
  proposals_this_month?: number
  created_at: string
}

export type ZAProvince = 'Gauteng' | 'Western Cape' | 'KwaZulu-Natal' | 'Eastern Cape'

export interface Client {
  id: string
  installer_id: string
  name: string
  address: string
  email: string
  phone: string
  monthly_usage: number
  tariff: number
  avg_loadshedding_hours?: number
  lat?: number
  lng?: number
  created_at: string
}

export interface Project {
  id: string
  client_id: string
  client?: Client
  stage: PipelineStage
  system_size_kwp: number
  panel_count: number
  total_cost: number
  annual_savings: number
  payback_years: number
  panel_wattage: number
  roof_orientation: string
  roof_tilt: number
  roof_area_m2?: number
  max_kwp?: number
  monthly_output?: number[]
  annual_output_kwh: number
  co2_offset_kg: number
  btw_amount?: number
  notes?: string
  created_at: string
  signed_at?: string
}

export type PipelineStage =
  | 'lead'
  | 'qualified'
  | 'proposal_sent'
  | 'site_survey'
  | 'closed_won'
  | 'closed_lost'

export interface Proposal {
  id: string
  project_id: string
  project?: Project
  pdf_url?: string
  sent_at?: string
  viewed_at?: string
  signed_at?: string
  signature_data?: string
  sign_token?: string
  created_at: string
}

export interface Installation {
  id: string
  project_id: string
  project?: Project
  installed_at: string
  inverter_type: 'victron' | 'solaredge' | 'other'
  monitoring_api_key?: string
  system_id?: string
}

export interface MonthlyIrradiance {
  month: number
  label: string
  kwh_m2: number
}

export interface CalculatorInputs {
  monthly_usage: number
  tariff: number
  roof_orientation: number
  roof_tilt: number
  panel_wattage: number
  system_losses: number
  roof_area_m2?: number
  market: Market
}

export interface CalculatorResults {
  system_size_kwp: number
  panel_count: number
  annual_output_kwh: number
  monthly_output: number[]
  payback_years: number
  annual_savings: number
  returns_25yr: number
  co2_offset_kg: number
  self_sufficiency: number
  btw_amount?: number
  total_cost: number
}

export interface SolarSegment {
  pitch_degrees: number
  azimuth_degrees: number
  panel_count: number
  yearly_energy_dc_kwh: number
  bounding_box: {
    sw: { latitude: number; longitude: number }
    ne: { latitude: number; longitude: number }
  }
}

export interface BuildingInsights {
  name: string
  center: { latitude: number; longitude: number }
  solar_potential: {
    max_array_panels_count: number
    max_array_area_meters2: number
    max_sunshine_hours_per_year: number
    carbon_offset_factor_kg_per_mwh: number
    roof_segment_stats: SolarSegment[]
    solar_panels: Array<{
      panelCount: number
      yearlyEnergyDcKwh: number
      segmentIndex: number
      center: { latitude: number; longitude: number }
      orientation: 'PORTRAIT' | 'LANDSCAPE'
    }>
  }
}
