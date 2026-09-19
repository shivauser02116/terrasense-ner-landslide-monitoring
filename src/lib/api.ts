/**
 * API client for the NER Landslide Early Warning System backend.
 * All calls go through VITE_API_BASE_URL.
 * Returns null gracefully when backend is unavailable (prototype degrades to hardcoded data).
 */

const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"

export interface RiskPrediction {
  zone_id: string
  zone_name?: string
  risk_score: number
  risk_level: string
  probability_24h: number
  contributing_factors: Array<{ factor: string; weight: number; value: string }>
  prediction_timestamp: string
  simulated: boolean
  disclaimer: string
}

export interface BackendZone {
  id: string
  name: string
  state: string
  district: string
  lat: number
  lng: number
  current_risk_level: string
  ai_risk_score: number
  predicted_probability: number
  rainfall_mm: number
  soil_moisture_pct: number
  slope_angle_deg: number
  vegetation_cover_pct: number
  historical_slides: number
  trigger_factors: string[]
  affected_area_km: number
  population_at_risk: number
  emergency_station?: {
    name: string
    lat: number
    lng: number
    distance: string
    contact_number: string
  }
}

export interface Alert {
  id: string
  zone_id: string
  zone_name: string
  risk_level: string
  risk_score: number
  message: string
  is_active: boolean
  created_at: string
}

export interface EmergencyContacts {
  national: Array<{ name: string; number: string; type: string }>
  zone?: { name: string; number: string; type: string; distance?: string } | null
  note: string
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
    if (!res.ok) {
      console.warn(`[API] ${path} returned ${res.status}`)
      return null
    }
    return res.json() as T
  } catch (err) {
    // Backend unavailable — degrade gracefully to prototype data
    console.warn(`[API] ${path} unreachable — using fallback data`)
    return null
  }
}

export const api = {
  async predictRisk(params: {
    zone_id: string
    zone_name?: string
    rainfall_mm: number
    soil_moisture_pct: number
    slope_angle_deg: number
    vegetation_cover_pct: number
    historical_slides: number
  }): Promise<RiskPrediction | null> {
    return apiFetch<RiskPrediction>("/api/predict-risk", {
      method: "POST",
      body: JSON.stringify(params),
    })
  },

  async getZones(state?: string): Promise<BackendZone[] | null> {
    const qs = state ? `?state=${encodeURIComponent(state)}` : ""
    const res = await apiFetch<{ zones: BackendZone[] }>(`/api/zones${qs}`)
    return res?.zones ?? null
  },

  async getAlerts(): Promise<Alert[] | null> {
    const res = await apiFetch<{ alerts: Alert[] }>("/api/alerts")
    return res?.alerts ?? null
  },

  async getEmergencyContacts(zoneId?: string): Promise<EmergencyContacts | null> {
    const qs = zoneId ? `?zone_id=${encodeURIComponent(zoneId)}` : ""
    return apiFetch<EmergencyContacts>(`/api/emergency-contacts${qs}`)
  },

  async chat(params: {
    message: string
    language: "en" | "kn"
    zone_id?: string
  }): Promise<{ response: string; language: string } | null> {
    return apiFetch<{ response: string; language: string }>("/api/chat", {
      method: "POST",
      body: JSON.stringify(params),
    })
  },

  async createFieldReport(formData: FormData): Promise<{ report: { id: string }; created: boolean } | null> {
    try {
      const res = await fetch(`${BASE}/api/field-reports`, {
        method: "POST",
        body: formData,
        // Do NOT set Content-Type — browser sets multipart/form-data with boundary
      })
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  },

  async syncReports(reports: Array<{
    report_id: string
    zone_id: string
    lat: number
    lng: number
    report_type: string
    description: string
    timestamp: string
    reporter_id?: string
  }>): Promise<{ summary: { created: number; skipped: number; errors: number } } | null> {
    return apiFetch("/api/sync-reports", {
      method: "POST",
      body: JSON.stringify(reports),
    })
  },
}
