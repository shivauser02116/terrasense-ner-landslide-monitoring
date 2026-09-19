/**
 * Polls the backend for active alerts every 60 seconds.
 * Returns an empty array if backend is unavailable.
 */
import { useState, useEffect } from "react"
import { api, type Alert } from "../lib/api"

const POLL_INTERVAL_MS = 60_000

export function useActiveAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  async function fetchAlerts() {
    const data = await api.getAlerts()
    if (data) {
      setAlerts(data)
      setLastFetched(new Date())
    }
  }

  useEffect(() => {
    fetchAlerts()
    const interval = setInterval(fetchAlerts, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return { alerts, lastFetched, refetch: fetchAlerts }
}
