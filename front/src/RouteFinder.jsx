import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Collapse, Spinner } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// ----------------------------------------------------
// 🛑 PARTE CRÍTICA: CORRECCIÓN DE ESTILOS DE LEAFLET 🛑
// ----------------------------------------------------

// 1. IMPORTAR ESTILOS DE LEAFLET
// Asegúrate de que este CSS esté disponible globalmente. Si no lo has hecho en main.jsx,
// puedes importarlo aquí (solo para esta prueba, la mejor práctica es en main.jsx):
// import 'leaflet/dist/leaflet.css'; 

// 2. DEFINIR CSS PARA FORZAR EL TAMAÑO (LA SOLUCIÓN CLÁSICA)
// Usamos un componente simple para inyectar los estilos forzados.
const LeafletStylesFix = () => (
    <style jsx="true">{`
        .leaflet-container {
            /* ESTO ES LO CRÍTICO: FUERZA LA ALTURA AL 100% DE SU CONTENEDOR */
            height: 100% !important; 
            width: 100% !important;
            /* Asegura que el contenedor de Leaflet se posicione correctamente */
            z-index: 0; 
        }
        /* Corregir el color de los marcadores por defecto (si se ven azules) */
        .custom-div-icon {
            display: flex;
            align-items: center;
            justify-content: center;
        }
    `}</style>
);


// ----------------------------------------------------
// 🛑 CONFIGURACIÓN DEL MAPA
// ----------------------------------------------------
const INITIAL_CENTER = [-33.447487, -70.673661]; // Lat, Lon de Santiago
const INITIAL_ZOOM = 13;

const COLORS = {
    ORIGEN: '#28a745',
    DESTINO: '#dc3545',
    DIJKSTRA: '#007bff',
    ASTAR: '#ffc107',
};

// Iconos personalizados de Leaflet
const createMarkerIcon = (color, size = 18) => {
    return new L.DivIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 3px solid black; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
        iconSize: [size + 6, size + 6], // Ajustar para el borde
        iconAnchor: [(size + 6) / 2, (size + 6)],
    });
};

const OrigenIcon = createMarkerIcon(COLORS.ORIGEN, 18);
const DestinoIcon = createMarkerIcon(COLORS.DESTINO, 18);

// ----------------------------------------------------
// 🛑 LÓGICA DE CLICKS (Ahora llama al backend /api/click_node)
// ----------------------------------------------------

const ClickHandler = ({ setSelection, selectionMode, setLoading, setStatusMessage }) => {
    const map = useMapEvents({
        click: (e) => {
            const { lat, lng } = e.latlng;
            setLoading(true);
            setStatusMessage("Buscando nodo cercano...");

            const findNearestNodeAndSet = async (lat, lon) => {
                try {
                    // Llamada al nuevo endpoint de Python
                    const response = await fetch(`https://e-ciclos-web.vercel.app/api/click_node?lat=${lat}&lon=${lon}`);
                    const data = await response.json(); 
                    
                    if (data.error) {
                        setStatusMessage(<span className="text-danger">⛔ Error de nodo: {data.error}</span>);
                        return;
                    }
                    
                    const { node_id, lat: foundLat, lon: foundLon } = data;
                    
                    if (node_id) {
                        setSelection(prev => {
                            const newSelection = { ...prev };
                            if (selectionMode === 'ORIGEN') {
                                newSelection.origenId = node_id;
                                newSelection.origenCoords = [foundLat, foundLon];
                                newSelection.selectionMode = 'DESTINO';
                            } else {
                                newSelection.destinoId = node_id;
                                newSelection.destinoCoords = [foundLat, foundLon];
                                newSelection.selectionMode = 'ORIGEN';
                            }
                            return newSelection;
                        });
                    }

                } catch (err) {
                    setStatusMessage(<span className="text-danger">⛔ Error: No se pudo conectar con el servidor de nodos.</span>);
                } finally {
                    setLoading(false);
                }
            };

            findNearestNodeAndSet(lat, lng);
        },
    });

    return null;
};

// ----------------------------------------------------
// 🛑 COMPONENTE PRINCIPAL (RouteFinder)
// ----------------------------------------------------

export default function RouteFinder() {
    const [selection, setSelection] = useState({
        origenText: '',
        destinoText: '',
        origenId: null,
        destinoId: null,
        origenCoords: null, 
        destinoCoords: null,
        selectionMode: 'ORIGEN',
    });

    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState("👆 Fija Origen y Destino usando texto o IDs.");
    const [is3DOpen, setIs3DOpen] = useState(false);
    const [routes, setRoutes] = useState({
        dijkstra: null,
        astar: null,
        rawDijkstraIds: null,
        rawAstarIds: null,
    });
    
    const totalNodes = 7599; 

    // --- Lógica de Manejo de Inputs (Llama a /api/search_node) ---
    const handleFixNode = async (type) => {
        const text = type === 'ORIGEN' ? selection.origenText : selection.destinoText;
        // ... Lógica de limpieza y validación ...
        if (!text) {
             setSelection(prev => ({
                ...prev,
                [`${type.toLowerCase()}Id`]: null,
                [`${type.toLowerCase()}Coords`]: null,
            }));
            return;
        }

        setLoading(true);
        setStatusMessage(`Buscando ${type}: ${text}...`);
        
        try {
            const response = await fetch(`https://e-ciclos-web.vercel.app/api/search_node?query=${encodeURIComponent(text)}`);
            const data = await response.json();
            
            const { node_id, lat, lon, error } = data; 

            if (error) {
                setStatusMessage(<span className="text-danger">⛔ Error: {error}</span>);
                setSelection(prev => ({ ...prev, [`${type.toLowerCase()}Id`]: null, [`${type.toLowerCase()}Coords`]: null, }));
            } else if (type === 'DESTINO' && node_id === selection.origenId) {
                 setStatusMessage(<span className="text-danger">⛔ Error: Destino no puede ser igual al Origen.</span>);
            } 
            else {
                setSelection(prev => ({
                    ...prev,
                    [`${type.toLowerCase()}Id`]: node_id,
                    [`${type.toLowerCase()}Coords`]: [lat, lon],
                }));
            }
        } catch (err) {
            setStatusMessage(<span className="text-danger">⛔ Error de conexión con el servicio de búsqueda.</span>);
        } finally {
            setLoading(false);
        }
    };
    
    // --- Lógica de Cálculo de Ruta (Llama a /api/calculate_route) ---
    const handleCalculateRoute = async () => {
        const { origenId, destinoId } = selection;

        if (!origenId || !destinoId) {
            setStatusMessage(<span className="text-danger">Seleccione Origen y Destino válidos antes de calcular.</span>);
            return;
        }

        setLoading(true);
        setStatusMessage('Calculando rutas óptimas...');
        setRoutes({ dijkstra: null, astar: null, rawDijkstraIds: null, rawAstarIds: null });

        try {
            const response = await fetch(`https://e-ciclos-web.vercel.app/api/calculate_route?origin=${origenId}&destination=${destinoId}`);
            const data = await response.json(); 

            const { dijkstra_coords, astar_coords, dijkstra_ids, astar_ids, error } = data;
            
            if (error) {
                setStatusMessage(<span className="text-danger">{error}</span>);
            } else {
                setRoutes({ 
                    dijkstra: dijkstra_coords || null, 
                    astar: astar_coords || null,
                    rawDijkstraIds: dijkstra_ids || null,
                    rawAstarIds: astar_ids || null
                });
                
                const dLen = dijkstra_ids ? dijkstra_ids.length : 0;
                const aLen = astar_ids ? astar_ids.length : 0;
                let msg = `Rutas calculadas. Dijkstra: ${dLen} nodos. A*: ${aLen} nodos.`;
                
                if (dijkstra_ids && astar_ids && dijkstra_ids.join(',') === astar_ids.join(',')) {
                    msg += " **¡Ambos algoritmos encontraron la misma ruta óptima!**";
                }
                
                setStatusMessage(<span className="text-success fw-bold">{msg} El mapa se ha actualizado.</span>);
            }

        } catch (err) {
            console.error("Error en cálculo de ruta:", err);
            setStatusMessage(<span className="text-danger">Error de conexión al calcular la ruta.</span>);
        } finally {
            setLoading(false);
        }
    };
    
    // --- Resto de la lógica (Reset, useEffect para Status, etc.) ---
    
    useEffect(() => {
        const { origenId, destinoId } = selection;
        
        if (loading) return; // No sobrescribir mensajes de loading

        if (origenId && destinoId) {
            setStatusMessage(
                <span className="text-success fw-bold">
                    🎉 Listo: Origen ({origenId}) y Destino ({destinoId}). ¡Calcula la ruta!
                </span>
            );
        } else if (origenId) {
            setStatusMessage(
                <span>
                    <b className="text-info">✅ Origen Fijado.</b> ID: {origenId}. Ahora selecciona el Destino.
                </span>
            );
        } else if (destinoId) {
            setStatusMessage(
                 <span>
                    <b className="text-danger">✅ Destino Fijado.</b> ID: {destinoId}. Ahora selecciona el Origen.
                </span>
            );
        } else {
            setStatusMessage("👆 Fija Origen y Destino usando texto o IDs.");
        }
    }, [selection.origenId, selection.destinoId, loading]);

    const handleReset = () => {
        setSelection({
            origenText: '', destinoText: '', origenId: null, destinoId: null, 
            origenCoords: null, destinoCoords: null, selectionMode: 'ORIGEN',
        });
        setRoutes({ dijkstra: null, astar: null, rawDijkstraIds: null, rawAstarIds: null });
    };

    // --- Renderizado de la UI ---

    const map3DContent = (
        <div className="p-3 bg-light border rounded shadow-sm mt-3">
            <h5 className="mt-3 text-center text-info">Vista 3D (Altitud y Peligrosidad)</h5>
            <div style={{ height: '30vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e9ecef' }}>
                <p className="text-muted">Placeholder para la visualización 3D.</p>
            </div>
        </div>
    );

    return (
        <Container fluid className="p-0" style={{ height: '100vh', overflow: 'hidden' }}>
            {/* 🛑 INYECTAR ESTILOS DE LEAFLET AQUÍ 🛑 */}
            <LeafletStylesFix />
            {/* ------------------------------------ */}

            <hr className="mb-4" />

            <Row className="g-0" style={{ height: 'calc(100vh - 100px)' }}> {/* Ajustar altura dinámica */}
                {/* 1. SIDEBAR (Controles) */}
                <Col md={3} className="p-4 bg-light border-end shadow-sm" style={{ overflowY: 'auto' }}>
                    <h4 className="mt-2 mb-3 text-secondary">🧭 Controles de Ruta</h4>
                    <p className="text-muted small">Total de nodos disponibles: {totalNodes}</p>

                    <Alert variant={selection.selectionMode === 'ORIGEN' ? 'info' : 'danger'} className="text-center fw-bold border p-2 mb-3 rounded-lg">
                        Modo Click: Seleccionar {selection.selectionMode === 'ORIGEN' ? 'Origen' : 'Destino'}
                    </Alert>

                    <Form.Group className="mb-3">
                        <Form.Label className="mt-3 form-label">📍 Origen (Texto o ID de Nodo):</Form.Label>
                        <Form.Control
                            type="text"
                            placeholder='Ej: Plaza de Armas o 139158914'
                            value={selection.origenText}
                            onChange={(e) => setSelection(prev => ({ ...prev, origenText: e.target.value }))}
                        />
                        <Button onClick={() => handleFixNode('ORIGEN')} variant="info" size="sm" className="w-100 mt-2" disabled={loading}>
                            Fijar Origen
                        </Button>
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label className="mt-4 form-label">🏁 Destino (Texto o ID de Nodo):</Form.Label>
                        <Form.Control
                            type="text"
                            placeholder='Ej: Cerro San Cristóbal o 139162483'
                            value={selection.destinoText}
                            onChange={(e) => setSelection(prev => ({ ...prev, destinoText: e.target.value }))}
                        />
                        <Button onClick={() => handleFixNode('DESTINO')} variant="danger" size="sm" className="w-100 mt-2" disabled={loading}>
                            Fijar Destino
                        </Button>
                    </Form.Group>
                    
                    <Alert variant="light" className="text-center mt-3 py-2">
                        {loading ? <Spinner animation="border" size="sm" className="me-2" /> : statusMessage}
                    </Alert>

                    <hr className="my-4" />
                    
                    <Button onClick={handleCalculateRoute} variant="success" className="w-100 mt-2 btn-lg" disabled={loading || !selection.origenId || !selection.destinoId}>
                        🛣️ Calcular Ruta Óptima
                    </Button>

                    <div className="my-3 text-center">
                        {routes.dijkstra && <Alert variant="success" className="mb-2">Rutas calculadas y visibles.</Alert>}
                    </div>
                    
                    <Card className="mt-4 p-2 shadow-sm">
                        <Card.Body style={{ maxHeight: '300px', overflowY: 'auto', fontSize: '0.8rem' }}>
                            {routes.rawDijkstraIds && (
                                <>
                                    <b className="d-block text-primary mt-2">Ruta Dijkstra (IDs):</b>
                                    <p style={{ wordBreak: 'break-all' }}>{routes.rawDijkstraIds.join(' → ')}</p>
                                    <b className="d-block text-warning mt-3">Ruta A* (IDs):</b>
                                    <p style={{ wordBreak: 'break-all' }}>{routes.rawAstarIds.join(' → ')}</p>
                                </>
                            )}
                            {!routes.rawDijkstraIds && <p className="text-muted">No hay rutas calculadas.</p>}
                        </Card.Body>
                    </Card>

                    <Button onClick={handleReset} variant="warning" className="w-100 mt-4">
                        🔄 Resetear Selección
                    </Button>
                    
                    <hr className="my-4" />
                    
                    <Button onClick={() => setIs3DOpen(!is3DOpen)} variant="dark" className="w-100">
                        ⛰️ Mostrar/Ocultar Vista 3D
                    </Button>
                </Col>

                {/* 2. MAPA PRINCIPAL */}
                <Col md={9} className="p-0" style={{ height: '100%' }}> 
                    <MapContainer
                        center={INITIAL_CENTER}
                        zoom={INITIAL_ZOOM}
                        // Aquí el estilo debe ser 100% porque LeafletStylesFix ya arregló el contenedor
                        style={{ height: '100%', width: '100%' }} 
                        scrollWheelZoom={true}
                        doubleClickZoom="center"
                    >
                        <TileLayer
                            attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        
                        <ClickHandler 
                            setSelection={setSelection} 
                            selectionMode={selection.selectionMode} 
                            setLoading={setLoading}
                            setStatusMessage={setStatusMessage}
                        />
                        
                        {/* Dibujar Ruta Dijkstra */}
                        {routes.dijkstra && (
                            <Polyline positions={routes.dijkstra} color={COLORS.DIJKSTRA} weight={5} opacity={1.0} />
                        )}
                        
                        {/* Dibujar Ruta A* */}
                        {routes.astar && (
                            <Polyline positions={routes.astar} color={COLORS.ASTAR} weight={4} opacity={0.8} />
                        )}

                        {/* Marcadores */}
                        {selection.origenCoords && (
                            <Marker position={selection.origenCoords} icon={OrigenIcon} title={`Origen ID: ${selection.origenId}`} />
                        )}
                        {selection.destinoCoords && (
                            <Marker position={selection.destinoCoords} icon={DestinoIcon} title={`Destino ID: ${selection.destinoId}`} />
                        )}
                        
                    </MapContainer>
                    
                    <Collapse in={is3DOpen}>
                        <div>{map3DContent}</div>
                    </Collapse>
                </Col>
            </Row>
        </Container>
    );
}