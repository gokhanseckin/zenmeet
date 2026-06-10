// wf-home.jsx — public homepage (logged out) + post-login chooser.
// The homepage is intent-neutral: nobody picks "student" or "teacher".
// Intent is captured AFTER login on the chooser: search a classroom
// (live as-you-type dropdown) OR create a classroom.

const { WF } = window;
const H = WF;

// ── homepage — logged out ──────────────────────────────────
function SiteHome() {
  return (
    <div className="wf">
      <H.Browser url="" />
      <div style={{ padding: '20px 38px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <H.Logo />
        <H.Btn className="ghost sm" act="login">Log in / Sign up</H.Btn>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '44px 40px 0' }}>
        <H.Eyebrow style={{ marginBottom: 14 }}>Live classes over Google Meet &amp; Zoom</H.Eyebrow>
        <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-.025em', marginBottom: 14, maxWidth: 640, lineHeight: 1.1 }}>
          Take live classes.<br />Or teach your own.
        </h1>
        <p style={{ fontSize: 15, color: 'var(--ink2)', maxWidth: 460, lineHeight: 1.5, marginBottom: 28 }}>
          One account does both — join any teacher's classroom, or open yours and get paid. No role to pick, ever.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <H.Btn className="dark lg" act="login">Get started — it's free</H.Btn>
          <span style={{ fontSize: 13, color: 'var(--ink2)' }}>30-day teaching trial · no card</span>
        </div>
      </div>
      {/* two ways, same account */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, maxWidth: 700, margin: '44px auto 0', padding: '0 40px' }}>
        <div className="wf-card" style={{ padding: '18px 20px' }}>
          <H.Eyebrow style={{ marginBottom: 8 }}>Learn</H.Eyebrow>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Join a classroom</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.5 }}>Search any class, pay monthly, and get the private live link 5 minutes before each session.</div>
        </div>
        <div className="wf-card" style={{ padding: '18px 20px' }}>
          <H.Eyebrow style={{ marginBottom: 8 }}>Teach</H.Eyebrow>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Create a classroom</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.5 }}>Set a price, connect Stripe and Meet/Zoom, and run recurring live classes on your own URL.</div>
        </div>
      </div>
      <H.Note style={{ top: 318, right: 60, transform: 'rotate(3deg)' }}>intent-neutral —<br />no student/teacher<br />fork yet</H.Note>
    </div>
  );
}

// ── post-login chooser: search OR create ───────────────────
const SEARCH_CLASSES = [
  { name: 'Morning Vinyasa with Aiko', meta: 'Mon · Wed · Fri 7am · 42 members' },
  { name: 'Vinyasa Foundations with Marco', meta: 'Tue 6pm · 18 members' },
  { name: 'Breathwork Basics with Aiko', meta: 'Sun 9am · 31 members' },
  { name: 'Evening Stretch with Sam', meta: 'Tue 6pm · 12 members' },
  { name: 'Guitar Club with Dana', meta: 'Sat 11am · 56 members' },
];

const classAvatar = (
  <div style={{ width: 30, height: 30, borderRadius: '50%', flex: '0 0 auto', border: '1px solid var(--line)',
    background: 'repeating-linear-gradient(135deg, #efe9dd 0 4px, #f6f1e7 4px 8px)' }}></div>
);

function AcctChoose({ initial = '' }) {
  const [q, setQ] = React.useState(initial);
  const query = q.trim().toLowerCase();
  const results = query ? SEARCH_CLASSES.filter((c) => c.name.toLowerCase().includes(query)) : [];
  return (
    <div className="wf">
      <div style={{ padding: '15px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line2)' }}>
        <H.Logo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11.5, color: 'var(--ink3)' }}>sam@email.com</span>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--panel)', border: '1px solid var(--line)' }}></div>
        </div>
      </div>
      <div style={{ padding: '26px 30px 0' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', marginBottom: 4 }}>What brings you here?</h1>
        <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 22 }}>You can do both anytime — it's one account.</p>

        {/* search a classroom */}
        <div className="wf-card" style={{ padding: '16px 18px 18px' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>Join a classroom</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginBottom: 12 }}>Search by class or teacher name — results appear as you type.</div>
          <div style={{ position: 'relative' }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--ink3)" strokeWidth="1.6" strokeLinecap="round"
              style={{ position: 'absolute', left: 13, top: 14, pointerEvents: 'none' }}>
              <circle cx="7" cy="7" r="4.6"></circle><path d="M10.4 10.4L14 14"></path>
            </svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} onClick={(e) => e.stopPropagation()}
              placeholder="Try “vinyasa” or “Aiko”…"
              style={{ width: '100%', height: 42, border: '1px solid var(--line)', borderRadius: 7, background: '#fff',
                padding: '0 13px 0 38px', fontSize: 13.5, fontFamily: 'inherit', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }} />
            {query && (
              <div style={{ position: 'absolute', top: 47, left: 0, right: 0, background: '#fff', border: '1px solid var(--line)',
                borderRadius: 10, boxShadow: '0 14px 34px rgba(0,0,0,.14)', zIndex: 9, overflow: 'hidden' }}>
                {results.length ? results.map((r, i) => (
                  <H.Hot key={r.name} act="pickclass" radius={0}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 13px', borderTop: i ? '1px solid var(--line2)' : 'none', background: '#fff' }}>
                      {classAvatar}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{r.meta}</div>
                      </div>
                      <span style={{ color: 'var(--ink3)' }}>›</span>
                    </div>
                  </H.Hot>
                )) : (
                  <div style={{ padding: '12px 13px', fontSize: 12.5, color: 'var(--ink3)' }}>No classes found for “{q.trim()}”</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--line2)' }}></div>
          <span style={{ fontSize: 11, color: 'var(--ink3)' }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--line2)' }}></div>
        </div>

        {/* create a classroom */}
        <div className="wf-card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>Create a classroom</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink2)' }}>Teach live classes on your own URL — same account.</div>
          </div>
          <H.Btn act="create">Create</H.Btn>
        </div>
      </div>
      <H.Note style={{ bottom: 26, right: 24, transform: 'rotate(3deg)' }}>intent decided here,<br />not at signup</H.Note>
    </div>
  );
}

// canvas version with a pre-typed query so the dropdown is visible
function AcctChooseDemo() { return <AcctChoose initial="vin" />; }

Object.assign(window, { SiteHome, AcctChoose, AcctChooseDemo });
