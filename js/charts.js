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

  // Linha de evolução de UM indicador ao longo dos exercícios (uma série, sem legenda: o título nomeia).
  // pontos: [{ ano, valor, n, de, anterior? }] — "anterior": valor informado como "ano anterior" no relatório
  // seguinte (ponto vazado e trecho tracejado). Rótulo direto no primeiro e no último ponto; dica em todos.
  function linha(pontos, { fmt = (v) => v, serie = 1, unidade = 'igreja' } = {}) {
    const ok = pontos.filter((p) => Regras.temValor(p.valor));
    if (!ok.length) return '<p class="vazio">Sem dados informados</p>';
    const W = 300, H = 118, PX = 30, PT = 22, PB = 22;
    const anos = ok.map((p) => p.ano), a0 = Math.min(...anos), a1 = Math.max(...anos);
    let lo = Math.min(...ok.map((p) => p.valor)), hi = Math.max(...ok.map((p) => p.valor));
    if (lo === hi) { lo -= Math.max(1, Math.abs(lo) * 0.1); hi += Math.max(1, Math.abs(hi) * 0.1); }
    const folga = (hi - lo) * 0.18; lo -= folga; hi += folga;
    const x = (a) => (a0 === a1 ? W / 2 : PX + ((a - a0) / (a1 - a0)) * (W - 2 * PX));
    const y = (v) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
    const cor = `var(--series-${serie})`;
    let trechos = '';
    for (let i = 1; i < ok.length; i++) {
      const p = ok[i - 1], q = ok[i];
      trechos += `<line x1="${x(p.ano)}" y1="${y(p.valor)}" x2="${x(q.ano)}" y2="${y(q.valor)}" stroke="${cor}" stroke-width="2" stroke-linecap="round"${p.anterior || q.anterior ? ' stroke-dasharray="4 4"' : ''}/>`;
    }
    const dica = (p) => esc(`${p.ano}: ${fmt(p.valor)}${p.n != null ? ` · ${p.n} ${p.n === 1 ? unidade : unidade + 's'}` : ''}${p.anterior ? ' · informado como “ano anterior” no relatório seguinte' : ''}`);
    const marcas = ok.map((p, i) => {
      const cx = x(p.ano), cy = y(p.valor), rotulo = i === 0 || i === ok.length - 1;
      return `<g data-tip="${dica(p)}">
        <circle cx="${cx}" cy="${cy}" r="14" fill="transparent"/>
        <circle cx="${cx}" cy="${cy}" r="4.5" fill="${p.anterior ? 'var(--paper-raise)' : cor}" stroke="${p.anterior ? cor : 'var(--paper-raise)'}" stroke-width="2"/>
        ${rotulo ? `<text x="${cx}" y="${cy - 10}" text-anchor="middle" class="ln-v">${esc(fmt(p.valor))}</text>` : ''}
        <text x="${cx}" y="${H - 6}" text-anchor="middle" class="ln-a">${p.ano}</text></g>`;
    }).join('');
    return `<svg class="linha" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ok.map((p) => `${p.ano}: ${fmt(p.valor)}`).join('; '))}">
      <line x1="${PX - 14}" y1="${H - PB}" x2="${W - PX + 14}" y2="${H - PB}" class="ln-base"/>${trechos}${marcas}</svg>`;
  }

  // Mapa em grade do Brasil: cada UF é um quadrado na posição aproximada. Cor sequencial (uma só cor,
  // do claro ao escuro) pelo valor; UF sem dado fica neutra. itens: [{ uf, valor, tip }]
  const GRADE_UF = {
    RR: [2, 0], AP: [3, 0],
    AM: [1, 1], PA: [2, 1], MA: [3, 1], CE: [4, 1], RN: [5, 1],
    AC: [0, 2], RO: [1, 2], MT: [2, 2], TO: [3, 2], PI: [4, 2], PB: [5, 2],
    MS: [1, 3], GO: [2, 3], DF: [3, 3], BA: [4, 3], PE: [5, 3], AL: [6, 3],
    PR: [1, 4], SP: [2, 4], MG: [3, 4], ES: [4, 4], SE: [5, 4],
    SC: [1, 5], RJ: [3, 5],
    RS: [1, 6],
  };
  function mapaUF(itens, { fmt = (v) => v, rotulo = 'Valor' } = {}) {
    const porUf = Object.fromEntries(itens.filter((i) => GRADE_UF[i.uf]).map((i) => [i.uf, i]));
    const vals = Object.values(porUf).map((i) => i.valor).filter((v) => Regras.temValor(v));
    if (!vals.length) return '<p class="vazio">Sem dados por UF</p>';
    // Escala começa em zero (não no menor valor): evita exagerar diferenças pequenas entre estados
    const lo = Math.min(0, ...vals), hi = Math.max(...vals);
    const passos = lo === hi ? 1 : 5;
    const faixa = (v) => (passos === 1 ? 5 : 1 + Math.round(((v - lo) / (hi - lo)) * 4)); // 5 faixas iguais de zero ao maior valor
    const C = 42, G = 4, W = 7 * (C + G), H = 7 * (C + G);
    const celulas = Object.entries(GRADE_UF).map(([uf, [cx, cy]]) => {
      const i = porUf[uf], ok = i && Regras.temValor(i.valor);
      const nivel = ok ? faixa(i.valor) : 0;
      const x = cx * (C + G), y = cy * (C + G);
      return `<g${ok ? ` data-tip="${esc(i.tip || `${uf}: ${fmt(i.valor)}`)}"` : ` data-tip="${uf}: sem dados"`}>
        <rect x="${x}" y="${y}" width="${C}" height="${C}" rx="4" class="uf ${ok ? `seq-${nivel}` : 'uf-vazia'}"/>
        <text x="${x + C / 2}" y="${y + C / 2 + (ok ? -3 : 4)}" text-anchor="middle" class="uf-l${nivel >= 4 ? ' claro' : ''}">${uf}</text>
        ${ok ? `<text x="${x + C / 2}" y="${y + C / 2 + 11}" text-anchor="middle" class="uf-v${nivel >= 4 ? ' claro' : ''}">${esc(fmt(i.valor))}</text>` : ''}</g>`;
    }).join('');
    const legenda = passos === 1
      ? `<span><i class="sw seq-5"></i>${esc(fmt(lo))}</span>`
      : [lo, hi].map((v, k) => `<span><i class="sw seq-${k ? 5 : 1}"></i>${esc(fmt(v))}</span>`).join('<span class="mapa-seta">→</span>');
    return `<div class="mapa"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(rotulo)} por UF: ${esc(Object.values(porUf).filter((i) => Regras.temValor(i.valor)).map((i) => `${i.uf} ${fmt(i.valor)}`).join('; '))}">${celulas}</svg>
      <div class="mapa-leg">${legenda}<span><i class="sw uf-vazia"></i>sem dados</span></div></div>`;
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

  return { barras, composicao, sexo, linha, mapaUF, ligarTooltip, esc };
})();
