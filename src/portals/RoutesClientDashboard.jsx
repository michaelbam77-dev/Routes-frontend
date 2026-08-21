import { useState, useEffect, useMemo } from "react";
import {
  Gauge, Package, MapPin, TrendingUp, Plus, FileText,
  CreditCard, Users, ChevronRight, Fuel, Truck, Calendar,
  Download, UserPlus, Shield, Mail, Phone, X, Check,
  ArrowUpRight, ArrowDownRight, Clock, Eye, Printer, LogOut, EyeOff, AlertTriangle
} from "lucide-react";
// ---------------------------------------------------------------------------
// ROUTES — client dashboard
// Diesel supply, two depots: Cato Ridge (KZN midlands) & Richards Bay (port)
// ---------------------------------------------------------------------------

// ---- API layer --------------------------------------------------------------
// Point this at your deployed Cloud Run backend. You can also set it via a
// build-time env var (Vite: import.meta.env.VITE_API_URL, CRA: process.env.REACT_APP_API_URL).
const API_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) ||
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_URL) ||
  "https://routes-backend-git-631549944748.europe-west1.run.app";

// TEMPORARY: there is no real login/auth wired up yet (see the Login component below —
// it doesn't call the backend). Until auth exists, we hardcode which client account this
// portal represents. Replace this once /api/auth or similar exists.
const CLIENT_ID = "REPLACE_WITH_REAL_CLIENT_UUID";

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
const getOrders = (clientId) => api(`/api/orders?clientId=${clientId}`);
const createOrderApi = (payload) => api("/api/orders", { method: "POST", body: JSON.stringify(payload) });
const getVehicles = (clientId) => api(`/api/vehicles?clientId=${clientId}`);
const createVehicleApi = (payload) => api("/api/vehicles", { method: "POST", body: JSON.stringify(payload) });
const updateVehicleApi = (id, payload) => api(`/api/vehicles/${id}`, { method: "PUT", body: JSON.stringify(payload) });
const deleteVehicleApi = (id) => api(`/api/vehicles/${id}`, { method: "DELETE" });
const getDrivers = (clientId) => api(`/api/drivers?clientId=${clientId}`);
const createDriverApi = (payload) => api("/api/drivers", { method: "POST", body: JSON.stringify(payload) });
const updateDriverApi = (id, payload) => api(`/api/drivers/${id}`, { method: "PUT", body: JSON.stringify(payload) });
const deleteDriverApi = (id) => api(`/api/drivers/${id}`, { method: "DELETE" });
const getClient = (clientId) => api(`/api/clients/${clientId}`);
const getWallet = (clientId) => api(`/api/clients/${clientId}/wallet`);
const requestTopUpApi = (clientId, payload) => api(`/api/clients/${clientId}/topup`, { method: "POST", body: JSON.stringify(payload) });
const getInvoices = (clientId) => api(`/api/invoices?clientId=${clientId}`);
const getTopups = (clientId) => api(`/api/topups?clientId=${clientId}`);
const createTopupRequestApi = (payload) => api("/api/topups", { method: "POST", body: JSON.stringify(payload) });

const INK = "#FAF8F4";
const SURFACE = "#FFFFFF";
const SURFACE_2 = "#F4F0E8";
const LINE = "#E6E0D4";
const AMBER = "#E8722C";
const AMBER_DIM = "#C15B1D";
const STEEL = "#3E7690";
const CREAM = "#26221B";
const MUTED = "#847C6C";
const GREEN = "#4C8C3C";
const RED = "#C1443C";

function currency(n) {
  return "R " + Number(n || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// Completed orders report the ACTUAL litres fuelled (may be less than approved).
function effectiveLitres(o) {
  const litres = Number(o.litres_approved ?? o.litres ?? 0);
  const actual = o.litres_actual != null ? Number(o.litres_actual) : null;
  return o.status === "Completed" ? (actual ?? litres) : litres;
}
function orderTotal(o) {
  return Number(o.total_actual ?? o.total_approved ?? o.total ?? 0);
}

// ---- Gauge (signature element) --------------------------------------------
function GaugeDial({ pct, size = 96, color = AMBER, label, sub }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const sweep = 0.75; // 270 degree gauge
  const dash = c * sweep * (pct / 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(135deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={LINE}
            strokeWidth={stroke} strokeDasharray={`${c * sweep} ${c}`} strokeLinecap="round" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
            strokeWidth={stroke} strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray .6s ease" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: CREAM, fontFamily: "'Oswald', sans-serif" }}>{pct}%</span>
        </div>
      </div>
      {label && <span style={{ fontSize: 13, color: CREAM, fontWeight: 600 }}>{label}</span>}
      {sub && <span style={{ fontSize: 11, color: MUTED }}>{sub}</span>}
    </div>
  );
}
function StatusPill({ status }) {
  const map = {
    "Completed": { bg: "rgba(125,170,92,.15)", fg: GREEN },
    "Approved": { bg: "rgba(125,170,92,.15)", fg: GREEN },
    "Rejected": { bg: "rgba(193,93,74,.18)", fg: RED },
    "Open": { bg: "rgba(232,162,58,.15)", fg: AMBER },
    "En route": { bg: "rgba(90,147,176,.18)", fg: STEEL },
    "Paid": { bg: "rgba(125,170,92,.15)", fg: GREEN },
    "Pending": { bg: "rgba(232,162,58,.15)", fg: AMBER },
    "Overdue": { bg: "rgba(193,93,74,.18)", fg: RED },
    "Cancelled": { bg: "rgba(193,93,74,.18)", fg: RED },
    "Active": { bg: "rgba(125,170,92,.15)", fg: GREEN },
    "Invited": { bg: "rgba(232,162,58,.15)", fg: AMBER },
  };
  const s = map[status] || { bg: LINE, fg: MUTED };
  return (
    <span style={{ background: s.bg, color: s.fg, fontSize: 11, fontWeight: 700,
      padding: "3px 9px", borderRadius: 3, letterSpacing: .3, textTransform: "uppercase", whiteSpace: "nowrap" }}>
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
function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
      color: MUTED, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 18, height: 2, background: AMBER, display: "inline-block" }} />
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", background: SURFACE_2, border: `1px solid ${LINE}`, borderRadius: 4,
  color: CREAM, padding: "10px 12px", fontSize: 14, boxSizing: "border-box",
};

function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div style={{ background: "rgba(193,68,60,.10)", border: `1px solid ${RED}`, borderRadius: 4,
      padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between",
      color: RED, fontSize: 13 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}><AlertTriangle size={15} /> {message}</span>
      {onDismiss && (
        <button onClick={onDismiss} style={{ background: "transparent", border: "none", color: RED, cursor: "pointer" }}>
          <X size={15} />
        </button>
      )}
    </div>
  );
}
function LoadingRow({ label = "Loading..." }) {
  return <div style={{ color: MUTED, fontSize: 13, padding: "20px 0", textAlign: "center" }}>{label}</div>;
}

function OrderModal({ order, onClose }) {
  const isCompleted = order.status === "Completed";
  const litresShown = effectiveLitres(order);
  const litres = Number(order.litres_approved ?? order.litres ?? 0);
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(38,34,27,.5)", display: "flex",
      alignItems: "flex-start", justifyContent: "center", zIndex: 50, padding: 20,
      overflowY: "auto",
    }} onClick={onClose}>
      <div style={{ background: SURFACE, borderRadius: 6, width: 440, maxWidth: "100%", padding: 28, marginTop: 40 }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: .5 }}>Order</div>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, color: CREAM, fontWeight: 700, marginTop: 2 }}>{order.order_number ?? order.id}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: MUTED }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: MUTED, fontSize: 13 }}>Depot</span>
            <span style={{ color: CREAM, fontSize: 13, fontWeight: 600, textAlign: "right" }}>{order.depot_name ?? order.depot}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: MUTED, fontSize: 13 }}>Product</span>
            <span style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{order.product}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: MUTED, fontSize: 13 }}>{isCompleted ? "Litres fuelled" : "Litres approved"}</span>
            <span style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>
              {litresShown.toLocaleString()} L{!isCompleted && <span style={{ color: AMBER }}> (est.)</span>}
            </span>
          </div>
          {isCompleted && order.litres_actual != null && Number(order.litres_actual) < litres && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: MUTED, fontSize: 13 }}>Originally approved</span>
              <span style={{ color: MUTED, fontSize: 13 }}>{litres.toLocaleString()} L</span>
            </div>
          )}
          {order.vehicle_reg && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: MUTED, fontSize: 13 }}>Vehicle</span>
              <span style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{order.vehicle_reg}</span>
            </div>
          )}
          {order.driver_name && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: MUTED, fontSize: 13 }}>Driver</span>
              <span style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{order.driver_name}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: MUTED, fontSize: 13 }}>Date</span>
            <span style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>
              {order.created_at ? new Date(order.created_at).toLocaleDateString("en-ZA") : order.date}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: MUTED, fontSize: 13 }}>Status</span>
            <StatusPill status={order.status} />
          </div>
        </div>
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${LINE}`,
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: MUTED, fontSize: 13 }}>Total</span>
          <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 24, color: GREEN, fontWeight: 700 }}>
            {currency(orderTotal(order))}
          </span>
        </div>
      </div>
    </div>
  );
}

function Overview({ orders, availableBalance, admins, onRequestTopUp, topUpRequests, depots }) {
  const litresThisMonth = orders.reduce((s, o) => s + effectiveLitres(o), 0);
  const monthlySpend = orders.reduce((s, o) => s + orderTotal(o), 0);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);
  const pendingCount = topUpRequests.filter(r => r.status === "Pending").length;

  async function submitTopUp() {
    const amt = Number(topUpAmount);
    if (amt <= 0) return;
    setSubmitting(true);
    setError("");
    try {
      await onRequestTopUp(amt);
      setTopUpAmount("");
      setShowTopUp(false);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3200);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 30, color: CREAM, margin: 0, fontWeight: 600 }}>
          Welcome back
        </h1>
        <p style={{ color: MUTED, fontSize: 14, marginTop: 6 }}>Overview of your Routes account</p>
      </div>
      {submitted && (
        <div style={{ background: "rgba(76,140,60,.12)", border: `1px solid ${GREEN}`, borderRadius: 4,
          padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, color: GREEN, fontSize: 13 }}>
          <Check size={16} /> Top-up request submitted — a Routes admin will review and approve the funds.
        </div>
      )}
      <Card style={{ background: "rgba(232,114,44,.08)", border: `1px solid ${LINE}`, display: "flex",
        justifyContent: "space-between", alignItems: "center", padding: 14 }}>
        <div>
          <div style={{ color: MUTED, fontSize: 11 }}>Available balance</div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, color: CREAM, marginTop: 2, fontWeight: 600 }}>
            {currency(availableBalance)}
          </div>
          {pendingCount > 0 && (
            <div style={{ color: AMBER, fontSize: 11, marginTop: 4, fontWeight: 600 }}>
              {pendingCount} top-up{pendingCount > 1 ? "s" : ""} awaiting admin approval
            </div>
          )}
        </div>
        <button onClick={() => setShowTopUp(true)} style={{ background: AMBER, color: "#FFFFFF", border: "none", borderRadius: 4,
          padding: "7px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          + Top up
        </button>
      </Card>
      {showTopUp && (
        <Card style={{ border: `1px solid ${AMBER}` }}>
          <SectionLabel>Request a top-up</SectionLabel>
          <ErrorBanner message={error} onDismiss={() => setError("")} />
          <p style={{ color: MUTED, fontSize: 12, marginTop: -6, marginBottom: 14 }}>
            Funds are added to your balance only once a Routes admin approves the request.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <SectionLabel>Amount</SectionLabel>
              <div style={{ position: "relative" }}>
                <span style={{
                  position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                  color: MUTED, fontSize: 14, fontWeight: 600, pointerEvents: "none",
                }}>
                  R
                </span>
                <input type="text" inputMode="numeric" placeholder="50,000"
                  value={topUpAmount ? Number(topUpAmount).toLocaleString("en-ZA") : ""}
                  onChange={(e) => setTopUpAmount(e.target.value.replace(/[^\d]/g, ""))}
                  style={{ ...inputStyle, paddingLeft: 28 }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={submitTopUp} disabled={!topUpAmount || Number(topUpAmount) <= 0 || submitting} style={{
                background: (topUpAmount && Number(topUpAmount) > 0 && !submitting) ? AMBER : LINE,
                color: "#FFFFFF", border: "none", borderRadius: 4,
                padding: "10px 18px", fontWeight: 700, fontSize: 13,
                cursor: (topUpAmount && Number(topUpAmount) > 0 && !submitting) ? "pointer" : "not-allowed",
              }}>
                {submitting ? "Submitting..." : "Submit for approval"}
              </button>
              <button onClick={() => { setShowTopUp(false); setTopUpAmount(""); }} style={{
                background: "transparent", color: MUTED, border: `1px solid ${LINE}`, borderRadius: 4,
                padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer",
              }}>
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}
      <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { icon: Truck, label: "Orders this month", value: orders.length },
          { icon: Fuel, label: "Litres uplifted", value: litresThisMonth.toLocaleString() },
          { icon: CreditCard, label: "Fuel spend", value: currency(monthlySpend) },
          { icon: Users, label: "Administrators", value: admins.length },
        ].map((s, i) => (
          <Card key={i} style={{ padding: 16, display: "flex", flexDirection: "column", minHeight: 100 }}>
            <s.icon size={18} color={AMBER} />
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, color: CREAM, marginTop: 12,
              fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{s.label}</div>
          </Card>
        ))}
      </div>
      <Card>
        <SectionLabel>Depot fuel levels</SectionLabel>
        <div className="depot-fuel-row" style={{ display: "flex", gap: 32 }}>
          {depots.map((d) => {
            const level = d.capacity_litres > 0 ? Math.round((Number(d.level_litres) / Number(d.capacity_litres)) * 100) : 0;
            return (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 18, flex: 1 }}>
                <GaugeDial pct={level} color={level < 45 ? RED : AMBER} />
                <div>
                  <div style={{ color: CREAM, fontWeight: 600, fontSize: 15 }}>{d.name}</div>
                  <div style={{ color: MUTED, fontSize: 12, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <MapPin size={12} /> {d.region}
                  </div>
                  <div style={{ color: MUTED, fontSize: 12, marginTop: 8 }}>
                    {Number(d.level_litres).toLocaleString()} L / {Number(d.capacity_litres).toLocaleString()} L
                  </div>
                  <div style={{ color: STEEL, fontSize: 12, marginTop: 2 }}>{currency(d.price_per_litre)} / L today</div>
                </div>
              </div>
            );
          })}
          {depots.length === 0 && <LoadingRow label="No depot data yet." />}
        </div>
      </Card>
      <Card>
        <SectionLabel>Recent orders</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {orders.slice(0, 4).map((o, i) => (
            <div key={o.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
              padding: "14px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
                <div style={{ width: 34, height: 34, borderRadius: 4, background: SURFACE_2,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Fuel size={16} color={AMBER} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: CREAM, fontSize: 13, fontWeight: 700 }}>
                    {o.order_number}{o.vehicle_reg && <> · {o.vehicle_reg}</>}
                  </div>
                  <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{o.depot_name}</div>
                  <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>
                    {effectiveLitres(o).toLocaleString()} L {o.product}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                <span style={{ color: CREAM, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{currency(orderTotal(o))}</span>
                <StatusPill status={o.status} />
                <button onClick={() => setViewingOrder(o)} style={{
                  background: "transparent", border: `1px solid ${LINE}`, color: CREAM,
                  borderRadius: 4, padding: "5px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  <Eye size={12} /> View
                </button>
              </div>
            </div>
          ))}
          {orders.length === 0 && <LoadingRow label="No orders yet." />}
        </div>
      </Card>
      {viewingOrder && (
        <OrderModal order={viewingOrder} onClose={() => setViewingOrder(null)} />
      )}
    </div>
  );
}

// ---- Create order -------------------------------------------------------
function CreateOrder({ onSubmit, availableBalance, orders, vehicleList, driverList, depots }) {
  const [depotId, setDepotId] = useState(depots[0]?.id || "");
  const [product] = useState("50ppm Diesel");
  const [litres, setLitres] = useState(0);
  const [vehicle, setVehicle] = useState("");
  const [driver, setDriver] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!depotId && depots[0]) setDepotId(depots[0].id);
  }, [depots]);

  const chosen = depots.find((d) => d.id === depotId) || depots[0];
  const price = chosen ? Number(chosen.price_per_litre) : 0;
  const total = Number(litres || 0) * price;
  const hasFunds = total <= availableBalance;
  const hasLitres = Number(litres) > 0;
  const selectedVehicle = vehicleList.find(v => v.id === vehicle);
  const exceedsVehicleCapacity = selectedVehicle && Number(litres) > Number(selectedVehicle.capacity_litres);
  const depotAvailableLitres = chosen ? Number(chosen.level_litres) : 0;
  const exceedsDepotStock = Number(litres) > depotAvailableLitres;
  const canSubmit = hasLitres && !!vehicle && !!driver && hasFunds && !exceedsVehicleCapacity && !exceedsDepotStock && !!chosen;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        depotId: chosen.id,
        vehicleId: vehicle,
        driverId: driver,
        litres: Number(litres),
        product,
      });
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2600);
      setVehicle(""); setDriver(""); setLitres(0);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 900 }}>
      <div>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, color: CREAM, margin: 0, fontWeight: 600 }}>Create order</h1>
        <p style={{ color: MUTED, fontSize: 14, marginTop: 6 }}>Send your truck to a depot to fuel up.</p>
      </div>
      {submitted && (
        <div style={{ background: "rgba(76,140,60,.12)", border: `1px solid ${GREEN}`, borderRadius: 4,
          padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, color: GREEN, fontSize: 13 }}>
          <Check size={16} /> Order submitted — the depot team will confirm within 2 hours.
        </div>
      )}
      <ErrorBanner message={error} onDismiss={() => setError("")} />
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <SectionLabel>Depot</SectionLabel>
            <select value={depotId} onChange={(e) => setDepotId(e.target.value)} style={inputStyle}>
              {depots.map((d) => (
                <option key={d.id} value={d.id}>{d.name} — {d.region}</option>
              ))}
            </select>
          </div>
          {chosen && (
            <div>
              <SectionLabel>Price per litre</SectionLabel>
              <div style={{ ...inputStyle, display: "flex", alignItems: "center", color: STEEL, fontWeight: 600 }}>
                {currency(price)} / L
              </div>
              <div style={{ color: MUTED, fontSize: 11, marginTop: 6 }}>
                {depotAvailableLitres.toLocaleString()} L available at this depot
              </div>
            </div>
          )}
          <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <SectionLabel>Product</SectionLabel>
              <div style={{ ...inputStyle, display: "flex", alignItems: "center", color: MUTED }}>
                {product}
              </div>
            </div>
            <div>
              <SectionLabel>Litres</SectionLabel>
              <input type="number" min={500} step={500} value={litres}
                onChange={(e) => setLitres(e.target.value)}
                style={{ ...inputStyle, borderColor: (exceedsVehicleCapacity || exceedsDepotStock) ? RED : LINE }} />
              {exceedsDepotStock && (
                <div style={{ color: RED, fontSize: 11.5, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  <AlertTriangle size={12} /> Only {depotAvailableLitres.toLocaleString()} L available at {chosen?.name}
                </div>
              )}
              {exceedsVehicleCapacity && (
                <div style={{ color: RED, fontSize: 11.5, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <AlertTriangle size={12} /> Exceeds {selectedVehicle.registration}'s tank capacity ({Number(selectedVehicle.capacity_litres).toLocaleString()} L)
                </div>
              )}
            </div>
          </div>
          <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <SectionLabel>Vehicle</SectionLabel>
              <select value={vehicle} onChange={(e) => setVehicle(e.target.value)} style={inputStyle}>
                <option value="">Select a vehicle</option>
                {vehicleList.map((v) => (
                  <option key={v.id} value={v.id} disabled={v.status !== "Available"}>
                    {v.registration} — {v.brand} {v.model} {v.status !== "Available" ? `(${v.status})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <SectionLabel>Driver</SectionLabel>
              <select value={driver} onChange={(e) => setDriver(e.target.value)} style={inputStyle}>
                <option value="">Select a driver</option>
                {driverList.map((d) => (
                  <option key={d.id} value={d.id} disabled={d.status !== "Available"}>
                    {d.name} — {d.phone} {d.status !== "Available" ? `(${d.status})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <SectionLabel>Total</SectionLabel>
            <div style={{ ...inputStyle, display: "flex", alignItems: "center", color: hasFunds ? GREEN : RED, fontWeight: 700, fontFamily: "'Oswald', sans-serif", fontSize: 17 }}>
              {currency(total)}
            </div>
          </div>
          <button type="button" onClick={submit} disabled={!canSubmit || submitting} style={{
            marginTop: 4, background: (canSubmit && !submitting) ? AMBER : LINE,
            color: "#FFFFFF", border: "none", borderRadius: 4,
            padding: "13px 20px", fontWeight: 700, fontSize: 14,
            cursor: (canSubmit && !submitting) ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Plus size={16} /> {submitting ? "Submitting..." : "Submit order"}
          </button>
        </div>
      </Card>
      <OrdersTable orders={orders} />
    </div>
  );
}

function OrdersTable({ orders }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const filters = ["All", "Open", "Completed"];
  const statusGroup = (status) => (status === "Completed" ? "Completed" : "Open");
  const filtered = orders.filter(o => {
    const matchesFilter = filter === "All" || statusGroup(o.status) === filter;
    const matchesSearch = !search ||
      (o.order_number || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.depot_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.vehicle_reg || "").toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });
  const totalOrders = filtered.length;
  const totalLitres = filtered.reduce((s, o) => s + effectiveLitres(o), 0);
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: 20, paddingBottom: 0 }}>
        <SectionLabel>Orders</SectionLabel>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0 20px 16px 20px", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {filters.map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "7px 13px", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: filter === f ? "rgba(232,114,44,.10)" : "transparent",
              border: `1px solid ${filter === f ? AMBER : LINE}`,
              color: filter === f ? AMBER : MUTED, whiteSpace: "nowrap",
            }}>
              {f}
            </button>
          ))}
        </div>
        <input placeholder="Search order, depot or vehicle..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, width: 220, padding: "8px 10px", fontSize: 12 }} />
      </div>
      <div className="table-scroll">
        <div style={{ minWidth: 640 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1.1fr 0.8fr 0.9fr 0.9fr", gap: 8,
            padding: "10px 20px", background: SURFACE_2, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
            {["Order", "Depot", "Vehicle", "Litres", "Price / L", "Total"].map((h, i) => (
              <span key={h} style={{ color: MUTED, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: .5, textAlign: i >= 3 ? "right" : "left" }}>
                {h}
              </span>
            ))}
          </div>
          <div>
            {filtered.map((o, i) => {
              const litresShown = effectiveLitres(o);
              const isEstimate = o.status !== "Completed";
              const total = orderTotal(o);
              return (
                <div key={o.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1.1fr 0.8fr 0.9fr 0.9fr", gap: 8,
                  padding: "12px 20px", borderBottom: i === filtered.length - 1 ? "none" : `1px solid ${LINE}`, alignItems: "center" }}>
                  <span style={{ color: CREAM, fontSize: 13, fontWeight: 700 }}>{o.order_number}</span>
                  <div style={{ color: CREAM, fontSize: 12.5 }}>{o.depot_name}</div>
                  <span style={{ color: MUTED, fontSize: 12 }}>{o.vehicle_reg || "—"}</span>
                  <span style={{ color: MUTED, fontSize: 12, textAlign: "right" }}>
                    {litresShown.toLocaleString()} L{isEstimate ? <span style={{ color: AMBER }}> (est.)</span> : ""}
                  </span>
                  <span style={{ color: MUTED, fontSize: 12, textAlign: "right" }}>
                    {litresShown > 0 ? currency(total / litresShown) : "—"}
                  </span>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ color: CREAM, fontSize: 13, fontWeight: 700 }}>{currency(total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {filtered.length === 0 && (
        <div style={{ color: MUTED, fontSize: 13, padding: "24px 20px", textAlign: "center" }}>No orders match this view.</div>
      )}
      <div style={{ display: "flex", alignItems: "stretch",
        background: "linear-gradient(135deg, #E8722C 0%, #D8631F 100%)", padding: "20px 28px", gap: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingRight: 32 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(255,255,255,.18)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Package size={19} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ color: "rgba(255,255,255,.8)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5 }}>Total orders</div>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 24, color: "#FFFFFF", fontWeight: 700, marginTop: 2 }}>{totalOrders}</div>
          </div>
        </div>
        <div style={{ width: 1, background: "rgba(255,255,255,.25)", margin: "2px 0" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingLeft: 32 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(255,255,255,.18)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Fuel size={19} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ color: "rgba(255,255,255,.8)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5 }}>Litres</div>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 24, color: "#FFFFFF", fontWeight: 700, marginTop: 2 }}>{totalLitres.toLocaleString()} L</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Finance({ invoiceList, orders, availableBalance, topUpRequests }) {
  const monthlyLitres = orders.reduce((s, o) => s + effectiveLitres(o), 0);
  const monthlySpend = orders.reduce((s, o) => s + orderTotal(o), 0);
  const openOrders = orders.filter(o => o.status !== "Completed");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, color: CREAM, margin: 0, fontWeight: 600 }}>Finance</h1>
        <p style={{ color: MUTED, fontSize: 14, marginTop: 6 }}>Invoices, balances and top-ups for your account.</p>
      </div>
      <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <Card style={{ padding: 16 }}>
          <div style={{ color: MUTED, fontSize: 12 }}>Available balance</div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 24, color: GREEN, marginTop: 6, fontWeight: 600 }}>{currency(availableBalance)}</div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ color: MUTED, fontSize: 12 }}>Monthly litres</div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 24, color: CREAM, marginTop: 6, fontWeight: 600 }}>{monthlyLitres.toLocaleString()} L</div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ color: MUTED, fontSize: 12 }}>Fuel spend for the month</div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 24, color: AMBER, marginTop: 6, fontWeight: 600 }}>{currency(monthlySpend)}</div>
        </Card>
      </div>
      <Card>
        <SectionLabel>Top-up requests</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {topUpRequests.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <FileText size={16} color={r.status === "Approved" ? GREEN : r.status === "Rejected" ? RED : AMBER} />
                <div>
                  <div style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{r.request_number} · {currency(r.amount)}</div>
                  <div style={{ color: MUTED, fontSize: 12 }}>
                    {r.created_at ? new Date(r.created_at).toLocaleDateString("en-ZA") : ""}
                  </div>
                </div>
              </div>
              <StatusPill status={r.status} />
            </div>
          ))}
          {topUpRequests.length === 0 && <LoadingRow label="No top-up requests yet." />}
        </div>
      </Card>
      <Card>
        <SectionLabel>Invoices</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {invoiceList.map((inv, i) => (
            <div key={inv.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <FileText size={16} color={STEEL} />
                <div>
                  <div style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{inv.invoice_number}</div>
                  <div style={{ color: MUTED, fontSize: 12 }}>Order {inv.order_number} · Due {new Date(inv.due_date).toLocaleDateString("en-ZA")}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{currency(inv.amount)}</span>
                <StatusPill status={inv.status} />
              </div>
            </div>
          ))}
          {invoiceList.length === 0 && <LoadingRow label="No invoices yet." />}
        </div>
      </Card>
      <Card>
        <SectionLabel>Open orders</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {openOrders.map((o, i) => (
            <div key={o.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <FileText size={16} color={AMBER} />
                <div>
                  <div style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{o.order_number} · {o.depot_name}</div>
                  <div style={{ color: MUTED, fontSize: 12 }}>{Number(o.litres_approved).toLocaleString()} L approved · {o.product}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{currency(orderTotal(o))}</span>
                <StatusPill status={o.status} />
              </div>
            </div>
          ))}
          {openOrders.length === 0 && (
            <div style={{ color: MUTED, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No open orders.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ---- Vehicles & drivers ------------------------------------------------------
function formatSAPlate(value) {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = clean.match(/^([A-Z]{2,3})(\d{1,4})([A-Z]{1,3})([A-Z]{2,3})$/);
  if (match) return `${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
  const parts = clean.match(/[A-Z]+|\d+/g);
  return parts ? parts.join(" ") : clean;
}
function capitalizeWords(value) {
  return value.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}
const truckBrands = [
  "Isuzu", "Volvo", "Scania", "MAN", "Mercedes-Benz", "FAW", "Hino",
  "DAF", "UD Trucks", "Iveco", "Fuso", "Freightliner", "Tata", "Powerstar",
];
const truckModels = {
  "Isuzu": ["FVZ 1400", "FXZ 360", "FTR 850", "NPR 400", "GXZ 400"],
  "Volvo": ["FH", "FM", "FMX", "FE", "FL"],
  "Scania": ["R Series", "S Series", "P Series", "G Series"],
  "MAN": ["TGX", "TGS", "TGM", "TGL"],
  "Mercedes-Benz": ["Actros", "Arocs", "Axor", "Atego"],
  "FAW": ["J6", "J5M", "CA", "Tiger V"],
  "Hino": ["700 Series", "500 Series", "300 Series"],
  "DAF": ["XF", "CF", "LF"],
  "UD Trucks": ["Quon", "Quester", "Croner"],
  "Iveco": ["S-Way", "Trakker", "Eurocargo"],
  "Fuso": ["Shogun", "Fighter", "Canter"],
  "Freightliner": ["Cascadia", "Argosy"],
  "Tata": ["Prima", "LPT", "Ultra"],
  "Powerstar": ["3140", "3840", "4436"],
};

function VehiclesAndDrivers({ vehicleList, refreshVehicles, driverList, refreshDrivers }) {
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [addingDriver, setAddingDriver] = useState(false);
  const [error, setError] = useState("");
  const [reg, setReg] = useState("");
  const [brand, setBrand] = useState(truckBrands[0]);
  const [model, setModel] = useState(truckModels[truckBrands[0]][0]);
  const [capacity, setCapacity] = useState("");
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [phone, setPhone] = useState("");

  function resetVehicleForm() {
    setReg(""); setBrand(truckBrands[0]); setModel(truckModels[truckBrands[0]][0]); setCapacity("");
  }
  function resetDriverForm() {
    setFirstName(""); setSurname(""); setPhone("");
  }
  async function addVehicle(e) {
    e.preventDefault();
    const regTrimmed = reg.trim();
    const capNum = Number(capacity);
    if (!regTrimmed || !capacity || capNum <= 0) return;
    try {
      await createVehicleApi({
        clientId: CLIENT_ID,
        registration: formatSAPlate(regTrimmed),
        brand, model, capacityLitres: capNum,
      });
      await refreshVehicles();
      resetVehicleForm();
      setAddingVehicle(false);
    } catch (e2) {
      setError(e2.message);
    }
  }
  async function addDriver(e) {
    e.preventDefault();
    const first = firstName.trim();
    const last = surname.trim();
    const phoneTrimmed = phone.trim();
    if (!first || !last || !phoneTrimmed) return;
    try {
      await createDriverApi({
        clientId: CLIENT_ID,
        name: `${capitalizeWords(first)} ${capitalizeWords(last)}`,
        phone: phoneTrimmed,
      });
      await refreshDrivers();
      resetDriverForm();
      setAddingDriver(false);
    } catch (e2) {
      setError(e2.message);
    }
  }
  async function removeVehicle(id) {
    try {
      await deleteVehicleApi(id);
      await refreshVehicles();
    } catch (e2) {
      setError(e2.message);
    }
  }
  async function removeDriver(id) {
    try {
      await deleteDriverApi(id);
      await refreshDrivers();
    } catch (e2) {
      setError(e2.message);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, color: CREAM, margin: 0, fontWeight: 600 }}>Vehicles & drivers</h1>
        <p style={{ color: MUTED, fontSize: 14, marginTop: 6 }}>Manage the fleet and drivers available to allocate on orders.</p>
      </div>
      <ErrorBanner message={error} onDismiss={() => setError("")} />
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <SectionLabel>Vehicles</SectionLabel>
            <button type="button" onClick={() => setAddingVehicle(!addingVehicle)} style={{
              background: addingVehicle ? SURFACE_2 : AMBER, color: addingVehicle ? CREAM : "#FFFFFF",
              border: `1px solid ${addingVehicle ? LINE : AMBER}`, borderRadius: 4, padding: "6px 12px",
              fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
              marginBottom: 14,
            }}>
              {addingVehicle ? <X size={13} /> : <Plus size={13} />} {addingVehicle ? "Cancel" : "Add vehicle"}
            </button>
          </div>
          {addingVehicle && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10,
              background: SURFACE_2, border: `1px solid ${LINE}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
              <input placeholder="Registration e.g. ND 21 XY GP" value={reg}
                onChange={(e) => setReg(formatSAPlate(e.target.value))}
                style={{ ...inputStyle, textTransform: "uppercase" }} />
              <select value={brand} onChange={(e) => { setBrand(e.target.value); setModel(truckModels[e.target.value][0]); }} style={inputStyle}>
                {truckBrands.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <select value={model} onChange={(e) => setModel(e.target.value)} style={inputStyle}>
                {truckModels[brand].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <input type="number" min={1} placeholder="Fuel tank capacity (L)" value={capacity}
                onChange={(e) => setCapacity(e.target.value)} style={inputStyle} />
              <button type="button" onClick={addVehicle} style={{
                background: AMBER, color: "#FFFFFF", border: "none", borderRadius: 4,
                padding: "9px 0", fontWeight: 700, fontSize: 12, cursor: "pointer",
              }}>
                Save vehicle
              </button>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {vehicleList.map((v, i) => (
              <div key={v.id} style={{ padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE}`,
                display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Truck size={16} color={STEEL} />
                  <div>
                    <div style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{v.registration}</div>
                    <div style={{ color: MUTED, fontSize: 12 }}>{v.brand} {v.model} · {Number(v.capacity_litres).toLocaleString()} L</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StatusPill status={v.status} />
                  <button type="button" onClick={() => removeVehicle(v.id)} style={{
                    background: "transparent", border: `1px solid ${LINE}`, color: RED,
                    borderRadius: 4, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {vehicleList.length === 0 && (
              <div style={{ color: MUTED, fontSize: 13, padding: "16px 0", textAlign: "center" }}>No vehicles added yet.</div>
            )}
          </div>
        </Card>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <SectionLabel>Drivers</SectionLabel>
            <button type="button" onClick={() => setAddingDriver(!addingDriver)} style={{
              background: addingDriver ? SURFACE_2 : AMBER, color: addingDriver ? CREAM : "#FFFFFF",
              border: `1px solid ${addingDriver ? LINE : AMBER}`, borderRadius: 4, padding: "6px 12px",
              fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
              marginBottom: 14,
            }}>
              {addingDriver ? <X size={13} /> : <Plus size={13} />} {addingDriver ? "Cancel" : "Add driver"}
            </button>
          </div>
          {addingDriver && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10,
              background: SURFACE_2, border: `1px solid ${LINE}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
              <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input placeholder="Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
                <input placeholder="Surname" value={surname} onChange={(e) => setSurname(e.target.value)} style={inputStyle} />
              </div>
              <input placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
              <button type="button" onClick={addDriver} style={{
                background: AMBER, color: "#FFFFFF", border: "none", borderRadius: 4,
                padding: "9px 0", fontWeight: 700, fontSize: 12, cursor: "pointer",
              }}>
                Save driver
              </button>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {driverList.map((d, i) => (
              <div key={d.id} style={{ padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE}`,
                display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: SURFACE_2,
                    border: `1px solid ${LINE}`, display: "flex", alignItems: "center",
                    justifyContent: "center", color: MUTED, fontWeight: 700, fontSize: 12 }}>
                    {d.name.split(" ").map(w => w[0]).join("")}
                  </div>
                  <div>
                    <div style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{d.name}</div>
                    <div style={{ color: MUTED, fontSize: 12 }}>{d.phone}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StatusPill status={d.status} />
                  <button type="button" onClick={() => removeDriver(d.id)} style={{
                    background: "transparent", border: `1px solid ${LINE}`, color: RED,
                    borderRadius: 4, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {driverList.length === 0 && (
              <div style={{ color: MUTED, fontSize: 13, padding: "16px 0", textAlign: "center" }}>No drivers added yet.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// Administrators are not yet backed by any /api/admins endpoint that supports listing
// by client with full CRUD — server.js only exposes GET/POST. Keeping this local-state
// until that's fleshed out; POSTing an invite still works.
function Administrators({ admins, setAdmins }) {
  const [inviting, setInviting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Fleet manager");
  const [error, setError] = useState("");
  async function invite(e) {
    e.preventDefault();
    if (!name || !email) return;
    try {
      const created = await api("/api/admins", {
        method: "POST",
        body: JSON.stringify({ clientId: CLIENT_ID, name, email, role }),
      });
      setAdmins((prev) => [...prev, created]);
      setName(""); setEmail(""); setInviting(false);
    } catch (e2) {
      setError(e2.message);
    }
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, color: CREAM, margin: 0, fontWeight: 600 }}>Administrators</h1>
          <p style={{ color: MUTED, fontSize: 14, marginTop: 6 }}>People on your team who can place orders and view finances.</p>
        </div>
        <button onClick={() => setInviting(!inviting)} style={{
          background: inviting ? SURFACE_2 : AMBER, color: inviting ? CREAM : "#FFFFFF", border: `1px solid ${inviting ? LINE : AMBER}`,
          borderRadius: 4, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {inviting ? <X size={14} /> : <UserPlus size={14} />} {inviting ? "Cancel" : "Invite administrator"}
        </button>
      </div>
      <ErrorBanner message={error} onDismiss={() => setError("")} />
      {inviting && (
        <Card>
          <div className="grid-admin" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
            <div>
              <SectionLabel>Full name</SectionLabel>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Jane Dlamini" />
            </div>
            <div>
              <SectionLabel>Email</SectionLabel>
              <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="jane@company.co.za" />
            </div>
            <div>
              <SectionLabel>Role</SectionLabel>
              <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
                <option>Owner</option>
                <option>Fleet manager</option>
                <option>Finance</option>
                <option>Viewer</option>
              </select>
            </div>
            <button type="button" onClick={invite} style={{ background: AMBER, color: "#FFFFFF", border: "none", borderRadius: 4,
              padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 40 }}>
              Send invite
            </button>
          </div>
        </Card>
      )}
      <Card>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {admins.map((a, i) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: SURFACE_2,
                  display: "flex", alignItems: "center", justifyContent: "center", color: AMBER, fontWeight: 700, fontSize: 13 }}>
                  {a.name.split(" ").map(w => w[0]).join("")}
                </div>
                <div>
                  <div style={{ color: CREAM, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    {a.name}
                    {a.role === "Owner" && <Shield size={12} color={AMBER} />}
                  </div>
                  <div style={{ color: MUTED, fontSize: 12, display: "flex", gap: 12, marginTop: 2 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Mail size={11} />{a.email}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ color: MUTED, fontSize: 12 }}>{a.role}</span>
                <StatusPill status={a.status} />
              </div>
            </div>
          ))}
          {admins.length === 0 && <LoadingRow label="No administrators yet." />}
        </div>
      </Card>
    </div>
  );
}

// ---- Login ------------------------------------------------------------------
// NOTE: your backend has no auth endpoint yet (no /api/login, no sessions/JWT).
// This screen still just fakes a delay. Real login needs a backend route added first.
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
            Client login
          </h1>
          <p style={{ color: MUTED, fontSize: 13, marginTop: 6, marginBottom: 22, textAlign: "center" }}>
            Sign in to manage your orders, fleet and finances.
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
              <input type="email" placeholder="you@company.co.za" value={email}
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
      </div>
    </div>
  );
}

// ---- App shell --------------------------------------------------------------
function RoutesApp({ onLogout }) {
  const [tab, setTab] = useState("overview");
  const [orders, setOrders] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [vehicleList, setVehicleList] = useState([]);
  const [driverList, setDriverList] = useState([]);
  const [depots, setDepots] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [topUpRequests, setTopUpRequests] = useState([]);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  async function refreshVehicles() {
    setVehicleList(await getVehicles(CLIENT_ID));
  }
  async function refreshDrivers() {
    setDriverList(await getDrivers(CLIENT_ID));
  }
  async function refreshOrders() {
    setOrders(await getOrders(CLIENT_ID));
  }
  async function refreshTopups() {
    setTopUpRequests(await getTopups(CLIENT_ID));
  }
  async function refreshClient() {
    const c = await getClient(CLIENT_ID);
    setAvailableBalance(Number(c.available_balance || 0));
  }

  async function loadAll() {
    setLoading(true);
    setLoadError("");
    try {
      const [depotList, orderList, vehicles, drivers, client, invoiceList, topups] = await Promise.all([
        getDepots(),
        getOrders(CLIENT_ID),
        getVehicles(CLIENT_ID),
        getDrivers(CLIENT_ID),
        getClient(CLIENT_ID),
        getInvoices(CLIENT_ID),
        getTopups(CLIENT_ID),
      ]);
      setDepots(depotList);
      setOrders(orderList);
      setVehicleList(vehicles);
      setDriverList(drivers);
      setAvailableBalance(Number(client.available_balance || 0));
      setInvoices(invoiceList);
      setTopUpRequests(topups);
    } catch (e) {
      setLoadError(
        e.message.includes("Client not found")
          ? "CLIENT_ID in this file is a placeholder — replace it with a real client UUID from your database."
          : e.message
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function submitOrder({ depotId, vehicleId, driverId, litres, product }) {
    await createOrderApi({ clientId: CLIENT_ID, depotId, vehicleId, driverId, litres, product });
    await Promise.all([refreshOrders(), refreshClient()]);
  }
  async function requestTopUp(amount) {
    await createTopupRequestApi({ clientId: CLIENT_ID, amount });
    await refreshTopups();
  }

  const nav = [
    { id: "overview", label: "Overview", icon: Gauge },
    { id: "order", label: "Create order", icon: Plus },
    { id: "finance", label: "Finance", icon: CreditCard },
    { id: "fleet", label: "Vehicles & Drivers", icon: Truck },
    { id: "admins", label: "Administrators", icon: Users },
  ];
  const mobileNav = [nav[0], nav[2], nav[1], nav[3], nav[4]];

  return (
    <div className="app-shell" style={{ fontFamily: "'Inter', sans-serif", background: INK, minHeight: "100vh", display: "flex" }}>
      <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        .app-shell { flex-direction: row; }
        .grid-4 { grid-template-columns: repeat(4, 1fr); }
        .grid-3 { grid-template-columns: repeat(3, 1fr); }
        .grid-2 { grid-template-columns: 1fr 1fr; }
        .grid-admin { grid-template-columns: 1fr 1fr 1fr auto; }
        .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
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
          .grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
          .grid-3 { grid-template-columns: 1fr !important; }
          .grid-2 { grid-template-columns: 1fr !important; }
          .grid-admin { grid-template-columns: 1fr !important; }
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
              background: tab === n.id ? "rgba(232,162,58,.12)" : "transparent",
              border: "none", cursor: "pointer", textAlign: "left",
              color: tab === n.id ? AMBER : MUTED, fontSize: 13, fontWeight: 600,
            }}>
              <n.icon size={16} />
              {n.label}
              {tab === n.id && <ChevronRight size={13} style={{ marginLeft: "auto" }} />}
            </button>
          ))}
        </div>
        <div style={{ marginTop: "auto", padding: 12, background: SURFACE, borderRadius: 4, border: `1px solid ${LINE}` }}>
          <button onClick={onLogout} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            background: "transparent", border: `1px solid ${LINE}`, color: MUTED,
            borderRadius: 4, padding: "8px 0", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>
            <LogOut size={13} /> Log out
          </button>
        </div>
      </div>
      <div className="bottom-nav">
        {mobileNav.map((n) => (
          <button key={n.id} onClick={() => setTab(n.id)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            background: "transparent", border: "none", cursor: "pointer",
            color: tab === n.id ? AMBER : MUTED, padding: "4px 6px", flex: 1,
          }}>
            <n.icon size={18} />
            <span style={{ fontSize: 9.5, fontWeight: 600, textAlign: "center", lineHeight: 1.1 }}>
              {n.label === "Vehicles & Drivers" ? "Fleet" : n.label === "Create order" ? "Order" : n.label}
            </span>
          </button>
        ))}
      </div>
      <div className="main-content" style={{ flex: 1, padding: "32px 40px", overflowY: "auto", minWidth: 0 }}>
        {loadError && (
          <div style={{ marginBottom: 20 }}>
            <ErrorBanner message={loadError} />
          </div>
        )}
        {loading ? (
          <LoadingRow label="Loading your Routes account..." />
        ) : (
          <>
            {tab === "overview" && <Overview orders={orders} availableBalance={availableBalance} admins={admins}
              onRequestTopUp={requestTopUp} topUpRequests={topUpRequests} depots={depots} />}
            {tab === "order" && <CreateOrder availableBalance={availableBalance} orders={orders}
              vehicleList={vehicleList} driverList={driverList} depots={depots} onSubmit={submitOrder} />}
            {tab === "finance" && <Finance invoiceList={invoices} orders={orders} availableBalance={availableBalance} topUpRequests={topUpRequests} />}
            {tab === "fleet" && <VehiclesAndDrivers vehicleList={vehicleList} refreshVehicles={refreshVehicles}
              driverList={driverList} refreshDrivers={refreshDrivers} />}
            {tab === "admins" && <Administrators admins={admins} setAdmins={setAdmins} />}
          </>
        )}
      </div>
    </div>
  );
}

// ---- Auth gate — swaps between Login and the app ----------------------------
export default function RoutesPortal() {
  const [session, setSession] = useState(null);
  if (!session) {
    return <Login onLogin={(s) => setSession(s)} />;
  }
  return <RoutesApp onLogout={() => setSession(null)} />;
}
