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

  // Mapa do Brasil por UF (contornos do IBGE em js/mapa-brasil.js). Cor sequencial (uma só cor, do claro
  // ao escuro) pelo valor; UF sem dado fica neutra. itens: [{ uf, valor, tip }]
  const NOMES_UF = {
    AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo',
    GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba',
    PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
    RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
  };
  const CABE_DENTRO = 15; // folga mínima (px do mapa) para sigla e valor caberem dentro do estado
  function mapaUF(itens, { fmt = (v) => v, rotulo = 'Valor' } = {}) {
    const M = window.MAPA_BRASIL;
    if (!M) return '<p class="vazio">Mapa indisponível</p>';
    const porUf = Object.fromEntries(itens.filter((i) => M.ufs[i.uf]).map((i) => [i.uf, i]));
    const comDado = Object.values(porUf).filter((i) => Regras.temValor(i.valor));
    if (!comDado.length) return '<p class="vazio">Sem dados por UF</p>';
    // Escala começa em zero (não no menor valor): evita exagerar diferenças pequenas entre estados
    const vals = comDado.map((i) => i.valor), lo = Math.min(0, ...vals), hi = Math.max(...vals);
    const passos = lo === hi ? 1 : 5;
    const faixa = (v) => (passos === 1 ? 5 : 1 + Math.round(((v - lo) / (hi - lo)) * 4)); // 5 faixas iguais de zero ao maior valor
    const dica = (uf) => { const i = porUf[uf]; return i && Regras.temValor(i.valor) ? i.tip || `${uf}: ${fmt(i.valor)}` : `${NOMES_UF[uf]}: sem dados`; };
    const nivelDe = (uf) => { const i = porUf[uf]; return i && Regras.temValor(i.valor) ? faixa(i.valor) : 0; };

    // Estados: os com dado ficam por cima (contorno inteiro visível)
    const ordem = Object.keys(M.ufs).sort((a, b) => (nivelDe(a) > 0) - (nivelDe(b) > 0));
    const formas = ordem.map((uf) => { const n = nivelDe(uf); return `<path d="${M.ufs[uf].d}" class="uf ${n ? `seq-${n} com` : 'uf-vazia'}" data-tip="${esc(dica(uf))}"/>`; }).join('');

    // Rótulos: dentro dos estados grandes; os pequenos com dado ganham rótulo do lado de fora, com linha-guia
    const dentro = [], fora = [], ocupado = []; // ocupado: caixas dos rótulos de dentro [x0, y0, x1, y1]
    for (const uf of Object.keys(M.ufs)) {
      const u = M.ufs[uf], n = nivelDe(uf), claro = n >= 4 ? ' claro' : '';
      if (u.r >= CABE_DENTRO) {
        ocupado.push([u.x - 24, u.y - 18, u.x + 24, n ? u.y + 18 : u.y + 8]);
        dentro.push(n
          ? `<text x="${u.x}" y="${u.y - 3}" class="uf-l${claro}">${uf}</text><text x="${u.x}" y="${u.y + 14}" class="uf-v${claro}">${esc(fmt(porUf[uf].valor))}</text>`
          : `<text x="${u.x}" y="${u.y + 5}" class="uf-l apagado">${uf}</text>`);
      } else if (n) fora.push(uf);
    }
    // Rótulos de fora: na margem direita (litoral), espaçados para não se sobreporem. O DF fica no meio do
    // mapa: testa posições em volta dele e usa a que menos cobre os rótulos de dentro.
    const X_MARGEM = M.largura + 14, LINHA = 30;
    const posFora = {}; let ultimo = -Infinity;
    for (const uf of fora.filter((u) => u !== 'DF').sort((a, b) => M.ufs[a].y - M.ufs[b].y)) { const y = Math.max(M.ufs[uf].y, ultimo + LINHA); posFora[uf] = [X_MARGEM, y]; ultimo = y; }
    if (fora.includes('DF')) {
      const { x, y } = M.ufs.DF, larg = 30 + 9 * String(fmt(porUf.DF.valor)).length;
      const sobra = ([lx, ly]) => ocupado.reduce((s, [a, b, c, d]) => s + Math.max(0, Math.min(c, lx + larg) - Math.max(a, lx)) * Math.max(0, Math.min(d, ly + 4) - Math.max(b, ly - 14)), 0);
      posFora.DF = [[x + 40, y - 34], [x + 44, y + 4], [x + 30, y + 44], [x - 40 - larg, y - 34], [x - 44 - larg, y + 4], [x - 30 - larg, y + 44], [x - larg / 2, y - 48]]
        .reduce((m, p) => (sobra(p) < sobra(m) ? p : m));
    }
    const chamadas = fora.map((uf) => {
      const u = M.ufs[uf], [lx, ly] = posFora[uf], valor = fmt(porUf[uf].valor);
      const x2 = lx < u.x ? lx + 30 + 9 * String(valor).length : lx - 4; // rótulo à esquerda: a linha chega pelo fim do texto
      return `<g class="chamada" data-tip="${esc(dica(uf))}"><line x1="${u.x}" y1="${u.y}" x2="${x2}" y2="${ly - 5}"/><circle cx="${u.x}" cy="${u.y}" r="2.5"/>
        <text x="${lx}" y="${ly}" class="uf-c"><tspan class="uf-c-l">${uf}</tspan> ${esc(valor)}</text></g>`;
    }).join('');
    const largura = M.largura + (fora.some((uf) => uf !== 'DF') ? 104 : 8);

    const legenda = passos === 1
      ? `<span><i class="sw seq-5"></i>${esc(fmt(lo))}</span>`
      : [lo, hi].map((v, k) => `<span><i class="sw seq-${k ? 5 : 1}"></i>${esc(fmt(v))}</span>`).join('<span class="mapa-seta">→</span>');
    // Lista dos estados com dado (do maior para o menor): leitura direta, sem precisar acertar o toque no mapa
    const lista = comDado.slice().sort((a, b) => b.valor - a.valor).map((i) =>
      `<li data-tip="${esc(dica(i.uf))}"><i class="sw seq-${faixa(i.valor)}"></i><span>${NOMES_UF[i.uf]} <small>${i.uf}</small></span><strong>${esc(fmt(i.valor))}</strong></li>`).join('');
    return `<div class="mapa"><svg viewBox="-4 -4 ${largura} ${M.altura + 8}" role="img" aria-label="${esc(rotulo)} por UF: ${esc(comDado.map((i) => `${NOMES_UF[i.uf]} ${fmt(i.valor)}`).join('; '))}">${formas}${dentro.join('')}${chamadas}</svg>
      <div class="mapa-leg">${legenda}<span><i class="sw uf-vazia"></i>sem dados</span></div>
      <ul class="mapa-lista">${lista}</ul></div>`;
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
