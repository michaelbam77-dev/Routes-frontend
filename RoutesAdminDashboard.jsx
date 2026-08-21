import { useState, useEffect, useCallback } from "react";
import {
  Gauge, Users, ChevronRight, ChevronLeft, Fuel, Truck, Package, CreditCard,
  Check, X, MapPin, AlertTriangle, Eye, EyeOff, FileText,
  Building2, TrendingUp, LogOut, Search, BarChart3, History,
  Wallet
} from "lucide-react";
// ---------------------------------------------------------------------------
// ROUTES — admin dashboard (head-office staff: finance, ops, management)
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
const getSummary = () => api("/api/admin/summary");
const getAdminClients = () => api("/api/admin/clients");
const createClientApi = (payload) => api("/api/clients", { method: "POST", body: JSON.stringify(payload) });
const setClientStatusApi = (id, status) => api(`/api/admin/clients/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
const setCreditLimitApi = (id, creditLimit) => api(`/api/clients/${id}/credit-limit`, { method: "PATCH", body: JSON.stringify({ creditLimit }) });
const getClientPricing = (id) => api(`/api/clients/${id}/pricing`);
const setClientPricingApi = (id, depotId, price) => api(`/api/clients/${id}/pricing/${depotId}`, { method: "PUT", body: JSON.stringify({ price }) });
const getDepots = () => api("/api/depots");
const setDepotPricingApi = (id, costPerLitre, markupPerLitre) => api(`/api/depots/${id}/pricing`, { method: "PATCH", body: JSON.stringify({ costPerLitre, markupPerLitre }) });
const scheduleDelivery = (depotId, litres, eta) => api("/api/deliveries", { method: "POST", body: JSON.stringify({ depotId, litres, eta }) });
const receiveDelivery = (deliveryId, litresReceived) => api(`/api/deliveries/${deliveryId}/receive`, { method: "PATCH", body: JSON.stringify({ litresReceived }) });
const cancelDelivery = (deliveryId) => api(`/api/deliveries/${deliveryId}`, { method: "DELETE" });
const getOrders = () => api("/api/orders");
const getInvoices = () => api("/api/invoices");
const getTopups = () => api("/api/topups");
const approveTopupApi = (id) => api(`/api/topups/${id}/approve`, { method: "PATCH", body: JSON.stringify({ decidedBy: "Routes Head Office" }) });
const rejectTopupApi = (id) => api(`/api/topups/${id}/reject`, { method: "PATCH", body: JSON.stringify({ decidedBy: "Routes Head Office" }) });
const getAuditLog = () => api("/api/audit-log");

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

function currency(n) {
  return "R " + Number(n || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function sellPrice(depot) {
  return Number(depot.cost_per_litre || 0) + Number(depot.markup_per_litre || 0);
}
function profitPerLitre(depot) {
  return Number(depot.markup_per_litre || 0);
}
function pct(depot) {
  return depot.capacity_litres > 0 ? Math.round((Number(depot.level_litres) / Number(depot.capacity_litres)) * 100) : 0;
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(d) {
  return new Date(d).toLocaleString("en-ZA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusPill({ status }) {
  const map = {
    "Active": { bg: "rgba(76,140,60,.14)", fg: GREEN },
    "Approved": { bg: "rgba(76,140,60,.14)", fg: GREEN },
    "Completed": { bg: "rgba(76,140,60,.14)", fg: GREEN },
    "Paid": { bg: "rgba(76,140,60,.14)", fg: GREEN },
    "Pending": { bg: "rgba(232,114,44,.12)", fg: AMBER },
    "Open": { bg: "rgba(232,114,44,.12)", fg: AMBER },
    "En route": { bg: "rgba(62,118,144,.14)", fg: STEEL },
    "Confirmed": { bg: "rgba(62,118,144,.14)", fg: STEEL },
    "Rejected": { bg: "rgba(193,68,60,.14)", fg: RED },
    "Suspended": { bg: "rgba(193,68,60,.14)", fg: RED },
    "Overdue": { bg: "rgba(193,68,60,.14)", fg: RED },
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
function BarChart({ data, color, formatValue, gradientId }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(...data.map(d => d.value), 1);
  const w = 560, h = 190, pad = 8, barGap = 14;
  const barW = (w - pad * 2) / data.length - barGap;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 190, overflow: "visible" }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {[0, 0.33, 0.66, 1].map((f) => (
        <line key={f} x1={pad} x2={w - pad} y1={20 + (h - 60) * f} y2={20 + (h - 60) * f} stroke={LINE} strokeWidth="1" />
      ))}
      {data.map((d, i) => {
        const x = pad + i * (barW + barGap);
        const barH = Math.max(4, (h - 60) * (d.value / max));
        const y = (h - 40) - barH;
        const isHover = hover === i;
        return (
          <g key={d.label}>
            <text x={x + barW / 2} y={y - 10} textAnchor="middle" fontSize="12" fontWeight="700"
              fill={isHover ? color : CREAM} fontFamily="'Oswald', sans-serif">
              {formatValue(d.value)}
            </text>
            <rect x={x} y={y} width={barW} height={barH} rx="6"
              fill={isHover ? color : `url(#${gradientId})`}
              style={{ transition: "fill .15s ease", cursor: "pointer" }}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            <text x={x + barW / 2} y={h - 18} textAnchor="middle" fontSize="11.5" fill={MUTED}>{d.label}</text>
            <rect x={x} y={20} width={barW} height={h - 60} fill="transparent"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }} />
          </g>
        );
      })}
    </svg>
  );
}
const inputStyle = {
  width: "100%", background: SURFACE_2, border: `1px solid ${LINE}`, borderRadius: 4,
  color: CREAM, padding: "10px 12px", fontSize: 14, boxSizing: "border-box",
};

// ---- Overview -----------------------------------------------------------
function Overview({ summary, depots, orders }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 28, color: CREAM, margin: 0, fontWeight: 600 }}>
          Head office overview
        </h1>
        <p style={{ color: MUTED, fontSize: 14, marginTop: 6 }}>Company-wide view across all clients and depots.</p>
      </div>
      <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { icon: Users, label: "Active clients", value: `${summary.activeClients} / ${summary.totalClients}` },
          { icon: CreditCard, label: "Total client balances", value: currency(summary.totalClientBalances) },
          { icon: TrendingUp, label: "Completed revenue", value: currency(summary.completedRevenue) },
          { icon: Package, label: "Open orders", value: summary.openOrders },
        ].map((s, i) => (
          <Card key={i} style={{ padding: 16 }}>
            <s.icon size={18} color={AMBER} />
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, color: CREAM, marginTop: 12, fontWeight: 600 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{s.label}</div>
          </Card>
        ))}
      </div>
      {summary.pendingTopUps > 0 && (
        <div style={{ background: "rgba(232,114,44,.08)", border: `1px solid ${AMBER}`, borderRadius: 4,
          padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, color: CREAM, fontSize: 13 }}>
          <AlertTriangle size={16} color={AMBER} />
          {summary.pendingTopUps} top-up request{summary.pendingTopUps > 1 ? "s" : ""} waiting on approval
        </div>
      )}
      <Card>
        <SectionLabel>Depot fuel levels</SectionLabel>
        <div className="depot-fuel-row" style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          {depots.map((d) => {
            const level = pct(d);
            return (
              <div key={d.id} style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: CREAM, fontWeight: 600, fontSize: 14 }}>{d.name}</span>
                  <span style={{ color: level < 45 ? RED : GREEN, fontWeight: 700, fontSize: 14 }}>{level}%</span>
                </div>
                <div style={{ height: 8, background: LINE, borderRadius: 4, marginTop: 8, overflow: "hidden" }}>
                  <div style={{ width: `${level}%`, height: "100%", background: level < 45 ? RED : AMBER }} />
                </div>
                <div style={{ color: MUTED, fontSize: 12, marginTop: 6 }}>
                  {Number(d.level_litres).toLocaleString()} L / {Number(d.capacity_litres).toLocaleString()} L · {currency(sellPrice(d))}/L
                </div>
                {level < 45 && d.incoming_delivery && (
                  <div style={{ color: GREEN, fontSize: 11.5, marginTop: 6, display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                    <Truck size={12} /> {Number(d.incoming_delivery.litres).toLocaleString()} L on the way
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <SectionLabel>Recent orders (all depots)</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {orders.slice(0, 5).map((o, i) => (
            <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE}` }}>
              <div>
                <div style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{o.order_number}</div>
                <div style={{ color: MUTED, fontSize: 12 }}>{o.depot_name} · {Number(o.litres_approved).toLocaleString()} L · {fmtDate(o.created_at)}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{currency(o.total_actual ?? o.total_approved)}</span>
                <StatusPill status={o.status} />
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <div style={{ color: MUTED, fontSize: 13, padding: "16px 0", textAlign: "center" }}>No orders yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ---- Clients --------------------------------------------------------------
function Clients({ clients, onSelectClient, onLog, refresh }) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [street, setStreet] = useState("");
  const [town, setTown] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [newAccount, setNewAccount] = useState("");
  const [newCreditLimit, setNewCreditLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.account_number.toLowerCase().includes(search.toLowerCase())
  );

  async function toggleStatus(client, e) {
    e.stopPropagation();
    setBusy(true);
    try {
      await setClientStatusApi(client.id, client.status === "Active" ? "Suspended" : "Active");
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  function handleNameChange(value) {
    setNewName(value);
  }
  const requiredFilled = newName.trim() && tradingName.trim() && regNumber.trim() && vatNumber.trim()
    && street.trim() && town.trim() && city.trim() && postalCode.trim();
  function resetForm() {
    setNewName(""); setTradingName(""); setRegNumber(""); setVatNumber("");
    setStreet(""); setTown(""); setCity(""); setPostalCode("");
    setNewAccount(""); setNewCreditLimit(""); setAdding(false);
  }
  async function createClient() {
    if (!requiredFilled) return;
    setBusy(true);
    setError("");
    try {
      const created = await createClientApi({
        registeredName: newName.trim(), tradingName: tradingName.trim(),
        regNumber: regNumber.trim(), vatNumber: vatNumber.trim(),
        street: street.trim(), town: town.trim(), city: city.trim(), postalCode: postalCode.trim(),
        accountNumber: newAccount.trim() || undefined, creditLimit: Number(newCreditLimit) || 0,
      });
      onLog(`Onboarded new client — ${created.name} (${created.account_number})`);
      await refresh();
      resetForm();
      onSelectClient(created.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, color: CREAM, margin: 0, fontWeight: 600 }}>Clients</h1>
          <p style={{ color: MUTED, fontSize: 14, marginTop: 6 }}>All company accounts registered on Routes.</p>
        </div>
        <button onClick={() => (adding ? resetForm() : setAdding(true))} style={{
          background: adding ? SURFACE_2 : AMBER, color: adding ? CREAM : "#FFFFFF",
          border: `1px solid ${adding ? LINE : AMBER}`, borderRadius: 4, padding: "10px 16px",
          fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        }}>
          {adding ? <X size={14} /> : <Users size={14} />} {adding ? "Cancel" : "New client"}
        </button>
      </div>
      {error && (
        <div style={{ background: "rgba(193,68,60,.08)", border: `1px solid ${RED}`, borderRadius: 4,
          padding: "10px 14px", color: RED, fontSize: 12.5, fontWeight: 600 }}>
          {error}
        </div>
      )}
      {adding && (
        <Card style={{ border: `1px solid ${AMBER}` }}>
          <SectionLabel>Onboard a new client</SectionLabel>
          <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>Registered company name *</div>
              <input value={newName} onChange={(e) => handleNameChange(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>Trading name *</div>
              <input value={tradingName} onChange={(e) => setTradingName(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
            <div>
              <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>Company registration number *</div>
              <input value={regNumber} onChange={(e) => setRegNumber(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>VAT or tax number *</div>
              <input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginTop: 14, background: SURFACE_2, border: `1px solid ${LINE}`, borderRadius: 4, padding: 14 }}>
            <div style={{ color: CREAM, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Business address</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>Street address *</div>
              <input value={street} onChange={(e) => setStreet(e.target.value)} style={inputStyle} />
            </div>
            <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>Town *</div>
                <input value={town} onChange={(e) => setTown(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>City *</div>
                <input value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>Postal code *</div>
                <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>
          <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
            <div>
              <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>Account number (leave blank to auto-generate)</div>
              <input value={newAccount} onChange={(e) => setNewAccount(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>Starting credit limit (R)</div>
              <input type="number" min={0} step={1000} value={newCreditLimit}
                onChange={(e) => setNewCreditLimit(e.target.value)} placeholder="e.g. 50000" style={inputStyle} />
            </div>
          </div>
          <p style={{ color: MUTED, fontSize: 11.5, marginTop: 12, marginBottom: 0 }}>
            The account starts with R 0,00 available balance and Active status. Vehicles, drivers and team administrators are added by the client once they log in.
          </p>
          <button disabled={!requiredFilled || busy} onClick={createClient} style={{
            marginTop: 14, background: requiredFilled ? AMBER : LINE,
            color: "#FFFFFF", border: "none", borderRadius: 4, padding: "10px 18px",
            fontSize: 13, fontWeight: 700, cursor: requiredFilled ? "pointer" : "not-allowed",
          }}>
            Create client account
          </button>
        </Card>
      )}
      <div style={{ position: "relative", maxWidth: 320 }}>
        <Search size={15} color={MUTED} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
        <input placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, paddingLeft: 36 }} />
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-scroll">
          <div style={{ minWidth: 600 }}>
            <div className="table-grid-5" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1.1fr", gap: 8,
              padding: "12px 20px", background: SURFACE_2, borderBottom: `1px solid ${LINE}` }}>
              {["Client", "Account", "Balance", "Orders this month", "Status"].map((h) => (
                <span key={h} style={{ color: MUTED, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>{h}</span>
              ))}
            </div>
            {filtered.map((c, i) => (
              <div key={c.id} onClick={() => onSelectClient(c.id)} className="table-grid-5" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1.1fr", gap: 8,
                padding: "14px 20px", alignItems: "center", cursor: "pointer",
                borderBottom: i === filtered.length - 1 ? "none" : `1px solid ${LINE}` }}>
                <span style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                <span style={{ color: MUTED, fontSize: 12 }}>{c.account_number}</span>
                <span style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{currency(c.available_balance)}</span>
                <span style={{ color: MUTED, fontSize: 12 }}>{c.orders_this_month}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StatusPill status={c.status} />
                  <button disabled={busy} onClick={(e) => toggleStatus(c, e)} style={{
                    background: "transparent", border: `1px solid ${LINE}`, color: MUTED,
                    borderRadius: 4, padding: "4px 8px", fontSize: 10.5, fontWeight: 600, cursor: "pointer",
                  }}>
                    {c.status === "Active" ? "Suspend" : "Reactivate"}
                  </button>
                  <ChevronRight size={14} color={MUTED} />
                </div>
              </div>
            ))}
          </div>
        </div>
        {filtered.length === 0 && (
          <div style={{ color: MUTED, fontSize: 13, padding: 24, textAlign: "center" }}>No clients match your search.</div>
        )}
      </Card>
    </div>
  );
}

// ---- Top-up approvals -------------------------------------------------------
function TopUpApprovals({ requests, onLog, refresh }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = requests.filter(r => r.status === "Pending");
  const history = requests.filter(r => r.status !== "Pending");

  async function decide(request, approve) {
    setBusy(true);
    setError("");
    try {
      if (approve) await approveTopupApi(request.id);
      else await rejectTopupApi(request.id);
      onLog(
        approve
          ? `Approved top-up ${request.request_number} for ${currency(request.amount)}`
          : `Rejected top-up ${request.request_number} for ${currency(request.amount)}`
      );
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
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, color: CREAM, margin: 0, fontWeight: 600 }}>Top-up approvals</h1>
        <p style={{ color: MUTED, fontSize: 14, marginTop: 6 }}>
          Clients cannot add funds themselves — every top-up needs proof of payment reviewed and approved here first.
        </p>
      </div>
      {error && (
        <div style={{ background: "rgba(193,68,60,.08)", border: `1px solid ${RED}`, borderRadius: 4,
          padding: "10px 14px", color: RED, fontSize: 12.5, fontWeight: 600 }}>
          {error}
        </div>
      )}
      <Card>
        <SectionLabel>Awaiting approval</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {pending.map((r, i) => (
            <div key={r.id} style={{ padding: "14px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 4, background: SURFACE_2,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <CreditCard size={18} color={AMBER} />
                  </div>
                  <div>
                    <div style={{ color: CREAM, fontSize: 14, fontWeight: 700 }}>{r.request_number} · {r.client_name}</div>
                    <div style={{ color: MUTED, fontSize: 12, marginTop: 3 }}>Requested {currency(r.amount)} · {fmtDate(r.created_at)}</div>
                    {r.proof_file_name ? (
                      <div style={{
                        marginTop: 8, display: "flex", alignItems: "center", gap: 6,
                        background: SURFACE_2, border: `1px solid ${LINE}`, color: CREAM,
                        borderRadius: 4, padding: "6px 10px", fontSize: 12, fontWeight: 600, width: "fit-content",
                      }}>
                        <Eye size={13} /> Proof: {r.proof_file_name}
                      </div>
                    ) : (
                      <div style={{
                        marginTop: 8, display: "flex", alignItems: "center", gap: 6,
                        color: AMBER, fontSize: 12, fontWeight: 600,
                      }}>
                        <AlertTriangle size={13} /> No proof of payment attached — verify before approving
                      </div>
                    )}
                  </div>
                </div>
                <StatusPill status={r.status} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
                <button disabled={busy} onClick={() => decide(r, true)} style={{
                  background: AMBER, color: "#FFFFFF", border: "none", borderRadius: 4,
                  padding: "9px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <Check size={13} /> Approve top-up
                </button>
                <button disabled={busy} onClick={() => decide(r, false)} style={{
                  background: "transparent", color: RED, border: `1px solid ${RED}`, borderRadius: 4,
                  padding: "9px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <X size={13} /> Reject
                </button>
              </div>
            </div>
          ))}
          {pending.length === 0 && (
            <div style={{ color: MUTED, fontSize: 13, padding: "20px 0", textAlign: "center" }}>Nothing waiting on approval.</div>
          )}
        </div>
      </Card>
      <Card>
        <SectionLabel>History</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {history.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <FileText size={16} color={STEEL} />
                <div>
                  <div style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{r.request_number} · {r.client_name}</div>
                  <div style={{ color: MUTED, fontSize: 12 }}>{currency(r.amount)} · {fmtDate(r.created_at)}</div>
                </div>
              </div>
              <StatusPill status={r.status} />
            </div>
          ))}
          {history.length === 0 && (
            <div style={{ color: MUTED, fontSize: 13, padding: "16px 0", textAlign: "center" }}>No decisions yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ---- Depots -----------------------------------------------------------------
function Depots({ depots, onLog, refresh }) {
  const [editingId, setEditingId] = useState(null);
  const [editCost, setEditCost] = useState("");
  const [editMarkup, setEditMarkup] = useState("");
  const [receivingId, setReceivingId] = useState(null);
  const [deliveryLitres, setDeliveryLitres] = useState("");
  const [schedulingId, setSchedulingId] = useState(null);
  const [scheduleLitres, setScheduleLitres] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function startEdit(d) {
    setEditingId(d.id);
    setEditCost(String(d.cost_per_litre));
    setEditMarkup(String(d.markup_per_litre));
  }
  async function saveEdit(depot) {
    const cost = Number(editCost);
    const markup = Number(editMarkup);
    if (cost > 0 && markup >= 0) {
      setBusy(true);
      setError("");
      try {
        await setDepotPricingApi(depot.id, cost, markup);
        onLog(`Updated ${depot.name} pricing — cost ${currency(cost)}, markup ${currency(markup)}/L`);
        await refresh();
        setEditingId(null);
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    }
  }
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
      const created = await scheduleDelivery(depot.id, litres, null);
      await receiveDelivery(created.id, litres);
      onLog(`Received fuel delivery of ${litres.toLocaleString()} L at ${depot.name}`);
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
      if (depot.incoming_delivery) await cancelDelivery(depot.incoming_delivery.id);
      await scheduleDelivery(depot.id, litres, eta);
      onLog(`Scheduled a delivery of ${litres.toLocaleString()} L at ${depot.name}`);
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
      onLog(`Cleared scheduled delivery at ${depot.name}`);
      await refresh();
      setSchedulingId(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, color: CREAM, margin: 0, fontWeight: 600 }}>Depots</h1>
        <p style={{ color: MUTED, fontSize: 14, marginTop: 6 }}>Manage cost, markup and capacity across all Routes depots.</p>
      </div>
      {error && (
        <div style={{ background: "rgba(193,68,60,.08)", border: `1px solid ${RED}`, borderRadius: 4,
          padding: "10px 14px", color: RED, fontSize: 12.5, fontWeight: 600 }}>
          {error}
        </div>
      )}
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {depots.map((d) => {
          const sell = sellPrice(d);
          const profit = profitPerLitre(d);
          const level = pct(d);
          return (
            <Card key={d.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Building2 size={18} color={AMBER} />
                <div>
                  <div style={{ color: CREAM, fontWeight: 700, fontSize: 15 }}>{d.name}</div>
                  <div style={{ color: MUTED, fontSize: 12, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <MapPin size={11} /> {d.region}
                  </div>
                  {d.address && <div style={{ color: MUTED, fontSize: 11.5, marginTop: 2 }}>{d.address}</div>}
                  {d.latitude != null && (
                    <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>{Number(d.latitude).toFixed(6)}, {Number(d.longitude).toFixed(6)}</div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: MUTED, fontSize: 12 }}>Tank level</span>
                <span style={{ color: level < 45 ? RED : CREAM, fontSize: 12, fontWeight: 600 }}>
                  {level}% ({Number(d.level_litres).toLocaleString()} L)
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ color: MUTED, fontSize: 12 }}>Capacity</span>
                <span style={{ color: CREAM, fontSize: 12, fontWeight: 600 }}>{Number(d.capacity_litres).toLocaleString()} L</span>
              </div>
              {d.incoming_delivery && schedulingId !== d.id && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <div style={{ color: GREEN, fontSize: 11.5, display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                    <Truck size={12} /> {Number(d.incoming_delivery.litres).toLocaleString()} L on the way
                    {d.incoming_delivery.eta && ` · ETA ${fmtDate(d.incoming_delivery.eta)}`}
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
                  marginTop: 8, background: "transparent", border: "none", color: STEEL,
                  fontSize: 11.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                }}>
                  <Truck size={12} /> Schedule an incoming delivery
                </button>
              )}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${LINE}` }}>
                {receivingId === d.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ color: MUTED, fontSize: 11 }}>Litres received</div>
                    <input type="number" min={1} max={Number(d.capacity_litres) - Number(d.level_litres)}
                      placeholder={`Up to ${(Number(d.capacity_litres) - Number(d.level_litres)).toLocaleString()} L room left`}
                      value={deliveryLitres} onChange={(e) => setDeliveryLitres(e.target.value)} style={inputStyle} />
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
                    display: "flex", alignItems: "center", gap: 6, width: "100%", justifyContent: "center",
                  }}>
                    <Truck size={13} /> Add fuel received
                  </button>
                )}
              </div>
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${LINE}` }}>
                <SectionLabel>Cost &amp; pricing</SectionLabel>
                {editingId === d.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>Cost per litre (R)</div>
                      <input type="number" min={0} step={0.01} value={editCost}
                        onChange={(e) => setEditCost(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>Markup per litre (R)</div>
                      <input type="number" min={0} step={0.01} value={editMarkup}
                        onChange={(e) => setEditMarkup(e.target.value)} style={inputStyle} />
                    </div>
                    {editCost && editMarkup && (
                      <div style={{ color: GREEN, fontSize: 12, fontWeight: 600 }}>
                        Sell price would be {currency(Number(editCost) + Number(editMarkup))} / L
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button disabled={busy} onClick={() => saveEdit(d)} style={{
                        flex: 1, background: AMBER, color: "#FFFFFF", border: "none", borderRadius: 4,
                        padding: "9px 0", fontWeight: 700, fontSize: 12, cursor: "pointer",
                      }}>
                        Save
                      </button>
                      <button disabled={busy} onClick={() => setEditingId(null)} style={{
                        background: "transparent", color: MUTED, border: `1px solid ${LINE}`, borderRadius: 4,
                        padding: "9px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer",
                      }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: MUTED, fontSize: 12 }}>Cost per litre</span>
                      <span style={{ color: CREAM, fontSize: 12, fontWeight: 600 }}>{currency(d.cost_per_litre)} / L</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ color: MUTED, fontSize: 12 }}>Markup / profit per litre</span>
                      <span style={{ color: GREEN, fontSize: 12, fontWeight: 700 }}>{currency(profit)} / L</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                      paddingTop: 10, borderTop: `1px solid ${LINE}` }}>
                      <div>
                        <div style={{ color: MUTED, fontSize: 11 }}>Sell price to clients</div>
                        <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, color: STEEL, fontWeight: 700 }}>
                          {currency(sell)} / L
                        </span>
                      </div>
                      <button disabled={busy} onClick={() => startEdit(d)} style={{
                        background: "transparent", border: `1px solid ${LINE}`, color: CREAM,
                        borderRadius: 4, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}>
                        Edit
                      </button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ---- Orders (all depots) -----------------------------------------------------
function Orders({ orders, depots }) {
  const [filter, setFilter] = useState("All");
  const filters = ["All", "Open", "Confirmed", "En route", "Completed"];
  const statusFiltered = filter === "All" ? orders : orders.filter(o => o.status === filter);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, color: CREAM, margin: 0, fontWeight: 600 }}>Orders</h1>
        <p style={{ color: MUTED, fontSize: 14, marginTop: 6 }}>Every order across every client, grouped by depot.</p>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "7px 13px", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer",
            background: filter === f ? "rgba(232,114,44,.10)" : "transparent",
            border: `1px solid ${filter === f ? AMBER : LINE}`,
            color: filter === f ? AMBER : MUTED,
          }}>
            {f}
          </button>
        ))}
      </div>
      {depots.map((d) => {
        const depotOrders = statusFiltered.filter(o => o.depot_name === d.name);
        return (
          <Card key={d.id} style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: `1px solid ${LINE}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Building2 size={16} color={AMBER} />
                <span style={{ color: CREAM, fontWeight: 700, fontSize: 14 }}>{d.name}</span>
                <span style={{ color: MUTED, fontSize: 12 }}>· {d.region}</span>
              </div>
              <span style={{ color: MUTED, fontSize: 12 }}>{depotOrders.length} order{depotOrders.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="table-scroll">
              <div style={{ minWidth: 520 }}>
                <div className="table-grid-5b" style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr 1fr 0.9fr", gap: 8,
                  padding: "10px 20px", background: SURFACE_2, borderBottom: `1px solid ${LINE}` }}>
                  {["Order", "Client", "Litres", "Total", "Status"].map((h) => (
                    <span key={h} style={{ color: MUTED, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>{h}</span>
                  ))}
                </div>
                {depotOrders.map((o, i) => (
                  <div key={o.id} className="table-grid-5b" style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr 1fr 0.9fr", gap: 8,
                    padding: "14px 20px", alignItems: "center", borderBottom: i === depotOrders.length - 1 ? "none" : `1px solid ${LINE}` }}>
                    <span style={{ color: CREAM, fontSize: 13, fontWeight: 700 }}>{o.order_number}</span>
                    <span style={{ color: CREAM, fontSize: 12.5 }}>{o.client_name || o.client_id}</span>
                    <span style={{ color: MUTED, fontSize: 12 }}>{Number(o.litres_approved).toLocaleString()} L</span>
                    <span style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{currency(o.total_actual ?? o.total_approved)}</span>
                    <StatusPill status={o.status} />
                  </div>
                ))}
              </div>
            </div>
            {depotOrders.length === 0 && (
              <div style={{ color: MUTED, fontSize: 13, padding: 20, textAlign: "center" }}>No orders match this view.</div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ---- Reports ------------------------------------------------------------
function Reports({ orders, invoices, depots, clients }) {
  const outstanding = invoices.filter(i => i.status !== "Paid").reduce((s, i) => s + Number(i.amount), 0);
  const overdueInvoices = invoices.filter(i => i.status === "Overdue");
  const avgProfitPerLitre = depots.length ? depots.reduce((s, d) => s + profitPerLitre(d), 0) / depots.length : 0;
  const clientCreditAvailable = clients.reduce((s, c) => s + Number(c.available_balance), 0);
  const clientDebt = outstanding;
  const completedOrders = orders.filter(o => o.status === "Completed");
  const totalLitres = completedOrders.reduce((s, o) => s + Number(o.litres_actual ?? o.litres_approved), 0);
  const totalRevenue = completedOrders.reduce((s, o) => s + Number(o.total_actual ?? o.total_approved), 0);

  // Group completed orders by month for the last 6 months present in the data.
  function monthKey(d) { const dt = new Date(d); return `${dt.getFullYear()}-${dt.getMonth()}`; }
  function monthLabel(d) { return new Date(d).toLocaleDateString("en-ZA", { month: "short" }); }
  const monthMap = new Map();
  completedOrders.forEach(o => {
    const key = monthKey(o.completed_at || o.created_at);
    const entry = monthMap.get(key) || { label: monthLabel(o.completed_at || o.created_at), revenue: 0, litres: 0 };
    entry.revenue += Number(o.total_actual ?? o.total_approved);
    entry.litres += Number(o.litres_actual ?? o.litres_approved);
    monthMap.set(key, entry);
  });
  const monthsSorted = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([, v]) => v);
  const revenueByMonth = monthsSorted.map(m => ({ label: m.label, value: m.revenue }));
  const litresByMonth = monthsSorted.map(m => ({ label: m.label, value: m.litres }));
  const profitByMonth = monthsSorted.map(m => ({ label: m.label, value: m.revenue * (avgProfitPerLitre / (avgProfitPerLitre + (depots[0] ? Number(depots[0].cost_per_litre) : 0) || 1)) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, color: CREAM, margin: 0, fontWeight: 600 }}>Reports</h1>
        <p style={{ color: MUTED, fontSize: 14, marginTop: 6 }}>Financial performance across the whole company.</p>
      </div>
      <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <Card style={{ padding: 16 }}>
          <div style={{ color: MUTED, fontSize: 12 }}>Client credit available</div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, color: GREEN, marginTop: 6, fontWeight: 600 }}>{currency(clientCreditAvailable)}</div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ color: MUTED, fontSize: 12 }}>Total litres fuelled</div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, color: STEEL, marginTop: 6, fontWeight: 600 }}>{Math.round(totalLitres).toLocaleString()} L</div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ color: MUTED, fontSize: 12 }}>Client debt (unpaid invoices)</div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, color: RED, marginTop: 6, fontWeight: 600 }}>{currency(clientDebt)}</div>
        </Card>
      </div>
      <Card>
        <SectionLabel>Markup &amp; profit</SectionLabel>
        <div className="depot-fuel-row" style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 24, color: GREEN, fontWeight: 700 }}>{currency(avgProfitPerLitre)}</div>
            <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>Average markup per litre</div>
          </div>
          {depots.map((d) => (
            <div key={d.id}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, color: CREAM, fontWeight: 700 }}>
                {currency(profitPerLitre(d))} <span style={{ fontSize: 11, color: MUTED, fontWeight: 500 }}>/ L</span>
              </div>
              <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{d.name}</div>
            </div>
          ))}
        </div>
      </Card>
      {revenueByMonth.length > 0 && (
        <>
          <Card>
            <SectionLabel>Litres by month</SectionLabel>
            <BarChart data={litresByMonth} color={STEEL} gradientId="litresMonthGrad"
              formatValue={(v) => `${(v / 1000).toFixed(1)}k L`} />
          </Card>
          <Card>
            <SectionLabel>Revenue by month</SectionLabel>
            <BarChart data={revenueByMonth} color={AMBER} gradientId="revMonthGrad"
              formatValue={(v) => `R${(v / 1000).toFixed(0)}k`} />
          </Card>
        </>
      )}
      <Card>
        <SectionLabel>Overdue invoices</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {overdueInvoices.map((inv, i) => (
            <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <FileText size={16} color={RED} />
                <div>
                  <div style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{inv.invoice_number}</div>
                  <div style={{ color: MUTED, fontSize: 12 }}>Order {inv.order_number} · Was due {fmtDate(inv.due_date)}</div>
                </div>
              </div>
              <span style={{ color: RED, fontSize: 13, fontWeight: 700 }}>{currency(inv.amount)}</span>
            </div>
          ))}
          {overdueInvoices.length === 0 && (
            <div style={{ color: MUTED, fontSize: 13, padding: "16px 0", textAlign: "center" }}>Nothing overdue right now.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ---- Client detail --------------------------------------------------------
function ClientDetail({ client, orders, topUpRequests, auditLog, depots, onBack, onToggleStatus, onSetClientPrice, onSetCreditLimit }) {
  const clientOrders = orders.filter(o => o.client_id === client.id);
  const clientTopUps = topUpRequests.filter(r => r.client_id === client.id);
  const clientAudit = auditLog.filter(a => a.target === client.name);
  const totalSpend = clientOrders.filter(o => o.status === "Completed").reduce((s, o) => s + Number(o.total_actual ?? o.total_approved), 0);
  const [pricing, setPricing] = useState([]);
  const [editingDepotId, setEditingDepotId] = useState(null);
  const [priceInput, setPriceInput] = useState("");
  const [editingCredit, setEditingCredit] = useState(false);
  const [creditInput, setCreditInput] = useState(String(client.credit_limit));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadPricing = useCallback(async () => {
    try {
      const rows = await getClientPricing(client.id);
      setPricing(rows);
    } catch (e) {
      setError(e.message);
    }
  }, [client.id]);
  useEffect(() => { loadPricing(); }, [loadPricing]);

  function startEditPrice(depot) {
    setEditingDepotId(depot.id);
    const existing = pricing.find(p => p.depot_id === depot.id);
    setPriceInput(existing ? String(existing.price_per_litre) : "");
  }
  async function savePrice(depot) {
    setBusy(true);
    setError("");
    try {
      const val = priceInput === "" ? null : Number(priceInput);
      await onSetClientPrice(client, depot, val);
      await loadPricing();
      setEditingDepotId(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveCreditLimit() {
    const val = Number(creditInput);
    if (val >= 0) {
      setBusy(true);
      setError("");
      try {
        await onSetCreditLimit(client, val);
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    }
    setEditingCredit(false);
  }
  async function toggleStatus() {
    setBusy(true);
    setError("");
    try {
      await onToggleStatus(client);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <button onClick={onBack} style={{
        display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none",
        color: MUTED, fontSize: 13, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start", padding: 0,
      }}>
        <ChevronLeft size={15} /> Back to clients
      </button>
      {error && (
        <div style={{ background: "rgba(193,68,60,.08)", border: `1px solid ${RED}`, borderRadius: 4,
          padding: "10px 14px", color: RED, fontSize: 12.5, fontWeight: 600 }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, color: CREAM, margin: 0, fontWeight: 600 }}>{client.name}</h1>
          <p style={{ color: MUTED, fontSize: 14, marginTop: 6 }}>Account {client.account_number}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StatusPill status={client.status} />
          <button disabled={busy} onClick={toggleStatus} style={{
            background: client.status === "Active" ? "transparent" : AMBER,
            color: client.status === "Active" ? RED : "#FFFFFF",
            border: `1px solid ${client.status === "Active" ? RED : AMBER}`,
            borderRadius: 4, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>
            {client.status === "Active" ? "Suspend account" : "Reactivate account"}
          </button>
        </div>
      </div>
      <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <Card style={{ padding: 16 }}>
          <Wallet size={17} color={AMBER} />
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, color: CREAM, marginTop: 10, fontWeight: 600 }}>{currency(client.available_balance)}</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Available balance</div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <CreditCard size={17} color={AMBER} />
            {!editingCredit && (
              <button onClick={() => { setEditingCredit(true); setCreditInput(String(client.credit_limit)); }} style={{
                background: "transparent", border: "none", color: MUTED, fontSize: 11, fontWeight: 600, cursor: "pointer",
                textDecoration: "underline",
              }}>
                Edit
              </button>
            )}
          </div>
          {editingCredit ? (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              <input type="number" min={0} step={1000} value={creditInput}
                onChange={(e) => setCreditInput(e.target.value)} style={{ ...inputStyle, padding: "6px 8px", fontSize: 13 }} />
              <div style={{ display: "flex", gap: 6 }}>
                <button disabled={busy} onClick={saveCreditLimit} style={{
                  background: AMBER, color: "#FFFFFF", border: "none", borderRadius: 4,
                  padding: "5px 10px", fontWeight: 700, fontSize: 11, cursor: "pointer",
                }}>
                  Save
                </button>
                <button disabled={busy} onClick={() => setEditingCredit(false)} style={{
                  background: "transparent", color: MUTED, border: `1px solid ${LINE}`, borderRadius: 4,
                  padding: "5px 10px", fontWeight: 700, fontSize: 11, cursor: "pointer",
                }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, color: CREAM, marginTop: 6, fontWeight: 600 }}>{currency(client.credit_limit)}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Credit limit</div>
            </>
          )}
        </Card>
        <Card style={{ padding: 16 }}>
          <TrendingUp size={17} color={AMBER} />
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, color: CREAM, marginTop: 10, fontWeight: 600 }}>{currency(totalSpend)}</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Completed spend</div>
        </Card>
        <Card style={{ padding: 16 }}>
          <Truck size={17} color={AMBER} />
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, color: CREAM, marginTop: 10, fontWeight: 600 }}>{client.vehicle_count} / {client.driver_count}</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Vehicles / Drivers</div>
        </Card>
      </div>
      <Card>
        <SectionLabel>Pricing per depot</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {depots.map((d, i) => {
            const custom = pricing.find(p => p.depot_id === d.id);
            const isEditing = editingDepotId === d.id;
            return (
              <div key={d.id} style={{ padding: "14px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{d.name}</div>
                    <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>Depot default: {currency(sellPrice(d))} / L</div>
                  </div>
                  {!isEditing && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {custom ? (
                        <span style={{ color: AMBER, fontWeight: 700, fontSize: 14, fontFamily: "'Oswald', sans-serif" }}>
                          {currency(custom.price_per_litre)} / L <span style={{ fontSize: 10.5, color: MUTED, fontWeight: 600 }}>custom</span>
                        </span>
                      ) : (
                        <span style={{ color: MUTED, fontSize: 12 }}>Using default</span>
                      )}
                      <button onClick={() => startEditPrice(d)} style={{
                        background: "transparent", border: `1px solid ${LINE}`, color: CREAM,
                        borderRadius: 4, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}>
                        {custom ? "Edit" : "Assign"}
                      </button>
                    </div>
                  )}
                </div>
                {isEditing && (
                  <div style={{ marginTop: 10, background: SURFACE_2, border: `1px solid ${LINE}`, borderRadius: 4,
                    padding: 14, display: "flex", alignItems: "flex-end", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>Custom price for {d.name} (R) — leave blank for default</div>
                      <input type="number" min={0} step={0.01} placeholder={`Default ${currency(sellPrice(d))}`}
                        value={priceInput} onChange={(e) => setPriceInput(e.target.value)} style={inputStyle} />
                    </div>
                    <button disabled={busy} onClick={() => savePrice(d)} style={{
                      background: AMBER, color: "#FFFFFF", border: "none", borderRadius: 4,
                      padding: "10px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}>
                      Save
                    </button>
                    <button disabled={busy} onClick={() => setEditingDepotId(null)} style={{
                      background: "transparent", color: MUTED, border: `1px solid ${LINE}`, borderRadius: 4,
                      padding: "10px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <SectionLabel>Order history</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {clientOrders.map((o, i) => (
            <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE}` }}>
              <div>
                <div style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{o.order_number}</div>
                <div style={{ color: MUTED, fontSize: 12 }}>{o.depot_name} · {Number(o.litres_approved).toLocaleString()} L · {fmtDate(o.created_at)}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{currency(o.total_actual ?? o.total_approved)}</span>
                <StatusPill status={o.status} />
              </div>
            </div>
          ))}
          {clientOrders.length === 0 && (
            <div style={{ color: MUTED, fontSize: 13, padding: "16px 0", textAlign: "center" }}>No orders yet.</div>
          )}
        </div>
      </Card>
      <Card>
        <SectionLabel>Top-up history</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {clientTopUps.map((r, i) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE}` }}>
              <div>
                <div style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{r.request_number}</div>
                <div style={{ color: MUTED, fontSize: 12 }}>{fmtDate(r.created_at)}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{currency(r.amount)}</span>
                <StatusPill status={r.status} />
              </div>
            </div>
          ))}
          {clientTopUps.length === 0 && (
            <div style={{ color: MUTED, fontSize: 13, padding: "16px 0", textAlign: "center" }}>No top-up requests yet.</div>
          )}
        </div>
      </Card>
      {clientAudit.length > 0 && (
        <Card>
          <SectionLabel>Account activity</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {clientAudit.map((a, i) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE}` }}>
                <span style={{ color: CREAM, fontSize: 12.5 }}>{a.action}</span>
                <span style={{ color: MUTED, fontSize: 11.5 }}>{a.actor} · {fmtDateTime(a.created_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ---- Audit log ---------------------------------------------------------
function AuditLog({ log }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, color: CREAM, margin: 0, fontWeight: 600 }}>Audit log</h1>
        <p style={{ color: MUTED, fontSize: 14, marginTop: 6 }}>A record of every admin decision — approvals, rejections, suspensions, price changes.</p>
      </div>
      <Card>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {log.map((a, i) => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              padding: "14px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE}` }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: SURFACE_2,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <History size={15} color={AMBER} />
                </div>
                <div>
                  <div style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>{a.action}</div>
                  {a.target && <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{a.target}</div>}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: CREAM, fontSize: 12, fontWeight: 600 }}>{a.actor}</div>
                <div style={{ color: MUTED, fontSize: 11.5, marginTop: 2 }}>{fmtDateTime(a.created_at)}</div>
              </div>
            </div>
          ))}
          {log.length === 0 && (
            <div style={{ color: MUTED, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No admin actions recorded yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

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
            Admin login
          </h1>
          <p style={{ color: MUTED, fontSize: 13, marginTop: 6, marginBottom: 22, textAlign: "center" }}>
            Sign in to manage clients, depots and finances.
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
          Not head office staff? <a href="#" style={{ color: AMBER, fontWeight: 600, textDecoration: "none" }}>Contact your administrator</a>
        </p>
      </div>
    </div>
  );
}

// ---- App shell --------------------------------------------------------------
function AdminApp({ onLogout }) {
  const [tab, setTab] = useState("overview");
  const [clients, setClients] = useState([]);
  const [depots, setDepots] = useState([]);
  const [topUpRequests, setTopUpRequests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [summary, setSummary] = useState({ totalClients: 0, activeClients: 0, totalClientBalances: 0, completedRevenue: 0, openOrders: 0, pendingTopUps: 0 });
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadAll = useCallback(async () => {
    try {
      const [summaryData, clientsData, depotsData, topupsData, ordersData, invoicesData, auditData] = await Promise.all([
        getSummary(), getAdminClients(), getDepots(), getTopups(), getOrders(), getInvoices(), getAuditLog(),
      ]);
      setSummary(summaryData);
      setClients(clientsData);
      setDepots(depotsData);
      setTopUpRequests(topupsData);
      setOrders(ordersData);
      setInvoices(invoicesData);
      setAuditLog(auditData);
      setLoadError("");
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const pendingTopUps = topUpRequests.filter(r => r.status === "Pending").length;

  async function logAction(action, targetOverride) {
    // The backend already writes most actions to audit_log server-side (top-up
    // decisions, pricing changes, client onboarding, status changes). This is a
    // fallback for anything client-side only, and refreshes the log either way.
    try { await api("/api/audit-log", { method: "POST", body: JSON.stringify({ action, target: targetOverride }) }); } catch {}
  }
  async function toggleClientStatus(client) {
    await setClientStatusApi(client.id, client.status === "Active" ? "Suspended" : "Active");
    await loadAll();
  }
  async function setClientPrice(client, depot, price) {
    await setClientPricingApi(client.id, depot.id, price);
    await loadAll();
  }
  async function setCreditLimit(client, limit) {
    await setCreditLimitApi(client.id, limit);
    await loadAll();
  }

  const nav = [
    { id: "overview", label: "Overview", icon: Gauge },
    { id: "clients", label: "Clients", icon: Users },
    { id: "topups", label: "Top-up approvals", icon: CreditCard },
    { id: "orders", label: "Orders", icon: Package },
    { id: "depots", label: "Depots", icon: Building2 },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "audit", label: "Audit log", icon: History },
  ];

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: INK, color: MUTED, fontFamily: "'Inter', sans-serif" }}>Loading admin data…</div>;
  }
  if (loadError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: INK, fontFamily: "'Inter', sans-serif", padding: 20 }}>
        <Card style={{ maxWidth: 420 }}>
          <div style={{ color: RED, fontWeight: 700, marginBottom: 8 }}>Couldn't load admin data</div>
          <div style={{ color: MUTED, fontSize: 13 }}>{loadError}</div>
          <button onClick={loadAll} style={{
            marginTop: 14, background: AMBER, color: "#FFFFFF", border: "none", borderRadius: 4,
            padding: "9px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer",
          }}>Retry</button>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-shell" style={{ fontFamily: "'Inter', sans-serif", background: INK, minHeight: "100vh", display: "flex" }}>
      <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        .app-shell { flex-direction: row; }
        .grid-4 { grid-template-columns: repeat(4, 1fr); }
        .grid-3 { grid-template-columns: repeat(3, 1fr); }
        .grid-2 { grid-template-columns: 1fr 1fr; }
        .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .bottom-nav { display: none; }
        @media (max-width: 860px) {
          .app-shell { flex-direction: column; padding-bottom: 64px; }
          .sidebar { display: none !important; }
          .bottom-nav {
            display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 40;
            background: #FFFFFF; border-top: 1px solid #E6E0D4;
            overflow-x: auto; -webkit-overflow-scrolling: touch;
            padding: 8px 4px; gap: 2px;
          }
          .main-content { padding: 20px 16px !important; }
          .grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
          .grid-3 { grid-template-columns: 1fr !important; }
          .grid-2 { grid-template-columns: 1fr !important; }
          .depot-fuel-row { flex-direction: column !important; }
        }
        @media (max-width: 480px) {
          .grid-4 { grid-template-columns: 1fr !important; }
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
            <div style={{ color: MUTED, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Admin portal</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {nav.map((n) => (
            <button key={n.id} onClick={() => { setTab(n.id); setSelectedClientId(null); }} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 4,
              background: tab === n.id ? "rgba(232,114,44,.10)" : "transparent",
              border: "none", cursor: "pointer", textAlign: "left",
              color: tab === n.id ? AMBER : MUTED, fontSize: 13, fontWeight: 600,
            }}>
              <n.icon size={16} />
              {n.label}
              {n.id === "topups" && pendingTopUps > 0 && (
                <span style={{ marginLeft: "auto", background: AMBER, color: "#FFFFFF", fontSize: 10,
                  fontWeight: 700, borderRadius: 10, padding: "1px 6px" }}>
                  {pendingTopUps}
                </span>
              )}
              {tab === n.id && n.id !== "topups" && <ChevronRight size={13} style={{ marginLeft: "auto" }} />}
            </button>
          ))}
        </div>
        <div style={{ marginTop: "auto", padding: 12, background: SURFACE, borderRadius: 4, border: `1px solid ${LINE}` }}>
          <div style={{ color: MUTED, fontSize: 11 }}>Signed in as</div>
          <div style={{ color: CREAM, fontSize: 13, fontWeight: 600, marginTop: 2 }}>Routes Head Office</div>
          <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>Admin account</div>
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
          <button key={n.id} onClick={() => { setTab(n.id); setSelectedClientId(null); }} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            background: "transparent", border: "none", cursor: "pointer",
            color: tab === n.id ? AMBER : MUTED, padding: "4px 10px", flexShrink: 0, position: "relative",
          }}>
            <n.icon size={17} />
            <span style={{ fontSize: 9, fontWeight: 600, textAlign: "center", lineHeight: 1.1, whiteSpace: "nowrap" }}>
              {n.label === "Top-up approvals" ? "Top-ups" : n.label === "Audit log" ? "Audit" : n.label}
            </span>
            {n.id === "topups" && pendingTopUps > 0 && (
              <span style={{ position: "absolute", top: -2, right: 2, background: AMBER, color: "#FFFFFF",
                fontSize: 9, fontWeight: 700, borderRadius: 10, padding: "1px 5px" }}>
                {pendingTopUps}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="main-content" style={{ flex: 1, padding: "32px 40px", overflowY: "auto", minWidth: 0 }}>
        {tab === "overview" && <Overview summary={summary} orders={orders} depots={depots} />}
        {tab === "clients" && !selectedClient && <Clients clients={clients} onSelectClient={setSelectedClientId} onLog={logAction} refresh={loadAll} />}
        {tab === "clients" && selectedClient && (
          <ClientDetail client={selectedClient} orders={orders} topUpRequests={topUpRequests} auditLog={auditLog} depots={depots}
            onBack={() => setSelectedClientId(null)} onToggleStatus={toggleClientStatus} onSetClientPrice={setClientPrice} onSetCreditLimit={setCreditLimit} />
        )}
        {tab === "topups" && <TopUpApprovals requests={topUpRequests} onLog={logAction} refresh={loadAll} />}
        {tab === "orders" && <Orders orders={orders} depots={depots} />}
        {tab === "depots" && <Depots depots={depots} onLog={logAction} refresh={loadAll} />}
        {tab === "reports" && <Reports orders={orders} invoices={invoices} depots={depots} clients={clients} />}
        {tab === "audit" && <AuditLog log={auditLog} />}
      </div>
    </div>
  );
}

// ---- Auth gate — swaps between Login and the app ----------------------------
export default function RoutesAdminDashboard() {
  const [session, setSession] = useState(null);
  if (!session) {
    return <Login onLogin={(s) => setSession(s)} />;
  }
  return <AdminApp onLogout={() => setSession(null)} />;
}
