import os
import json
import osmnx as ox
from flask import Flask, request, jsonify
from flask_cors import CORS
from typing import List, Tuple, Dict, Optional
import networkx as nx

# --- Importar tus módulos de lógica ---
from grafo import Grafo
from string_to_node import texto_a_nodo
from routing import dijkstra, a_estrella, reconstruir_camino, distancia_haversine
# --------------------------------------

app = Flask(__name__)
# Permitir CORS para desarrollo (aunque el proxy de Vite lo maneja en desarrollo, es buena práctica)
CORS(app) 

# --- Configuración y Carga de Grafo Global ---
OSM_FILE = "./map_clean.osm"
G: Optional[nx.MultiDiGraph] = None  # Grafo NetworkX  # Grafo NetworkX
G_CUSTOM: Optional[Grafo] = None     # Grafo personalizado

def cargar_grafo_osm(osm_file_path):
    """Carga el grafo, simula atributos y construye el Grafo personalizado."""
    global G, G_CUSTOM
    try:
        # 1. Cargar NetworkX Grafo
        if not os.path.exists(osm_file_path):
            return None
        
        # Usamos ox.graph_from_xml para cargar el grafo desde el archivo OSM
        G = ox.graph_from_xml(osm_file_path, simplify=False)
        
        # 2. Simular Altitud y Peligrosidad (como en tu web.py)
        import random
        for node, data in G.nodes(data=True):
            data['lon'] = data['x']
            data['lat'] = data['y']
            # Simulación de datos para que los costes de ruteo funcionen
            data['altitud_m'] = 400 + (data['y'] * -100) + random.uniform(0, 50)
            data['peligrosidad'] = random.uniform(0.1, 0.9)

        # 3. Construir Grafo Custom
        G_CUSTOM = Grafo()
        G_CUSTOM.cargar_desde_networkx(G)
        
        return True
    except Exception as e:
        print(f"Error al cargar el grafo: {e}")
        G = None
        G_CUSTOM = None
        return False

# Cargar el grafo al inicio
if not cargar_grafo_osm(OSM_FILE):
    print("⛔ Advertencia: El grafo OSM no pudo ser cargado. Las APIs de ruteo fallarán.")


def get_nearest_node_id(lat: float, lon: float) -> Optional[int]:
    """Encuentra el ID del nodo en G más cercano a las coordenadas dadas."""
    global G
    if G is None:
        return None
    
    # ox.nearest_nodes es la forma eficiente de hacer tu get_nearest_node
    nearest_node = ox.nearest_nodes(G, lon, lat)
    return int(nearest_node)

def get_node_coords(node_id: int) -> Optional[Tuple[float, float]]:
    """Obtiene (lat, lon) de un ID de nodo."""
    global G
    if G is not None and node_id in G:
        data = G.nodes[node_id]
        return (data['y'], data['x']) # (lat, lon)
    return None

# --- ENDPOINTS (API REST) ---

@app.route('/search_node', methods=['GET'])
def search_node():
    """
    Endpoint 1: Convierte texto (dirección o intersección) a ID de nodo.
    Simula la lógica de los botones 'Fijar Origen/Destino'.
    """
    query = request.args.get('query')
    if not query:
        return jsonify({"error": "Parámetro 'query' requerido."}), 400

    try:
        # Usa la función original de tu string_to_node.py
        node_id = texto_a_nodo(query, archivo_osm=OSM_FILE)
        
        if node_id == -1 or node_id not in G.nodes:
            return jsonify({"error": f"Nodo para '{query}' no encontrado en el grafo."}), 404

        # Obtener coordenadas del nodo encontrado
        lat, lon = get_node_coords(node_id)
        
        return jsonify({
            "node_id": int(node_id),
            "lat": lat,
            "lon": lon
        })

    except Exception as e:
        print(f"Error en search_node: {e}")
        return jsonify({"error": f"Error interno en la búsqueda: {e}"}), 500

@app.route('/click_node', methods=['GET'])
def click_node():
    """
    Endpoint 2: Encuentra el nodo más cercano a un click de lat/lon.
    Simula la lógica de 'get_nearest_node' en el Callback de click.
    """
    try:
        lat = float(request.args.get('lat'))
        lon = float(request.args.get('lon'))
    except (TypeError, ValueError):
        return jsonify({"error": "Coordenadas lat y lon requeridas y deben ser números."}), 400

    try:
        node_id = get_nearest_node_id(lat, lon)
        
        if node_id is None:
             return jsonify({"error": "Grafo no cargado."}), 503
        
        if node_id == -1:
            return jsonify({"error": "Nodo cercano no encontrado en el grafo."}), 404
        
        # Obtener coordenadas del nodo (para centrar el mapa en el frontend)
        lat_found, lon_found = get_node_coords(node_id)

        return jsonify({
            "node_id": int(node_id),
            "lat": lat_found,
            "lon": lon_found
        })
        
    except Exception as e:
        print(f"Error en click_node: {e}")
        return jsonify({"error": f"Error interno en la búsqueda de nodo: {e}"}), 500


@app.route('/calculate_route', methods=['GET'])
def calculate_route():
    """
    Endpoint 3: Calcula Dijkstra y A* entre dos IDs de nodo.
    Simula la lógica de 'btn-ruta' (Callback 5).
    """
    try:
        origen_id = int(request.args.get('origin'))
        destino_id = int(request.args.get('destination'))
    except (TypeError, ValueError):
        return jsonify({"error": "IDs de Origen y Destino requeridos y deben ser enteros."}), 400

    if G_CUSTOM is None or origen_id not in G_CUSTOM.nodos or destino_id not in G_CUSTOM.nodos:
        return jsonify({"error": "Origen o Destino inválido, o grafo no cargado."}), 500
        
    # Parámetros de ruteo (puedes hacerlos variables en el futuro)
    W_DIST = 1.0
    W_ELEV = 0.0
    W_SEG = 1000.0
    
    # 1. Ejecutar Dijkstra
    ruta_dijkstra_ids: List[int] = []
    ruta_dijkstra_coords: List[List[float]] = []
    try:
        cost_dijkstra, prev_dijkstra = dijkstra(G_CUSTOM, origen_id, destino_id,
                                                w_dist=W_DIST, w_elev=W_ELEV, w_seg=W_SEG)
        if destino_id in prev_dijkstra and prev_dijkstra[destino_id] is not None:
            ruta_dijkstra_ids = reconstruir_camino(prev_dijkstra, origen_id, destino_id)
            ruta_dijkstra_coords = [list(get_node_coords(nid)) for nid in ruta_dijkstra_ids if get_node_coords(nid)]
    except Exception as e:
        print(f"Error en Dijkstra: {e}")

    # 2. Ejecutar A*
    ruta_astar_ids: List[int] = []
    ruta_astar_coords: List[List[float]] = []
    try:
        ruta_astar_ids = a_estrella(G_CUSTOM, origen_id, destino_id,
                                    w_dist=W_DIST, w_elev=W_ELEV, w_seg=W_SEG)
        if ruta_astar_ids:
            ruta_astar_coords = [list(get_node_coords(nid)) for nid in ruta_astar_ids if get_node_coords(nid)]
    except Exception as e:
        print(f"Error en A*: {e}")

    return jsonify({
        "dijkstra_ids": ruta_dijkstra_ids,
        "dijkstra_coords": ruta_dijkstra_coords, # [[lat, lon], [lat, lon], ...]
        "astar_ids": ruta_astar_ids,
        "astar_coords": ruta_astar_coords
    })


if __name__ == '__main__':
    # Flask correrá en el puerto 5000, que es el que Vite usará para el proxy.
    print("Iniciando servidor Flask en http://127.0.0.1:5000...")
    app.run(debug=True, host='127.0.0.1', port=5000)