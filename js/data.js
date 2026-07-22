/**
 * MAESTRO SRS - Módulo de Dados (data.js)
 * Responsável por:
 * - Carregar mestre.json
 * - Gerenciar localStorage (pool de estudadas)
 * - Exportar/Importar JSONL
 * - Gerar IDs conforme especificação
 */

const DataModule = (function() {
  'use strict';

  const STORAGE_KEY = 'maestro_srs_pool';
  let mestreData = null;
  let poolCache = null;

  /**
   * Inicializa o módulo carregando a lista mestre
   */
  async function init() {
    try {
      const response = await fetch('/mestre.json');
      if (!response.ok) throw new Error('mestre.json não encontrado');
      mestreData = await response.json();
      console.log('Mestre carregado:', mestreData.length, 'frases');
      return true;
    } catch (error) {
      console.error('Erro ao carregar mestre.json:', error);
      // Dados de fallback para desenvolvimento
      mestreData = getFallbackMestre();
      return true;
    }
  }

  /**
   * Dados fallback caso mestre.json não esteja disponível
   */
  function getFallbackMestre() {
    return [
      {
        id: 1,
        hanzi: "我喜欢喝热汤。",
        pinyin: "wǒ xǐhuan hē rè tāng.",
        traducao: "Eu gosto de beber sopa quente.",
        palavras: [
          { hanzi: "我", pinyin: "wǒ", traducao: "eu" },
          { hanzi: "喜欢", pinyin: "xǐhuan", traducao: "gostar" },
          { hanzi: "喝", pinyin: "hē", traducao: "beber" },
          { hanzi: "热", pinyin: "rè", traducao: "quente" },
          { hanzi: "汤", pinyin: "tāng", traducao: "sopa" }
        ]
      },
      {
        id: 2,
        hanzi: "他去超市买东西。",
        pinyin: "tā qù chāoshì mǎi dōngxi.",
        traducao: "Ele vai ao supermercado comprar coisas.",
        palavras: [
          { hanzi: "他", pinyin: "tā", traducao: "ele" },
          { hanzi: "去", pinyin: "qù", traducao: "ir" },
          { hanzi: "超市", pinyin: "chāoshì", traducao: "supermercado" },
          { hanzi: "买", pinyin: "mǎi", traducao: "comprar" },
          { hanzi: "东西", pinyin: "dōngxi", traducao: "coisas" }
        ]
      },
      {
        id: 3,
        hanzi: "今天天气很好。",
        pinyin: "jīntiān tiānqì hěn hǎo.",
        traducao: "O tempo hoje está muito bom.",
        palavras: [
          { hanzi: "今天", pinyin: "jīntiān", traducao: "hoje" },
          { hanzi: "天气", pinyin: "tiānqì", traducao: "tempo" },
          { hanzi: "很", pinyin: "hěn", traducao: "muito" },
          { hanzi: "好", pinyin: "hǎo", traducao: "bom" }
        ]
      }
    ];
  }

  /**
   * Obtém a lista mestre completa
   */
  function getMestre() {
    return mestreData || [];
  }

  /**
   * Obtém uma frase específica da mestre pelo ID
   */
  function getFraseById(id) {
    return mestreData.find(f => f.id === parseInt(id)) || null;
  }

  /**
   * Carrega o pool de estudadas do localStorage
   */
  function loadPool() {
    if (poolCache) return poolCache;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        poolCache = [];
        return poolCache;
      }
      poolCache = JSON.parse(stored);
      return poolCache;
    } catch (error) {
      console.error('Erro ao carregar pool:', error);
      poolCache = [];
      return poolCache;
    }
  }

  /**
   * Salva o pool no localStorage
   */
  function savePool(pool) {
    poolCache = pool;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pool));
      return true;
    } catch (error) {
      console.error('Erro ao salvar pool:', error);
      return false;
    }
  }

  /**
   * Gera ID para frase da mestre: "f" + id
   */
  function generateFraseId(fraseId) {
    return `f${fraseId}`;
  }

  /**
   * Gera ID para palavra extraída da mestre: "p" + id_frase + "_" + indice
   */
  function generatePalavraId(fraseId, indice) {
    return `p${fraseId}_${indice}`;
  }

  /**
   * Gera ID para palavra customizada: "c" + timestamp
   */
  function generateCustomId() {
    return `c${Date.now()}`;
  }

  /**
   * Verifica se um item já existe no pool
   */
  function itemExistsInPool(pool, itemId) {
    return pool.some(item => item.id === itemId);
  }

  /**
   * Adiciona uma frase da mestre ao pool
   * @param {number} fraseId - ID da frase na mestre
   * @returns {object|null} - Item adicionado ou null se já existir
   */
  function addFraseToPool(fraseId) {
    const frase = getFraseById(fraseId);
    if (!frase) return null;

    const pool = loadPool();
    const itemId = generateFraseId(fraseId);

    if (itemExistsInPool(pool, itemId)) {
      return null; // Já existe
    }

    const newItem = {
      id: itemId,
      tipo: 'frase',
      hanzi: frase.hanzi,
      pinyin: frase.pinyin,
      traducao: frase.traducao,
      nivel: 1,
      dataInicio: new Date().toISOString(),
      proximaRevisao: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 1 dia
    };

    pool.push(newItem);
    savePool(pool);
    return newItem;
  }

  /**
   * Adiciona uma palavra específica ao pool
   * @param {number} fraseId - ID da frase na mestre
   * @param {number} indice - Índice da palavra nas palavras da frase
   * @param {boolean} isCustom - Se é palavra customizada (usa ID tipo "c")
   * @returns {object|null} - Item adicionado ou null se já existir
   */
  function addPalavraToPool(fraseId, indice, isCustom = false) {
    const frase = getFraseById(fraseId);
    if (!frase || !frase.palavras[indice]) return null;

    const palavra = frase.palavras[indice];
    const pool = loadPool();
    
    const itemId = isCustom ? generateCustomId() : generatePalavraId(fraseId, indice);

    if (itemExistsInPool(pool, itemId)) {
      return null; // Já existe
    }

    const newItem = {
      id: itemId,
      tipo: 'palavra',
      hanzi: palavra.hanzi,
      pinyin: palavra.pinyin,
      traducao: palavra.traducao,
      nivel: 1,
      dataInicio: new Date().toISOString(),
      proximaRevisao: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 1 dia
    };

    pool.push(newItem);
    savePool(pool);
    return newItem;
  }

  /**
   * Adiciona uma palavra customizada manual ao pool
   * @param {string} hanzi 
   * @param {string} pinyin 
   * @param {string} traducao 
   * @returns {object} - Item criado
   */
  function addCustomPalavra(hanzi, pinyin, traducao) {
    const pool = loadPool();
    const itemId = generateCustomId();

    const newItem = {
      id: itemId,
      tipo: 'palavra',
      hanzi: hanzi,
      pinyin: pinyin,
      traducao: traducao,
      nivel: 1,
      dataInicio: new Date().toISOString(),
      proximaRevisao: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    pool.push(newItem);
    savePool(pool);
    return newItem;
  }

  /**
   * Atualiza um item no pool (após revisão SRS)
   * @param {string} itemId 
   * @param {object} updates - Campos a atualizar
   * @returns {boolean}
   */
  function updateItem(itemId, updates) {
    const pool = loadPool();
    const index = pool.findIndex(item => item.id === itemId);
    
    if (index === -1) return false;

    // Nunca alterar campos imutáveis
    const immutableFields = ['id', 'tipo', 'hanzi', 'pinyin', 'traducao', 'dataInicio'];
    for (const field of immutableFields) {
      if (updates[field] !== undefined) {
        console.warn(`Tentativa de alterar campo imutável: ${field}`);
        delete updates[field];
      }
    }

    pool[index] = { ...pool[index], ...updates };
    savePool(pool);
    return true;
  }

  /**
   * Obtém itens do pool que estão devidos para revisão
   * @param {Date} referenceDate - Data de referência (padrão: agora)
   * @returns {Array}
   */
  function getDueItems(referenceDate = new Date()) {
    const pool = loadPool();
    const now = referenceDate.getTime();
    
    return pool.filter(item => {
      const revisaoDate = new Date(item.proximaRevisao).getTime();
      return revisaoDate <= now;
    });
  }

  /**
   * Obtém todos os itens do pool
   */
  function getAllPoolItems() {
    return loadPool();
  }

  /**
   * Obtém estatísticas do pool
   */
  function getStats() {
    const pool = loadPool();
    const total = pool.length;
    const learned = pool.filter(i => i.nivel >= 10).length;
    const due = getDueItems().length;
    
    return { total, learned, due };
  }

  /**
   * Exporta pool como JSONL (uma linha por JSON)
   */
  function exportToJSONL() {
    const pool = loadPool();
    return pool.map(item => JSON.stringify(item)).join('\n');
  }

  /**
   * Importa pool de JSONL
   * @param {string} jsonlString 
   * @param {boolean} merge - Se true, mescla com pool existente; se false, substitui
   * @returns {object} - { success: boolean, imported: number, errors: number }
   */
  function importFromJSONL(jsonlString, merge = true) {
    const lines = jsonlString.trim().split('\n');
    let imported = 0;
    let errors = 0;
    const newPool = merge ? [...loadPool()] : [];
    const existingIds = new Set(newPool.map(item => item.id));

    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const item = JSON.parse(line);
        
        // Validação básica
        const requiredFields = ['id', 'tipo', 'hanzi', 'pinyin', 'traducao', 'nivel', 'dataInicio', 'proximaRevisao'];
        if (!requiredFields.every(f => item.hasOwnProperty(f))) {
          errors++;
          continue;
        }

        // Evitar duplicatas
        if (existingIds.has(item.id)) {
          continue;
        }

        newPool.push(item);
        existingIds.add(item.id);
        imported++;
      } catch (error) {
        console.error('Erro ao importar linha:', line, error);
        errors++;
      }
    }

    savePool(newPool);
    return { success: true, imported, errors };
  }

  /**
   * Limpa todo o pool (reset)
   */
  function clearPool() {
    poolCache = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  // API pública
  return {
    init,
    getMestre,
    getFraseById,
    loadPool,
    addFraseToPool,
    addPalavraToPool,
    addCustomPalavra,
    updateItem,
    getDueItems,
    getAllPoolItems,
    getStats,
    exportToJSONL,
    importFromJSONL,
    clearPool,
    generateFraseId,
    generatePalavraId
  };

})();
