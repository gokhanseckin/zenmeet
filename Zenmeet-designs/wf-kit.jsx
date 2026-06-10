// wf-kit.jsx — shared low-fi wireframe primitives for JoinClass
// Minimal / utilitarian. Grayscale structure, one restrained vermillion
// accent reserved for the ONE idea: "only paying members get the live link".
// Exports primitives to window so screen files can destructure them.

(function injectWfStyles() {
  if (document.getElementById('wf-styles')) return;
  const s = document.createElement('style');
  s.id = 'wf-styles';
  s.textContent = `
  :root{
    --ink:#2b2a27; --ink2:#6f6c64; --ink3:#a39e94;
    --line:#cbc7bd; --line2:#e3dfd5; --paper:#faf8f3; --panel:#f1ede4;
    --accent:#b1492f; --accentSoft:#f0ddd5;
    --accent2:#3f6ea0; --accent2Soft:#e2eaf2;
  }
  .wf{ background:var(--paper); color:var(--ink);
    font-family:"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif;
    height:100%; box-sizing:border-box; position:relative; overflow:hidden;
    -webkit-font-smoothing:antialiased; }
  .wf *{ box-sizing:border-box; }
  .wf h1,.wf h2,.wf h3,.wf p{ margin:0; }
  .wf-mono{ font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace; }
  .wf-hand{ font-family:"Caveat",cursive; color:var(--accent); line-height:1.05; }

  /* device chrome */
  .wf-browser{ display:flex; align-items:center; gap:8px; padding:9px 12px;
    border-bottom:1px solid var(--line); background:#f4f1ea; }
  .wf-dot{ width:9px; height:9px; border-radius:50%; background:#d8d3c8; }
  .wf-url{ flex:1; height:24px; border:1px solid var(--line); border-radius:13px;
    background:#fff; display:flex; align-items:center; padding:0 12px;
    font-size:12px; color:var(--ink2); }
  .wf-url b{ color:var(--ink); font-weight:600; }
  .wf-phonebar{ height:26px; display:flex; align-items:center; justify-content:center;
    border-bottom:1px solid var(--line2); background:#f4f1ea; position:relative; }
  .wf-phonebar::before{ content:""; width:46px; height:5px; border-radius:3px;
    background:#d8d3c8; }
  .wf-phurl{ position:absolute; left:14px; font-size:10px; color:var(--ink3); }

  /* primitives */
  .wf-btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px;
    padding:11px 18px; border-radius:7px; font-size:14px; font-weight:600;
    border:1px solid var(--accent); background:var(--accent); color:#fff;
    cursor:default; white-space:nowrap; }
  .wf-btn.full{ width:100%; }
  .wf-btn.sm{ padding:8px 13px; font-size:12.5px; }
  .wf-btn.lg{ padding:15px 22px; font-size:16px; }
  .wf-btn.ghost{ background:transparent; color:var(--ink); border-color:var(--line); }
  .wf-btn.dark{ background:var(--ink); border-color:var(--ink); color:#fff; }
  .wf-btn.locked{ background:var(--panel); border-color:var(--line); color:var(--ink3); }

  .wf-field{ display:flex; flex-direction:column; gap:5px; }
  .wf-field > span{ font-size:11.5px; font-weight:600; color:var(--ink2);
    letter-spacing:.02em; text-transform:uppercase; }
  .wf-input{ height:42px; border:1px solid var(--line); border-radius:7px; background:#fff;
    display:flex; align-items:center; padding:0 13px; font-size:13.5px; color:var(--ink3); }
  .wf-input.tall{ height:auto; min-height:64px; padding:12px 13px; align-items:flex-start; }

  /* borderless title input (Google-Calendar style) */
  .wf-titleinput{ width:100%; border:0; border-bottom:2px solid var(--line); background:transparent;
    font-family:inherit; font-size:21px; font-weight:700; letter-spacing:-.01em; color:var(--ink);
    padding:6px 2px; outline:none; }
  .wf-titleinput.sm{ font-size:17px; }

  .wf-img{ position:relative; border:1px solid var(--line); border-radius:8px; overflow:hidden;
    background:
      repeating-linear-gradient(135deg, #efe9dd 0 9px, #f6f1e7 9px 18px);
    display:flex; align-items:center; justify-content:center; }
  .wf-img span{ font-family:ui-monospace,Menlo,monospace; font-size:11px; color:var(--ink3);
    background:rgba(250,248,243,.82); padding:3px 8px; border-radius:4px; }

  .wf-bar{ height:9px; border-radius:5px; background:var(--line2); }
  .wf-card{ border:1px solid var(--line); border-radius:12px; background:#fff; }
  .wf-tag{ display:inline-flex; align-items:center; gap:6px; padding:4px 10px;
    border:1px solid var(--line); border-radius:20px; font-size:11.5px; color:var(--ink2);
    background:#fff; }
  .wf-divide{ height:1px; background:var(--line2); }

  .wf-stepdot{ width:24px; height:24px; border-radius:50%; border:1px solid var(--line);
    display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;
    color:var(--ink3); background:#fff; }
  .wf-stepdot.on{ background:var(--ink); border-color:var(--ink); color:#fff; }
  .wf-stepdot.done{ background:var(--panel); border-color:var(--line); color:var(--ink2); }

  /* note callout with hand arrow */
  .wf-note{ position:absolute; z-index:6; max-width:190px; }
  .wf-note .t{ font-family:"Caveat",cursive; font-size:19px; line-height:1; color:var(--accent); }

  /* interactive-prototype hotspots (active only inside WF.NavCtx) */
  .wf-hot{ cursor:pointer; }
  .wf-hot:hover{ outline:2px solid rgba(177,73,47,.55); outline-offset:2px; }
  @keyframes wfHotPulse{ 0%,100%{ box-shadow:0 0 0 0 rgba(177,73,47,0); } 40%{ box-shadow:0 0 0 5px rgba(177,73,47,.5); } }
  .wf-flash .wf-hot{ animation: wfHotPulse .65s ease 2; }
  `;
  document.head.appendChild(s);
})();

const WF = {};

WF.Browser = ({ url }) => (
  <div className="wf-browser">
    <div className="wf-dot" /><div className="wf-dot" /><div className="wf-dot" />
    <div className="wf-url"><span style={{ color: 'var(--ink3)' }}>joinclass.com/</span><b>{url}</b></div>
  </div>
);

WF.Phone = ({ url }) => (
  <div className="wf-phonebar"><span className="wf-phurl wf-mono">/{url}</span></div>
);

// Navigation context — when a prototype provides { has(act), go(act) }, any
// Btn/Hot with an `act` that the current screen handles becomes a live hotspot.
WF.NavCtx = React.createContext(null);

WF.Btn = ({ children, className = '', style, act }) => {
  const nav = React.useContext(WF.NavCtx);
  const hot = !!(nav && act && nav.has(act));
  return (
    <div className={`wf-btn ${className}${hot ? ' wf-hot' : ''}`} style={style}
      onClick={hot ? (e) => { e.stopPropagation(); nav.go(act); } : undefined}>{children}</div>
  );
};

// Generic clickable region wrapper for non-button elements (cards, links, rows).
WF.Hot = ({ act, children, style, inline, radius = 8 }) => {
  const nav = React.useContext(WF.NavCtx);
  const hot = !!(nav && act && nav.has(act));
  const Tag = inline ? 'span' : 'div';
  return (
    <Tag className={hot ? 'wf-hot' : undefined}
      style={{ display: inline ? 'inline-block' : 'block', borderRadius: radius, ...style }}
      onClick={hot ? (e) => { e.stopPropagation(); nav.go(act); } : undefined}>{children}</Tag>
  );
};

WF.Field = ({ label, value, tall, select, icon, style }) => (
  <label className="wf-field" style={style}>
    {label && <span>{label}</span>}
    <div className={`wf-input ${tall ? 'tall' : ''}`} style={select ? { justifyContent: 'space-between' } : null}>
      {icon && <span style={{ marginRight: 9, opacity: .7, display: 'inline-flex' }}>{icon}</span>}
      <span style={{ flex: select ? 1 : 'initial' }}>{value}</span>
      {select && (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="var(--ink2)" strokeWidth="1.6" strokeLinecap="round" style={{ flex: '0 0 auto', marginLeft: 8 }}><path d="M2 4l3.5 3.5L9 4" /></svg>
      )}
    </div>
  </label>
);

WF.Img = ({ label, style }) => (
  <div className="wf-img" style={style}><span>{label}</span></div>
);

WF.Bars = ({ lines = 3, widths, style }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, ...style }}>
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="wf-bar" style={{ width: (widths && widths[i]) || `${95 - i * 8}%` }} />
    ))}
  </div>
);

WF.Tag = ({ children, style }) => <span className="wf-tag" style={style}>{children}</span>;

WF.Logo = ({ style, mono }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...style }}>
    <div style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--ink)' }} />
    <span style={{ fontWeight: 700, fontSize: mono ? 13 : 15, letterSpacing: '-.01em' }}>JoinClass</span>
  </div>
);

// platform chip — meet / zoom shown neutrally as labels (no brand art)
WF.Platform = ({ name, style }) => (
  <span className="wf-tag wf-mono" style={{ fontSize: 11, ...style }}>
    <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--ink3)' }} />{name}
  </span>
);

// a margin annotation — hand text, optional small arrow
WF.Note = ({ children, style }) => (
  <div className="wf-note" style={style}><div className="t">{children}</div></div>
);

// section heading inside a frame
WF.Eyebrow = ({ children, style }) => (
  <div className="wf-mono" style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase',
    color: 'var(--ink3)', ...style }}>{children}</div>
);

Object.assign(window, { WF });
