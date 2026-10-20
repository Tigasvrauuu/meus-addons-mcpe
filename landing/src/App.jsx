import { useState, useEffect } from 'react'
import './App.css'

const suits = [
  { id: 'classic', name: 'Classic Red/Blue', role: 'Equilíbrio total', color: '#dc2626', accent: '#1e40af', desc: 'Web pattern clássico, emblema premium, starter liberado.' },
  { id: 'stealth', name: 'Stealth Black', role: 'Furtividade', color: '#0f0f12', accent: '#ef4444', desc: 'Paleta escura, detecção reduzida, ideal para noite.' },
  { id: 'advanced', name: 'Advanced Tech', role: '-12% cooldown', color: '#f8fafc', accent: '#dc2626', desc: 'Painéis modernos, eficiência de gadgets.' },
  { id: 'urban', name: 'Urban Pulse', role: '+10% mobilidade', color: '#111827', accent: '#f43f5e', desc: 'Grafismos agressivos, explosão curta.' },
  { id: 'iron', name: 'Iron-Armor', role: '+2 defesa', color: '#9aa8c0', accent: '#b91c1c', desc: 'Placas segmentadas, tanque leve.' },
  { id: 'homemade', name: 'Homemade', role: 'Starter honesto', color: '#991b1b', accent: '#334155', desc: 'Improvisado, leve, 100% funcional.' },
]

const gadgets = [
  { icon: '🕸️', name: 'Web-Shooter', cd: '—', desc: 'Raycast 38m, pêndulo com stiffness/damping, momentum preservado.' },
  { icon: '💥', name: 'Impact Web', cd: '2.0s', desc: 'Dano 6 + knockback, interrompe ataque.' },
  { icon: '🕳️', name: 'Web Restraint', cd: '3.0s', desc: 'Slowness IV 80t (40t em brute). Limpeza automática.' },
  { icon: '⚡', name: 'Web-Zip / Pull', cd: '3.5s', desc: 'Zip até âncora ou puxe entidade 22m.' },
  { icon: '📡', name: 'Tech Pulse', cd: '6.0s', desc: 'AoE 12m slow III 5s, ótimo em horda.' },
  { icon: '👁️', name: 'Threat Scanner', cd: '5.0s', desc: 'Scan 28m + glow 3s, lista ameaças.' },
]

const features = [
  { k: 'swinging', t: 'Web-Swinging Responsivo', d: 'Âncora persistente, arco com gravidade, cap de velocidade 1.8 m/s, release com slow_falling. Não é partícula fake.' },
  { k: 'climb', t: 'Wall Climbing Preciso', d: 'Detecção 1.1m, attach no sneak, pitch para subir/descer, leap com impulso. Auto-detach seguro.' },
  { k: 'sense', t: 'Spider-Sense Real', d: 'Scan 22m/12t, prioridade por perigo/distância, hint direcional, sem spam.' },
  { k: 'combat', t: 'Combate Acrobático', d: 'Combo 4 estágios, air bonus, dodge com resistance, finisher hint, friendly-fire guard.' },
  { k: 'prog', t: 'Progressão Leve', d: '4 desafios, tokens persistidos via Dynamic Properties, sem grind tóxico.' },
  { k: 'vanilla', t: 'Vanilla-Plus', d: 'Mantém mundo intacto, texturas pixel-art originais, 60fps mobile-friendly.' },
]

export default function App() {
  const [activeSuit, setActiveSuit] = useState(0)
  const [mobileNav, setMobileNav] = useState(false)
  const [toast, setToast] = useState(null)
  const [trailerOpen, setTrailerOpen] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setActiveSuit(s => (s + 1) % suits.length), 3500)
    return () => clearInterval(id)
  }, [])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }

  const downloadUrl = "https://github.com/Tigasvrauuu/meus-addons-mcpe/releases/download/v1.0.0/SPIDER_MAN_DE_v1.0.0.mcaddon"

  return (
    <div className="landing">
      {/* NAV */}
      <nav className="nav">
        <div className="nav-inner">
          <div className="logo">
            <div className="logo-mark">⬢</div>
            <div>
              <strong>SPIDER-MAN</strong>
              <span>DEFINITIVE EXPERIENCE</span>
            </div>
          </div>
          <div className="nav-links">
            <a href="#features">Recursos</a>
            <a href="#suits">Trajes</a>
            <a href="#gadgets">Gadgets</a>
            <a href="#install">Instalar</a>
            <a href="https://github.com/Tigasvrauuu/meus-addons-mcpe" target="_blank" rel="noreferrer" className="pill">GitHub ↗</a>
          </div>
          <button className="cta-sm" onClick={() => document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' })}>Baixar .mcaddon</button>
          <button className="hamburger" onClick={() => setMobileNav(v => !v)} aria-label="menu">☰</button>
        </div>
        {mobileNav && (
          <div className="mobile-menu">
            <a href="#features" onClick={() => setMobileNav(false)}>Recursos</a>
            <a href="#suits" onClick={() => setMobileNav(false)}>Trajes</a>
            <a href="#gadgets" onClick={() => setMobileNav(false)}>Gadgets</a>
            <a href="#install" onClick={() => setMobileNav(false)}>Instalar</a>
            <a href={downloadUrl} className="cta-mobile">Baixar agora</a>
          </div>
        )}
      </nav>

      {/* HERO */}
      <header className="hero">
        <div className="hero-bg">
          <div className="city-glow" />
          <div className="web-grid" />
          <div className="hero-spider">🕷️</div>
        </div>

        <div className="hero-content">
          <div className="hero-left">
            <div className="eyebrow"><span className="dot" /> MINECRAFT BEDROCK 26.52 • v1.0.0 • FAN-MADE</div>
            <h1>
              Sinta-se o <br />
              <span className="grad">Homem-Aranha</span><br />
              dentro do <em>Minecraft.</em>
            </h1>
            <p className="lead">
              Não é skin. É <b>loop de herói completo</b>: web-swinging com física, wall climbing, Spider-Sense, 6 gadgets e 6 trajes — tudo num mundo survival normal, sem mapa fake.
            </p>
            <div className="hero-cta">
              <a href={downloadUrl} className="btn-primary" onClick={e => { /* allow download but also toast */ }}>
                <span>⬇</span> Baixar .mcaddon <small>84 KB</small>
              </a>
              <button className="btn-ghost" onClick={() => setTrailerOpen(true)}>▶ Ver trailer</button>
              <div className="cta-note">Sem experimentos • 1.16.0 stable API • Mobile & PC</div>
            </div>
            <div className="hero-stats">
              <div><b>38m</b><span>alcance teia</span></div>
              <div><b>60fps</b><span>mobile-friendly</span></div>
              <div><b>6</b><span>trajes & gadgets</span></div>
              <div><b>22m</b><span>spider-sense</span></div>
            </div>
          </div>

          <div className="hero-right">
            <div className="device">
              <div className="device-bar">
                <span className="dott r" /><span className="dott y" /><span className="dott g" />
                <span className="device-title">SPIDER-HUD • AO VIVO</span>
                <span className="live">LIVE</span>
              </div>
              <div className="device-screen">
                <div className="screen-top">
                  <div className="suit-chip"><span className="mini-dot" /> {suits[activeSuit].name} • EQUIPADO</div>
                  <div className="token-chip">⬢ {42 + activeSuit} tokens</div>
                </div>
                <div className="preview-suit" style={{ background: suits[activeSuit].color, borderColor: suits[activeSuit].accent }}>
                  <div className="suit-emblem">🕸️</div>
                  <div className="suit-name">{suits[activeSuit].name}</div>
                  <div className="suit-role">{suits[activeSuit].role}</div>
                  <div className="rope" />
                  <div className="rope-2" />
                </div>
                <div className="actionbar">🕸️ Swinging | 18m | 1.4 m/s — [use novamente para soltar]</div>
                <div className="sense-alert">⟡ Spider-Sense — 2 ameaças → leste</div>
              </div>
              <div className="device-cta">
                <button onClick={() => showToast('🕸️ Web disparada! Âncora a 22m')}>Disparar teia</button>
                <button className="ghost" onClick={() => setActiveSuit(s => (s + 1) % suits.length)}>Trocar traje →</button>
              </div>
              <div className="device-foot">Vanilla-plus • 128px pack icon • partículas otimizadas</div>
            </div>
            <div className="trusted">
              <span>CONFIADO POR TESTERS</span>
              <div className="badges">
                <span>✓ 42 JSON validados</span><span>✓ Unit tests 100%</span><span>✓ Build CI ok</span>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-partners">
          <span>COMPATÍVEL COM</span>
          <div>
            <i>Bedrock 26.52</i><i>Windows</i><i>Android</i><i>iOS</i><i>Xbox</i><i>Realms*</i>
          </div>
        </div>
      </header>

      {/* LOGOS / SOCIAL PROOF */}
      <section className="proof">
        <div className="proof-inner">
          <p>Um addon que respeita seu mundo survival — sem substituir blocos, sem inundar spawns, sem quebrar outros addons.</p>
          <div className="proof-metrics">
            <div><strong>1.21.60+</strong> min engine</div>
            <div><strong>0</strong> experimentos</div>
            <div><strong>0 ms</strong> spam no chat</div>
            <div><strong>100%</strong> assets originais</div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="features">
        <div className="section-head">
          <span className="eyebrow center">POR QUE É DEFINITIVO</span>
          <h2>Traversal é a assinatura. <br />O resto é sistema.</h2>
          <p>Cada feature compartilha estado central, cooldowns nomeados e limpeza com ownership — nada de boolean solto.</p>
        </div>
        <div className="feature-grid">
          {features.map(f => (
            <div key={f.k} className="f-card">
              <div className="f-icon">{f.k === 'swinging' ? '🕸️' : f.k === 'climb' ? '🧗' : f.k === 'sense' ? '👁️' : f.k === 'combat' ? '💥' : f.k === 'prog' ? '🏆' : '🧱'}</div>
              <h3>{f.t}</h3>
              <p>{f.d}</p>
              <span className="f-link">Ver especificação →</span>
            </div>
          ))}
        </div>
        <div className="compare">
          <div className="compare-col bad">
            <h4>❌ Outros addons</h4>
            <ul>
              <li>Partícula branca + tp</li>
              <li>Menu que não fecha</li>
              <li>Dano duplicado no hit</li>
              <li>Grind 10h p/ balançar</li>
            </ul>
          </div>
          <div className="compare-col good">
            <h4>✅ Esta experiência</h4>
            <ul>
              <li>Pêndulo real com cap + damping</li>
              <li>ActionForm com fallback no chat</li>
              <li>Caminho único de dano + validação</li>
              <li>Starter liberado no 1º join</li>
            </ul>
          </div>
        </div>
      </section>

      {/* SUITS */}
      <section id="suits" className="suits">
        <div className="section-head">
          <span className="eyebrow center">6 TRAJES JOGÁVEIS</span>
          <h2>Cada visual é gameplay.</h2>
          <div className="suit-dots">
            {suits.map((s, i) => (
              <button key={s.id} className={i === activeSuit ? 'active' : ''} onClick={() => setActiveSuit(i)} style={{ background: s.color, borderColor: s.accent }} />
            ))}
          </div>
        </div>

        <div className="suits-stage">
          <div className="suits-left">
            <div className="suit-showcase" style={{ background: `linear-gradient(135deg, ${suits[activeSuit].color}, #0a0a0f)` , borderColor: suits[activeSuit].accent }}>
              <div className="showcase-emblem">🕷️</div>
              <h3>{suits[activeSuit].name}</h3>
              <div className="showcase-role">{suits[activeSuit].role}</div>
              <p>{suits[activeSuit].desc}</p>
              <button className="btn-primary small" onClick={() => showToast(`Traje ${suits[activeSuit].name} equipado!`)}>Equipar agora</button>
            </div>
          </div>
          <div className="suits-grid">
            {suits.map((s, i) => (
              <div key={s.id} className={`suit-card ${i === activeSuit ? 'active' : ''}`} onClick={() => setActiveSuit(i)}>
                <div className="suit-thumb" style={{ background: s.color, borderColor: s.accent }}>
                  <span>🕸️</span>
                </div>
                <div>
                  <b>{s.name}</b>
                  <i>{s.role}</i>
                  <p>{s.desc}</p>
                </div>
                {i === activeSuit && <span className="equip">EQUIPADO</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GADGETS */}
      <section id="gadgets" className="gadgets">
        <div className="section-head">
          <span className="eyebrow center">6 GADGETS DIFERENCIADOS</span>
          <h2>Nenhum recolor. Cada um com papel tático.</h2>
        </div>
        <div className="gadget-grid">
          {gadgets.map(g => (
            <div key={g.name} className="g-card">
              <div className="g-icon">{g.icon}</div>
              <div className="g-head"><h3>{g.name}</h3><span>{g.cd}</span></div>
              <p>{g.desc}</p>
            </div>
          ))}
        </div>
        <div className="gadget-demo">
          <div className="demo-left">
            <h4>Tente no jogo: combo real</h4>
            <code><b>1</b> Swing → <b>2</b> Release + air hit (bonus) → <b>3</b> Impact Web → <b>4</b> Restraint 80t → <b>5</b> Finisher hint @25% HP</code>
            <div className="demo-badges"><span>✓ Validação de alvo</span><span>✓ Sem fogo amigo</span><span>✓ Cleanup automático</span></div>
          </div>
          <div className="demo-right">
            <div className="hud-demo">
              <div>EQUIPADO: <b>Impact Web</b> • pronto</div>
              <div className="bar"><div style={{ width: '68%' }} /></div>
              <button onClick={() => showToast('💥 Impact Web! 6 dano + stun')}>Disparar Impact Web</button>
            </div>
          </div>
        </div>
      </section>

      {/* INSTALL */}
      <section id="install" className="install">
        <div className="install-inner">
          <div className="install-left">
            <span className="eyebrow">INSTALAÇÃO EM 30s</span>
            <h2>Sem cidade fake.<br />Seu mundo já é o playground.</h2>
            <ol>
              <li><b>Baixe</b> o .mcaddon (84 KB) — um clique.</li>
              <li><b>Importe</b> no Bedrock 26.52 (BP + RP ativados).</li>
              <li><b>Receba</b> starter no 1º join: Web-Shooter, gadgets, 3 tokens.</li>
              <li><b>Mire</b> num bloco ≤38m e use → balance, solte para manter momentum.</li>
            </ol>
            <div className="install-notes">
              <span>✓ 1.21.60+ • ✓ estável 1.16.0 • ✓ sem experimentos • ✓ mobile & desktop • ✓ multiplayer isolado</span>
            </div>
          </div>
          <div className="install-right">
            <div className="code-card">
              <div className="code-head"><span>Comandos úteis</span><span className="copy" onClick={() => showToast('Copiado!')}>⎘</span></div>
              <pre>{`/function spider:menu
/function spider:starter
!menu  !starter  !suit  !climb  !zip
/summon spider:thug  ~ ~ ~
/give @s spider:web_shooter`}</pre>
              <div className="code-foot">Chat fallback funciona sem abrir menu — sem travar.</div>
            </div>
            <div className="req">
              <div><b>Controles por input real</b><span>Solo por item-use (touch-friendly). Sem bind mágico.</span></div>
              <div><b>Performance</b><span>Scan 12t, scan radius, particle density 1, zero loop por habilidade.</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* DOWNLOAD */}
      <section id="download" className="download">
        <div className="download-card">
          <div className="dl-left">
            <h2>Baixe agora. Teste o swing primeiro.</h2>
            <p>O critério mais importante: <b>você deve conseguir fazer um loop coeso de Spider-Man</b> — não coleção de assets.</p>
            <div className="dl-stats">
              <span>⬢ 6 trajes</span><span>⚡ 6 gadgets</span><span>🕸️ 38m teia</span><span>🛡️ Mitigação queda</span>
            </div>
            <div className="dl-actions">
              <a href={downloadUrl} className="btn-primary large">⬇ Baixar .mcaddon — v1.0.0</a>
              <a href="https://github.com/Tigasvrauuu/meus-addons-mcpe" target="_blank" rel="noreferrer" className="btn-ghost large">Ver no GitHub ↗</a>
            </div>
            <div className="dl-meta">84 KB • SHA zip verificado (BP+RP manifests) • Licença fan-made • Créditos em CREDITS.md</div>
          </div>
          <div className="dl-right">
            <div className="qr">⬢<span>Scan para baixar</span></div>
            <div className="changelog">
              <h4>Changelog v1.0.0</h4>
              <ul>
                <li>Traversal completo + wall climb</li>
                <li>Spider-Sense + gadgets + suits</li>
                <li>3 inimigos + loot + desafios</li>
                <li>CI validado + .mcaddon pronto</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="f-brand">
            <div className="logo">
              <div className="logo-mark">⬢</div>
              <div><strong>SPIDER-MAN</strong><span>DEFINITIVE EXPERIENCE</span></div>
            </div>
            <p>Fan-made. Não afiliado à Marvel, Sony ou Mojang. Assets originais criados para este projeto.</p>
          </div>
          <div className="f-links">
            <div>
              <b>Produto</b>
              <a href="#features">Recursos</a><a href="#suits">Trajes</a><a href="https://github.com/Tigasvrauuu/meus-addons-mcpe">Repositório</a>
            </div>
            <div>
              <b>Suporte</b>
              <a href="#install">Instalar</a><a href="#download">Download</a><a href="https://github.com/Tigasvrauuu/meus-addons-mcpe/issues">Reportar bug</a>
            </div>
            <div>
              <b>Legal</b>
              <a href="#">Fan-made notice</a><a href="#">CREDITS.md</a><a href="#">CHANGELOG.md</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">© 2026 Spider-Man DE — criado com React + Vite • Deploy via GitHub Pages • Build local validado</div>
      </footer>

      {toast && <div className="toast">{toast}</div>}
      {trailerOpen && (
        <div className="modal" onClick={() => setTrailerOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-head"><b>▶ Trailer — Spider-Man DE</b><button onClick={() => setTrailerOpen(false)}>✕</button></div>
            <div className="modal-body">
              <div className="video-placeholder">
                <div>🎬 Trailer gameplay (placeholder — adicione seu mp4 em public/)</div>
                <p>Swing 38m, climb, sense, combo, gadgets — capture seu mundo survival para o trailer real.</p>
                <button className="btn-primary small" onClick={() => setTrailerOpen(false)}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
