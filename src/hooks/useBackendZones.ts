/**
 * Fetches zone data from the backend API.
 * Falls back to INITIAL_ZONES (the hardcoded prototype data) if backend is unavailable.
 * This keeps the UI working in both connected and disconnected modes.
 */
import { useState, useEffect } from "react"
import { api, type BackendZone } from "../lib/api"

export type ZoneSource = "backend" | "fallback"

export function useBackendZones<T>(fallbackZones: T[]) {
  const [zones, setZones] = useState<T[]>(fallbackZones)
  const [source, setSource] = useState<ZoneSource>("fallback")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const backendZones = await api.getZones()
      if (cancelled) return
      if (backendZones && backendZones.length > 0) {
        // Map snake_case backend fields to the camelCase shape the UI expects
        const mapped = backendZones.map((z: BackendZone) => ({
          id: z.id,
          name: z.name,
          state: z.state,
          district: z.district,
          lat: z.lat,
          lng: z.lng,
          currentRiskLevel: z.current_risk_level as "low" | "moderate" | "high" | "critical",
          updatedAt: new Date().toISOString(),
          alertTime: z.current_risk_level === "low" ? "—" : new Date().toTimeString().slice(0, 5),
          immediateThreat: z.current_risk_level === "critical",
          aiRiskScore: z.ai_risk_score,
          predictedProbability: z.predicted_probability,
          rainfallMm: z.rainfall_mm,
          soilMoisturePercent: z.soil_moisture_pct,
          slopeAngle: z.slope_angle_deg,
          vegetationCover: z.vegetation_cover_pct,
          historicalSlides: z.historical_slides,
          triggerFactors: z.trigger_factors || [],
          affectedAreaKm: z.affected_area_km,
          populationAtRisk: z.population_at_risk,
          activeSlides: [],
          emergencyStation: z.emergency_station
            ? {
                name: z.emergency_station.name,
                lat: z.emergency_station.lat,
                lng: z.emergency_station.lng,
                distance: z.emergency_station.distance,
                contactNumber: z.emergency_station.contact_number,
              }
            : { name: "—", lat: z.lat, lng: z.lng, distance: "—", contactNumber: "112" },
        }))
        setZones(mapped as T[])
        setSource("backend")
      } else {
        setSource("fallback")
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  return { zones, setZones, source, loading }
}
