import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import RoutesClientDashboard from "./portals/RoutesClientDashboard.jsx";
import RoutesDepotDashboard from "./portals/RoutesDepotDashboard.jsx";
import RoutesAdminDashboard from "./portals/RoutesAdminDashboard.jsx";

function Landing() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16,
      fontFamily: "'Inter', sans-serif", background: "#1D1A15", color: "#FFFFFF",
    }}>
      <h1 style={{ fontFamily: "'Oswald', sans-serif" }}>ROUTES</h1>
      <p style={{ color: "rgba(255,255,255,.6)" }}>Choose a portal:</p>
      <div style={{ display: "flex", gap: 12 }}>
        <Link to="/client" style={linkStyle}>Client</Link>
        <Link to="/depot" style={linkStyle}>Depot</Link>
        <Link to="/admin" style={linkStyle}>Admin</Link>
      </div>
    </div>
  );
}
const linkStyle = {
  background: "#E8722C", color: "#FFFFFF", padding: "10px 20px",
  borderRadius: 4, textDecoration: "none", fontWeight: 700,
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/client" element={<RoutesClientDashboard />} />
        <Route path="/depot" element={<RoutesDepotDashboard />} />
        <Route path="/admin" element={<RoutesAdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
