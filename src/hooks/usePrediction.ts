/**
 * Calls the backend risk prediction API for a selected zone.
 * Updates the zone's aiRiskScore and predictedProbability if backend returns data.
 */
import { useState, useEffect } from "react"
import { api, type RiskPrediction } from "../lib/api"

export function usePrediction(zone: {
  id: string
  name?: string
  rainfallMm: number
  soilMoisturePercent: number
  slopeAngle: number
  vegetationCover: number
  historicalSlides: number
} | null) {
  const [prediction, setPrediction] = useState<RiskPrediction | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!zone) {
      setPrediction(null)
      return
    }
    let cancelled = false
    async function run() {
      setLoading(true)
      const result = await api.predictRisk({
        zone_id: zone!.id,
        zone_name: zone!.name,
        rainfall_mm: zone!.rainfallMm,
        soil_moisture_pct: zone!.soilMoisturePercent,
        slope_angle_deg: zone!.slopeAngle,
        vegetation_cover_pct: zone!.vegetationCover,
        historical_slides: zone!.historicalSlides,
      })
      if (!cancelled) {
        setPrediction(result)
        setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [zone?.id])

  return { prediction, loading }
}
