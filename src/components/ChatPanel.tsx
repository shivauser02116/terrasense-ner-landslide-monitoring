import { useState, useRef, useEffect } from "react"
import { api } from "../lib/api"

interface Message {
  id: string
  role: "user" | "assistant"
  text: string
  timestamp: Date
}

const WELCOME_EN = "Hello! I am the NER Landslide Early Warning Assistant (PROTOTYPE). I can explain risk scores, environmental factors, and provide basic emergency guidance. For actual emergencies, call 112 immediately."
const WELCOME_KN = "ನಮಸ್ಕಾರ! ನಾನು NER ಭೂಕುಸಿತ ಎಚ್ಚರಿಕೆ ಸಹಾಯಕ (ಪ್ರೋಟೋಟೈಪ್). ತುರ್ತು ಪರಿಸ್ಥಿತಿಗಳಲ್ಲಿ ತಕ್ಷಣ 112 ಗೆ ಕರೆ ಮಾಡಿ."

export default function ChatPanel({ zoneId }: { zoneId?: string }) {
  const [open, setOpen] = useState(false)
  const [lang, setLang] = useState<"en" | "kn">("en")
  const [messages, setMessages] = useState<Message[]>([{
    id: "welcome",
    role: "assistant",
    text: WELCOME_EN,
    timestamp: new Date(),
  }])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Update welcome message when language changes
  useEffect(() => {
    setMessages([{
      id: "welcome",
      role: "assistant",
      text: lang === "kn" ? WELCOME_KN : WELCOME_EN,
      timestamp: new Date(),
    }])
  }, [lang])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput("")
    const userMsg: Message = { id: Date.now() + "u", role: "user", text, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    const result = await api.chat({ message: text, language: lang, zone_id: zoneId })
    const assistantText = result?.response ?? (lang === "kn"
      ? "ಕ್ಷಮಿಸಿ, ಸಹಾಯ ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ. ತುರ್ತು ಪರಿಸ್ಥಿತಿಗೆ 112 ಗೆ ಕರೆ ಮಾಡಿ."
      : "Service unavailable. For emergencies, call 112.")
    setMessages(prev => [...prev, { id: Date.now() + "a", role: "assistant", text: assistantText, timestamp: new Date() }])
    setLoading(false)
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? "Close assistant" : "Open emergency assistant"}
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 1000,
          width: 56, height: 56, borderRadius: "50%",
          background: "#1B2E4B", color: "white", border: "none",
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          cursor: "pointer", fontSize: 24,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 150ms",
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.1)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
      >
        {open ? "✕" : "🤖"}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: "fixed", right: 0, top: 0, bottom: 0,
          width: 380, zIndex: 999,
          background: "white",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
          display: "flex", flexDirection: "column",
          fontFamily: "var(--font-ui, system-ui)",
        }}>
          {/* Header */}
          <div style={{ padding: "12px 16px", background: "#1B2E4B", color: "white", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>🤖 Emergency AI Assistant</span>
              <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", color: "white", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ fontSize: 10, color: "#FDE047", fontWeight: 700, letterSpacing: "0.08em", marginTop: 2 }}>⚠ PROTOTYPE — NOT FOR OPERATIONAL USE</div>
            {/* Language toggle */}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {(["en", "kn"] as const).map(l => (
                <button key={l} onClick={() => setLang(l)} style={{
                  padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  borderRadius: 4, border: "1.5px solid rgba(255,255,255,0.4)",
                  background: lang === l ? "rgba(255,255,255,0.2)" : "transparent",
                  color: "white",
                }}>
                  {l === "en" ? "EN" : "ಕನ್ನಡ"}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map(msg => (
              <div key={msg.id} style={{
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
              }}>
                <div style={{
                  padding: "8px 12px",
                  borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  background: msg.role === "user" ? "#1B2E4B" : "#F3F4F6",
                  color: msg.role === "user" ? "white" : "#1A2235",
                  fontSize: 13, lineHeight: 1.5,
                }}>
                  {msg.text}
                </div>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2, textAlign: msg.role === "user" ? "right" : "left" }}>
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: "flex-start", background: "#F3F4F6", padding: "8px 16px", borderRadius: "12px 12px 12px 2px", fontSize: 18, color: "#6B7280" }}>
                ···
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Disclaimer */}
          <div style={{ padding: "6px 12px", background: "#FEF3C7", fontSize: 10, color: "#78350F", flexShrink: 0, textAlign: "center" }}>
            AI responses are informational only. Always verify with official sources. Call 112 for emergencies.
          </div>

          {/* Input */}
          <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid #E5E7EB", flexShrink: 0 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder={lang === "kn" ? "ಸಂದೇಶ ಬರೆಯಿರಿ..." : "Ask about risk, evacuation, alerts..."}
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB",
                fontSize: 13, outline: "none", fontFamily: "inherit",
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "none",
                background: "#1B2E4B", color: "white", fontWeight: 700, fontSize: 13,
                cursor: "pointer", opacity: !input.trim() || loading ? 0.5 : 1,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  )
}
