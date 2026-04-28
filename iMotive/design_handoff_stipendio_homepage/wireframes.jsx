/* global React */
const { useState } = React;

// ---------- Shared sketch primitives ----------

const sketchStyles = `
  .wf {
    font-family: 'Inter', system-ui, sans-serif;
    color: #1a1a1a;
    background: #fafaf7;
    --ink: #1a1a1a;
    --ink-2: #555;
    --ink-3: #999;
    --paper: #fafaf7;
    --paper-2: #f0efea;
    --blue: #3B82F6;
    --green: #22C55E;
    --yellow: #FACC15;
  }
  .wf.mono { --blue: #1a1a1a; --green: #1a1a1a; --yellow: #1a1a1a; }

  .wf .hand { font-family: 'Caveat', cursive; font-weight: 600; }
  .wf .marker { font-family: 'Architects Daughter', cursive; }
  .wf .mono-txt { font-family: 'JetBrains Mono', ui-monospace, monospace; }

  .wf .sk-box {
    border: 2px solid var(--ink);
    border-radius: 6px;
    background: var(--paper);
    position: relative;
  }
  .wf .sk-box-2 { border-width: 2.5px; border-radius: 10px; }
  .wf .sk-dash { border: 2px dashed var(--ink-2); border-radius: 6px; }
  .wf .sk-fill { background: var(--paper-2); }

  .wf .sk-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 12px 22px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    font-weight: 600;
    background: var(--paper);
    box-shadow: 3px 3px 0 var(--ink);
  }
  .wf .sk-btn.primary { background: var(--blue); color: #fff; border-color: var(--ink); }
  .wf .sk-btn.go { background: var(--green); color: #fff; }
  .wf .sk-btn.ghost { background: transparent; box-shadow: none; }

  .wf .sk-pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px;
    border: 1.5px solid var(--ink-2);
    border-radius: 999px;
    font-size: 12px;
    background: var(--paper);
  }

  .wf .sk-img {
    background:
      repeating-linear-gradient(135deg,
        var(--paper-2) 0 8px,
        transparent 8px 16px);
    border: 2px solid var(--ink);
    border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    color: var(--ink-2);
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 12px;
    text-align: center;
    padding: 8px;
  }

  .wf .sk-line {
    height: 10px; border-radius: 3px;
    background: var(--paper-2);
    border: 1px solid var(--ink-3);
  }
  .wf .sk-line.short { width: 60%; }
  .wf .sk-line.tiny { width: 30%; height: 8px; }

  .wf .sk-bar {
    height: 8px; border-radius: 999px;
    background: var(--paper-2);
    border: 1.5px solid var(--ink);
    overflow: hidden;
    position: relative;
  }
  .wf .sk-bar > span {
    display: block; height: 100%;
    background: var(--green);
  }
  .wf .sk-bar.warn > span { background: var(--yellow); }

  .wf .annot {
    position: absolute;
    color: var(--ink-2);
    font-family: 'Caveat', cursive;
    font-size: 18px;
    font-weight: 600;
    pointer-events: none;
  }
  .wf .annot::before {
    content: '';
    position: absolute;
    width: 28px; height: 28px;
    border: 1.5px solid var(--ink-2);
    border-right: none; border-top: none;
    border-bottom-left-radius: 12px;
  }
  .wf .annot.tl::before { left: -32px; top: -2px; transform: rotate(0deg); }
  .wf .annot.tr::before { right: -32px; top: -2px; transform: scaleX(-1); }
  .wf .annot.br::before { right: -32px; bottom: -2px; transform: scale(-1, -1); }

  .wf .scribble {
    background: repeating-linear-gradient(115deg,
      var(--ink) 0 1px,
      transparent 1px 5px);
    opacity: 0.35;
  }

  .wf .nav {
    display: flex; align-items: center; gap: 24px;
    padding: 18px 36px;
    border-bottom: 2px solid var(--ink);
  }
  .wf .logo {
    font-family: 'Architects Daughter', cursive;
    font-size: 22px; font-weight: 700;
    display: flex; align-items: center; gap: 8px;
  }
  .wf .logo .dot {
    width: 22px; height: 22px; border: 2.5px solid var(--ink);
    border-radius: 50%;
    background: var(--blue);
  }

  .wf .section-tag {
    display: inline-block;
    font-family: 'Caveat', cursive;
    font-size: 22px;
    color: var(--ink-2);
    border-bottom: 2px solid var(--ink-2);
    padding-bottom: 2px;
    margin-bottom: 18px;
  }

  .wf h1.headline {
    font-family: 'Architects Daughter', cursive;
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: -0.5px;
    margin: 0;
  }
  .wf h2.section-h {
    font-family: 'Architects Daughter', cursive;
    font-weight: 700;
    margin: 0 0 12px;
  }

  .wf .squiggle {
    display: block;
    width: 100%; height: 10px;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 10' preserveAspectRatio='none'><path d='M0,5 Q15,0 30,5 T60,5 T90,5 T120,5' fill='none' stroke='%231a1a1a' stroke-width='1.6'/></svg>");
    background-size: 120px 10px;
    background-repeat: repeat-x;
  }
`;

function Nav({ blueLogo = true }) {
  return (
    <div className="nav">
      <div className="logo">
        <span className="dot" style={!blueLogo ? { background: '#fafaf7' } : null}></span>
        iMotive
      </div>
      <div style={{ display: 'flex', gap: 22, marginLeft: 32, fontSize: 14, color: '#555' }}>
        <span>Browse</span>
        <span>How it works</span>
        <span>For universities</span>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 14 }}>Log in</span>
        <span className="sk-btn" style={{ padding: '8px 18px', fontSize: 14 }}>Sign up</span>
      </div>
    </div>);

}

// ---------- V1: SEARCH-LED (Google-like, utility-first) ----------

function V1_SearchLed() {
  return (
    <div className="wf" style={{ width: 1280, minHeight: 1840 }}>
      <Nav />

      {/* Hero: enormous search bar */}
      <section style={{ padding: '90px 36px 70px', textAlign: 'center', position: 'relative' }}>
        <div className="hand" style={{ fontSize: 22, color: '#555', marginBottom: 18 }}>
          ✦ for university students in Sweden
        </div>
        <h1 className="headline" style={{ fontSize: 76, marginBottom: 18 }}>
          Find scholarships<br />in seconds.
        </h1>
        <p style={{ fontSize: 18, color: '#555', maxWidth: 540, margin: '0 auto 40px' }}>
          One search. Every scholarship you qualify for, in one place.
        </p>

        {/* Big search */}
        <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative' }}>
          <div className="sk-box sk-box-2" style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '18px 22px',
            boxShadow: '4px 4px 0 var(--ink)',
            background: '#fff'
          }}>
            <div style={{
              width: 22, height: 22, border: '2.5px solid var(--ink)',
              borderRadius: '50%', position: 'relative', flexShrink: 0
            }}>
              <span style={{
                position: 'absolute', right: -7, bottom: -7,
                width: 10, height: 2.5, background: 'var(--ink)',
                transform: 'rotate(45deg)', transformOrigin: 'left'
              }}></span>
            </div>
            <span style={{ flex: 1, textAlign: 'left', color: '#999', fontSize: 18 }}>
              e.g. "engineering, master's, Lund"
            </span>
            <span className="sk-btn primary" style={{ boxShadow: 'none' }}>Search</span>
          </div>
          <span className="annot tr" style={{ top: 10, right: -160, width: 150 }}>
            search is THE hero
          </span>
        </div>

        {/* Quick filter chips */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap', maxWidth: 720, margin: '24px auto 0' }}>
          {['Engineering', 'Masters', 'Need-based', 'Women in STEM', 'Erasmus', 'Lund', '+ 12 more'].map((c, i) =>
          <span key={i} className="sk-pill">{c}</span>
          )}
        </div>

        <div style={{ marginTop: 28, fontSize: 14, color: '#555' }}>
          or <u>browse all 2,400+ scholarships</u> →
        </div>
      </section>

      {/* Social proof - thin strip */}
      <section style={{
        borderTop: '2px solid var(--ink)', borderBottom: '2px solid var(--ink)',
        padding: '22px 36px', display: 'flex', alignItems: 'center', gap: 28,
        background: 'var(--paper-2)'
      }}>
        <span className="hand" style={{ fontSize: 20, color: '#1a1a1a' }}>
          Used by students at →
        </span>
        <div style={{ display: 'flex', gap: 22, flex: 1 }}>
          {['Lund Univ.', 'KTH', 'Uppsala', 'Chalmers', 'Stockholm Univ.', 'Gothenburg'].map((u, i) =>
          <span key={i} className="marker" style={{ fontSize: 16, color: '#555' }}>{u}</span>
          )}
        </div>
      </section>

      {/* Live results preview - reinforces search-led pitch */}
      <section style={{ padding: '60px 36px', position: 'relative' }}>
        <span className="section-tag">/ live preview</span>
        <h2 className="section-h" style={{ fontSize: 36, marginBottom: 6 }}>
          Try it — here are real matches
        </h2>
        <p style={{ color: '#555', marginBottom: 28 }}>Sample results for "Master's, engineering, Sweden"</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[
          { fit: 94, title: 'Wallenberg Engineering Grant', amount: '50,000 kr', days: 12, prog: 75, eff: 'Easy', desc: '2 essays, transcript. Open to all engineering masters.' },
          { fit: 87, title: 'Lund Future Scholars', amount: '25,000 kr', days: 28, prog: 45, eff: 'Medium', desc: 'For students researching sustainability.' },
          { fit: 71, title: 'Erasmus+ Mobility Grant', amount: '€3,200', days: 64, prog: 18, eff: 'Easy', desc: 'Exchange semester anywhere in EU.' }].
          map((s, i) => <ScholarshipCard key={i} {...s} />)}
        </div>

        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <span className="sk-btn ghost" style={{ borderColor: 'var(--ink-2)' }}>
            See all 2,400+ scholarships →
          </span>
        </div>
      </section>

      {/* How it works - inline horizontal */}
      <section style={{ padding: '50px 36px', background: 'var(--paper-2)', borderTop: '2px solid var(--ink)', borderBottom: '2px solid var(--ink)' }}>
        <h2 className="section-h" style={{ fontSize: 32, textAlign: 'center', marginBottom: 36 }}>
          Three steps. That's it.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, alignItems: 'start' }}>
          {[
          { n: 1, t: 'Search', d: 'Type what you study. We do the rest.' },
          { n: 2, t: 'Filter', d: 'Eligibility, amount, deadline, effort.' },
          { n: 3, t: 'Apply', d: 'Save & track applications in one place.' }].
          map((s) =>
          <div key={s.n} style={{ textAlign: 'center', position: 'relative' }}>
              <div style={{
              width: 72, height: 72, margin: '0 auto 16px',
              border: '2.5px solid var(--ink)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Architects Daughter', fontSize: 32, fontWeight: 700,
              background: 'var(--paper)', boxShadow: '3px 3px 0 var(--ink)'
            }}>{s.n}</div>
              <h3 className="marker" style={{ fontSize: 24, margin: '0 0 6px' }}>{s.t}</h3>
              <p style={{ color: '#555', fontSize: 14, maxWidth: 240, margin: '0 auto' }}>{s.d}</p>
            </div>
          )}
        </div>
      </section>

      {/* Benefits as 3 columns with placeholder icons */}
      <section style={{ padding: '60px 36px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {[
          { t: 'Save hours of digging', d: 'Stop bouncing between 30 university pages.' },
          { t: 'Find money you didn\'t know existed', d: '2,400+ scholarships indexed weekly.' },
          { t: 'Personalized to you', d: 'Profile-based matching — only what fits.' }].
          map((b, i) =>
          <div key={i} className="sk-box" style={{ padding: 22 }}>
              <div className="sk-img" style={{ height: 80, marginBottom: 14 }}>icon placeholder</div>
              <h3 className="marker" style={{ fontSize: 20, margin: '0 0 8px' }}>{b.t}</h3>
              <p style={{ color: '#555', fontSize: 14, margin: 0 }}>{b.d}</p>
            </div>
          )}
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: '70px 36px 90px', textAlign: 'center', background: 'var(--paper-2)', borderTop: '2px solid var(--ink)' }}>
        <h2 className="headline" style={{ fontSize: 52, marginBottom: 14 }}>
          Start finding scholarships today.
        </h2>
        <p style={{ color: '#555', marginBottom: 28 }}>Free to use. No credit card. Made for students.</p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
          <span className="sk-btn go">Start searching →</span>
          <span className="sk-btn ghost" style={{ borderColor: 'var(--ink)' }}>Browse scholarships</span>
        </div>
      </section>
    </div>);

}

// ---------- Scholarship card ----------

function ScholarshipCard({ fit, title, amount, days, prog, eff, desc, compact }) {
  const urgent = days < 14;
  return (
    <div className="sk-box" style={{
      padding: 20, position: 'relative',
      boxShadow: '3px 3px 0 var(--ink)',
      background: '#fff'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        {fit ?
        <div className="sk-pill" style={{
          background: 'var(--blue)', color: '#fff',
          borderColor: 'var(--ink)', fontWeight: 600
        }}>
            {fit}% match
          </div> :

        <div className="sk-pill" style={{ borderColor: 'var(--ink-2)', fontSize: 11 }}>
            Engineering · Masters
          </div>
        }
        <div className="hand" style={{ fontSize: 22, fontWeight: 700 }}>{amount}</div>
      </div>
      <h3 className="marker" style={{ fontSize: compact ? 18 : 20, margin: '0 0 6px', lineHeight: 1.2 }}>
        {title}
      </h3>
      {!compact && <p style={{ fontSize: 13, color: '#555', margin: '0 0 14px', lineHeight: 1.4 }}>{desc}</p>}

      {/* Deadline progress */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555', marginBottom: 4 }}>
          <span>Deadline</span>
          <span style={{ color: urgent ? '#b45309' : '#555', fontWeight: 600 }}>
            {days} days left
          </span>
        </div>
        <div className={`sk-bar ${urgent ? 'warn' : ''}`}>
          <span style={{ width: `${prog}%` }}></span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <span className="sk-pill" style={{ fontSize: 11 }}>⏱ {eff} apply</span>
      </div>

      <span className="sk-btn go" style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', fontSize: 14, boxShadow: '2px 2px 0 var(--ink)' }}>
        Apply →
      </span>
    </div>);

}

// ---------- V2: ILLUSTRATION / MATCH-LED (warm, profile-first) ----------

function V2_MatchLed() {
  return (
    <div className="wf" style={{ width: 1280, minHeight: 1900 }}>
      <Nav />

      {/* Hero: split, illustration on right, profile-builder pitch */}
      <section style={{ padding: '70px 36px 50px', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 60, alignItems: 'center', position: 'relative' }}>
        <div>
          <div className="hand" style={{ fontSize: 24, color: 'var(--blue)', marginBottom: 14 }}>
            hi there ✦
          </div>
          <h1 className="headline" style={{ fontSize: 68, marginBottom: 22 }}>
            Scholarships that<br />
            <span style={{
              background: 'var(--yellow)',
              padding: '0 10px',
              boxDecorationBreak: 'clone',
              WebkitBoxDecorationBreak: 'clone'
            }}>actually fit you.</span>
          </h1>
          <p style={{ fontSize: 19, color: '#555', maxWidth: 480, marginBottom: 28, lineHeight: 1.5 }}>
            We collect every scholarship for university students in one place —
            so you stop scrolling and start applying.
          </p>
          {/* Inline hero search */}
          <div className="sk-box sk-box-2" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', background: '#fff',
            boxShadow: '4px 4px 0 var(--ink)', maxWidth: 480, marginBottom: 16
          }}>
            <span style={{ color: '#999', fontSize: 16 }}>🔍</span>
            <span style={{ flex: 1, color: '#999', fontSize: 15 }}>
              Try "engineering, masters, Lund"
            </span>
            <span className="sk-btn primary" style={{ padding: '8px 16px', fontSize: 14, boxShadow: 'none' }}>
              Search
            </span>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 22, alignItems: 'center' }}>
            <span className="sk-btn ghost" style={{ borderColor: 'var(--ink)' }}>Browse all 2,400+ →</span>
            <span className="hand" style={{ fontSize: 16, color: '#555' }}>or, sign up to get matches</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#555' }}>
            <div style={{ display: 'flex', marginRight: 4 }}>
              {[0, 1, 2, 3].map((i) =>
              <div key={i} style={{
                width: 28, height: 28, borderRadius: '50%',
                border: '2px solid var(--ink)',
                background: ['#FACC15', '#3B82F6', '#22C55E', '#fafaf7'][i],
                marginLeft: i ? -8 : 0
              }}></div>
              )}
            </div>
            <span>Joined this week by 312 students</span>
          </div>
        </div>

        {/* Right: search-results preview mock (hints at matching post-signup) */}
        <div style={{ position: 'relative' }}>
          <div className="sk-box" style={{
            padding: 20, background: '#fff',
            boxShadow: '6px 6px 0 var(--ink)',
            transform: 'rotate(1deg)'
          }}>
            <div className="hand" style={{ fontSize: 18, color: '#555', marginBottom: 12 }}>
              ↳ search results preview
            </div>
            {[
            { t: 'Wallenberg Engineering Grant', a: '50,000 kr', d: 12, p: 75 },
            { t: 'Lund Sustainability Fund', a: '40,000 kr', d: 9, p: 82 },
            { t: 'KTH Robotics Grant', a: '60,000 kr', d: 33, p: 38 }].
            map((s, i) =>
            <div key={i} className="sk-box" style={{
              padding: '12px 14px', marginBottom: 10, background: 'var(--paper)',
              display: 'flex', alignItems: 'center', gap: 12
            }}>
                <div style={{ flex: 1 }}>
                  <div className="marker" style={{ fontSize: 15, marginBottom: 4 }}>{s.t}</div>
                  <div className="sk-bar" style={{ marginBottom: 0 }}>
                    <span style={{ width: `${s.p}%`, background: s.d < 14 ? 'var(--yellow)' : 'var(--green)' }}></span>
                  </div>
                </div>
                <div className="hand" style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap' }}>{s.a}</div>
              </div>
            )}
            <div style={{
              marginTop: 12, padding: '10px 12px',
              border: '2px dashed var(--blue)', borderRadius: 6,
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(59,130,246,0.06)'
            }}>
              <span style={{ fontSize: 18 }}>🔒</span>
              <div style={{ flex: 1, fontSize: 13, color: '#1a1a1a' }}>
                <strong>Sign up</strong> to see your match score on every result.
              </div>
            </div>
          </div>
          <span className="annot tr" style={{ top: -28, right: 30, width: 180 }}>
            matching unlocks<br />after sign-up
          </span>
        </div>
      </section>

      {/* Social proof - centered logos */}
      <section style={{ padding: '32px 36px', borderTop: '2px solid var(--ink)', borderBottom: '2px solid var(--ink)', textAlign: 'center' }}>
        <div className="hand" style={{ fontSize: 18, color: '#555', marginBottom: 14 }}>
          trusted by students at
        </div>
        <div style={{ display: 'flex', gap: 36, justifyContent: 'center', flexWrap: 'wrap' }}>
          {['Lund University', 'KTH', 'Uppsala', 'Chalmers', 'Stockholm', 'Göteborg'].map((u, i) =>
          <span key={i} className="marker" style={{ fontSize: 18, color: '#1a1a1a' }}>{u}</span>
          )}
        </div>
      </section>

      {/* Featured scholarships preview (pre-signup) */}
      <section style={{ padding: '70px 36px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <span className="section-tag">/ a peek at what's inside</span>
            <h2 className="section-h" style={{ fontSize: 38 }}>
              Featured scholarships this week.
            </h2>
            <p style={{ color: '#555', margin: 0 }}>Sign up to see which ones fit you.</p>
          </div>
          <span className="hand" style={{ fontSize: 20 }}>browse all 2,400+ →</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[
          { title: 'Sustainable Engineering Fund', amount: '40,000 kr', days: 9, prog: 82, eff: 'Easy', desc: 'For master\'s students researching sustainability.' },
          { title: 'Wallenberg Robotics Grant', amount: '60,000 kr', days: 33, prog: 38, eff: 'Medium', desc: 'Supports robotics research projects.' },
          { title: 'Lund Women in STEM', amount: '15,000 kr', days: 21, prog: 60, eff: 'Easy', desc: 'Open application, short essay required.' }].
          map((s, i) => <ScholarshipCard key={i} {...s} />)}
        </div>
      </section>

      {/* How it works - compact horizontal strip */}
      <section style={{ padding: '60px 36px', background: 'var(--paper-2)', borderTop: '2px solid var(--ink)', borderBottom: '2px solid var(--ink)' }}>
        <h2 className="section-h" style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>
          From confused to confident in 3 steps.
        </h2>
        <p style={{ textAlign: 'center', color: '#555', marginBottom: 44 }}>No friction. No hidden steps.</p>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr',
          gap: 16, alignItems: 'center', maxWidth: 1080, margin: '0 auto'
        }}>
          {[
          { n: 1, t: 'Search or build a profile', d: 'Tell us your field, level, and a few interests.' },
          { n: 2, t: 'Filter by what matters', d: 'Match score, amount, deadline, or effort.' },
          { n: 3, t: 'Apply & track', d: 'Save drafts, set reminders, see status.' }].
          map((s, i) =>
          <React.Fragment key={s.n}>
              <div className="sk-box" style={{ padding: 24, textAlign: 'center', background: '#fff' }}>
                <div style={{
                width: 48, height: 48, margin: '0 auto 12px',
                border: '2.5px solid var(--ink)', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Architects Daughter', fontSize: 22, fontWeight: 700,
                background: 'var(--paper)'
              }}>{s.n}</div>
                <h3 className="marker" style={{ fontSize: 20, margin: '0 0 6px' }}>{s.t}</h3>
                <p style={{ color: '#555', fontSize: 13, margin: 0 }}>{s.d}</p>
              </div>
              {i < 2 &&
            <span className="hand" style={{ fontSize: 28, color: 'var(--ink-2)' }}>→</span>
            }
            </React.Fragment>
          )}
        </div>
      </section>

      {/* Benefits with student quote */}
      <section style={{ padding: '70px 36px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
        <div>
          <span className="section-tag">/ why students like it</span>
          <h2 className="section-h" style={{ fontSize: 34, marginBottom: 24 }}>
            Less time hunting,<br />more time applying.
          </h2>
          {[
          { t: 'Save 6+ hours a month', d: 'No more bouncing between university pages.' },
          { t: 'Discover what you didn\'t know', d: 'Niche & private grants surface automatically.' },
          { t: 'Personalized matches', d: 'The more you tell us, the better it gets.' }].
          map((b, i) =>
          <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
              <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '2px solid var(--ink)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--green)', color: '#fff', fontSize: 16, fontWeight: 700
            }}>✓</div>
              <div>
                <h3 className="marker" style={{ fontSize: 20, margin: '0 0 4px' }}>{b.t}</h3>
                <p style={{ color: '#555', fontSize: 14, margin: 0 }}>{b.d}</p>
              </div>
            </div>
          )}
        </div>
        <div className="sk-box" style={{
          padding: 30, background: '#fff',
          boxShadow: '6px 6px 0 var(--ink)',
          position: 'relative'
        }}>
          <div className="hand" style={{ fontSize: 80, color: 'var(--ink-3)', lineHeight: 0.8, marginBottom: 8 }}>"</div>
          <p className="marker" style={{ fontSize: 22, lineHeight: 1.4, margin: '0 0 18px' }}>
            I found 4 scholarships I qualified for in my first session.
            Got 2 of them. Paid my whole semester.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              border: '2px solid var(--ink)', background: 'var(--yellow)'
            }}></div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Sara L.</div>
              <div style={{ fontSize: 13, color: '#555' }}>MSc Engineering, Lund</div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: '80px 36px 100px', textAlign: 'center', background: 'var(--blue)', color: '#fff', borderTop: '2px solid var(--ink)' }}>
        <div className="hand" style={{ fontSize: 24, marginBottom: 14, opacity: 0.9 }}>2 minutes. that's all.</div>
        <h2 className="headline" style={{ fontSize: 56, marginBottom: 18, color: '#fff' }}>
          Start finding<br />your scholarships.
        </h2>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 28 }}>
          <span className="sk-btn go">Start searching →</span>
          <span className="sk-btn ghost" style={{ borderColor: '#fff', color: '#fff', background: 'transparent' }}>
            Browse instead
          </span>
        </div>
      </section>
    </div>);

}

// ---------- V3: RESULTS-LED (browse-first, dense) ----------

function V3_ResultsLed() {
  return (
    <div className="wf" style={{ width: 1280, minHeight: 1900 }}>
      <Nav />

      {/* Hero: small headline, big results grid */}
      <section style={{ padding: '50px 36px 24px', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center', marginBottom: 36 }}>
          <div>
            <div className="hand" style={{ fontSize: 22, color: '#555', marginBottom: 12 }}>
              ✦ 2,431 scholarships, indexed weekly
            </div>
            <h1 className="headline" style={{ fontSize: 60, marginBottom: 16, lineHeight: 1.05 }}>
              Find scholarships<br />in seconds.
            </h1>
            <p style={{ fontSize: 17, color: '#555', maxWidth: 460, margin: 0 }}>
              We collect and match scholarships for students in one place — start scanning right away.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Compact search */}
            <div className="sk-box" style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', background: '#fff',
              boxShadow: '3px 3px 0 var(--ink)'
            }}>
              <span style={{ color: '#999', fontSize: 16 }}>🔍</span>
              <span style={{ flex: 1, color: '#999', fontSize: 15 }}>Search scholarships, fields, universities…</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <span className="sk-btn primary" style={{ flex: 1, justifyContent: 'center' }}>
                Start searching
              </span>
              <span className="sk-btn ghost" style={{ borderColor: 'var(--ink)', flex: 1, justifyContent: 'center' }}>
                Browse all
              </span>
            </div>
            <span className="hand" style={{ fontSize: 16, color: '#555', textAlign: 'right' }}>
              ↑ both equal weight, side by side
            </span>
          </div>
        </div>

        {/* Filter row */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingTop: 14, borderTop: '1.5px dashed var(--ink-2)' }}>
          <span className="hand" style={{ fontSize: 18, marginRight: 6 }}>Filter:</span>
          {['All fields ▾', 'Any level ▾', 'Any deadline ▾', 'Any amount ▾', 'Effort: any ▾'].map((c, i) =>
          <span key={i} className="sk-pill" style={{ padding: '6px 12px', fontSize: 13 }}>{c}</span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 13, color: '#555' }}>Sort by: <u>Best match</u></span>
        </div>
      </section>

      {/* Big browse grid - 6 cards, immediately visible */}
      <section style={{ padding: '20px 36px 50px', position: 'relative' }}>
        <span className="annot tl" style={{ top: -8, left: 70, width: 220 }}>
          results show on landing —<br />no extra clicks
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          {[
          { fit: 94, title: 'Wallenberg Engineering', amount: '50,000 kr', days: 12, prog: 75, eff: 'Easy', desc: 'Open to all engineering masters.' },
          { fit: 91, title: 'Lund Sustainability Fund', amount: '40,000 kr', days: 9, prog: 82, eff: 'Easy', desc: 'For students researching climate.' },
          { fit: 88, title: 'KTH Robotics Grant', amount: '60,000 kr', days: 33, prog: 38, eff: 'Medium', desc: 'Robotics research projects.' },
          { fit: 81, title: 'Erasmus+ Mobility', amount: '€3,200', days: 64, prog: 18, eff: 'Easy', desc: 'Exchange semester EU-wide.' },
          { fit: 77, title: 'Women in STEM Fund', amount: '15,000 kr', days: 21, prog: 60, eff: 'Easy', desc: 'Short essay, open eligibility.' },
          { fit: 72, title: 'Nordic Research Award', amount: '25,000 kr', days: 47, prog: 28, eff: 'Hard', desc: 'For published research only.' }].
          map((s, i) => <ScholarshipCard key={i} {...s} />)}
        </div>
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <span className="sk-btn ghost" style={{ borderColor: 'var(--ink)' }}>
            Load more (2,425 remaining) →
          </span>
        </div>
      </section>

      {/* Social proof */}
      <section style={{ padding: '24px 36px', background: 'var(--paper-2)', borderTop: '2px solid var(--ink)', borderBottom: '2px solid var(--ink)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, justifyContent: 'center' }}>
          <span className="hand" style={{ fontSize: 18, color: '#555' }}>
            Used by 12,000+ students at
          </span>
          {['Lund', 'KTH', 'Uppsala', 'Chalmers', 'Stockholm Univ.', 'Göteborg'].map((u, i) =>
          <span key={i} className="marker" style={{ fontSize: 16 }}>{u}</span>
          )}
        </div>
      </section>

      {/* How it works - compact horizontal strip with connector */}
      <section style={{ padding: '60px 36px' }}>
        <h2 className="section-h" style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>
          How it works
        </h2>
        <p style={{ textAlign: 'center', color: '#555', marginBottom: 44 }}>Three steps, no friction.</p>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr',
          gap: 16, alignItems: 'center', maxWidth: 1080, margin: '0 auto'
        }}>
          {[
          { n: 1, t: 'Search', d: 'Type a field, university, or keyword.' },
          { n: 2, t: 'Filter', d: 'Narrow by amount, deadline, or effort.' },
          { n: 3, t: 'Apply', d: 'Track everything from one dashboard.' }].
          map((s, i) =>
          <React.Fragment key={s.n}>
              <div className="sk-box" style={{ padding: 24, textAlign: 'center', background: '#fff' }}>
                <div style={{
                width: 48, height: 48, margin: '0 auto 12px',
                border: '2.5px solid var(--ink)', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Architects Daughter', fontSize: 22, fontWeight: 700,
                background: 'var(--paper)'
              }}>{s.n}</div>
                <h3 className="marker" style={{ fontSize: 20, margin: '0 0 6px' }}>{s.t}</h3>
                <p style={{ color: '#555', fontSize: 13, margin: 0 }}>{s.d}</p>
              </div>
              {i < 2 &&
            <span className="hand" style={{ fontSize: 28, color: 'var(--ink-2)' }}>→</span>
            }
            </React.Fragment>
          )}
        </div>
      </section>

      {/* Benefits as horizontal stat row */}
      <section style={{
        padding: '50px 36px', background: 'var(--paper-2)',
        borderTop: '2px solid var(--ink)', borderBottom: '2px solid var(--ink)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, textAlign: 'center' }}>
          {[
          { stat: '6h+', t: 'saved per month', d: 'vs. searching university pages by hand' },
          { stat: '2.4k', t: 'scholarships indexed', d: 'updated weekly across Sweden & EU' },
          { stat: '94%', t: 'find a match', d: 'students get at least 1 personalized match' }].
          map((b, i) =>
          <div key={i}>
              <div className="headline" style={{ fontSize: 64, color: 'var(--blue)', lineHeight: 1, marginBottom: 8 }}>
                {b.stat}
              </div>
              <h3 className="marker" style={{ fontSize: 20, margin: '0 0 4px' }}>{b.t}</h3>
              <p style={{ color: '#555', fontSize: 13, margin: 0 }}>{b.d}</p>
            </div>
          )}
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: '70px 36px 90px', textAlign: 'center' }}>
        <h2 className="headline" style={{ fontSize: 50, marginBottom: 16 }}>
          Start finding<br />scholarships today.
        </h2>
        <p style={{ color: '#555', marginBottom: 28 }}>Free. No sign-up needed to browse.</p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
          <span className="sk-btn go">Start searching →</span>
          <span className="sk-btn ghost" style={{ borderColor: 'var(--ink)' }}>Browse all 2,431</span>
        </div>
      </section>
    </div>);

}

// ---------- App ----------

function App() {
  const [t, setTweak] = window.useTweaks ?
  window.useTweaks(window.__TWEAK_DEFAULTS__ || { monochrome: false, density: 'normal' }) :
  [{ monochrome: false, density: 'normal' }, () => {}];
  const mono = !!t.monochrome;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: sketchStyles }} />
      <window.DesignCanvas
        title="Stipendio — Homepage Wireframes"
        subtitle="3 directions exploring hero composition. Drag to rearrange. Click any artboard to focus.">
        
        <window.DCSection id="homepages" title="Homepage — 3 directions">
          <window.DCArtboard
            id="v1"
            label="V1 · Search-led (utility-first)"
            width={1280}
            height={1840}>
            
            <div className={mono ? 'mono' : ''}>
              <V1_SearchLed />
            </div>
          </window.DCArtboard>
          <window.DCArtboard
            id="v2"
            label="V2 · Match-led (warm, profile-first)"
            width={1280}
            height={1900}>
            
            <div className={mono ? 'mono' : ''}>
              <V2_MatchLed />
            </div>
          </window.DCArtboard>
          <window.DCArtboard
            id="v3"
            label="V3 · Results-led (browse on landing)"
            width={1280}
            height={1900}>
            
            <div className={mono ? 'mono' : ''}>
              <V3_ResultsLed />
            </div>
          </window.DCArtboard>
        </window.DCSection>
      </window.DesignCanvas>

      {window.TweaksPanel &&
      <window.TweaksPanel title="Tweaks">
          <window.TweakSection title="Style">
            <window.TweakToggle
            label="Pure b&w (no accents)"
            value={!!t.monochrome}
            onChange={(v) => setTweak('monochrome', v)}
            hint="Strip blue/green/yellow — see structure only" />
          
          </window.TweakSection>
          <window.TweakSection title="Density">
            <window.TweakRadio
            label="Card density"
            value={t.density || 'normal'}
            options={[
            { label: 'Airy', value: 'airy' },
            { label: 'Normal', value: 'normal' }]
            }
            onChange={(v) => setTweak('density', v)} />
          
          </window.TweakSection>
        </window.TweaksPanel>
      }
    </>);

}

window.App = App;
window.V2_MatchLed = V2_MatchLed;
window.sketchStyles = sketchStyles;