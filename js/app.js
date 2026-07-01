import { getStorageData, saveStorageData, clearStorageData, carregarPalavrasExternas } from './db.js';
import { calcularProximaData, validarTamanhoFrase, processarSessaoRevisao } from './scheduler.js';
import * as ui from './ui.js';

let STATE = { items: [] };
let SESSAO_CHECKS = {}; // Guarda as respostas temporárias da sessão { id: 'sucesso'|'falha' }

document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar Dados
    STATE = getStorageData();
    initAppEvents();
    renderAll();

    // Tenta registrar o service worker de forma silenciosa e offline
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js').catch(err => console.log(err));
    }
});

function initAppEvents() {
    // Sistema de Abas SPA
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

    // Toggle de Mudança de Formulário (Card vs Frase)
    document.getElementsByName('item-type').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const vieldGroup = document.querySelector('.id-vinculo-group');
            const labelIdentificador = document.getElementById('label-identificador');
            if (e.target.value === 'frase') {
                vieldGroup.classList.remove('hidden');
                labelIdentificador.textContent = "Número da Frase (Índice Caderno)";
            } else {
                vieldGroup.classList.add('hidden');
                labelIdentificador.textContent = "Identificador / Nome";
            }
        });
    });

    // Submissão do Formulário de Cadastro
    document.getElementById('form-agendamento').addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = document.querySelector('input[name="item-type"]:checked').value;
        const id = document.getElementById('item-id').value.trim();
        const vinculo = document.getElementById('item-vinculo').value;
        const nivel = parseInt(document.getElementById('item-nivel').value);

        if (STATE.items.some(i => i.id === id && i.type === type)) {
            ui.mostrarToast("Item já cadastrado!", "error");
            return;
        }

        if (type === 'frase') {
            // Se for inserido caracteres para validação na própria caixa de ID
            const palavrasDoArquivo = await carregarPalavrasExternas();
            if (id.length > 0 && !validarTamanhoFrase(id) && isNaN(id.replace('#', ''))) {
                 ui.mostrarToast("Atenção: Valide se a frase possui entre 5 e 8 caracteres no caderno físico!", "warning");
            }
        }

        const novoItem = {
            id,
            type,
            nivel,
            vinculo: type === 'frase' ? vinculo : null,
            proximaRevisao: calcularProximaData(nivel, new Date()),
            status: 'ativo'
        };

        STATE.items.push(novoItem);
        saveStorageData(STATE);
        e.target.reset();
        document.querySelector('.id-vinculo-group').classList.add('hidden');
        ui.mostrarToast("Agendado com sucesso!");
        renderAll();
    });

    // Processamento do Botão Finalizar Dia
    document.getElementById('btn-finalizar').addEventListener('click', () => {
        if (Object.keys(SESSAO_CHECKS).length === 0) {
            ui.mostrarToast("Nenhum item respondido nesta sessão.", "warning");
            return;
        }

        const { estadoFinal, mudancasNivel3 } = processarSessaoRevisao(STATE.items, SESSAO_CHECKS);
        STATE.items = estadoFinal;
        saveStorageData(STATE);
        SESSAO_CHECKS = {};
        
        ui.mostrarToast("Sessão finalizada e salva!");
        renderAll();

        // Dispara os alertas SweetAlert para os cartões que bateram nível 3
        mudancasNivel3.forEach(nomeCard => {
            ui.dispararAlertaNivel3(nomeCard);
        });
    });

    // Caixa de busca do painel avançado
    document.getElementById('search-input').addEventListener('input', (e) => {
        ui.renderizarGerenciamento(STATE.items, e.target.value, handleAlterarNivel);
    });

    // Botão Forçar Atualização de Arquivos
    document.getElementById('btn-atualizar-arquivos').addEventListener('click', () => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let registration of registrations) {
                    registration.update();
                }
                ui.mostrarToast("Arquivos sincronizados de forma limpa!");
                setTimeout(() => window.location.reload(), 800);
            });
        } else {
            window.location.reload();
        }
    });

    // Botão Reset Absoluto de Fábrica
    document.getElementById('btn-reset-total').addEventListener('click', () => {
        Swal.fire({
            title: 'Tem certeza?',
            text: "Você perderá todo o histórico de revisões salvas localmente!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sim, deletar tudo!',
            background: '#1e1e1e',
            color: '#e0e0e0'
        }).then((result) => {
            if (result.isConfirmed) {
                clearStorageData();
                STATE = { items: [] };
                SESSAO_CHECKS = {};
                renderAll();
                Swal.fire({ title: 'Zerado!', text: 'Banco de dados limpo.', icon: 'success', background: '#1e1e1e', color: '#e0e0e0' });
            }
        });
    });

    // Deleção de itens na tabela de gerenciamento via event delegation
    document.getElementById('tabela-gerenciamento').addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-deletar')) {
            const id = e.target.getAttribute('data-id');
            STATE.items = STATE.items.filter(i => i.id !== id);
            saveStorageData(STATE);
            renderAll();
            ui.mostrarToast("Item excluído.");
        }
    });
}

function handleItemResponse(id, action) {
    if (SESSAO_CHECKS[id] === action) {
        delete SESSAO_CHECKS[id]; // Desmarca se clicar de novo no mesmo botão
    } else {
        SESSAO_CHECKS[id] = action;
    }
    ui.renderizarFilaHoje(STATE.items, SESSAO_CHECKS, handleItemResponse);
}

function handleAlterarNivel(id, novoNivel) {
    STATE.items = STATE.items.map(item => {
        if (item.id === id) {
            return { ...item, nivel: novoNivel, proximaRevisao: calcularProximaData(novoNivel, new Date()) };
        }
        return item;
    });
    saveStorageData(STATE);
    ui.mostrarToast("Nível alterado manualmente.");
    renderAll();
}

function renderAll() {
    ui.renderizarFilaHoje(STATE.items, SESSAO_CHECKS, handleItemResponse);
    ui.renderizarCalendario(STATE.items);
    ui.atualizarSelectVinculos(STATE.items);
    ui.renderizarGerenciamento(STATE.items, document.getElementById('search-input').value, handleAlterarNivel);
}