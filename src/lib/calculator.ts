import { CalculatorInputs, CalculatorResults } from '@/types'
import { getIrradiance, orientationFactor } from './irradiance'

const COST_PER_KWP_NL = 1200 // EUR
const COST_PER_KWP_ZA = 22000 // ZAR
const BTW_RATE = 0.21
const ZA_TARIFF_ESCALATION = 0.12
const PANEL_DEGRADATION = 0.005 // 0.5% per year
const CO2_FACTOR_NL = 0.475 // kg CO2 per kWh (NL grid)
const CO2_FACTOR_ZA = 0.928 // kg CO2 per kWh (Eskom coal-heavy)

export function calculateSystem(inputs: CalculatorInputs): CalculatorResults {
  const { monthly_usage, tariff, roof_orientation, roof_tilt, panel_wattage, system_losses, market } = inputs
  const annual_usage = monthly_usage * 12

  const irradiance = getIrradiance(market)
  const orientFactor = orientationFactor(roof_orientation, roof_tilt)
  const efficiencyFactor = 1 - system_losses / 100

  // Annual irradiance adjusted for orientation
  const annual_irradiance = irradiance.reduce((sum, m) => sum + m.kwh_m2, 0) * orientFactor

  // Size system to cover ~95% of usage
  const target_annual = annual_usage * 0.95
  const system_size_kwp = target_annual / (annual_irradiance * efficiencyFactor)
  const panel_count = Math.ceil((system_size_kwp * 1000) / panel_wattage)
  const actual_kwp = (panel_count * panel_wattage) / 1000

  // Monthly output
  const monthly_output = irradiance.map(m => {
    const raw = actual_kwp * m.kwh_m2 * orientFactor * efficiencyFactor
    return Math.round(raw)
  })

  const annual_output_kwh = monthly_output.reduce((s, v) => s + v, 0)

  // Financial
  const cost_per_kwp = market === 'NL' ? COST_PER_KWP_NL : COST_PER_KWP_ZA
  const base_cost = actual_kwp * cost_per_kwp
  const btw_amount = market === 'NL' ? base_cost * BTW_RATE : 0
  const total_cost = base_cost + btw_amount

  // Annual savings — net metering (saldering) for NL
  const effective_production = Math.min(annual_output_kwh, annual_usage)
  const annual_savings = effective_production * tariff

  // Payback
  const payback_years = total_cost / annual_savings

  // 25-year returns with tariff escalation
  let cumulative = -total_cost
  const escalation = market === 'ZA' ? ZA_TARIFF_ESCALATION : 0.03
  let currentTariff = tariff
  for (let y = 1; y <= 25; y++) {
    const degraded_output = annual_output_kwh * Math.pow(1 - PANEL_DEGRADATION, y)
    const yearly_savings = Math.min(degraded_output, annual_usage) * currentTariff
    cumulative += yearly_savings
    currentTariff *= (1 + escalation)
  }

  const co2_factor = market === 'NL' ? CO2_FACTOR_NL : CO2_FACTOR_ZA
  const co2_offset_kg = Math.round(annual_output_kwh * co2_factor)

  const self_sufficiency = Math.min(100, (annual_output_kwh / annual_usage) * 100)

  return {
    system_size_kwp: Math.round(actual_kwp * 10) / 10,
    panel_count,
    annual_output_kwh: Math.round(annual_output_kwh),
    monthly_output,
    payback_years: Math.round(payback_years * 10) / 10,
    annual_savings: Math.round(annual_savings),
    returns_25yr: Math.round(cumulative),
    co2_offset_kg,
    self_sufficiency: Math.round(self_sufficiency),
    btw_amount: market === 'NL' ? Math.round(btw_amount) : undefined,
    total_cost: Math.round(total_cost),
  }
}
