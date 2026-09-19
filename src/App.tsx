import "leaflet/dist/leaflet.css"
import "leaflet.markercluster/dist/MarkerCluster.css"
import "leaflet.markercluster/dist/MarkerCluster.Default.css"
import { useState, useEffect, useRef } from "react"
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet.markercluster"

import { useBackendZones } from "./hooks/useBackendZones"
import { useActiveAlerts } from "./hooks/useActiveAlerts"
import { usePrediction } from "./hooks/usePrediction"
import ChatPanel from "./components/ChatPanel"
import FieldReportModal from "./components/FieldReportModal"

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = "low" | "moderate" | "high" | "critical"

interface ActiveSlide {
  id: string
  name: string
  cause: string
}

interface EmergencyStation {
  name: string
  lat: number
  lng: number
  distance: string
  contactNumber: string
}

interface LandslideZone {
  id: string
  name: string
  state: string
  district: string
  lat: number
  lng: number
  currentRiskLevel: RiskLevel
  updatedAt: string
  alertTime: string
  immediateThreat: boolean
  aiRiskScore: number
  predictedProbability: number
  rainfallMm: number
  soilMoisturePercent: number
  slopeAngle: number
  vegetationCover: number
  historicalSlides: number
  triggerFactors: string[]
  affectedAreaKm: number
  populationAtRisk: number
  activeSlides: ActiveSlide[]
  emergencyStation: EmergencyStation
}

// ─── Risk styling ─────────────────────────────────────────────────────────────

function riskStyle(risk: RiskLevel) {
  return {
    low:      { marker: "#16A34A", markerBg: "#DCFCE7", text: "#14532D", border: "#16A34A", icon: "✓",   pulse: false },
    moderate: { marker: "#D97706", markerBg: "#FEF3C7", text: "#78350F", border: "#D97706", icon: "!",   pulse: false },
    high:     { marker: "#EA580C", markerBg: "#FFEDD5", text: "#7C2D12", border: "#EA580C", icon: "!!",  pulse: true  },
    critical: { marker: "#DC2626", markerBg: "#FEE2E2", text: "#7F1D1D", border: "#DC2626", icon: "!!!", pulse: true  },
  }[risk]
}

const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Low", moderate: "Moderate", high: "High", critical: "Critical",
}

const RISK_ORDER: Record<RiskLevel, number> = { critical: 0, high: 1, moderate: 2, low: 3 }

// ─── NER boundary (simplified GeoJSON polygon) ───────────────────────────────

const NER_BOUNDARY_GEOJSON = {
  type: "FeatureCollection" as const,
  features: [{
    type: "Feature" as const,
    properties: { name: "North East India (NER)" },
    geometry: {
      type: "Polygon" as const,
      coordinates: [[
        [88.00, 27.10], [88.30, 26.80], [88.60, 26.55],
        [89.10, 26.35], [89.80, 26.20], [90.50, 26.00],
        [91.00, 26.10], [91.50, 26.30], [92.00, 26.50],
        [92.80, 26.75], [93.50, 26.90], [94.00, 27.40],
        [94.80, 27.90], [95.50, 28.20], [96.50, 28.00],
        [97.00, 27.50], [97.40, 27.10], [97.50, 26.50],
        [97.20, 25.50], [96.50, 24.50], [96.00, 23.50],
        [95.50, 23.00], [94.50, 22.80], [93.50, 22.50],
        [93.00, 22.10], [92.50, 22.40], [92.00, 22.80],
        [91.50, 22.50], [91.00, 22.00], [90.50, 22.50],
        [90.00, 23.00], [89.50, 23.50], [89.00, 24.20],
        [88.80, 24.80], [88.40, 25.50], [88.00, 26.20],
        [88.00, 27.10],
      ]],
    },
  }],
}

const NER_BOUNDS: L.LatLngBoundsExpression = [
  [21.8, 87.8],
  [28.8, 97.8],
]

// ─── Monitoring zone data — 18 zones across 8 NER states ─────────────────────

const INITIAL_ZONES: LandslideZone[] = [
  /* ── Assam ──────────────────────────────────────────────────────────────── */
  {
    id: "guwahati", name: "Guwahati", state: "Assam", district: "Kamrup Metro",
    lat: 26.1445, lng: 91.7362,
    currentRiskLevel: "low", updatedAt: "2024-07-18T06:00:00Z", alertTime: "—", immediateThreat: false,
    aiRiskScore: 18, predictedProbability: 6,
    rainfallMm: 12, soilMoisturePercent: 42, slopeAngle: 8, vegetationCover: 68,
    historicalSlides: 1, triggerFactors: ["Low rainfall", "Stable terrain"],
    affectedAreaKm: 2, populationAtRisk: 1200,
    activeSlides: [],
    emergencyStation: { name: "Assam SDRF Guwahati Base", lat: 26.1623, lng: 91.7471, distance: "4.2 km", contactNumber: "0361-2237516" },
  },
  {
    id: "silchar", name: "Silchar", state: "Assam", district: "Cachar",
    lat: 24.8333, lng: 92.7789,
    currentRiskLevel: "high", updatedAt: "2024-07-18T07:45:00Z", alertTime: "07:45", immediateThreat: false,
    aiRiskScore: 74, predictedProbability: 68,
    rainfallMm: 186, soilMoisturePercent: 88, slopeAngle: 32, vegetationCover: 45,
    historicalSlides: 7, triggerFactors: ["Heavy rainfall", "Steep slopes", "Soil saturation"],
    affectedAreaKm: 12, populationAtRisk: 8400,
    activeSlides: [
      { id: "s1", name: "Barail Range North Face", cause: "Mass movement — slope saturation" },
      { id: "s2", name: "Bhuban Hills Debris Flow", cause: "Active debris channel" },
    ],
    emergencyStation: { name: "Silchar Civil Hospital Emergency", lat: 24.8400, lng: 92.7890, distance: "2.1 km", contactNumber: "03842-233900" },
  },
  {
    id: "dibrugarh", name: "Dibrugarh", state: "Assam", district: "Dibrugarh",
    lat: 27.4728, lng: 94.9120,
    currentRiskLevel: "moderate", updatedAt: "2024-07-18T09:15:00Z", alertTime: "09:15", immediateThreat: false,
    aiRiskScore: 41, predictedProbability: 28,
    rainfallMm: 67, soilMoisturePercent: 61, slopeAngle: 15, vegetationCover: 72,
    historicalSlides: 3, triggerFactors: ["Moderate rainfall", "Brahmaputra bank erosion"],
    affectedAreaKm: 5, populationAtRisk: 2800,
    activeSlides: [
      { id: "s1", name: "Brahmaputra Riverbank Zone", cause: "Bank erosion — moderate flow" },
    ],
    emergencyStation: { name: "Dibrugarh District Emergency", lat: 27.4800, lng: 94.9200, distance: "1.8 km", contactNumber: "0373-2324610" },
  },

  /* ── Meghalaya ───────────────────────────────────────────────────────────── */
  {
    id: "cherrapunji", name: "Cherrapunji (Sohra)", state: "Meghalaya", district: "East Khasi Hills",
    lat: 25.2800, lng: 91.7100,
    currentRiskLevel: "critical", updatedAt: "2024-07-18T06:30:00Z", alertTime: "06:30", immediateThreat: true,
    aiRiskScore: 94, predictedProbability: 92,
    rainfallMm: 412, soilMoisturePercent: 97, slopeAngle: 48, vegetationCover: 31,
    historicalSlides: 19, triggerFactors: ["Extreme rainfall (world record zone)", "Fully saturated soil", "Steep plateau edges", "Deforestation"],
    affectedAreaKm: 18, populationAtRisk: 15600,
    activeSlides: [
      { id: "s1", name: "Mawsmai Cliff Face Failure", cause: "Saturated cliff — mass movement" },
      { id: "s2", name: "Nohkalikai Waterfall Zone", cause: "Active debris flow in gorge" },
      { id: "s3", name: "Sohra Valley Multi-Slide", cause: "Multiple failure planes active" },
    ],
    emergencyStation: { name: "Sohra Block Emergency HQ", lat: 25.2900, lng: 91.7200, distance: "1.2 km", contactNumber: "0364-2501260" },
  },
  {
    id: "shillong", name: "Shillong", state: "Meghalaya", district: "East Khasi Hills",
    lat: 25.5788, lng: 91.8933,
    currentRiskLevel: "high", updatedAt: "2024-07-18T08:20:00Z", alertTime: "08:20", immediateThreat: false,
    aiRiskScore: 71, predictedProbability: 64,
    rainfallMm: 154, soilMoisturePercent: 82, slopeAngle: 35, vegetationCover: 48,
    historicalSlides: 9, triggerFactors: ["Heavy rainfall", "Urban slope encroachment", "Degraded vegetation"],
    affectedAreaKm: 9, populationAtRisk: 11200,
    activeSlides: [
      { id: "s1", name: "Mawlai Hill Residential Slide", cause: "Slope failure — built-up area" },
      { id: "s2", name: "Laitkor Peak North Face", cause: "Active debris flow" },
    ],
    emergencyStation: { name: "Meghalaya SDMA Shillong", lat: 25.5850, lng: 91.8800, distance: "0.8 km", contactNumber: "0364-2504800" },
  },
  {
    id: "tura", name: "Tura", state: "Meghalaya", district: "West Garo Hills",
    lat: 25.5143, lng: 90.2169,
    currentRiskLevel: "moderate", updatedAt: "2024-07-18T10:05:00Z", alertTime: "10:05", immediateThreat: false,
    aiRiskScore: 38, predictedProbability: 24,
    rainfallMm: 58, soilMoisturePercent: 57, slopeAngle: 22, vegetationCover: 65,
    historicalSlides: 4, triggerFactors: ["Moderate rainfall", "Coal mining subsidence"],
    affectedAreaKm: 4, populationAtRisk: 3100,
    activeSlides: [
      { id: "s1", name: "Tura Peak NE Slope Creep", cause: "Slow mass movement" },
    ],
    emergencyStation: { name: "Tura District Hospital", lat: 25.5200, lng: 90.2300, distance: "1.5 km", contactNumber: "03651-222000" },
  },

  /* ── Nagaland ────────────────────────────────────────────────────────────── */
  {
    id: "kohima", name: "Kohima", state: "Nagaland", district: "Kohima",
    lat: 25.6747, lng: 94.1086,
    currentRiskLevel: "high", updatedAt: "2024-07-18T07:50:00Z", alertTime: "07:50", immediateThreat: false,
    aiRiskScore: 77, predictedProbability: 72,
    rainfallMm: 168, soilMoisturePercent: 84, slopeAngle: 41, vegetationCover: 38,
    historicalSlides: 11, triggerFactors: ["Heavy rainfall", "Steep hill terrain", "Road construction cuts"],
    affectedAreaKm: 11, populationAtRisk: 9800,
    activeSlides: [
      { id: "s1", name: "NH-29 Km 12 Cut Slope Failure", cause: "Road-side slope collapse" },
      { id: "s2", name: "Kohima Ridge North Face", cause: "Debris flow — active" },
    ],
    emergencyStation: { name: "Nagaland SDRF Kohima", lat: 25.6800, lng: 94.1150, distance: "1.0 km", contactNumber: "0370-2290100" },
  },
  {
    id: "wokha", name: "Wokha", state: "Nagaland", district: "Wokha",
    lat: 26.1047, lng: 94.2610,
    currentRiskLevel: "moderate", updatedAt: "2024-07-18T09:30:00Z", alertTime: "09:30", immediateThreat: false,
    aiRiskScore: 44, predictedProbability: 31,
    rainfallMm: 78, soilMoisturePercent: 65, slopeAngle: 28, vegetationCover: 58,
    historicalSlides: 5, triggerFactors: ["Moderate rainfall", "Terrace farming disturbance"],
    affectedAreaKm: 6, populationAtRisk: 4200,
    activeSlides: [
      { id: "s1", name: "Wokha South Slope Creep", cause: "Slow creep — minor movement" },
    ],
    emergencyStation: { name: "Wokha District HQ", lat: 26.1100, lng: 94.2700, distance: "2.3 km", contactNumber: "03869-220126" },
  },

  /* ── Manipur ─────────────────────────────────────────────────────────────── */
  {
    id: "imphal", name: "Imphal Valley", state: "Manipur", district: "Imphal East",
    lat: 24.8170, lng: 93.9368,
    currentRiskLevel: "moderate", updatedAt: "2024-07-18T06:00:00Z", alertTime: "—", immediateThreat: false,
    aiRiskScore: 36, predictedProbability: 21,
    rainfallMm: 54, soilMoisturePercent: 55, slopeAngle: 12, vegetationCover: 70,
    historicalSlides: 2, triggerFactors: ["Moderate rainfall", "Valley floor instability"],
    affectedAreaKm: 3, populationAtRisk: 1900,
    activeSlides: [],
    emergencyStation: { name: "RIMS Hospital Imphal Emergency", lat: 24.8220, lng: 93.9420, distance: "1.2 km", contactNumber: "0385-2414916" },
  },
  {
    id: "churachandpur", name: "Churachandpur", state: "Manipur", district: "Churachandpur",
    lat: 24.3333, lng: 93.6833,
    currentRiskLevel: "high", updatedAt: "2024-07-18T08:40:00Z", alertTime: "08:40", immediateThreat: false,
    aiRiskScore: 69, predictedProbability: 61,
    rainfallMm: 142, soilMoisturePercent: 79, slopeAngle: 38, vegetationCover: 42,
    historicalSlides: 8, triggerFactors: ["Heavy rainfall", "Hilly terrain", "Jhum cultivation impacts"],
    affectedAreaKm: 10, populationAtRisk: 7600,
    activeSlides: [
      { id: "s1", name: "Tuithaphai River Slope", cause: "Bank undercutting — slope failure" },
      { id: "s2", name: "Churachandpur–Imphal Road", cause: "Embankment failure — road risk" },
    ],
    emergencyStation: { name: "Churachandpur District Hospital", lat: 24.3400, lng: 93.6900, distance: "1.8 km", contactNumber: "03874-234200" },
  },

  /* ── Mizoram ─────────────────────────────────────────────────────────────── */
  {
    id: "aizawl", name: "Aizawl", state: "Mizoram", district: "Aizawl",
    lat: 23.7271, lng: 92.7176,
    currentRiskLevel: "high", updatedAt: "2024-07-18T07:30:00Z", alertTime: "07:30", immediateThreat: false,
    aiRiskScore: 78, predictedProbability: 74,
    rainfallMm: 172, soilMoisturePercent: 86, slopeAngle: 44, vegetationCover: 35,
    historicalSlides: 14, triggerFactors: ["Heavy rainfall", "Extremely steep slopes", "Dense urban settlement"],
    affectedAreaKm: 13, populationAtRisk: 12400,
    activeSlides: [
      { id: "s1", name: "Dawrpui Ward Mass Movement", cause: "Residential slope failure" },
      { id: "s2", name: "Thuampui Area Debris Flow", cause: "Active channel — debris" },
    ],
    emergencyStation: { name: "Mizoram SDMA Aizawl HQ", lat: 23.7350, lng: 92.7250, distance: "1.3 km", contactNumber: "0389-2320001" },
  },
  {
    id: "lunglei", name: "Lunglei", state: "Mizoram", district: "Lunglei",
    lat: 22.8884, lng: 92.7439,
    currentRiskLevel: "critical", updatedAt: "2024-07-18T06:15:00Z", alertTime: "06:15", immediateThreat: true,
    aiRiskScore: 89, predictedProbability: 87,
    rainfallMm: 298, soilMoisturePercent: 94, slopeAngle: 52, vegetationCover: 28,
    historicalSlides: 16, triggerFactors: ["Extreme rainfall", "Steepest terrain in district", "Active erosion", "Bamboo felling"],
    affectedAreaKm: 15, populationAtRisk: 13800,
    activeSlides: [
      { id: "s1", name: "Lunglei North Face Major Slide", cause: "Mass movement — ongoing" },
      { id: "s2", name: "Tlawng River Corridor", cause: "Combined debris flow + flooding" },
      { id: "s3", name: "Lungsen Village Access Road", cause: "Blocked — active slide" },
    ],
    emergencyStation: { name: "Lunglei District Emergency", lat: 22.8950, lng: 92.7520, distance: "1.5 km", contactNumber: "03722-222000" },
  },

  /* ── Tripura ─────────────────────────────────────────────────────────────── */
  {
    id: "agartala", name: "Agartala", state: "Tripura", district: "West Tripura",
    lat: 23.8315, lng: 91.2868,
    currentRiskLevel: "low", updatedAt: "2024-07-18T06:00:00Z", alertTime: "—", immediateThreat: false,
    aiRiskScore: 22, predictedProbability: 9,
    rainfallMm: 28, soilMoisturePercent: 46, slopeAngle: 6, vegetationCover: 74,
    historicalSlides: 1, triggerFactors: ["Low rainfall", "Flat terrain"],
    affectedAreaKm: 2, populationAtRisk: 900,
    activeSlides: [],
    emergencyStation: { name: "Tripura SDRF Agartala", lat: 23.8400, lng: 91.2950, distance: "2.0 km", contactNumber: "0381-2325759" },
  },
  {
    id: "sabroom", name: "Sabroom", state: "Tripura", district: "South Tripura",
    lat: 23.0738, lng: 91.8110,
    currentRiskLevel: "moderate", updatedAt: "2024-07-18T10:15:00Z", alertTime: "10:15", immediateThreat: false,
    aiRiskScore: 45, predictedProbability: 29,
    rainfallMm: 84, soilMoisturePercent: 63, slopeAngle: 19, vegetationCover: 61,
    historicalSlides: 3, triggerFactors: ["Moderate rainfall", "Southern hilly terrain"],
    affectedAreaKm: 5, populationAtRisk: 3400,
    activeSlides: [
      { id: "s1", name: "Feni River Escarpment Creep", cause: "Riverbank slope movement" },
    ],
    emergencyStation: { name: "Sabroom Block Emergency", lat: 23.0800, lng: 91.8200, distance: "2.8 km", contactNumber: "03826-232500" },
  },

  /* ── Arunachal Pradesh ───────────────────────────────────────────────────── */
  {
    id: "itanagar", name: "Itanagar", state: "Arunachal Pradesh", district: "Papum Pare",
    lat: 27.0844, lng: 93.6053,
    currentRiskLevel: "high", updatedAt: "2024-07-18T08:10:00Z", alertTime: "08:10", immediateThreat: false,
    aiRiskScore: 72, predictedProbability: 66,
    rainfallMm: 158, soilMoisturePercent: 81, slopeAngle: 36, vegetationCover: 44,
    historicalSlides: 10, triggerFactors: ["Heavy rainfall", "Seismic Zone V", "Rapid urbanization"],
    affectedAreaKm: 10, populationAtRisk: 8900,
    activeSlides: [
      { id: "s1", name: "Naharlagun Hill Slope Failure", cause: "Active slope movement" },
      { id: "s2", name: "Chimpu Colony Road Cut", cause: "Slope instability — cut face" },
    ],
    emergencyStation: { name: "Arunachal SDMA Emergency", lat: 27.0900, lng: 93.6120, distance: "1.6 km", contactNumber: "0360-2213401" },
  },
  {
    id: "along", name: "Along (Aalo)", state: "Arunachal Pradesh", district: "West Siang",
    lat: 28.1660, lng: 94.7963,
    currentRiskLevel: "critical", updatedAt: "2024-07-18T06:00:00Z", alertTime: "06:00", immediateThreat: true,
    aiRiskScore: 91, predictedProbability: 89,
    rainfallMm: 324, soilMoisturePercent: 96, slopeAngle: 55, vegetationCover: 26,
    historicalSlides: 18, triggerFactors: ["Extreme rainfall", "Earthquake zone (Zone V)", "Glacial melt input", "Near-vertical slopes"],
    affectedAreaKm: 16, populationAtRisk: 14200,
    activeSlides: [
      { id: "s1", name: "Siang River Gorge Mass Movement", cause: "River undercutting — mass failure" },
      { id: "s2", name: "Along–Pasighat Highway Block", cause: "Debris flow — road closed" },
      { id: "s3", name: "Payum Hills Multiple Failures", cause: "Multi-plane slope failure" },
    ],
    emergencyStation: { name: "Along Civil Hospital Emergency", lat: 28.1750, lng: 94.8050, distance: "1.9 km", contactNumber: "03783-222204" },
  },

  /* ── Sikkim ──────────────────────────────────────────────────────────────── */
  {
    id: "gangtok", name: "Gangtok", state: "Sikkim", district: "East Sikkim",
    lat: 27.3389, lng: 88.6065,
    currentRiskLevel: "high", updatedAt: "2024-07-18T07:55:00Z", alertTime: "07:55", immediateThreat: false,
    aiRiskScore: 76, predictedProbability: 70,
    rainfallMm: 163, soilMoisturePercent: 83, slopeAngle: 40, vegetationCover: 39,
    historicalSlides: 12, triggerFactors: ["Heavy rainfall", "Seismic instability", "GLOF risk from high-altitude lakes"],
    affectedAreaKm: 11, populationAtRisk: 10400,
    activeSlides: [
      { id: "s1", name: "Tashi View Point Slope", cause: "Active mass movement" },
      { id: "s2", name: "Ranipool River Bank Failure", cause: "Erosion + slope failure" },
    ],
    emergencyStation: { name: "SSDMA Gangtok HQ", lat: 27.3450, lng: 88.6130, distance: "1.1 km", contactNumber: "03592-202036" },
  },
  {
    id: "mangan", name: "Mangan", state: "Sikkim", district: "North Sikkim",
    lat: 27.5094, lng: 88.5284,
    currentRiskLevel: "critical", updatedAt: "2024-07-18T05:45:00Z", alertTime: "05:45", immediateThreat: true,
    aiRiskScore: 96, predictedProbability: 94,
    rainfallMm: 386, soilMoisturePercent: 98, slopeAngle: 58, vegetationCover: 22,
    historicalSlides: 21, triggerFactors: ["Extreme rainfall", "Himalayan seismic zone", "GLOF from glacial lakes", "Permafrost thaw", "Steep Himalayan terrain"],
    affectedAreaKm: 19, populationAtRisk: 16800,
    activeSlides: [
      { id: "s1", name: "Teesta Gorge GLOF-Induced Slide", cause: "Glacial lake outburst — ongoing" },
      { id: "s2", name: "Lachen Valley Debris Flows", cause: "Multiple active debris channels" },
      { id: "s3", name: "Mangan–Lachung Road Block", cause: "Road closed — major slide" },
      { id: "s4", name: "North Sikkim Alpine Failures", cause: "Permafrost thaw — mass movement" },
    ],
    emergencyStation: { name: "Mangan SDM Emergency HQ", lat: 27.5150, lng: 88.5360, distance: "1.3 km", contactNumber: "03592-234100" },
  },
]

// ─── Marker icons ─────────────────────────────────────────────────────────────

function createMarkerIcon(risk: RiskLevel, selected: boolean): L.DivIcon {
  const colors = riskStyle(risk)
  const size = selected ? 36 : 30
  const tipH = selected ? 12 : 10
  const totalH = size + tipH
  const pulse = colors.pulse
  const iconLabel = colors.icon

  const pulseRing = pulse
    ? `<div class="marker-pulse-ring" style="background:${colors.marker};opacity:0.35;width:${size}px;height:${size}px;top:0;left:0;border-radius:${size}px;"></div>`
    : ""

  return L.divIcon({
    html: `
      <div style="position:relative;width:${size}px;height:${totalH}px;">
        ${pulseRing}
        <div style="
          position:absolute;top:0;left:0;
          width:${size}px;height:${size}px;
          border-radius:${size / 2}px ${size / 2}px ${selected ? 4 : 3}px ${selected ? 4 : 3}px;
          background:${colors.marker};
          border:${selected ? "3px" : "2px"} solid rgba(255,255,255,${selected ? 1 : 0.9});
          display:flex;align-items:center;justify-content:center;
          filter:drop-shadow(0 3px ${selected ? "8px" : "4px"} rgba(0,0,0,${selected ? 0.45 : 0.30}));
          box-sizing:border-box;
        ">
          <span style="color:white;font-size:${risk === "critical" ? 8 : 10}px;font-weight:900;font-family:monospace;line-height:1;">${iconLabel}</span>
        </div>
        <div style="
          position:absolute;
          left:${size / 2 - (selected ? 5 : 4)}px;
          top:${size - 2}px;
          width:0;height:0;
          border-left:${selected ? 5 : 4}px solid transparent;
          border-right:${selected ? 5 : 4}px solid transparent;
          border-top:${tipH}px solid ${colors.marker};
          filter:drop-shadow(0 2px 3px rgba(0,0,0,0.25));
        "></div>
      </div>`,
    className: "",
    iconSize: [size, totalH],
    iconAnchor: [size / 2, totalH],
    popupAnchor: [0, -totalH - 4],
  })
}

function createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount()
  const sz = count < 5 ? 36 : count < 10 ? 42 : 48
  const fs = count < 10 ? 14 : 12
  return L.divIcon({
    html: `<div class="cluster-icon-inner" style="width:${sz}px;height:${sz}px;font-size:${fs}px;">${count}</div>`,
    className: "",
    iconSize: [sz, sz],
    iconAnchor: [sz / 2, sz / 2],
  })
}

// ─── Map sub-components ───────────────────────────────────────────────────────

function MapController({ target }: { target: LandslideZone | null }) {
  const map = useMap()
  const prevId = useRef<string | null>(null)

  useEffect(() => {
    if (target && target.id !== prevId.current) {
      map.flyTo([target.lat, target.lng], 10, { duration: 0.7, easeLinearity: 0.5 })
    } else if (!target && prevId.current !== null) {
      map.flyToBounds(NER_BOUNDS, { padding: [32, 32], duration: 0.7 })
    }
    prevId.current = target?.id ?? null
  })

  return null
}

function ClusteredMarkers({
  zones, selectedId, onSelect,
}: {
  zones: LandslideZone[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const map = useMap()

  useEffect(() => {
    const mcg = L.markerClusterGroup({
      iconCreateFunction: createClusterIcon,
      showCoverageOnHover: false,
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      animateAddingMarkers: false,
      chunkedLoading: true,
    })

    zones.forEach(z => {
      const marker = L.marker([z.lat, z.lng], {
        icon: createMarkerIcon(z.currentRiskLevel, z.id === selectedId),
        zIndexOffset: z.id === selectedId ? 1000 : (RISK_ORDER[z.currentRiskLevel] === 0 ? 800 : 0),
      })
      marker.on("click", () => onSelect(z.id))
      marker.bindTooltip(`${z.name} · AI Score: ${z.aiRiskScore}/100`, {
        direction: "top",
        offset: [0, -(26 + 10)],
        className: "village-tooltip",
        sticky: false,
      })
      mcg.addLayer(marker)
    })

    map.addLayer(mcg)
    return () => { map.removeLayer(mcg) }
  }, [map, zones, selectedId])

  return null
}

// Renders semi-transparent risk blobs forming a GIS risk heatmap
function HeatmapLayer({ zones }: { zones: LandslideZone[] }) {
  const map = useMap()

  useEffect(() => {
    const cfg = {
      critical: { fillColor: "#DC2626", fillOpacity: 0.22, weight: 0, color: "#DC2626", radius: 44000 },
      high:     { fillColor: "#EA580C", fillOpacity: 0.17, weight: 0, color: "#EA580C", radius: 34000 },
      moderate: { fillColor: "#D97706", fillOpacity: 0.13, weight: 0, color: "#D97706", radius: 25000 },
      low:      { fillColor: "#16A34A", fillOpacity: 0.08, weight: 0, color: "#16A34A", radius: 19000 },
    }

    // Render low first so critical renders on top
    const sorted = [...zones].sort(
      (a, b) => RISK_ORDER[b.currentRiskLevel] - RISK_ORDER[a.currentRiskLevel]
    )

    const circles = sorted.map(z => L.circle([z.lat, z.lng], cfg[z.currentRiskLevel]))
    const group = L.layerGroup(circles)
    group.addTo(map)
    return () => { map.removeLayer(group) }
  }, [map, zones])

  return null
}

function ZoneMap({
  zones, selectedId, onSelect,
}: {
  zones: LandslideZone[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const selected = zones.find(z => z.id === selectedId) ?? null

  return (
    <div className="relative w-full h-full">
      <MapContainer
        bounds={NER_BOUNDS}
        boundsOptions={{ padding: [24, 24] }}
        style={{ width: "100%", height: "100%" }}
        zoomControl={true}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />

        <GeoJSON
          data={NER_BOUNDARY_GEOJSON}
          style={() => ({
            color: "#1B2E4B",
            weight: 2,
            fillColor: "#1B2E4B",
            fillOpacity: 0.04,
            opacity: 0.45,
            dashArray: "4 4",
          })}
        />

        {/* Heatmap blobs render before markers so markers stay on top */}
        <HeatmapLayer zones={zones} />

        <ClusteredMarkers zones={zones} selectedId={selectedId} onSelect={onSelect} />

        <MapController target={selected} />
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-8 left-3" style={{ zIndex: 400, pointerEvents: "none" }}>
        <div style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(6px)",
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-md)",
          padding: "10px 12px",
          minWidth: 158,
        }}>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)", marginBottom: 8 }}>
            Landslide Risk
          </div>
          {(["critical", "high", "moderate", "low"] as RiskLevel[]).map(r => {
            const s = riskStyle(r)
            return (
              <div key={r} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ width: 14, height: 14, borderRadius: "50%", background: s.marker, flexShrink: 0, display: "inline-block" }} />
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-2)", fontWeight: 500 }}>{RISK_LABEL[r]}</span>
              </div>
            )
          })}

          <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8 }}>
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)", marginBottom: 6 }}>
              GIS Risk Heatmap
            </div>
            {(["critical", "high", "moderate", "low"] as RiskLevel[]).map(r => {
              const s = riskStyle(r)
              return (
                <div key={r} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: s.marker, opacity: 0.42, flexShrink: 0, display: "inline-block" }} />
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-2)", fontWeight: 500 }}>{RISK_LABEL[r]} Zone</span>
                </div>
              )
            })}
          </div>

          <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 6, fontSize: "var(--text-2xs)", color: "var(--text-3)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
            ⚠ PROTOTYPE DATA
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── UI components ────────────────────────────────────────────────────────────

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const s = riskStyle(risk)
  return (
    <span style={{ background: s.markerBg, color: s.text, borderColor: s.border }}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-black border uppercase tracking-wide">
      <span aria-hidden style={{ fontFamily: "monospace" }}>{s.icon}</span>
      {RISK_LABEL[risk]}
    </span>
  )
}

function CriticalThreatBanner() {
  return (
    <div className="rounded-xl overflow-hidden mb-4" style={{ border: "2px solid #FCA5A5", boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "#B91C1C" }}>
        <span className="text-2xl" aria-hidden>🚨</span>
        <span className="text-white font-black text-sm uppercase tracking-widest">Immediate Threat — Critical Risk</span>
      </div>
      <div className="px-4 py-3" style={{ background: "#FEF2F2" }}>
        <div className="font-bold text-sm mb-1" style={{ color: "#7F1D1D" }}>Imminent Landslide — AI Prediction Active</div>
        <div className="text-sm leading-relaxed mb-3" style={{ color: "#991B1B" }}>
          Prototype AI model indicates extremely high probability of landslide in next 24 hours. Alert SDMA and deploy response teams immediately.
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="tel:18003453566"
            className="inline-flex items-center gap-1.5 font-bold text-sm px-3 py-2.5 rounded-lg min-h-[44px]"
            style={{ background: "#B91C1C", color: "white" }}>
            📞 SDMA: 1800-345-3566
          </a>
          <a href="tel:112"
            className="inline-flex items-center gap-1.5 font-bold text-sm px-3 py-2.5 rounded-lg min-h-[44px]"
            style={{ background: "white", color: "#B91C1C", border: "2px solid #FCA5A5" }}>
            🆘 Emergency: 112
          </a>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <h3 className="flex items-center gap-2 mb-3" style={{ fontSize: "var(--text-xs)", fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text-3)" }}>
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </h3>
  )
}

function MetricTile({ label, value, unit, color, icon }: {
  label: string; value: number | string; unit?: string; color: string; icon: string
}) {
  return (
    <div className="p-2.5 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", marginBottom: 4 }}>
        <span aria-hidden>{icon}</span> {label}
      </div>
      <div className="font-black" style={{ fontSize: "var(--text-base)", color, lineHeight: 1.2 }}>
        {value}
        {unit && <span className="font-normal" style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  )
}

function DetailPanel({ zone, onClose, onFileReport }: { zone: LandslideZone; onClose: () => void; onFileReport?: () => void }) {
  const s = riskStyle(zone.currentRiskLevel)

  const rainfallColor = zone.rainfallMm > 250 ? "#DC2626" : zone.rainfallMm > 150 ? "#EA580C" : zone.rainfallMm > 50 ? "#D97706" : "#16A34A"
  const moistureColor = zone.soilMoisturePercent > 90 ? "#DC2626" : zone.soilMoisturePercent > 75 ? "#EA580C" : zone.soilMoisturePercent > 60 ? "#D97706" : "#16A34A"
  const slopeColor   = zone.slopeAngle > 45 ? "#DC2626" : zone.slopeAngle > 30 ? "#EA580C" : zone.slopeAngle > 15 ? "#D97706" : "#16A34A"
  const vegColor     = zone.vegetationCover < 25 ? "#DC2626" : zone.vegetationCover < 40 ? "#EA580C" : zone.vegetationCover < 60 ? "#D97706" : "#16A34A"
  const scoreColor   = zone.aiRiskScore > 80 ? "#DC2626" : zone.aiRiskScore > 60 ? "#EA580C" : zone.aiRiskScore > 30 ? "#D97706" : "#16A34A"

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--surface)" }}>
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-4 pb-3"
        style={{ borderBottom: "1px solid var(--border)", borderLeft: `4px solid ${s.marker}`, background: "var(--surface)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 pl-1">
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
              {zone.state} · {zone.district}
            </div>
            <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 900, color: "var(--text)", lineHeight: 1.2 }}>
              {zone.name}
            </h2>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-3)", marginTop: 2, marginBottom: 10 }}>
              Landslide Monitoring Zone · NER
            </div>
            <div className="flex flex-wrap gap-1.5">
              <RiskBadge risk={zone.currentRiskLevel} />
              {zone.immediateThreat && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold"
                  style={{ background: "#FEE2E2", color: "#7F1D1D", border: "1px solid #FCA5A5" }}>
                  🚨 Immediate Threat
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors flex-shrink-0 text-2xl font-light"
            style={{ color: "var(--text-3)", background: "transparent" }}
            aria-label="Close"
            onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-3)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
            ×
          </button>
        </div>
        {zone.alertTime !== "—" && (
          <div className="mt-2" style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
            Alert triggered: {zone.alertTime} · Updated: {zone.updatedAt.slice(11, 16)} UTC
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {zone.immediateThreat && <CriticalThreatBanner />}

        {/* Field Report Button */}
        <button
          onClick={() => onFileReport?.()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm min-h-[44px]"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-2)" }}
        >
          📷 File Field Report
        </button>

        {zone.currentRiskLevel === "low" && (
          <div className="rounded-xl p-5 text-center" style={{ background: "#F0FDF4", border: "1px solid #86EFAC", boxShadow: "var(--shadow-xs)" }}>
            <div className="text-4xl mb-2" aria-hidden>✅</div>
            <div className="font-bold" style={{ fontSize: "var(--text-base)", color: "#14532D" }}>
              Low risk — continuous monitoring active
            </div>
            <div className="mt-2" style={{ fontSize: "var(--text-sm)", color: "#166534" }}>
              AI score: {zone.aiRiskScore}/100 · {zone.predictedProbability}% slide probability (24h)
            </div>
          </div>
        )}

        {/* AI Landslide Risk Prediction */}
        <section>
          <SectionHeader icon="🤖" label="AI Landslide Risk Prediction" />
          <div className="rounded-xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", boxShadow: "var(--shadow-xs)" }}>
            <div className="flex items-end justify-between mb-3">
              <div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", marginBottom: 4 }}>AI Risk Score</div>
                <div className="font-black" style={{ fontSize: "var(--text-2xl)", color: scoreColor, lineHeight: 1 }}>
                  {zone.aiRiskScore}
                  <span className="font-normal text-sm" style={{ color: "var(--text-3)" }}>/100</span>
                </div>
              </div>
              <div className="text-right">
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", marginBottom: 4 }}>24h Slide Probability</div>
                <div className="font-black" style={{ fontSize: "var(--text-2xl)", color: scoreColor, lineHeight: 1 }}>
                  {zone.predictedProbability}
                  <span className="font-normal text-sm" style={{ color: "var(--text-3)" }}>%</span>
                </div>
              </div>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full"
                style={{ width: `${zone.aiRiskScore}%`, background: "linear-gradient(90deg,#16A34A 0%,#D97706 40%,#EA580C 68%,#DC2626 100%)", transition: "width 600ms ease" }} />
            </div>
            <div className="flex justify-between mt-1.5" style={{ fontSize: "var(--text-2xs)", color: "var(--text-3)" }}>
              <span>Low (0)</span><span>Moderate</span><span>High</span><span>Critical (100)</span>
            </div>
            <div className="mt-3 p-2 rounded-lg flex items-center gap-2"
              style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.2)", fontSize: "var(--text-xs)", color: "#78350F" }}>
              <span aria-hidden>⚠</span>
              <span>PROTOTYPE — AI model not connected. Displaying simulated prediction data only.</span>
            </div>
          </div>
        </section>

        {/* Environmental Conditions */}
        <section>
          <SectionHeader icon="🌦" label="Environmental Conditions" />
          <div className="grid grid-cols-2 gap-2">
            <MetricTile label="Rainfall" value={zone.rainfallMm} unit="mm/24h" color={rainfallColor} icon="🌧" />
            <MetricTile label="Soil Moisture" value={zone.soilMoisturePercent} unit="%" color={moistureColor} icon="💧" />
            <MetricTile label="Slope Angle" value={zone.slopeAngle} unit="°" color={slopeColor} icon="⛰" />
            <MetricTile label="Vegetation Cover" value={zone.vegetationCover} unit="%" color={vegColor} icon="🌿" />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="p-2.5 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", marginBottom: 4 }}>📐 Affected Area</div>
              <div className="font-black" style={{ fontSize: "var(--text-base)", color: "var(--text)" }}>~{zone.affectedAreaKm} km²</div>
            </div>
            <div className="p-2.5 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", marginBottom: 4 }}>👥 Population at Risk</div>
              <div className="font-black" style={{ fontSize: "var(--text-base)", color: "var(--text)" }}>
                {zone.populationAtRisk.toLocaleString()}
              </div>
            </div>
          </div>
        </section>

        {/* Active slide corridors */}
        {zone.activeSlides.length > 0 && (
          <section>
            <SectionHeader icon="⛔" label="Active Slide Corridors" />
            <div className="space-y-2">
              {zone.activeSlides.map(slide => (
                <div key={slide.id} className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: "#FFF7F7", border: "1px solid #FCA5A5", boxShadow: "var(--shadow-xs)" }}>
                  <span className="text-xl flex-shrink-0 mt-0.5" aria-hidden>⚠️</span>
                  <div>
                    <div className="font-semibold" style={{ fontSize: "var(--text-sm)", color: "#7F1D1D" }}>{slide.name}</div>
                    <div className="mt-0.5" style={{ fontSize: "var(--text-xs)", color: "#991B1B" }}>{slide.cause}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Historical data & trigger factors */}
        <section>
          <SectionHeader icon="📊" label="Historical Landslide Data" />
          <div className="rounded-xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", boxShadow: "var(--shadow-xs)" }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", marginBottom: 4 }}>Recorded Slides (Last 5 Years)</div>
                <div className="font-black" style={{ fontSize: "var(--text-2xl)", color: zone.historicalSlides > 10 ? "#DC2626" : zone.historicalSlides > 5 ? "#EA580C" : "var(--text)", lineHeight: 1 }}>
                  {zone.historicalSlides}
                  <span className="font-normal text-xs ml-1" style={{ color: "var(--text-3)" }}>events</span>
                </div>
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", textAlign: "right" }}>
                {zone.historicalSlides > 15 ? "🔴 Very High History" :
                 zone.historicalSlides > 8  ? "🟠 High History" :
                 zone.historicalSlides > 3  ? "🟡 Moderate History" : "🟢 Low History"}
              </div>
            </div>
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)", marginBottom: 8 }}>
              Trigger Factors
            </div>
            <div className="flex flex-wrap gap-1.5">
              {zone.triggerFactors.map((f, i) => (
                <span key={i} className="px-2 py-1 rounded-full font-medium"
                  style={{ fontSize: "var(--text-xs)", background: "#FEF3C7", color: "#78350F", border: "1px solid #FDE68A" }}>
                  {f}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Emergency station */}
        <section>
          <SectionHeader icon="🏥" label="Nearest Emergency Station" />
          <div className="rounded-xl p-4" style={{ background: "#F0FDF4", border: "1px solid #86EFAC", boxShadow: "var(--shadow-xs)" }}>
            <div className="font-bold leading-tight" style={{ fontSize: "var(--text-base)", color: "#14532D" }}>
              {zone.emergencyStation.name}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="p-2.5 rounded-lg" style={{ background: "white", border: "1px solid #BBF7D0" }}>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", marginBottom: 2 }}>Distance</div>
                <div className="font-bold" style={{ fontSize: "var(--text-sm)", color: "var(--text)" }}>📍 {zone.emergencyStation.distance}</div>
              </div>
              <div className="p-2.5 rounded-lg" style={{ background: "white", border: "1px solid #BBF7D0" }}>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", marginBottom: 2 }}>Contact</div>
                <a href={`tel:${zone.emergencyStation.contactNumber.replace(/-/g, "")}`}
                  className="font-bold" style={{ fontSize: "var(--text-xs)", color: "#14532D" }}>
                  📞 {zone.emergencyStation.contactNumber}
                </a>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}

// ─── Alert Simulation Panel ───────────────────────────────────────────────────

function AlertSimulationPanel({ zones, onTriggerAlert }: {
  zones: LandslideZone[]
  onTriggerAlert: (id: string, risk: RiskLevel) => void
}) {
  const [open, setOpen] = useState(false)
  const [zId, setZId] = useState("")
  const [risk, setRisk] = useState<RiskLevel>("high")
  const [sent, setSent] = useState(false)

  function trigger() {
    if (!zId) return
    onTriggerAlert(zId, risk)
    setSent(true)
    setTimeout(() => setSent(false), 3500)
  }

  return (
    <div style={{ borderTop: "1px solid var(--border)", flexShrink: 0 }}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 transition-colors min-h-[48px]"
        style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-2)", background: "transparent" }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        aria-expanded={open}>
        <span className="flex items-center gap-2">
          <span aria-hidden>⚙️</span>
          <span>Alert Simulation Panel</span>
        </span>
        <span style={{ color: "var(--text-3)", fontSize: "var(--text-xs)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 space-y-3" style={{ background: "var(--surface-2)", borderTop: "1px solid var(--border)" }}>
          <div className="p-2 rounded-lg" style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.2)", fontSize: "var(--text-xs)", color: "#78350F" }}>
            ⚠ Prototype simulation — not connected to real monitoring systems
          </div>
          <div>
            <label className="block mb-1.5" style={{ fontSize: "var(--text-xs)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)" }}>
              Select Zone
            </label>
            <select value={zId} onChange={e => setZId(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 font-medium min-h-[44px] focus:outline-none"
              style={{ fontSize: "var(--text-sm)", border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--text)", borderRadius: "var(--r-md)" }}>
              <option value="">— Choose monitoring zone —</option>
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name} — {z.state}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1.5" style={{ fontSize: "var(--text-xs)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)" }}>
              Set Risk Level
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(["low", "moderate", "high", "critical"] as RiskLevel[]).map(r => {
                const st = riskStyle(r)
                const active = risk === r
                return (
                  <button key={r} onClick={() => setRisk(r)}
                    className="px-2 py-2.5 font-bold border-2 transition-all min-h-[44px]"
                    style={{
                      borderRadius: "var(--r-md)",
                      borderColor: active ? st.marker : "var(--border)",
                      background: active ? st.markerBg : "var(--surface)",
                      color: active ? st.text : "var(--text-3)",
                      fontSize: "var(--text-sm)",
                    }}>
                    <span style={{ fontFamily: "var(--font-mono)" }} aria-hidden>{st.icon}</span>
                    {" "}{RISK_LABEL[r]}
                  </button>
                )
              })}
            </div>
          </div>
          <button onClick={trigger} disabled={!zId}
            className="w-full py-3 font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px]"
            style={{ borderRadius: "var(--r-md)", background: "var(--navy)", color: "white", fontSize: "var(--text-sm)" }}>
            ⚡ Simulate Alert
          </button>
          {sent && (
            <div className="flex items-center gap-2 p-3 font-semibold"
              style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "var(--r-md)", fontSize: "var(--text-sm)", color: "#14532D" }}>
              <span>✅</span> Alert simulated successfully
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── AI Prediction Overview (sidebar panel) ───────────────────────────────────

function AIPredictionSummary({ zones }: { zones: LandslideZone[] }) {
  const criticalCount = zones.filter(z => z.currentRiskLevel === "critical").length
  const highCount     = zones.filter(z => z.currentRiskLevel === "high").length
  const maxRainfall   = Math.max(...zones.map(z => z.rainfallMm))
  const overallRisk: RiskLevel = criticalCount > 0 ? "critical" : highCount > 0 ? "high" : "moderate"
  const s = riskStyle(overallRisk)

  return (
    <div className="flex-shrink-0 px-4 py-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
      <div style={{ fontSize: "var(--text-xs)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)", marginBottom: 8 }}>
        🤖 AI Prediction Overview
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="p-2.5 rounded-lg" style={{ background: s.markerBg, border: `1px solid ${s.border}` }}>
          <div style={{ fontSize: "var(--text-2xs)", color: s.text, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>
            Region Status
          </div>
          <div className="font-black uppercase" style={{ fontSize: "var(--text-sm)", color: s.text }}>
            {s.icon} {RISK_LABEL[overallRisk]}
          </div>
        </div>
        <div className="p-2.5 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>
            High-Risk Zones
          </div>
          <div className="font-black" style={{ fontSize: "var(--text-sm)" }}>
            <span style={{ color: "#DC2626" }}>🔴 {criticalCount}</span>
            <span style={{ color: "var(--text-3)", fontWeight: 400, fontSize: "var(--text-xs)", marginLeft: 4 }}>crit</span>
            <span style={{ marginLeft: 8, color: "#EA580C" }}>🟠 {highCount}</span>
            <span style={{ color: "var(--text-3)", fontWeight: 400, fontSize: "var(--text-xs)", marginLeft: 4 }}>high</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>
            Max Rainfall
          </div>
          <div className="font-black" style={{ fontSize: "var(--text-sm)", color: maxRainfall > 250 ? "#DC2626" : maxRainfall > 100 ? "#EA580C" : "var(--text)" }}>
            🌧 {maxRainfall}
            <span className="font-normal" style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", marginLeft: 2 }}>mm</span>
          </div>
        </div>
        <div className="p-2.5 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>
            AI Confidence
          </div>
          <div className="font-black" style={{ fontSize: "var(--text-sm)", color: "var(--text)" }}>
            🤖 87%
            <span className="font-normal" style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", marginLeft: 2 }}>(SIM)</span>
          </div>
        </div>
      </div>
      <div className="mt-2 p-1.5 rounded" style={{ background: "rgba(217,119,6,0.08)", fontSize: "var(--text-2xs)", color: "#92400E", fontFamily: "var(--font-mono)", textAlign: "center" }}>
        ⚠ PROTOTYPE — AI model not connected
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ zones, selectedId, onSelect, onTriggerAlert, stateFilter, setStateFilter }: {
  zones: LandslideZone[]
  selectedId: string | null
  onSelect: (id: string) => void
  onTriggerAlert: (id: string, risk: RiskLevel) => void
  stateFilter: string
  setStateFilter: (s: string) => void
}) {
  const states = Array.from(new Set(INITIAL_ZONES.map(z => z.state))).sort()

  const filtered = zones
    .filter(z => !stateFilter || z.state === stateFilter)
    .sort((a, b) => RISK_ORDER[a.currentRiskLevel] - RISK_ORDER[b.currentRiskLevel])

  return (
    <aside className="hidden md:flex flex-col border-r"
      style={{ width: 256, flexShrink: 0, background: "var(--surface)", borderColor: "var(--border)", overflow: "hidden" }}>

      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
        <div className="flex items-center justify-between mb-2">
          <h2 style={{ fontSize: "var(--text-xs)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)" }}>
            Zones ({filtered.length})
          </h2>
          <div style={{ fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>
            {zones.filter(z => z.currentRiskLevel === "critical").length} 🔴
            {" "}{zones.filter(z => z.currentRiskLevel === "high").length} 🟠
          </div>
        </div>
        <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
          className="w-full rounded-lg px-2.5 py-1.5"
          style={{ fontSize: "var(--text-xs)", border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--text)", borderRadius: "var(--r-sm)" }}>
          <option value="">All NER States</option>
          {states.map(st => <option key={st} value={st}>{st}</option>)}
        </select>
      </div>

      {/* AI prediction overview */}
      <AIPredictionSummary zones={zones} />

      {/* Zone list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map(z => {
          const st = riskStyle(z.currentRiskLevel)
          const isSel = z.id === selectedId
          return (
            <button key={z.id} onClick={() => onSelect(z.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors min-h-[60px] focus:outline-none"
              style={{
                borderBottom: "1px solid var(--border)",
                background: isSel ? "#EFF6FF" : "transparent",
                borderLeft: `4px solid ${isSel ? st.marker : "transparent"}`,
              }}
              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "var(--surface-2)" }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent" }}
              aria-pressed={isSel}>
              <span className="w-9 h-9 rounded-full flex items-center justify-center font-black text-white flex-shrink-0"
                style={{ background: st.marker, fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)" }}>
                {st.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate" style={{ fontSize: "var(--text-sm)", color: "var(--text)" }}>
                  {z.name}
                </div>
                <div className="truncate" style={{ fontSize: "var(--text-xs)", color: "var(--text-3)" }}>
                  {z.state}
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <span className="font-bold px-1.5 py-0.5 rounded uppercase"
                    style={{ fontSize: "var(--text-2xs)", background: st.markerBg, color: st.text }}>
                    {RISK_LABEL[z.currentRiskLevel]}
                  </span>
                  {z.immediateThreat && <span style={{ fontSize: "var(--text-xs)" }}>🚨</span>}
                </div>
              </div>
              {z.alertTime !== "—" && (
                <div style={{ fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", color: "var(--text-3)", flexShrink: 0 }}>
                  {z.alertTime}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <AlertSimulationPanel zones={zones} onTriggerAlert={onTriggerAlert} />
    </aside>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [stateFilter, setStateFilter]   = useState("")
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const [showFieldReport, setShowFieldReport] = useState(false)

  // Backend integration — falls back to INITIAL_ZONES if backend unavailable
  const { zones, setZones, source: dataSource } = useBackendZones<LandslideZone>(INITIAL_ZONES)
  const { alerts: activeAlerts } = useActiveAlerts()

  const selected = zones.find(z => z.id === selectedId) ?? null

  function handleSelect(id: string) {
    setSelectedId(prev => (prev === id ? null : id))
    setMobilePanelOpen(true)
  }

  function handleTriggerAlert(zoneId: string, risk: RiskLevel) {
    const now = new Date()
    const alertTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    const scoreMap: Record<RiskLevel, number> = { low: 20, moderate: 45, high: 74, critical: 92 }
    const probMap:  Record<RiskLevel, number> = { low: 8,  moderate: 28, high: 68, critical: 90 }
    setZones(prev => prev.map(z =>
      z.id !== zoneId ? z : {
        ...z,
        currentRiskLevel: risk,
        immediateThreat: risk === "critical",
        alertTime: risk === "low" ? "—" : alertTime,
        updatedAt: new Date().toISOString(),
        aiRiskScore: scoreMap[risk],
        predictedProbability: probMap[risk],
      }
    ))
  }

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: "var(--font-ui)" }}>

      {/* ── Header ── */}
      <header className="flex-shrink-0 flex items-center justify-between shadow-md"
        style={{ background: "var(--navy)", paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>

        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: "var(--navy-mid)" }}>⛰️</div>
          <div className="min-w-0">
            <h1 className="font-black text-white truncate" style={{ fontSize: "var(--text-lg)", lineHeight: 1.2, letterSpacing: "-0.01em" }}>
              NER Landslide Early Warning System
            </h1>
            <div className="hidden sm:block truncate" style={{ fontSize: "var(--text-xs)", color: "#93C5FD", fontWeight: 500 }}>
              AI-Based Risk Monitoring · North East India
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <span className="hidden sm:flex items-center gap-1.5 rounded-full font-black uppercase tracking-widest"
            style={{
              fontSize: "var(--text-xs)",
              border: "1.5px solid #FDE047",
              color: "#FDE047",
              background: "rgba(234,179,8,0.10)",
              padding: "5px 10px",
              animation: "pulse-ring 2.5s cubic-bezier(0.4,0,0.6,1) infinite",
            }}>
            ⚠ PROTOTYPE
          </span>
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.20)" }}>
            <div className="font-bold px-3 min-h-[38px] flex items-center"
              style={{ fontSize: "var(--text-sm)", background: "var(--navy-mid)", color: "white" }}>
              EN
            </div>
          </div>
        </div>
      </header>

      {/* Active Alerts Banner */}
      {activeAlerts.length > 0 && (
        <div style={{
          background: "#B91C1C", color: "white",
          padding: "6px 16px",
          fontSize: 12, fontWeight: 700,
          display: "flex", alignItems: "center", gap: 8,
          flexShrink: 0,
        }}>
          <span>🚨</span>
          <span>ACTIVE ALERTS: {activeAlerts.map(a => `${a.zone_name} (${a.risk_level})`).join(" · ")}</span>
        </div>
      )}

      {/* Mobile prototype strip */}
      <div className="sm:hidden flex items-center justify-center gap-2 flex-shrink-0"
        style={{ padding: "6px 16px", fontSize: "var(--text-xs)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#92400E", background: "#FEF3C7", borderBottom: "1px solid #FCD34D" }}>
        ⚠ PROTOTYPE — SIMULATED DATA · NOT FOR OPERATIONAL USE
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">

        <Sidebar
          zones={zones}
          selectedId={selectedId}
          onSelect={handleSelect}
          onTriggerAlert={handleTriggerAlert}
          stateFilter={stateFilter}
          setStateFilter={setStateFilter}
        />

        {/* Map */}
        <main className="flex-1 relative overflow-hidden">
          <ZoneMap zones={zones} selectedId={selectedId} onSelect={handleSelect} />

          {/* Mobile zone chips */}
          <div className="md:hidden absolute bottom-0 left-0 right-0"
            style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", zIndex: 500 }}>
            <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
              <p style={{ fontSize: "var(--text-xs)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)" }}>
                Monitoring Zones — tap to select
              </p>
            </div>
            <div className="flex overflow-x-auto gap-2 p-2" style={{ scrollSnapType: "x mandatory" }}>
              {[...zones].sort((a, b) => RISK_ORDER[a.currentRiskLevel] - RISK_ORDER[b.currentRiskLevel]).map(z => {
                const st = riskStyle(z.currentRiskLevel)
                const isSel = z.id === selectedId
                return (
                  <button key={z.id} onClick={() => handleSelect(z.id)}
                    className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border-2 min-h-[44px] transition-all"
                    style={{ borderColor: isSel ? st.marker : "var(--border)", background: isSel ? st.markerBg : "var(--surface)", scrollSnapAlign: "start" }}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0"
                      style={{ background: st.marker, fontSize: "var(--text-2xs)", fontFamily: "var(--font-mono)", fontWeight: 900 }}>
                      {st.icon}
                    </span>
                    <span className="whitespace-nowrap font-bold" style={{ fontSize: "var(--text-sm)", color: "var(--text)" }}>
                      {z.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </main>

        {/* Detail panel — desktop */}
        {selected && (
          <aside className="hidden md:flex flex-col border-l overflow-hidden"
            style={{ width: 320, flexShrink: 0, borderColor: "var(--border)", boxShadow: "-4px 0 12px rgba(0,0,0,0.06)" }}>
            <DetailPanel zone={selected} onClose={() => setSelectedId(null)} onFileReport={() => setShowFieldReport(true)} />
          </aside>
        )}
      </div>

      {/* Mobile detail panel overlay */}
      {selected && mobilePanelOpen && (
        <div className="md:hidden fixed inset-0 flex flex-col" style={{ zIndex: 600, background: "var(--surface)" }}>
          <DetailPanel zone={selected} onClose={() => { setMobilePanelOpen(false); setSelectedId(null) }} onFileReport={() => setShowFieldReport(true)} />
        </div>
      )}

      {/* Chat Panel — floating */}
      <ChatPanel zoneId={selectedId ?? undefined} />

      {/* Field Report Modal */}
      {showFieldReport && selected && (
        <FieldReportModal
          zoneId={selected.id}
          zoneName={selected.name}
          onClose={() => setShowFieldReport(false)}
        />
      )}

      {/* Backend source indicator */}
      {dataSource === "backend" && (
        <div style={{
          position: "fixed", bottom: 90, right: 24, zIndex: 999,
          background: "#F0FDF4", border: "1px solid #86EFAC",
          borderRadius: 6, padding: "4px 10px",
          fontSize: 10, color: "#14532D", fontWeight: 700,
          pointerEvents: "none",
        }}>
          🟢 Backend connected
        </div>
      )}
    </div>
  )
}
