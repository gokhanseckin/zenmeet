// wf-account.jsx — ONE account type (community-platform model).
// A single login/signup for everyone; "student" and "teacher" are activities,
// not account types. The Home screen holds both: classes you're in (member)
// and classes you teach (your classrooms).

const { WF } = window;
const A = WF;

// ── unified log in / sign up ───────────────────────────────
function AcctAuth() {
  return (
    <div className="wf">
      <div style={{ padding: '16px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line2)' }}>
        <A.Logo />
        <A.Tag>one account · join &amp; teach</A.Tag>
      </div>
      <div style={{ padding: '34px 40px 0' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', marginBottom: 6 }}>Log in or sign up</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink2)', marginBottom: 26, maxWidth: 400, lineHeight: 1.45 }}>
          One JoinClass account does everything — join live classes as a student, and create your own classroom as a teacher. There is no separate teacher account.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, maxWidth: 380 }}>
          <A.Btn className="full dark" act="google">Continue with Google</A.Btn>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--line2)' }}></div>
            <span style={{ fontSize: 11, color: 'var(--ink3)' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--line2)' }}></div>
          </div>
          <A.Field label="Email" value="you@email.com" />
          <A.Btn className="full" act="magic">Email me a magic link</A.Btn>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 18, maxWidth: 380 }}>
          New here? Same buttons — your account is created on the spot. No role to choose.
        </div>
      </div>
      <A.Note style={{ top: 168, right: 22, transform: 'rotate(3deg)' }}>no “student vs<br />teacher” pick — ever</A.Note>
    </div>
  );
}

// ── home — one account, two sections ───────────────────────
function HomeShell({ children, note }) {
  return (
    <div className="wf">
      <div style={{ padding: '15px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line2)' }}>
        <A.Logo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11.5, color: 'var(--ink3)' }}>sam@email.com</span>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--panel)', border: '1px solid var(--line)' }}></div>
        </div>
      </div>
      <div style={{ padding: '22px 26px 0' }}>{children}</div>
      {note}
    </div>
  );
}

const emptyCard = (children) => (
  <div style={{ border: '1.5px dashed var(--line)', borderRadius: 12, padding: '16px 18px', background: 'transparent' }}>{children}</div>
);

function Home({ member, teach }) {
  return (
    <HomeShell note={
      member && teach
        ? <A.Note style={{ top: 220, right: 18, transform: 'rotate(3deg)' }}>same account —<br />two hats</A.Note>
        : <A.Note style={{ top: 320, right: 20, transform: 'rotate(3deg)' }}>both paths live<br />on one home</A.Note>
    }>
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', marginBottom: 4 }}>Home</h1>
      <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 22 }}>The classes you take and the classes you teach — one account.</p>

      <A.Eyebrow style={{ marginBottom: 10 }}>Classes you’re in</A.Eyebrow>
      {member ? (
        <A.Hot act="openclass" radius={12}>
          <div className="wf-card" style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--panel)', border: '1px solid var(--line2)', flex: '0 0 auto' }}></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Morning Vinyasa with Aiko</div>
              <div style={{ fontSize: 12, color: 'var(--ink2)' }}>Member · next class in <b style={{ color: 'var(--accent)' }}>2h 14m</b></div>
            </div>
            <span className="wf-btn ghost sm">Open</span>
          </div>
        </A.Hot>
      ) : emptyCard(
        <div style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.5 }}>
          You’re not in any classes yet. Open a teacher’s class link and tap <b>Join</b> — it shows up here.
        </div>
      )}

      <A.Eyebrow style={{ margin: '22px 0 10px' }}>Classes you teach</A.Eyebrow>
      {teach ? (
        <div className="wf-card" style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--accentSoft)', border: '1px solid var(--accent)', flex: '0 0 auto' }}></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Evening Stretch — your classroom</div>
            <div style={{ fontSize: 12, color: 'var(--ink2)' }}>joinclass.com/sam-stretch · 12 members · Tue 6pm</div>
          </div>
          <span className="wf-btn ghost sm">Schedule</span>
          <span className="wf-btn sm">Manage</span>
        </div>
      ) : emptyCard(
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220, fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.5 }}>
            Teach your own live class — same account, no teacher signup.
          </div>
          <A.Btn act="create">Create a classroom</A.Btn>
        </div>
      )}
    </HomeShell>
  );
}

function AcctHomeNew() { return <Home member={false} teach={false} />; }
function AcctHomeMember() { return <Home member={true} teach={false} />; }
function AcctHomeBoth() { return <Home member={true} teach={true} />; }

// ── "in call" interstitial (prototype bridge) ──────────────
function AcctCallOpen() {
  return (
    <div className="wf">
      <A.Phone url="meet.google.com/…" />
      <div style={{ padding: '42px 22px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <div style={{ width: 0, height: 0, borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderLeft: '15px solid #fff', marginLeft: 4 }}></div>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.01em', marginBottom: 8 }}>Opening Google Meet…</h1>
        <p style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.5, maxWidth: 230, marginBottom: 26 }}>
          You’re in Aiko’s 7:00am class. This link is fresh for today’s session and expires after.
        </p>
        <div style={{ width: '100%', height: 1, background: 'var(--line2)', marginBottom: 22 }}></div>
        <A.Eyebrow style={{ marginBottom: 8 }}>Same account, other hat</A.Eyebrow>
        <p style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.5, maxWidth: 240, marginBottom: 16 }}>
          Want to teach your own class? No new signup — it’s the same login.
        </p>
        <A.Btn className="full dark" act="home">Create your own classroom →</A.Btn>
      </div>
      <A.Note style={{ bottom: 40, right: 14, transform: 'rotate(4deg)' }}>no second<br />account needed</A.Note>
    </div>
  );
}

Object.assign(window, { AcctAuth, AcctHomeNew, AcctHomeMember, AcctHomeBoth, AcctCallOpen });
