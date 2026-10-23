// Resumo executivo em texto, gerado por regras fixas a partir dos números (sem estimativas e sem
// juízo sobre as igrejas). Usado no painel e nos PDFs. Cada função devolve uma lista de parágrafos.
window.Resumo = (() => {
  const { T, fmt, temValor, consolidar, variacao, ROTULOS, DETALHE, DESPESAS } = Regras;
  const pctTxt = (p) => `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  const varTxt = (v) => (v && temValor(v.abs) ? `${fmt.sinal(v.abs)}${temValor(v.pct) ? ` (${pctTxt(v.pct)})` : ''}` : null);
  const lista = (itens) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`);
  const nomeCurto = (n) => String(n || '').replace(/Igreja Presbiteriana/i, 'IP');

  // ctx: { base, todos, naoEnviadas, cadastradas, ano, escopo, exercicio, limiteVar }
  function presbiterio(ctx) {
    const { base, todos, ano } = ctx;
    const p = [];
    const validados = todos.filter((r) => r.status === 'validado').length;
    const fechado = ctx.exercicio?.situacao === 'fechado';
    const esperados = ctx.cadastradas || todos.length;

    // Cobertura
    p.push(`Exercício ${ano}${fechado ? ' (fechado — resultado oficial)' : ' (aberto — resultado parcial)'}: ${todos.length} de ${esperados} igrejas enviaram o relatório e ${validados} ${validados === 1 ? 'foi validado' : 'foram validados'}. `
      + (ctx.escopo === 'todos' ? 'Os números abaixo incluem relatórios ainda não validados.' : `Os números abaixo consideram ${validados === 1 ? 'somente o relatório validado' : `somente os ${validados} relatórios validados`}.`));
    if (!base.length) return p;

    // Membresia
    const rol = consolidar(base, (r) => T(r.dados.rol_atual));
    const com = consolidar(base, (r) => T(r.dados.comungantes?.ano_atual));
    const nc = consolidar(base, (r) => T(r.dados.nao_comungantes?.ano_atual));
    const vRol = variacao(base, (r) => { const a = T(r.dados.comungantes?.ano_anterior), b = T(r.dados.nao_comungantes?.ano_anterior); return temValor(a) && temValor(b) ? a + b : null; }, (r) => T(r.dados.rol_atual));
    if (temValor(rol.total)) {
      p.push(`O rol de membros é de ${fmt.int(rol.total)} pessoas (${rol.n} de ${rol.de} igrejas informaram), sendo ${fmt.int(com.total)} comungantes e ${fmt.int(nc.total)} não comungantes.`
        + (varTxt(vRol) ? ` Em relação ao ano anterior informado nos mesmos relatórios, a variação é de ${varTxt(vRol)}.` : ''));
    }

    // Movimentação de comungantes
    const tipos = (bloco) => {
      const acc = {};
      for (const r of base) for (const [k, v] of Object.entries(r.dados.comungantes?.[bloco] || {})) {
        if (!DETALHE.has(k) && Array.isArray(v) && temValor(v[2])) acc[k] = (acc[k] || 0) + v[2];
      }
      return Object.entries(acc).sort((a, b) => b[1] - a[1]);
    };
    const adm = tipos('admissao'), dem = tipos('demissao');
    const tAdm = adm.reduce((s, [, v]) => s + v, 0), tDem = dem.reduce((s, [, v]) => s + v, 0);
    if (adm.length || dem.length) {
      const principal = (l) => (l.length && l[0][1] ? `, principalmente por ${(ROTULOS[l[0][0]] || l[0][0]).toLowerCase()} (${l[0][1]})` : '');
      p.push(`Houve ${fmt.int(tAdm)} admissões de comungantes${principal(adm)}, e ${fmt.int(tDem)} demissões${principal(dem)} — saldo de ${fmt.sinal(tAdm - tDem)}.`);
    }

    // Escola Dominical
    const ed = consolidar(base, (r) => r.dados.estrutura?.alunos_ed_atual);
    const prof = consolidar(base, (r) => r.dados.estrutura?.professores_ed);
    const vEd = variacao(base, (r) => r.dados.estrutura?.alunos_ed_anterior, (r) => r.dados.estrutura?.alunos_ed_atual);
    if (temValor(ed.total)) {
      p.push(`A Escola Dominical tem ${fmt.int(ed.total)} alunos${temValor(prof.total) && prof.total ? ` e ${fmt.int(prof.total)} professores (${(ed.total / prof.total).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} alunos por professor)` : ''}`
        + (varTxt(vEd) ? `; em relação ao ano anterior, ${varTxt(vEd)}.` : '.'));
    }

    // Finanças (realizado)
    const rec = consolidar(base, (r) => r.dados.financeiro?.realizado?.total_receita);
    const desp = consolidar(base, (r) => r.dados.financeiro?.realizado?.total_despesa);
    if (temValor(rec.total) || temValor(desp.total)) {
      const ambos = base.filter((r) => temValor(r.dados.financeiro?.realizado?.total_receita) && temValor(r.dados.financeiro?.realizado?.total_despesa));
      const res = ambos.reduce((s, r) => s + r.dados.financeiro.realizado.total_receita - r.dados.financeiro.realizado.total_despesa, 0);
      const cats = DESPESAS.map(([k, l]) => [l, consolidar(base, (r) => r.dados.financeiro?.realizado?.[k]).total || 0]).sort((a, b) => b[1] - a[1]);
      const prev = consolidar(base, (r) => r.dados.financeiro?.previsto?.total_receita);
      p.push(`A receita anual realizada somou ${fmt.brl(rec.total)} e a despesa ${fmt.brl(desp.total)}`
        + (ambos.length ? `, resultando em ${res >= 0 ? 'superávit' : 'déficit'} de ${fmt.brl(Math.abs(res))} nas ${ambos.length} igrejas que informaram as duas` : '')
        + (desp.total && cats[0][1] ? `. A maior despesa foi ${cats[0][0].toLowerCase()} (${fmt.pct(cats[0][1] / desp.total)} do total)` : '')
        + (temValor(prev.total) ? `. A receita prevista para o próximo exercício é de ${fmt.brl(prev.total)}.` : '.'));
    }

    // Pontos de atenção
    const atencao = [];
    const correcao = todos.filter((r) => r.status === 'aguardando_correcao');
    const conferencia = todos.filter((r) => r.status === 'aguardando_conferencia');
    if (correcao.length) atencao.push(`${correcao.length} ${correcao.length === 1 ? 'relatório aguarda' : 'relatórios aguardam'} correção (${lista(correcao.map((r) => nomeCurto(r.igreja.nome)))})`);
    if (conferencia.length) atencao.push(`${conferencia.length} ${conferencia.length === 1 ? 'aguarda' : 'aguardam'} conferência`);
    if (ctx.naoEnviadas?.length) atencao.push(`${ctx.naoEnviadas.length} ${ctx.naoEnviadas.length === 1 ? 'igreja não enviou' : 'igrejas não enviaram'} (${lista(ctx.naoEnviadas.map((i) => nomeCurto(i.nome)))})`);
    const verificar = todos.flatMap((r) => Regras.variacoesRelevantes(r.dados, { pct: ctx.limiteVar }).filter((x) => x.relevante && x.tipo === 'dado').map((x) => `${nomeCurto(r.igreja.nome)} (${x.titulo.toLowerCase()})`));
    if (verificar.length) atencao.push(`variação não explicada pela movimentação em ${lista(verificar)}`);
    p.push(atencao.length ? `Pontos de atenção: ${atencao.join('; ')}.` : 'Não há pendências de envio, conferência ou correção.');
    return p;
  }

  // Visões do sínodo e nacional: ctx = { abrangencia, ano, total, porPresb, porUf, parcial }
  function agregado(ctx) {
    const t = ctx.total, p = [];
    p.push(`${ctx.abrangencia}, exercício ${ctx.ano}: ${t.igrejas} igrejas cadastradas em ${ctx.porPresb.length} ${ctx.porPresb.length === 1 ? 'presbitério' : 'presbitérios'}; ${t.recebidos} relatórios recebidos e ${t.validados} validados. `
      + `Os totais somam somente os relatórios validados${ctx.parcial ? ' e são parciais — não representam o total da IPB' : ''}.`);
    if (t.n_rol) p.push(`Rol de membros: ${fmt.int(t.rol)} (${t.n_rol} igrejas informaram), com ${fmt.int(t.comungantes)} comungantes e ${fmt.int(t.nao_comungantes)} não comungantes. Alunos na Escola Dominical: ${fmt.int(t.alunos_ed)}.`);
    if (t.n_movimento) p.push(`Admissões de comungantes: ${fmt.int(t.admissoes)}; demissões: ${fmt.int(t.demissoes)}; saldo de ${fmt.sinal(t.admissoes - t.demissoes)}.`);
    if (t.n_receita) p.push(`Receita anual realizada: ${fmt.brl(t.receita)} (${t.n_receita} igrejas informaram).`);
    const maiorP = [...ctx.porPresb].filter((x) => x.n_rol).sort((a, b) => b.rol - a.rol)[0];
    const maiorU = [...ctx.porUf].filter((x) => x.n_rol).sort((a, b) => b.rol - a.rol)[0];
    if (ctx.porPresb.length > 1 && maiorP) p.push(`Maior rol entre os presbitérios: ${maiorP.nome} (${fmt.int(maiorP.rol)}).`);
    if (maiorU && ctx.porUf.length > 1) p.push(`Distribuição por UF: a maior concentração de membros está em ${maiorU.uf} (${fmt.int(maiorU.rol)} de ${fmt.int(t.rol)}).`);
    return p;
  }

  const NOTA = 'Resumo gerado automaticamente por regras fixas a partir dos relatórios; não substitui a análise e as atribuições dos concílios.';
  return { presbiterio, agregado, NOTA };
})();
