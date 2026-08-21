import { useState, useEffect, useCallback } from "react";
import {
  Gauge, FileText, ChevronRight, Fuel, Truck,
  Check, X, MapPin, AlertTriangle, Radio, Package,
  ArrowRight, Eye, EyeOff, LogOut
} from "lucide-react";
// ---------------------------------------------------------------------------
// ROUTES — depot dashboard (Cato Ridge / Richards Bay operators)
// Wired to the live Routes backend — no more hardcoded seed data.
// ---------------------------------------------------------------------------
const API_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) ||
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_URL) ||
  "https://routes-backend-git-631549944748.europe-west1.run.app";

async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}
const getDepots = () => api("/api/depots");
const getOrders = () => api("/api/orders");
const patchOrderStatus = (id, status) => api(`/api/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
const completeOrder = (id, actualLitres) => api(`/api/orders/${id}/complete`, { method: "PATCH", body: JSON.stringify({ actualLitres }) });
const patchDepotLevel = (id, levelLitres) => api(`/api/depots/${id}/level`, { method: "PATCH", body: JSON.stringify({ levelLitres }) });
const scheduleDelivery = (depotId, litres, eta) => api("/api/deliveries", { method: "POST", body: JSON.stringify({ depotId, litres, eta }) });
const receiveDelivery = (deliveryId, litresReceived) => api(`/api/deliveries/${deliveryId}/receive`, { method: "PATCH", body: JSON.stringify({ litresReceived }) });
const cancelDelivery = (deliveryId) => api(`/api/deliveries/${deliveryId}`, { method: "DELETE" });
const postDipReading = (depotId, dipLitres) => api("/api/dip-readings", { method: "POST", body: JSON.stringify({ depotId, dipLitres }) });
const getDipReadings = (depotId) => api(`/api/dip-readings?depotId=${depotId}`);

const INK = "#FAF8F4";
const SURFACE = "#FFFFFF";
const SURFACE_2 = "#F4F0E8";
const LINE = "#E6E0D4";
const AMBER = "#E8722C";
const STEEL = "#3E7690";
const CREAM = "#26221B";
const MUTED = "#847C6C";
const GREEN = "#4C8C3C";
const RED = "#C1443C";

function pct(depot) {
  return depot.capacity_litres > 0 ? Math.round((Number(depot.level_litres) / Number(depot.capacity_litres)) * 100) : 0;
}
function GaugeDial({ pct: p, size = 88, color = AMBER }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const sweep = 0.75;
  const dash = c * sweep * (p / 100);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(135deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={LINE}
          strokeWidth={stroke} strokeDasharray={`${c * sweep} ${c}`} strokeLinecap="round" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
          strokeWidth={stroke} strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray .6s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: CREAM, fontFamily: "'Oswald', sans-serif" }}>{p}%</span>
      </div>
    </div>
  );
}
function StatusPill({ status }) {
  const map = {
    "Pending": { bg: "rgba(232,114,44,.12)", fg: AMBER },
    "Open": { bg: "rgba(232,114,44,.12)", fg: AMBER },
    "Approved": { bg: "rgba(76,140,60,.14)", fg: GREEN },
    "Confirmed": { bg: "rgba(62,118,144,.14)", fg: STEEL },
    "Completed": { bg: "rgba(76,140,60,.14)", fg: GREEN },
    "Available": { bg: "rgba(76,140,60,.14)", fg: GREEN },
    "En route": { bg: "rgba(62,118,144,.14)", fg: STEEL },
    "Loading": { bg: "rgba(232,114,44,.12)", fg: AMBER },
    "Cancelled": { bg: "rgba(193,68,60,.14)", fg: RED },
    "Rejected": { bg: "rgba(193,68,60,.14)", fg: RED },
  };
  const s = map[status] || { bg: LINE, fg: MUTED };
  return (
    <span style={{ background: s.bg, color: s.fg, fontSize: 11, fontWeight: 700,
      padding: "3px 9px", borderRadius: 3, letterSpacing: .3, textTransform: "uppercase" }}>
      {status}
    </span>
  );
}
function Card({ children, style }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 4, padding: 20, ...style }}>
      {children}
    </div>
  );
}
function SectionLabel({ children, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
        color: MUTED, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 18, height: 2, background: AMBER, display: "inline-block" }} />
        {children}
      </div>
      {right}
    </div>
  );
}
const inputStyle = {
  width: "100%", background: "#F4F0E8", border: `1px solid ${LINE}`, borderRadius: 4,
  color: CREAM, padding: "10px 12px", fontSize: 14, boxSizing: "border-box",
};
const btnPrimary = {
  background: AMBER, color: "#FFFFFF", border: "none", borderRadius: 4,
  padding: "9px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
  display: "flex", alignItems: "center", gap: 6,
};

// ---- Login (no real backend auth yet — see code comment below) --------------
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  function submit(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Enter your email and password to continue.");
      return;
    }
    setError("");
    setLoading(true);
    // TEMPORARY: there is no real login/auth endpoint on the backend yet.
    // This just fakes a short delay and lets anyone in — replace with a real
    // POST /api/login call once auth is built.
    setTimeout(() => {
      setLoading(false);
      onLogin({ email });
    }, 500);
  }
  return (
    <div style={{
      fontFamily: "'Inter', sans-serif", minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      position: "relative", overflow: "hidden",
      background: `
        radial-gradient(circle at 18% 20%, rgba(232,114,44,.22) 0%, transparent 45%),
        radial-gradient(circle at 85% 80%, rgba(62,118,144,.18) 0%, transparent 50%),
        linear-gradient(160deg, #1D1A15 0%, #26221B 55%, #1A1712 100%)
      `,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.06 }}>
        <defs>
          <pattern id="routeLines" width="140" height="140" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
            <line x1="0" y1="70" x2="140" y2="70" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="14 10" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#routeLines)" />
      </svg>
      <div style={{
        position: "absolute", width: 480, height: 480, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(232,114,44,.25) 0%, transparent 70%)",
        filter: "blur(10px)", zIndex: 0,
      }} />
      <div style={{ width: 380, maxWidth: "100%", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 28 }}>
          <div style={{ width: 34, height: 34, background: AMBER, borderRadius: 4, display: "flex",
            alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(232,114,44,.4)" }}>
            <Fuel size={18} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ fontFamily: "'Oswald', sans-serif", color: "#FFFFFF", fontSize: 18, fontWeight: 700, letterSpacing: .5 }}>ROUTES</div>
            <div style={{ color: "rgba(255,255,255,.55)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Diesel depots</div>
          </div>
        </div>
        <Card style={{ padding: 28, boxShadow: "0 20px 50px rgba(0,0,0,.35)" }}>
          <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, color: CREAM, margin: 0, fontWeight: 600, textAlign: "center" }}>
            Depot login
          </h1>
          <p style={{ color: MUTED, fontSize: 13, marginTop: 6, marginBottom: 22, textAlign: "center" }}>
            Sign in to manage orders, tanks and deliveries.
          </p>
          {error && (
            <div style={{ background: "rgba(193,68,60,.08)", border: `1px solid ${RED}`, borderRadius: 4,
              padding: "10px 14px", color: RED, fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <SectionLabel>Email</SectionLabel>
              <input type="email" placeholder="you@routes.co.za" value={email}
                onChange={(e) => setEmail(e.target.value)} style={inputStyle}
                onKeyDown={(e) => e.key === "Enter" && submit(e)} />
            </div>
            <div>
              <SectionLabel>Password</SectionLabel>
              <div style={{ position: "relative" }}>
                <input type={showPassword ? "text" : "password"} placeholder="••••••••" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 40 }}
                  onKeyDown={(e) => e.key === "Enter" && submit(e)} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "transparent", border: "none", cursor: "pointer", color: MUTED,
                  display: "flex", alignItems: "center",
                }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <a href="#" style={{ color: STEEL, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                Forgot password?
              </a>
            </div>
            <button type="button" onClick={submit} disabled={loading} style={{
              background: AMBER, color: "#FFFFFF", border: "none", borderRadius: 4,
              padding: "12px 0", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              {loading ? "Signing in..." : "Log in"}
              {!loading && <ChevronRight size={16} />}
            </button>
          </div>
        </Card>
        <p style={{ color: "rgba(255,255,255,.55)", fontSize: 12, textAlign: "center", marginTop: 20 }}>
          Not a depot operator? <a href="#" style={{ color: AMBER, fontWeight: 600, textDecoration: "none" }}>Contact Routes head office</a>
        </p>
      </div>
    </div>
  );
}

// ---- Overview -----------------------------------------------------------
function Overview({ queue, depots }) {
  const pending = queue.filter(o => o.status === "Open").length;
  const fuelledToday = queue.filter(o => o.status === "Completed").length;
  const totalLitresQueued = queue.filter(o => o.status !== "Completed").reduce((s, o) => s + Number(o.litres_approved), 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 28, color: CREAM, margin: 0, fontWeight: 600 }}>Depot operations</h1>
        <p style={{ color: MUTED, fontSize: 14, marginTop: 6 }}>Cato Ridge & Richards Bay · live status</p>
      </div>
      <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <Card style={{ padding: 16 }}>
          <div style={{ color: MUTED, fontSize: 12 }}>Pending approval</div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 24, color: AMBER, marginTop: 6, fontWeight: 600 }}>{pending}</div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ color: MUTED, fontSize: 12 }}>Litres queued</div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 24, color: CREAM, marginTop: 6, fontWeight: 600 }}>{totalLitresQueued.toLocaleString()}</div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ color: MUTED, fontSize: 12 }}>Fuelled today</div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 24, color: GREEN, marginTop: 6, fontWeight: 600 }}>{fuelledToday}</div>
        </Card>
      </div>
      <Card>
        <SectionLabel>Tank levels</SectionLabel>
        <div className="depot-fuel-row" style={{ display: "flex", gap: 32 }}>
          {depots.map((d) => {
            const p = pct(d);
            return (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}>
                <GaugeDial pct={p} color={p < 45 ? RED : AMBER} />
                <div>
                  <div style={{ color: CREAM, fontWeight: 600, fontSize: 15 }}>{d.name}</div>
                  <div style={{ color: MUTED, fontSize: 12, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <MapPin size={12} /> {d.region}
                  </div>
                  <div style={{ color: MUTED, fontSize: 12, marginTop: 8 }}>
                    {Number(d.level_litres).toLocaleString()} L / {Number(d.capacity_litres).toLocaleString()} L
                  </div>
                  {p < 45 && (
                    <div style={{ color: RED, fontSize: 11, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <AlertTriangle size={11} /> Below reorder threshold
                    </div>
                  )}
                  {d.incoming_delivery && (
                    <div style={{ color: GREEN, fontSize: 11, marginTop: 4, display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                      <Truck size={11} /> {Number(d.incoming_delivery.litres).toLocaleString()} L on the way
                      {d.incoming_delivery.eta && ` · ETA ${new Date(d.incoming_delivery.eta).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ---- Order queue / arrivals board ----------------------------------------
function OrderQueue({ queue, refresh }) {
  const [filter, setFilter] = useState("All");
  const [fuellingId, setFuellingId] = useState(null);
  const [actualLitres, setActualLitres] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const filters = ["All", "Open", "Confirmed", "Completed"];
  const visible = filter === "All" ? queue : queue.filter(o => o.status === filter);

  async function advance(id, next) {
    setBusy(true);
    setError("");
    try {
      await patchOrderStatus(id, next);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function startFuelling(order) {
    setFuellingId(order.id);
    setActualLitres(String(order.litres_approved));
  }
  async function confirmFuelled(order) {
    const litres = Number(actualLitres);
    if (litres <= 0) return;
    setBusy(true);
    setError("");
    try {
      await completeOrder(order.id, litres);
      await refresh();
      setFuellingId(null);
      setActualLitres("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, color: CREAM, margin: 0, fontWeight: 600 }}>Order queue</h1>
        <p style={{ color: MUTED, fontSize: 14, marginTop: 6 }}>Approve incoming trucks and confirm fuelling as they arrive at the depot.</p>
      </div>
      {error && (
        <div style={{ background: "rgba(193,68,60,.08)", border: `1px solid ${RED}`, borderRadius: 4,
          padding: "10px 14px", color: RED, fontSize: 12.5, fontWeight: 600 }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "8px 14px", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer",
            background: filter === f ? "rgba(232,114,44,.10)" : "transparent",
            border: `1px solid ${filter === f ? AMBER : LINE}`,
            color: filter === f ? AMBER : CREAM,
          }}>
            {f}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {visible.map((o) => (
          <Card key={o.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 4, background: SURFACE_2,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Fuel size={18} color={AMBER} />
                </div>
                <div>
                  <div style={{ color: CREAM, fontSize: 14, fontWeight: 700 }}>{o.order_number} · {o.depot_name}</div>
                  <div style={{ color: MUTED, fontSize: 12, marginTop: 3 }}>
                    {Number(o.litres_approved).toLocaleString()} L approved {o.product} · {new Date(o.created_at).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                  <div style={{ color: MUTED, fontSize: 12, marginTop: 3, display: "flex", gap: 12 }}>
                    <span><Truck size={11} style={{ verticalAlign: -1, marginRight: 4 }} />{o.vehicle_reg}</span>
                    <span>Driver: {o.driver_name}</span>
                  </div>
                  {o.status === "Completed" && o.litres_actual != null && (
                    <div style={{ color: GREEN, fontSize: 12, marginTop: 3 }}>
                      {Number(o.litres_actual).toLocaleString()} L actually fuelled
                    </div>
                  )}
                </div>
              </div>
              <StatusPill status={o.status} />
            </div>
            {o.status !== "Completed" && (
              <div style={{ marginTop: 14, borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
                {o.status === "Open" && (
                  <button disabled={busy} onClick={() => advance(o.id, "Confirmed")} style={btnPrimary}>
                    <Check size={13} /> Confirm order
                  </button>
                )}
                {o.status === "Confirmed" && fuellingId !== o.id && (
                  <button disabled={busy} onClick={() => startFuelling(o)} style={btnPrimary}>
                    <ArrowRight size={13} /> Mark as fuelled
                  </button>
                )}
                {o.status === "Confirmed" && fuellingId === o.id && (
                  <div style={{ background: SURFACE_2, border: `1px solid ${LINE}`, borderRadius: 4,
                    padding: 14, display: "flex", alignItems: "flex-end", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>Actual litres dispensed</div>
                      <input type="number" min={0} max={o.litres_approved} value={actualLitres}
                        onChange={(e) => setActualLitres(e.target.value)} style={inputStyle} />
                    </div>
                    <button disabled={busy} onClick={() => confirmFuelled(o)} style={btnPrimary}>
                      <Check size={13} /> Confirm
                    </button>
                    <button disabled={busy} onClick={() => setFuellingId(null)} style={{
                      background: "transparent", color: MUTED, border: `1px solid ${LINE}`, borderRadius: 4,
                      padding: "9px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    }}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
        {visible.length === 0 && (
          <div style={{ color: MUTED, fontSize: 13, padding: 24, textAlign: "center" }}>No orders in this view.</div>
        )}
      </div>
    </div>
  );
}

// ---- Tank management -------------------------------------------------------
function TankManagement({ depots, refresh }) {
  const [receivingId, setReceivingId] = useState(null);
  const [deliveryLitres, setDeliveryLitres] = useState("");
  const [schedulingId, setSchedulingId] = useState(null);
  const [scheduleLitres, setScheduleLitres] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [overrideValues, setOverrideValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function startReceiving(id) {
    setReceivingId(id);
    setDeliveryLitres("");
  }
  async function confirmDelivery(depot) {
    const litres = Number(deliveryLitres);
    if (litres <= 0) return;
    setBusy(true);
    setError("");
    try {
      // Unscheduled walk-in delivery: create it and mark received in the same step.
      const created = await scheduleDelivery(depot.id, litres, null);
      await receiveDelivery(created.id, litres);
      await refresh();
      setReceivingId(null);
      setDeliveryLitres("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function startScheduling(depot) {
    setSchedulingId(depot.id);
    setScheduleLitres(depot.incoming_delivery ? String(depot.incoming_delivery.litres) : "");
    setScheduleDate("");
    setScheduleTime("");
  }
  async function saveSchedule(depot) {
    const litres = Number(scheduleLitres);
    if (litres <= 0 || !scheduleDate) return;
    setBusy(true);
    setError("");
    try {
      const eta = new Date(`${scheduleDate}T${scheduleTime || "00:00"}`).toISOString();
      if (depot.incoming_delivery) {
        await cancelDelivery(depot.incoming_delivery.id);
      }
      await scheduleDelivery(depot.id, litres, eta);
      await refresh();
      setSchedulingId(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function clearSchedule(depot) {
    if (!depot.incoming_delivery) return;
    setBusy(true);
    setError("");
    try {
      await cancelDelivery(depot.incoming_delivery.id);
      await refresh();
      setSchedulingId(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveOverride(depot) {
    const pctVal = Number(overrideValues[depot.id]);
    if (pctVal < 0 || pctVal > 100) return;
    setBusy(true);
    setError("");
    try {
      const litres = Math.round((pctVal / 100) * Number(depot.capacity_litres));
      await patchDepotLevel(depot.id, litres);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, color: CREAM, margin: 0, fontWeight: 600 }}>Tank monitoring</h1>
        <p style={{ color: MUTED, fontSize: 14, marginTop: 6 }}>Manual reading entry today — live telemetry integration in build.</p>
      </div>
      {error && (
        <div style={{ background: "rgba(193,68,60,.08)", border: `1px solid ${RED}`, borderRadius: 4,
          padding: "10px 14px", color: RED, fontSize: 12.5, fontWeight: 600 }}>
          {error}
        </div>
      )}
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {depots.map((d) => {
          const p = pct(d);
          const currentLitres = Number(d.level_litres);
          const roomLeft = Number(d.capacity_litres) - currentLitres;
          const overrideVal = overrideValues[d.id] ?? p;
          return (
            <Card key={d.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <GaugeDial pct={p} color={p < 45 ? RED : AMBER} size={80} />
                  <div>
                    <div style={{ color: CREAM, fontWeight: 700, fontSize: 15 }}>{d.name}</div>
                    <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{d.region}</div>
                    <div style={{ color: MUTED, fontSize: 12, marginTop: 8 }}>
                      {currentLitres.toLocaleString()} L / {Number(d.capacity_litres).toLocaleString()} L
                    </div>
                    {d.address && (
                      <div style={{ color: STEEL, fontSize: 11.5, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                        <MapPin size={11} /> {d.address}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {d.incoming_delivery && schedulingId !== d.id && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                  <div style={{ color: GREEN, fontSize: 11.5, display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                    <Truck size={12} /> {Number(d.incoming_delivery.litres).toLocaleString()} L on the way
                    {d.incoming_delivery.eta && ` · ETA ${new Date(d.incoming_delivery.eta).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}`}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button disabled={busy} onClick={() => startScheduling(d)} style={{
                      background: "transparent", border: "none", color: MUTED, fontSize: 11, fontWeight: 600,
                      cursor: "pointer", textDecoration: "underline",
                    }}>
                      Edit
                    </button>
                    <button disabled={busy} onClick={() => clearSchedule(d)} style={{
                      background: "transparent", border: "none", color: RED, fontSize: 11, fontWeight: 600,
                      cursor: "pointer", textDecoration: "underline",
                    }}>
                      Clear
                    </button>
                  </div>
                </div>
              )}
              {schedulingId === d.id ? (
                <div style={{ marginTop: 10, background: SURFACE_2, border: `1px solid ${LINE}`, borderRadius: 4, padding: 14,
                  display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>Litres expected</div>
                    <input type="number" min={1} value={scheduleLitres}
                      onChange={(e) => setScheduleLitres(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>Date</div>
                      <input type="date" value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>Time (optional)</div>
                      <input type="time" value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button disabled={busy} onClick={() => saveSchedule(d)} style={{
                      background: AMBER, color: "#FFFFFF", border: "none", borderRadius: 4,
                      padding: "9px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}>
                      Save
                    </button>
                    <button disabled={busy} onClick={() => setSchedulingId(null)} style={{
                      background: "transparent", color: MUTED, border: `1px solid ${LINE}`, borderRadius: 4,
                      padding: "9px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : !d.incoming_delivery && (
                <button disabled={busy} onClick={() => startScheduling(d)} style={{
                  marginTop: 10, background: "transparent", border: "none", color: STEEL,
                  fontSize: 11.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                }}>
                  <Truck size={12} /> Schedule an incoming delivery
                </button>
              )}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${LINE}` }}>
                <SectionLabel>Receive delivery</SectionLabel>
                {receivingId === d.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <input type="number" min={1} max={roomLeft} placeholder={`Up to ${roomLeft.toLocaleString()} L room left`}
                        value={deliveryLitres} onChange={(e) => setDeliveryLitres(e.target.value)} style={inputStyle} />
                      {Number(deliveryLitres) > roomLeft && (
                        <div style={{ color: RED, fontSize: 11.5, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                          <AlertTriangle size={12} /> Exceeds remaining tank capacity — will be capped at {roomLeft.toLocaleString()} L
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button disabled={busy} onClick={() => confirmDelivery(d)} style={{
                        background: AMBER, color: "#FFFFFF", border: "none", borderRadius: 4,
                        padding: "9px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer",
                      }}>
                        Confirm delivery
                      </button>
                      <button disabled={busy} onClick={() => setReceivingId(null)} style={{
                        background: "transparent", color: MUTED, border: `1px solid ${LINE}`, borderRadius: 4,
                        padding: "9px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer",
                      }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button disabled={busy} onClick={() => startReceiving(d.id)} style={{
                    background: "transparent", border: `1px solid ${LINE}`, color: CREAM,
                    borderRadius: 4, padding: "9px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <Package size={13} /> Add fuel received
                  </button>
                )}
              </div>
              <div style={{ marginTop: 16 }}>
                <SectionLabel right={
                  <button disabled={busy} onClick={() => saveOverride(d)} style={{
                    background: "transparent", border: `1px solid ${LINE}`, color: CREAM,
                    borderRadius: 4, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  }}>
                    Save
                  </button>
                }>
                  Manual reading override
                </SectionLabel>
                <input type="range" min={0} max={100} value={overrideVal}
                  onChange={(e) => setOverrideValues(prev => ({ ...prev, [d.id]: e.target.value }))}
                  style={{ width: "100%", accentColor: AMBER }} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ---- Reconciliation ---------------------------------------------------------
function Reconciliation({ depots }) {
  const [dipInputs, setDipInputs] = useState({});
  const [results, setResults] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submitDip(depot) {
    const dip = Number(dipInputs[depot.id]);
    if (dip < 0) return;
    setBusy(true);
    setError("");
    try {
      const result = await postDipReading(depot.id, dip);
      setResults(prev => ({ ...prev, [depot.id]: result }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, color: CREAM, margin: 0, fontWeight: 600 }}>Daily reconciliation</h1>
        <p style={{ color: MUTED, fontSize: 14, marginTop: 6 }}>
          Compares what the system expects each tank to hold against a physical dip reading — the difference flags loss, theft, or meter drift early.
        </p>
      </div>
      {error && (
        <div style={{ background: "rgba(193,68,60,.08)", border: `1px solid ${RED}`, borderRadius: 4,
          padding: "10px 14px", color: RED, fontSize: 12.5, fontWeight: 600 }}>
          {error}
        </div>
      )}
      {depots.map((tank) => {
        const result = results[tank.id];
        const expectedClosing = Number(tank.level_litres);
        const variance = result ? Number(result.variance_litres) : null;
        return (
          <Card key={tank.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <Package size={18} color={AMBER} />
              <div>
                <div style={{ color: CREAM, fontWeight: 700, fontSize: 15 }}>{tank.name}</div>
                <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{tank.region} · {new Date().toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}</div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: MUTED, fontSize: 13 }}>Expected closing stock (system, live)</span>
              <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, color: STEEL, fontWeight: 700 }}>
                {expectedClosing.toLocaleString()} L
              </span>
            </div>
            <div style={{ marginTop: 14, background: SURFACE_2, border: `1px solid ${LINE}`, borderRadius: 4, padding: 14 }}>
              <div style={{ color: MUTED, fontSize: 11, marginBottom: 6 }}>Physical dip reading (L)</div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <input type="number" min={0} placeholder="Enter measured tank level"
                  value={dipInputs[tank.id] ?? ""}
                  onChange={(e) => setDipInputs(prev => ({ ...prev, [tank.id]: e.target.value }))}
                  style={{ flex: 1, background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 4,
                    color: CREAM, padding: "10px 12px", fontSize: 14, boxSizing: "border-box" }} />
                <button disabled={busy} onClick={() => submitDip(tank)} style={{
                  background: AMBER, color: "#FFFFFF", border: "none", borderRadius: 4,
                  padding: "10px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer",
                }}>
                  Submit
                </button>
              </div>
              {variance !== null && (
                <div style={{
                  marginTop: 10, display: "flex", alignItems: "center", gap: 6,
                  color: Math.abs(variance) < 10 ? GREEN : RED, fontSize: 13, fontWeight: 700,
                }}>
                  {Math.abs(variance) < 10
                    ? <><Check size={14} /> Matches — variance of {variance.toFixed(0)} L is within tolerance</>
                    : <><AlertTriangle size={14} /> Variance of {variance > 0 ? "+" : ""}{variance.toFixed(0)} L — {variance < 0 ? "possible loss, leak or theft" : "unexpectedly high — recheck the dip"}</>}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ---- App shell --------------------------------------------------------------
function DepotApp({ onLogout }) {
  const [tab, setTab] = useState("overview");
  const [depots, setDepots] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadAll = useCallback(async () => {
    try {
      const [depotsData, ordersData] = await Promise.all([getDepots(), getOrders()]);
      setDepots(depotsData);
      setQueue(ordersData);
      setLoadError("");
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const nav = [
    { id: "overview", label: "Overview", icon: Gauge },
    { id: "queue", label: "Order queue", icon: Package },
    { id: "tanks", label: "Tank monitoring", icon: Radio },
    { id: "reconciliation", label: "Reconciliation", icon: FileText },
  ];

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: INK, color: MUTED, fontFamily: "'Inter', sans-serif" }}>Loading depot data…</div>;
  }
  if (loadError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: INK, fontFamily: "'Inter', sans-serif", padding: 20 }}>
        <Card style={{ maxWidth: 420 }}>
          <div style={{ color: RED, fontWeight: 700, marginBottom: 8 }}>Couldn't load depot data</div>
          <div style={{ color: MUTED, fontSize: 13 }}>{loadError}</div>
          <button onClick={loadAll} style={{ ...btnPrimary, marginTop: 14 }}>Retry</button>
        </Card>
      </div>
    );
  }

  const pendingCount = queue.filter(o => o.status === "Open").length;

  return (
    <div className="app-shell" style={{ fontFamily: "'Inter', sans-serif", background: INK, minHeight: "100vh", display: "flex" }}>
      <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        .app-shell { flex-direction: row; }
        .grid-3 { grid-template-columns: repeat(3, 1fr); }
        .grid-2 { grid-template-columns: 1fr 1fr; }
        .bottom-nav { display: none; }
        @media (max-width: 860px) {
          .app-shell { flex-direction: column; padding-bottom: 64px; }
          .sidebar { display: none !important; }
          .bottom-nav {
            display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 40;
            background: #FFFFFF; border-top: 1px solid #E6E0D4;
            justify-content: space-around; align-items: center; padding: 8px 4px;
          }
          .main-content { padding: 20px 16px !important; }
          .grid-3 { grid-template-columns: 1fr !important; }
          .grid-2 { grid-template-columns: 1fr !important; }
          .depot-fuel-row { flex-direction: column !important; }
        }
      `}</style>
      <div className="sidebar" style={{ width: 232, borderRight: `1px solid ${LINE}`, padding: "24px 16px", display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px" }}>
          <div style={{ width: 30, height: 30, background: AMBER, borderRadius: 4, display: "flex",
            alignItems: "center", justifyContent: "center" }}>
            <Fuel size={16} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ fontFamily: "'Oswald', sans-serif", color: CREAM, fontSize: 16, fontWeight: 700, letterSpacing: .5 }}>ROUTES</div>
            <div style={{ color: MUTED, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Diesel depots</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {nav.map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 4,
              background: tab === n.id ? "rgba(232,114,44,.10)" : "transparent",
              border: "none", cursor: "pointer", textAlign: "left",
              color: tab === n.id ? AMBER : MUTED, fontSize: 13, fontWeight: 600,
            }}>
              <n.icon size={16} />
              {n.label}
              {n.id === "queue" && pendingCount > 0 && (
                <span style={{ marginLeft: "auto", background: AMBER, color: "#FFFFFF", fontSize: 10,
                  fontWeight: 700, borderRadius: 10, padding: "1px 6px" }}>
                  {pendingCount}
                </span>
              )}
              {tab === n.id && n.id !== "queue" && <ChevronRight size={13} style={{ marginLeft: "auto" }} />}
            </button>
          ))}
        </div>
        <div style={{ marginTop: "auto", padding: 12, background: SURFACE, borderRadius: 4, border: `1px solid ${LINE}` }}>
          <div style={{ color: MUTED, fontSize: 11 }}>Signed in as</div>
          <div style={{ color: CREAM, fontSize: 13, fontWeight: 600, marginTop: 2 }}>Depot operator</div>
          <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>Depot operator account</div>
          <button onClick={onLogout} style={{
            marginTop: 10, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            background: "transparent", border: `1px solid ${LINE}`, color: MUTED,
            borderRadius: 4, padding: "8px 0", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>
            <LogOut size={13} /> Log out
          </button>
        </div>
      </div>
      <div className="bottom-nav">
        {nav.map((n) => (
          <button key={n.id} onClick={() => setTab(n.id)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            background: "transparent", border: "none", cursor: "pointer",
            color: tab === n.id ? AMBER : MUTED, padding: "4px 6px", flex: 1, position: "relative",
          }}>
            <n.icon size={18} />
            <span style={{ fontSize: 9.5, fontWeight: 600, textAlign: "center", lineHeight: 1.1 }}>
              {n.label === "Order queue" ? "Queue" : n.label === "Tank monitoring" ? "Tanks" : n.label}
            </span>
            {n.id === "queue" && pendingCount > 0 && (
              <span style={{ position: "absolute", top: -2, right: 10, background: AMBER, color: "#FFFFFF",
                fontSize: 9, fontWeight: 700, borderRadius: 10, padding: "1px 5px" }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="main-content" style={{ flex: 1, padding: "32px 40px", overflowY: "auto", minWidth: 0 }}>
        {tab === "overview" && <Overview queue={queue} depots={depots} />}
        {tab === "queue" && <OrderQueue queue={queue} refresh={loadAll} />}
        {tab === "tanks" && <TankManagement depots={depots} refresh={loadAll} />}
        {tab === "reconciliation" && <Reconciliation depots={depots} />}
      </div>
    </div>
  );
}

// ---- Auth gate — swaps between Login and the app ----------------------------
export default function RoutesDepotDashboard() {
  const [session, setSession] = useState(null);
  if (!session) {
    return <Login onLogin={(s) => setSession(s)} />;
  }
  return <DepotApp onLogout={() => setSession(null)} />;
}
