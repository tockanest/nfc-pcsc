export default function AboutView() {
  return (
    <div className="card">
      <h2>About DevSweep</h2>
      <p className="hint">
        DevSweep is a Tauri-powered desktop app and CLI that helps you reclaim
        disk space by removing dependency and build folders from your projects —
        things like <code>node_modules</code>, <code>target</code> (Rust),
        <code> .venv</code>, <code>build</code>, <code>dist</code>,
        <code> .next</code>, <code>Pods</code>, <code>DerivedData</code> and
        more.
      </p>
      <h3 style={{ marginTop: 18, fontSize: 14 }}>Where things live</h3>
      <ul>
        <li>
          <strong>Folder operations</strong> (scan + delete) run in the Rust
          backend.
        </li>
        <li>
          <strong>Configuration</strong> (projects, ignored paths, glob
          patterns, target names) is stored in the frontend via
          <code> localStorage</code>.
        </li>
      </ul>
      <h3 style={{ marginTop: 18, fontSize: 14 }}>CLI usage</h3>
      <p className="hint">
        DevSweep ships as a single binary. Add the install location to your{" "}
        <code>PATH</code> and you can use it as a CLI:
      </p>
      <pre
        style={{
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 12,
          fontSize: 12.5,
          overflow: "auto",
        }}
      >{`# show what would be cleaned up
devsweep scan ~/code ~/work

# clean recursively with a confirmation prompt
devsweep clean ~/code

# automate it (no prompt)
devsweep clean ~/code -y

# only clean specific targets
devsweep clean ~/code -t node_modules,target

# list defaults
devsweep targets

# launch the GUI (default if no arguments)
devsweep`}</pre>
      <h3 style={{ marginTop: 18, fontSize: 14 }}>Safety</h3>
      <ul>
        <li>System root directories (e.g. <code>/</code>, <code>/etc</code>, <code>C:\Windows</code>) are hard-refused even if explicitly listed.</li>
        <li>The CLI requires an interactive confirmation unless <code>-y</code> is passed.</li>
        <li>Symbolic links are not followed by default.</li>
      </ul>
    </div>
  );
}
