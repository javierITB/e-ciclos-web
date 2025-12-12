// router.js

const { Grafo, Nodo, Camino } = require('./classes');

// Reemplaza a distancia_haversine
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000.0;
    const toRad = (x) => (x * Math.PI) / 180;

    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const dphi = toRad(lat2 - lat1);
    const dlambda = toRad(lon2 - lon1);

    const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

// Reemplaza a coste_arista
function coste_arista(camino, nodo_origen, nodo_destino, w_dist = 1.0, w_elev = 0.0, w_seg = 0.0) {
    const distancia = haversine(nodo_origen.latitud, nodo_origen.longitud, nodo_destino.latitud, nodo_destino.longitud);
    const ganancia_altura = Math.max(0.0, nodo_destino.altura - nodo_origen.altura);
    // Se invierte la importancia porque una mayor importancia en el original (1/100, 1/200) significaba menos penalización.
    const seguridad = nodo_destino.prob_accidente * (1.0 / Math.max(1.0, camino.importancia));

    return w_dist * distancia + w_elev * ganancia_altura + w_seg * seguridad;
}

// Reemplaza a reconstruir_camino
function reconstruir_camino(prev, inicio_id, objetivo_id) {
    const camino = [];
    let actual = objetivo_id;
    while (actual !== null && actual !== undefined) {
        camino.push(actual);
        if (actual === inicio_id) break;
        actual = prev[actual];
    }
    return camino.reverse();
}

/**
 * Reemplaza a dijkstra
 * @param {Grafo} grafo
 * @param {number} inicio_id
 * @param {number} objetivo_id
 * @param {object} pesos
 */
function dijkstra(grafo, inicio_id, objetivo_id = null, { w_dist = 1.0, w_elev = 0.0, w_seg = 0.0 } = {}) {
    const dist = {};
    const prev = {};
    const cola = []; // Array que simulará un Min-Heap (usaremos un simple Array.sort para simplicidad)

    for (const id in grafo.nodos) {
        dist[id] = Infinity;
        prev[id] = null;
    }
    dist[inicio_id] = 0.0;
    cola.push({ d: 0.0, id: inicio_id });

    while (cola.length > 0) {
        // En un grafo grande, esto sería lento. Se debería usar una librería de MinHeap real.
        cola.sort((a, b) => a.d - b.d);
        const { d: d_act, id: nid } = cola.shift();

        if (d_act > dist[nid]) continue;
        if (objetivo_id !== null && nid === objetivo_id) break;

        const nodo = grafo.nodos[nid];
        for (const camino of nodo.caminos) {
            const otro = camino.obtener_otro_nodo(nodo);
            if (otro === null) continue;
            
            // Si el camino es bidireccional, necesitamos asegurarnos de que el origen sea 'nodo'
            // En tu implementacion de python, el grafo se construia con aristas u->v y v->u
            // Aquí, cada Camino apunta a A y B. Usamos 'nodo' como origen y 'otro' como destino.

            const c = coste_arista(camino, nodo, otro, w_dist, w_elev, w_seg);
            const nd = d_act + c;

            if (nd < dist[otro.id]) {
                dist[otro.id] = nd;
                prev[otro.id] = nid;
                // Verificar si ya está en la cola y actualizar o añadir
                const existing = cola.find(item => item.id === otro.id);
                if (existing) {
                    existing.d = nd; // Actualizar en su lugar
                } else {
                    cola.push({ d: nd, id: otro.id });
                }
            }
        }
    }

    return { dist, prev };
}

/**
 * Reemplaza a a_estrella
 * @param {Grafo} grafo
 * @param {number} inicio_id
 * @param {number} objetivo_id
 * @param {object} pesos
 */
function a_estrella(grafo, inicio_id, objetivo_id, { w_dist = 1.0, w_elev = 0.0, w_seg = 0.0 } = {}) {
    if (!(inicio_id in grafo.nodos) || !(objetivo_id in grafo.nodos)) {
        return null;
    }
    const inicio = grafo.nodos[inicio_id];
    const objetivo = grafo.nodos[objetivo_id];

    const gscore = {}; // Coste real desde el inicio
    const fscore = {}; // Coste estimado total (gscore + heurística)
    const viene_de = {};
    const abierto = []; // Min-Heap simulado con { f: fscore, id: id }

    for (const id in grafo.nodos) {
        gscore[id] = Infinity;
        fscore[id] = Infinity;
        viene_de[id] = null;
    }

    gscore[inicio_id] = 0.0;
    const h0 = w_dist * haversine(inicio.latitud, inicio.longitud, objetivo.latitud, objetivo.longitud);
    fscore[inicio_id] = h0;
    abierto.push({ f: fscore[inicio_id], id: inicio_id });

    while (abierto.length > 0) {
        abierto.sort((a, b) => a.f - b.f);
        const { id: actual_id } = abierto.shift();

        if (actual_id === objetivo_id) {
            return reconstruir_camino(viene_de, inicio_id, objetivo_id);
        }

        const actual = grafo.nodos[actual_id];
        for (const camino of actual.caminos) {
            const vecino = camino.obtener_otro_nodo(actual);
            if (vecino === null) continue;

            const tent_g = gscore[actual_id] + coste_arista(camino, actual, vecino, w_dist, w_elev, w_seg);

            if (tent_g < gscore[vecino.id]) {
                viene_de[vecino.id] = actual_id;
                gscore[vecino.id] = tent_g;
                
                const h = w_dist * haversine(vecino.latitud, vecino.longitud, objetivo.latitud, objetivo.longitud);
                fscore[vecino.id] = tent_g + h;
                
                // Actualizar o añadir en la cola
                const existingIndex = abierto.findIndex(item => item.id === vecino.id);
                if (existingIndex > -1) {
                    abierto[existingIndex].f = fscore[vecino.id];
                } else {
                    abierto.push({ f: fscore[vecino.id], id: vecino.id });
                }
            }
        }
    }

    return null; // Ruta no encontrada
}


module.exports = { dijkstra, a_estrella, reconstruir_camino, haversine };