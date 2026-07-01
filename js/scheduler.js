const INTERVALOS = {
    1: 1,
    2: 2,
    3: 4,
    4: 7,
    5: 15,
    6: 30
};

export function calcularProximaData(nivel, dataBase = new Date()) {
    const dias = INTERVALOS[nivel] || 1;
    const resultado = new Date(dataBase);
    resultado.setDate(resultado.getDate() + dias);
    return resultado.toISOString().split('T')[0];
}

export function validarTamanhoFrase(frase) {
    // Regex para filtrar apenas caracteres chineses comuns (Unified Ideographs)
    const caracteresChineses = frase.match(/[\u4e00-\u9fa5]/g) || [];
    return caracteresChineses.length >= 5 && caracteresChineses.length <= 8;
}

export function processarSessaoRevisao(items, checks) {
    const hojeStr = new Date().toISOString().split('T')[0];
    let mudancasNivel3 = [];

    const itemsAtualizados = items.map(item => {
        // Se o item não estava na lista de hoje ou não foi respondido, ignorar processamento aqui
        if (!checks.hasOwnProperty(item.id)) {
            // Regra de Controle de Atrasos: postergar não-revisados para amanhã
            if (item.proximaRevisao <= hojeStr && item.status !== 'pausado') {
                return { ...item, proximaRevisao: calcularProximaData(1, new Date()) };
            }
            return item;
        }

        const resposta = checks[item.id]; // 'sucesso' ou 'falha'
        let novoNivel = item.nivel;
        let novoStatus = item.status;

        if (resposta === 'sucesso') {
            if (novoNivel < 6) {
                novoNivel += 1;
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

    // Cascade Logic: Se um card de palavra falhou (Nível 1), pausar a frase vinculada
    const estadoFinal = aplicarRegrasCascata(itemsAtualizados, checks);

    return { estadoFinal, mudancasNivel3 };
}

function aplicarRegrasCascata(items, checks) {
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
        // Se o item for o card pai e subiu de nível, tirar a frase do estado pausado
        if (item.type === 'card') {
            const fraseFilha = items.find(f => f.vinculo === item.id && f.type === 'frase');
            if (fraseFilha && item.nivel >= 3 && fraseFilha.status === 'pausado') {
                // Atualiza em uma passada posterior ou resolve por varredura simples
            }
        }
        return item;
    });
}