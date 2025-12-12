// nodeFinder.js

const fetch = require('node-fetch');
const { get_nearest_node_id, get_grafo } = require('./graphLoader');

// Reemplaza a obtener_coordenadas_osm
async function obtener_coordenadas_osm(direccion) {
    const url = "https://photon.komoot.io/api/";
    const params = new URLSearchParams({
        q: `${direccion}, Región Metropolitana, Chile`,
        limit: 1
    });

    try {
        const response = await fetch(`${url}?${params.toString()}`, {
            headers: { "User-Agent": "MiAppGeolocalizacion/1.0" },
            timeout: 10000 
        });

        if (!response.ok) return null;

        const data = await response.json();
        const features = data.features || [];
        if (features.length === 0) return null;

        const [lon, lat] = features[0].geometry.coordinates;
        return { lat, lon };
    } catch (e) {
        console.error("Error en geocodificación:", e);
        return null;
    }
}

/**
 * Reemplaza a texto_a_nodo
 * NOTA: La lógica de buscar_interseccion requiere una estructura de datos
 * del OSM (ways) que no está completamente disponible en este Grafo simplificado.
 * Por simplicidad, solo implementaremos la búsqueda de dirección normal.
 */
async function texto_a_nodo(texto) {
    const coords = await obtener_coordenadas_osm(texto);
    if (coords === null) return -1;

    const { lat, lon } = coords;
    
    // Usamos la función de búsqueda de nodo más cercano del graphLoader
    const node_id = get_nearest_node_id(lat, lon); 
    
    console.log(`Nodo encontrado: ${node_id}`);
    return node_id !== null ? node_id : -1;
}

module.exports = { texto_a_nodo };