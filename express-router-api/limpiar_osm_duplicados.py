#!/usr/bin/env python3
"""
Script para limpiar etiquetas duplicadas CONSECUTIVAS en archivos OSM.
Elimina solo cuando encuentra dos líneas idénticas seguidas dentro del mismo nodo/way/relation.
"""

import sys
import re
from pathlib import Path

def limpiar_etiquetas_duplicadas_consecutivas(contenido):
    """
    Elimina etiquetas duplicadas consecutivas dentro de un mismo elemento OSM.
    """
    lineas = contenido.splitlines()
    lineas_limpias = []
    i = 0
    total_eliminadas = 0
    
    while i < len(lineas):
        linea_actual = lineas[i]
        lineas_limpias.append(linea_actual)
        
        # Solo verificar duplicados si es una línea de tag
        if '<tag ' in linea_actual and i + 1 < len(lineas):
            linea_siguiente = lineas[i + 1]
            
            # Si la siguiente línea es IDÉNTICA y también es un tag
            if linea_actual.strip() == linea_siguiente.strip() and '<tag ' in linea_siguiente:
                # Verificar que estamos dentro del mismo elemento (no hay línea de cierre entremedio)
                # Buscar hacia atrás para encontrar la apertura del elemento actual
                elemento_abierto = None
                for j in range(i, max(-1, i - 20), -1):
                    if '<node ' in lineas[j] or '<way ' in lineas[j] or '<relation ' in lineas[j]:
                        elemento_abierto = lineas[j]
                        break
                
                # Si encontramos el elemento, saltamos la línea duplicada
                if elemento_abierto:
                    total_eliminadas += 1
                    print(f"  Eliminada duplicado: {linea_actual.strip()[:50]}...")
                    i += 1  # Saltamos la línea duplicada
        
        i += 1
    
    return '\n'.join(lineas_limpias), total_eliminadas

def procesar_archivo_osm(archivo_entrada, archivo_salida=None):
    """
    Procesa un archivo OSM eliminando etiquetas duplicadas consecutivas.
    """
    if archivo_salida is None:
        nombre_base = Path(archivo_entrada).stem
        archivo_salida = f"{nombre_base}_limpio.osm"
    
    print(f"📖 Leyendo {archivo_entrada}...")
    with open(archivo_entrada, 'r', encoding='utf-8') as f:
        contenido = f.read()
    
    print("🧹 Limpiando etiquetas duplicadas consecutivas...")
    contenido_limpio, total_eliminadas = limpiar_etiquetas_duplicadas_consecutivas(contenido)
    
    print(f"💾 Guardando en {archivo_salida}...")
    with open(archivo_salida, 'w', encoding='utf-8') as f:
        f.write(contenido_limpio)
    
    print(f"✅ Listo! Eliminadas {total_eliminadas} etiquetas duplicadas.")
    print(f"📁 Archivo limpio: {archivo_salida}")
    
    return archivo_salida, total_eliminadas

def main():
    """Función principal."""
    if len(sys.argv) < 2:
        print("Uso: python limpiar_osm_duplicados.py <archivo_osm> [archivo_salida]")
        print("Ejemplo: python limpiar_osm_duplicados.py map_clean.osm map_clean_sin_duplicados.osm")
        return
    
    archivo_entrada = sys.argv[1]
    archivo_salida = sys.argv[2] if len(sys.argv) > 2 else None
    
    if not Path(archivo_entrada).exists():
        print(f"❌ Error: El archivo '{archivo_entrada}' no existe.")
        return
    
    try:
        archivo_salida, total = procesar_archivo_osm(archivo_entrada, archivo_salida)
        
        # Mostrar ejemplo del resultado
        print("\n📄 Ejemplo del resultado (primeros nodos):")
        with open(archivo_salida, 'r', encoding='utf-8') as f:
            lineas = f.readlines()[:30]  # Primeras 30 líneas
            for linea in lineas:
                print(linea.rstrip())
        
    except Exception as e:
        print(f"❌ Error procesando el archivo: {e}")

if __name__ == "__main__":
    main()