// ——————————————
// Classe PriseManager
// Gère la liste cliquable, l’affichage des détails et les opérations CRUD
// ——————————————
class PriseManager {
    constructor(shellyManagerInstance) {
        this.liste = [];
        this.selection = null;
        this.apiUrl = 'https://api.recharge.cielnewton.fr';
        this.shellyManager = shellyManagerInstance; // 🔗
    }
    

    // Charge la liste des prises et construit les boutons
    chargerListe() {
        fetch(`${this.apiUrl}/ids`)
          .then(res => res.json())
          .then(data => {
            this.liste = data;
            const ul = document.getElementById('prise-list');
            ul.innerHTML = '';
            data.forEach(p => {
              const li = document.createElement('li');
              li.innerHTML = `<button data-id="${p.id}">
                                ${p.nom_prise} (${p.valeur_id}) - ${p.localite}
                              </button> &emsp;<br><br>`;
              ul.appendChild(li);
            });
          })
          .catch(err => console.error('Erreur GET /ids :', err));
    }

    // Affiche les détails de la prise cliquée
    afficherDetails(id) {
        const p = this.liste.find(x => String(x.id) === String(id));
        if (!p) return;
        this.selection = p;
        const d = document.getElementById('prise-details');
        d.innerHTML = `
            <h3>Détails de la prise</h3>
            <p><strong>Nom :</strong> ${p.nom_prise}</p>
            <p><strong>valeur_id :</strong> ${p.valeur_id}</p>
            <p><strong>Localité :</strong> ${p.localite}</p>
            <p><strong>ID table :</strong> ${p.id}</p>
        `;
    }

    // Vide la zone de détails
    clearDetails() {
        document.getElementById('prise-details').innerHTML = '';
        this.selection = null;
    }

    // Initialise tous les écouteurs d’événements
    initListeners() {
        // 1) Click sur la liste des prises
        document.getElementById('prise-list').addEventListener('click', e => {
            if (e.target.tagName === 'BUTTON') {
                this.afficherDetails(e.target.getAttribute('data-id'));
            }
        });

        // 2) Ajouter une prise
        document.getElementById('add-prise-btn').addEventListener('click', () => {
            const nom = document.getElementById('prise-name').value.trim();
            const loc = document.getElementById('prise-locality').value.trim();
            const vid = document.getElementById('prise-id').value.trim();
            if (!nom || !loc || !vid) return alert('Veuillez remplir tous les champs');
            
            fetch(`${this.apiUrl}/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ valeur_id: vid, nom_prise: nom, localite: loc })
            })
            .then(r => r.json())
            .then(j => {
                alert(j.message);
                this.clearDetails();
                this.chargerListe(); // Recharge la liste après l'ajout
                // Ajoute immédiatement à la supervision
                this.shellyManager.addPrise(nom, loc, vid);
            })
            .catch(err => console.error('Erreur POST /add :', err));
        });


        // 3) Supprimer la prise sélectionnée
        document.getElementById('delete-prise-btn').addEventListener('click', () => {
            if (!this.selection) return alert('Veuillez sélectionner une prise');
            if (!confirm('Confirmer la suppression ?')) return;
            fetch(`${this.apiUrl}/delete/${this.selection.id}`, { method: 'DELETE' })
            .then(j => {
                alert(j.message);
                this.shellyManager.removePrise(this.selection.valeur_id); // ❌ Retrait supervision
                this.clearDetails();
                this.chargerListe();
            })            
              .then(r => r.json())
              .then(j => {
                alert(j.message);
                this.clearDetails();
                this.chargerListe();
              })
              .catch(err => console.error('Erreur DELETE /delete/:id :', err));
        });

        // 4) Modifier la prise sélectionnée
        document.getElementById('update-prise-btn').addEventListener('click', () => {
            if (!this.selection) return alert('Veuillez sélectionner une prise');
            const nom = document.getElementById('nouveau-nom').value.trim();
            const loc = document.getElementById('nouvelle-localite').value.trim();
            if (!nom || !loc) return alert('Veuillez remplir tous les champs de modification');
            fetch(`${this.apiUrl}/update/${this.selection.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nom_prise: nom, localite: loc })
            })
            .then(r => r.json())
            .then(j => {
                alert(j.message);
                this.clearDetails();
                this.chargerListe();
            })
            .catch(err => console.error('Erreur PUT /update/:id :', err));
        });
    }

    // Démarrage
    initialiser() {
        this.initListeners();
        this.chargerListe();
    }
}


// ——————————————
// Classe ShellyManager
// Gère la connexion MQTT, le chargement des prises et les commandes Allumer/Éteindre
// ——————————————
// Classe ShellyManager
class ShellyManager {
    constructor() {
        this.apiUrl = 'https://api.recharge.cielnewton.fr';
        this.mqttBroker = "wss://47567f9a74b445e6bef394abec5c83a1.s1.eu.hivemq.cloud:8884/mqtt";
        this.mqttOptions = {
            clientId: "web_client_" + Math.random().toString(16).substr(2, 8),
            username: "ShellyPlusPlugS",
            password: "Ciel92110",
            protocol: "wss"
        };
        this.client = null;
        this.prises = {};  // Stocke les prises
    }

    // Initialise la connexion MQTT et les abonnements
    initMQTT() {
        this.client = mqtt.connect(this.mqttBroker, this.mqttOptions);
    
        this.client.on('connect', () => {
            console.log('✅ Connecté au broker Développement de l’API REST (Express.js)MQTT !');
            document.getElementById('status').textContent = 'Connecté';
        });
    
        // Réception des messages MQTT
        this.client.on('message', (topic, message) => {
            this.updatePriseData(topic, message);
        });
    
        this.client.on('close', () => {
            console.warn("MQTT déconnecté, tentative de reconnexion...");
            setTimeout(() => this.connectMQTT(), 3000);
        });

        this.client.on('error', err => {
            console.error('❌ Erreur MQTT :', err);
            document.getElementById('status').textContent = 'Erreur MQTT';
        });
    }

    // Charge les prises depuis l'API et abonne les topics MQTT
    loadPrisesFromAPI() {
        fetch(`${this.apiUrl}/ids`)
            .then(r => r.json())
            .then(data => {
                data.forEach(({ valeur_id, nom_prise, localite }) => {
                    if (!this.prises[valeur_id]) {
                        this.addPrise(nom_prise, localite, valeur_id);
                        this.client.subscribe(`shellyplusplugs-${valeur_id}/rpc`);
                        this.client.subscribe(`shellyplusplugs-${valeur_id}/test`);
                        this.client.subscribe(`shellyplusplugs-${valeur_id}/status`); // Abonnement au topic status
                    }
                });
            })
            .catch(console.error);
    }
    
    // Ajoute une prise à l'interface
    addPrise(name, locality, id) {
        this.prises[id] = { id }; // Ajoute l'ID pour plus tard
        const container = document.getElementById('prises-container');
        const div = document.createElement('div');
        div.classList.add('prise');
        div.id = id;
        div.innerHTML = `
            <h2>${name} - <em>${locality}</em></h2>
            <p><strong>ID :</strong> ${id}</p>
            <p><strong>État :</strong> <span class="state">-</span></p>
            <p><strong>Puissance :</strong> <span class="power">-</span> W</p>
            <p><strong>Énergie :</strong> <span class="energy">-</span> kWh</p>
            <p><strong>Dernière mise à jour :</strong> <span class="date">-</span></p>
            <button class="turnOn">Allumer</button>
            <button class="turnOff">Éteindre</button>
        `;
        container.appendChild(div);
    }
    // Retire une prise à l'interface
    removePrise(id) {
        const div = document.getElementById(id);
        if (div) div.remove();
        delete this.prises[id];
    }    
    

    // Modifie l'état de la prise (Allumer/Éteindre)
    togglePrise(id, turnOn) {
        const payload = {
            id: 1,
            src: "web_client",
            method: "Switch.Set",
            params: { id: 0, on: turnOn }
        };

        this.client.publish(
            `shellyplusplugs-${id}/rpc`,
            JSON.stringify(payload)
        );

        console.log(`Commande envoyée à shellyplusplugs-${id}: ${turnOn ? 'Allumer' : 'Éteindre'}`);

        // Mise à jour du timestamp lors du changement d'état
        this.updateLastUpdated(id, new Date().toLocaleString());
    }

    // Initialisation des écouteurs de clic
    initShellyListeners() {
        document.getElementById('prises-container')
            .addEventListener('click', e => {
                const btn = e.target;
                if (btn.classList.contains('removePrise')) {
                    const id = btn.closest('.prise').id;
                    this.removePrise(id);
                } else if (btn.classList.contains('turnOn') || btn.classList.contains('turnOff')) {
                    const id = btn.closest('.prise').id;
                    const turnOn = btn.classList.contains('turnOn');
                    this.togglePrise(id, turnOn);
                }
            });
    }

    updatePriseData(topic, message) {
        const priseKey = Object.keys(this.prises).find(key =>
            topic.includes(this.prises[key].id)
        );
        if (!priseKey) return;
    
        try {
            const data = JSON.parse(message);
            const div = document.getElementById(priseKey);
    
            // Gestion de l'état (via /status)
            if (topic.endsWith('/status') && data.status) {
                const etat = data.status === 'on' ? 'Allumé' : 'Éteint';
                const stateSpan = div.querySelector('.state');
                stateSpan.textContent = etat;
                stateSpan.style.color = data.status === 'on' ? 'green' : 'red';
            }
    
            // Gestion des données de consommation
            if (data.apower !== undefined || data.total !== undefined) {
                const power = data.apower !== undefined ? data.apower : "-";
                const energy = data.total !== undefined ? (data.total / 1000).toFixed(3) : "-";
    
                div.querySelector(".power").textContent = power;
                div.querySelector(".energy").textContent = energy;
    
                // ✅ Date depuis `minute_ts` ou date actuelle
                const timestamp = data.minute_ts || Date.now(); // Assure-toi que minute_ts ou Date.now() donne un timestamp en millisecondes
    
                const formattedDate = new Date(timestamp).toLocaleString("fr-FR", {
                    weekday: 'short',  // Optionnel : "lun., mar." etc.
                    year: 'numeric',   // Année complète : 2025
                    month: '2-digit',  // Mois sur 2 chiffres : 05
                    day: '2-digit',    // Jour sur 2 chiffres : 12
                    hour: '2-digit',   // Heure sur 2 chiffres : 17
                    minute: '2-digit', // Minute sur 2 chiffres : 19
                    second: '2-digit', // Seconde sur 2 chiffres : 00
                    hour12: false       // Format 24 heures
                });
    
                div.querySelector(".date").textContent = formattedDate;
            }
        } catch (err) {
            console.error('Erreur de réception des données Shelly :', err);
        }
    }
    
       

    // Met à jour la date de la dernière mise à jour
    updateLastUpdated(id, timestamp) {
        const div = document.getElementById(id);
        const dateElement = div.querySelector('.date');
        if (dateElement) {
            dateElement.textContent = timestamp; // Met à jour la dernière mise à jour
        }
    }

    // Démarrage de l'application
    initialiser() {
        this.initShellyListeners();
        this.initMQTT();
        this.loadPrisesFromAPI();
    }
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    const shellyManager = new ShellyManager();
    shellyManager.initialiser();

    const priseManager = new PriseManager(shellyManager); // 🔗 Passage d'instance
    priseManager.initialiser();
});

function openTab(tabId) {
      document.querySelectorAll(".tab-content").forEach(div => div.classList.remove("active"));
      document.querySelectorAll(".tablink").forEach(btn => btn.classList.remove("active"));
      document.getElementById(tabId).classList.add("active");
      event.currentTarget.classList.add("active");
    }

    let fontSizePct = 100;
    document.getElementById("increase-text").addEventListener("click", () => {
      fontSizePct += 10;
      document.documentElement.style.fontSize = fontSizePct + "%";
    });
    document.getElementById("decrease-text").addEventListener("click", () => {
      fontSizePct = Math.max(50, fontSizePct - 10);
      document.documentElement.style.fontSize = fontSizePct + "%";
    });
    document.getElementById("toggle-theme").addEventListener("click", () => {
      document.body.classList.toggle("dark");
    });
