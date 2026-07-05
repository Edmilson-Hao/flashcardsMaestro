const STORAGE_KEY = 'maestro_estudos_data';

/**
 * Recupera todos os dados do estado da aplicação salvos no localStorage.
 * @returns {Object} Objeto contendo o array de itens.
 */
export function getStorageData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return { items: [] };
    }
    return JSON.parse(raw);
}

/**
 * Salva o estado atualizado da aplicação no localStorage.
 * @param {Object} data - O estado completo da aplicação.
 */
export function saveStorageData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Remove completamente a chave do sistema do localStorage (Reset de Fábrica).
 */
export function clearStorageData() {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Realiza o fetch assíncrono do arquivo palavras.txt estruturado como um array JSON
 * e extrai apenas o caractere/termo (hanzi) limpo para uso em validações.
 * @returns {Promise<string[]>} Array de strings contendo os hanzis isolados.
 */
export async function carregarPalavrasExternas() {
    try {
        const response = await fetch('./palavras.txt');
        if (!response.ok) return [];
        
        const listaPalavras = await response.json();
        
        return listaPalavras
            .map(item => item.hanzi ? item.hanzi.trim() : "")
            .filter(h => h !== "");
    } catch (e) {
        console.error("Falha ao mapear dicionário externo para validação:", e);
        return [];
    }
}