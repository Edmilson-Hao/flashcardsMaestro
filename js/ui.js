export function renderizarFilaHoje(items, checks, onActionClick) {
    const container = document.getElementById('lista-hoje');
    container.innerHTML = '';
    const hojeStr = new Date().toISOString().split('T')[0];

    const filtrados = items.filter(item => item.proximaRevisao <= hojeStr && item.status !== 'pausado');

    if (filtrados.length === 0) {
        container.innerHTML = `<p class="text-secondary" style="text-align:center; padding:20px;">Você está em dia com suas revisões físicas!</p>`;
        return;
    }

    // Ordenar: Cards primeiro, Frases depois
    filtrados.sort((a, b) => (a.type === 'card' ? -1 : 1));

    filtrados.forEach(item => {
        const div = document.createElement('div');
        div.className = `execution-item`;
        if (checks[item.id] === 'sucesso') div.classList.add('marked-success');
        if (checks[item.id] === 'falha') div.classList.add('marked-fail');

        const prefixo = item.type === 'card' ? '📦 Fichário' : '📖 Caderno';
        
        div.innerHTML = `
            <div class="item-info">
                <h4>${prefixo} - ${item.id}</h4>
                <span>Nível atual: ${item.nivel}</span>
            </div>
            <div class="item-actions">
                <button class="btn-sm btn-outline-success ${checks[item.id] === 'sucesso' ? 'active' : ''}" data-action="sucesso" data-id="${item.id}">Acertei</button>
                <button class="btn-sm btn-outline-danger ${checks[item.id] === 'falha' ? 'active' : ''}" data-action="falha" data-id="${item.id}">Errei</button>
            </div>
        `;
        container.appendChild(div);
    });

    // Adiciona os manipuladores de eventos nos botões recém-criados
    container.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            const action = e.target.getAttribute('data-action');
            onActionClick(id, action);
        });
    });
}

export function renderizarCalendario(items) {
    const container = document.getElementById('lista-calendario');
    container.innerHTML = '';

    const agrupado = {};
    items.forEach(item => {
        if (item.status === 'pausado') return;
        if (!agrupado[item.proximaRevisao]) agrupado[item.proximaRevisao] = [];
        agrupado[item.proximaRevisao].push(item);
    });

    const datasOrdenadas = Object.keys(agrupado).sort();

    if (datasOrdenadas.length === 0) {
        container.innerHTML = `<p class="text-secondary">Nenhum agendamento futuro encontrado.</p>`;
        return;
    }

    datasOrdenadas.forEach(data => {
        const totalCards = agrupado[data].filter(i => i.type === 'card').length;
        const totalFrases = agrupado[data].filter(i => i.type === 'frase').length;

        const div = document.createElement('div');
        div.className = 'timeline-day';
        div.innerHTML = `
            <h4>${formatarDataBr(data)}</h4>
            <p>${totalCards} Cards de palavras e ${totalFrases} Frases agendadas.</p>
        `;
        container.appendChild(div);
    });
}

export function atualizarSelectVinculos(items) {
    const select = document.getElementById('item-vinculo');
    select.innerHTML = '<option value="">Nenhum vínculo</option>';
    items.filter(i => i.type === 'card').forEach(card => {
        const opt = document.createElement('option');
        opt.value = card.id;
        opt.textContent = `Card: ${card.id}`;
        select.appendChild(opt);
    });
}

export function renderizarGerenciamento(items, busca = '', onAlterarNivel) {
    const tbody = document.getElementById('tabela-gerenciamento');
    tbody.innerHTML = '';

    const filtrados = items.filter(item => item.id.toLowerCase().includes(busca.toLowerCase()));

    filtrados.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.id}</strong></td>
            <td>${item.type === 'card' ? 'Card' : 'Frase'}</td>
            <td>
                <select class="mudar-nivel-select" data-id="${item.id}">
                    ${[1,2,3,4,5,6].map(n => `<option value="${n}" ${item.nivel === n ? 'selected' : ''}>Nível ${n}</option>`).join('')}
                </select>
            </td>
            <td><span class="badge" style="background-color: ${item.status === 'pausado' ? '#b71c1c' : '#2e7d32'}">${item.status}</span></td>
            <td><button class="btn-sm btn-danger btn-deletar" data-id="${item.id}">Excluir</button></td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.mudar-nivel-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
            onAlterarNivel(e.target.getAttribute('data-id'), parseInt(e.target.value));
        });
    });
}

export function dispararAlertaNivel3(nomePalavra) {
    Swal.fire({
        title: '🎯 Meta Alcançada!',
        text: `A palavra "${nomePalavra}" alcançou o Nível 3. Abra o seu Caderno Físico, escreva uma frase inédita com lacuna utilizando ela (respeitando o tamanho de 5 a 8 caracteres) e registre-a no sistema.`,
        icon: 'success',
        confirmButtonColor: '#4caf50',
        background: '#1e1e1e',
        color: '#e0e0e0'
    });
}

export function mostrarToast(titulo, icone = 'success') {
    Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        icon: icone,
        title: titulo,
        background: '#1e1e1e',
        color: '#e0e0e0'
    });
}

function formatarDataBr(dataStr) {
    const partes = dataStr.split('-');
    if (partes.length !== 3) return dataStr;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}