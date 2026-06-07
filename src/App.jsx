import React, { useState, useEffect, useRef, useCallback } from 'react'
import mqtt from 'mqtt'

const BROKER  = import.meta.env.VITE_MQTT_URL  || 'wss://YOUR-CLUSTER.s1.eu.hivemq.cloud:8884/mqtt'
const MQUSER  = import.meta.env.VITE_MQTT_USER || ''
const MQPASS  = import.meta.env.VITE_MQTT_PASS || ''
const TG_TOKEN  = '8892720061:AAHSLtbb3Uy_Dmn2-PbHKYL3TFcOK3NDM0M'
const TG_CHAT   = '2119949792'
const TG_API    = `https://api.telegram.org/bot${TG_TOKEN}`

const STATE_NAME = ['IDLE','KEY WAIT','CRANKING','VERIFYING','RUNNING','STOPPING','STOP WAIT','FAULT','RESTARTING']
const STATE_SUB  = ['Generator ready','Warming up','Starting engine','Checking output','Engine running','Shutting down','Cooling down','Start failed — check gen','Generator stalled — retrying']
const ARC_DEG    = [-90, 0, 60, 90, 150, 210, 270, 320, 340]
const ARC_COLOR  = ['#94a3b8','#f59e0b','#3b82f6','#8b5cf6','#10b981','#ef4444','#f97316','#dc2626','#f59e0b']

const LOG_KEY    = 'gen410_events'
const EVENT_LABEL = { start:'▶ Started', stop:'⏹ Stopped', fault:'⚠ Fault', stall:'⚡ Stalled' }
function loadEvents() { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || [] } catch { return [] } }
function saveEvents(ev) { try { localStorage.setItem(LOG_KEY, JSON.stringify(ev.slice(-500))) } catch {} }
function fmtDur(s) { if (!s) return '—'; if (s < 60) return s+'s'; if (s < 3600) return (s/60).toFixed(1)+'m'; return (s/3600).toFixed(2)+'h' }
function fmtTs(ts) { return new Date(ts).toLocaleString() }

function fmt(ms) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return s + 's'
  if (s < 3600) return (s / 60).toFixed(1) + 'm'
  return (s / 3600).toFixed(1) + 'h'
}

export default function App() {
  const [conn,     setConn]     = useState('disconnected')
  const [state,    setState]    = useState(0)
  const [power,    setPower]    = useState(false)
  const [elapsed,  setElapsed]  = useState(0)
  const [uptime,   setUptime]   = useState(0)
  const [relays,   setRelays]   = useState({ r1:false, r2:false, r3:false, r4:false })
  const [manual,   setManual]   = useState(false)
  const [panel,    setPanel]    = useState(false)
  const [timings,  setTimings]  = useState({ keyDelay:42, crankDur:3, stopDur:5, keyOffDly:5 })
  const [saveMsg,  setSaveMsg]  = useState('')
  const [events,   setEvents]   = useState(() => loadEvents())
  const [sense,     setSense]     = useState(false)
  const [espOnline, setEspOnline] = useState(false)
  const [splash,    setSplash]    = useState(true)
  const [splashOut, setSplashOut] = useState(false)
  const [contactMsg, setContactMsg] = useState('')
  const [contactSent, setContactSent] = useState(false)
  const [darkMode,  setDarkMode]  = useState(() => localStorage.getItem('gen410_dark') === '1')
  const lastSeenRef = useRef(0)
  const clientRef   = useRef(null)

  useEffect(() => {
    setConn('connecting')
    const c = mqtt.connect(BROKER, {
      username: MQUSER,
      password: MQPASS,
      clientId: `gen410-web-${Math.random().toString(16).slice(3)}`,
      reconnectPeriod: 4000,
      keepalive: 30,
      rejectUnauthorized: false,
    })
    clientRef.current = c

    c.on('connect', () => {
      setConn('connected')
      c.subscribe(['gen410/status', 'gen410/relays', 'gen410/log', 'gen410/lwt'])
    })
    c.on('reconnect', () => setConn('connecting'))
    c.on('disconnect', () => setConn('disconnected'))
    c.on('error', () => setConn('disconnected'))

    c.on('message', (topic, payload) => {
      if (topic === 'gen410/lwt') {
        setEspOnline(payload.toString() === 'online')
        return
      }
      try {
        const d = JSON.parse(payload.toString())
        if (topic === 'gen410/status') {
          lastSeenRef.current = Date.now()
          setState(d.state ?? 0)
          setPower(d.power ?? false)
          setSense(d.sense ?? false)
          setElapsed(d.elapsed ?? 0)
          setUptime(d.uptime ?? 0)
        } else if (topic === 'gen410/relays') {
          setRelays({ r1: d.r1, r2: d.r2, r3: d.r3, r4: d.r4 })
          setManual(d.manual ?? false)
          if (d.kd)  setTimings(t => ({ ...t, keyDelay: d.kd, crankDur: d.cd, stopDur: d.sd, keyOffDly: d.kod }))
        } else if (topic === 'gen410/log') {
          const entry = { ...d, ts: Date.now() }
          setEvents(prev => {
            const next = [...prev, entry]
            saveEvents(next)
            return next
          })
        }
      } catch (_) {}
    })

    const watchdog = setInterval(() => {
      if (lastSeenRef.current && Date.now() - lastSeenRef.current > 6000) setEspOnline(false)
    }, 3000)

    return () => { c.end(true); clearInterval(watchdog) }
  }, [])

  const pub = useCallback((topic, payload) => {
    clientRef.current?.publish(topic, JSON.stringify(payload))
  }, [])

  const toggleRelay = (n) => {
    if (!manual) return
    pub('gen410/cmd/relay', { relay: n, state: relays[`r${n}`] ? 0 : 1 })
  }

  const toggleMode = () => pub('gen410/cmd/mode', { manual: manual ? 0 : 1 })

  const saveTimings = (e) => {
    e.preventDefault()
    pub('gen410/cmd/save', timings)
    setSaveMsg('SENT TO DEVICE')
    setTimeout(() => setSaveMsg(''), 3000)
  }

  useEffect(() => {
    const t1 = setTimeout(() => setSplashOut(true), 2600)
    const t2 = setTimeout(() => setSplash(false), 3100)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('gen410_dark', darkMode ? '1' : '0')
  }, [darkMode])

  const sendContact = async () => {
    const msg = contactMsg.trim()
    if (!msg) return
    try {
      const text = `🚨 <b>EMERGENCY — Gen410 Web App</b>\n\n${msg}\n\n<i>Sent from Gen410 contact form</i>`
      const r = await fetch(`${TG_API}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' })
      })
      const d = await r.json()
      if (d.ok) {
        await fetch(`${TG_API}/pinChatMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: TG_CHAT, message_id: d.result.message_id })
        })
        setContactSent(true)
        setContactMsg('')
        setTimeout(() => setContactSent(false), 5000)
      }
    } catch (err) { console.error('[Contact]', err) }
  }

  const arcDeg   = ARC_DEG[state]   ?? -90
  const arcColor = ARC_COLOR[state] ?? '#94a3b8'

  const connDot = conn === 'connected' ? 'bg-emerald-400' : conn === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'
  const connLabel = conn === 'connected' ? 'Live' : conn === 'connecting' ? 'Connecting…' : 'Offline'

  return (
    <div className="app">
      {splash && (
        <div className={`splash ${splashOut ? 'splash-out' : ''}`}>
          <div className="splash-ring sr1" />
          <div className="splash-ring sr2" />
          <div className="splash-ring sr3" />
          <div className="splash-content">
            <div className="splash-logo">GEN<b>410</b></div>
            <div className="splash-tagline">child of <b>FouNdEr</b></div>
            <div className="splash-dots"><span /><span /><span /></div>
          </div>
        </div>
      )}
      {/* ── Connection bar ─────────────────────────────────────────────────── */}
      <header className="topbar">
        <span className="brand">GEN<b>410</b></span>
        <div className="conn-pill">
          <span className={`dot-live ${connDot}`} />
          <span>{connLabel}</span>
        </div>
        <div className={`esp-pill ${espOnline ? 'esp-online' : 'esp-offline'}`}>
          <span className={`dot-live ${espOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span>ESP32 {espOnline ? 'ON' : 'OFF'}</span>
        </div>
        <button className="dark-btn" onClick={() => setDarkMode(d => !d)} title="Toggle dark mode">
          {darkMode ? '☀️' : '🌙'}
        </button>
        <button className="cog-btn" onClick={() => setPanel(p => !p)} title="Settings">⚙</button>
      </header>

      {/* ── Radial HMI ─────────────────────────────────────────────────────── */}
      <main className="stage">
        <div className="hud">
          <div className={`ring r1 ${state === 4 ? 'glow-green' : state === 7 ? 'glow-red' : state === 8 ? 'glow-amber' : ''}`} />
          <div className="ring r2" />

          {/* arc needle */}
          <div className="arc" style={{ transform: `rotate(${arcDeg}deg)`, borderTopColor: arcColor }} />

          {/* relay buttons */}
          {[
            { n:1, label:'KEY',   pos:'top',    color:'key'   },
            { n:2, label:'START', pos:'right',  color:'start' },
            { n:3, label:'STOP',  pos:'bottom', color:'stop'  },
            { n:4, label:'SPARE', pos:'left',   color:'spare' },
          ].map(({ n, label, pos, color }) => (
            <button
              key={n}
              className={`rbtn rbtn-${pos} ${relays[`r${n}`] ? `on-${color}` : ''} ${!manual ? 'locked' : ''}`}
              onClick={() => toggleRelay(n)}
            >
              <span className="rl">{label}</span>
              <span className="ri">R{n}</span>
            </button>
          ))}

          {/* info chips */}
          <div className="chip chip-pwr">
            MAINS
            <b className={power ? 'text-emerald' : 'text-red'}>{power ? 'PRESENT' : 'ABSENT'}</b>
          </div>
          <div className="chip chip-upt">UPTIME<b>{fmt(uptime)}</b></div>
          <div className="chip chip-ela">IN STATE<b>{fmt(elapsed)}</b></div>
          <div className={`chip chip-sen ${sense ? 'chip-sen-on' : 'chip-sen-off'}`}>
            GEN OUT
            <b className={sense ? 'text-emerald' : 'text-red'}>{sense ? 'GOOD' : 'NONE'}</b>
          </div>

          {/* core */}
          <div className="core">
            <div className="sn">{STATE_NAME[state] ?? '—'}</div>
            <div className="ss">{STATE_SUB[state]  ?? ''}</div>
            <div className={`badge ${state === 7 ? 'badge-fault' : manual ? 'badge-manual' : 'badge-auto'}`}>
              {state === 7 ? 'FAULT' : manual ? 'MANUAL' : 'AUTO'}
            </div>
            <button className="mode-btn" onClick={toggleMode}>
              {manual ? 'SWITCH TO AUTO' : 'MANUAL MODE'}
            </button>
            {state === 7 && (
              <button className="fault-reset-btn" onClick={() => pub('gen410/cmd/reset', {})}>
                RESET FAULT
              </button>
            )}
          </div>
        </div>
      </main>

      {/* ── Settings panel ─────────────────────────────────────────────────── */}
      <aside className={`panel ${panel ? 'open' : ''}`}>
        <div className="panel-head">
          <span>CONFIG</span>
          <button onClick={() => setPanel(false)}>✕</button>
        </div>

        <section className="panel-section">
          <h4 className="section-label">Timing Settings</h4>
          <form onSubmit={saveTimings}>
            {[
              { key:'keyDelay',  label:'Key Delay',    unit:'s',   min:1,   max:300 },
              { key:'crankDur',  label:'Crank Time',   unit:'s',   min:1,   max:30  },
              { key:'stopDur',   label:'Stop Hold',    unit:'s',   min:1,   max:30  },
              { key:'keyOffDly', label:'Cooldown',     unit:'min', min:0,   max:60, step:0.5 },
            ].map(({ key, label, unit, min, max, step }) => (
              <div className="field" key={key}>
                <label>{label}<span className="unit">{unit}</span></label>
                <input
                  type="number" min={min} max={max} step={step ?? 1}
                  value={timings[key]}
                  onChange={e => setTimings(t => ({ ...t, [key]: parseFloat(e.target.value) }))}
                />
              </div>
            ))}
            <button type="submit" className="save-btn">SAVE TO DEVICE</button>
            {saveMsg && <p className="save-msg">{saveMsg}</p>}
          </form>
        </section>

        <section className="panel-section">
          <h4 className="section-label">Connection</h4>
          <div className="info-row"><span>Broker</span><code>{BROKER.replace('wss://','').split(':')[0]}</code></div>
          <div className="info-row"><span>Status</span><span className={conn === 'connected' ? 'text-emerald' : 'text-red'}>{connLabel}</span></div>
          <div className="info-row"><span>State</span><span>{STATE_NAME[state]}</span></div>
        </section>

        <section className="panel-section">
          <h4 className="section-label">Event Log</h4>
          {events.length === 0
            ? <p className="no-log">No events yet</p>
            : <>
              <div className="log-table-wrap">
                <table className="log-table">
                  <thead><tr><th>Time</th><th>Event</th><th>Duration</th></tr></thead>
                  <tbody>
                    {[...events].reverse().slice(0, 50).map((e, i) => (
                      <tr key={i} className={`log-row-${e.type}`}>
                        <td>{fmtTs(e.ts)}</td>
                        <td>{EVENT_LABEL[e.type] ?? e.type}</td>
                        <td>{fmtDur(e.dur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(() => {
                const runs = events.filter(e => e.type === 'stop' && e.dur)
                const totalSec = runs.reduce((a, e) => a + (e.dur || 0), 0)
                const now = new Date()
                const monthRuns = runs.filter(e => {
                  const d = new Date(e.ts)
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
                })
                const monthSec = monthRuns.reduce((a, e) => a + (e.dur || 0), 0)
                return (
                  <div className="log-summary">
                    <div className="info-row"><span>This month</span><b>{monthRuns.length} run{monthRuns.length !== 1 ? 's' : ''} · {fmtDur(monthSec)}</b></div>
                    <div className="info-row"><span>All time</span><b>{runs.length} run{runs.length !== 1 ? 's' : ''} · {fmtDur(totalSec)}</b></div>
                    <button className="clear-log-btn" onClick={() => { setEvents([]); localStorage.removeItem(LOG_KEY) }}>Clear Log</button>
                  </div>
                )
              })()}
            </>
          }
        </section>

        <section className="panel-section">
          <h4 className="section-label">Relay Map</h4>
          {[['R1','KEY — ignition key on'],['R2','START — crank motor'],['R3','STOP — engine stop'],['R4','ALARM — fault signal']].map(([r,d]) => (
            <div className="info-row" key={r}><span className="relay-tag">{r}</span><span>{d}</span></div>
          ))}
        </section>

        <section className="panel-section">
          <h4 className="section-label">Contact / Emergency</h4>
          <div className="contact-grid">
            <a className="contact-link" href="tel:682248162">
              <span className="contact-icon">&#128222;</span>
              <span>682 248 162</span>
            </a>
            <a className="contact-link contact-email" href="mailto:Njinuwoezekiel@gmail.com">
              <span className="contact-icon">&#9993;</span>
              <span>Njinuwoezekiel@gmail.com</span>
            </a>
            <a className="contact-link contact-wa" href="https://wa.me/682248162" target="_blank" rel="noreferrer">
              <span className="contact-icon">&#128172;</span>
              <span>WhatsApp</span>
            </a>
          </div>
          <div className="msg-field">
            <textarea
              className="msg-input"
              placeholder="Type emergency message…"
              rows={3}
              value={contactMsg}
              onChange={e => setContactMsg(e.target.value)}
            />
            <button
              className="msg-send-btn"
              onClick={sendContact}
              disabled={!contactMsg.trim() || contactSent}
            >
              {contactSent ? '✓ Sent & Pinned on Telegram' : '🚨 Send Emergency Message'}
            </button>
          </div>
        </section>
      </aside>

      {panel && <div className="overlay" onClick={() => setPanel(false)} />}
    </div>
  )
}
