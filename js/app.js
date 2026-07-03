// js/app.js

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
    document.getElementsByName('item-type').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const vinculoGroup = document.querySelector('.id-vinculo-group');
            const labelIdentificador = document.getElementById('label-identificador');
            
            if (e.target.value === 'frase') {
                vinculoGroup.classList.remove('hidden');
                labelIdentificador.textContent = "Número da Frase (Índice Caderno: Ex #1 - 你好)";
            } else {
                vinculoGroup.classList.add('hidden');
                labelIdentificador.textContent = "Identificador / Nome";
            }
        });
    });

    // Evento de Submissão e Validação Inteligente de Entrada de Dados
    document.getElementById('form-agendamento').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const type = document.querySelector('input[name="item-type"]:checked').value;
        const id = document.getElementById('item-id').value.trim();
        const vinculo = document.getElementById('item-vinculo').value;
        const nivel = parseInt(document.getElementById('item-nivel').value);

        // Bloqueia duplicações idênticas no mesmo domínio
        if (STATE.items.some(i => i.id === id && i.type === type)) {
            ui.mostrarToast("Este identificador já se encontra agendado no sistema!", "error");
            return;
        }

        // Validação customizada para a Opção Eleita (#1 - 你好)
        if (type === 'frase') {
            const apenasChines = id.match(/[\u4e00-\u9fa5]/g) || [];
            const contagemReal = apenasChines.length;

            if (contagemReal < 5 || contagemReal > 8) {
                ui.mostrarToast(`Aviso: O texto contém ${contagemReal} caracteres chineses. O método exige entre 5 e 8! Verifique seu caderno físico.`, "warning");
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
        document.getElementById('label-identificador').textContent = "Identificador / Nome";
        
        ui.mostrarToast("Item agendado com sucesso!");
        renderAll();
    });

    // Finalização e persistência da fila "HOJE"
    document.getElementById('btn-finalizar').addEventListener('click', () => {
        if (Object.keys(SESSAO_CHECKS).length === 0) {
            ui.mostrarToast("Você precisa responder ao menos um item antes de finalizar!", "warning");
            return;
        }

        const { estadoFinal, mudancasNivel3 } = processarSessaoRevisao(STATE.items, SESSAO_CHECKS);
        STATE.items = estadoFinal;
        saveStorageData(STATE);
        SESSAO_CHECKS = {};
        
        ui.mostrarToast("Revisão de hoje concluída e arquivada!");
        renderAll();

        // Dispara os alertas SweetAlert para os cards promovidos ao nível 3
        mudancasNivel3.forEach(nomeCard => {
            ui.dispararAlertaNivel3(nomeCard);
        });
    });

    // Filtro de busca em tempo real (Avançado)
    document.getElementById('search-input').addEventListener('input', (e) => {
        ui.renderizarGerenciamento(STATE.items, e.target.value, handleAlterarNivel);
    });

    // Recarga limpa de ativos via Service Worker (Mantém localStorage intacto)
    document.getElementById('btn-atualizar-arquivos').addEventListener('click', () => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let registration of registrations) {
                    registration.update();
                }
                ui.mostrarToast("Ativos sincronizados com sucesso! Atualizando...");
                setTimeout(() => window.location.reload(), 800);
            });
        } else {
            window.location.reload();
        }
    });

    // Reset Total com caixa de confirmação de segurança (SweetAlert)
    document.getElementById('btn-reset-total').addEventListener('click', () => {
        Swal.fire({
            title: 'Limpar Banco de Dados?',
            text: "Esta ação é irreversível e apagará todo o seu progresso local!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f44336',
            cancelButtonColor: '#2196f3',
            confirmButtonText: 'Sim, resetar tudo!',
            cancelButtonText: 'Cancelar',
            background: '#1e1e1e',
            color: '#e0e0e0'
        }).then((result) => {
            if (result.isConfirmed) {
                clearStorageData();
                STATE = { items: [] };
                SESSAO_CHECKS = {};
                renderAll();
                Swal.fire({
                    title: 'Resetado!',
                    text: 'O armazenamento local foi limpo com sucesso.',
                    icon: 'success',
                    background: '#1e1e1e',
                    color: '#e0e0e0'
                });
            }
        });
    });

    // Delegação de eventos para exclusão direta na tabela de listagem
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
    ui.renderizarCalendario(STATE.items);
    ui.atualizarSelectVinculos(STATE.items);
    ui.renderizarGerenciamento(STATE.items, document.getElementById('search-input').value, handleAlterarNivel);
}