import SolarAssessmentClient from '@/components/solar-assessment/SolarAssessmentClient'

export const metadata = { title: 'Solar Assessment · SolarCalc' }

export default function SolarAssessmentPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl mb-1" style={{ color: 'var(--sc-text)', fontFamily: 'Fraunces, serif' }}>
          Solar Irradiance Assessment
        </h1>
        <p className="text-sm" style={{ color: 'var(--sc-muted)' }}>
          Monthly solar irradiance for any location worldwide — powered by NASA POWER (2020–2022 average)
        </p>
      </div>
      <SolarAssessmentClient />
    </div>
  )
}
