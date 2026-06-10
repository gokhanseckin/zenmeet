// wf-classroom.jsx — Public classroom page (logged-out)
// Variant A: countdown-hero (the countdown IS the page)
// Variant B: info + sticky pricing card
// Each in desktop + mobile. Reserved accent = the members-only live link.

const { WF } = window;
const { Browser, Phone, Btn, Img, Bars, Tag, Logo, Platform, Eyebrow, Note, Field } = WF;

// ── shared countdown block ─────────────────────────────────
function Countdown({ size = 'lg', label = 'Next live class in' }) {
  const big = size === 'lg';
  const cell = (n, u) =>
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <div style={{
      fontVariantNumeric: 'tabular-nums', fontWeight: 700, letterSpacing: '-.02em',
      fontSize: big ? 58 : 30, lineHeight: 1, color: 'var(--ink)'
    }}>{n}</div>
      <div className="wf-mono" style={{ fontSize: big ? 11 : 9, letterSpacing: '.12em', color: 'var(--ink3)' }}>{u}</div>
    </div>;

  const sep = <div style={{ fontSize: big ? 44 : 24, fontWeight: 300, color: 'var(--line)', marginTop: big ? -8 : -4 }}>:</div>;
  return (
    <div>
      <Eyebrow style={{ textAlign: 'center', marginBottom: big ? 14 : 9 }}>{label}</Eyebrow>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: big ? 16 : 9 }}>
        {cell('02', 'HRS')}{sep}{cell('14', 'MIN')}{sep}{cell('53', 'SEC')}
      </div>
    </div>);

}

// lock row — the core promise, shown locked on the public page
function LockRow({ compact }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: compact ? '9px 12px' : '12px 16px',
      border: '1px dashed var(--accent)', borderRadius: 9, background: 'var(--accentSoft)'
    }}>
      <div style={{ width: 16, height: 16, borderRadius: 4, border: '2px solid var(--accent)', position: 'relative', flex: '0 0 auto' }}>
        <div style={{ position: 'absolute', inset: '3px 4px', borderTop: '2px solid var(--accent)', borderRadius: '6px 6px 0 0', top: -5, left: 3, right: 3, height: 8, borderBottom: 0 }} />
      </div>
      <div style={{ fontSize: compact ? 11.5 : 13, color: 'var(--accent)', fontWeight: 600, lineHeight: 1.25 }}>
        Live link unlocks 5 min before — members only
      </div>
    </div>);

}

const included = ['Live class, 3× / week', 'New private link each session', 'Cancel anytime'];

// ════════════════════ VARIANT A — countdown hero ════════════════════
function ClassroomA_Desktop() {
  return (
    <div className="wf">
      <Browser url="aiko-vinyasa" />
      <div style={{ padding: '20px 34px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo />
        <div style={{ display: 'flex', gap: 10 }}><Btn className="ghost sm" act="signin">Sign in</Btn></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '14px 40px 0' }}>
        <Eyebrow style={{ marginBottom: 12 }}>Live class · Mon · Wed · Fri · 7:00am</Eyebrow>
        <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.02em', marginBottom: 6 }}>Morning Vinyasa with Aiko</h1>
        <div style={{ display: 'flex', gap: 8, marginBottom: 26 }}>
          <Platform name="Google Meet" /><Tag>42 members</Tag>
        </div>
        <Countdown />
        <div style={{ width: 320, marginTop: 26 }}><LockRow /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 24 }}>
          <Btn className="lg" act="join"><span>Join — $19<span style={{ opacity: .7, fontWeight: 500 }}>/mo</span></span></Btn>
          <span style={{ fontSize: 13, color: 'var(--ink2)' }}>Cancel anytime</span>
        </div>
        <div style={{ display: 'flex', gap: 26, marginTop: 30 }}>
          {included.map((t) =>
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink2)' }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: 'var(--ink3)' }} />{t}
            </div>
          )}
        </div>
      </div>
      <Note style={{ top: 250, right: 26, transform: 'rotate(3deg)', textAlign: 'left' }}>
        countdown = the<br />whole page
      </Note>
    </div>);

}

function ClassroomA_Mobile() {
  return (
    <div className="wf">
      <Phone url="aiko-vinyasa" />
      <div style={{ padding: '16px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Logo /><WF.Hot inline act="signin"><span style={{ fontSize: 12, color: 'var(--ink2)' }}>Sign in</span></WF.Hot>
      </div>
      <div style={{ padding: '22px 18px 0', textAlign: 'center' }}>
        <Eyebrow style={{ marginBottom: 9 }}>Mon · Wed · Fri · 7am</Eyebrow>
        <h1 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-.01em', marginBottom: 8 }}>Morning Vinyasa with Aiko</h1>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 22 }}>
          <Platform name="Google Meet" />
        </div>
        <Countdown size="sm" />
        <div style={{ marginTop: 20 }}><LockRow compact /></div>
        <div style={{ marginTop: 18 }}><Btn className="full lg" act="join">Join — $19/mo</Btn></div>
        <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 10 }}>Cancel anytime</div>
        <div style={{ marginTop: 22, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 11 }}>
          {included.map((t) =>
          <div key={t} style={{ display: 'flex', gap: 9, fontSize: 12.5, color: 'var(--ink2)' }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: 'var(--ink3)', marginTop: 5 }} />{t}
            </div>
          )}
        </div>
      </div>
    </div>);

}

// ════════════════════ VARIANT B — info + pricing card ════════════════════
function ClassroomB_Desktop() {
  const dates = [['Mon Jun 9', '7:00am'], ['Wed Jun 11', '7:00am'], ['Fri Jun 13', '7:00am']];
  return (
    <div className="wf">
      <Browser url="aiko-vinyasa" />
      <div style={{ padding: '18px 34px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo /><Btn className="ghost sm">Sign in</Btn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 30, padding: '6px 34px 0' }}>
        {/* left: info */}
        <div>
          <Img label="cover image" style={{ height: 168, marginBottom: 20 }} />
          <Eyebrow style={{ marginBottom: 9 }}>Live yoga · weekly</Eyebrow>
          <h1 style={{ fontSize: 27, fontWeight: 700, letterSpacing: '-.02em', marginBottom: 10 }}>Morning Vinyasa with Aiko</h1>
          <Bars lines={3} widths={['100%', '96%', '70%']} style={{ marginBottom: 24 }} />
          <div className="wf-mono" style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 12 }}>Upcoming classes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--line)', borderRadius: 10 }}>
            {dates.map(([d, t], i) =>
            <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 15px', borderTop: i ? '1px solid var(--line2)' : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{d}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{t}</span>
                  <Platform name="Meet" />
                </div>
                {i === 0 ?
              <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>in 2h 14m</span> :
              <span style={{ fontSize: 11.5, color: 'var(--ink3)' }}>locked</span>}
              </div>
            )}
          </div>
        </div>
        {/* right: sticky pricing */}
        <div className="wf-card" style={{ padding: 20, alignSelf: 'start' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 4 }}>
            <span style={{ fontSize: 30, fontWeight: 700 }}>$19</span>
            <span style={{ fontSize: 14, color: 'var(--ink2)' }}>/ month</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginBottom: 16 }}>Billed monthly · cancel anytime</div>
          <div style={{ padding: '12px 0', borderTop: '1px solid var(--line2)', borderBottom: '1px solid var(--line2)', marginBottom: 16 }}>
            <Countdown size="sm" label="Next class" />
          </div>
          <div style={{ marginBottom: 14 }}><LockRow compact /></div>
          <Btn className="full lg" style={{ marginBottom: 14 }}>Join class</Btn>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {included.map((t) =>
            <div key={t} style={{ display: 'flex', gap: 9, fontSize: 12.5, color: 'var(--ink2)' }}>
                <span style={{ width: 6, height: 6, borderRadius: 2, background: 'var(--ink3)', marginTop: 5 }} />{t}
              </div>
            )}
          </div>
        </div>
      </div>
      <Note style={{ top: 360, right: 18, transform: 'rotate(3deg)' }}>sticky while<br />you scroll</Note>
    </div>);

}

function ClassroomB_Mobile() {
  const dates = [['Mon Jun 9', 'in 2h 14m', true], ['Wed Jun 11', 'locked', false], ['Fri Jun 13', 'locked', false]];
  return (
    <div className="wf">
      <Phone url="aiko-vinyasa" />
      <div style={{ padding: '14px 16px 0' }}>
        <Img label="cover" style={{ height: 96, marginBottom: 14 }} />
        <Eyebrow style={{ marginBottom: 7 }}>Live yoga · weekly</Eyebrow>
        <h1 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', marginBottom: 9 }}>Morning Vinyasa with Aiko</h1>
        <Bars lines={2} widths={['100%', '64%']} style={{ marginBottom: 16 }} />
        <div style={{ border: '1px solid var(--line)', borderRadius: 9, marginBottom: 14 }}>
          {dates.map(([d, s, hot], i) =>
          <div key={d} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderTop: i ? '1px solid var(--line2)' : 0 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{d}</span>
              <span style={{ fontSize: 11.5, color: hot ? 'var(--accent)' : 'var(--ink3)', fontWeight: hot ? 600 : 400 }}>{s}</span>
            </div>
          )}
        </div>
        <LockRow compact />
      </div>
      {/* sticky bottom bar */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderTop: '1px solid var(--line)', background: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div><div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>$19<span style={{ fontSize: 11, color: 'var(--ink2)', fontWeight: 500 }}>/mo</span></div></div>
        <Btn className="full" style={{ flex: 1 }}>Join class</Btn>
      </div>
    </div>);

}

Object.assign(window, { ClassroomA_Desktop, ClassroomA_Mobile, ClassroomB_Desktop, ClassroomB_Mobile });