// Interface: roteamento por hash, telas e ações.
(() => {
  const S = Data.state;
  const { T, fmt, STATUS, ORDEM_STATUS, PAPEIS, temValor } = Regras;
  const esc = Charts.esc;
  const $app = document.getElementById('app');
  const ui = { escopo: 'validados', carregado: false };

  // ---------- Ícones ----------
  const ICON = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    igrejas: '<path d="M12 2v4M10 4h4M5 21V11l7-5 7 5v10M9.5 21v-5h5v5M3 21h18"/>',
    conferencia: '<path d="M9 11l2 2 4-4"/><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>',
    sinodo: '<path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="M2 13l10 5 10-5"/><path d="M2 18l10 5 10-5"/>',
    perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    voltar: '<path d="M15 5l-7 7 7 7"/>',
    seta: '<path d="M9 5l7 7-7 7"/>',
    arquivo: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>',
    busca: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    enviar: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
    baixar: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/>',
    ajuda: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.5"/><path d="M12 17h.01"/>',
  };
  const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

  // ---------- Utilidades ----------
  const chip = (status) => {
    const s = STATUS[status] || STATUS.recebido;
    return `<span class="chip ${s.cls}"><b aria-hidden="true">${s.icon}</b>${s.label}</span>`;
  };
  const delta = (v, { moeda = false } = {}) => {
    if (!v || !temValor(v.abs)) return '';
    const cls = v.abs > 0 ? 'up' : v.abs < 0 ? 'down' : 'flat';
    const seta = v.abs > 0 ? '▲' : v.abs < 0 ? '▼' : '■';
    const abs = moeda ? fmt.brlCurto(Math.abs(v.abs)) : fmt.sinal(v.abs);
    return `<span class="kpi-d ${cls}"><b aria-hidden="true">${seta}</b>${moeda && v.abs < 0 ? '−' : ''}${abs}${temValor(v.pct) ? ` (${fmt.pct(v.pct)})` : ''}</span>`;
  };
  const cobertura = (c) => (c && c.de ? `<span class="kpi-f">${c.n} de ${c.de} ${c.de === 1 ? 'igreja' : 'igrejas'}</span>` : '');
  const kpi = (label, valor, extra = '', foot = '') => `<div class="kpi"><span class="kpi-l">${label}</span><strong class="kpi-v">${valor}</strong>${extra}${foot}</div>`;
  const card = (titulo, corpo, { sub = '', fonte = '', cls = '' } = {}) => `<section class="card ${cls}">
      ${titulo ? `<header class="card-h"><h2>${titulo}</h2>${sub ? `<p>${sub}</p>` : ''}</header>` : ''}
      ${corpo}
      ${fonte ? `<footer class="card-f">${fonte}</footer>` : ''}
    </section>`;
  const relPorCodigo = (cod) => S.relatorios.find((r) => r.igreja.codigo === cod);
  const nomeCurto = (n) => String(n || '').replace(/Igreja Presbiteriana/i, 'IP').replace(/Primeira/i, '1ª').replace(/Segunda/i, '2ª');
  const contaVerif = (r) => {
    const v = Regras.verificacoes(r.dados);
    return { falhas: v.filter((x) => x.ok === false).length, total: v.filter((x) => x.ok !== null).length };
  };
  const toast = (msg) => {
    const t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2600);
  };

  // ---------- Navegação por perfil ----------
  function itensNav() {
    const p = S.perfil?.papel;
    const pend = S.relatorios.filter((r) => r.status !== 'validado').length;
    if (p === 'representante') {
      return [
        { id: 'igreja', href: `#/igreja/${S.perfil.igreja_codigo}`, label: 'Minha igreja', icon: 'igrejas' },
        { id: 'enviar', href: '#/enviar', label: 'Enviar', icon: 'enviar' },
        { id: 'perfil', href: '#/perfil', label: 'Perfil', icon: 'perfil' },
      ];
    }
    const base = [
      { id: 'inicio', href: '#/', label: 'Presbitério', icon: 'home' },
      { id: 'igrejas', href: '#/igrejas', label: 'Igrejas', icon: 'igrejas' },
      { id: 'pendencias', href: '#/pendencias', label: 'Conferência', icon: 'conferencia', badge: pend },
      { id: 'sinodo', href: '#/sinodo', label: 'Sínodo', icon: 'sinodo' },
      { id: 'perfil', href: '#/perfil', label: 'Perfil', icon: 'perfil' },
    ];
    if (p === 'admin_sinodal') return [base[3], base[0], base[1], base[4]];
    return base;
  }

  function render(v, ativo) {
    const nav = itensNav().map((i) => `<a href="${i.href}" class="nav-i${i.id === ativo ? ' on' : ''}"${i.id === ativo ? ' aria-current="page"' : ''}>
        <span class="nav-ic">${ic(i.icon)}${i.badge ? `<span class="badge">${i.badge}</span>` : ''}</span><span class="nav-l">${i.label}</span></a>`).join('');
    $app.innerHTML = `<div class="shell">
      <nav class="nav" aria-label="Navegação principal">
        <div class="brand"><img src="icons/logo_ipb.png" alt="Igreja Presbiteriana do Brasil"><small>Estatística · ${esc(S.presbiterio?.sigla || '')} ${S.ano}</small></div>
        ${nav}
      </nav>
      <header class="appbar">
        ${v.back ? `<a class="ab-back" href="${v.back}" aria-label="Voltar">${ic('voltar')}</a>` : ''}
        <div class="ab-t">${v.sub ? `<small>${v.sub}</small>` : ''}<h1>${v.title}</h1></div>
        ${S.modo === 'local' ? '<span class="modo" title="Dados lidos do arquivo local">local</span>' : ''}
        ${ativo !== 'ajuda' ? `<a class="ab-help" href="#/ajuda" aria-label="Ajuda" title="Ajuda">${ic('ajuda')}</a>` : ''}
      </header>
      <main class="content" id="conteudo">${v.body}</main>
    </div>`;
    window.scrollTo(0, 0);
    v.after?.();
  }

  function renderSimples(html) { $app.innerHTML = `<div class="solo">${html}</div>`; }

  // ---------- Login ----------
  function telaLogin(erro = '') {
    const local = S.modo === 'local';
    renderSimples(`<div class="login">
      <h1 class="login-logo"><img src="icons/logo_ipb.png" alt="Igreja Presbiteriana do Brasil"></h1>
      <p class="muted">Relatórios estatísticos das igrejas, consolidados por presbitério e sínodo.</p>
      ${erro ? `<p class="erro" role="alert">${esc(erro)}</p>` : ''}
      ${local ? `
        <div class="aviso-local"><strong>Modo local</strong> — os dados vêm do arquivo no seu computador. Escolha um perfil para simular o acesso:</div>
        <div class="perfis">
          <button class="btn primary" data-papel="admin_presbiterial">Administrador presbiterial</button>
          <button class="btn" data-papel="admin_sinodal">Administrador sinodal</button>
          <button class="btn" data-papel="representante">Representante de igreja</button>
        </div>` : `
        <form id="f-login" class="form">
          <label>E-mail<input type="email" name="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="email" required></label>
          <label>Senha<input type="password" name="senha" id="senha" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" required></label>
          <label class="conf"><input type="checkbox" id="ver-senha"> Mostrar senha</label>
          <button class="btn primary" type="submit">Entrar</button>
        </form>`}
      <a class="login-ajuda" href="#/ajuda">${ic('ajuda')}Como funciona o sistema?</a>
    </div>`);
    if (local) {
      $app.querySelectorAll('[data-papel]').forEach((b) => b.addEventListener('click', () => {
        Data.entrarLocal(b.dataset.papel); ui.carregado = false;
        location.hash = b.dataset.papel === 'admin_sinodal' ? '#/sinodo' : '#/';
        rota();
      }));
    } else {
      document.getElementById('ver-senha').addEventListener('change', (e) => { document.getElementById('senha').type = e.target.checked ? 'text' : 'password'; });
      document.getElementById('f-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Entrando…';
        // Teclados de celular costumam pôr maiúscula inicial ou espaço no fim do e-mail
        const email = String(f.get('email') || '').trim().toLowerCase();
        try { await Data.entrar(email, f.get('senha')); ui.carregado = false; location.hash = '#/'; rota(); } catch (err) { telaLogin(err.message); }
      });
    }
  }

  // ---------- Presbitério ----------
  function telaPresbiterio() {
    const todos = S.relatorios;
    const validados = todos.filter((r) => r.status === 'validado');
    const base = ui.escopo === 'todos' ? todos : validados;
    const parcial = validados.length < todos.length;

    // Cobertura por situação
    const porStatus = {};
    for (const r of todos) porStatus[r.status] = (porStatus[r.status] || 0) + 1;
    const segs = ORDEM_STATUS.filter((s) => porStatus[s]).map((s) => `<span class="cs-seg st-${STATUS[s].cls}" style="flex:${porStatus[s]}" data-tip="${STATUS[s].label}: ${porStatus[s]}"></span>`).join('');
    const chipsStatus = ORDEM_STATUS.filter((s) => porStatus[s]).map((s) => `<a class="cob-i" href="#/pendencias">${chip(s)}<strong>${porStatus[s]}</strong></a>`).join('');

    const com = Regras.consolidar(base, (r) => T(r.dados.comungantes?.ano_atual));
    const comV = Regras.variacao(base, (r) => T(r.dados.comungantes?.ano_anterior), (r) => T(r.dados.comungantes?.ano_atual));
    const nc = Regras.consolidar(base, (r) => T(r.dados.nao_comungantes?.ano_atual));
    const ncV = Regras.variacao(base, (r) => T(r.dados.nao_comungantes?.ano_anterior), (r) => T(r.dados.nao_comungantes?.ano_atual));
    const rol = Regras.consolidar(base, (r) => T(r.dados.rol_atual));
    const ed = Regras.consolidar(base, (r) => r.dados.estrutura?.alunos_ed_atual);
    const edV = Regras.variacao(base, (r) => r.dados.estrutura?.alunos_ed_anterior, (r) => r.dados.estrutura?.alunos_ed_atual);
    const prof = Regras.consolidar(base, (r) => r.dados.estrutura?.professores_ed);
    const rec = Regras.consolidar(base, (r) => r.dados.financeiro?.realizado?.total_receita);
    const desp = Regras.consolidar(base, (r) => r.dados.financeiro?.realizado?.total_despesa);

    // Movimentação consolidada (comungantes)
    const somaTipo = (bloco) => {
      const acc = {};
      for (const r of base) for (const [k, v] of Object.entries(r.dados.comungantes?.[bloco] || {})) {
        if (Regras.DETALHE.has(k) || !Array.isArray(v) || !temValor(v[2])) continue;
        acc[k] = (acc[k] || 0) + v[2];
      }
      return Object.entries(acc).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: Regras.ROTULOS[k] || k, value: v }));
    };
    const adm = somaTipo('admissao'), dem = somaTipo('demissao');
    const totAdm = adm.reduce((s, i) => s + i.value, 0), totDem = dem.reduce((s, i) => s + i.value, 0);

    // Composição das despesas realizadas
    const somaDesp = (k) => Regras.consolidar(base, (r) => r.dados.financeiro?.realizado?.[k]).total;
    const nomeadas = Regras.COMPOSICAO_DESPESA.map(([k, l], i) => ({ label: l, value: somaDesp(k), slot: i + 1 }));
    const chavesNomeadas = new Set(Regras.COMPOSICAO_DESPESA.map(([k]) => k));
    const demais = Regras.DESPESAS.filter(([k]) => !chavesNomeadas.has(k)).reduce((s, [k]) => s + (somaDesp(k) || 0), 0);
    const compo = [...nomeadas, { label: 'Demais despesas', value: demais, slot: null }];

    const porIgreja = (fn) => base.map((r) => ({ label: nomeCurto(r.igreja.nome), value: fn(r), href: `#/igreja/${r.igreja.codigo}`, tip: `${r.igreja.nome}` }))
      .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
    const lid = (k) => Regras.consolidar(base, (r) => r.dados.lideranca?.[k]);

    const dTxt = (v) => (v && temValor(v.abs) ? `${fmt.sinal(v.abs)}${temValor(v.pct) ? ` (${fmt.pct(v.pct)})` : ''} no ano` : '');
    const body = `
      <section class="hero">
        <p class="kicker"><a href="#/sinodo">${esc(S.sinodo?.nome || 'Sínodo')}</a> › ${esc(S.presbiterio?.nome || '')} — relatórios estatísticos do exercício ${S.ano}, ${ui.escopo === 'todos' ? 'todos os recebidos' : 'somente os validados'}.</p>
        <h2>${fmt.int(rol.total)} <small>membros</small></h2>
        <div class="metric-row">
          <div class="metric-pill"><span class="num">${fmt.int(com.total)}</span><span class="label">Comungantes</span><span class="d">${dTxt(comV)}</span></div>
          <div class="metric-pill"><span class="num">${fmt.int(nc.total)}</span><span class="label">Não comungantes</span><span class="d">${dTxt(ncV)}</span></div>
          <div class="metric-pill"><span class="num">${base.length} <small>de ${todos.length}</small></span><span class="label">Igrejas consideradas</span><span class="d">${validados.length} relatórios validados</span></div>
        </div>
        <div class="seg" role="group" aria-label="Relatórios considerados">
          <button class="${ui.escopo === 'validados' ? 'on' : ''}" data-escopo="validados">Somente validados (${validados.length})</button>
          <button class="${ui.escopo === 'todos' ? 'on' : ''}" data-escopo="todos">Todos recebidos (${todos.length})</button>
        </div>
      </section>

      ${ui.escopo === 'todos'
        ? `<div class="banner warning" role="note"><b>!</b><div><strong>Inclui relatórios não validados.</strong> Use apenas para acompanhamento — ${todos.length - validados.length} relatórios ainda têm pendências.</div></div>`
        : parcial ? `<div class="banner info" role="note"><b>i</b><div><strong>Resultado parcial:</strong> ${validados.length} de ${todos.length} relatórios recebidos estão validados. Os números abaixo consideram somente estes.</div></div>` : ''}

      ${card('Recebimento dos relatórios', `<div class="cs-bar">${segs}</div><div class="cob">${chipsStatus}</div>`, { sub: `Exercício ${S.ano} · ${todos.length} relatórios recebidos` })}

      <div class="kpis k4">
        ${kpi('Alunos na Escola Dominical', fmt.int(ed.total), delta(edV), cobertura(ed))}
        ${kpi('Professores da Escola Dominical', fmt.int(prof.total), '', cobertura(prof))}
        ${kpi('Receita anual realizada', fmt.brlCurto(rec.total), '', cobertura(rec))}
        ${kpi('Despesa anual realizada', fmt.brlCurto(desp.total), '', cobertura(desp))}
      </div>

      <div class="grid2">
        ${card('Comungantes por igreja', Charts.barras(porIgreja((r) => T(r.dados.comungantes?.ano_atual)), { fmt: fmt.int }), { sub: 'Toque em uma igreja para abrir o painel dela' })}
        ${card('Receita anual realizada por igreja', Charts.barras(porIgreja((r) => r.dados.financeiro?.realizado?.total_receita), { fmt: fmt.brlCurto }), { sub: 'Total da receita anual, sem saldo anterior' })}
      </div>

      <div class="grid2">
        ${card('Movimentação de comungantes', `
          <div class="mov">
            <div><h3>Admissões <strong>${fmt.int(totAdm)}</strong></h3>${Charts.barras(adm, { fmt: fmt.int })}</div>
            <div><h3>Demissões <strong>${fmt.int(totDem)}</strong></h3>${Charts.barras(dem, { fmt: fmt.int, serie: 2 })}</div>
          </div>`, { sub: `Saldo do período: ${fmt.sinal(totAdm - totDem)} comungantes` })}
        ${card('Composição das despesas realizadas', Charts.composicao(compo, { fmt: fmt.brlCurto, rotuloTotal: 'Total das despesas' }))}
      </div>

      ${card('Liderança formal', `<div class="mini">${Regras.LIDERANCA.map(([k, l]) => { const c = lid(k); return `<div><strong>${fmt.int(c.total)}</strong><span>${l}</span></div>`; }).join('')}</div>`)}

      ${(() => {
        const itens = [['ceia_total', 'Celebrações da Santa Ceia'], ['atividades_evangelisticas', 'Atividades evangelísticas'], ['textos_total', 'Textos distribuídos'],
          ['discipulados', 'Discipulados'], ['atos_beneficentes_total', 'Atos beneficentes'], ['visitas_total', 'Visitas']]
          .map(([k, l]) => ({ l, c: Regras.consolidar(base, (r) => r.dados.conselho?.[k]) }));
        return card('Vida ministerial', itens.some((x) => x.c.n)
          ? `<div class="mini">${itens.map((x) => `<div><strong>${fmt.int(x.c.total)}</strong><span>${x.l}</span><span>${x.c.n} de ${x.c.de} igrejas</span></div>`).join('')}</div>`
          : '<p class="vazio">Nenhum dos relatórios considerados trouxe a aba “Conselho ou Mesa”. Esses dados chegam quando a igreja envia o relatório completo em Excel.</p>',
        { sub: 'Da aba “Conselho ou Mesa” dos relatórios enviados em Excel · cada número mostra quantas igrejas informaram' });
      })()}

      ${card('Exportar', `<div class="btns exp">
          <button class="btn" data-exportar="excel">${ic('baixar')}Planilha Excel</button>
          <button class="btn" data-exportar="pdf">${ic('arquivo')}Resumo em PDF</button>
        </div>`, { sub: `Mesmos relatórios do painel: ${ui.escopo === 'todos' ? 'todos os recebidos' : 'somente os validados'} (${base.length} de ${todos.length})` })}

      <p class="nota">Campos vazios nos relatórios contam como <em>não informado</em>, não como zero. Cada indicador mostra quantas igrejas contribuíram para o total.</p>`;

    return {
      title: esc(S.presbiterio?.nome || 'Presbitério'), sub: `Exercício ${S.ano}`, body,
      after: () => {
        $app.querySelectorAll('[data-escopo]').forEach((b) => b.addEventListener('click', () => { ui.escopo = b.dataset.escopo; rota(); }));
        $app.querySelectorAll('[data-exportar]').forEach((b) => b.addEventListener('click', async () => {
          const html = b.innerHTML;
          b.disabled = true; b.innerHTML = '<span class="spin"></span>Gerando…';
          try {
            await Exportar[b.dataset.exportar]({ base, todos, escopo: ui.escopo, presbiterio: S.presbiterio, sinodo: S.sinodo, ano: S.ano });
          } catch (e) { toast('Não foi possível exportar: ' + e.message); }
          b.disabled = false; b.innerHTML = html;
        }));
      },
    };
  }

  // ---------- Lista de igrejas ----------
  function telaIgrejas() {
    const rels = [...S.relatorios].sort((a, b) => a.igreja.nome.localeCompare(b.igreja.nome, 'pt-BR'));
    const itens = rels.map((r) => {
      const v = contaVerif(r);
      const erros = r.alertas.filter((a) => a.nivel === 'erro').length;
      return `<a class="item" href="#/igreja/${r.igreja.codigo}" data-busca="${esc((r.igreja.nome + ' ' + r.igreja.cidade + ' ' + r.igreja.codigo).toLowerCase())}">
        <div class="item-m">
          <strong>${esc(r.igreja.nome)}</strong>
          <span class="muted">${esc(r.igreja.cidade)} · ${esc(r.igreja.uf)}</span>
          <div class="item-s">${chip(r.status)}${erros || v.falhas ? `<span class="flag">${erros + v.falhas} ${erros + v.falhas === 1 ? 'pendência' : 'pendências'}</span>` : ''}</div>
        </div>
        <div class="item-n"><strong>${fmt.int(T(r.dados.rol_atual))}</strong><span>membros</span></div>
        ${ic('seta', 'chev')}
      </a>`;
    }).join('');
    return {
      title: 'Igrejas', sub: `${rels.length} relatórios · ${S.ano}`,
      body: `${Data.podeEnviar() ? `<a class="btn primary" href="#/enviar">${ic('enviar')}Enviar relatório</a>` : ''}
        <label class="busca">${ic('busca')}<input type="search" id="q" placeholder="Buscar igreja ou cidade" autocomplete="off"></label>
        <div class="lista" id="lista">${itens}</div><p class="vazio" id="nada" hidden>Nenhuma igreja encontrada.</p>`,
      after: () => {
        const q = document.getElementById('q');
        q.addEventListener('input', () => {
          const t = q.value.trim().toLowerCase(); let n = 0;
          document.querySelectorAll('#lista .item').forEach((el) => { const ok = el.dataset.busca.includes(t); el.hidden = !ok; if (ok) n++; });
          document.getElementById('nada').hidden = n > 0;
        });
      },
    };
  }

  // ---------- Envio de relatório ----------
  const STATUS_ENVIO = {
    recebido: { label: 'Recebido · aguardando leitura', cls: 'warning', icon: '↓' },
    em_processamento: { label: 'Em processamento', cls: 'warning', icon: '⋯' },
    processado: { label: 'Lido · enviado para conferência', cls: 'good', icon: '✓' },
    rejeitado: { label: 'Rejeitado', cls: 'critical', icon: '!' },
  };
  const chipEnvio = (s) => { const x = STATUS_ENVIO[s] || STATUS_ENVIO.recebido; return `<span class="chip ${x.cls}"><b aria-hidden="true">${x.icon}</b>${x.label}</span>`; };
  const tamanho = (b) => (b >= 1048576 ? (b / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

  function listaEnvios(envios, { igreja = true } = {}) {
    if (!envios.length) return '<p class="vazio">Nenhum arquivo enviado ainda.</p>';
    return `<ul class="envios">${envios.map((e) => `<li>
        <div class="env-m">
          <strong>${esc(e.arquivo_nome)}</strong>
          <span class="muted small">${igreja ? `${esc(e.igrejas?.nome || '')} · ` : ''}Exercício ${e.ano} · ${e.formato.toUpperCase()}${e.tipo_pdf ? ` ${esc(e.tipo_pdf)}` : ''} · ${tamanho(e.tamanho || 0)} · ${fmt.dataHora(e.enviado_em)}</span>
          <div class="item-s">${chipEnvio(e.status)}</div>
        </div>
        <div class="env-a">
          ${e.status === 'recebido' && (e.formato === 'xlsx' || e.tipo_pdf === 'digital') && Data.podeEnviar() ? `<button class="btn" data-ler="${esc(e.id)}">Ler agora</button>` : ''}
          ${e.status === 'recebido' && !(e.formato === 'pdf' && e.tipo_pdf === 'digital') && Data.podeValidar() ? `<a class="btn" href="#/digitar/${esc(e.id)}">Digitar dados</a>` : ''}
          <button class="btn ic-btn" data-baixar="${esc(e.caminho)}" aria-label="Baixar ${esc(e.arquivo_nome)}" title="Baixar arquivo original">${ic('baixar')}</button>
        </div>
      </li>`).join('')}</ul>`;
  }

  function checksHtml(checks) {
    const cls = { ok: 'ok', aviso: 'aviso', erro: 'falha' };
    const sim = { ok: '✓', aviso: '!', erro: '✕' };
    return `<ul class="vfs">${checks.map((c) => `<li class="vf ${cls[c.estado]}"><b aria-hidden="true">${sim[c.estado]}</b>
      <div><span>${esc(c.titulo)}</span>${c.detalhe ? `<small>${esc(c.detalhe)}</small>` : ''}</div></li>`).join('')}</ul>`;
  }

  function telaEnviar(cod) {
    const rep = S.perfil.papel === 'representante';
    const igrejas = [...S.igrejas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const sel = igrejas.find((i) => i.codigo === cod) ? cod : (rep ? S.perfil.igreja_codigo : '');
    const anos = [S.ano + 1, S.ano, S.ano - 1];
    const envios = S.envios.filter((e) => !sel || e.igrejas?.codigo === sel);
    const local = S.modo === 'local';

    const body = `
      <p class="nota top">Envie o relatório estatístico <strong>já preenchido</strong> no modelo oficial, em PDF ou Excel. O sistema confere o arquivo e lê os números automaticamente (PDF digital); a conferência final é feita pela administração do presbitério.</p>
      ${local ? '<div class="banner warning" role="note"><b>!</b><div><strong>Modo local:</strong> a verificação do arquivo funciona, mas o envio só é possível no site publicado.</div></div>' : ''}
      ${card('1. Relatório', `<div class="campos">
          <label class="lbl">Igreja
            ${rep ? `<input type="text" value="${esc(igrejas[0]?.nome || '')}" disabled><input type="hidden" id="env-igreja" value="${esc(sel)}">`
              : `<select id="env-igreja"><option value="">Selecione a igreja…</option>${igrejas.map((i) => `<option value="${esc(i.codigo)}"${i.codigo === sel ? ' selected' : ''}>${esc(i.nome)}</option>`).join('')}</select>`}
          </label>
          <label class="lbl">Exercício
            <select id="env-ano">${anos.map((a) => `<option${a === S.ano ? ' selected' : ''}>${a}</option>`).join('')}</select>
          </label>
        </div>`)}
      ${card('2. Arquivo', `<label class="drop" id="drop">
          <input type="file" id="env-arq" accept=".pdf,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
          ${ic('enviar')}<strong id="drop-t">Escolher arquivo</strong><span class="muted small" id="drop-s">PDF ou Excel (.xlsx) · até 10 MB</span>
        </label>`)}
      <section class="card" id="verif" hidden>
        <header class="card-h"><h2>3. Verificação</h2><p id="verif-s">Analisando o arquivo…</p></header>
        <div id="verif-l"></div>
        <label class="conf"><input type="checkbox" id="env-conf"> Confirmo que este é o relatório oficial aprovado pelo Conselho da igreja.</label>
        <button class="btn primary wide" id="env-btn" disabled>${ic('enviar')}Enviar relatório</button>
      </section>
      ${card('Envios anteriores', listaEnvios(envios, { igreja: !sel }), { sub: sel ? esc(igrejas.find((i) => i.codigo === sel)?.nome || '') : 'Todas as igrejas' })}`;

    return {
      title: 'Enviar relatório', sub: rep ? esc(igrejas[0]?.nome || '') : `${esc(S.presbiterio?.sigla || '')} · envio de relatórios`,
      back: rep ? null : (sel ? `#/igreja/${sel}` : '#/igrejas'),
      body,
      after: () => ligarEnvio(),
    };
  }

  function ligarEnvio() {
    const $ig = document.getElementById('env-igreja'), $ano = document.getElementById('env-ano');
    const $arq = document.getElementById('env-arq'), $conf = document.getElementById('env-conf'), $btn = document.getElementById('env-btn');
    const $verif = document.getElementById('verif'), $lista = document.getElementById('verif-l'), $res = document.getElementById('verif-s');
    let analise = null, rodada = 0;

    const atualizarBotao = () => { $btn.disabled = !(analise && !analise.bloqueia && $ig.value && $conf.checked); };

    async function analisar() {
      const file = $arq.files[0];
      if (!file) return;
      document.getElementById('drop-t').textContent = file.name;
      document.getElementById('drop-s').textContent = tamanho(file.size) + ' · toque para trocar';
      $verif.hidden = false; $lista.innerHTML = '<div class="carregando dark"><span class="spin"></span>Analisando…</div>'; $res.textContent = 'Analisando o arquivo…';
      analise = null; atualizarBotao();
      const minha = ++rodada;
      const igreja = S.igrejas.find((i) => i.codigo === $ig.value) || { nome: '' };
      try {
        const a = await Envio.analisar(file, { igreja, ano: +$ano.value, siglas: { sinodo: S.sinodo?.sigla, presbiterio: S.presbiterio?.sigla } });
        if (minha !== rodada) return;
        if (!$ig.value) { a.checks.unshift({ estado: 'erro', titulo: 'Igreja', detalhe: 'Selecione a igreja do relatório.' }); }
        if (a.sha256 && $ig.value) {
          const dup = await Data.envioExiste($ig.value, +$ano.value, a.sha256);
          if (dup) { a.checks.push({ estado: 'erro', titulo: 'Arquivo já enviado', detalhe: `Este mesmo arquivo foi enviado em ${fmt.dataHora(dup.enviado_em)}.` }); a.bloqueia = true; }
          else a.checks.push({ estado: 'ok', titulo: 'Arquivo novo', detalhe: 'Nenhum envio idêntico para esta igreja e exercício.' });
        }
        analise = a;
        const erros = a.checks.filter((c) => c.estado === 'erro').length, avisos = a.checks.filter((c) => c.estado === 'aviso').length;
        $res.textContent = erros ? `${erros} problema(s) impedem o envio` : avisos ? `Pode enviar · ${avisos} aviso(s) para a conferência` : 'Tudo certo para enviar';
        $lista.innerHTML = checksHtml(a.checks);
      } catch (e) {
        $lista.innerHTML = `<p class="erro">Não foi possível analisar: ${esc(e.message)}</p>`;
      }
      atualizarBotao();
    }

    $arq.addEventListener('change', analisar);
    $ig.addEventListener?.('change', analisar);
    $ano.addEventListener('change', analisar);
    $conf.addEventListener('change', atualizarBotao);
    $btn.addEventListener('click', async () => {
      if (!analise || analise.bloqueia) return;
      $btn.disabled = true; $btn.innerHTML = '<span class="spin"></span>Enviando…';
      try {
        const { lido } = await Data.enviarRelatorio({ codigo: $ig.value, ano: +$ano.value, file: $arq.files[0], analise });
        toast(lido ? 'Relatório enviado e lido. Os números já aparecem no painel, aguardando conferência.' : 'Relatório enviado. A administração fará a leitura e a conferência.');
        rota();
      } catch (e) {
        toast(e.message); $btn.innerHTML = `${ic('enviar')}Enviar relatório`; atualizarBotao();
      }
    });
  }

  // ---------- Igreja ----------
  const ABAS = [['geral', 'Visão geral'], ['membresia', 'Membresia'], ['educacao', 'Educação'], ['financas', 'Finanças'], ['ministerio', 'Ministério'], ['conferencia', 'Conferência']];
  const formatoTxt = (r) => (r.tipo_pdf ? `PDF ${r.tipo_pdf}` : /\.xlsx$/i.test(r.arquivo || '') ? 'Excel' : 'arquivo');

  // Vida ministerial e administração: aba "Conselho ou Mesa" (só existe em relatórios enviados em Excel)
  const MIN_ITENS = {
    ceia: [['ceia_grupos', 'Ceias em grupo'], ['ceia_individuos', 'Ceias a indivíduos'], ['ceia_total', 'Total']],
    evang: [['atividades_evangelisticas', 'Atividades evangelísticas'], ['biblias', 'Bíblias'], ['novos_testamentos', 'Novos Testamentos'], ['folhetos', 'Folhetos'], ['outras_literaturas', 'Outras literaturas'], ['textos_total', 'Textos (total)']],
    educ: [['grupos_corais', 'Grupos corais'], ['conjuntos_musicais', 'Conjuntos musicais'], ['discipulados', 'Discipulados']],
    social: [['atos_beneficentes_junta', 'Atos da Junta Diaconal'], ['atos_beneficentes_outros', 'Atos de outros deptos.'], ['atos_beneficentes_total', 'Atos (total)'],
      ['visitas_oficiais', 'Visitas de oficiais'], ['visitas_outros', 'Visitas de outros deptos.'], ['visitas_total', 'Visitas (total)']],
    adm: [['reunioes_conselho', 'Reuniões do Conselho'], ['reunioes_junta', 'Reuniões da Junta'], ['reunioes_assembleia', 'Assembleias'], ['reunioes_exame_contas', 'Exame de contas'],
      ['mandato_vencer_presbiteros', 'Presbíteros c/ mandato a vencer'], ['mandato_vencer_diaconos', 'Diáconos c/ mandato a vencer']],
  };
  function telaMinisterio(r) {
    const m = r.dados.conselho;
    if (!m) {
      return card('Vida ministerial e administração', `<p>Estes dados vêm da aba <strong>“Conselho ou Mesa”</strong> do relatório em Excel.
        ${/\.xlsx$/i.test(r.arquivo || '') ? 'Nesta planilha essa aba está vazia.' : 'Este relatório foi recebido em PDF, que traz apenas o Cadastro & Estatística.'}</p>
        <p class="nota">Para ver Santa Ceia, evangelização, visitas, reuniões e planejamento, envie o relatório completo em Excel (.xlsx).</p>`);
    }
    const mini = (bloco, itens) => `<div class="mini">${itens.map(([k, l]) => `<div><strong>${fmt.int(bloco[k])}</strong><span>${l}</span></div>`).join('')}</div>`;
    const textos = (bloco, itens) => { const dl = itens.filter(([k]) => bloco[k]).map(([k, l]) => `<dt>${l}</dt><dd>${esc(bloco[k])}</dd>`).join(''); return dl ? `<dl class="dl">${dl}</dl>` : ''; };
    const fonte = `${ic('arquivo')} Fonte: ${esc(r.arquivo)} · aba “Conselho ou Mesa”`;
    const cg = r.dados.congregacao_anexo;
    return `
      <div class="kpis k4">
        ${kpi('Celebrações da Santa Ceia', fmt.int(m.ceia_total))}
        ${kpi('Atividades evangelísticas', fmt.int(m.atividades_evangelisticas))}
        ${kpi('Visitas', fmt.int(m.visitas_total))}
        ${kpi('Atos beneficentes', fmt.int(m.atos_beneficentes_total))}
      </div>
      ${card('Adoração e comunhão', mini(m, MIN_ITENS.ceia), { fonte })}
      ${card('Evangelização e missões', mini(m, MIN_ITENS.evang) + textos(m, [['outra_participacao_missionaria', 'Outra participação missionária']]), { fonte })}
      ${card('Educação e música', mini(m, MIN_ITENS.educ), { fonte })}
      ${card('Ação social e visitação', mini(m, MIN_ITENS.social), { fonte })}
      ${card('Administração', mini(m, MIN_ITENS.adm) + textos(m, [['conselheiros_sociedades', 'Conselheiros das sociedades'], ['causas_extralocais', 'Causas extralocais'],
        ['reforma_projeto', 'Reforma/construção em projeto'], ['reforma_andamento', 'Reforma/construção em andamento']]), { fonte })}
      ${textos(m, [['objetivos_alcancados', 'Objetivos alcançados'], ['objetivos_nao_alcancados', 'Objetivos não alcançados e dificuldades']]) ? card('Planejamento estratégico',
        textos(m, [['objetivos_alcancados', 'Objetivos alcançados'], ['objetivos_nao_alcancados', 'Objetivos não alcançados e dificuldades']]), { fonte }) : ''}
      ${cg ? card(`Congregação${cg.nome ? `: ${esc(cg.nome)}` : ''}`, mini(cg, [...MIN_ITENS.ceia.slice(2), ['atividades_evangelisticas', 'Atividades evangelísticas'], ['visitas_total', 'Visitas'], ['atos_beneficentes_total', 'Atos beneficentes']]),
        { sub: 'Anexo “Congregação” — mostrado à parte e não somado aos totais da igreja, para não contar duas vezes' }) : ''}
      <p class="nota">As perguntas Sim/Não do relatório (documentação, previdência, seguro, planejamento) são caixas de seleção no Excel e ainda não são lidas automaticamente.</p>`;
  }

  function telaIgreja(cod, aba = 'geral') {
    const r = relPorCodigo(cod);
    if (!r) return { title: 'Igreja não encontrada', body: card('', '<p>Este relatório não existe ou você não tem acesso a ele.</p>'), back: '#/igrejas' };
    const d = r.dados;
    const v = contaVerif(r);
    const pend = r.alertas.length + v.falhas;
    const abas = ABAS.map(([id, l]) => `<a href="#/igreja/${cod}/${id}" class="${id === aba ? 'on' : ''}"${id === aba ? ' aria-current="page"' : ''}>${l}${id === 'conferencia' && pend ? ` <span class="badge">${pend}</span>` : ''}</a>`).join('');
    const fonte = (sec) => `${ic('arquivo')} Fonte: ${esc(r.arquivo)} · ${sec}`;

    let corpo = '';
    if (aba === 'geral') {
      const comV = Regras.variacao([r], () => T(d.comungantes?.ano_anterior), () => T(d.comungantes?.ano_atual));
      const ncV = Regras.variacao([r], () => T(d.nao_comungantes?.ano_anterior), () => T(d.nao_comungantes?.ano_atual));
      const edV = Regras.variacao([r], () => d.estrutura?.alunos_ed_anterior, () => d.estrutura?.alunos_ed_atual);
      const fr = d.financeiro?.realizado || {};
      corpo = `
        <div class="kpis">
          ${kpi('Rol de membros', fmt.int(T(d.rol_atual)))}
          ${kpi('Comungantes', fmt.int(T(d.comungantes?.ano_atual)), delta(comV))}
          ${kpi('Não comungantes', fmt.int(T(d.nao_comungantes?.ano_atual)), delta(ncV))}
          ${kpi('Alunos na Escola Dominical', fmt.int(d.estrutura?.alunos_ed_atual), delta(edV))}
          ${kpi('Receita anual realizada', fmt.brlCurto(fr.total_receita))}
          ${kpi('Despesa anual realizada', fmt.brlCurto(fr.total_despesa))}
        </div>
        ${card('Liderança formal', `<div class="mini">${Regras.LIDERANCA.map(([k, l]) => `<div><strong>${fmt.int(d.lideranca?.[k])}</strong><span>${l}</span></div>`).join('')}</div>`, { fonte: fonte('pág. 1 · seção II') })}
        ${card('Estrutura do trabalho', `<div class="mini">
          <div><strong>${fmt.int(d.estrutura?.congregacoes)}</strong><span>Congregações</span></div>
          <div><strong>${fmt.int(d.estrutura?.pontos_pregacao)}</strong><span>Pontos de pregação</span></div>
          <div><strong>${fmt.int(d.estrutura?.escolas_dominicais)}</strong><span>Escolas dominicais</span></div>
          <div><strong>${fmt.int(d.departamentos?.totais?.[0])}</strong><span>Departamentos internos</span></div>
        </div>`, { fonte: fonte('pág. 1 · seção II') })}`;
    } else if (aba === 'membresia') {
      const c = d.comungantes || {}, nc = d.nao_comungantes || {};
      corpo = `
        ${card('Rol atual', `<div class="sexos">${Charts.sexo(c.ano_atual, 'Comungantes')}${Charts.sexo(nc.ano_atual, 'Não comungantes')}${Charts.sexo(d.rol_atual, 'Rol total')}</div>`, { fonte: fonte('pág. 1 · seção III') })}
        ${card('Evolução no exercício', tabelaEvolucao(c, nc))}
        ${card('Movimentação — comungantes', tabelaMov(c), { fonte: fonte('pág. 1 · seção III') })}
        ${card('Movimentação — não comungantes', tabelaMov(nc), { fonte: fonte('pág. 1 · seção III') })}`;
    } else if (aba === 'educacao') {
      const e = d.estrutura || {};
      const edV = Regras.variacao([r], () => e.alunos_ed_anterior, () => e.alunos_ed_atual);
      const razao = temValor(e.alunos_ed_atual) && e.professores_ed ? e.alunos_ed_atual / e.professores_ed : null;
      const deps = Regras.DEPARTAMENTOS.map(([k, l]) => ({ label: l, value: d.departamentos?.[k]?.[1] ?? null, n: d.departamentos?.[k]?.[0] ?? null }));
      corpo = `
        <div class="kpis k4">
          ${kpi('Alunos (ano atual)', fmt.int(e.alunos_ed_atual), delta(edV))}
          ${kpi('Alunos (ano anterior)', fmt.int(e.alunos_ed_anterior))}
          ${kpi('Professores', fmt.int(e.professores_ed))}
          ${kpi('Alunos por professor', temValor(razao) ? razao.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—')}
        </div>
        ${card('Membros nas sociedades internas', Charts.barras(deps.map((x) => ({ label: x.label, value: x.value, tip: `${x.label}: ${fmt.int(x.value)} membros · ${fmt.int(x.n)} departamento(s)` })), { fmt: fmt.int }),
          { sub: `Total informado: ${fmt.int(d.departamentos?.totais?.[1])} membros em ${fmt.int(d.departamentos?.totais?.[0])} departamentos`, fonte: fonte('pág. 1 · seção II') })}`;
    } else if (aba === 'financas') {
      const fr = d.financeiro?.realizado || {}, fp = d.financeiro?.previsto || {};
      const compo = [...Regras.COMPOSICAO_DESPESA.map(([k, l], i) => ({ label: l, value: fr[k], slot: i + 1 }))];
      const nomeadas = new Set(Regras.COMPOSICAO_DESPESA.map(([k]) => k));
      compo.push({ label: 'Demais despesas', value: Regras.somaCampos(fr, Regras.DESPESAS.filter(([k]) => !nomeadas.has(k))) || 0, slot: null });
      corpo = `
        <div class="kpis k4">
          ${kpi('Receita realizada', fmt.brlCurto(fr.total_receita))}
          ${kpi('Despesa realizada', fmt.brlCurto(fr.total_despesa))}
          ${kpi('Saldo final realizado', fmt.brlCurto(fr.saldo_seguinte))}
          ${kpi('Receita prevista', fmt.brlCurto(fp.total_receita))}
        </div>
        ${card('Composição das despesas realizadas', Charts.composicao(compo, { fmt: fmt.brlCurto, rotuloTotal: 'Total das despesas' }), { fonte: fonte('pág. 2 · seção IV') })}
        ${card('Realizado × previsto', tabelaFin(fr, fp), { sub: 'Realizado = movimento financeiro informado · Previsto = previsão orçamentária do próximo exercício', fonte: fonte('pág. 2 · seção IV') })}`;
    } else if (aba === 'ministerio') {
      corpo = telaMinisterio(r);
    } else {
      corpo = telaConferencia(r);
    }

    const head = `<section class="card ig-head">
        <div class="ig-top">${chip(r.status)}<span class="muted">${esc(r.igreja.codigo)}</span></div>
        <p class="muted">${esc(r.igreja.cidade)} · ${esc(r.igreja.uf)} · organizada em ${fmt.data(r.igreja.organizacao)}</p>
        <p class="muted small">${ic('arquivo')} ${esc(r.arquivo)} · ${esc(formatoTxt(r))} · ${esc(r.modelo || 'modelo não identificado')}</p>
        ${Data.podeEnviar() ? `<a class="btn ig-env" href="#/enviar/${esc(cod)}">${ic('enviar')}Enviar novo relatório</a>` : ''}
      </section>
      <nav class="tabs" aria-label="Seções">${abas}</nav>`;

    return {
      title: esc(r.igreja.nome), sub: `Relatório ${r.ano}`,
      back: S.perfil.papel === 'representante' ? null : '#/igrejas',
      body: head + corpo,
      after: () => ligarConferencia(r),
    };
  }

  const cel = (v) => (temValor(v) ? fmt.int(v) : '<span class="na" title="Não informado">—</span>');

  function tabelaMov(bloco) {
    const linhas = (grupo, titulo) => {
      const ent = Object.entries(bloco?.[grupo] || {}).filter(([, v]) => Array.isArray(v));
      if (!ent.length) return '';
      return `<tr class="grp"><th colspan="4">${titulo}</th></tr>` + ent.map(([k, v]) => `<tr${Regras.DETALHE.has(k) ? ' class="det"' : ''}><td>${esc(Regras.ROTULOS[k] || k)}</td><td>${cel(v[0])}</td><td>${cel(v[1])}</td><td><strong>${cel(v[2])}</strong></td></tr>`).join('');
    };
    return `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Movimento</th><th>Masc.</th><th>Fem.</th><th>Total</th></tr></thead>
      <tbody>${linhas('admissao', 'Admissões')}${linhas('demissao', 'Demissões')}
        ${bloco?.rol_separado ? `<tr class="grp"><th colspan="4">Outros</th></tr><tr><td>Rol separado</td><td>${cel(bloco.rol_separado[0])}</td><td>${cel(bloco.rol_separado[1])}</td><td><strong>${cel(bloco.rol_separado[2])}</strong></td></tr>` : ''}
      </tbody></table></div>
      <p class="legenda"><span class="na">—</span> não informado no relatório · 0 informado como zero</p>`;
  }

  function tabelaEvolucao(c, nc) {
    const linha = (nome, b) => `<tr><td>${nome}</td><td>${cel(T(b.ano_anterior))}</td><td>${cel(T(b.diferenca))}</td><td><strong>${cel(T(b.ano_atual))}</strong></td></tr>`;
    return `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th></th><th>Ano anterior</th><th>Diferença</th><th>Ano atual</th></tr></thead>
      <tbody>${linha('Comungantes', c)}${linha('Não comungantes', nc)}</tbody></table></div>`;
  }

  function tabelaFin(fr, fp) {
    const brl = (v) => (temValor(v) ? fmt.brl(v) : '<span class="na" title="Não informado">—</span>');
    const linha = (l, k, forte) => `<tr${forte ? ' class="tot"' : ''}><td>${l}</td><td>${brl(fr[k])}</td><td>${brl(fp[k])}</td></tr>`;
    return `<div class="tbl-wrap"><table class="tbl fin">
      <thead><tr><th>Item</th><th>Realizado</th><th>Previsto</th></tr></thead>
      <tbody>
        ${linha('Saldo anterior', 'saldo_anterior', true)}
        <tr class="grp"><th colspan="3">Receitas</th></tr>
        ${Regras.RECEITAS.map(([k, l]) => linha(l, k)).join('')}
        ${linha('Total da receita anual', 'total_receita', true)}
        ${linha('Grande total', 'grande_total', true)}
        <tr class="grp"><th colspan="3">Despesas</th></tr>
        ${Regras.DESPESAS.map(([k, l]) => linha(l, k)).join('')}
        ${linha('Total da despesa anual', 'total_despesa', true)}
        ${linha('Saldo para o ano seguinte', 'saldo_seguinte', true)}
      </tbody></table></div>`;
  }

  // ---------- Digitação / correção manual ----------
  const ESTRUTURA_ED = [['congregacoes', 'Congregações'], ['pontos_pregacao', 'Pontos de pregação'], ['escolas_dominicais', 'Escolas dominicais'],
    ['professores_ed', 'Professores da ED'], ['alunos_ed_atual', 'Alunos da ED (ano atual)'], ['alunos_ed_anterior', 'Alunos da ED (ano anterior)']];
  const MOV_ED = {
    comungantes: {
      admissao: ['profissao_fe', 'profissao_fe_batismo', 'transferencia', 'jurisdicao', 'restauracao', 'designacao_presbiterio'],
      demissao: ['transferencia', 'falecimento', 'exclusao', 'ordenacao'],
      totais: [['rol_separado', 'Rol separado'], ['diferenca', 'Diferença (admissões − demissões)'], ['ano_anterior', 'Ano anterior'], ['ano_atual', 'Ano atual']],
    },
    nao_comungantes: {
      admissao: ['batismo', 'transferencia', 'jurisdicao_ex_officio'],
      demissao: ['profissao_fe', 'transferencia', 'falecimento', 'exclusao'],
      totais: [['diferenca', 'Diferença (admissões − demissões)'], ['ano_anterior', 'Ano anterior'], ['ano_atual', 'Ano atual']],
    },
  };
  const DADOS_VAZIOS = () => ({ lideranca: {}, estrutura: {}, departamentos: {}, comungantes: { admissao: {}, demissao: {} },
    nao_comungantes: { admissao: {}, demissao: {} }, financeiro: { realizado: {}, previsto: {} } });
  const obter = (o, path) => path.reduce((x, k) => (x == null ? undefined : x[k]), o);
  const definir = (o, path, v) => { const pai = path.slice(0, -1).reduce((x, k) => (x[k] && typeof x[k] === 'object' ? x[k] : (x[k] = {})), o); pai[path[path.length - 1]] = v; };

  function campoEd(path, i, v, rot, tipo = 'int') {
    const txt = temValor(v) ? (tipo === 'int' ? String(v) : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '';
    // Diferenças e saldos podem ser negativos: teclado completo (o numérico do celular não tem "−")
    const neg = /diferenca|saldo/.test(path);
    return `<input class="ed-in${tipo === 'brl' ? ' brl' : ''}" data-p="${path}"${i != null ? ` data-i="${i}"` : ''} data-r="${esc(rot)}" value="${txt}"
      inputmode="${neg ? 'text' : tipo === 'brl' ? 'decimal' : 'numeric'}" autocomplete="off" aria-label="${esc(rot)}">`;
  }

  function edLista(sec, lista, d) {
    return `<div class="tbl-wrap"><table class="tbl ed"><tbody>${lista.map(([k, l]) => `<tr><td>${l}</td><td>${campoEd(`${sec}.${k}`, null, d?.[k], l)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function edDepartamentos(d) {
    const linhas = [...Regras.DEPARTAMENTOS, ['totais', 'Totais']];
    return `<div class="tbl-wrap"><table class="tbl ed"><thead><tr><th>Departamento</th><th>Nº deptos.</th><th>Nº membros</th></tr></thead><tbody>
      ${linhas.map(([k, l]) => `<tr${k === 'totais' ? ' class="tot"' : ''}><td>${l}</td>${[0, 1].map((i) => `<td>${campoEd(`departamentos.${k}`, i, d?.[k]?.[i], `${l} · ${i ? 'membros' : 'deptos.'}`)}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>`;
  }

  function edTrio(sec, d, rol) {
    const nome = sec === 'comungantes' ? 'Comungantes' : 'Não comungantes';
    const linha = (path, l, v, cls = '') => `<tr${cls ? ` class="${cls}"` : ''}><td>${esc(l)}</td>${[0, 1, 2].map((i) => `<td>${campoEd(path, i, v?.[i], `${nome} · ${l} · ${['masc.', 'fem.', 'total'][i]}`)}</td>`).join('')}</tr>`;
    const grupo = (g, titulo) => {
      // linhas do modelo + linhas extras que o documento trouxe (formulários alterados)
      const chaves = [...new Set([...MOV_ED[sec][g], ...Object.keys(d?.[g] || {}).filter((k) => Array.isArray(d[g][k]))])];
      return `<tr class="grp"><th colspan="4">${titulo}</th></tr>` + chaves.map((k) => linha(`${sec}.${g}.${k}`, Regras.ROTULOS[k] || k, d?.[g]?.[k], Regras.DETALHE.has(k) ? 'det' : '')).join('');
    };
    return `<div class="tbl-wrap"><table class="tbl ed"><thead><tr><th>Movimento</th><th>Masc.</th><th>Fem.</th><th>Total</th></tr></thead><tbody>
      ${grupo('admissao', 'Admissões')}${grupo('demissao', 'Demissões')}
      <tr class="grp"><th colspan="4">Totais</th></tr>${MOV_ED[sec].totais.map(([k, l]) => linha(`${sec}.${k}`, l, d?.[k], k === 'ano_atual' ? 'tot' : '')).join('')}
      ${sec === 'nao_comungantes' ? `<tr class="grp"><th colspan="4">Rol atual (comungantes + não comungantes)</th></tr>${linha('rol_atual', 'Rol atual', rol, 'tot')}` : ''}
      </tbody></table></div>`;
  }

  function edFinancas(fin) {
    const linha = (k, l, forte) => `<tr${forte ? ' class="tot"' : ''}><td>${l}</td>${['realizado', 'previsto'].map((lado) => `<td>${campoEd(`financeiro.${lado}.${k}`, null, fin?.[lado]?.[k], `${l} · ${lado}`, 'brl')}</td>`).join('')}</tr>`;
    return `<div class="tbl-wrap"><table class="tbl ed fin"><thead><tr><th>Item (R$)</th><th>Realizado</th><th>Previsto</th></tr></thead><tbody>
      ${linha('saldo_anterior', 'Saldo anterior', true)}
      <tr class="grp"><th colspan="3">Receitas</th></tr>${Regras.RECEITAS.map(([k, l]) => linha(k, l)).join('')}
      ${linha('total_receita', 'Total da receita anual', true)}${linha('grande_total', 'Grande total', true)}
      <tr class="grp"><th colspan="3">Despesas</th></tr>${Regras.DESPESAS.map(([k, l]) => linha(k, l)).join('')}
      ${linha('total_despesa', 'Total da despesa anual', true)}${linha('saldo_seguinte', 'Saldo para o ano seguinte', true)}
      </tbody></table></div>`;
  }

  // Lê o formulário: devolve os dados novos, as alterações (de → para) e os campos inválidos
  function coletarEd(base) {
    const d = JSON.parse(JSON.stringify(base));
    const alteracoes = [], invalidos = [], arrays = new Map();
    let preenchidos = 0;
    $app.querySelectorAll('.ed-in').forEach((el) => {
      const txt = el.value.trim();
      const v = txt === '' ? null : Leitura.numero(txt);
      const valido = txt === '' || v !== null;
      el.classList.toggle('inv', !valido);
      if (!valido) { invalidos.push(el.dataset.r); return; }
      if (v !== null) preenchidos++;
      const path = el.dataset.p.split('.');
      const orig = obter(base, path);
      const antes = el.dataset.i != null ? (Array.isArray(orig) ? orig[+el.dataset.i] : undefined) : orig;
      const mudou = (antes ?? null) === null ? v !== null : v === null || Math.abs(antes - v) > 0.004;
      el.classList.toggle('mud', mudou);
      if (mudou) alteracoes.push({ campo: el.dataset.r, de: antes ?? null, para: v });
      if (el.dataset.i != null) {
        if (!arrays.has(el.dataset.p)) arrays.set(el.dataset.p, { path, orig, vals: [], els: [] });
        const a = arrays.get(el.dataset.p); a.vals[+el.dataset.i] = v; a.els[+el.dataset.i] = el;
      } else if (orig !== undefined || v !== null) definir(d, path, v);
    });
    for (const a of arrays.values()) {
      const n = a.path[0] === 'departamentos' ? 2 : 3;
      const vals = Array.from({ length: n }, (_, i) => a.vals[i] ?? null);
      if (a.orig !== undefined || vals.some((x) => x !== null)) definir(d, a.path, vals);
      // masc. + fem. ≠ total: destaca o total para conferência
      if (n === 3 && a.els[2]) a.els[2].classList.toggle('inc', vals.every((x) => x !== null) && vals[0] + vals[1] !== vals[2]);
    }
    return { dados: d, alteracoes, invalidos, preenchidos };
  }

  function telaEditar({ r = null, envio = null }) {
    const igreja = r ? r.igreja : (S.igrejas.find((i) => i.codigo === envio.igrejas?.codigo) || envio.igrejas);
    const base = r ? r.dados : DADOS_VAZIOS();
    const arquivo = envio || S.envios.find((e) => e.relatorio_id === r.id) || S.envios.find((e) => e.igrejas?.codigo === igreja.codigo);
    const voltar = r ? `#/igreja/${igreja.codigo}/conferencia` : '#/pendencias';
    const body = `
      <p class="nota top">${r ? 'Corrija os valores que foram lidos errado.' : `Digite os valores do relatório a partir do arquivo <strong>${esc(envio.arquivo_nome)}</strong>.`}
        Campo vazio significa <strong>não informado</strong> (diferente de zero). As somas são refeitas enquanto você digita; ${r ? 'a correção fica registrada no histórico, com o valor anterior, e' : ''} o relatório vai para conferência.</p>
      ${arquivo ? `<button class="btn wide" data-baixar="${esc(arquivo.caminho)}">${ic('arquivo')}Abrir o arquivo enviado (${esc(arquivo.arquivo_nome)})</button>` : ''}
      <div class="ed-bar" role="status"><span id="ed-st">—</span><button class="btn primary" id="ed-salvar" disabled>Salvar</button></div>
      ${card('Liderança formal', edLista('lideranca', Regras.LIDERANCA, base.lideranca))}
      ${card('Estrutura do trabalho', edLista('estrutura', ESTRUTURA_ED, base.estrutura))}
      ${card('Departamentos internos', edDepartamentos(base.departamentos))}
      ${card('Comungantes', edTrio('comungantes', base.comungantes))}
      ${card('Não comungantes', edTrio('nao_comungantes', base.nao_comungantes, base.rol_atual))}
      ${card('Informações financeiras', edFinancas(base.financeiro), { sub: 'Valores em reais, no formato 1.234,56' })}
      <section class="card" id="ed-verif"></section>
      ${r ? card('Motivo da correção', '<label class="lbl">Comentário (opcional)<textarea id="ed-coment" rows="2" placeholder="Ex.: valor de dízimos lido errado; conferido no PDF"></textarea></label>') : ''}`;

    return {
      title: r ? 'Corrigir dados' : 'Digitar dados', sub: esc(igreja?.nome || ''), back: voltar, body,
      after: () => {
        const $st = document.getElementById('ed-st'), $btn = document.getElementById('ed-salvar');
        let atual = null;
        const atualizar = () => {
          atual = coletarEd(base);
          const verif = Regras.verificacoes(atual.dados);
          const falhas = verif.filter((x) => x.ok === false).length, conferidas = verif.filter((x) => x.ok !== null).length;
          document.getElementById('ed-verif').innerHTML = `<header class="card-h"><h2>Verificações</h2><p>${falhas ? `${falhas} divergência(s)` : conferidas ? 'Todas as somas verificáveis conferem' : 'Preencha os campos para conferir as somas'}</p></header><ul class="vfs">${vfItens(verif)}</ul>`;
          const n = r ? atual.alteracoes.length : atual.preenchidos;
          $st.innerHTML = atual.invalidos.length ? `<b class="ed-err">${atual.invalidos.length} valor(es) inválido(s)</b>`
            : `${r ? `${n} alteração(ões)` : `${n} campo(s) preenchido(s)`} · ${falhas ? `<b class="ed-err">${falhas} soma(s) com divergência</b>` : `${conferidas} soma(s) conferem`}`;
          $btn.disabled = !!atual.invalidos.length || !n;
        };
        $app.querySelectorAll('.ed-in').forEach((el) => el.addEventListener('input', atualizar));
        atualizar();
        $btn.addEventListener('click', async () => {
          atualizar();
          if ($btn.disabled) return;
          $btn.disabled = true; $btn.innerHTML = '<span class="spin"></span>Salvando…';
          try {
            if (r) await Data.corrigirRelatorio(r.id, atual.dados, atual.alteracoes, document.getElementById('ed-coment')?.value.trim());
            else await Data.digitarEnvio(envio, atual.dados);
            toast(r ? 'Correção salva. O relatório voltou para conferência.' : 'Dados salvos. O relatório está aguardando conferência.');
            location.hash = `#/igreja/${igreja.codigo}/conferencia`;
          } catch (e) { toast('Não foi possível salvar: ' + e.message); $btn.textContent = 'Salvar'; $btn.disabled = false; }
        });
      },
    };
  }

  // ---------- Conferência de um relatório ----------
  const vfItens = (verif) => {
    const val = (x, v) => (x.moeda ? fmt.brl(v) : fmt.int(v));
    return verif.map((x) => `<li class="vf ${x.ok === true ? 'ok' : x.ok === false ? 'falha' : 'na'}">
        <b aria-hidden="true">${x.ok === true ? '✓' : x.ok === false ? '✕' : '–'}</b>
        <div><span>${esc(x.titulo)}</span>
        ${x.ok === false ? `<small>Calculado: <strong>${val(x, x.esperado)}</strong> · Informado: <strong>${val(x, x.informado)}</strong></small>` : ''}
        ${x.ok === null ? '<small>Não verificável — campo não informado</small>' : ''}</div></li>`).join('');
  };

  function telaConferencia(r) {
    const verif = Regras.verificacoes(r.dados);
    const falhas = verif.filter((x) => x.ok === false);
    const linhasVerif = vfItens(verif);
    const alertas = r.alertas.length
      ? r.alertas.map((a) => `<li class="al al-${a.nivel}"><span class="chip ${a.nivel === 'erro' ? 'critical' : 'warning'}"><b aria-hidden="true">${a.nivel === 'erro' ? '!' : 'i'}</b>${a.nivel === 'erro' ? 'Erro' : 'Aviso'}</span><p>${esc(a.msg)}</p><code>${esc(a.campo)}</code></li>`).join('')
      : '<p class="vazio">Nenhum alerta registrado na leitura do documento.</p>';
    const hist = r.historico.slice().reverse().map((h) => `<li><span>${chip(h.status)}</span><div>${h.comentario ? esc(h.comentario) : ''}<small>${fmt.dataHora(h.criado_em)}</small></div></li>`).join('');
    const acoes = Data.podeValidar() ? `<section class="card acoes">
        <header class="card-h"><h2>Decisão da administração</h2><p>A decisão fica registrada no histórico do relatório.</p></header>
        <label class="lbl">Comentário (obrigatório para solicitar correção)<textarea id="coment" rows="3" placeholder="Ex.: conferir o rol de não comungantes"></textarea></label>
        <div class="btns">
          ${r.status !== 'validado' ? `<button class="btn primary" data-acao="validado">Validar relatório</button>` : ''}
          ${r.status !== 'aguardando_correcao' ? `<button class="btn danger" data-acao="aguardando_correcao">Solicitar correção</button>` : ''}
          ${r.status !== 'aguardando_conferencia' ? `<button class="btn" data-acao="aguardando_conferencia">Voltar para conferência</button>` : ''}
          <a class="btn" href="#/editar/${esc(r.igreja.codigo)}">Corrigir dados</a>
        </div>
        ${falhas.length && r.status !== 'validado' ? `<p class="small muted">Atenção: há ${falhas.length} verificação(ões) com divergência.</p>` : ''}
      </section>` : '';
    return `${acoes}
      ${card('Verificações automáticas', `<ul class="vfs">${linhasVerif}</ul>`, { sub: `${falhas.length ? `${falhas.length} divergência(s) encontrada(s)` : 'Todas as somas verificáveis conferem'} · recalculado a partir dos valores extraídos` })}
      ${card('Alertas da leitura do documento', `<ul class="als">${alertas}</ul>`)}
      ${card('Origem dos dados', `<dl class="dl">
          <dt>Documento</dt><dd>${esc(r.arquivo)}</dd>
          <dt>Formato</dt><dd>${esc(formatoTxt(r))}${r.tipo_pdf === 'digitalizado' ? ' (imagem — dados digitados/conferidos manualmente)' : r.tipo_pdf ? ' (texto selecionável)' : ''}</dd>
          <dt>Modelo</dt><dd>${esc(r.modelo || 'não identificado')}</dd>
          ${r.versao ? `<dt>Versão</dt><dd>${r.versao}${r.versao > 1 ? ' (as anteriores ficam no histórico como substituídas)' : ''}</dd>` : ''}
          ${r.tipo_pdf ? `<dt>Página 1</dt><dd>I Identificação · II Estrutura · III Rol de membros</dd>
          <dt>Página 2</dt><dd>IV Informações financeiras · VI Informações finais</dd>`
            : `<dt>Abas lidas</dt><dd>Cadastro & Estatística${r.dados.conselho ? ' · Conselho ou Mesa' : ''}${r.dados.congregacao_anexo ? ' · Congregação' : ''} (células conforme o Dicionário de dados)</dd>`}
          <dt>Extração</dt><dd>${r.extraido_em ? `${fmt.dataHora(r.extraido_em)} · leitura automática` : 'importação inicial'}</dd>
        </dl>`)}
      ${card('Arquivos enviados pelo site', listaEnvios(S.envios.filter((e) => e.igrejas?.codigo === r.igreja.codigo), { igreja: false }))}
      ${card('Histórico', `<ul class="hist">${hist}</ul>`)}`;
  }

  function ligarConferencia(r) {
    $app.querySelectorAll('[data-acao]').forEach((b) => b.addEventListener('click', async () => {
      const status = b.dataset.acao;
      const coment = document.getElementById('coment').value.trim();
      if (status === 'aguardando_correcao' && !coment) { toast('Escreva o que precisa ser corrigido.'); document.getElementById('coment').focus(); return; }
      b.disabled = true;
      try { await Data.definirStatus(r.id, status, coment); toast(`Relatório: ${STATUS[status].label.toLowerCase()}.`); rota(); } catch (e) { b.disabled = false; toast('Não foi possível salvar: ' + e.message); }
    }));
  }

  // ---------- Pendências ----------
  function telaPendencias() {
    const grupos = ORDEM_STATUS.map((s) => [s, S.relatorios.filter((r) => r.status === s)]).filter(([, l]) => l.length);
    const body = grupos.map(([s, lista]) => `<section class="grupo">
        <h2 class="grupo-h">${chip(s)}<span>${lista.length}</span></h2>
        <div class="lista">${lista.map((r) => {
          const v = contaVerif(r);
          const e = r.alertas.filter((a) => a.nivel === 'erro').length, w = r.alertas.length - e;
          return `<a class="item" href="#/igreja/${r.igreja.codigo}/conferencia">
            <div class="item-m"><strong>${esc(r.igreja.nome)}</strong>
              <div class="item-s">
                ${v.falhas ? `<span class="flag crit">${v.falhas} divergência(s) de soma</span>` : `<span class="flag ok">somas conferem</span>`}
                ${e ? `<span class="flag crit">${e} erro(s)</span>` : ''}${w ? `<span class="flag">${w} aviso(s)</span>` : ''}
                ${r.tipo_pdf === 'digitalizado' ? '<span class="flag">PDF digitalizado</span>' : ''}
              </div></div>${ic('seta', 'chev')}</a>`;
        }).join('')}</div></section>`).join('');
    const novos = S.envios.filter((e) => e.status === 'recebido' || e.status === 'em_processamento');
    const blocoEnvios = novos.length ? `<section class="grupo"><h2 class="grupo-h">${chipEnvio('recebido')}<span>${novos.length}</span></h2>
        <div class="card">${listaEnvios(novos)}</div></section>` : '';
    return { title: 'Conferência', sub: `Relatórios ${S.ano}`, body: `<p class="nota top">O sistema recalcula as somas de cada relatório e aponta divergências. A validação final é sempre de um responsável autorizado.</p>${blocoEnvios}${body}` };
  }

  // ---------- Sínodo ----------
  function telaSinodo() {
    const todos = S.relatorios;
    const val = todos.filter((r) => r.status === 'validado');
    const com = Regras.consolidar(val, (r) => T(r.dados.comungantes?.ano_atual));
    const rol = Regras.consolidar(val, (r) => T(r.dados.rol_atual));
    return {
      title: esc(S.sinodo?.nome || 'Sínodo'), sub: `Visão sinodal · ${S.ano}`,
      body: `<nav class="trilha" aria-label="Hierarquia"><span>Igreja Presbiteriana do Brasil</span>${ic('seta')}<span>${esc(S.sinodo?.nome || '')}</span></nav>
        <div class="banner info" role="note"><b>i</b><div><strong>Dados parciais do sínodo.</strong> Apenas 1 presbitério está cadastrado na plataforma. Os totais não representam o sínodo inteiro.</div></div>
        <div class="kpis">
          ${kpi('Presbitérios cadastrados', '1')}
          ${kpi('Relatórios recebidos', fmt.int(todos.length))}
          ${kpi('Relatórios validados', fmt.int(val.length))}
          ${kpi('Comungantes (validados)', fmt.int(com.total), '', cobertura(com))}
          ${kpi('Rol de membros (validados)', fmt.int(rol.total), '', cobertura(rol))}
        </div>
        ${card('Presbitérios', `<div class="lista"><a class="item" href="#/">
            <div class="item-m"><strong>${esc(S.presbiterio?.nome || '')}</strong><span class="muted">${esc(S.presbiterio?.sigla || '')} · ${todos.length} relatórios · ${val.length} validados</span></div>
            <div class="item-n"><strong>${fmt.int(com.total)}</strong><span>comungantes</span></div>${ic('seta', 'chev')}</a></div>`, { sub: 'Navegação: Sínodo → Presbitério → Igreja' })}`,
    };
  }

  // ---------- Dicionário de dados ----------
  function telaDicionario() {
    const campos = Dicionario.campos;
    const grupos = [...new Set(campos.map((c) => c.grupo))];
    const linha = (c) => `<tr class="dic-l${c.pendente ? ' pend' : ''}">
        <td><strong>${esc(c.rotulo)}</strong><code>${esc(c.id)}</code>${c.obs ? `<small>${esc(c.obs)}</small>` : ''}</td>
        <td>${esc(c.aba)}<br><strong>${c.celulas.length ? esc(c.celulas.join(' · ')) : 'caixa de seleção'}</strong></td>
        <td>${esc(c.tipo)}<br><span class="muted">${esc(c.unidade)} · ${esc(c.periodo)}</span></td>
        <td>${esc(c.validacao)}${c.formula ? `<br><span class="muted">Fórmula: ${esc(c.formula)}</span>` : ''}</td>
        <td>${esc(c.consolida)}<br><span class="muted">${esc(c.painel)}</span></td></tr>`;
    const body = `
      <p class="nota top">Base lógica da plataforma (seção 4 do projeto): cada informação do modelo oficial <strong>CSM-IPB 2021 v8.0</strong>, com a célula de origem no Excel, tipo, unidade, período, regras de validação, fórmulas, consolidação e o painel onde aparece. O leitor de Excel usa exatamente estas células; o de PDF produz os mesmos campos.</p>
      <div class="kpis k4">
        ${kpi('Campos no dicionário', fmt.int(campos.length))}
        ${kpi('Lidos automaticamente', fmt.int(campos.filter((c) => !c.pendente).length))}
        ${kpi('Com fórmula no modelo', fmt.int(campos.filter((c) => c.formula).length))}
        ${kpi('Pendentes (caixas Sim/Não)', fmt.int(campos.filter((c) => c.pendente).length))}
      </div>
      <div class="btns"><button class="btn" id="dic-xlsx">${ic('baixar')}Baixar dicionário (Excel)</button></div>
      <div class="busca"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON.busca}</svg><input type="search" id="dic-q" placeholder="Buscar campo, célula ou regra (ex.: H47, dízimos, fórmula)" aria-label="Buscar no dicionário"></div>
      ${grupos.map((g) => `<section class="card dic-g"><header class="card-h"><h2>${esc(g)}</h2></header>
        <div class="tbl-wrap"><table class="tbl dic"><thead><tr><th>Campo</th><th>Origem</th><th>Tipo</th><th>Validação</th><th>Consolidação e painel</th></tr></thead>
        <tbody>${campos.filter((c) => c.grupo === g).map(linha).join('')}</tbody></table></div></section>`).join('')}`;
    return {
      title: 'Dicionário de dados', sub: 'Modelo CSM-IPB 2021 v8.0', back: '#/ajuda', body,
      after: () => {
        const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        document.getElementById('dic-q').addEventListener('input', (e) => {
          const q = norm(e.target.value.trim());
          $app.querySelectorAll('.dic-g').forEach((sec) => {
            let n = 0;
            sec.querySelectorAll('.dic-l').forEach((tr) => { const ok = !q || norm(tr.textContent).includes(q); tr.hidden = !ok; if (ok) n++; });
            sec.hidden = n === 0;
          });
        });
        document.getElementById('dic-xlsx').addEventListener('click', async () => {
          try {
            await Envio.carregarScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
            const X = window.XLSX;
            const ws = X.utils.aoa_to_sheet([['Identificador', 'Campo', 'Grupo', 'Aba', 'Células', 'Tipo', 'Unidade', 'Período', 'Validação', 'Fórmula', 'Consolidação', 'Painel', 'Observação', 'Situação'],
              ...campos.map((c) => [c.id, c.rotulo, c.grupo, c.aba, c.celulas.join(', '), c.tipo, c.unidade, c.periodo, c.validacao, c.formula || '', c.consolida, c.painel, c.obs || '', c.pendente ? 'pendente' : 'lido'])]);
            ws['!cols'] = [30, 44, 26, 22, 14, 18, 18, 24, 50, 44, 34, 40, 50, 10].map((wch) => ({ wch }));
            const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Dicionário');
            X.writeFile(wb, 'dicionario-dados-CSM-IPB-v8.xlsx');
          } catch (err) { toast('Não foi possível gerar: ' + err.message); }
        });
      },
    };
  }

  // ---------- Usuários e convites ----------
  const PAPEL_CONVITE = { representante: 'Representante de igreja', admin_presbiterial: 'Administrador do presbitério' };
  const linkConvite = (codigo) => `${location.origin}${location.pathname}#/convite/${codigo}`;
  const textoConvite = (c) => `Olá${c.nome ? `, ${c.nome}` : ''}! Você recebeu um convite para acessar o sistema de estatística da Igreja Presbiteriana do Brasil (${S.presbiterio?.sigla || ''}) como ${(PAPEL_CONVITE[c.papel] || '').toLowerCase()}${c.igreja ? ` da ${c.igreja}` : ''}. Abra o link para criar sua senha: ${linkConvite(c.codigo)}`;
  const botoesConvite = (c) => `<button class="btn" data-copiar="${esc(linkConvite(c.codigo))}">Copiar link</button>
    <a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(textoConvite(c))}">WhatsApp</a>`;
  async function copiar(txt) {
    try { await navigator.clipboard.writeText(txt); toast('Link copiado.'); } catch (e) { window.prompt('Copie o link:', txt); }
  }

  function telaUsuarios() {
    const igrejas = [...S.igrejas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const body = S.modo === 'local' ? card('', '<p>O cadastro de usuários funciona apenas no site publicado.</p>') : `
      <p class="nota top">Convide pelo link: a pessoa abre, cria a própria senha e já entra com o acesso certo. Envie o link por WhatsApp ou e-mail. Cada convite vale por 14 dias e só pode ser usado com o e-mail cadastrado.</p>
      ${card('Convidar usuário', `<form id="f-conv" class="campos conv">
          <label class="lbl">Nome<input type="text" name="nome" autocomplete="off" placeholder="Ex.: Pb. João da Silva"></label>
          <label class="lbl">E-mail<input type="email" name="email" required autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="email"></label>
          <label class="lbl">Acesso<select name="papel" id="conv-papel">${Object.entries(PAPEL_CONVITE).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
          <label class="lbl" id="conv-ig">Igreja<select name="igreja"><option value="">Selecione a igreja…</option>${igrejas.map((i) => `<option value="${esc(i.codigo)}">${esc(i.nome)}</option>`).join('')}</select></label>
          <button class="btn primary" type="submit">Criar convite</button>
        </form><div id="conv-ok"></div>`, { sub: 'Representante vê e envia só a própria igreja; administrador vê o presbitério inteiro e valida relatórios' })}
      <section class="card"><header class="card-h"><h2>Convites pendentes</h2></header><div id="l-conv"><div class="carregando dark"><span class="spin"></span>Carregando…</div></div></section>
      <section class="card"><header class="card-h"><h2>Usuários com acesso</h2></header><div id="l-usu"><div class="carregando dark"><span class="spin"></span>Carregando…</div></div></section>`;

    async function carregarListas() {
      try {
        const convites = await Data.listarConvites();
        document.getElementById('l-conv').innerHTML = convites.length ? `<ul class="envios">${convites.map((c) => {
          const cv = { ...c, igreja: c.igrejas?.nome };
          const expirado = new Date(c.expira_em) < new Date();
          return `<li><div class="env-m"><strong>${esc(c.nome || c.email)}</strong>
              <span class="muted small">${esc(c.email)} · ${PAPEL_CONVITE[c.papel]}${c.igrejas ? ` · ${esc(c.igrejas.nome)}` : ''}</span>
              <div class="item-s"><span class="flag${expirado ? ' crit' : ''}">${expirado ? 'expirado' : `vale até ${fmt.data(c.expira_em.slice(0, 10))}`}</span></div>
              <div class="btns">${expirado ? '' : botoesConvite(cv)}<button class="btn danger" data-cancelar="${esc(c.id)}">Cancelar</button></div></div></li>`;
        }).join('')}</ul>` : '<p class="vazio">Nenhum convite pendente.</p>';
      } catch (e) { document.getElementById('l-conv').innerHTML = `<p class="erro">${esc(e.message)}</p>`; }
      try {
        const usuarios = await Data.listarUsuarios();
        document.getElementById('l-usu').innerHTML = usuarios.length ? `<ul class="envios">${usuarios.map((u) => `<li>
            <div class="env-m"><strong>${esc(u.nome || u.email)}</strong>
              <span class="muted small">${esc(u.email)} · ${PAPEIS[u.papel] || u.papel}${u.igreja_nome ? ` · ${esc(u.igreja_nome)}` : ''}</span>
              <span class="muted small">Último acesso: ${u.ultimo_acesso ? fmt.dataHora(u.ultimo_acesso) : 'nunca'}</span></div>
            ${u.email === S.usuario.email ? '<span class="flag">você</span>' : `<button class="btn danger" data-remover="${esc(u.user_id)}" data-nome="${esc(u.nome || u.email)}">Remover</button>`}
          </li>`).join('')}</ul>` : '<p class="vazio">Nenhum usuário.</p>';
      } catch (e) { document.getElementById('l-usu').innerHTML = `<p class="erro">${esc(e.message)}</p>`; }
    }

    return {
      title: 'Usuários e convites', sub: esc(S.presbiterio?.nome || ''), back: '#/perfil', body,
      after: () => {
        if (S.modo === 'local') return;
        const $f = document.getElementById('f-conv'), $papel = document.getElementById('conv-papel'), $ig = document.getElementById('conv-ig');
        const ajustar = () => { $ig.hidden = $papel.value !== 'representante'; };
        $papel.addEventListener('change', ajustar); ajustar();
        $f.addEventListener('submit', async (e) => {
          e.preventDefault();
          const f = new FormData($f), btn = $f.querySelector('button[type=submit]');
          const dados = { nome: String(f.get('nome') || '').trim(), email: String(f.get('email') || '').trim().toLowerCase(), papel: f.get('papel'), igreja: f.get('igreja') };
          if (dados.papel === 'representante' && !dados.igreja) { toast('Selecione a igreja.'); return; }
          btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Criando…';
          try {
            const codigo = await Data.criarConvite(dados);
            const cv = { ...dados, codigo, igreja: igrejas.find((i) => i.codigo === dados.igreja)?.nome };
            document.getElementById('conv-ok').innerHTML = `<div class="banner info conv-ok" role="status"><b>✓</b><div><strong>Convite criado para ${esc(dados.email)}.</strong>
              Envie o link abaixo para a pessoa:<code class="link">${esc(linkConvite(codigo))}</code><div class="btns">${botoesConvite(cv)}</div></div></div>`;
            $f.reset(); ajustar();
            carregarListas();
          } catch (err) { toast(err.message); }
          btn.disabled = false; btn.textContent = 'Criar convite';
        });
        $app.querySelector('.content').addEventListener('click', async (e) => {
          const cp = e.target.closest('[data-copiar]'), ca = e.target.closest('[data-cancelar]'), rm = e.target.closest('[data-remover]');
          if (cp) copiar(cp.dataset.copiar);
          if (ca) { try { await Data.cancelarConvite(ca.dataset.cancelar); toast('Convite cancelado.'); carregarListas(); } catch (err) { toast(err.message); } }
          if (rm && window.confirm(`Remover o acesso de ${rm.dataset.nome}? A pessoa não verá mais nenhum dado.`)) {
            try { await Data.removerAcesso(rm.dataset.remover); toast('Acesso removido.'); carregarListas(); } catch (err) { toast(err.message); }
          }
        });
        carregarListas();
      },
    };
  }

  // Página aberta pela pessoa convidada (funciona sem estar logada)
  async function telaConvite(codigo) {
    if (S.modo === 'local') return renderSimples('<div class="login"><p>Convites funcionam apenas no site publicado.</p></div>');
    renderSimples('<div class="carregando"><span class="spin"></span>Abrindo convite…</div>');
    let c;
    try { c = await Data.verConvite(codigo); } catch (e) { c = null; }
    const topo = '<h1 class="login-logo"><img src="icons/logo_ipb.png" alt="Igreja Presbiteriana do Brasil"></h1>';
    if (!c || c.situacao !== 'valido') {
      const msg = !c ? 'Convite não encontrado. Confira se o link está completo.' : c.situacao === 'usado' ? 'Este convite já foi usado. Entre com seu e-mail e senha.' : 'Este convite expirou. Peça um novo ao administrador do presbitério.';
      return renderSimples(`<div class="login">${topo}<p class="erro">${msg}</p><a class="btn primary" href="#/">Ir para o login</a></div>`);
    }
    let novaConta = true;
    const desenhar = (erro = '') => {
      renderSimples(`<div class="login">${topo}
        <h2 class="login-t">Convite de acesso</h2>
        <p class="muted">Você recebeu um convite de acesso como <strong>${esc(PAPEL_CONVITE[c.papel])}</strong>${c.igreja ? ` da <strong>${esc(c.igreja)}</strong>` : ''} — ${esc(c.presbiterio)}.</p>
        ${erro ? `<p class="erro" role="alert">${esc(erro)}</p>` : ''}
        <form id="f-convite" class="form">
          ${novaConta ? `<label>Seu nome<input type="text" name="nome" value="${esc(c.nome || '')}" autocomplete="name"></label>` : ''}
          <label>E-mail<input type="email" name="email" value="${esc(c.email)}" readonly></label>
          <label>${novaConta ? 'Crie uma senha (mínimo 8 caracteres)' : 'Sua senha'}<input type="password" name="senha" id="senha" minlength="${novaConta ? 8 : 1}" autocomplete="${novaConta ? 'new-password' : 'current-password'}" autocapitalize="none" autocorrect="off" spellcheck="false" required></label>
          ${novaConta ? '<label>Repita a senha<input type="password" name="senha2" id="senha2" autocomplete="new-password" autocapitalize="none" autocorrect="off" spellcheck="false" required></label>' : ''}
          <label class="conf"><input type="checkbox" id="ver-senha"> Mostrar senha</label>
          <button class="btn primary" type="submit">${novaConta ? 'Criar conta e entrar' : 'Entrar e aceitar convite'}</button>
        </form>
        <button class="btn" id="alternar">${novaConta ? 'Já tenho conta com este e-mail' : 'Ainda não tenho conta'}</button>
      </div>`);
      document.getElementById('alternar').addEventListener('click', () => { novaConta = !novaConta; desenhar(); });
      document.getElementById('ver-senha').addEventListener('change', (e) => { ['senha', 'senha2'].forEach((id) => { const el = document.getElementById(id); if (el) el.type = e.target.checked ? 'text' : 'password'; }); });
      document.getElementById('f-convite').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        if (novaConta && f.get('senha') !== f.get('senha2')) { desenhar('As duas senhas não são iguais.'); return; }
        const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Entrando…';
        try {
          await Data.usarConvite({ codigo, email: c.email, senha: f.get('senha'), nome: String(f.get('nome') || '').trim(), novaConta });
          iniciou = true; ui.carregado = false;
          toast('Bem-vindo! Seu acesso está pronto.');
          location.hash = '#/';
        } catch (err) { desenhar(err.message); }
      });
    };
    desenhar();
  }

  // ---------- Perfil ----------
  function telaPerfil() {
    const local = S.modo === 'local';
    return {
      title: 'Perfil', sub: esc(S.usuario?.email || ''),
      body: `${card('', `<div class="perfil">
          <div class="avatar">${ic('perfil')}</div>
          <div><strong>${esc(S.usuario?.nome || '')}</strong><span class="muted">${PAPEIS[S.perfil.papel] || S.perfil.papel}</span>
          ${S.perfil.igreja_codigo ? `<span class="muted">Igreja: ${esc(relPorCodigo(S.perfil.igreja_codigo)?.igreja.nome || S.perfil.igreja_codigo)}</span>` : ''}</div></div>`)}
        <div class="lista">
          ${S.perfil.papel === 'admin_presbiterial' ? `<a class="item" href="#/usuarios">
            <div class="item-m"><strong>Usuários e convites</strong><span class="muted">Convidar representantes e administradores, remover acessos</span></div>${ic('seta', 'chev')}</a>` : ''}
          <a class="item" href="#/ajuda">
            <div class="item-m"><strong>Ajuda</strong><span class="muted">Tudo o que o aplicativo faz, passo a passo e configurações</span></div>${ic('seta', 'chev')}</a>
          <a class="item" href="#/dicionario">
            <div class="item-m"><strong>Dicionário de dados</strong><span class="muted">Cada campo do relatório oficial: célula, tipo, regras e onde aparece</span></div>${ic('seta', 'chev')}</a>
        </div>
        ${local ? card('Simular outro perfil', `<div class="perfis">
            ${['admin_presbiterial', 'admin_sinodal', 'representante'].map((p) => `<button class="btn${S.perfil.papel === p ? ' primary' : ''}" data-papel="${p}">${PAPEIS[p]}</button>`).join('')}
          </div>`, { sub: 'Disponível apenas no modo local' }) : ''}
        ${card('Instalar como aplicativo', `<ul class="passos">
            <li><strong>Android (Chrome):</strong> menu ⋮ → <em>Instalar app</em> ou <em>Adicionar à tela inicial</em>.</li>
            <li><strong>iPhone (Safari):</strong> botão Compartilhar → <em>Adicionar à Tela de Início</em>.</li>
          </ul>`)}
        <button class="btn danger wide" id="sair">Sair</button>`,
      after: () => {
        document.getElementById('sair').addEventListener('click', async () => { await Data.sair(); ui.carregado = false; location.hash = ''; rota(); });
        $app.querySelectorAll('[data-papel]').forEach((b) => b.addEventListener('click', () => {
          Data.entrarLocal(b.dataset.papel); ui.carregado = false;
          location.hash = b.dataset.papel === 'representante' ? `#/igreja/${Data.state.perfil.igreja_codigo}` : b.dataset.papel === 'admin_sinodal' ? '#/sinodo' : '#/';
          rota();
        }));
      },
    };
  }

  // ---------- Roteador ----------
  let iniciou = false;
  async function rota() {
    // Convite: abre mesmo sem login (a pessoa ainda não tem conta)
    const convite = location.hash.match(/^#\/convite\/([0-9a-f]+)/i);
    if (convite) return telaConvite(convite[1]);
    if (!iniciou) {
      iniciou = true;
      renderSimples('<div class="carregando"><span class="spin"></span>Carregando…</div>');
      try { await Data.sessaoAtual(); } catch (e) { return telaLogin(e.message); }
    }
    if (!S.perfil && location.hash.startsWith('#/ajuda')) {
      // Ajuda aberta da tela de login (sem usuário)
      $app.innerHTML = `<div class="aj-solo"><header class="aj-solo-h"><a href="#/" class="btn">${ic('voltar')}Voltar ao login</a>
        <img src="icons/logo_ipb.png" alt="Igreja Presbiteriana do Brasil"></header><h1>Ajuda</h1>${Ajuda.html(null)}</div>`;
      window.scrollTo(0, 0);
      return Ajuda.ligar($app);
    }
    if (!S.perfil) return telaLogin();
    if (!ui.carregado) {
      renderSimples('<div class="carregando"><span class="spin"></span>Carregando relatórios…</div>');
      try { await Data.carregar(); ui.carregado = true; } catch (e) {
        return renderSimples(`<div class="login"><h1>Não foi possível carregar</h1><p class="erro">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Tentar de novo</button></div>`);
      }
    }
    const [p0 = '', p1, p2] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    const rep = S.perfil.papel === 'representante';
    if (rep && !(p0 === 'igreja' || p0 === 'perfil' || p0 === 'enviar' || p0 === 'ajuda' || p0 === 'dicionario')) { location.replace(`#/igreja/${S.perfil.igreja_codigo}`); return; }
    if (p0 === 'igreja' && rep && p1 !== S.perfil.igreja_codigo) { location.replace(`#/igreja/${S.perfil.igreja_codigo}`); return; }
    switch (p0) {
      case '': return render(telaPresbiterio(), 'inicio');
      case 'igrejas': return render(telaIgrejas(), 'igrejas');
      case 'igreja': return render(telaIgreja(p1, p2), rep ? 'igreja' : 'igrejas');
      case 'pendencias': return render(telaPendencias(), 'pendencias');
      case 'enviar': return render(telaEnviar(rep ? S.perfil.igreja_codigo : p1), rep ? 'enviar' : 'igrejas');
      case 'editar': {
        const r = relPorCodigo(p1);
        if (!r || !Data.podeValidar()) { location.replace('#/'); return; }
        return render(telaEditar({ r }), 'igrejas');
      }
      case 'digitar': {
        const envio = S.envios.find((e) => e.id === p1);
        if (!envio || !Data.podeValidar()) { location.replace('#/pendencias'); return; }
        return render(telaEditar({ envio }), 'pendencias');
      }
      case 'sinodo': return render(telaSinodo(), 'sinodo');
      case 'perfil': return render(telaPerfil(), 'perfil');
      case 'ajuda':
        return render({ title: 'Ajuda', sub: 'Como usar o sistema', body: Ajuda.html(S.perfil.papel), after: () => Ajuda.ligar($app) }, 'ajuda');
      case 'dicionario': return render(telaDicionario(), 'perfil');
      case 'usuarios':
        if (S.perfil.papel !== 'admin_presbiterial') { location.replace('#/perfil'); return; }
        return render(telaUsuarios(), 'perfil');
      default: location.replace('#/');
    }
  }

  window.addEventListener('hashchange', rota);
  Charts.ligarTooltip();
  // Baixar arquivo original (link assinado, válido por 10 minutos)
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-baixar]');
    if (!b) return;
    if (S.modo === 'local') { toast('Disponível apenas no site publicado.'); return; }
    const janela = window.open('', '_blank');
    try { janela.location = await Data.urlArquivo(b.dataset.baixar); } catch (err) { janela?.close(); toast('Não foi possível abrir o arquivo: ' + err.message); }
  });
  // Ler agora: lê os números de um arquivo recebido e cria a versão para conferência
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ler]');
    const envio = b && S.envios.find((x) => x.id === b.dataset.ler);
    if (!envio) return;
    b.disabled = true; b.innerHTML = '<span class="spin"></span>Lendo…';
    try {
      await Data.processarEnvio(envio);
      toast('Relatório lido. A nova versão está aguardando conferência.');
      rota();
    } catch (err) { b.disabled = false; b.textContent = 'Ler agora'; toast(err.message); }
  });
  rota();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
