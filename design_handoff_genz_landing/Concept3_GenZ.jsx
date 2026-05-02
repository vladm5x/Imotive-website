const Concept3 = () => {
  const purple = 'oklch(0.55 0.24 290)';
  const purpleDeep = 'oklch(0.38 0.22 290)';
  const teal = 'oklch(0.78 0.14 180)';
  const lime = 'oklch(0.92 0.18 110)';
  const cream = '#FFF9EE';
  const ink = '#0F0A1F';
  const muted = '#5A4F6E';
  const border = '#E8DFF5';

  const scholarships = [
    { title: 'STEM Excellence Award', org: 'Northbridge', deadline: 'Mar 14', amount: '25K', tag: 'STEM', vibe: '🔬' },
    { title: 'Humanities Fellowship', org: 'Mercer Trust', deadline: 'Apr 02', amount: '12.5K', tag: 'Arts', vibe: '📚' },
    { title: 'First-Gen Scholars Grant', org: 'Aldridge', deadline: 'May 20', amount: '8K', tag: 'Open', vibe: '🌱' },
    { title: 'Coastal Research Bursary', org: 'Coastal Inst.', deadline: 'Jun 11', amount: '15K', tag: 'Research', vibe: '🌊' },
  ];

  return (
    <div style={{ background: cream, color: ink, fontFamily: '"Space Grotesk", "Inter", sans-serif', width: 1280 }}>
      {/* Nav */}
      <header style={{ background: cream, borderBottom: `1.5px solid ${ink}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: ink, color: lime, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 18, transform: 'rotate(-4deg)' }}>$</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.6 }}>Granted<span style={{ color: purple }}>.</span></div>
          </div>
          <nav style={{ display: 'flex', gap: 28, fontSize: 14, color: ink, fontWeight: 500 }}>
            <span>Browse</span>
            <span>How it works</span>
            <span>Stories</span>
            <span>Help</span>
          </nav>
          <div style={{ display: 'flex', gap: 12, fontSize: 14, alignItems: 'center', fontWeight: 500 }}>
            <span>Log in</span>
            <span style={{ background: ink, color: lime, padding: '10px 18px', borderRadius: 999, fontWeight: 600 }}>Get started →</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ padding: '80px 32px 96px', position: 'relative', overflow: 'hidden' }}>
        {/* decorative shapes */}
        <div style={{ position: 'absolute', top: 80, right: 60, width: 140, height: 140, borderRadius: '50%', background: lime, transform: 'rotate(12deg)' }}></div>
        <div style={{ position: 'absolute', top: 280, right: 220, width: 70, height: 70, background: teal, transform: 'rotate(20deg)' }}></div>
        <div style={{ position: 'absolute', top: 480, right: 100, fontSize: 56, transform: 'rotate(-8deg)' }}>✦</div>
        <div style={{ position: 'absolute', top: 380, right: 360, fontSize: 32, color: purple, transform: 'rotate(15deg)', fontWeight: 700 }}>✱</div>

        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: ink, color: lime, fontSize: 13, fontWeight: 600, marginBottom: 32 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: lime, animation: 'pulse 2s infinite' }}></span>
            $184M awarded last cycle
          </div>
          <h1 style={{ fontSize: 116, lineHeight: 0.95, letterSpacing: -4, fontWeight: 700, margin: 0, maxWidth: 1000 }}>
            Find scholarships<br />
            that match{' '}
            <span style={{ position: 'relative', display: 'inline-block' }}>
              <span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: 'italic', fontWeight: 400, color: purple }}>you.</span>
              <svg width="180" height="20" style={{ position: 'absolute', bottom: -8, left: 0 }} viewBox="0 0 180 20"><path d="M 4 14 Q 50 4, 100 12 T 176 8" stroke={teal} strokeWidth="5" fill="none" strokeLinecap="round" /></svg>
            </span>
          </h1>
          <p style={{ fontSize: 20, color: muted, lineHeight: 1.5, marginTop: 32, maxWidth: 540 }}>
            14,820 verified scholarships, ranked for you. Spend less time searching, more time winning.
          </p>

          {/* Search */}
          <div style={{ marginTop: 40, maxWidth: 720 }}>
            <div style={{ display: 'flex', background: '#fff', border: `2px solid ${ink}`, borderRadius: 16, padding: 6, boxShadow: `6px 6px 0 ${ink}`, alignItems: 'center' }}>
              <div style={{ padding: '0 16px', fontSize: 22 }}>🔍</div>
              <input placeholder="What are you studying?" style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, padding: '14px 0', background: 'transparent', fontFamily: 'inherit', fontWeight: 500 }} />
              <span style={{ background: purple, color: '#fff', padding: '14px 24px', borderRadius: 12, fontSize: 15, fontWeight: 600 }}>Get started free</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: muted, padding: '6px 0', fontWeight: 500 }}>Try:</span>
              {['🎨 Design', '⚡ Engineering', '🧬 Bio', '💼 Business', '🌍 Global'].map((t, i) => (
                <span key={t} style={{ fontSize: 13, padding: '6px 14px', borderRadius: 999, background: i % 3 === 0 ? lime : i % 3 === 1 ? teal : '#fff', border: `1.5px solid ${ink}`, fontWeight: 500 }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Stat strip */}
          <div style={{ marginTop: 80, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[['180K+', 'students matched'], ['$184M', 'awarded in 2025'], ['14.8K', 'live scholarships'], ['96%', 'verified rate']].map(([n, l], i) => (
              <div key={l} style={{ background: i === 1 ? purple : i === 2 ? teal : '#fff', color: i === 1 ? '#fff' : ink, border: `1.5px solid ${ink}`, borderRadius: 16, padding: '20px 22px' }}>
                <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: -1.4, lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: 13, marginTop: 8, opacity: 0.85, fontWeight: 500 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section style={{ padding: '40px 32px', background: ink, color: cream, borderTop: `1.5px solid ${ink}`, borderBottom: `1.5px solid ${ink}`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 48, alignItems: 'center', whiteSpace: 'nowrap' }}>
          {[...Array(2)].flatMap((_, k) => ['Northbridge', '★', 'St·Aldwin', '★', 'Pacific Tech', '★', 'Mercer', '★', 'Coastal', '★', 'Hartwell', '★', 'Aldridge', '★', 'Beaumont', '★'].map((n, i) => (
            <span key={`${k}-${i}`} style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.5, color: n === '★' ? lime : cream }}>{n}</span>
          )))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '120px 32px', background: cream }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 56 }}>
            <span style={{ fontSize: 13, padding: '6px 14px', borderRadius: 999, background: lime, fontWeight: 600, border: `1.5px solid ${ink}` }}>How it works</span>
            <span style={{ fontSize: 14, color: muted }}>Three steps. Five minutes.</span>
          </div>
          <h2 style={{ fontSize: 72, letterSpacing: -2.4, fontWeight: 700, margin: '0 0 64px', maxWidth: 900, lineHeight: 1 }}>
            From <span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: 'italic', fontWeight: 400, color: purple }}>where do I start</span> to <span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: 'italic', fontWeight: 400, color: purple }}>I got it.</span>
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              ['01', 'Tell us about you', 'Field, year, eligibility, vibe. Two minutes.', teal],
              ['02', 'Get matched, ranked', "We surface what fits. You don't dig.", lime],
              ['03', 'Apply, win, repeat', 'Reuse essays. Track every deadline. Cash in.', purple],
            ].map(([n, t, d, c], i) => (
              <div key={n} style={{ background: '#fff', border: `1.5px solid ${ink}`, borderRadius: 24, padding: 28, position: 'relative' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: c, color: i === 2 ? '#fff' : ink, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 22, border: `1.5px solid ${ink}`, marginBottom: 24 }}>{n}</div>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, marginBottom: 10 }}>{t}</div>
                <div style={{ fontSize: 15, color: muted, lineHeight: 1.55 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scholarship preview */}
      <section style={{ padding: '40px 32px 120px', background: cream }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
            <div>
              <div style={{ fontSize: 13, padding: '6px 14px', borderRadius: 999, background: teal, fontWeight: 600, border: `1.5px solid ${ink}`, display: 'inline-block', marginBottom: 16 }}>Open now</div>
              <h2 style={{ fontSize: 56, letterSpacing: -1.8, fontWeight: 700, margin: 0, lineHeight: 1 }}>This week's drops</h2>
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, borderBottom: `2px solid ${ink}`, paddingBottom: 2 }}>See all 14,820 →</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
            {scholarships.map((s, i) => (
              <div key={i} style={{ background: i % 2 === 0 ? '#fff' : ink, color: i % 2 === 0 ? ink : cream, border: `1.5px solid ${ink}`, borderRadius: 24, padding: 28, position: 'relative', overflow: 'hidden' }}>
                {i === 0 && <div style={{ position: 'absolute', top: 20, right: 20, background: lime, color: ink, padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, border: `1px solid ${ink}` }}>96% MATCH</div>}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, background: i % 2 === 0 ? lime : purple, display: 'grid', placeItems: 'center', fontSize: 26, border: `1.5px solid ${i % 2 === 0 ? ink : cream}` }}>{s.vibe}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{s.tag}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.15 }}>{s.title}</div>
                    <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>{s.org}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 18, borderTop: `1px dashed ${i % 2 === 0 ? border : 'rgba(255,249,238,0.2)'}` }}>
                  <div>
                    <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 500, marginBottom: 2 }}>Closes {s.deadline}</div>
                    <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: -1.2, lineHeight: 1 }}>${s.amount}</div>
                  </div>
                  <span style={{ background: i % 2 === 0 ? ink : lime, color: i % 2 === 0 ? cream : ink, padding: '10px 18px', borderRadius: 999, fontSize: 14, fontWeight: 600 }}>Apply →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value prop */}
      <section style={{ padding: '120px 32px', background: purple, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 60, right: 80, fontSize: 72, opacity: 0.5 }}>✦</div>
        <div style={{ position: 'absolute', bottom: 80, left: 80, width: 120, height: 120, borderRadius: '50%', background: teal, opacity: 0.4 }}></div>
        <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative' }}>
          <h2 style={{ fontSize: 80, letterSpacing: -2.6, fontWeight: 700, margin: '0 0 64px', lineHeight: 0.95, maxWidth: 900 }}>
            We're <span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: 'italic', fontWeight: 400 }}>actually</span> on your side.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
            {[
              ['Free, always.', 'Every feature. Zero paywalls. We charge schools, not you.'],
              ['No sketchy listings.', 'Editors vet every award. Predatory or expired? Gone in 24h.'],
              ['Your data, your call.', 'We never sell your info. Delete your profile in one tap.'],
            ].map(([t, d]) => (
              <div key={t}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: lime, marginBottom: 24 }}></div>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, marginBottom: 10 }}>{t}</div>
                <div style={{ fontSize: 15, opacity: 0.85, lineHeight: 1.55 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Signup CTA */}
      <section style={{ padding: '140px 32px', background: cream, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 80, left: '15%', fontSize: 48, transform: 'rotate(-12deg)', color: purple }}>✱</div>
        <div style={{ position: 'absolute', bottom: 100, right: '12%', width: 80, height: 80, borderRadius: '50%', background: lime, border: `1.5px solid ${ink}` }}></div>
        <div style={{ position: 'absolute', top: 180, right: '20%', width: 50, height: 50, background: teal, transform: 'rotate(15deg)', border: `1.5px solid ${ink}` }}></div>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h2 style={{ fontSize: 100, letterSpacing: -3.6, fontWeight: 700, margin: 0, lineHeight: 0.95 }}>
            Stop scrolling.<br />
            <span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: 'italic', fontWeight: 400, color: purple }}>Start winning.</span>
          </h2>
          <p style={{ fontSize: 19, color: muted, marginTop: 28, maxWidth: 480, marginInline: 'auto', lineHeight: 1.5 }}>
            Join 180,000 students funding their dreams. Takes two minutes.
          </p>
          <div style={{ marginTop: 44, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <span style={{ background: ink, color: lime, padding: '18px 32px', borderRadius: 999, fontSize: 16, fontWeight: 600, boxShadow: `5px 5px 0 ${purple}` }}>Get started free →</span>
            <span style={{ background: '#fff', border: `1.5px solid ${ink}`, padding: '18px 32px', borderRadius: 999, fontSize: 16, fontWeight: 600 }}>See how it works</span>
          </div>
          <div style={{ fontSize: 13, color: muted, marginTop: 24 }}>No card. No spam. Pinky promise. 🤞</div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: ink, color: cream, padding: '64px 32px 36px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 40, paddingBottom: 40, borderBottom: `1px solid rgba(255,249,238,0.15)` }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, background: lime, color: ink, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 18, transform: 'rotate(-4deg)' }}>$</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>Granted<span style={{ color: lime }}>.</span></div>
              </div>
              <div style={{ fontSize: 14, opacity: 0.7, maxWidth: 280, lineHeight: 1.6 }}>The scholarship platform that actually gets you.</div>
            </div>
            {[
              ['Browse', ['All scholarships', 'By field', 'By deadline', 'New this week']],
              ['Tools', ['Match quiz', 'Essay templates', 'Deadline tracker', 'Calendar sync']],
              ['Community', ['Stories', 'Discord', 'TikTok', 'Newsletter']],
              ['Company', ['About', 'Careers', 'Privacy', 'Terms']],
            ].map(([h, items]) => (
              <div key={h}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: lime }}>{h}</div>
                {items.map(i => <div key={i} style={{ fontSize: 13, opacity: 0.8, marginBottom: 10 }}>{i}</div>)}
              </div>
            ))}
          </div>
          <div style={{ paddingTop: 24, display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.6 }}>
            <span>© 2026 Granted. Built by students who got it.</span>
            <span>Made with ☕ and stubbornness</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

window.Concept3 = Concept3;
