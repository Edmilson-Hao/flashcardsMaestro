// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration failed', err));
}

// Tabela da Curva de Repetição Espaçada (Dias Acumulados a partir da dataInicio)
const CURVA_DIAS = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5,
  6: 7, 7: 9, 8: 12, 9: 16, 10: 22,
  11: 29, 12: 38, 13: 50, 14: 65,
  15: 86, 16: 114, 17: 150
};

// State
let listaMestre = [];
let estudadas = [];
let streak = { count: 0, lastDate: null };

// Elementos DOM
const hojeListEl = document.getElementById('hojeList');
const agendaListEl = document.getElementById('agendaList');
const frasesMestreNaoEstudadasEl = document.getElementById('frasesMestreNaoEstudadas');
const frasesMestreEstudadasEl = document.getElementById('frasesMestreEstudadas');
const gerenciarListEl = document.getElementById('gerenciarList');
const progressBarEl = document.getElementById('progressBar');
const progressPercentEl = document.getElementById('progressPercent');
const studiedCountEl = document.getElementById('studiedCount');
const totalCountEl = document.getElementById('totalCount');
const streakCountEl = document.getElementById('streakCount');
const studyingCountEl = document.getElementById('studyingCount');

// Auxiliares de Data (Formato YYYY-MM-DD local)
function getTodayString() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function normalizePinyin(str) {
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Função auxiliar para gerar o Prompt da Miniaula
function gerarPromptMiniaula(hanzi) {
  return `Atue como Tutor Avançado de Chinês (Mandarim).
Analise a frase: ${hanzi}
Gere uma Micro-Aula Sucinta contendo:

Hanzi, Pinyin e Tradução em português.
Ordem dos Termos: Explique a estrutura lógica da frase (Sujeito + Tempo/Local + Verbo + Objeto).
Análise Gramatical: Explique a função exata das partículas (ex: le, de, ma, zài, hé), verbos de ligação ou conectivos presentes.
Dica Cultural/Uso Prático: 1 frase sobre como usar essa expressão de forma natural no dia a dia.
Regra: Mantenha as explicações diretas e objetivas, focadas no "por que a frase é construída assim", sem enrolação.`;
}

// Função para copiar texto para a área de transferência
function copiarPromptParaClipboard(hanzi) {
  const promptText = gerarPromptMiniaula(hanzi);
  navigator.clipboard.writeText(promptText).then(() => {
    Swal.fire({
      icon: 'success',
      title: 'Prompt Copiado!',
      text: 'O prompt para a miniaula foi copiado para sua área de transferência. Cole em sua IA preferida!',
      timer: 2000,
      showConfirmButton: false
    });
  }).catch(err => {
    console.error('Erro ao copiar: ', err);
    Swal.fire('Erro', 'Não foi possível copiar o texto automaticamente.', 'error');
  });
}

// Carregamento de Dados
async function initApp() {
  loadLocalStorage();
  await loadListaMestre();
  updateStreak();
  renderAllViews();
}

function loadLocalStorage() {
  const savedEstudadas = localStorage.getItem('srs_estudadas');
  if (savedEstudadas) estudadas = JSON.parse(savedEstudadas);

  const savedStreak = localStorage.getItem('srs_streak');
  if (savedStreak) streak = JSON.parse(savedStreak);
}

function saveLocalStorage() {
  localStorage.setItem('srs_estudadas', JSON.stringify(estudadas));
  localStorage.setItem('srs_streak', JSON.stringify(streak));
}

async function loadListaMestre() {
  try {
    const response = await fetch('./Lista Mestre.txt');
    const text = await response.text();
    const lines = text.trim().split('\n');
    listaMestre = lines.map((line, index) => {
      const parsed = JSON.parse(line.trim());
      return {
        id: index + 1,
        hanzi: parsed.frase,
        pinyin: parsed.pinying,
        traducao: parsed.tradução
      };
    });
  } catch (err) {
    console.error("Erro ao carregar 'Lista Mestre.txt':", err);
  }
}

// Cálculo da Próxima Revisão
function calcularProximaRevisao(dataInicio, nivel) {
  const dias = CURVA_DIAS[nivel] || 150;
  return addDays(dataInicio, dias);
}

// Lógica de Ofensiva (Streak)
function updateStreak() {
  const today = getTodayString();
  if (!streak.lastDate) {
    streakCountEl.textContent = 0;
    return;
  }
  
  const diffDays = Math.round((new Date(today) - new Date(streak.lastDate)) / (1000 * 60 * 60 * 24));
  if (diffDays > 1) {
    streak.count = 0;
  }
  streakCountEl.textContent = streak.count;
}

function recordActivityToday() {
  const today = getTodayString();
  if (streak.lastDate !== today) {
    const diffDays = streak.lastDate ? Math.round((new Date(today) - new Date(streak.lastDate)) / (1000 * 60 * 60 * 24)) : 0;
    if (diffDays === 1 || !streak.lastDate) {
      streak.count += 1;
    } else {
      streak.count = 1;
    }
    streak.lastDate = today;
    saveLocalStorage();
    updateStreak();
  }
}

// Navegação de Abas
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    e.target.classList.add('active');
    document.getElementById(e.target.dataset.target).classList.add('active');
  });
});

// Renderização Geral
function renderAllViews() {
  renderHeaderProgress();
  renderTelaHoje();
  renderTelaAgenda();
  renderTelaFrasesMestre();
  renderTelaGerenciar();
}

function renderHeaderProgress() {
  const total = listaMestre.length;
  const estudados = estudadas.length;
  const pct = total === 0 ? 0 : Math.round((estudados / total) * 100);

  progressBarEl.style.width = `${pct}%`;
  progressPercentEl.textContent = `${pct}%`;
  studiedCountEl.textContent = estudados;
  totalCountEl.textContent = total;
  studyingCountEl.textContent = estudados;
}

// 1. Tela Hoje
function renderTelaHoje() {
  hojeListEl.innerHTML = '';
  const today = getTodayString();
  
  const pendentes = estudadas.filter(item => item.proximaRevisao <= today);

  if (pendentes.length === 0) {
    hojeListEl.innerHTML = '<p class="subtitle">Nenhuma revisão pendente para hoje! 🎉</p>';
    return;
  }

  pendentes.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-translation">${item.traducao}</div>
      <div class="card-meta">
        <span class="badge">Nível ${item.nivel}</span>
        <span>Revisão: ${item.proximaRevisao}</span>
      </div>
    `;
    card.addEventListener('click', () => abrirModalRevisao(item));
    hojeListEl.appendChild(card);
  });
}

// Modal de Teste de Frase (SweetAlert com botão para Prompt de Miniaula)
function abrirModalRevisao(item) {
  Swal.fire({
    title: item.traducao,
    html: `
      <div class="swal-input-group">
        <label>Escreva em Caracteres Hanzi:</label>
        <input type="text" id="inputHanzi" autocomplete="off" placeholder="ex: 我喜欢..." />
        <label>Escreva em Pinyin (ex: wo3 xi3huan):</label>
        <input type="text" id="inputPinyin" autocomplete="off" placeholder="ex: wo3 xi3huan..." />
      </div>
    `,
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: 'Verificar Resposta',
    denyButtonText: '💡 Copiar Prompt para Aula',
    cancelButtonText: 'Cancelar',
    denyButtonColor: '#0284c7',
    focusConfirm: false,
    preConfirm: () => {
      const hanziVal = document.getElementById('inputHanzi').value.trim();
      const pinyinVal = document.getElementById('inputPinyin').value.trim();
      if (!hanziVal || !pinyinVal) {
        Swal.showValidationMessage('Preencha ambos os campos!');
      }
      return { hanziVal, pinyinVal };
    }
  }).then((result) => {
    if (result.isConfirmed) {
      processarResposta(item, result.value.hanziVal, result.value.pinyinVal);
    } else if (result.isDenied) {
      copiarPromptParaClipboard(item.hanzi);
    }
  });
}

function processarResposta(item, userHanzi, userPinyin) {
  const isHanziCorrect = userHanzi === item.hanzi;
  const isPinyinCorrect = normalizePinyin(userPinyin) === normalizePinyin(item.pinyin);

  const acertou = isHanziCorrect && isPinyinCorrect;

  recordActivityToday();

  if (acertou) {
    item.nivel = Math.min(17, item.nivel + 1);
    item.proximaRevisao = calcularProximaRevisao(item.dataInicio, item.nivel);
    saveLocalStorage();

    Swal.fire({
      icon: 'success',
      title: 'Excelente! Você acertou!',
      html: `<p><b>Hanzi:</b> ${item.hanzi}</p><p><b>Pinyin:</b> ${item.pinyin}</p><p>Novo Nível: ${item.nivel}</p>`
    }).then(() => renderAllViews());
  } else {
    item.nivel = 1;
    item.proximaRevisao = calcularProximaRevisao(item.dataInicio, 1);
    saveLocalStorage();

    Swal.fire({
      icon: 'error',
      title: 'Você errou!',
      html: `
        <p><b>Gabarito Correto:</b></p>
        <p><b>Hanzi:</b> ${item.hanzi}</p>
        <p><b>Pinyin:</b> ${item.pinyin}</p>
        <br/>
        <p><i>A frase retornou para o Nível 1.</i></p>
      `
    }).then(() => renderAllViews());
  }
}

// 2. Tela Agenda
function renderTelaAgenda() {
  agendaListEl.innerHTML = '';
  
  if (estudadas.length === 0) {
    agendaListEl.innerHTML = '<p class="subtitle">Você ainda não tem frases estudadas.</p>';
    return;
  }

  const agrupado = {};
  estudadas.forEach(item => {
    if (!agrupado[item.proximaRevisao]) agrupado[item.proximaRevisao] = [];
    agrupado[item.proximaRevisao].push(item);
  });

  const datasOrdenadas = Object.keys(agrupado).sort();

  datasOrdenadas.forEach(dateStr => {
    const group = document.createElement('div');
    group.className = 'agenda-group';
    
    let html = `<div class="agenda-date">📅 ${dateStr}</div><div class="cards-grid">`;
    agrupado[dateStr].forEach(item => {
      html += `
        <div class="card">
          <div class="card-translation">${item.traducao}</div>
          <div class="card-meta">
            <span>${item.hanzi}</span>
            <span class="badge">Nível ${item.nivel}</span>
          </div>
        </div>
      `;
    });
    html += '</div>';
    group.innerHTML = html;
    agendaListEl.appendChild(group);
  });
}

// 3. Tela Lista Mestre (Separada em Não Estudadas e Já Estudadas)
function renderTelaFrasesMestre() {
  frasesMestreNaoEstudadasEl.innerHTML = '';
  frasesMestreEstudadasEl.innerHTML = '';
  
  const estudadasIds = new Set(estudadas.map(e => e.id));

  let countNaoEstudadas = 0;
  let countEstudadas = 0;

  listaMestre.forEach(item => {
    const jaEstudada = estudadasIds.has(item.id);
    
    const card = document.createElement('div');
    card.className = 'card';

    if (!jaEstudada) {
      countNaoEstudadas++;
      card.innerHTML = `
        <div class="card-translation">${item.traducao}</div>
        <div class="card-meta">
          <span>${item.hanzi}</span>
          <span class="badge badge-primary">Começar a Estudar</span>
        </div>
      `;
      card.addEventListener('click', () => marcarComoEstudada(item));
      frasesMestreNaoEstudadasEl.appendChild(card);
    } else {
      countEstudadas++;
      card.style.opacity = '0.6';
      card.innerHTML = `
        <div class="card-translation">${item.traducao}</div>
        <div class="card-meta">
          <span>${item.hanzi}</span>
          <span class="badge">Já Adicionada</span>
        </div>
      `;
      card.addEventListener('click', () => {
        Swal.fire({
          title: item.traducao,
          text: `${item.hanzi} (${item.pinyin})`,
          showDenyButton: true,
          denyButtonText: '💡 Copiar Prompt para Aula',
          denyButtonColor: '#0284c7',
          showConfirmButton: false,
          showCloseButton: true
        }).then((res) => {
          if (res.isDenied) {
            copiarPromptParaClipboard(item.hanzi);
          }
        });
      });
      frasesMestreEstudadasEl.appendChild(card);
    }
  });

  if (countNaoEstudadas === 0) {
    frasesMestreNaoEstudadasEl.innerHTML = '<p class="subtitle">Parabéns! Você já adicionou todas as frases para estudo! 🎉</p>';
  }
  if (countEstudadas === 0) {
    frasesMestreEstudadasEl.innerHTML = '<p class="subtitle">Nenhuma frase em estudo ainda.</p>';
  }
}

function marcarComoEstudada(item) {
  Swal.fire({
    title: 'Iniciar Estudo?',
    text: `Deseja adicionar "${item.traducao}" à sua lista de revisões?`,
    icon: 'question',
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: 'Sim, Adicionar',
    denyButtonText: '💡 Copiar Prompt para Aula',
    denyButtonColor: '#0284c7',
    cancelButtonText: 'Cancelar'
  }).then((res) => {
    if (res.isConfirmed) {
      const today = getTodayString();
      const novaFrase = {
        id: item.id,
        hanzi: item.hanzi,
        pinyin: item.pinyin,
        traducao: item.traducao,
        nivel: 1,
        dataInicio: today,
        proximaRevisao: addDays(today, 1) // Nível 1 = 1 dia
      };

      estudadas.push(novaFrase);
      recordActivityToday();
      saveLocalStorage();
      renderAllViews();

      Swal.fire('Adicionada!', 'A frase foi para suas revisões de amanhã.', 'success');
    } else if (res.isDenied) {
      copiarPromptParaClipboard(item.hanzi);
    }
  });
}

// 4. Tela Gerenciar (Editar, Exportar, Resetar)
function renderTelaGerenciar() {
  gerenciarListEl.innerHTML = '';

  estudadas.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'card card-manage';
    card.innerHTML = `
      <div class="card-manage-info">
        <div class="card-translation">${item.traducao}</div>
        <div class="card-meta">
          <span>${item.hanzi} (${item.pinyin})</span>
          <span>Nível ${item.nivel} | Revisão: <b>${item.proximaRevisao}</b></span>
        </div>
      </div>
      <button class="btn secondary btn-sm" onclick="editarFrase(${item.id})">✏️ Editar</button>
    `;
    gerenciarListEl.appendChild(card);
  });
}

// Modal de Edição de Nível e Data de Revisão
function editarFrase(id) {
  const item = estudadas.find(e => e.id === id);
  if (!item) return;

  Swal.fire({
    title: `Editar: ${item.traducao}`,
    html: `
      <div class="swal-input-group">
        <label>Nível da Frase (1 - 17):</label>
        <input type="number" id="editNivel" min="1" max="17" value="${item.nivel}" />
        
        <label>Data da Próxima Revisão:</label>
        <input type="date" id="editProximaRevisao" value="${item.proximaRevisao}" />
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Salvar',
    cancelButtonText: 'Cancelar',
    focusConfirm: false,
    preConfirm: () => {
      const newNivel = parseInt(document.getElementById('editNivel').value, 10);
      const newDate = document.getElementById('editProximaRevisao').value;

      if (!newNivel || newNivel < 1 || newNivel > 17 || !newDate) {
        Swal.showValidationMessage('Insira um nível válido (1-17) e uma data válida.');
        return false;
      }

      return { newNivel, newDate };
    }
  }).then((result) => {
    if (result.isConfirmed) {
      item.nivel = result.value.newNivel;
      item.proximaRevisao = result.value.newDate;
      saveLocalStorage();
      renderAllViews();
      Swal.fire('Atualizado!', 'As alterações foram salvas.', 'success');
    }
  });
}

// Exportar progresso como JSON
document.getElementById('btnExport').addEventListener('click', () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(estudadas, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `progresso_hanzi_${getTodayString()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
});

// Importar Progresso
document.getElementById('btnImport').addEventListener('click', () => {
  document.getElementById('importFileInput').click();
});

document.getElementById('importFileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const importedData = JSON.parse(event.target.result);
      if (Array.isArray(importedData)) {
        estudadas = importedData;
        saveLocalStorage();
        renderAllViews();
        Swal.fire('Sucesso!', 'Progresso importado com sucesso.', 'success');
      }
    } catch (err) {
      Swal.fire('Erro!', 'Arquivo JSON inválido.', 'error');
    }
  };
  reader.readAsText(file);
});

// Resetar Progresso
document.getElementById('btnReset').addEventListener('click', () => {
  Swal.fire({
    title: 'Tem certeza?',
    text: 'Isso apagará todo seu progresso salvo localmente!',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'Sim, resetar tudo!'
  }).then((res) => {
    if (res.isConfirmed) {
      estudadas = [];
      streak = { count: 0, lastDate: null };
      localStorage.clear();
      renderAllViews();
      Swal.fire('Resetado!', 'Seu progresso foi totalmente apagado.', 'success');
    }
  });
});

// Inicialização da Aplicação
window.addEventListener('DOMContentLoaded', initApp);