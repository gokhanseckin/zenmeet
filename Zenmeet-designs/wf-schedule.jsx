// wf-schedule.jsx — Scheduling
// Variant A: Google-Calendar-style class editor (one-off vs recurring) + live preview
// Variant B: week schedule that handles many classes at varied times
// (recurring vs one-off shown distinctly)

const { WF } = window;
const S = WF;

function Rail({ active }) {
  const items = ['Classroom', 'Schedule', 'Students', 'Payments'];
  return (
    <div style={{ width: 162, borderRight: '1px solid var(--line2)', padding: '20px 14px', flex: '0 0 auto' }}>
      <S.Logo style={{ marginBottom: 24, paddingLeft: 6 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {items.map((t) => (
          <div key={t} style={{ padding: '9px 11px', borderRadius: 7, fontSize: 13, fontWeight: t === active ? 600 : 500,
            background: t === active ? 'var(--panel)' : 'transparent', color: t === active ? 'var(--ink)' : 'var(--ink2)' }}>{t}</div>
        ))}
      </div>
    </div>
  );
}

// segmented control — one-off vs recurring
function Segment({ options, active, style }) {
  return (
    <div style={{ display: 'inline-flex', padding: 3, background: 'var(--panel)', borderRadius: 9, gap: 3, ...style }}>
      {options.map((o) => (
        <div key={o} style={{ padding: '7px 15px', borderRadius: 6, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
          background: o === active ? '#fff' : 'transparent', color: o === active ? 'var(--ink)' : 'var(--ink2)',
          boxShadow: o === active ? '0 1px 2px rgba(0,0,0,.1)' : 'none' }}>{o}</div>
      ))}
    </div>
  );
}

// line-icon glyphs used as the leading affordance on each editor row.
// Deliberately NOT a bordered square — that read as a checkbox.
const RowIcon = ({ name }) => {
  const p = { width: 17, height: 17, viewBox: '0 0 18 18', fill: 'none', stroke: 'var(--ink3)', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'clock') return <svg {...p}><circle cx="9" cy="9" r="6.5" /><path d="M9 5.5V9l2.4 1.6" /></svg>;
  if (name === 'repeat') return <svg {...p}><path d="M3.5 8V7a3 3 0 0 1 3-3h6l-1.8-1.8M14.5 10v1a3 3 0 0 1-3 3h-6l1.8 1.8" /></svg>;
  if (name === 'video') return <svg {...p}><rect x="2.5" y="5" width="9" height="8" rx="2" /><path d="M11.5 8.2l4-2.2v6l-4-2.2" /></svg>;
  if (name === 'link') return <svg {...p}><path d="M7.5 10.5l3-3M6.5 11.8l-1 1a2.4 2.4 0 0 1-3.4-3.4l1.6-1.6a2.4 2.4 0 0 1 3.4 0M11.5 6.2l1-1a2.4 2.4 0 0 1 3.4 3.4l-1.6 1.6a2.4 2.4 0 0 1-3.4 0" /></svg>;
  return null;
};

// a Google-Calendar-style editor row: leading line-icon + content
function Row({ children, last, icon, style }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '13px 0', borderBottom: last ? 'none' : '1px solid var(--line2)', ...style }}>
      <div style={{ width: 18, height: 18, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <RowIcon name={icon} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

// inline borderless "select" used inside GCal rows
function GSelect({ value, strong, style }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 9px', borderRadius: 7,
      background: 'var(--panel)', fontSize: 13, fontWeight: strong ? 600 : 500, color: 'var(--ink)', ...style }}>
      {value}
      <svg width="10" height="10" viewBox="0 0 11 11" fill="none" stroke="var(--ink2)" strokeWidth="1.6" strokeLinecap="round"><path d="M2 4l3.5 3.5L9 4" /></svg>
    </span>
  );
}

// ════════ VARIANT A — Google-Calendar-style class editor ════════
function SchedA_Desktop() {
  const occ = [['Mon Jun 9', '7:00am'], ['Mon Jun 16', '7:00am'], ['Mon Jun 23', '7:00am'], ['Mon Jun 30', '7:00am']];
  return (
    <div className="wf" style={{ display: 'flex' }}>
      <Rail active="Schedule" />
      <div style={{ flex: 1, padding: '22px 28px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em' }}>New class</h1>
          <Segment options={['One-off', 'Recurring']} active="Recurring" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 26 }}>
          {/* GCal-style editor */}
          <div>
            {/* borderless title, like GCal "Add title" */}
            <input className="wf-titleinput" defaultValue="Morning Vinyasa with Aiko" readOnly />
            <div style={{ marginTop: 6 }}>
              <Row icon="clock">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <GSelect value="Mon, Jun 9" strong />
                  <GSelect value="7:00am" />
                  <span style={{ color: 'var(--ink3)', fontSize: 13 }}>–</span>
                  <GSelect value="8:00am" />
                </div>
              </Row>
              <Row icon="repeat">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <GSelect value="Weekly on Monday" strong />
                  <span style={{ fontSize: 12, color: 'var(--ink3)' }}>until · forever</span>
                </div>
              </Row>
              <Row icon="video">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <GSelect value="Google Meet" strong />
                  <span style={{ fontSize: 12, color: 'var(--ink3)' }}>or Zoom</span>
                </div>
              </Row>
              <Row last icon="link">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--accent)', fontWeight: 600 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, border: '1.5px solid var(--accent)' }} />
                  Fresh private link per session · revealed 5 min before
                </div>
              </Row>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 22 }}>
              <S.Btn className="lg">Save &amp; publish</S.Btn>
              <span style={{ fontSize: 12.5, color: 'var(--ink2)' }}>More options</span>
            </div>
          </div>
          {/* live preview */}
          <div className="wf-card" style={{ padding: 16, alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <S.Eyebrow>Scheduled sessions</S.Eyebrow>
              <span style={{ fontSize: 11, color: 'var(--ink3)' }}>repeats weekly</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {occ.map(([d, t], i) => (
                <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderTop: i ? '1px solid var(--line2)' : 0 }}>
                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>{d}</div><div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{t} · Meet</div></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, border: '1.5px solid var(--accent)' }} />
                    <span className="wf-mono" style={{ fontSize: 10.5, color: 'var(--accent)' }}>link auto</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line2)', fontSize: 11.5, color: 'var(--ink2)', lineHeight: 1.45 }}>
              Switch to <b>One-off</b> for a single class with no repeat.
            </div>
          </div>
        </div>
      </div>
      <S.Note style={{ bottom: 60, left: 200, transform: 'rotate(-3deg)' }}>feels like a<br />calendar event</S.Note>
    </div>
  );
}

function SchedA_Mobile() {
  return (
    <div className="wf">
      <S.Phone url="schedule/new" />
      <div style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 14 }}>← Schedule</div>
        <h1 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', marginBottom: 14 }}>New class</h1>
        <Segment options={['One-off', 'Recurring']} active="Recurring" style={{ marginBottom: 16, width: '100%', display: 'flex' }} />
        <input className="wf-titleinput sm" defaultValue="Morning Vinyasa with Aiko" readOnly />
        <div style={{ marginTop: 8 }}>
          <Row icon="clock"><div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}><GSelect value="Mon, Jun 9" strong /><GSelect value="7–8am" /></div></Row>
          <Row icon="repeat"><GSelect value="Weekly on Monday" strong /></Row>
          <Row last icon="video"><GSelect value="Google Meet" strong /></Row>
        </div>
        <div style={{ marginTop: 14, padding: '11px 13px', border: '1px dashed var(--accent)', borderRadius: 8, background: 'var(--accentSoft)', fontSize: 11.5, color: 'var(--accent)', fontWeight: 600, lineHeight: 1.4 }}>
          New private link per session, revealed 5 min before.
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderTop: '1px solid var(--line)', background: '#fff', padding: '12px 16px' }}>
        <S.Btn className="full lg">Save &amp; publish</S.Btn>
      </div>
    </div>
  );
}

// ════════ VARIANT B — week schedule, varied times, recurring vs one-off ════════
function SchedB_Desktop() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dates = ['9', '10', '11', '12', '13', '14', '15'];
  const startH = 7, endH = 14, hPx = 32;
  const hours = [];
  for (let h = startH; h <= endH; h++) hours.push(h);
  const fmt = (h) => { const ap = h >= 12 ? 'p' : 'a'; const hh = h > 12 ? h - 12 : h; return `${hh}${ap}`; };
  const fmtT = (h) => { const ap = h >= 12 ? 'pm' : 'am'; const whole = Math.floor(h); const m = h % 1 ? ':30' : ':00'; const hh = whole > 12 ? whole - 12 : whole; return `${hh}${m}${ap}`; };
  // events at genuinely different times across the week
  const events = [
    { day: 0, start: 7, len: 1, title: 'Vinyasa', rec: true },
    { day: 1, start: 9, len: 1, title: 'Breathwork', rec: true },
    { day: 2, start: 7, len: 1, title: 'Vinyasa', rec: true },
    { day: 2, start: 12, len: 1.5, title: 'Workshop', rec: false },
    { day: 3, start: 8.5, len: 1, title: 'Live Q&A', rec: false },
    { day: 4, start: 7, len: 1, title: 'Vinyasa', rec: true },
    { day: 5, start: 10, len: 1.5, title: 'Open mat', rec: true },
  ];
  const gutter = 42;
  return (
    <div className="wf" style={{ display: 'flex' }}>
      <Rail active="Schedule" />
      <div style={{ flex: 1, padding: '22px 26px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h1 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-.02em' }}>Schedule</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12.5, color: 'var(--ink2)' }}>Jun 9 – 15</span>
            <S.Btn className="sm">+ New class</S.Btn>
          </div>
        </div>
        {/* legend */}
        <div style={{ display: 'flex', gap: 18, marginBottom: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--ink2)' }}>
            <span style={{ width: 14, height: 11, borderRadius: 3, background: 'var(--accentSoft)', border: '1px solid var(--accent)' }} />Recurring
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--ink2)' }}>
            <span style={{ width: 14, height: 11, borderRadius: 3, background: 'var(--accent2Soft)', border: '1px solid var(--accent2)' }} />One-off
          </span>
        </div>
        {/* day header */}
        <div style={{ display: 'flex', marginBottom: 2 }}>
          <div style={{ width: gutter, flex: '0 0 auto' }} />
          {days.map((d, i) => (
            <div key={d} style={{ flex: 1, textAlign: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink2)' }}>{d} </span>
              <span style={{ fontSize: 11, color: 'var(--ink3)' }}>{dates[i]}</span>
            </div>
          ))}
        </div>
        {/* time grid */}
        <div style={{ display: 'flex', border: '1px solid var(--line2)', borderRadius: 8, overflow: 'hidden' }}>
          {/* gutter */}
          <div style={{ width: gutter, flex: '0 0 auto', borderRight: '1px solid var(--line2)' }}>
            {hours.map((h, i) => (
              <div key={h} style={{ height: hPx, position: 'relative' }}>
                {i < hours.length && <span style={{ position: 'absolute', top: 2, right: 6, fontSize: 9.5, color: 'var(--ink3)' }}>{fmt(h)}</span>}
              </div>
            ))}
          </div>
          {/* day columns */}
          {days.map((d, di) => (
            <div key={d} style={{ flex: 1, position: 'relative', borderRight: di < 6 ? '1px solid var(--line2)' : 'none' }}>
              {hours.map((h, hi) => (
                <div key={h} style={{ height: hPx, borderTop: hi ? '1px solid var(--line2)' : 'none' }} />
              ))}
              {events.filter((e) => e.day === di).map((e, ei) => (
                <div key={ei} style={{ position: 'absolute', top: (e.start - startH) * hPx + 1, left: 3, right: 3, height: e.len * hPx - 3,
                  borderRadius: 5, padding: '4px 6px', overflow: 'hidden',
                  background: e.rec ? 'var(--accentSoft)' : 'var(--accent2Soft)',
                  border: `1px solid ${e.rec ? 'var(--accent)' : 'var(--accent2)'}` }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: e.rec ? 'var(--accent)' : 'var(--accent2)', lineHeight: 1.1 }}>{fmtT(e.start)}</div>
                  <div style={{ fontSize: 9.5, color: e.rec ? 'var(--accent)' : 'var(--accent2)', lineHeight: 1.1, whiteSpace: 'nowrap' }}>{e.title}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--ink3)' }}>Different times each day, one-off &amp; recurring side by side · click any block to edit, drag to reschedule.</div>
      </div>
      <S.Note style={{ bottom: 36, right: 40, transform: 'rotate(3deg)' }}>handles many<br />classes &amp; times</S.Note>
    </div>
  );
}

Object.assign(window, { SchedA_Desktop, SchedA_Mobile, SchedB_Desktop });
