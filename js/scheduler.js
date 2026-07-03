// js/scheduler.js

const INTERVALOS = {
    1: 1,
    2: 2,
    3: 4,
    4: 7,
    5: 15,
    6: 30
};

/**
 * Calcula a data futura de revisão com base no nível do sistema Leitner.
 * @param {number} nivel - Nível de 1 a 6.
 * @param {Date} dataBase - Data de partida para o cálculo.
 * @returns {string} Data formatada em ISO (AAAA-MM-DD).
 */
export function calcularProximaData(nivel, dataBase = new Date()) {
    const dias = INTERVALOS[nivel] || 1;
    const resultado = new Date(dataBase);
    resultado.setDate(resultado.getDate() + dias);
    return resultado.toISOString().split('T')[0];
}

/**
 * Executa a Regra de Ouro dos 5 a 8 caracteres contando estritamente os ideogramas chineses.
 * Ignora caracteres alfanuméricos, espaços, pontuações e a marcação de índice (Ex: #1).
 * @param {string} frase - String completa vinda do formulário.
 * @returns {boolean} True se estiver estritamente entre 5 e 8 caracteres chineses.
 */
export function validarTamanhoFrase(frase) {
    const caracteresChineses = frase.match(/[\u4e00-\u9fa5]/g) || [];
    return caracteresChineses.length >= 5 && caracteresChineses.length <= 8;
}

/**
 * Processa as respostas da sessão atual, aplicando progressão, regressão e controle de atrasos.
 * @param {Array} items - Lista total de itens do estado.
 * @param {Object} checks - Mapeamento de respostas da sessão { id: 'sucesso'|'falha' }.
 * @returns {Object} Objeto com o estado final e o array de IDs que dispararam o nível 3.
 */
export function processarSessaoRevisao(items, checks) {
    const hojeStr = new Date().toISOString().split('T')[0];
    let mudancasNivel3 = [];

    const itemsAtualizados = items.map(item => {
        // Regra de Controle de Atrasos: Itens não respondidos na fila de hoje acumulam para amanhã
        if (!checks.hasOwnProperty(item.id)) {
            if (item.proximaRevisao <= hojeStr && item.status !== 'pausado') {
                return { ...item, proximaRevisao: calcularProximaData(1, new Date()) };
            }
            return item;
        }

        const resposta = checks[item.id];
        let novoNivel = item.nivel;
        let novoStatus = item.status;

        if (resposta === 'sucesso') {
            if (novoNivel < 6) {
                novoNivel += 1;
                // Gatilho visual: Palavra promovida do Nível 2 para o Nível 3
                if (item.type === 'card' && novoNivel === 3) {
                    mudancasNivel3.push(item.id);
                }
            }
        } else if (resposta === 'falha') {
            novoNivel = 1;
        }

        const proximaData = calcularProximaData(novoNivel, new Date());

        return {
            ...item,
            nivel: novoNivel,
            proximaRevisao: proximaData,
            status: novoStatus
        };
    });

    // Aplica a lógica em cascata de herança e dependência de status antes de salvar
    const estadoFinal = aplicarRegrasCascata(itemsAtualizados);

    return { estadoFinal, mudancasNivel3 };
}

/**
 * Garante que se um Card cair para o Nível 1, suas frases vinculadas entrem em modo "pausado".
 * Se o Card retornar para o Nível >= 3, as frases voltam a ficar ativas no cronograma.
 * @param {Array} items - Itens pré-processados.
 * @returns {Array} Itens com o status de ciclo de vida corrigido em cascata.
 */
function aplicarRegrasCascata(items) {
    return items.map(item => {
        if (item.type === 'frase' && item.vinculo) {
            const cardPai = items.find(p => p.id === item.vinculo && p.type === 'card');
            if (cardPai) {
                if (cardPai.nivel === 1) {
                    return { ...item, status: 'pausado' };
                } else if (cardPai.nivel >= 3 && item.status === 'pausado') {
                    return { ...item, status: 'ativo' };
                }
            }
        }
        return item;
    });
}