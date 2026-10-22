// Gráficos em HTML puro: barras horizontais, barra de composição e divisão M/F.
// Cores por papel (CSS vars --series-N); texto sempre em tinta de texto, nunca na cor da série.
window.Charts = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // items: [{ label, value, href?, tip? }] — uma única série
  function barras(items, { fmt = (v) => v, serie = 1, vazio = 'Sem dados informados' } = {}) {
    const validos = items.filter((i) => Regras.temValor(i.value));
    if (!validos.length) return `<p class="vazio">${esc(vazio)}</p>`;
    const max = Math.max(...validos.map((i) => Math.abs(i.value))) || 1;
    const linhas = items.map((i) => {
      const ok = Regras.temValor(i.value);
      const w = ok ? Math.max(0.6, (Math.abs(i.value) / max) * 100) : 0;
      const tip = esc(i.tip || `${i.label}: ${ok ? fmt(i.value) : 'não informado'}`);
      const tag = i.href ? 'a' : 'div';
      const href = i.href ? ` href="${esc(i.href)}"` : '';
      return `<${tag} class="hb-row${i.href ? ' link' : ''}"${href} data-tip="${tip}">
        <span class="hb-top"><span class="hb-label">${esc(i.label)}</span><span class="hb-val">${ok ? esc(fmt(i.value)) : '<span class="hb-na">não informado</span>'}</span></span>
        <span class="hb-track">${ok ? `<span class="hb-bar" style="width:${w}%;background:var(--series-${serie})"></span>` : ''}</span>
      </${tag}>`;
    }).join('');
    return `<div class="hbars" role="list">${linhas}</div>`;
  }

  // items: [{ label, value }] — composição de um todo; slot de cor fixo pela ordem da categoria
  function composicao(items, { fmt = (v) => v, rotuloTotal = 'Total' } = {}) {
    const validos = items.filter((i) => Regras.temValor(i.value) && i.value > 0);
    const total = validos.reduce((s, i) => s + i.value, 0);
    if (!total) return '<p class="vazio">Sem dados informados</p>';
    const cor = (i) => (i.slot ? `var(--series-${i.slot})` : 'var(--series-other)');
    const segs = validos.map((i) => `<span class="cs-seg" style="flex:${i.value};background:${cor(i)}" data-tip="${esc(i.label)}: ${esc(fmt(i.value))} (${Regras.fmt.pct(i.value / total)})"></span>`).join('');
    const leg = items.map((i) => {
      const ok = Regras.temValor(i.value) && i.value > 0;
      return `<li data-tip="${esc(i.label)}: ${ok ? esc(fmt(i.value)) : 'não informado ou zero'}">
        <span class="sw" style="background:${cor(i)}"></span>
        <span class="cs-l">${esc(i.label)}</span>
        <span class="cs-v">${ok ? esc(fmt(i.value)) : '—'}</span>
        <span class="cs-p">${ok ? Regras.fmt.pct(i.value / total) : ''}</span>
      </li>`;
    }).join('');
    return `<div class="compo">
      <div class="cs-bar" role="img" aria-label="Composição">${segs}</div>
      <ul class="cs-leg">${leg}</ul>
      <div class="cs-total"><span>${esc(rotuloTotal)}</span><strong>${esc(fmt(total))}</strong></div>
    </div>`;
  }

  // Divisão masculino/feminino de um par [m, f, t]
  function sexo(par, titulo) {
    const [m, f, t] = par || [];
    const ok = Regras.temValor(m) && Regras.temValor(f) && (m + f) > 0;
    const barra = ok
      ? `<div class="cs-bar sm">
          <span class="cs-seg" style="flex:${m};background:var(--series-1)" data-tip="Masculino: ${m}"></span>
          <span class="cs-seg" style="flex:${f};background:var(--series-2)" data-tip="Feminino: ${f}"></span>
        </div>`
      : '<div class="cs-bar sm empty"></div>';
    return `<div class="sexo">
      <div class="sexo-h"><span>${esc(titulo)}</span><strong>${Regras.fmt.int(t)}</strong></div>
      ${barra}
      <div class="sexo-l">
        <span><i class="sw" style="background:var(--series-1)"></i>Masc. ${Regras.fmt.int(m)}</span>
        <span><i class="sw" style="background:var(--series-2)"></i>Fem. ${Regras.fmt.int(f)}</span>
      </div>
    </div>`;
  }

  // Tooltip global para qualquer [data-tip] (mouse e toque)
  function ligarTooltip() {
    const tip = document.getElementById('tip');
    let alvo = null;
    const mostrar = (el, x, y) => {
      alvo = el; tip.textContent = el.getAttribute('data-tip'); tip.hidden = false;
      const r = tip.getBoundingClientRect();
      const left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2));
      const top = y - r.height - 12 < 8 ? y + 16 : y - r.height - 12;
      tip.style.left = left + 'px'; tip.style.top = top + 'px';
    };
    const esconder = () => { alvo = null; tip.hidden = true; };
    document.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const el = e.target.closest('[data-tip]');
      if (el) mostrar(el, e.clientX, e.clientY); else if (alvo) esconder();
    });
    document.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      const el = e.target.closest('[data-tip]');
      if (el && !el.closest('a')) mostrar(el, e.clientX, e.clientY); else esconder();
    });
    window.addEventListener('scroll', esconder, { passive: true });
    window.addEventListener('hashchange', esconder);
  }

  return { barras, composicao, sexo, ligarTooltip, esc };
})();
