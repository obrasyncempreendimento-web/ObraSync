/* ObraViva – protótipo (HTML + CSS + JS puro)
   Os dados ficam no localStorage do navegador. No futuro, basta trocar as
   funções loadState/saveState por chamadas a uma API com banco SQL. */
(function () {
  'use strict';

  /* ---------- Configuração ---------- */
  const STORAGE_KEY = 'obraviva.v1';
  const PARCELAS_POR_PAGINA = 12;

  // Etapas da obra e peso de cada uma no andamento geral
  const ETAPAS = [
    { id: 'fundacao',   nome: 'Fundação',   peso: 15 },
    { id: 'estrutura',  nome: 'Estrutura',  peso: 30 },
    { id: 'alvenaria',  nome: 'Alvenaria',  peso: 20 },
    { id: 'instalacoes', nome: 'Instalações', peso: 15 },
    { id: 'acabamento', nome: 'Acabamento', peso: 20 }
  ];

  /* ---------- Utilidades ---------- */
  const $ = (sel) => document.querySelector(sel);
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const dataBR = new Intl.DateTimeFormat('pt-BR');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function uid() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id' + Date.now() + Math.random().toString(16).slice(2);
  }
  function hojeISO() { return toISO(new Date()); }
  function toISO(d) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }
  function fromISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function addMeses(iso, n) {
    const base = fromISO(iso);
    const dia = base.getDate();
    const d = new Date(base.getFullYear(), base.getMonth() + n, 1);
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(dia, ultimo));
    return toISO(d);
  }
  function fmtData(iso) { return dataBR.format(fromISO(iso)); }
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  /* ---------- Dados ---------- */
  function andamentoGeral(etapas) {
    const soma = ETAPAS.reduce((acc, e) => acc + e.peso * (etapas[e.id] || 0), 0);
    const pesos = ETAPAS.reduce((acc, e) => acc + e.peso, 0);
    return Math.round(soma / pesos);
  }

  function gerarParcelas(valor, qtd, primeiroVenc) {
    const centavos = Math.round(valor * 100);
    const base = Math.floor(centavos / qtd);
    const sobra = centavos - base * qtd;
    const lista = [];
    for (let i = 0; i < qtd; i++) {
      lista.push({
        n: i + 1,
        venc: addMeses(primeiroVenc, i),
        valor: (base + (i === qtd - 1 ? sobra : 0)) / 100,
        pagaEm: null
      });
    }
    return lista;
  }

  function dadosExemplo() {
    const hoje = hojeISO();
    const inicioAurora = addMeses(hoje, -13);
    const aurora = {
      id: uid(),
      nome: 'Residencial Aurora',
      cidade: 'Itapetininga, SP',
      cliente: 'Maria Souza',
      andares: 12,
      valor: 480000,
      etapas: { fundacao: 100, estrutura: 75, alvenaria: 50, instalacoes: 30, acabamento: 10 },
      parcelas: gerarParcelas(480000, 48, inicioAurora),
      historico: []
    };
    aurora.parcelas.forEach((p) => { if (p.venc <= hoje) p.pagaEm = p.venc; });
    aurora.historico = [
      { id: uid(), data: addMeses(hoje, -12), texto: 'Início da obra: terraplenagem e fundação.', mudancas: ['Fundação: 0% → 40%'] },
      { id: uid(), data: addMeses(hoje, -8), texto: 'Fundação concluída e início da estrutura.', mudancas: ['Fundação: 40% → 100%', 'Estrutura: 0% → 25%'] },
      { id: uid(), data: addMeses(hoje, -3), texto: 'Estrutura chegando ao 9º andar.', mudancas: ['Estrutura: 25% → 75%', 'Alvenaria: 0% → 50%'] },
      { id: uid(), data: addMeses(hoje, -1), texto: 'Início das instalações elétricas e hidráulicas.', mudancas: ['Instalações: 0% → 30%', 'Acabamento: 0% → 10%'] }
    ];

    const inicioVila = addMeses(hoje, -3);
    const vila = {
      id: uid(),
      nome: 'Edifício Vila Nova',
      cidade: 'Sorocaba, SP',
      cliente: 'João Almeida',
      andares: 8,
      valor: 320000,
      etapas: { fundacao: 80, estrutura: 20, alvenaria: 0, instalacoes: 0, acabamento: 0 },
      parcelas: gerarParcelas(320000, 36, inicioVila),
      historico: [
        { id: uid(), data: addMeses(hoje, -2), texto: 'Fundação em andamento.', mudancas: ['Fundação: 0% → 80%'] }
      ]
    };
    vila.parcelas.forEach((p) => { if (p.venc <= hoje) p.pagaEm = p.venc; });

    return { obras: [aurora, vila], obraId: aurora.id, role: 'cliente' };
  }

  // Persistência (com proteção: o localStorage pode falhar em abas privadas)
  let memoria = null;
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && Array.isArray(s.obras) && s.obras.length) return s;
      }
    } catch (e) { /* ignora */ }
    return memoria || dadosExemplo();
  }
  function saveState() {
    memoria = state;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignora */ }
  }

  let state = loadState();
  let rascunho = null;      // etapas em edição (pré-visualização)
  let mostrarTodas = false; // paginação das parcelas
  let anterior = {};        // contagem de andares por obra, para animar só o que é novo

  function obraAtual() {
    return state.obras.find((o) => o.id === state.obraId) || state.obras[0];
  }

  /* ---------- Cálculos financeiros ---------- */
  function resumoFinanceiro(obra) {
    const hoje = hojeISO();
    const pagas = obra.parcelas.filter((p) => p.pagaEm);
    const pago = pagas.reduce((a, p) => a + p.valor, 0);
    const total = obra.parcelas.reduce((a, p) => a + p.valor, 0);
    const proxima = obra.parcelas.find((p) => !p.pagaEm);
    return {
      pago, total, falta: total - pago,
      pctPago: total ? Math.round((pago / total) * 100) : 0,
      proxima,
      situacao(p) {
        if (p.pagaEm) return 'paga';
        return p.venc < hoje ? 'atrasada' : 'aberta';
      }
    };
  }

  /* ---------- Desenho do prédio (SVG) ---------- */
  function desenharPredio(obra, etapas) {
    const N = obra.andares;
    const W = 320, H = 440, chao = 392;
    const alturaAndar = Math.min(30, 290 / N);
    const bx = 86, bw = 140;
    const geral = andamentoGeral(etapas);

    const estF = N * (etapas.estrutura / 100);
    const estCheios = Math.floor(estF + 1e-9);
    const estFrac = estF - estCheios;
    const alvCheios = Math.min(Math.floor(N * (etapas.alvenaria / 100) + 1e-9), estCheios);
    const acabCheios = Math.min(Math.floor(N * (etapas.acabamento / 100) + 1e-9), alvCheios);

    const prev = anterior[obra.id] || { est: 0, alv: 0, acab: 0 };

    let s = '';
    // Sol e nuvens
    s += '<circle cx="268" cy="52" r="22" fill="#ffd43b" opacity=".85"/>';
    s += '<g fill="#fff" opacity=".8"><ellipse cx="60" cy="70" rx="30" ry="10"/><ellipse cx="80" cy="62" rx="20" ry="9"/>' +
         '<ellipse cx="210" cy="118" rx="26" ry="8"/><ellipse cx="226" cy="111" rx="16" ry="7"/></g>';
    // Chão
    s += '<rect x="0" y="' + chao + '" width="' + W + '" height="' + (H - chao) + '" fill="#7cb342"/>';
    s += '<rect x="0" y="' + (chao + 22) + '" width="' + W + '" height="14" fill="#6d6f75"/>';
    s += '<g stroke="#f1f3f5" stroke-width="2" stroke-dasharray="14 12"><line x1="0" y1="' + (chao + 29) + '" x2="' + W + '" y2="' + (chao + 29) + '"/></g>';

    // Fundação (aparece sob o terreno)
    if (etapas.fundacao > 0) {
      const hf = 4 + (etapas.fundacao / 100) * 12;
      s += '<rect x="' + (bx - 8) + '" y="' + chao + '" width="' + (bw + 16) + '" height="' + hf.toFixed(1) +
           '" fill="#8d6e4f" stroke="#5f4a34" stroke-width="1"/>';
    }

    // Andares
    for (let i = 0; i < estCheios; i++) {
      const y = chao - (i + 1) * alturaAndar;
      const acabado = i < acabCheios;
      const comParede = i < alvCheios;
      s += '<g' + (i >= prev.est && Object.keys(anterior).length ? ' class="pop"' : '') + '>';
      if (acabado) {
        s += '<rect x="' + bx + '" y="' + y + '" width="' + bw + '" height="' + alturaAndar + '" fill="#5aa0c8" stroke="#2f6f96"/>';
        const jw = bw / 5, jh = Math.max(4, alturaAndar * 0.45);
        for (let k = 0; k < 3; k++) {
          const wx = bx + jw * (0.6 + k * 1.45);
          s += '<rect x="' + wx.toFixed(1) + '" y="' + (y + alturaAndar * 0.25).toFixed(1) + '" width="' + (jw * 0.9).toFixed(1) + '" height="' + jh.toFixed(1) + '" rx="1.5" fill="#fff3bf" stroke="#2f6f96" stroke-width=".6"/>';
        }
      } else if (comParede) {
        s += '<rect x="' + bx + '" y="' + y + '" width="' + bw + '" height="' + alturaAndar + '" fill="#d9c3a0" stroke="#a88f68"/>';
        s += '<g stroke="#bfa57c" stroke-width=".6">';
        for (let k = 1; k < 4; k++) { const yy = y + (alturaAndar / 4) * k; s += '<line x1="' + bx + '" y1="' + yy.toFixed(1) + '" x2="' + (bx + bw) + '" y2="' + yy.toFixed(1) + '"/>'; }
        s += '</g>';
      } else {
        s += '<rect x="' + bx + '" y="' + y + '" width="' + bw + '" height="' + alturaAndar + '" fill="rgba(160,168,180,.18)" stroke="#8b94a3" stroke-dasharray="3 2"/>';
        s += '<g stroke="#8b94a3" stroke-width="2">';
        for (let k = 0; k < 4; k++) { const cx = bx + 3 + k * ((bw - 6) / 3); s += '<line x1="' + cx.toFixed(1) + '" y1="' + y + '" x2="' + cx.toFixed(1) + '" y2="' + (y + alturaAndar) + '"/>'; }
        s += '</g>';
      }
      s += '</g>';
    }
    // Andar parcial em construção
    if (estFrac > 0.02 && estCheios < N) {
      const hp = alturaAndar * estFrac;
      const y = chao - estCheios * alturaAndar - hp;
      s += '<rect x="' + bx + '" y="' + y.toFixed(1) + '" width="' + bw + '" height="' + hp.toFixed(1) + '" fill="rgba(160,168,180,.25)" stroke="#8b94a3" stroke-dasharray="3 2"/>';
    }

    const topoY = chao - (estCheios + estFrac) * alturaAndar;

    // Obra concluída: telhado e antena. Em andamento: guindaste.
    if (geral >= 100 && acabCheios >= N) {
      s += '<rect x="' + (bx - 4) + '" y="' + (topoY - 8) + '" width="' + (bw + 8) + '" height="8" fill="#495057"/>';
      s += '<line x1="' + (bx + bw / 2) + '" y1="' + (topoY - 8) + '" x2="' + (bx + bw / 2) + '" y2="' + (topoY - 34) + '" stroke="#495057" stroke-width="2"/>';
      s += '<circle cx="' + (bx + bw / 2) + '" cy="' + (topoY - 36) + '" r="3" fill="#e03131"/>';
      s += '<rect x="' + (bx + bw / 2 - 11) + '" y="' + (chao - 20) + '" width="22" height="20" fill="#7a4b2a"/>';
    } else {
      const gx = bx + bw + 22;
      const gTopo = Math.max(40, topoY - 46);
      s += '<g stroke="#f59f00" stroke-width="3" fill="none">';
      s += '<line x1="' + gx + '" y1="' + chao + '" x2="' + gx + '" y2="' + gTopo + '"/>';
      s += '<line x1="' + (gx + 10) + '" y1="' + chao + '" x2="' + (gx + 10) + '" y2="' + gTopo + '"/>';
      for (let y = chao - 12; y > gTopo + 6; y -= 14) { s += '<line x1="' + gx + '" y1="' + y + '" x2="' + (gx + 10) + '" y2="' + (y - 14) + '" stroke-width="1.5"/>'; }
      s += '<line x1="' + (bx + 10) + '" y1="' + gTopo + '" x2="' + (gx + 30) + '" y2="' + gTopo + '"/>';
      s += '</g>';
      s += '<rect x="' + (gx + 14) + '" y="' + (gTopo - 4) + '" width="14" height="8" fill="#e03131"/>';
      s += '<g class="sway"><line x1="' + (bx + 36) + '" y1="' + gTopo + '" x2="' + (bx + 36) + '" y2="' + (topoY - 12) + '" stroke="#343a40" stroke-width="1.2"/>' +
           '<rect x="' + (bx + 30) + '" y="' + (topoY - 12) + '" width="12" height="8" fill="#343a40"/></g>';
    }

    // Placa da obra
    s += '<g><rect x="14" y="' + (chao - 44) + '" width="50" height="30" rx="3" fill="#fff" stroke="#495057"/>' +
         '<rect x="14" y="' + (chao - 44) + '" width="50" height="8" rx="3" fill="#e8590c"/>' +
         '<text x="39" y="' + (chao - 22) + '" font-size="12" font-weight="700" text-anchor="middle" fill="#343a40">' + geral + '%</text>' +
         '<line x1="26" y1="' + (chao - 14) + '" x2="26" y2="' + chao + '" stroke="#495057" stroke-width="2"/>' +
         '<line x1="52" y1="' + (chao - 14) + '" x2="52" y2="' + chao + '" stroke="#495057" stroke-width="2"/></g>';

    anterior[obra.id] = { est: estCheios, alv: alvCheios, acab: acabCheios };
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + s + '</svg>';
  }

  /* ---------- Renderização ---------- */
  function etapasAtuais(obra) { return rascunho || obra.etapas; }

  function renderTudo() {
    const obra = obraAtual();
    document.body.dataset.role = state.role;
    document.querySelectorAll('[data-role-btn]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.roleBtn === state.role));
    });

    // Seletor de obras
    const sel = $('#obraSelect');
    sel.innerHTML = state.obras.map((o) => '<option value="' + esc(o.id) + '"' + (o.id === obra.id ? ' selected' : '') + '>' + esc(o.nome) + '</option>').join('');

    renderPredio(obra);
    renderKpis(obra);
    renderEtapas(obra);
    renderSliders(obra);
    renderFinanceiro(obra);
    renderHistorico(obra);
  }

  function renderPredio(obra) {
    const etapas = etapasAtuais(obra);
    const geral = andamentoGeral(etapas);
    $('#obraNome').textContent = obra.nome;
    $('#obraInfo').textContent = obra.cidade + ' · ' + obra.andares + ' andares · Cliente: ' + obra.cliente;
    $('#scene').innerHTML = desenharPredio(obra, etapas);
    $('#scene').setAttribute('aria-label', obra.nome + ': ' + geral + '% da obra concluída');
    const concluida = geral >= 100;
    const badge = $('#statusBadge');
    badge.textContent = concluida ? 'Obra concluída' : 'Em andamento';
    badge.classList.toggle('done', concluida);
    $('#previewNote').hidden = !rascunho;
  }

  function renderKpis(obra) {
    const f = resumoFinanceiro(obra);
    $('#kpiObra').textContent = andamentoGeral(obra.etapas) + '%';
    $('#kpiPago').textContent = brl.format(f.pago);
    $('#kpiFalta').textContent = brl.format(f.falta);
    $('#kpiProx').textContent = f.proxima ? (fmtData(f.proxima.venc) + ' · ' + brl.format(f.proxima.valor)) : 'Todas pagas';
  }

  function renderEtapas(obra) {
    $('#etapasList').innerHTML = ETAPAS.map((e) => {
      const v = obra.etapas[e.id] || 0;
      return '<li><div class="stage-top"><span>' + e.nome + '</span><strong>' + v + '%</strong></div>' +
        '<div class="bar' + (v >= 100 ? ' ok' : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + v + '" aria-label="' + e.nome + '"><span style="width:' + v + '%"></span></div></li>';
    }).join('');
  }

  function renderSliders(obra) {
    const box = $('#sliders');
    // Não recria os sliders enquanto o usuário arrasta (evita perder o foco)
    if (box.dataset.obra === obra.id && rascunho && box.children.length) return;
    box.dataset.obra = obra.id;
    const base = rascunho || obra.etapas;
    box.innerHTML = ETAPAS.map((e) => {
      const v = base[e.id] || 0;
      return '<div class="slider-row"><label for="sl-' + e.id + '"><span>' + e.nome + '</span><output id="out-' + e.id + '">' + v + '%</output></label>' +
        '<input type="range" id="sl-' + e.id + '" data-etapa="' + e.id + '" min="0" max="100" step="5" value="' + v + '"></div>';
    }).join('');
  }

  function renderFinanceiro(obra) {
    const f = resumoFinanceiro(obra);
    const geral = andamentoGeral(obra.etapas);

    $('#compare').innerHTML =
      '<div class="compare-row"><span>Valor pago</span><div class="bar blue"><span style="width:' + f.pctPago + '%"></span></div><b>' + f.pctPago + '%</b></div>' +
      '<div class="compare-row"><span>Obra pronta</span><div class="bar"><span style="width:' + geral + '%"></span></div><b>' + geral + '%</b></div>';

    let texto = 'Você já pagou ' + f.pctPago + '% do contrato (' + brl.format(f.pago) + ' de ' + brl.format(f.total) + ') e a obra está ' + geral + '% concluída.';
    if (f.pctPago - geral >= 15) texto += ' O pagamento está à frente da obra; vale acompanhar o cronograma com a construtora.';
    $('#compareText').textContent = texto;

    const lista = (mostrarTodas ? obra.parcelas : janelaParcelas(obra, f));
    $('#parcelasBody').innerHTML = lista.map((p) => {
      const sit = f.situacao(p);
      const rotulo = { paga: 'Paga em ' + (p.pagaEm ? fmtData(p.pagaEm) : ''), aberta: 'A vencer', atrasada: 'Atrasada' }[sit];
      const acao = p.pagaEm
        ? '<button type="button" class="btn ghost small" data-desfazer="' + p.n + '">Desfazer</button>'
        : '<button type="button" class="btn small" data-pagar="' + p.n + '">Registrar pagamento</button>';
      return '<tr><td>' + p.n + '/' + obra.parcelas.length + '</td><td>' + fmtData(p.venc) + '</td><td class="num">' + brl.format(p.valor) + '</td>' +
        '<td><span class="tag ' + sit + '">' + rotulo + '</span></td><td class="only-construtora">' + acao + '</td></tr>';
    }).join('');

    const btn = $('#btnMais');
    btn.hidden = obra.parcelas.length <= PARCELAS_POR_PAGINA;
    btn.textContent = mostrarTodas ? 'Mostrar menos' : 'Mostrar todas as ' + obra.parcelas.length + ' parcelas';
  }

  // Mostra as últimas pagas e as próximas a vencer
  function janelaParcelas(obra, f) {
    const todas = obra.parcelas;
    if (todas.length <= PARCELAS_POR_PAGINA) return todas;
    const idxProx = f.proxima ? todas.indexOf(f.proxima) : todas.length;
    const ini = clamp(idxProx - 3, 0, todas.length - PARCELAS_POR_PAGINA);
    return todas.slice(ini, ini + PARCELAS_POR_PAGINA);
  }

  function renderHistorico(obra) {
    const itens = obra.historico.slice().sort((a, b) => (a.data < b.data ? 1 : -1));
    $('#historico').innerHTML = itens.length ? itens.map((h) =>
      '<li><div class="t-date">' + fmtData(h.data) + '</div><div class="t-text">' + esc(h.texto) + '</div>' +
      (h.mudancas && h.mudancas.length ? '<div class="t-changes">' + h.mudancas.map(esc).join(' · ') + '</div>' : '') + '</li>'
    ).join('') : '<li><div class="muted">Nenhuma atualização publicada ainda.</div></li>';
  }

  /* ---------- Avisos ---------- */
  let toastTimer;
  function aviso(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  /* ---------- Eventos ---------- */
  document.querySelectorAll('[data-role-btn]').forEach((b) => {
    b.addEventListener('click', () => {
      state.role = b.dataset.roleBtn;
      if (state.role === 'cliente') rascunho = null;
      saveState();
      renderTudo();
    });
  });

  $('#obraSelect').addEventListener('change', (e) => {
    state.obraId = e.target.value;
    rascunho = null;
    mostrarTodas = false;
    $('#sliders').dataset.obra = '';
    saveState();
    renderTudo();
  });

  $('#sliders').addEventListener('input', (e) => {
    const el = e.target;
    if (!el.dataset.etapa) return;
    const obra = obraAtual();
    if (!rascunho) rascunho = Object.assign({}, obra.etapas);
    rascunho[el.dataset.etapa] = Number(el.value);
    $('#out-' + el.dataset.etapa).textContent = el.value + '%';
    renderPredio(obra);
  });

  $('#btnDescartar').addEventListener('click', () => {
    rascunho = null;
    $('#sliders').dataset.obra = '';
    renderTudo();
    aviso('Alterações descartadas.');
  });

  $('#formAtualizar').addEventListener('submit', (e) => {
    e.preventDefault();
    const obra = obraAtual();
    if (!rascunho) { aviso('Nenhuma alteração para publicar.'); return; }
    const mudancas = ETAPAS
      .filter((et) => (rascunho[et.id] || 0) !== (obra.etapas[et.id] || 0))
      .map((et) => et.nome + ': ' + (obra.etapas[et.id] || 0) + '% → ' + rascunho[et.id] + '%');
    if (!mudancas.length) { rascunho = null; renderTudo(); aviso('Nenhuma alteração para publicar.'); return; }
    const nota = $('#notaAtualizacao').value.trim();
    obra.etapas = Object.assign({}, rascunho);
    obra.historico.push({ id: uid(), data: hojeISO(), texto: nota || 'Atualização do andam
