// classes.js

/** Clase Nodo (Reemplaza a nodo.py) */
class Nodo {
    constructor(id_nodo, latitud, longitud, altura = 0.0, prob_accidente = 0.0) {
        this.id = id_nodo;
        this.latitud = latitud;
        this.longitud = longitud;
        this.altura = altura;
        this.prob_accidente = prob_accidente;
        this.caminos = []; // Referencias a objetos Camino
        this.vecinos = []; // Referencias a objetos Nodo
    }

    agregar_camino(camino) {
        if (!this.caminos.includes(camino)) {
            this.caminos.push(camino);
            const otro = camino.obtener_otro_nodo(this);
            if (otro && !this.vecinos.includes(otro)) {
                this.vecinos.push(otro);
            }
        }
    }

    toString() {
        return `Nodo(${this.id}, lat=${this.latitud}, lon=${this.longitud}, alt=${this.altura}, p_acc=${this.prob_accidente})`;
    }
}

/** Clase Camino (Reemplaza a camino.py) */
class Camino {
    constructor(id_camino, nodo_a, nodo_b, ciclovia = false, importancia = 1) {
        this.id = id_camino;
        this.nodos = [nodo_a, nodo_b];
        this.ciclovia = ciclovia;
        this.importancia = importancia;

        // Enlazar a nodos
        nodo_a.agregar_camino(this);
        nodo_b.agregar_camino(this);
    }

    obtener_otro_nodo(nodo) {
        if (nodo === this.nodos[0]) {
            return this.nodos[1];
        } else if (nodo === this.nodos[1]) {
            return this.nodos[0];
        }
        return null;
    }

    toString() {
        return `Camino(${this.id}, nodos=(${this.nodos[0].id}, ${this.nodos[1].id}), imp=${this.importancia})`;
    }
}

/** Clase Grafo (Reemplaza a grafo.py) */
class Grafo {
    constructor() {
        this.nodos = {}; // Dict[int, Nodo]
        this.caminos = {}; // Dict[int, Camino]
    }

    agregar_nodo(id_nodo, lat, lon, alt = 0.0, prob_acc = 0.0) {
        if (!(id_nodo in this.nodos)) {
            this.nodos[id_nodo] = new Nodo(id_nodo, lat, lon, alt, prob_acc);
        }
        return this.nodos[id_nodo];
    }

    agregar_camino(id_camino, id_nodo_a, id_nodo_b, ciclovia = false, importancia = 1) {
        if (id_camino in this.caminos) return this.caminos[id_camino];
        
        const nodo_a = this.nodos[id_nodo_a];
        const nodo_b = this.nodos[id_nodo_b];
        
        if (!nodo_a || !nodo_b) {
            console.warn(`No se pudo agregar camino ${id_camino}: Nodos ${id_nodo_a} o ${id_nodo_b} faltantes.`);
            return null;
        }

        this.caminos[id_camino] = new Camino(id_camino, nodo_a, nodo_b, ciclovia, importancia);
        return this.caminos[id_camino];
    }

    toString() {
        return `Grafo(nodos=${Object.keys(this.nodos).length}, caminos=${Object.keys(this.caminos).length})`;
    }
}

module.exports = { Nodo, Camino, Grafo };