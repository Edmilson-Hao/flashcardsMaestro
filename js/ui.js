/**
 * Função utilitária para embaralhar um array de forma aleatória (Algoritmo Fisher-Yates).
 * Garante que os cards não fiquem viciados na mesma ordem de cadastro.
 * @param {Array} array 
 * @returns {Array} Array embaralhado
 */
function embaralharArray(array) {
    const novoArray = [...array];
    for (let i = novoArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [novoArray[i], novoArray[j]] = [novoArray[j], novoArray[i]];
    }
    return novoArray;
}

/**
 * Renderiza os blocos pendentes de revisão para o dia atual em ordem ALEATÓRIA.
 */
export function renderizarFilaHoje(items, checks, onActionCallback) {
    const container = document.getElementById('fila-hoje');
    if (!container) return;

    const hojeStr = new Date().toISOString().split('T')[0];

    // Filtra apenas o que venceu hoje ou está atrasado, ignorando itens pausados
    const filtrados = items.filter(item => {
        return item.proximaRevisao <= hojeStr && item.status !== 'pausado';
    });

    if (filtrados.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>🎉 Tudo limpo por aqui! Nenhuma revisão agendada para hoje.</p>
            </div>
        `;
        document.getElementById('btn-finalizar').classList.add('hidden');
        return;
    }

    document.getElementById('btn-finalizar').classList.remove('hidden');
    container.innerHTML = '';

    // APLICAÇÃO DA REGRA DE ALEATORIEDADE:
    // Embaralha os itens filtrados para que a ordem mude a cada renderização/recarregamento
    const filaEmbaralhada = embaralharArray(filtrados);

    filaEmbaralhada.forEach(item => {
        const div = document.createElement('div');
        div.className = `card-revisao ${item.type}`;
        
        const checked = checks[item.id];
        if (checked === 'sucesso') div.classList.add('checked-sucesso');
        if (checked === 'falha') div.classList.add('checked-falha');

        div.innerHTML = `
            <div class="card-info">
                <span class="badge-tipo">${item.type.toUpperCase()}</span>
                <span class="badge-nivel">Nível ${item.nivel}</span>
                <p class="card-title">${item.id}</p>
            </div>
            <div class="card-actions">
                <button class="btn-check sucesso" data-id="${item.id}">👍 Acertei</button>
                <button class="btn-check falha" data-id="${item.id}">👎 Errei</button>
            </div>
        `;

        // Vincula as ações de clique para registrar acertos ou erros
        div.querySelector('.btn-check.sucesso').addEventListener('click', () => {
            onActionCallback(item.id, 'sucesso');
        });
        div.querySelector('.btn-check.falha').addEventListener('click', () => {
            onActionCallback(item.id, 'falha');
        });

        container.appendChild(div);
    });
}

/**
 * Renderiza o Calendário Futurista de Distribuição de Carga de Estudos.
 */
export function renderizarCalendario(items) {
    const grid = document.getElementById('calendario-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const hoje = new Date();
    
    // Gera projeção visual estrita para os próximos 7 dias úteis de revisão
    for (let i = 0; i < 7; i++) {
        const dataAlvo = new Date(hoje);
        dataAlvo.setDate(hoje.getDate() + i);
        const dataAlvoStr = dataAlvo.toISOString().split('T')[0];

        // Conta quantos itens ativos vão cair nessa data
        const count = items.filter(item => item.proximaRevisao === dataAlvoStr && item.status !== 'pausado').length;

        const diaSemana = dataAlvo.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
        const diaMes = dataAlvo.getDate();

        const itemDia = document.createElement('div');
        itemDia.className = 'calendario-dia';
        if (i === 0) itemDia.classList.add('hoje');

        itemDia.innerHTML = `
            <span class="dia-semana">${diaSemana}</span>
            <span class="dia-numero">${diaMes}</span>
            <span class="dia-contador ${count > 0 ? 'ativo' : ''}">${count} ${count === 1 ? 'item' : 'itens'}</span>
        `;
        grid.appendChild(itemDia);
    }
}

/**
 * Atualiza dinamicamente o combobox de vínculos na aba Novo Cadastro.
 */
export function atualizarSelectVinculos(items) {
    const select = document.getElementById('item-vinculo');
    if (!select) return;

    // Filtra apenas os cards principais existentes no sistema
    const cards = items.filter(i => i.type === 'card');
    
    select.innerHTML = '<option value="">-- Selecione o Bloco/Palavra Pai --</option>';
    
    cards.forEach(card => {
        const opt = document.createElement('option');
        opt.value = card.id;
        opt.textContent = `Card: ${card.id} (Nível ${card.nivel})`;
        select.appendChild(opt);
    });
}

/**
 * Renderiza a listagem tabular completa do painel Avançado com paginação/busca.
 */
export function renderizarGerenciamento(items, filtroTexto = '', onNivelChange) {
    const tbody = document.querySelector('#tabela-gerenciamento tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtrados = items.filter(item => {
        return item.id.toLowerCase().includes(filtroTexto.toLowerCase()) || 
               (item.vinculo && item.vinculo.toLowerCase().includes(filtroTexto.toLowerCase()));
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#888;">Nenhum registro localizado.</td></tr>`;
        return;
    }

    filtrados.forEach(item => {
        const tr = document.createElement('tr');
        
        // Define classe visual baseado no estado de ciclo de vida do item
        if (item.status === 'pausado') {
            tr.style.opacity = '0.4';
            tr.style.background = 'rgba(244, 67, 54, 0.05)';
        }

        tr.innerHTML = `
            <td><strong>${item.id}</strong></td>
            <td><span class="badge-tipo ${item.type}">${item.type.toUpperCase()}</span></td>
            <td>
                <select class="select-nivel-inline" data-id="${item.id}">
                    ${[1,2,3,4,5,6].map(n => `<option value="${n}" ${item.nivel === n ? 'selected' : ''}>Nível ${n}</option>`).join('')}
                </select>
            </td>
            <td>${item.proximaRevisao}</td>
            <td>
                <div style="display:flex; gap:8px; align-items:center;">
                    <button class="btn-deletar" data-id="${item.id}" style="background:#f44336; padding:4px 8px; font-size:11px; border:none; color:white; border-radius:4px; cursor:pointer;">Excluir</button>
                    ${item.status === 'pausado' ? '<span style="font-size:10px; color:#ff9800; font-weight:bold;">[CONGELADO]</span>' : ''}
                </div>
            </td>
        `;

        // Evento para mudança manual de nível direto na tabela
        tr.querySelector('.select-nivel-inline').addEventListener('change', (e) => {
            onNivelChange(item.id, parseInt(e.target.value));
        });

        tbody.appendChild(tr);
    });
}

/**
 * Dispara uma notificação flutuante de feedback na tela (Toast).
 */
export function mostrarToast(mensagem, tipo = 'success') {
    const cores = {
        success: '#4caf50',
        error: '#f44336',
        warning: '#ff9800'
    };
    
    Toastify({
        text: mensagem,
        duration: 3000,
        close: true,
        gravity: "top",
        position: "right",
        style: {
            background: cores[tipo] || cores.success,
            color: "#ffffff",
            borderRadius: "8px",
            fontFamily: "sans-serif",
            fontSize: "14px"
        }
    }).showToast();
}

/**
 * Dispara a animação comemorativa do SweetAlert ao atingir a meta crítica do Nível 3.
 */
export function dispararAlertaNivel3(nomeCard) {
    Swal.fire({
        title: '🎯 Meta Batida!',
        html: `O bloco <strong>"${nomeCard}"</strong> foi promovido ao <strong>Nível 3</strong>!<br><br>As frases vinculadas a este caderno físico foram oficialmente <strong>desbloqueadas</strong> e já começaram a entrar no seu cronograma diário de revisões.`,
        icon: 'success',
        background: '#1e1e1e',
        color: '#e0e0e0',
        confirmButtonColor: '#4caf50',
        confirmButtonText: 'Excelente, continuar!'
    });
}