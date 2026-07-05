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
 * Renderiza os blocos pendentes de revisão para o dia atual com UI de botões moderna
 * e alinhamento estrito ao fuso horário local do dispositivo.
 */
export function renderizarFilaHoje(items, checks, onActionCallback) {
    const container = document.getElementById('fila-hoje');
    if (!container) return;

    // Captura a data de hoje baseada estritamente no fuso horário local (Dispositivo)
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    const hojeLocalStr = `${ano}-${mes}-${dia}`;

    // Filtra apenas o que venceu hoje ou está atrasado (com base no fuso local), ignorando itens pausados
    const filtrados = items.filter(item => {
        return item.proximaRevisao <= hojeLocalStr && item.status !== 'pausado';
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

    container.innerHTML = '';
    document.getElementById('btn-finalizar').classList.remove('hidden');

    // Mapeia e renderiza a lista de cartões do dia
    filtrados.forEach(item => {
        const div = document.createElement('div');
        div.className = 'flashcard-row';

        const tipoBadge = item.type === 'card' ? '<span class="badge badge-card">Card</span>' : '<span class="badge badge-frase">Frase</span>';
        
        // Verifica se este item já possui alguma conferência marcada na sessão atual
        const estadoCheck = checks[item.id]; 
        const isFalhaChecked = estadoCheck === 'falha' ? 'checked' : '';
        const isSucessoChecked = estadoCheck === 'sucesso' ? 'checked' : '';

        div.innerHTML = `
            <div class="flashcard-header">
                <span class="flashcard-title">${item.id}</span>
                <div>${tipoBadge}</div>
            </div>
            <div class="flashcard-meta">
                <span>Estágio Atual: <strong>Nível ${item.nivel}</strong></span>
            </div>
            <div class="flashcard-actions">
                <button class="btn-review fail ${isFalhaChecked}" data-id="${item.id}" data-action="falha">
                    ❌ Errei
                </button>
                <button class="btn-review success ${isSucessoChecked}" data-id="${item.id}" data-action="sucesso">
                    ✓ Acertei
                </button>
            </div>
        `;

        // Vincula cliques aos botões da linha
        div.querySelectorAll('.btn-review').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const action = e.currentTarget.getAttribute('data-action');
                onActionCallback(id, action);
            });
        });

        container.appendChild(div);
    });
}

/**
 * Renderiza a visão futura do cronograma dos próximos 7 dias (Calendário/Timeline).
 * CORRIGIDO: Nome unificado com as chamadas feitas pelo app.js
 */
export function renderizarCalendarioFuturo(items) {
    const container = document.getElementById('calendario-grid');
    if (!container) return;

    container.innerHTML = '';

    // Gera os próximos 7 dias baseando-se estritamente no fuso local
    for (let i = 0; i < 7; i++) {
        const dataAlvo = new Date();
        dataAlvo.setDate(dataAlvo.getDate() + i);

        const ano = dataAlvo.getFullYear();
        const mes = String(dataAlvo.getMonth() + 1).padStart(2, '0');
        const dia = String(dataAlvo.getDate()).padStart(2, '0');
        const dataAlvoStr = `${ano}-${mes}-${dia}`;

        // Conta quantos itens ativos caem nesta data específica
        const contagemDia = items.filter(item => item.proximaRevisao === dataAlvoStr && item.status !== 'pausado').length;

        // Formatação legível para exibição humana
        const opcoesFormatacao = { weekday: 'long', day: 'numeric', month: 'short' };
        let tituloDia = dataAlvo.toLocaleDateString('pt-BR', opcoesFormatacao);
        tituloDia = tituloDia.charAt(0).toUpperCase() + tituloDia.slice(1); // Capitaliza

        if (i === 0) tituloDia = `Hoje (${dataAlvo.getDate()} de ${dataAlvo.toLocaleDateString('pt-BR', { month: 'short' })})`;
        if (i === 1) tituloDia = `Amanhã (${dataAlvo.getDate()} de ${dataAlvo.toLocaleDateString('pt-BR', { month: 'short' })})`;

        const divDia = document.createElement('div');
        divDia.className = 'timeline-day';
        
        divDia.innerHTML = `
            <h4>
                <span>${tituloDia}</span>
                <span class="badge ${contagemDia > 0 ? 'badge-ativo' : 'badge-card'}" style="text-transform:none;">
                    ${contagemDia} ${contagemDia === 1 ? 'item' : 'itens'}
                </span>
            </h4>
            <p>${contagemDia === 0 ? 'Nenhuma revisão agendada para este dia.' : 'Cards agendados aguardando liberação do ciclo espaçado.'}</p>
        `;

        container.appendChild(divDia);
    }
}

/**
 * Renderiza a listagem completa de itens cadastrados com suporte a layout responsivo fluido.
 */
export function renderizarTabelaGerenciamento(items, onNivelChange, onDeletarCallback) {
    const tbody = document.querySelector('#tabela-gerenciamento tbody');
    if (!tbody) return;

    if (items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; color:#888; padding:30px;">
                    📭 Nenhum card cadastrado no fichário local até o momento.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '';

    items.forEach(item => {
        const tr = document.createElement('tr');

        const tipoBadge = item.type === 'card' ? '<span class="badge badge-card">Card</span>' : '<span class="badge badge-frase">Frase</span>';
        const statusBadge = item.status === 'pausado' ? '<span class="badge badge-pausado">Pausado</span>' : '<span class="badge badge-ativo">Ativo</span>';

        tr.innerHTML = `
            <td data-label="Identificador" style="font-weight: bold; color: #fff;">${item.id}</td>
            <td data-label="Tipo">${tipoBadge} ${statusBadge}</td>
            <td data-label="Nível Atual">
                <select class="select-nivel-inline" data-id="${item.id}">
                    <option value="1" ${item.nivel === 1 ? 'selected' : ''}>Nível 1</option>
                    <option value="2" ${item.nivel === 2 ? 'selected' : ''}>Nível 2</option>
                    <option value="3" ${item.nivel === 3 ? 'selected' : ''}>Nível 3</option>
                    <option value="4" ${item.nivel === 4 ? 'selected' : ''}>Nível 4</option>
                    <option value="5" ${item.nivel === 5 ? 'selected' : ''}>Nível 5</option>
                    <option value="6" ${item.nivel === 6 ? 'selected' : ''}>Nível 6</option>
                </select>
            </td>
            <td data-label="Próxima Revisão" style="font-family: monospace;">${item.proximaRevisao}</td>
            <td data-label="Ações">
                <button class="btn-deletar" data-id="${item.id}">Deletar</button>
            </td>
        `;

        // Vincula evento de alteração de nível manual com trava de segurança
        tr.querySelector('.select-nivel-inline').addEventListener('change', (e) => {
            if (typeof onNivelChange === 'function') {
                onNivelChange(item.id, parseInt(e.target.value));
            } else {
                console.warn("Aviso: onNivelChange não foi passada corretamente para a tabela.");
            }
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
        text: mensagem, // <--- CORRIGIDO: Removido o 'mensaje ||' que estava quebrando o escopo
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
        html: `O bloco <strong>\"${nomeCard}\"</strong> foi promovido ao <strong>Nível 3</strong>!<br><br>As frases vinculadas a este caderno físico foram oficialmente <strong>desbloqueadas</strong> e já começaram a entrar no seu cronograma diário de revisões.`,
        icon: 'success',
        confirmButtonColor: '#4caf50',
        background: '#1e1e1e',
        color: '#e0e0e0'
    });
}