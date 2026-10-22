// Análise do arquivo antes do envio (no navegador): formato, tipo de PDF,
// modelo oficial, exercício, igreja e impressão digital (SHA-256) contra duplicidade.
window.Envio = (() => {
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const SHEETJS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  const LIMITE = 10 * 1024 * 1024;
  const IGNORAR = new Set(['IGREJA', 'PRESBITERIANA', 'DE', 'DO', 'DA', 'DOS', 'DAS', 'EM', 'NO', 'NA', 'IP', 'IPB']);

  const scripts = {};
  const carregarScript = (src) => scripts[src] || (scripts[src] = new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => { delete scripts[src]; erro(new Error('Falha ao carregar ' + src)); };
    document.head.appendChild(s);
  }));

  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const palavras = (s) => norm(s).replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter((p) => p && !IGNORAR.has(p));

  async function sha256(buf) {
    const h = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function formatoDe(nome, bytes) {
    const ext = nome.toLowerCase().split('.').pop();
    const pdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
    const zip = bytes[0] === 0x50 && bytes[1] === 0x4b; // PK (xlsx)
    if (ext === 'pdf' && pdf) return 'pdf';
    if (ext === 'xlsx' && zip) return 'xlsx';
    return null;
  }

  async function abrirPdf(buf) {
    await carregarScript(PDFJS);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return window.pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
  }

  async function lerPdf(doc) {
    let texto = '';
    for (let p = 1; p <= Math.min(doc.numPages, 4); p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      texto += tc.items.map((i) => i.str + (i.hasEOL ? '\n' : ' ')).join('') + '\n';
    }
    const n = norm(texto);
    const ano = n.match(/ANO:\s*(\d{4})/);
    const nome = texto.match(/Nome \(Igreja\/Congrega\S*\):[ \t]*([^\n]*?)(?:\s{2,}|\n|Endere|$)/i);
    const versao = n.match(/CSM-IPB\s*-\s*(\d{4})\s*-\s*V\.?\s*([\d.]+)/);
    return {
      paginas: doc.numPages,
      digital: n.replace(/\s/g, '').length > 200,
      modelo: n.includes('INFORMACOES CADASTRAIS') && n.includes('COMUNIDADE PRESBITERIANA'),
      versao: versao ? `CSM-IPB ${versao[1]} v${versao[2]}` : null,
      ano: ano ? +ano[1] : null,
      nome: nome ? nome[1].trim() : null,
    };
  }

  async function lerXlsx(buf) {
    await carregarScript(SHEETJS);
    const wb = window.XLSX.read(buf, { type: 'array', bookSheets: true });
    const abas = wb.SheetNames;
    const tem = (t) => abas.some((a) => norm(a).includes(t));
    return { abas, modelo: tem('CADASTRO') || (tem('CONSELHO') && tem('CONGREGA')) };
  }

  // Leitura dos números do formulário + resumo das somas, como itens da verificação
  function checksLeitura(leitura, add) {
    if (!leitura?.ok) { add('aviso', 'Leitura automática', 'Não foi possível ler os números deste documento; a conferência será manual.'); return; }
    add('ok', 'Leitura automática', `${leitura.lidos} campos lidos do formulário.`);
    const v = Regras.verificacoes(leitura.dados);
    const falhas = v.filter((x) => x.ok === false), conferidas = v.filter((x) => x.ok !== null).length;
    if (falhas.length) add('aviso', `Somas com divergência (${falhas.length} de ${conferidas})`, falhas.map((x) => x.titulo).join(' · ') + '. Se possível, corrija no relatório antes de enviar.');
    else add('ok', 'Somas conferem', `${conferidas} verificações de soma sem divergência.`);
    leitura.alertas.filter((a) => a.campo !== 'identificacao.nome').forEach((a) => add('aviso', a.nivel === 'erro' ? 'Problema no documento' : 'Observação da leitura', a.msg));
  }

  // Lê os números de um PDF já enviado (usado pela administração em "Ler agora")
  async function lerArquivo(buf, siglas = {}) {
    const doc = await abrirPdf(buf);
    try { return await Leitura.extrair(doc, siglas); } finally { doc.destroy(); }
  }

  // Retorna { formato, tipo_pdf, sha256, checks[], bloqueia, resumo, leitura }
  async function analisar(file, { igreja, ano, siglas = {} }) {
    const checks = [];
    const add = (estado, titulo, detalhe = '') => checks.push({ estado, titulo, detalhe });
    if (file.size > LIMITE) {
      add('erro', 'Tamanho do arquivo', `O arquivo tem ${(file.size / 1048576).toFixed(1)} MB; o limite é 10 MB.`);
      return { checks, bloqueia: true };
    }
    const buf = await file.arrayBuffer();
    const formato = formatoDe(file.name, new Uint8Array(buf.slice(0, 4)));
    if (!formato) {
      add('erro', 'Formato do arquivo', 'Envie o relatório em PDF (.pdf) ou Excel (.xlsx).');
      return { checks, bloqueia: true };
    }
    const hash = await sha256(buf);
    const res = { formato, tipo_pdf: null, sha256: hash, checks, resumo: {} };

    if (formato === 'pdf') {
      let info, doc;
      try { doc = await abrirPdf(buf); info = await lerPdf(doc); } catch (e) {
        doc?.destroy();
        add('erro', 'Leitura do PDF', 'Não foi possível abrir o PDF (arquivo danificado ou protegido por senha).');
        res.bloqueia = true; return res;
      }
      if (info.digital && info.modelo) {
        try { res.leitura = await Leitura.extrair(doc, siglas); } catch (e) { res.leitura = null; }
      }
      doc.destroy();
      res.tipo_pdf = info.digital ? 'digital' : 'digitalizado';
      res.resumo = info;
      add('ok', 'Formato: PDF', `${info.paginas} página(s)`);
      if (info.digital) add('ok', 'PDF digital', 'Texto selecionável — leitura automática possível.');
      else add('aviso', 'PDF digitalizado (imagem)', 'A leitura exigirá reconhecimento de imagem (OCR) e conferência manual.');
      if (info.digital) {
        if (info.modelo) add('ok', 'Modelo oficial reconhecido', info.versao || 'Informações Cadastrais e Estatísticas de Comunidade Presbiteriana');
        else add('aviso', 'Modelo não reconhecido', 'O texto do formulário oficial não foi encontrado. Confira se é o relatório correto.');
        if (info.ano == null) add('aviso', 'Exercício', 'Não foi possível identificar o ano no documento.');
        else if (info.ano !== ano) { add('erro', 'Exercício não confere', `O documento é do ano ${info.ano}, mas foi selecionado ${ano}.`); res.bloqueia = true; }
        else add('ok', 'Exercício confere', String(ano));
        if (!info.nome) add('aviso', 'Igreja', 'O nome da igreja está em branco no documento.');
        else {
          const a = palavras(info.nome), b = palavras(igreja.nome);
          const confere = a.some((p) => b.includes(p)) || norm(info.nome).includes(norm(igreja.nome));
          add(confere ? 'ok' : 'aviso', confere ? 'Igreja confere' : 'Igreja pode não conferir', `No documento: “${info.nome}”`);
        }
        if (info.modelo) checksLeitura(res.leitura, add);
      }
    } else {
      let info;
      try { info = await lerXlsx(buf); } catch (e) {
        add('erro', 'Leitura do Excel', 'Não foi possível abrir a planilha.');
        res.bloqueia = true; return res;
      }
      res.resumo = info;
      add('ok', 'Formato: Excel (.xlsx)', `Abas: ${info.abas.join(', ')}`);
      add(info.modelo ? 'ok' : 'aviso', info.modelo ? 'Modelo oficial reconhecido' : 'Modelo não reconhecido',
        info.modelo ? 'Abas do formulário oficial encontradas.' : 'As abas esperadas (Conselho, Congregação, Cadastro & Estatística) não foram encontradas.');
    }
    return res;
  }

  const nomeSeguro = (n) => norm(n).toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

  return { analisar, lerArquivo, nomeSeguro, carregarScript, LIMITE };
})();
