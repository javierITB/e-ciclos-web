// server.js

const express = require('express');
const cors = require('cors');
const { dijkstra, a_estrella } = require('./router');
const { cargar_grafo_osm, get_grafo, get_node_coords, get_nearest_node_id } = require('./graphLoader');
const { texto_a_nodo } = require('./nodeFinder');

const app = express();
const PORT = process.env.PORT || 5000;
const OSM_FILE = "./map_clean.osm";

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Configuración y Carga de Grafo Global ---
let G_CUSTOM = null;

async function init() {
    G_CUSTOM = await cargar_grafo_osm(OSM_FILE);
    if (!G_CUSTOM) {
        console.log("⛔ El grafo OSM no pudo ser cargado. Las APIs de ruteo fallarán.");
    }
}

// Cargar el grafo al inicio
init();


// --- ENDPOINTS (API REST) ---
app.get('/', (req, res) => {
    res.send("API REST para Ruteo en Grafo OSM - Backend Express");
});

/**
 * Endpoint 1: Convierte texto (dirección) a ID de nodo.
 * Reemplaza /search_node
 */
app.get('/search_node', async (req, res) => {
    const query = req.query.query;
    if (!query) {
        return res.status(400).json({ error: "Parámetro 'query' requerido." });
    }

    try {
        const node_id = await texto_a_nodo(query);
        const grafo = get_grafo();
        
        if (node_id === -1 || !grafo || !(node_id in grafo.nodos)) {
            return res.status(404).json({ error: `Nodo para '${query}' no encontrado en el grafo.` });
        }

        const coords = get_node_coords(node_id);
        
        return res.json({
            node_id: node_id,
            lat: coords[0],
            lon: coords[1]
        });

    } catch (e) {
        console.error(`Error en search_node: ${e.message}`);
        return res.status(500).json({ error: `Error interno en la búsqueda: ${e.message}` });
    }
});

/**
 * Endpoint 2: Encuentra el nodo más cercano a un click de lat/lon.
 * Reemplaza /click_node
 */
app.get('/click_node', (req, res) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lon = parseFloat(req.query.lon);
        
        if (isNaN(lat) || isNaN(lon)) {
            return res.status(400).json({ error: "Coordenadas lat y lon requeridas y deben ser números." });
        }

        const node_id = get_nearest_node_id(lat, lon);
        
        if (G_CUSTOM === null) {
             return res.status(503).json({ error: "Grafo no cargado." });
        }
        
        if (node_id === null || node_id === -1) {
            return res.status(404).json({ error: "Nodo cercano no encontrado en el grafo." });
        }
        
        const coords = get_node_coords(node_id);

        return res.json({
            node_id: node_id,
            lat: coords[0],
            lon: coords[1]
        });
        
    } catch (e) {
        console.error(`Error en click_node: ${e.message}`);
        return res.status(500).json({ error: `Error interno en la búsqueda de nodo: ${e.message}` });
    }
});


/**
 * Endpoint 3: Calcula Dijkstra y A* entre dos IDs de nodo.
 * Reemplaza /calculate_route
 */
app.get('/calculate_route', (req, res) => {
    let origen_id, destino_id;
    try {
        origen_id = parseInt(req.query.origin);
        destino_id = parseInt(req.query.destination);
    } catch (e) {
        return res.status(400).json({ error: "IDs de Origen y Destino requeridos y deben ser enteros." });
    }
    
    G_CUSTOM = get_grafo();
    if (!G_CUSTOM || !(origen_id in G_CUSTOM.nodos) || !(destino_id in G_CUSTOM.nodos)) {
        return res.status(500).json({ error: "Origen o Destino inválido, o grafo no cargado." });
    }
        
    // Parámetros de ruteo
    const W_DIST = 1.0;
    const W_ELEV = 0.0;
    const W_SEG = 1000.0;
    const pesos = { w_dist: W_DIST, w_elev: W_ELEV, w_seg: W_SEG };
    
    // 1. Ejecutar Dijkstra
    let ruta_dijkstra_ids = [];
    let ruta_dijkstra_coords = [];
    try {
        const { prev: prev_dijkstra } = dijkstra(G_CUSTOM, origen_id, destino_id, pesos);
        if (destino_id in prev_dijkstra && prev_dijkstra[destino_id] !== null) {
            ruta_dijkstra_ids = require('./router').reconstruir_camino(prev_dijkstra, origen_id, destino_id);
            ruta_dijkstra_coords = ruta_dijkstra_ids
                .map(nid => get_node_coords(nid))
                .filter(c => c !== null);
        }
    } catch (e) {
        console.error(`Error en Dijkstra: ${e.message}`);
    }

    // 2. Ejecutar A*
    let ruta_astar_ids = [];
    let ruta_astar_coords = [];
    try {
        ruta_astar_ids = a_estrella(G_CUSTOM, origen_id, destino_id, pesos);
        if (ruta_astar_ids) {
            ruta_astar_coords = ruta_astar_ids
                .map(nid => get_node_coords(nid))
                .filter(c => c !== null);
        }
    } catch (e) {
        console.error(`Error en A*: ${e.message}`);
    }

    return res.json({
        dijkstra_ids: ruta_dijkstra_ids,
        dijkstra_coords: ruta_dijkstra_coords,
        astar_ids: ruta_astar_ids || [],
        astar_coords: ruta_astar_coords
    });
});

// Iniciar servidor
app.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 Servidor Express iniciado en http://127.0.0.1:${PORT}...`);
});