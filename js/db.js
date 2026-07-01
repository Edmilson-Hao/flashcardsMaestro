// js/db.js
const STORAGE_KEY = 'maestro_estudos_data';

export function getStorageData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return { items: [] };
    }
    return JSON.parse(raw);
}

export function saveStorageData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearStorageData() {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Lê o arquivo palavras.txt estruturado como um array JSON
 * e extrai apenas o caractere/termo (hanzi) para o sistema.
 */
export async function carregarPalavrasExternas() {
    try {
        const response = await fetch('./palavras.txt');
        if (!response.ok) return [];
        
        // Como o seu arquivo é um JSON válido, fazemos o parse direto
        const listaPalavras = await response.json();
        
        // Mapeia o JSON para retornar apenas a string do Hanzi (Ex: "老师", "学生")
        return listaPalavras.map(item => item.hanzi ? item.hanzi.trim() : "").filter(h => h.length > 0);
    } catch (err) {
        console.error("Falha ao ler ou processar o arquivo de palavras JSON offline:", err);
        return [];
    }
}