import React, { useState } from "react";
import {
  Home, FileText, Wrench, Share2, Search, Bell, Plus, ShieldCheck,
  ChevronRight, CheckCircle2, Clock, AlertTriangle, Upload, MapPin,
  Zap, ArrowRight, Settings, Filter,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * House Passport — UI-prototype
 * Designsystem fra Trin 11: off-white lærred, diskret blå (sparsomt),
 * mørkegrøn = verificeret/positiv, Inter, generøs luft, line-ikoner,
 * ingen emoji. Signatur: dokumentations-/vedligeholdelsesring + verificeret-mærke.
 * Data er formet som API'ets svar (mock).
 * ------------------------------------------------------------------ */

const t = {
  bg: "#FAFAF9",
  surface: "#FFFFFF",
  n100: "#F4F4F3",
  n200: "#E7E7E6",
  n300: "#D6D6D4",
  n400: "#A8A8A5",
  n500: "#787875",
  n600: "#57574F",
  n800: "#262622",
  ink: "#1A1A18",
  blue: "#355CB5",
  blueSubtle: "#EAF0FB",
  green: "#1E5641",
  greenSubtle: "#E8F1ED",
  warn: "#9A5B1A",
  warnSubtle: "#FBF1E3",
  font: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif",
};

const property = {
  address: "Æblevej 12",
  city: "8000 Aarhus",
  type: "Parcelhus",
  area: 142,
  year: 1974,
  value: "3.240.000 kr.",
  energy: "C",
  verified: true,
  score: 72,
  docGrade: 64,
};

const statuses = [
  { label: "Kommende opgaver", value: 2, icon: Clock, tone: "ink" },
  { label: "Aktive garantier", value: 3, icon: ShieldCheck, tone: "green" },
  { label: "Manglende dokumenter", value: 5, icon: AlertTriangle, tone: "warn" },
  { label: "Udløbende serviceaftaler", value: 1, icon: Clock, tone: "warn" },
];

const activity = [
  { text: "Tagrapport uploadet", meta: "AI: kategori “Tag” · verificeret", time: "2 t siden", icon: FileText },
  { text: "Garanti registreret: varmepumpe", meta: "Løber til 2030 (5 år)", time: "i går", icon: ShieldCheck },
  { text: "Anbefaling: rens tagrender", meta: "Sæsonopgave til efteråret", time: "2 dage siden", icon: Wrench },
];

const documents = [
  { name: "Elinstallationsrapport 2023.pdf", cat: "El", status: "processed", verified: true, warranty: "2028", by: "Aarhus El ApS" },
  { name: "Tagrapport_HCTag.pdf", cat: "Tag", status: "processed", verified: true, warranty: "2033", by: "HC Tag ApS" },
  { name: "Varmepumpe_garanti.pdf", cat: "Garanti", status: "processed", verified: false, warranty: "2030", by: "Bosch" },
  { name: "Tilstandsrapport.pdf", cat: "Købsdokumenter", status: "processed", verified: true, warranty: null, by: "Huseftersyn" },
  { name: "Foto_tagrygning.jpg", cat: "Tag", status: "pending", verified: false, warranty: null, by: "Manuel upload" },
];

const categories = [
  ["El", 4], ["VVS", 2], ["Tag", 3], ["Vinduer", 1], ["Garanti", 5],
  ["Forsikring", 1], ["Købsdokumenter", 2], ["Serviceaftaler", 1],
];

/* ---------------------------- primitives ---------------------------- */

function Card({ children, style }) {
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.n200}`, borderRadius: 12,
      boxShadow: "0 1px 2px rgba(26,26,24,.04), 0 1px 3px rgba(26,26,24,.05)",
      ...style,
    }}>{children}</div>
  );
}

function Verified() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12,
      fontWeight: 500, color: t.green, background: t.greenSubtle,
      padding: "3px 9px", borderRadius: 999, lineHeight: 1,
    }}>
      <ShieldCheck size={13} strokeWidth={1.75} /> Verificeret
    </span>
  );
}

function Chip({ children, tone = "neutral" }) {
  const tones = {
    neutral: { c: t.n600, b: t.n100 },
    blue: { c: t.blue, b: t.blueSubtle },
    warn: { c: t.warn, b: t.warnSubtle },
  };
  const s = tones[tone];
  return (
    <span style={{
      fontSize: 12, fontWeight: 500, color: s.c, background: s.b,
      padding: "3px 9px", borderRadius: 6, lineHeight: 1, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function Ring({ value, label, sub, color = t.green, size = 132 }) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.n200} strokeWidth={8} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
            strokeWidth={8} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
            style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,0,0,1)" }} />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 30, fontWeight: 600, color: t.ink, letterSpacing: "-.02em" }}>{value}</span>
          <span style={{ fontSize: 12, color: t.n500 }}>/ 100</span>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: t.ink }}>{label}</div>
        <div style={{ fontSize: 12, color: t.n500, marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

function Btn({ children, primary, onClick, icon: Icon }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer",
      fontFamily: t.font, fontSize: 13.5, fontWeight: 500,
      padding: "9px 15px", borderRadius: 8, transition: "all .15s",
      color: primary ? "#fff" : t.ink,
      background: primary ? t.blue : t.surface,
      border: `1px solid ${primary ? t.blue : t.n200}`,
    }}>
      {Icon && <Icon size={15} strokeWidth={1.75} />}{children}
    </button>
  );
}

/* ----------------------------- shell -------------------------------- */

function NavItem({ icon: Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 11, width: "100%",
      padding: "9px 12px", borderRadius: 8, cursor: "pointer", textAlign: "left",
      fontFamily: t.font, fontSize: 14, fontWeight: active ? 500 : 400,
      color: active ? t.ink : t.n600,
      background: active ? t.n100 : "transparent", border: "none",
    }}>
      <Icon size={17} strokeWidth={1.75} color={active ? t.blue : t.n500} />
      {label}
    </button>
  );
}

function Sidebar({ view, setView }) {
  return (
    <aside style={{
      width: 232, flexShrink: 0, borderRight: `1px solid ${t.n200}`,
      background: t.surface, padding: "20px 14px", display: "flex", flexDirection: "column",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 8px 20px" }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7, background: t.ink,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Home size={15} color="#fff" strokeWidth={2} />
        </div>
        <span style={{ fontWeight: 600, fontSize: 15, color: t.ink, letterSpacing: "-.01em" }}>
          House Passport
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <NavItem icon={Home} label="Overblik" active={view === "dash"} onClick={() => setView("dash")} />
        <NavItem icon={FileText} label="Dokumenter" active={view === "docs"} onClick={() => setView("docs")} />
        <NavItem icon={Wrench} label="Vedligehold" active={view === "maint"} onClick={() => setView("maint")} />
        <NavItem icon={Share2} label="Deling" active={view === "share"} onClick={() => setView("share")} />
      </div>

      <div style={{ marginTop: 18, padding: "0 4px" }}>
        <button onClick={() => setView("onboard")} style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          padding: "9px 12px", borderRadius: 8, cursor: "pointer",
          fontFamily: t.font, fontSize: 13.5, fontWeight: 500, color: t.blue,
          background: t.blueSubtle, border: "none",
        }}>
          <Plus size={15} strokeWidth={2} /> Tilføj bolig
        </button>
      </div>

      <div style={{ marginTop: "auto", paddingTop: 16, borderTop: `1px solid ${t.n200}` }}>
        <NavItem icon={Settings} label="Indstillinger" />
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 10px 2px" }}>
          <div style={{
            width: 28, height: 28, borderRadius: 999, background: t.n100,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 600, color: t.n600,
          }}>SP</div>
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: t.ink }}>Sema Plambech</div>
            <div style={{ fontSize: 11.5, color: t.n500 }}>Boligejer</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function TopBar({ title }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px 32px", borderBottom: `1px solid ${t.n200}`, background: t.surface,
    }}>
      <h1 style={{ fontSize: 17, fontWeight: 600, color: t.ink, margin: 0, letterSpacing: "-.01em" }}>{title}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "7px 12px",
          border: `1px solid ${t.n200}`, borderRadius: 8, background: t.bg, width: 230,
        }}>
          <Search size={15} color={t.n400} strokeWidth={1.75} />
          <span style={{ fontSize: 13.5, color: t.n400 }}>Søg i boligen…</span>
        </div>
        <button style={{
          width: 36, height: 36, borderRadius: 8, border: `1px solid ${t.n200}`,
          background: t.surface, display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer",
        }}>
          <Bell size={16} color={t.n600} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------- views --------------------------------- */

function PropertyHeader() {
  return (
    <Card style={{ display: "flex", overflow: "hidden" }}>
      <div style={{
        width: 168, flexShrink: 0,
        background: `linear-gradient(135deg, ${t.n100}, ${t.n200})`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Home size={40} color={t.n400} strokeWidth={1.25} />
      </div>
      <div style={{ padding: "20px 24px", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: t.ink, margin: 0, letterSpacing: "-.02em" }}>
            {property.address}
          </h2>
          {property.verified && <Verified />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: t.n500, fontSize: 13.5, marginBottom: 16 }}>
          <MapPin size={14} strokeWidth={1.75} /> {property.city}
        </div>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          {[
            ["Boligtype", property.type],
            ["Areal", `${property.area} m²`],
            ["Opført", property.year],
            ["Vurdering", property.value],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 12, color: t.n500, marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 14.5, fontWeight: 500, color: t.ink }}>{v}</div>
            </div>
          ))}
          <div>
            <div style={{ fontSize: 12, color: t.n500, marginBottom: 3 }}>Energimærke</div>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13.5,
              fontWeight: 600, color: t.green,
            }}>
              <Zap size={14} strokeWidth={2} fill={t.green} /> {property.energy}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function StatCard({ label, value, icon: Icon, tone }) {
  const color = tone === "green" ? t.green : tone === "warn" ? t.warn : t.ink;
  return (
    <Card style={{ padding: "16px 18px", flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon size={16} color={color} strokeWidth={1.75} />
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, color: t.ink, letterSpacing: "-.02em", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: t.n500, marginTop: 6 }}>{label}</div>
    </Card>
  );
}

function Dashboard() {
  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, maxWidth: 1080 }}>
      <div style={{ display: "flex", gap: 24, alignItems: "stretch" }}>
        <div style={{ flex: 1 }}><PropertyHeader /></div>
        <Card style={{ width: 240, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <Ring value={property.score} label="Vedligeholdelsesscore" sub="God stand · 2 opgaver" />
        </Card>
      </div>

      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: t.n500, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 12 }}>
          Hurtig status
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {statuses.map((s) => <StatCard key={s.label} {...s} />)}
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <Card style={{ flex: 1, padding: "8px 4px" }}>
          <div style={{ padding: "12px 20px 8px", fontSize: 12.5, fontWeight: 600, color: t.n500, textTransform: "uppercase", letterSpacing: ".05em" }}>
            Seneste aktivitet
          </div>
          {activity.map((a, i) => (
            <div key={i} style={{
              display: "flex", gap: 13, padding: "13px 20px",
              borderTop: i ? `1px solid ${t.n100}` : "none", alignItems: "flex-start",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: t.n100, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <a.icon size={15} color={t.n600} strokeWidth={1.75} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: t.ink, fontWeight: 500 }}>{a.text}</div>
                <div style={{ fontSize: 12.5, color: t.n500, marginTop: 2 }}>{a.meta}</div>
              </div>
              <div style={{ fontSize: 12, color: t.n400, whiteSpace: "nowrap" }}>{a.time}</div>
            </div>
          ))}
        </Card>

        <Card style={{ width: 260, padding: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.ink, marginBottom: 4 }}>Dokumentationsgrad</div>
          <div style={{ fontSize: 12.5, color: t.n500, marginBottom: 16 }}>
            Jo mere komplet, jo hurtigere et salg.
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 600, color: t.ink, letterSpacing: "-.02em" }}>{property.docGrade}%</span>
          </div>
          <div style={{ height: 8, background: t.n100, borderRadius: 999, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ width: `${property.docGrade}%`, height: "100%", background: t.green, borderRadius: 999 }} />
          </div>
          <Btn icon={Upload}>Forbind mail og udfyld</Btn>
        </Card>
      </div>
    </div>
  );
}

function Documents() {
  const [active, setActive] = useState("Alle");
  const cats = [["Alle", documents.length], ...categories];
  const shown = active === "Alle" ? documents : documents.filter((d) => d.cat === active);
  return (
    <div style={{ display: "flex", height: "100%" }}>
      <div style={{ width: 210, borderRight: `1px solid ${t.n200}`, padding: "24px 14px", flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.n500, textTransform: "uppercase", letterSpacing: ".05em", padding: "0 10px 10px" }}>
          Kategorier
        </div>
        {cats.map(([name, n]) => (
          <button key={name} onClick={() => setActive(name)} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            width: "100%", padding: "8px 10px", borderRadius: 7, cursor: "pointer",
            border: "none", fontFamily: t.font, marginBottom: 1,
            background: active === name ? t.n100 : "transparent",
            color: active === name ? t.ink : t.n600,
            fontWeight: active === name ? 500 : 400, fontSize: 13.5,
          }}>
            <span>{name}</span>
            <span style={{ fontSize: 12, color: t.n400 }}>{n}</span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, padding: 28, maxWidth: 860 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Btn icon={Filter}>{active}</Btn>
          </div>
          <Btn primary icon={Plus}>Upload dokument</Btn>
        </div>

        <Card style={{ overflow: "hidden" }}>
          {shown.map((d, i) => (
            <div key={d.name} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
              borderTop: i ? `1px solid ${t.n100}` : "none",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: t.n100, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <FileText size={16} color={t.n600} strokeWidth={1.75} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: t.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {d.name}
                </div>
                <div style={{ fontSize: 12.5, color: t.n500, marginTop: 2 }}>{d.by}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {d.status === "pending"
                  ? <Chip tone="warn">Behandles…</Chip>
                  : <Chip tone="blue">{d.cat}</Chip>}
                {d.warranty && <Chip>Garanti til {d.warranty}</Chip>}
                {d.verified && <Verified />}
                <ChevronRight size={16} color={t.n300} strokeWidth={1.75} />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function Onboarding() {
  const [found, setFound] = useState(false);
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "56px 32px" }}>
      <div style={{ width: 520 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{
              height: 4, flex: 1, borderRadius: 999,
              background: i <= (found ? 1 : 0) ? t.blue : t.n200,
            }} />
          ))}
        </div>

        {!found ? (
          <Card style={{ padding: 32 }}>
            <div style={{ fontSize: 12.5, color: t.blue, fontWeight: 600, marginBottom: 8 }}>Trin 1 af 4</div>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: t.ink, margin: "0 0 8px", letterSpacing: "-.02em" }}>
              Hvad er din adresse?
            </h2>
            <p style={{ fontSize: 14, color: t.n500, margin: "0 0 22px", lineHeight: 1.5 }}>
              Vi henter automatisk BBR-data, energimærke og vurdering — så du er i gang på under fem minutter.
            </p>
            <div style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
              border: `1px solid ${t.n300}`, borderRadius: 9, marginBottom: 20,
            }}>
              <MapPin size={17} color={t.n400} strokeWidth={1.75} />
              <span style={{ fontSize: 14.5, color: t.n600 }}>Æblevej 12, 8000 Aarhus</span>
            </div>
            <Btn primary icon={ArrowRight} onClick={() => setFound(true)}>Find min bolig</Btn>
          </Card>
        ) : (
          <Card style={{ padding: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.green, fontSize: 13.5, fontWeight: 500, marginBottom: 18 }}>
              <CheckCircle2 size={17} strokeWidth={1.75} /> Vi fandt din bolig
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 24 }}>
              <div style={{
                width: 80, height: 80, borderRadius: 10, flexShrink: 0,
                background: `linear-gradient(135deg, ${t.n100}, ${t.n200})`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Home size={28} color={t.n400} strokeWidth={1.25} />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, color: t.ink }}>{property.address}, {property.city}</div>
                <div style={{ fontSize: 13.5, color: t.n500, marginTop: 3 }}>
                  {property.type} · {property.area} m² · {property.year} · Energimærke {property.energy}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: t.n600, marginBottom: 8, fontWeight: 500 }}>Dokumentationsgrad</div>
            <div style={{ height: 8, background: t.n100, borderRadius: 999, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ width: "18%", height: "100%", background: t.green, borderRadius: 999 }} />
            </div>
            <div style={{ fontSize: 12.5, color: t.n500, marginBottom: 24 }}>
              18% — forbind din mail, så finder vi resten automatisk.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn primary icon={Upload}>Forbind Gmail / Outlook</Btn>
              <Btn>Spring over</Btn>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Placeholder({ title, icon: Icon }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 14, color: t.n400 }}>
      <div style={{ width: 52, height: 52, borderRadius: 13, background: t.n100, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={24} color={t.n400} strokeWidth={1.5} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 500, color: t.n600 }}>{title}</div>
      <div style={{ fontSize: 13, color: t.n400 }}>Bygges i et kommende increment.</div>
    </div>
  );
}

/* ----------------------------- app ---------------------------------- */

const TITLES = { dash: "Overblik", docs: "Dokumenter", maint: "Vedligehold", share: "Deling", onboard: "Tilføj bolig" };

export default function App() {
  const [view, setView] = useState("dash");
  return (
    <div style={{ fontFamily: t.font, background: t.bg, color: t.ink, height: "100vh", display: "flex", overflow: "hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box} button:hover{filter:brightness(.985)}`}</style>
      <Sidebar view={view} setView={setView} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar title={TITLES[view]} />
        <div style={{ flex: 1, overflow: "auto" }}>
          {view === "dash" && <Dashboard />}
          {view === "docs" && <Documents />}
          {view === "onboard" && <Onboarding />}
          {view === "maint" && <Placeholder title="Vedligeholdelsesplan" icon={Wrench} />}
          {view === "share" && <Placeholder title="Deling og adgang" icon={Share2} />}
        </div>
      </div>
    </div>
  );
}
