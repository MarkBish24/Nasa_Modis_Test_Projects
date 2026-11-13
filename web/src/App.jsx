import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import Home from "./pages/Home.jsx";
import Visualization from "./pages/Visualization.jsx";
import SupportingGraphs from "./pages/SupportingGraphs.jsx";
import Writeup from "./pages/Writeup.jsx";

const PAGES = [
  { to: "/", label: "Project" },
  { to: "/visualization", label: "Visualization" },
  { to: "/supporting", label: "Supporting graphs", short: "Graphs" }, // short label on phones
  { to: "/writeup", label: "Write-up" },
];

export default function App() {
  const { pathname } = useLocation();
  const headerRef = useRef(null);

  // publish the sticky header's height as --header-h, so other sticky things
  // (the graph nav) and scroll targets can sit right below it
  useEffect(() => {
    const el = headerRef.current;
    const ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // braces matter: newer browsers return a Promise from scrollTo, and an effect
  // must return nothing or a cleanup function
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <header className="site-header" ref={headerRef}>
        <div className="site-header-inner">
          <NavLink to="/" className="brand">The Ocean's Green Pulse</NavLink>
          <nav>
            {PAGES.map((p) => (
              <NavLink key={p.to} to={p.to} end className={({ isActive }) => (isActive ? "active" : "")}>
                {p.short ? (
                  <>
                    <span className="nav-long">{p.label}</span>
                    <span className="nav-short">{p.short}</span>
                  </>
                ) : p.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/visualization" element={<Visualization />} />
          <Route path="/supporting" element={<SupportingGraphs />} />
          {/* old address, so earlier links keep working */}
          <Route path="/exploration" element={<Navigate to="/supporting" replace />} />
          <Route path="/writeup" element={<Writeup />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>

      <footer className="site-footer">
        Data: NASA EOSDIS GIBS · MODIS-Aqua chlorophyll-a · 2003–2022 · DSC 106 Project 3
      </footer>
    </>
  );
}
