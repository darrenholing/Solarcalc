'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SystemCalculator from './SystemCalculator'
import { CalculatorInputs, CalculatorResults, Market } from '@/types'

interface Props {
  client: any
  market: Market
}

export default function NewProjectForm({ client, market }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function handleSave(inputs: CalculatorInputs, results: CalculatorResults) {
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: project, error } = await supabase.from('projects').insert({
        client_id: client.id,
        stage: 'lead',
        system_size_kwp: results.system_size_kwp,
        panel_count: results.panel_count,
        panel_wattage: inputs.panel_wattage,
        roof_orientation: inputs.roof_orientation,
        roof_tilt: inputs.roof_tilt,
        total_cost: results.total_cost,
        annual_savings: results.annual_savings,
        annual_output_kwh: results.annual_output_kwh,
        monthly_output: results.monthly_output,
        payback_years: results.payback_years,
        co2_offset_kg: results.co2_offset_kg,
        btw_amount: results.btw_amount ?? null,
      }).select().single()

      if (error) throw error
      router.push(`/projects/${project.id}`)
    } catch (err) {
      console.error(err)
      setSaving(false)
    }
  }

  return (
    <SystemCalculator
      market={market}
      onSave={handleSave}
      initialInputs={{
        monthly_usage: client.monthly_usage,
        tariff: client.tariff,
      }}
      avgLoadsheddingHours={market === 'ZA' ? client.avg_loadshedding_hours : null}
    />
  )
}
