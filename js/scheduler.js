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
 * Força o cálculo baseado estritamente no fuso horário local do dispositivo,
 * garantindo que itens marcados como 'falha' (Nível 1) sejam agendados para amanhã.
 * @param {number} nivel - Nível de 1 a 6.
 * @param {Date} dataBase - Data de partida para o cálculo.
 * @returns {string} Data formatada em padrão local (AAAA-MM-DD).
 */
export function calcularProximaData(nivel, dataBase = new Date()) {
    const dias = INTERVALOS[nivel] || 1;
    
    // Cria uma nova instância de data baseada no fuso horário local
    const resultado = new Date(dataBase.getFullYear(), dataBase.getMonth(), dataBase.getDate());
    
    // Adiciona os dias de intervalo correspondentemente
    resultado.setDate(resultado.getDate() + dias);
    
    // Formata manualmente em AAAA-MM-DD usando o horário local para evitar quebras do ISO/UTC
    const ano = resultado.getFullYear();
    const mes = String(resultado.getMonth() + 1).padStart(2, '0');
    const dia = String(resultado.getDate()).padStart(2, '0');
    
    return `${ano}-${mes}-${dia}`;
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
 * Processas as respostas da sessão atual, aplicando progressão
 * ou regressão para o Nível 1 caso falhe.
 * @param {Array} items - Array de itens vindos do STATE.
 * @param {Object} respostas - Objeto com as conferências da sessão { id: 'sucesso'|'falha' }
 * @returns {Object} Objeto com o estado final atualizado e mutações de nível 3.
 */
export function processarSessaoRevisao(items, respostas) {
    const mudancasNivel3 = [];

    const itemsAtualizados = items.map(item => {
        const resposta = respostas[item.id];
        if (!resposta) return item; // Se não foi revisado nesta sessão, mantém intocado

        let novoNivel = item.nivel;
        let novoStatus = item.status;

        if (resposta === 'sucesso') {
            if (item.nivel < 6) {
                novoNivel = item.nivel + 1;
                // Se um card atingir o Nível 3, registra o evento para disparar o alerta
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