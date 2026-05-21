interface Props {
  active: string;
  onChange: (view: string) => void;
}

const items = [
  { id: "scan", label: "Scan & Clean", icon: "✦" },
  { id: "projects", label: "Projects", icon: "▣" },
  { id: "settings", label: "Settings", icon: "⚙" },
  { id: "about", label: "About", icon: "ⓘ" },
];

export default function Sidebar({ active, onChange }: Props) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">D</div>
        <div>
          <div className="brand-name">DevSweep</div>
          <div className="brand-sub">reclaim your disk</div>
        </div>
      </div>
      {items.map((it) => (
        <button
          key={it.id}
          className={`nav-item ${active === it.id ? "active" : ""}`}
          onClick={() => onChange(it.id)}
        >
          <span style={{ width: 16, textAlign: "center" }}>{it.icon}</span>
          {it.label}
        </button>
      ))}
      <div className="nav-spacer" />
      <div className="nav-footer">v0.1.0 — Tauri + React</div>
    </aside>
  );
}
