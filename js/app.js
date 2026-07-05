import { getStorageData, saveStorageData, clearStorageData, carregarPalavrasExternas } from './db.js';
import { calcularProximaData, validarTamanhoFrase, processarSessaoRevisao } from './scheduler.js';
import * as ui from './ui.js';

let STATE = { items: [] };
let SESSAO_CHECKS = {}; // Cache de conferência rápida da sessão { id: 'sucesso'|'falha' }

document.addEventListener('DOMContentLoaded', async () => {
    // Inicialização do Estado
    STATE = getStorageData();
    initAppEvents();
    renderAll();

    // Registro transparente do Service Worker offline
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js').catch(err => {
            console.log("Aviso de registro do SW: ", err);
        });
    }
});

function initAppEvents() {
    // Gerenciador de Abas Dinâmicas SPA
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(t => t.classList.remove('active'));
            
            e.target.classList.add('active');
            const tabId = e.target.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            renderAll();
        });
    });

    // Alternância de escopo do Formulário de Cadastro (Card vs Frase)
    const radioCard = document.getElementById('type-card');
    const radioFrase = document.getElementById('type-frase');
    const labelId = document.getElementById('label-identificador');
    const vinculoGroup = document.querySelector('.id-vinculo-group');

    if (radioCard && radioFrase) {
        const atualizarCamposForm = () => {
            if (radioCard.checked) {
                labelId.textContent = "Identificador do Item (Palavra ou Bloco)";
                document.getElementById('item-id').placeholder = "Ex: 老师";
                vinculoGroup.classList.add('hidden');
                document.getElementById('item-vinculo').required = false;
            } else {
                labelId.textContent = "Número da Frase (Índice Caderno: Ex #1)";
                document.getElementById('item-id').placeholder = "Ex: #1";
                vinculoGroup.classList.remove('hidden');
                document.getElementById('item-vinculo').required = true;
                ui.popularSelectVinculos(STATE.items);
            }
        };

        radioCard.addEventListener('change', atualizarCamposForm);
        radioFrase.addEventListener('change', atualizarCamposForm);
    }

    // Submissão do Formulário de Cadastro
    document.getElementById('form-agendamento').addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('item-id').value.trim();
        const type = document.querySelector('name="item-type"').value || (radioCard.checked ? 'card' : 'frase');
        const nivel = parseInt(document.getElementById('item-nivel').value);
        const vinculo = type === 'frase' ? document.getElementById('item-vinculo').value : "";

        // Valida se o ID já existe para evitar duplicações de PK
        if (STATE.items.some(item => item.id === id)) {
            ui.mostrarToast("Este identificador já está registrado no sistema.", "error");
            return;
        }

        // Se for frase, aplica a validação de caracteres do caderno físico (5 a 8 caracteres)
        if (type === 'frase') {
            const hanzisDisponiveis = await carregarPalavrasExternas();
            const fraseLimpa = hanzisDisponiveis.find(h => id.includes(h)) || id;

            if (!validarTamanhoFrase(fraseLimpa)) {
                ui.mostrarToast("A frase deve conter entre 5 e 8 caracteres chineses (Regra do Caderno).", "warning");
                return;
            }
        }

        // Calcula a data com base no dia corrente do dispositivo do usuário
        const hojeLocal = new Date();
        const proximaRevisao = calcularProximaData(nivel, hojeLocal);

        const novoItem = {
            id,
            type,
            nivel,
            proximaRevisao,
            vinculo,
            status: 'ativo',
            dataCriacao: hojeLocal.toISOString().split('T')[0]
        };

        STATE.items.push(novoItem);
        saveStorageData(STATE);
        
        ui.mostrarToast("Item agendado com sucesso!");
        e.target.reset();
        
        // Garante o fechamento das caixas ocultas após reset do form
        vinculoGroup.classList.add('hidden');
        labelId.textContent = "Identificador do Item (Palavra ou Bloco)";
        
        renderAll();
    });

    // Submissão/Finalização da Sessão de Revisão do Dia
    document.getElementById('btn-finalizar').addEventListener('click', () => {
        if (Object.keys(SESSAO_CHECKS).length === 0) {
            ui.mostrarToast("Avalie os itens antes de finalizar a sessão.", "warning");
            return;
        }

        const { estadoFinal, mudancasNivel3 } = processarSessaoRevisao(STATE.items, SESSAO_CHECKS);
        
        STATE.items = estadoFinal;
        saveStorageData(STATE);

        // Dispara alertas comemorativos para cada item que atingiu o Nível 3
        mudancasNivel3.forEach(nomeCard => {
            ui.dispararAlertaNivel3(nomeCard);
        });

        ui.mostrarToast("Sessão finalizada e prazos recalculados!");
        SESSAO_CHECKS = {}; // Limpa cache da sessão corrente
        renderAll();
    });

    // Listener para o botão de forçar reload de arquivos estáticos
    document.getElementById('btn-atualizar-arquivos').addEventListener('click', () => {
        ui.mostrarToast("Atualizando cache do sistema...", "warning");
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ action: 'skipWaiting' });
        }
        setTimeout(() => {
            window.location.reload(true);
        }, 800);
    });

    // Listener para Reset Total de Fábrica
    document.getElementById('btn-reset-total').addEventListener('click', () => {
        Swal.fire({
            title: 'Tem certeza?',
            text: "Todos os seus cronogramas e dados de revisão locais serão apagados permanentemente!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f44336',
            cancelButtonColor: '#333333',
            confirmButtonText: 'Sim, resetar tudo!',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                clearStorageData();
                STATE = { items: [] };
                SESSAO_CHECKS = {};
                renderAll();
                ui.mostrarToast("O sistema foi resetado para os padrões de fábrica.", "error");
            }
        });
    });

    // Caixa de pesquisa dinâmica na aba avançado
    document.getElementById('search-input').addEventListener('input', (e) => {
        const termo = e.target.value.toLowerCase().trim();
        ui.renderizarTabelaGerenciamento(STATE.items, termo, handleAlterarNivel);
    });

    // Delegação de eventos para remoção individual de linhas na tabela
    document.getElementById('tabela-gerenciamento').addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-deletar')) {
            const id = e.target.getAttribute('data-id');
            STATE.items = STATE.items.filter(i => i.id !== id);
            saveStorageData(STATE);
            renderAll();
            ui.mostrarToast("O registro foi removido com sucesso.");
        }
    });
}

function handleItemResponse(id, action) {
    if (SESSAO_CHECKS[id] === action) {
        delete SESSAO_CHECKS[id]; 
    } else {
        SESSAO_CHECKS[id] = action;
    }
    ui.renderizarFilaHoje(STATE.items, SESSAO_CHECKS, handleItemResponse);
}

function handleAlterarNivel(id, novoNivel) {
    STATE.items = STATE.items.map(item => {
        if (item.id === id) {
            return { 
                ...item, 
                nivel: novoNivel, 
                proximaRevisao: calcularProximaData(novoNivel, new Date()),
                status: (item.type === 'frase' && item.status === 'pausado') ? 'ativo' : item.status
            };
        }
        return item;
    });
    saveStorageData(STATE);
    ui.mostrarToast("Nível do cronograma alterado manualmente.");
    renderAll();
}

function renderAll() {
    ui.renderizarFilaHoje(STATE.items, SESSAO_CHECKS, handleItemResponse);
    ui.renderizarCalendarioFuturo(STATE.items);
    
    // CORREÇÃO: Passando explicitamente a função handleAlterarNivel no segundo parâmetro
    ui.renderizarTabelaGerenciamento(STATE.items, handleAlterarNivel);
    
    // Atualização dos cards de métricas (se houver no HTML)
    const metricAtivos = document.getElementById('metric-ativos');
    const metricFrases = document.getElementById('metric-frases');
    const metricPausados = document.getElementById('metric-pausados');
    
    if (metricAtivos) metricAtivos.innerText = STATE.items.filter(i => i.type === 'card' && i.status !== 'pausado').length;
    if (metricFrases) metricFrases.innerText = STATE.items.filter(i => i.type === 'frase').length;
    if (metricPausados) metricPausados.innerText = STATE.items.filter(i => i.status === 'pausado').length;
}