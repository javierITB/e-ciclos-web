import React from 'react';
import ReactDOM from 'react-dom/client';
import RouteFinder from './RouteFinder.jsx'; // Asegúrate que el nombre de archivo y el import coincidan

// 🛑 IMPORTAR BOOTSTRAP AQUÍ 🛑
import 'bootstrap/dist/css/bootstrap.min.css'; 
import 'leaflet/dist/leaflet.css'; // <<-- ESTA LÍNEA ES CRUCIAL

import './leaflet_fix.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouteFinder />
  </React.StrictMode>,
)