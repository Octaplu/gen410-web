import React, { useState, useEffect, useRef, useCallback } from 'react'
import mqtt from 'mqtt'

const BROKER  = import.meta.env.VITE_MQTT_URL  || 'wss://YOUR-CLUSTER.s1.eu.hivemq.cloud:8884/mqtt'
const MQUSER  = import.meta.env.VITE_MQTT_USER || ''
const MQPASS  = import.meta.env.VITE_MQTT_PASS || ''

const STATE_NAME = ['IDLE','KEY WAIT','CRANKING','VERIFYING','RUNNING','STOPPING','STOP WAIT','FAULT']
const STATE_SUB  = ['Generator ready','Warming up','Starting engine','Checking output','Engine running','Shutting down','Cooling down','Start failed — check gen']
const ARC_DEG    = [-90, 0, 60, 90, 150, 210, 270, 320]
const ARC_COLOR  = ['#94a3b8','#f59e0b','#3b82f6','#8b5cf6','#10b981','#ef4444','#f97316','#dc2626']

const LOG_KEY    = 'gen410_events'
const EVENT_LABEL = { start:'▶ Started', stop:'⏹ Stopped', fault:'⚠ Fault' }
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
  const clientRef = useRef(null)

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
      c.subscribe(['gen410/status', 'gen410/relays', 'gen410/log'])
    })
    c.on('reconnect', () => setConn('connecting'))
    c.on('disconnect', () => setConn('disconnected'))
    c.on('error', () => setConn('disconnected'))

    c.on('message', (topic, payload) => {
      try {
        const d = JSON.parse(payload.toString())
        if (topic === 'gen410/status') {
          setState(d.state ?? 0)
          setPower(d.power ?? false)
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

    return () => c.end(true)
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

  const arcDeg   = ARC_DEG[state]   ?? -90
  const arcColor = ARC_COLOR[state] ?? '#94a3b8'

  const connDot = conn === 'connected' ? 'bg-emerald-400' : conn === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'
  const connLabel = conn === 'connected' ? 'Live' : conn === 'connecting' ? 'Connecting…' : 'Offline'

  return (
    <div className="app">
      {/* ── Connection bar ─────────────────────────────────────────────────── */}
      <header className="topbar">
        <span className="brand">GEN<b>410</b></span>
        <div className="conn-pill">
          <span className={`dot-live ${connDot}`} />
          <span>{connLabel}</span>
        </div>
        <button className="cog-btn" onClick={() => setPanel(p => !p)} title="Settings">⚙</button>
      </header>

      {/* ── Radial HMI ─────────────────────────────────────────────────────── */}
      <main className="stage">
        <div className="hud">
          <div className="ring r1" />
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
          {[['R1','KEY — ignition key on'],['R2','START — crank motor'],['R3','STOP — engine stop'],['R4','SPARE']].map(([r,d]) => (
            <div className="info-row" key={r}><span className="relay-tag">{r}</span><span>{d}</span></div>
          ))}
        </section>
      </aside>

      {panel && <div className="overlay" onClick={() => setPanel(false)} />}
    </div>
  )
}
