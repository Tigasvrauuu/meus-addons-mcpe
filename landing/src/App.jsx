import { useState } from "react";
import { FEATURES, STEPS, FAQ, RELEASES_URL, REPO_URL } from "./data.js";

function Header() {
  return (
    <header className="nav">
      <a className="brand" href="#top">
        <span className="brand-dot" /> Spider-Man <strong>Definitive</strong>
      </a>
      <nav className="nav-links">
        <a href="#recursos">Recursos</a>
        <a href="#instalacao">Instalação</a>
        <a href="#faq">FAQ</a>
        <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <span className="badge">Minecraft Bedrock 26.52 · Add-on</span>
        <h1>
          Balance pela cidade. <span className="accent">Vire o Homem-Aranha</span> no seu mundo.
        </h1>
        <p className="lead">
          Lança-teia com física de balanço, escalada em paredes, gadgets de combate e Spider-Sense.
          Tudo integrado num único add-on, pronto para importar.
        </p>
        <div className="cta-row">
          <a className="btn primary" href={RELEASES_URL} target="_blank" rel="noreferrer">
            Baixar .mcaddon
          </a>
          <a className="btn ghost" href="#recursos">Ver recursos</a>
        </div>
        <p className="fine">Versão 1.0.0 · Ainda não testado dentro do jogo.</p>
      </div>
      <div className="hero-visual" aria-hidden="true">
        <div className="web web-a" />
        <div className="web web-b" />
        <div className="emblem">
          <div className="eye l" />
          <div className="eye r" />
          <div className="spider-body" />
        </div>
        <div className="hud">
          <span>Classic Red &amp; Blue</span>
          <span className="sep">|</span>
          <span>Impact Web</span>
          <span className="sep">|</span>
          <span className="swing">SWINGING</span>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="section" id="recursos">
      <h2>Recursos</h2>
      <p className="section-sub">Cada sistema foi feito para funcionar junto com os outros.</p>
      <div className="grid">
        {FEATURES.map((f) => (
          <article className="card" key={f.title}>
            <div className="card-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Install() {
  return (
    <section className="section" id="instalacao">
      <h2>Como instalar</h2>
      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="step-n">{i + 1}</span>
            <div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section className="section" id="faq">
      <h2>Perguntas frequentes</h2>
      <div className="faq">
        {FAQ.map((item, i) => {
          const isOpen = open === i;
          return (
            <div className={`faq-item ${isOpen ? "open" : ""}`} key={item.q}>
              <button
                className="faq-q"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? -1 : i)}
              >
                {item.q}
                <span>{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen && <p className="faq-a">{item.a}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <p>
        Fã-feito, sem afiliação oficial com a Marvel, Sony ou Mojang. Todos os
        ativos são originais.
      </p>
      <a href={REPO_URL} target="_blank" rel="noreferrer">Código no GitHub</a>
    </footer>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <Install />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
