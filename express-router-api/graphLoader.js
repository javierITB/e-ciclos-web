// graphLoader.js

const fs = require('fs').promises;
const osmtogeojson = require('osmtogeojson');
const { Grafo, Nodo, Camino } = require('./classes');

let G_CUSTOM = null;

// Función de simulación de atributos basada en la lógica de tu app.py
function simular_atributos(node_id, lat, lon) {
    // Simulación de datos para que los costes de ruteo funcionen
    // data['altitud_m'] = 400 + (data['y'] * -100) + random.uniform(0, 50)
    // data['peligrosidad'] = random.uniform(0.1, 0.9)
    const altitud_m = 400 + (lat * -100) + (Math.random() * 50);
    const peligrosidad = 0.1 + (Math.random() * 0.8);
    return { altitud_m, peligrosidad };
}

/**
 * Carga el grafo desde el archivo OSM y construye el Grafo personalizado.
 * (Reemplazo parcial de ox.graph_from_xml y G_CUSTOM.cargar_desde_networkx)
 */
async function cargar_grafo_osm(osm_file_path) {
    if (!await fs.access(osm_file_path).then(() => true).catch(() => false)) {
        console.error("⛔ Advertencia: El archivo OSM no existe.");
        return null;
    }

    try {
        const xmlData = await fs.readFile(osm_file_path, 'utf8');
        const geojson = osmtogeojson(xmlData);
        
        G_CUSTOM = new Grafo();
        let edge_id = 0;

        // 1. Crear Nodos
        const nodes = geojson.features.filter(f => f.geometry.type === 'Point');
        for (const feature of nodes) {
            const id_nodo = parseInt(feature.id.replace('node/', ''), 10);
            const [lon, lat] = feature.geometry.coordinates;
            const { altitud_m, peligrosidad } = simular_atributos(id_nodo, lat, lon);

            G_CUSTOM.agregar_nodo(id_nodo, lat, lon, altitud_m, peligrosidad);
        }

        // 2. Crear Caminos (Aristas) BIDIRECCIONALES
        const ways = geojson.features.filter(f => f.geometry.type === 'LineString');
        for (const feature of ways) {
            const coords = feature.geometry.coordinates;
            const nodeIds = feature.properties.nodes; 
            
            // Simular 'importancia' (basada en longitud o valor OSM)
            // Aquí, solo usamos un valor constante para simplificar ya que length es difícil de obtener sin OSMnx
            const importancia = 5; 
            
            // Iterar sobre los segmentos del Way
            for (let i = 0; i < coords.length - 1; i++) {
                const u = nodeIds[i];
                const v = nodeIds[i + 1];

                // Comprobar que los nodos están en el grafo
                if (!G_CUSTOM.nodos[u] || !G_CUSTOM.nodos[v]) continue;

                // Crear camino en dirección u → v
                edge_id++;
                G_CUSTOM.agregar_camino(edge_id, u, v, false, importancia);

                // Crear camino en dirección v → u (BIDIRECCIONAL)
                edge_id++;
                G_CUSTOM.agregar_camino(edge_id, v, u, false, importancia);
            }
        }
        
        console.log(`✅ Grafo cargado: ${G_CUSTOM.toString()}`);
        return G_CUSTOM;
    } catch (e) {
        console.error(`Error al cargar el grafo: ${e}`);
        G_CUSTOM = null;
        return null;
    }
}


/** Reemplaza get_node_coords */
function get_node_coords(node_id) {
    if (G_CUSTOM && node_id in G_CUSTOM.nodos) {
        const nodo = G_CUSTOM.nodos[node_id];
        return [nodo.latitud, nodo.longitud]; // [lat, lon]
    }
    return null;
}

/** Reemplaza get_nearest_node_id */
function get_nearest_node_id(lat, lon, max_dist = 50) {
    if (!G_CUSTOM) return null;
    
    let best_id = null;
    let best_d = Infinity;
    
    for (const nid in G_CUSTOM.nodos) {
        const nodo = G_CUSTOM.nodos[nid];
        const d = require('./router').haversine(lat, lon, nodo.latitud, nodo.longitud);
        
        if (d < best_d) {
            best_d = d;
            best_id = parseInt(nid);
        }
    }

    return best_d <= max_dist ? best_id : null;
}

module.exports = {
    cargar_grafo_osm,
    get_grafo: () => G_CUSTOM,
    get_node_coords,
    get_nearest_node_id
};