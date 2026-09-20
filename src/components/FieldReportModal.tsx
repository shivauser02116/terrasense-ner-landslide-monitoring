import { useState, useRef } from "react"
import { api } from "../lib/api"

const REPORT_TYPES = [
  { value: "landslide", label: "🏔 Active Landslide" },
  { value: "crack", label: "⚡ Ground Crack / Fissure" },
  { value: "waterlogging", label: "💧 Waterlogging / Flooding" },
  { value: "road_damage", label: "🚧 Road Damage / Blockage" },
  { value: "debris", label: "🪨 Debris Flow" },
  { value: "other", label: "📋 Other Observation" },
]

export default function FieldReportModal({
  zoneId,
  zoneName,
  onClose,
}: {
  zoneId: string
  zoneName: string
  onClose: () => void
}) {
  const [reportType, setReportType] = useState("")
  const [description, setDescription] = useState("")
  const [lat, setLat] = useState("")
  const [lng, setLng] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<"success" | "error" | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function getLocation() {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude.toFixed(6))
        setLng(pos.coords.longitude.toFixed(6))
        setGeoLoading(false)
      },
      () => setGeoLoading(false)
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!reportType || !description || !lat || !lng) return
    setSubmitting(true)

    const clientReportId = typeof window !== "undefined" && window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `rep-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

    const formData = new FormData()
    formData.append("zone_id", zoneId)
    formData.append("lat", lat)
    formData.append("lng", lng)
    formData.append("report_type", reportType)
    formData.append("description", description)
    formData.append("report_id", clientReportId)
    files.forEach(f => formData.append("files", f))

    const res = await api.createFieldReport(formData)
    setResult(res ? "success" : "error")
    setSubmitting(false)
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 800,
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "white", borderRadius: 12, width: "100%", maxWidth: 480,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        fontFamily: "var(--font-ui, system-ui)",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>📷 File Field Report</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{zoneName}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: "#6B7280" }}>✕</button>
        </div>

        {result === "success" ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 12, color: "#14532D" }}>Report submitted successfully</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginTop: 6 }}>Stored in backend — thank you for the report.</div>
            <button onClick={onClose} style={{ marginTop: 16, padding: "10px 24px", borderRadius: 8, background: "#1B2E4B", color: "white", border: "none", fontWeight: 700, cursor: "pointer" }}>Close</button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Report type */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", display: "block", marginBottom: 6 }}>Report Type *</label>
              <select value={reportType} onChange={e => setReportType(e.target.value)} required
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}>
                <option value="">— Select type —</option>
                {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* Description */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", display: "block", marginBottom: 6 }}>Description *</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={3}
                placeholder="Describe what you observed..."
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
            </div>

            {/* Coordinates */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", display: "block", marginBottom: 6 }}>Location *</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={lat} onChange={e => setLat(e.target.value)} required placeholder="Latitude" type="number" step="any"
                  style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }} />
                <input value={lng} onChange={e => setLng(e.target.value)} required placeholder="Longitude" type="number" step="any"
                  style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }} />
                <button type="button" onClick={getLocation} title="Use GPS" disabled={geoLoading}
                  style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #D1D5DB", background: "white", cursor: "pointer", fontSize: 16 }}>📍</button>
              </div>
            </div>

            {/* Media upload */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", display: "block", marginBottom: 6 }}>Photos / Videos (optional)</label>
              <div style={{ border: "2px dashed #D1D5DB", borderRadius: 8, padding: 16, textAlign: "center", cursor: "pointer" }}
                onClick={() => fileRef.current?.click()}>
                <div style={{ fontSize: 24 }}>📎</div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                  {files.length > 0 ? `${files.length} file(s) selected` : "Click to add photos or videos (max 50 MB each)"}
                </div>
                <input ref={fileRef} type="file" multiple accept="image/*,video/*" style={{ display: "none" }}
                  onChange={e => setFiles(Array.from(e.target.files || []))} />
              </div>
            </div>

            {result === "error" && (
              <div style={{ padding: 10, borderRadius: 8, background: "#FEE2E2", color: "#7F1D1D", fontSize: 13 }}>
                ❌ Submission failed. Backend may be offline. Try again later.
              </div>
            )}

            <button type="submit" disabled={submitting || !reportType || !description || !lat || !lng}
              style={{
                padding: "12px", borderRadius: 8, background: "#1B2E4B", color: "white",
                fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer",
                opacity: submitting ? 0.7 : 1,
              }}>
              {submitting ? "Submitting..." : "📤 Submit Report"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
