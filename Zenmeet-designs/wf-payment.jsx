// wf-payment.jsx — Student join + payment flow (mobile storyboard)
// Variant A: stepped (account → pay → member home → UNLOCK)
// Variant B: one-sheet checkout
// The signature moment: countdown unlocks into a live Join button.

const { WF } = window;
const P = WF;

function MFrame({ url = 'aiko-vinyasa', children, pad = true }) {
  return (
    <div className="wf">
      <P.Phone url={url} />
      <div style={{ padding: pad ? '18px 18px 0' : 0 }}>{children}</div>
    </div>);

}

const orderSummary =
<div className="wf-card" style={{ padding: 14, marginBottom: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Morning Vinyasa with Aiko</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink2)', marginTop: 2 }}>Monthly membership · live on Google Meet</div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700 }}>$19<span style={{ color: 'var(--ink2)', fontWeight: 500 }}>/mo</span></span>
    </div>
  </div>;


// ════════ VARIANT A ════════
// A1 — create account
function PayA1() {
  return (
    <MFrame>
      <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 18 }}>
        <P.Hot inline act="back"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span>←</span> Morning Vinyasa with Aiko</span></P.Hot>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <P.Logo />
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.01em', marginBottom: 6 }}>Log in or sign up</h1>
      <p style={{ fontSize: 12.5, color: 'var(--ink2)', marginBottom: 16, lineHeight: 1.45 }}>One JoinClass account for everything — join Aiko's class now, or create your own classroom later with the same login. No teacher vs student accounts.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        <P.Btn className="full dark" act="google">Continue with Google</P.Btn>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--line2)' }} /><span style={{ fontSize: 11, color: 'var(--ink3)' }}>or</span><div style={{ flex: 1, height: 1, background: 'var(--line2)' }} />
        </div>
        <P.Field label="Email" value="student@email.com" />
        <P.Btn className="full" act="magic">Email me a magic link</P.Btn>
      </div>
    </MFrame>);

}

// A2 — payment
function PayA2() {
  return (
    <MFrame>
      <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 14 }}>Step 2 of 2 · Become a member</div>
      <h1 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', marginBottom: 3 }}>Morning Vinyasa with Aiko</h1>
      <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginBottom: 16 }}>Monthly membership</div>
      {orderSummary}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <P.Field label="Card number" value="•••• •••• •••• 4242" />
        <div style={{ display: 'flex', gap: 10 }}>
          <P.Field label="Expiry" value="08 / 28" style={{ flex: 1 }} />
          <P.Field label="CVC" value="•••" style={{ flex: 1 }} />
        </div>
      </div>
      <div style={{ marginTop: 16 }}><P.Btn className="full lg" act="pay">Start membership</P.Btn></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, fontSize: 11, color: 'var(--ink3)' }}>
        <span className="wf-mono">secured by Stripe</span>
      </div>
    </MFrame>);

}

// A3 — member home (locked, counting down)
function memberHome({ unlocked }) {
  return (
    <MFrame url="my/aiko-vinyasa">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <P.Logo /><div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--panel)', border: '1px solid var(--line)' }} />
      </div>
      <P.Tag style={{ marginBottom: 12, borderColor: '#bcd6bf', color: '#3f7a4a' }}>● Active member</P.Tag>
      <h1 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', marginBottom: 4 }}>Morning Vinyasa</h1>
      <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginBottom: 20 }}>with Aiko · Google Meet</div>

      {/* the live-link card — the signature moment */}
      <P.Hot act="skip" radius={12} style={{ marginBottom: 16 }}>
      <div className="wf-card" style={{ padding: 18, textAlign: 'center', borderColor: unlocked ? 'var(--accent)' : 'var(--line)', borderWidth: unlocked ? 2 : 1 }}>
        <P.Eyebrow style={{ marginBottom: 12 }}>Next class · Mon 7:00am</P.Eyebrow>
        {unlocked ?
        <React.Fragment>
            <div className="wf-mono" style={{ fontSize: 10, letterSpacing: '.12em', color: '#3f7a4a', marginBottom: 12 }}>● DOORS OPEN</div>
            <P.Btn className="full lg" style={{ marginBottom: 8 }} act="joincall">Join class now →</P.Btn>
            <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>Opens Google Meet · link expires after class</div>
          </React.Fragment> :

        <React.Fragment>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 38, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>02:14</span>
              <span className="wf-mono" style={{ fontSize: 11, color: 'var(--ink3)' }}>HRS:MIN</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 12px', border: '1px dashed var(--accent)', borderRadius: 8, background: 'var(--accentSoft)', marginTop: 8 }}>
              <div style={{ width: 13, height: 13, borderRadius: 3, border: '2px solid var(--accent)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>Link unlocks 5 min before</span>
            </div>
          </React.Fragment>
        }
      </div>
      </P.Hot>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {['Manage membership', 'Billing & receipts', 'Class schedule'].map((t, i) =>
        <div key={t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 2px', borderTop: i ? '1px solid var(--line2)' : 0, fontSize: 13.5 }}>
            <span>{t}</span><span style={{ color: 'var(--ink3)' }}>›</span>
          </div>
        )}
      </div>
      {!unlocked && <P.Note style={{ top: 452, right: 10, transform: 'rotate(4deg)' }}>locked until<br />T-minus 5</P.Note>}
      {unlocked && <P.Note style={{ top: 452, right: 8, transform: 'rotate(4deg)' }}>unlocks into<br />a Join button!</P.Note>}
    </MFrame>);

}
function PayA3() {return memberHome({ unlocked: false });}
function PayA4() {return memberHome({ unlocked: true });}

// ════════ VARIANT B — one-sheet checkout ════════
function PayB1() {
  return (
    <div className="wf">
      <P.Phone url="aiko-vinyasa" />
      {/* dimmed classroom behind */}
      <div style={{ padding: '16px 18px', opacity: .45 }}>
        <P.Img label="cover" style={{ height: 70, marginBottom: 10 }} />
        <div style={{ fontSize: 16, fontWeight: 700 }}>Morning Vinyasa with Aiko</div>
      </div>
      <div style={{ position: 'absolute', inset: 0, top: 26, background: 'rgba(43,42,39,.22)' }} />
      {/* bottom sheet */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '18px 18px 0 0', border: '1px solid var(--line)', borderBottom: 0, padding: '14px 18px 20px', boxShadow: '0 -10px 40px rgba(0,0,0,.12)' }}>
        <div style={{ width: 38, height: 4, borderRadius: 3, background: 'var(--line)', margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>Become a member</div>
            <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 2 }}>Morning Vinyasa with Aiko</div>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700 }}>$19<span style={{ fontSize: 11, color: 'var(--ink2)', fontWeight: 500 }}>/mo</span></span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <P.Field label="Email" value="student@email.com" />
          <P.Field label="Card" value="•••• 4242   08/28   •••" />
        </div>
        <div style={{ marginTop: 14 }}><P.Btn className="full lg">Pay $19 &amp; join</P.Btn></div>
        <div className="wf-mono" style={{ fontSize: 10, color: 'var(--ink3)', textAlign: 'center', marginTop: 10 }}>billed monthly · cancel anytime · secured by Stripe</div>
      </div>
      <P.Note style={{ top: 70, left: 14, transform: 'rotate(-3deg)' }}>one sheet,<br />no page jumps</P.Note>
    </div>);

}

// B2 — confirmation after one-sheet checkout
function PayB2() {
  return (
    <MFrame url="my/aiko-vinyasa">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 26 }}>
        <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 18 }}>✓</div>
        <h1 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-.01em', marginBottom: 6 }}>You're a member</h1>
        <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 24, maxWidth: 230 }}>Morning Vinyasa with Aiko · $19/mo</p>
        <div className="wf-card" style={{ padding: 16, width: '100%', marginBottom: 18 }}>
          <P.Eyebrow style={{ marginBottom: 8 }}>Your next class</P.Eyebrow>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Monday · 7:00am</div>
          <div style={{ fontSize: 12, color: 'var(--ink2)' }}>Google Meet · link reveals 5 min before</div>
        </div>
        <P.Btn className="full lg">Go to my class</P.Btn>
        <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 14 }}>Receipt sent to your email</div>
      </div>
    </MFrame>);

}

Object.assign(window, { PayA1, PayA2, PayA3, PayA4, PayB1, PayB2 });