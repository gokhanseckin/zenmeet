// wf-prototype.jsx — fully interactive click-through of JoinClass.
// Not a slideshow: the buttons INSIDE each screen are live hotspots
// (wired via WF.NavCtx in wf-kit). Click a real button to navigate;
// clicking anywhere else flashes everything clickable (Figma-style).
//
// One connected journey proving the single-account model:
//   join a class (student) → your home → create a classroom (teacher)
// with the same account throughout.

const { useState, useEffect, useMemo, useRef } = React;

const C = window;
const { WF } = window;

// Screen graph. on: { act → target screen id }
const SCREENS = {
  site: { c: () => <C.SiteHome />, device: 'desktop', w: 1080, h: 740, group: 'Start', chip: 'Homepage', title: 'Homepage — logged out',
    hint: <span>Intent-neutral landing — nobody picks “student” or “teacher”. Click <b>Log in / Sign up</b>.</span>,
    on: { login: 'auth' } },
  auth: { c: () => <C.AcctAuth />, device: 'desktop', w: 560, h: 600, group: 'Start', chip: 'Log in', title: 'One login for everyone',
    hint: <span>Same screen to log in or sign up — one account type. Click <b>Continue with Google</b>.</span>,
    on: { google: 'choose', magic: 'choose' } },
  choose: { c: () => <C.AcctChoose />, device: 'desktop', w: 560, h: 640, group: 'Start', chip: 'Choose', title: 'Search or create',
    hint: <span>Type <b>“vin”</b> in the search — results drop down as you type. Click a result, or <b>Create</b>.</span>,
    on: { pickclass: 'classroom', create: 'wizClassroom' } },
  classroom: { c: () => <C.ClassroomA_Mobile />, device: 'mobile', w: 300, h: 660, group: 'Join a class', chip: 'Classroom', title: 'Public classroom page',
    hint: <span>Aiko's classroom. You're already signed in — tap <b>Join — $19/mo</b> to go straight to payment.</span>,
    on: { join: 'pay' } },
  pay: { c: () => <C.PayA2 />, device: 'mobile', w: 300, h: 640, group: 'Join a class', chip: 'Pay', title: 'Become a member',
    hint: <span>Tap <b>Start membership</b>.</span>,
    on: { pay: 'locked' } },
  locked: { c: () => <C.PayA3 />, device: 'mobile', w: 300, h: 690, group: 'Join a class', chip: 'Locked', title: 'Member home — doors locked',
    hint: <span>The link unlocks 5 min before class. Tap the <b>countdown card</b> to time-travel.</span>,
    on: { skip: 'open' } },
  open: { c: () => <C.PayA4 />, device: 'mobile', w: 300, h: 690, group: 'Join a class', chip: 'Doors open', title: '★ Doors open',
    hint: <span>Tap <b>Join class now</b>.</span>,
    on: { joincall: 'incall' } },
  incall: { c: () => <C.AcctCallOpen />, device: 'mobile', w: 300, h: 640, group: 'Join a class', chip: 'In class', title: 'You’re in the call',
    hint: <span>Same account, other hat — tap <b>Create your own classroom</b>.</span>,
    on: { home: 'home' } },
  home: { c: () => <C.AcctHomeMember />, device: 'desktop', w: 560, h: 620, group: 'Your home', chip: 'Home', title: 'Home — one account, two hats',
    hint: <span>Your membership sits above; teaching starts below. Tap <b>Create a classroom</b>.</span>,
    on: { create: 'wizClassroom', openclass: 'open' } },
  wizClassroom: { c: () => <C.OnbA2 />, device: 'desktop', w: 560, h: 600, group: 'Create a classroom', chip: 'Classroom', title: 'Name, URL & price',
    hint: <span>No new signup — you're already logged in. Tap <b>Continue</b>.</span>,
    on: { next: 'wizStripe', home: 'home' } },
  wizStripe: { c: () => <C.OnbA3 />, device: 'desktop', w: 560, h: 600, group: 'Create a classroom', chip: 'Payments', title: 'Get paid',
    hint: <span>Tap <b>Connect Stripe</b>.</span>,
    on: { stripe: 'wizCalls', home: 'home' } },
  wizCalls: { c: () => <C.OnbA4 />, device: 'desktop', w: 560, h: 600, group: 'Create a classroom', chip: 'Calls', title: 'Connect Meet / Zoom',
    hint: <span>Tap <b>Continue</b>.</span>,
    on: { next: 'wizFirst', home: 'home' } },
  wizFirst: { c: () => <C.OnbA5 />, device: 'desktop', w: 560, h: 600, group: 'Create a classroom', chip: 'First class', title: 'Schedule your first class',
    hint: <span>Tap <b>Publish classroom</b>.</span>,
    on: { publish: 'live', home: 'home' } },
  live: { c: () => <C.ClassroomA_Desktop />, device: 'desktop', w: 1080, h: 740, group: 'Create a classroom', chip: '★ Live', title: 'Your classroom is live',
    hint: <span>This is the public page <b>your</b> students see — joined and created with one account. ↺ Start over to replay.</span>,
    on: {} },
};
const ORDER = ['site', 'auth', 'choose', 'classroom', 'pay', 'locked', 'open', 'incall', 'home', 'wizClassroom', 'wizStripe', 'wizCalls', 'wizFirst', 'live'];
const GROUPS = ['Start', 'Join a class', 'Your home', 'Create a classroom'];

// ── device frame ───────────────────────────────────────────
function ProtoFrame({ device, w, h, children }) {
  if (device === 'mobile') {
    return (
      <div style={{ padding: 11, background: '#26251f', borderRadius: 40,
        boxShadow: '0 26px 60px rgba(0,0,0,.30), 0 6px 16px rgba(0,0,0,.18)' }}>
        <div style={{ width: w, height: h, borderRadius: 30, overflow: 'hidden', background: '#fff', position: 'relative' }}>{children}</div>
      </div>
    );
  }
  return (
    <div style={{ width: w, height: h, borderRadius: 12, overflow: 'hidden', background: '#fff',
      border: '1px solid var(--line)', boxShadow: '0 26px 60px rgba(0,0,0,.22), 0 6px 16px rgba(0,0,0,.12)', position: 'relative' }}>
      {children}
    </div>
  );
}

function CtrlBtn({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8,
        fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer',
        border: '1px solid var(--line)', background: '#fff', color: 'var(--ink)',
        opacity: disabled ? 0.4 : 1, whiteSpace: 'nowrap' }}>{children}</button>
  );
}

function Prototype() {
  const [cur, setCur] = useState('site');
  const [hist, setHist] = useState([]);
  const [flash, setFlash] = useState(0);
  const flashTimer = useRef(null);

  const screen = SCREENS[cur];

  const doFlash = () => {
    clearTimeout(flashTimer.current);
    setFlash(Date.now());
    flashTimer.current = setTimeout(() => setFlash(0), 1350);
  };

  // brief pulse on arrival so you can see what's clickable
  useEffect(() => { const t = setTimeout(doFlash, 350); return () => clearTimeout(t); }, [cur]);

  const jump = (id) => { if (id !== cur) { setHist((h) => [...h, cur]); setCur(id); } };
  const back = () => setHist((h) => { if (!h.length) return h; setCur(h[h.length - 1]); return h.slice(0, -1); });
  const restart = () => { setCur('site'); setHist([]); };

  const nav = useMemo(() => ({
    has: (a) => !!screen.on[a],
    go: (a) => { const t = screen.on[a]; if (t) jump(t); },
  }), [cur]);

  const outerW = screen.device === 'mobile' ? screen.w + 22 : screen.w;
  const outerH = screen.device === 'mobile' ? screen.h + 22 : screen.h;
  const boxW = 1110, boxH = 590;
  const scale = Math.min(boxW / outerW, boxH / outerH, 1);

  const Screen = screen.c;
  const stepNum = ORDER.indexOf(cur) + 1;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--panel)', fontFamily: '"Helvetica Neue",Helvetica,Arial,sans-serif', color: 'var(--ink)' }}>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 22px', background: '#fff',
        borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--ink)' }}></div>
          <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-.01em' }}>Prototype</span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--ink2)', borderLeft: '1px solid var(--line2)', paddingLeft: 14 }}>
          One account, two hats — join a class, then create your own
        </span>
        <div style={{ flex: 1 }}></div>
        <span style={{ fontSize: 11.5, color: 'var(--ink3)' }}>The screens are live — click their buttons. Misclicks flash what's clickable.</span>
      </div>

      {/* stage */}
      <div onClick={doFlash} className={flash ? 'wf-flash' : undefined}
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
          backgroundImage: 'radial-gradient(var(--line) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'center', transition: 'transform .2s ease' }}>
          <ProtoFrame device={screen.device} w={screen.w} h={screen.h}>
            <WF.NavCtx.Provider value={nav}><Screen /></WF.NavCtx.Provider>
          </ProtoFrame>
        </div>
        {/* hint bubble */}
        <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          fontSize: 12, color: 'var(--ink)', background: 'rgba(255,255,255,.94)', padding: '7px 14px',
          borderRadius: 20, border: '1px solid var(--line)', pointerEvents: 'none', maxWidth: 720,
          boxShadow: '0 4px 14px rgba(0,0,0,.08)', textAlign: 'center' }}>
          {screen.hint}
        </div>
      </div>

      {/* footer — back · screen map · restart */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 22px', background: '#fff',
        borderTop: '1px solid var(--line)' }}>
        <CtrlBtn onClick={back} disabled={!hist.length}>← Back</CtrlBtn>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flexWrap: 'wrap', rowGap: 5 }}>
          {GROUPS.map((g, gi) => (
            <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
              {gi > 0 && <span style={{ color: 'var(--line)', fontSize: 13, marginRight: 6 }}>→</span>}
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                color: 'var(--ink3)', marginRight: 3 }}>{g}</span>
              {ORDER.filter((id) => SCREENS[id].group === g).map((id) => (
                <button key={id} onClick={() => jump(id)} title={SCREENS[id].title}
                  style={{ padding: '4px 8px', borderRadius: 13, fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    border: `1px solid ${id === cur ? 'var(--accent)' : 'var(--line2)'}`,
                    background: id === cur ? 'var(--accent)' : 'var(--panel)',
                    color: id === cur ? '#fff' : 'var(--ink2)' }}>{SCREENS[id].chip}</button>
              ))}
            </div>
          ))}
        </div>
        <span style={{ fontSize: 11.5, color: 'var(--ink3)', flex: '0 0 auto' }}>{stepNum} / {ORDER.length}</span>
        <CtrlBtn onClick={restart}>↺ Start over</CtrlBtn>
      </div>
    </div>
  );
}

Object.assign(window, { Prototype });
