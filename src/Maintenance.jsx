import React, { useState, useMemo } from 'react'
import { ClipboardList, BarChart2, Check, ChevronDown, ChevronUp, Settings2 } from 'lucide-react'

// ── Maintenance tasks — 410 kVA, 12+ years, known faults: battery contact + overheating ──
const TASKS = [
  // Daily
  { id:'d1', cat:'Daily', pri:'crit', label:'Battery terminals — visual check for corrosion, looseness, white/green powder' },
  { id:'d2', cat:'Daily', pri:'high', label:'Coolant level — check radiator/header tank, top up if low' },
  { id:'d3', cat:'Daily', pri:'high', label:'Engine oil level — check dipstick, top up if needed' },
  { id:'d4', cat:'Daily', pri:'high', label:'Fuel level — check tank, drain water from fuel/water separator' },
  { id:'d5', cat:'Daily', pri:'med',  label:'Leak check — inspect ground under set for oil, coolant, fuel' },
  { id:'d6', cat:'Daily', pri:'med',  label:'Unusual noise or vibration — note and investigate' },
  { id:'d7', cat:'Daily', pri:'med',  label:'Control panel — check fault alarms, battery charging voltage reading' },

  // Weekly
  { id:'w1', cat:'Weekly', pri:'crit', label:'Run on load minimum 30 min — exercises battery, prevents wet-stacking' },
  { id:'w2', cat:'Weekly', pri:'high', label:'Battery voltage at rest: 12V system → 12.6–12.8 V | 24V system → 25.2–25.6 V' },
  { id:'w3', cat:'Weekly', pri:'high', label:'Battery electrolyte level (non-sealed only) — top up with distilled water' },
  { id:'w4', cat:'Weekly', pri:'med',  label:'Radiator fins/louvers — clean dust, leaves, insects' },
  { id:'w5', cat:'Weekly', pri:'med',  label:'Drive belts (alternator/fan) — check tension and cracking' },

  // Monthly
  { id:'m1', cat:'Monthly', pri:'crit', label:'PRIORITY: Remove & clean battery terminals — wire brush + anti-corrosion grease before refitting' },
  { id:'m2', cat:'Monthly', pri:'crit', label:'PRIORITY: Torque battery terminal bolts to spec — loose torque is #1 no-start cause' },
  { id:'m3', cat:'Monthly', pri:'crit', label:'Battery load-test — many faults show good resting voltage but fail under crank load' },
  { id:'m4', cat:'Monthly', pri:'crit', label:'Inspect & clean earth/ground strap (engine block → chassis) — corroded ground mimics battery fault' },
  { id:'m5', cat:'Monthly', pri:'high', label:'Battery charger/trickle charger output check while set is idle' },
  { id:'m6', cat:'Monthly', pri:'high', label:'Air filter restriction — check indicator, clean or replace if needed' },
  { id:'m7', cat:'Monthly', pri:'high', label:'All hoses (coolant, fuel, turbo) — check for swelling, cracking, softness' },
  { id:'m8', cat:'Monthly', pri:'high', label:'Radiator core — flow test to detect internal blockage/scale buildup' },
  { id:'m9', cat:'Monthly', pri:'med',  label:'Exhaust system — check for leaks, backpressure, damage' },
  { id:'m10',cat:'Monthly', pri:'med',  label:'Alternator charging output check under load' },

  // Quarterly / 250 h
  { id:'q1', cat:'Quarterly / 250 h', pri:'crit', label:'Engine oil and oil filter change — interval shortened from 500h due to engine age' },
  { id:'q2', cat:'Quarterly / 250 h', pri:'crit', label:'Fuel filter(s) replacement' },
  { id:'q3', cat:'Quarterly / 250 h', pri:'crit', label:'Battery full capacity test — not just voltage; batteries >3–4 years fail under load' },
  { id:'q4', cat:'Quarterly / 250 h', pri:'high', label:'Belt tensions check and adjustment — replace if glazed or cracked' },
  { id:'q5', cat:'Quarterly / 250 h', pri:'high', label:'Coolant concentration — refractometer check, top up with correct pre-mixed coolant (never plain water)' },
  { id:'q6', cat:'Quarterly / 250 h', pri:'high', label:'Radiator clean — low-pressure air or water (NOT high pressure — bends fins)' },
  { id:'q7', cat:'Quarterly / 250 h', pri:'med',  label:'Turbocharger — play, oil leaks, boost pressure check' },

  // Semi-Annual / 500 h
  { id:'s1', cat:'Semi-Annual / 500 h', pri:'crit', label:'Full coolant flush and refill — scale buildup inside block/radiator is most common overheating cause in old units' },
  { id:'s2', cat:'Semi-Annual / 500 h', pri:'crit', label:'Replace thermostat preventively — stuck-closed = classic overheating cause; cheap part, high impact' },
  { id:'s3', cat:'Semi-Annual / 500 h', pri:'high', label:'Water pump — inspect for leaks and bearing play' },
  { id:'s4', cat:'Semi-Annual / 500 h', pri:'high', label:'Radiator mounting rubbers/isolators — cracked mounts cause vibration that loosens battery and electrical terminals' },
  { id:'s5', cat:'Semi-Annual / 500 h', pri:'high', label:'Wiring harness insulation — check for cracking/chafing, especially near heat sources' },
  { id:'s6', cat:'Semi-Annual / 500 h', pri:'med',  label:'Load bank test — check for wet-stacking and carbon buildup if gen rarely runs at full load' },
  { id:'s7', cat:'Semi-Annual / 500 h', pri:'med',  label:'Governor/AVR calibration check' },

  // Annual / 1000 h
  { id:'a1', cat:'Annual / 1000 h', pri:'crit', label:'Full injector service/calibration — poor combustion → overheating + power loss' },
  { id:'a2', cat:'Annual / 1000 h', pri:'crit', label:'Valve clearance check and adjustment' },
  { id:'a3', cat:'Annual / 1000 h', pri:'crit', label:'Full cooling system: flush, new coolant, replace all hoses if >2 years old, pressure test' },
  { id:'a4', cat:'Annual / 1000 h', pri:'crit', label:'Replace battery if >3 years old — do regardless of test result given this unit\'s fault history' },
  { id:'a5', cat:'Annual / 1000 h', pri:'crit', label:'Replace battery cables if insulation is cracked — corrosion often travels inside the cable' },
  { id:'a6', cat:'Annual / 1000 h', pri:'high', label:'Alternator brushes and bearings inspection' },
  { id:'a7', cat:'Annual / 1000 h', pri:'high', label:'Full electrical panel — tighten ALL lugs and terminals (12 years of thermal cycling loosens everything)' },
  { id:'a8', cat:'Annual / 1000 h', pri:'high', label:'Engine mounts inspection — worn mounts increase vibration-related electrical faults' },
  { id:'a9', cat:'Annual / 1000 h', pri:'high', label:'Radiator core professional cleaning/rodding if airflow test shows restriction' },
]

const CAT_DAYS = {
  'Daily': 1, 'Weekly': 7, 'Monthly': 30,
  'Quarterly / 250 h': 91, 'Semi-Annual / 500 h': 182, 'Annual / 1000 h': 365,
}
const CAT_WARN = {
  'Daily': 0.5, 'Weekly': 2, 'Monthly': 7,
  'Quarterly / 250 h': 14, 'Semi-Annual / 500 h': 21, 'Annual / 1000 h': 30,
}
const CATS = ['Daily','Weekly','Monthly','Quarterly / 250 h','Semi-Annual / 500 h','Annual / 1000 h']

function fmtDur(s) {
  if (!s || s <= 0) return '—'
  if (s < 60)   return s + 's'
  if (s < 3600) return (s / 60).toFixed(1) + 'm'
  return (s / 3600).toFixed(2) + 'h'
}
function fmtDate(ts)  { return ts ? new Date(ts).toLocaleString() : '—' }
function daysSince(iso) { return iso ? (Date.now() - new Date(iso).getTime()) / 86400000 : null }

export function getOverdueCount() {
  let done = {}
  try { done = JSON.parse(localStorage.getItem('gen410_maint') || '{}') } catch {}
  return TASKS.filter(t => {
    const ds = daysSince(done[t.id])
    return ds === null || ds > CAT_DAYS[t.cat]
  }).length
}

export default function Maintenance({ events }) {
  const [tab,         setTab]         = useState('schedule')
  const [done,        setDone]        = useState(() => { try { return JSON.parse(localStorage.getItem('gen410_maint') || '{}') } catch { return {} } })
  const [openCat,     setOpenCat]     = useState('Daily')
  const [baselined,   setBaselined]   = useState(false)

  const markDone = (id) => {
    const next = { ...done, [id]: new Date().toISOString() }
    setDone(next)
    localStorage.setItem('gen410_maint', JSON.stringify(next))
  }

  const baselineAll = () => {
    const now = new Date().toISOString()
    const next = {}
    TASKS.forEach(t => { next[t.id] = now })
    setDone(next)
    localStorage.setItem('gen410_maint', JSON.stringify(next))
    setBaselined(true)
  }

  const getStatus = (task) => {
    const ds = daysSince(done[task.id])
    const interval = CAT_DAYS[task.cat]
    const warn     = CAT_WARN[task.cat]
    if (ds === null || ds > interval)          return 'overdue'
    if (ds > interval - warn)                  return 'due'
    return 'ok'
  }

  // Build run log
  const runLog = useMemo(() => {
    const rows = []
    for (const e of events) {
      if (e.type === 'stop' && e.dur) {
        rows.push({ startTs: e.ts - e.dur * 1000, stopTs: e.ts, dur: e.dur, reason: 'Mains Restored', type: 'stop', mainsAfter: null })
      } else if (e.type === 'fault') {
        rows.push({ startTs: e.ts - (e.dur || 0) * 1000, stopTs: e.ts, dur: e.dur || 0, reason: 'FAULT — Failed to Start', type: 'fault', mainsAfter: null })
      } else if (e.type === 'stall') {
        rows.push({ startTs: e.ts - (e.dur || 0) * 1000, stopTs: e.ts, dur: e.dur || 0, reason: 'Engine Stalled', type: 'stall', mainsAfter: null })
      }
    }
    // Compute mains-present gap between consecutive stop events
    for (let i = 0; i < rows.length - 1; i++) {
      if (rows[i].type === 'stop' && rows[i + 1].type === 'stop') {
        const gap = Math.round((rows[i + 1].startTs - rows[i].stopTs) / 1000)
        if (gap > 0) rows[i].mainsAfter = gap
      }
    }
    return [...rows].reverse()
  }, [events])

  const totalRunSec  = useMemo(() => events.filter(e => e.type === 'stop' && e.dur).reduce((a, e) => a + e.dur, 0), [events])
  const runCount     = useMemo(() => events.filter(e => e.type === 'stop' && e.dur).length, [events])
  const faultCount   = useMemo(() => events.filter(e => e.type === 'fault').length, [events])
  const overdueCount = useMemo(() => TASKS.filter(t => getStatus(t) === 'overdue').length, [done])
  const dueCount     = useMemo(() => TASKS.filter(t => getStatus(t) === 'due').length, [done])

  return (
    <div className="maint-page">

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      <div className="maint-cards">
        <div className="mcard mc-blue"><div className="mc-val">{fmtDur(totalRunSec)}</div><div className="mc-lbl">Total Run Time</div></div>
        <div className="mcard mc-green"><div className="mc-val">{runCount}</div><div className="mc-lbl">Generator Starts</div></div>
        <div className="mcard mc-red"><div className="mc-val">{faultCount}</div><div className="mc-lbl">Fault Events</div></div>
        <div className={`mcard ${overdueCount > 0 ? 'mc-red' : dueCount > 0 ? 'mc-amber' : 'mc-green'}`}>
          <div className="mc-val">{overdueCount + dueCount}</div>
          <div className="mc-lbl">Maintenance Alerts</div>
        </div>
      </div>

      {/* ── Inner tabs ────────────────────────────────────────────────────── */}
      <div className="maint-tabs-inner">
        <button className={`mit ${tab === 'schedule' ? 'mit-on' : ''}`} onClick={() => setTab('schedule')}>
          <ClipboardList size={16} /> Maintenance Schedule
        </button>
        <button className={`mit ${tab === 'log'      ? 'mit-on' : ''}`} onClick={() => setTab('log')}>
          <BarChart2 size={16} /> Run &amp; Fault History
        </button>
      </div>

      {/* ── Maintenance Schedule ──────────────────────────────────────────── */}
      {tab === 'schedule' && (
        <div className="sched-wrap">
          {Object.values(done).length === 0 && !baselined && (
            <div className="baseline-banner">
              <p>First time here? All tasks show as <b>overdue</b> until marked done. If maintenance is already up to date, click below to set today as baseline.</p>
              <button className="baseline-btn" onClick={baselineAll}>
                <Check size={16} /> Set Today as Maintenance Baseline
              </button>
            </div>
          )}

          {CATS.map(cat => {
            const tasks       = TASKS.filter(t => t.cat === cat)
            const catOverdue  = tasks.filter(t => getStatus(t) === 'overdue').length
            const catDue      = tasks.filter(t => getStatus(t) === 'due').length
            const isOpen      = openCat === cat

            return (
              <div key={cat} className="mcat">
                <button
                  className={`mcat-hd ${catOverdue > 0 ? 'mcat-hd-red' : catDue > 0 ? 'mcat-hd-amb' : 'mcat-hd-ok'}`}
                  onClick={() => setOpenCat(isOpen ? null : cat)}
                >
                  <span className="mcat-title">{cat}</span>
                  <div className="mcat-badges">
                    {catOverdue > 0 && <span className="mbdg mbdg-red">{catOverdue} OVERDUE</span>}
                    {catDue  > 0 && <span className="mbdg mbdg-amb">{catDue} DUE SOON</span>}
                    {catOverdue === 0 && catDue === 0 && <span className="mbdg mbdg-ok">ALL OK</span>}
                    <span className="chevron">{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="mcat-body">
                    {tasks.map(task => {
                      const status      = getStatus(task)
                      const lastDate    = done[task.id] ? new Date(done[task.id]) : null
                      const interval    = CAT_DAYS[task.cat]
                      const nextDue     = lastDate ? new Date(lastDate.getTime() + interval * 86400000) : null

                      return (
                        <div key={task.id} className={`mtask mtask-${status} ${task.pri === 'crit' ? 'mtask-crit' : ''}`}>
                          <div className="mtask-body">
                            <div className="mtask-lbl">{task.label}</div>
                            <div className="mtask-dates">
                              <span>Last: {lastDate ? lastDate.toLocaleDateString() : <span className="never">Never done</span>}</span>
                              {nextDue && <span>Next due: <b>{nextDue.toLocaleDateString()}</b></span>}
                            </div>
                          </div>
                          <div className="mtask-right">
                            <span className={`mst mst-${status}`}>{status === 'overdue' ? 'OVERDUE' : status === 'due' ? 'DUE SOON' : 'OK'}</span>
                            <button className="mdone-btn" onClick={() => markDone(task.id)}>Done</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          <div className="spare-parts-box">
            <h3><Settings2 size={18} /> Recommended Spare Parts (On-Site)</h3>
            <ul>
              <li>1 spare battery (matched to existing spec)</li>
              <li>Battery terminals, clamps, dielectric grease, anti-corrosion compound</li>
              <li>Set of coolant/radiator hoses</li>
              <li>Thermostat (low cost — replace preventively)</li>
              <li>Fan belt(s)</li>
              <li>Oil filter, fuel filter, air filter (at least 2 of each)</li>
              <li>Coolant — correct type, pre-mixed (NOT plain water)</li>
              <li>Engine oil — correct grade and quantity</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── Run & Fault History ───────────────────────────────────────────── */}
      {tab === 'log' && (
        <div className="runlog-wrap">
          {runLog.length === 0
            ? <div className="no-log">No run history yet. Events will appear here as the generator operates.</div>
            : <>
              <div className="rlog-table-scroll">
                <table className="rlog-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Start Date &amp; Time</th>
                      <th>Stop Date &amp; Time</th>
                      <th>Run Duration</th>
                      <th>Stop Reason</th>
                      <th>Mains-Present After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runLog.map((row, i) => (
                      <tr key={i} className={`rrow rrow-${row.type}`}>
                        <td className="rrow-n">{runLog.length - i}</td>
                        <td>{fmtDate(row.startTs)}</td>
                        <td>{fmtDate(row.stopTs)}</td>
                        <td><b>{fmtDur(row.dur)}</b></td>
                        <td><span className={`rtag rtag-${row.type}`}>{row.reason}</span></td>
                        <td className={row.mainsAfter ? '' : 'dim'}>{row.mainsAfter ? fmtDur(row.mainsAfter) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rlog-summary">
                <div className="rsum"><span>Total runs</span><b>{runCount}</b></div>
                <div className="rsum"><span>Total run time</span><b>{fmtDur(totalRunSec)}</b></div>
                <div className="rsum"><span>Average run</span><b>{runCount > 0 ? fmtDur(Math.round(totalRunSec / runCount)) : '—'}</b></div>
                <div className="rsum"><span>Fault events</span><b style={{ color: faultCount > 0 ? '#f87171' : '#4ade80' }}>{faultCount}</b></div>
              </div>

              <p className="rlog-note">
                <b>Mains-Present After</b> = time between generator shutting down (mains restored) and the next outage start.
                A <span style={{color:'#f87171'}}>FAULT</span> row means the generator failed to start after a mains outage.
              </p>
            </>
          }
        </div>
      )}
    </div>
  )
}
