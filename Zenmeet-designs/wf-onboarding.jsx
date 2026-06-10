// wf-onboarding.jsx — Create a classroom (no separate teacher account)
// Entered from your account Home → "Create a classroom". Same login that
// joins classes; teaching is an action, not an account type.
// Variant A: linear wizard (classroom → Stripe → calls → first class)
// Variant B: setup-checklist dashboard

const { WF } = window;
const O = WF;

// progress wizard header
function Wiz({ step, children, foot }) {
  const steps = ['Classroom', 'Payments', 'Calls', 'First class'];
  return (
    <div className="wf">
      <div style={{ padding: '16px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <O.Logo />
          <span style={{ width: 1, height: 16, background: 'var(--line2)' }}></span>
          <O.Hot inline act="home"><span style={{ fontSize: 12, color: 'var(--ink3)' }}>← Home</span></O.Hot>
        </div>
        <O.Tag style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>30-day free trial · no card</O.Tag>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '16px 26px 0' }}>
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className={`wf-stepdot ${i === step ? 'on' : i < step ? 'done' : ''}`}>{i < step ? '✓' : i + 1}</div>
              <span style={{ fontSize: 11.5, fontWeight: i === step ? 700 : 500, color: i === step ? 'var(--ink)' : 'var(--ink3)' }}>{s}</span>
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: 'var(--line2)', margin: '0 10px' }} />}
          </React.Fragment>
        ))}
      </div>
      <div style={{ padding: '28px 40px 0' }}>{children}</div>
      {foot && <div style={{ position: 'absolute', left: 40, right: 40, bottom: 26 }}>{foot}</div>}
    </div>
  );
}

const optionCard = (title, desc, on, badge) => (
  <div className="wf-card" style={{ padding: '15px 16px', borderColor: on ? 'var(--accent)' : 'var(--line)', borderWidth: on ? 2 : 1, position: 'relative' }}>
    {badge && <span style={{ position: 'absolute', top: 14, right: 14, fontSize: 10, fontWeight: 700, color: 'var(--accent)', letterSpacing: '.05em' }}>{badge}</span>}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${on ? 'var(--accent)' : 'var(--line)'}`, position: 'relative' }}>
        {on && <div style={{ position: 'absolute', inset: 3, borderRadius: '50%', background: 'var(--accent)' }} />}
      </div>
      <span style={{ fontSize: 14.5, fontWeight: 600 }}>{title}</span>
    </div>
    <div style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.4, paddingLeft: 26 }}>{desc}</div>
  </div>
);

// A1 — create classroom (first step: you already have an account)
function OnbA2() {
  return (
    <Wiz step={0} foot={<O.Btn className="full lg" act="next">Continue</O.Btn>}>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', marginBottom: 6 }}>Set up your classroom</h1>
      <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 20 }}>Signed in as <b>sam@email.com</b> — the same account you use to join classes.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420 }}>
        <O.Field label="Class name" value="Morning Vinyasa with Aiko" />
        <O.Field label="Your custom link" value={<span><span style={{ color: 'var(--ink3)' }}>joinclass.com/</span><span style={{ color: 'var(--ink)' }}>aiko-vinyasa</span></span>} />
        <div style={{ display: 'flex', gap: 14 }}>
          <O.Field label="Price" value="$19" style={{ flex: 1 }} />
          <O.Field label="Per" value="month" style={{ flex: 1 }} />
        </div>
      </div>
      <O.Note style={{ top: 168, right: 30, transform: 'rotate(3deg)' }}>this is the URL<br />students visit</O.Note>
    </Wiz>
  );
}

// A2 — connect Stripe
function OnbA3() {
  return (
    <Wiz step={1} foot={<O.Btn className="full lg" act="stripe">Connect Stripe</O.Btn>}>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', marginBottom: 6 }}>Get paid</h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink2)', marginBottom: 22 }}>Students pay by card. Choose how money reaches you.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 460 }}>
        {optionCard('Connect your own Stripe', 'Payouts land in your account. You keep full control.', true, 'RECOMMENDED')}
        {optionCard('Use JoinClass payments', "We handle Stripe for you. Payouts come from us.", false)}
      </div>
      <div style={{ marginTop: 16, fontSize: 11.5, color: 'var(--ink3)', maxWidth: 460 }}>JoinClass charges a flat monthly fee + small per-student commission.</div>
    </Wiz>
  );
}

// connect-card — for linking an external account (Stripe / Meet / Zoom).
// Shows a per-platform connect action + status, NOT a single-choice radio.
const connectCard = (name, desc, connected) => (
  <div className="wf-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    borderColor: connected ? 'var(--accent)' : 'var(--line)', borderWidth: connected ? 2 : 1 }}>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 3 }}>{name}</div>
      <div style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.4 }}>{desc}</div>
    </div>
    {connected
      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#3f7a4a', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3f7a4a' }} />Connected
        </span>
      : <span className="wf-btn ghost sm" style={{ flex: '0 0 auto' }}>Connect</span>}
  </div>
);

// A3 — connect calls
function OnbA4() {
  return (
    <Wiz step={2} foot={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 11.5, color: 'var(--ink3)' }}>Connect at least one platform to continue.</span>
      <O.Btn className="lg" act="next">Continue</O.Btn>
    </div>}>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', marginBottom: 6 }}>Connect your call platform</h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink2)', marginBottom: 22 }}>Connect Google Meet, Zoom, or both. You'll choose which one to use for each class when you schedule it — we generate a fresh private link every session.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 460 }}>
        {connectCard('Google Meet', 'Links open in your Google account.', true)}
        {connectCard('Zoom', 'Links open in your Zoom account.', false)}
      </div>
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--accent)' }}>
        <span style={{ width: 6, height: 6, borderRadius: 2, background: 'var(--accent)' }} />A new link is auto-created &amp; revealed 5 min before each class.
      </div>
    </Wiz>
  );
}

// platform pick-row for A5 — you can only pick a platform you connected in A4.
// Not-yet-connected platforms appear gray with a "Not connected" label.
const platformRow = (name, connected, selected) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 8,
    border: `${selected ? 2 : 1}px solid ${selected ? 'var(--accent)' : 'var(--line)'}`,
    background: connected ? '#fff' : 'var(--panel)' }}>
    <div style={{ width: 16, height: 16, borderRadius: '50%', flex: '0 0 auto', position: 'relative',
      border: `2px solid ${selected ? 'var(--accent)' : 'var(--line)'}` }}>
      {selected && <div style={{ position: 'absolute', inset: 3, borderRadius: '50%', background: 'var(--accent)' }} />}
    </div>
    <span style={{ fontSize: 13.5, fontWeight: 600, color: connected ? 'var(--ink)' : 'var(--ink3)' }}>{name}</span>
    {!connected && (
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11.5, color: 'var(--ink3)' }}>Not connected</span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink2)' }}>Connect</span>
      </span>
    )}
  </div>
);

// A4 — schedule first class
function OnbA5() {
  return (
    <Wiz step={3} foot={<O.Btn className="full lg" act="publish">Publish classroom</O.Btn>}>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', marginBottom: 22 }}>Schedule your first class</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 440 }}>
        <div style={{ display: 'flex', gap: 14 }}>
          <O.Field label="Day" value="Monday" select style={{ flex: 1 }} />
          <O.Field label="Time" value="7:00am" select style={{ flex: 1 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>Repeat weekly</span>
          <div style={{ width: 38, height: 22, borderRadius: 12, background: 'var(--accent)', position: 'relative' }}><div style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: '#fff' }} /></div>
        </div>
        <label className="wf-field">
          <span>Platform</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {platformRow('Google Meet', true, true)}
            {platformRow('Zoom', false, false)}
          </div>
        </label>
      </div>
    </Wiz>
  );
}

// ════════ VARIANT B — checklist dashboard ════════
function checkRow(label, sub, state) {
  // state: 'done' | 'now' | 'todo'
  const done = state === 'done', now = state === 'now';
  return (
    <div className="wf-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 13, borderColor: now ? 'var(--accent)' : 'var(--line)', borderWidth: now ? 2 : 1 }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', flex: '0 0 auto',
        border: done ? '0' : `1.5px solid ${now ? 'var(--accent)' : 'var(--line)'}`,
        background: done ? 'var(--ink)' : '#fff', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
        {done ? '✓' : ''}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: done ? 'var(--ink2)' : 'var(--ink)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{sub}</div>
      </div>
      {now && <O.Btn className="sm">Start</O.Btn>}
      {done && <span style={{ fontSize: 11.5, color: 'var(--ink3)' }}>Done</span>}
    </div>
  );
}

function OnbB1() {
  return (
    <div className="wf">
      <O.Browser url="dashboard" />
      <div style={{ padding: '18px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line2)' }}>
        <O.Logo />
        <O.Tag style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>Trial · 30 days left</O.Tag>
      </div>
      <div style={{ padding: '24px 30px 0' }}>
        <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-.02em', marginBottom: 4 }}>Welcome, Aiko 👋</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink2)', marginBottom: 8 }}>Finish setup to open your classroom. 2 of 4 done.</p>
        <div style={{ height: 7, borderRadius: 4, background: 'var(--line2)', marginBottom: 22, overflow: 'hidden' }}>
          <div style={{ width: '50%', height: '100%', background: 'var(--accent)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {checkRow('Account', 'Your one JoinClass account — joins & teaches', 'done')}
          {checkRow('Name your classroom & price', 'joinclass.com/aiko-vinyasa', 'done')}
          {checkRow('Connect payments', 'Your Stripe or JoinClass payments', 'now')}
          {checkRow('Connect Google Meet or Zoom', 'Auto-generates a link per class', 'todo')}
        </div>
      </div>
      <O.Note style={{ top: 250, right: 22, transform: 'rotate(3deg)' }}>everything on<br />one screen</O.Note>
    </div>
  );
}

function OnbB2() {
  return (
    <div className="wf">
      <O.Browser url="dashboard" />
      <div style={{ position: 'absolute', inset: 0, top: 41, background: 'rgba(43,42,39,.28)' }} />
      {/* modal */}
      <div style={{ position: 'absolute', top: 78, left: 70, right: 70, background: '#fff', border: '1px solid var(--line)', borderRadius: 14, boxShadow: '0 18px 50px rgba(0,0,0,.18)', padding: 26 }}>
        <div className="wf-mono" style={{ fontSize: 11, letterSpacing: '.08em', color: 'var(--ink3)', marginBottom: 6 }}>STEP 3 OF 4</div>
        <h2 style={{ fontSize: 21, fontWeight: 700, marginBottom: 6 }}>Connect payments</h2>
        <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 20 }}>Students pay by card. Choose how money reaches you.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 20 }}>
          {optionCard('Connect your own Stripe', 'Payouts land directly in your account.', true, 'RECOMMENDED')}
          {optionCard('Use JoinClass payments', 'We handle Stripe. Flat fee + per-student commission.', false)}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <O.Btn className="ghost">Later</O.Btn><O.Btn>Connect Stripe</O.Btn>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { OnbA2, OnbA3, OnbA4, OnbA5, OnbB1, OnbB2 });
