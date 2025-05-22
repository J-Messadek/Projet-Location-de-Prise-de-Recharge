// ——————————————
// Classe PriseManager — Gère les opérations CRUD (Créer, Lire, Mettre à jour, Supprimer),
// l'affichage HTML des prises, et la liaison avec ShellyManager pour la supervision en temps réel
// ——————————————
class PriseManager {
    constructor(shellyManagerInstance) {
        this.liste = [];// Contient la liste des prises récupérées depuis l'API
        this.selection = null; // Contient la prise actuellement sélectionnée
        this.apiUrl = 'https://api.recharge.cielnewton.fr'; // Adresse de l’API Node.js
        this.shellyManager = shellyManagerInstance; // Référence vers l’instance ShellyManager
    }
    
    // Récupère la liste des prises depuis l’API et les affiche dynamiquement dans la liste HTML
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
                              </button><br><br>`;
              ul.appendChild(li);
            });
          })
          .catch(err => console.error('Erreur GET /ids :', err));
    }

    // Affiche les détails d’une prise sélectionnée
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

    // Efface les détails affichés et réinitialise la sélection
    clearDetails() {
        document.getElementById('prise-details').innerHTML = '';
        this.selection = null;
    }

    // Initialise tous les écouteurs d’événements pour les boutons d’ajout, de suppression et de modification
    initListeners() {
        // Lorsqu’un bouton de la liste est cliqué, afficher ses détails
        document.getElementById('prise-list').addEventListener('click', e => {
            if (e.target.tagName === 'BUTTON') {
                this.afficherDetails(e.target.getAttribute('data-id'));
            }
        });

        // Bouton d’ajout de prise
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
                this.chargerListe();
                this.shellyManager.addPrise(nom, loc, vid);
            
                // Réinitialiser les champs de formulaire
                document.getElementById('prise-name').value = '';
                document.getElementById('prise-locality').value = '';
                document.getElementById('prise-id').value = '';
            })            
            .catch(err => console.error('Erreur POST /add :', err));
        });

        // Bouton de suppression de prise
        document.getElementById('delete-prise-btn').addEventListener('click', () => {
            if (!this.selection) return alert('Veuillez sélectionner une prise');
            if (!confirm('Confirmer la suppression ?')) return;

            fetch(`${this.apiUrl}/prises/${this.selection.id}`, { method: 'DELETE' })
            .then(r => {
                if (!r.ok) throw new Error("Échec de la suppression");
                return r.json();
            })
            .then(j => {
                alert(j.message || "Prise supprimée avec succès");
                this.shellyManager.removePrise(this.selection.valeur_id);
                this.clearDetails();
                this.chargerListe();
            })
            .catch(err => alert("Erreur lors de la suppression : " + err.message));            
        });

        // Bouton de mise à jour des informations d’une prise
        document.getElementById('update-prise-btn').addEventListener('click', () => {
            if (!this.selection) return alert('Veuillez sélectionner une prise');
            const nom = document.getElementById('nouveau-nom').value.trim();
            const loc = document.getElementById('nouvelle-localite').value.trim();
            if (!nom || !loc) return alert('Veuillez remplir tous les champs');

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
            
                // Réinitialiser les champs de modification
                document.getElementById('nouveau-nom').value = '';
                document.getElementById('nouvelle-localite').value = '';
            })
            
            .catch(err => console.error('Erreur PUT /update/:id :', err));
        });
    }

    // Initialise l'application (écouteurs + chargement des prises)
    initialiser() {
        this.initListeners();
        this.chargerListe();
    }
}


// ——————————————
// Classe ShellyManager — Gère la communication MQTT avec les prises Shelly
// ainsi que leur affichage et mise à jour en temps réel
// ——————————————
class ShellyManager {
    constructor() {
        this.apiUrl = 'https://api.recharge.cielnewton.fr';
        this.mqttBroker = "wss://47567f9a74b445e6bef394abec5c83a1.s1.eu.hivemq.cloud:8884/mqtt"; // Adresse du broker MQTT en WebSocket sécurisé
        this.mqttOptions = {
            clientId: "web_client_" + Math.random().toString(16).substr(2, 8),
            username: "ShellyPlusPlugS",
            password: "Ciel92110",
            protocol: "wss"
        };
        this.client = null; // Client MQTT
        this.prises = {};  // Stocke les prises
    }

    // Initialise la connexion MQTT et définit les comportements à la connexion, réception et erreurs
    initMQTT() {
        this.client = mqtt.connect(this.mqttBroker, this.mqttOptions);

        this.client.on('connect', () => {
            console.log('✅ Connecté au broker MQTT');
            document.getElementById('status').textContent = 'Connecté';
        });

        this.client.on('message', (topic, message) => {
            this.updatePriseData(topic, message);
        });

        this.client.on('error', err => {
            console.error('❌ Erreur MQTT :', err);
            document.getElementById('status').textContent = 'Erreur MQTT';
        });
    }

    // Charge les prises depuis l’API et les ajoute dynamiquement avec abonnement aux bons topics
    loadPrisesFromAPI() {
        fetch(`${this.apiUrl}/ids`)
            .then(r => r.json())
            .then(data => {
                data.forEach(({ valeur_id, nom_prise, localite }) => {
                    if (!this.prises[valeur_id]) {
                        this.addPrise(nom_prise, localite, valeur_id);
                        this.client.subscribe(`shellyplusplugs-${valeur_id}/rpc`);
                        this.client.subscribe(`shellyplusplugs-${valeur_id}/status`);
                        this.client.subscribe(`shellyplusplugs-${valeur_id}/test`);
                    }
                });
            })
            .catch(console.error);
    }

    // Crée dynamiquement une carte HTML représentant une prise
    addPrise(name, locality, id) {
        this.prises[id] = { id };
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

      // Supprime une prise de l’affichage et envoie une commande d’arrêt avant suppression
    removePrise(id) {
        const payload = {
            id: 1,
            src: "web_client",
            method: "Switch.Set",
            params: { id: 0, on: false }
        };

        this.client.publish(
            `shellyplusplugs-${id}/rpc`,
            JSON.stringify(payload),
            {},
            (err) => {
                if (err) {
                    console.error(`Erreur d'extinction de la prise ${id}`, err);
                } else {
                    console.log(`Prise ${id} éteinte avant suppression`);
                }

                const div = document.getElementById(id);
                if (div) div.remove();
                delete this.prises[id];
            }
        );
    }
    
    // Envoie une commande MQTT pour allumer ou éteindre la prise
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

        this.updateLastUpdated(id, new Date().toLocaleString());
    }

    // Initialise les boutons Allumer / Éteindre des cartes HTML
    initShellyListeners() {
        document.getElementById('prises-container')
            .addEventListener('click', e => {
                const btn = e.target;
                const id = btn.closest('.prise')?.id;
                if (!id) return;

                if (btn.classList.contains('turnOn')) {
                    this.togglePrise(id, true);
                } else if (btn.classList.contains('turnOff')) {
                    this.togglePrise(id, false);
                }
            });
    }

    // Met à jour les données d’une prise en fonction des messages MQTT reçus
    updatePriseData(topic, message) {
        const priseKey = Object.keys(this.prises).find(key => topic.includes(this.prises[key].id));
        if (!priseKey) return;

        try {
            const data = JSON.parse(message);
            const div = document.getElementById(priseKey);

            if (topic.endsWith('/status') && data.status) {
                const state = data.status === 'on' ? 'Allumé' : 'Éteint';
                const stateSpan = div.querySelector('.state');
                stateSpan.textContent = state;
                stateSpan.style.color = data.status === 'on' ? 'green' : 'red';
            }

            if (data.apower !== undefined || data.total !== undefined) {
                div.querySelector(".power").textContent = data.apower ?? "-";
                div.querySelector(".energy").textContent = data.total !== undefined ? (data.total / 1000).toFixed(3) : "-";
            }
        } catch (err) {
            console.error('Erreur de réception Shelly :', err);
        }
    }
    
    // Met à jour l’horodatage de la dernière commande envoyée
    updateLastUpdated(id, timestamp) {
        const div = document.getElementById(id);
        const dateEl = div.querySelector('.date');
        if (dateEl) dateEl.textContent = timestamp;
    }

    // Met à jour l’horodatage de la dernière commande envoyée
    initialiser() {
        this.initShellyListeners();
        this.initMQTT();
        this.loadPrisesFromAPI();
    }
}

// ——————————————
// Initialisation au chargement
// ——————————————
document.addEventListener('DOMContentLoaded', () => {
    const shellyManager = new ShellyManager();
    shellyManager.initialiser();

    const priseManager = new PriseManager(shellyManager);
    priseManager.initialiser();
});


// Reprise de la logique des onglets et du thème
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

document
  .getElementById("update-price-btn")
  .addEventListener("click", function () {
    const prixKwh = parseFloat(document.getElementById("prix-kwh").value);

    const messageElement = document.getElementById("update-price-message");

    // Vérification de la validité du prix

    if (isNaN(prixKwh) || prixKwh <= 0) {
      messageElement.style.display = "block";

      messageElement.style.color = "red";

      messageElement.textContent = "Le prix doit être un nombre supérieur à 0.";

      return;
    }

    // Envoi de la requête POST pour mettre à jour le prix

    fetch("https://api.recharge.cielnewton.fr/update-kwh-price", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({ prix_kwh: prixKwh }),
    })
      .then((response) => response.json())

      .then((data) => {
        if (data.success) {
          messageElement.style.display = "block";

          messageElement.style.color = "green";

          messageElement.textContent = data.message; // Message de succès
        } else {
          messageElement.style.display = "block";

          messageElement.style.color = "red";

          messageElement.textContent =
            data.error || "Erreur lors de la mise à jour du prix.";
        }
      })

      .catch((error) => {
        messageElement.style.display = "block";

        messageElement.style.color = "red";

        messageElement.textContent =
          "Erreur de serveur. Veuillez réessayer plus tard.";

        console.error("Erreur:", error);
      });
  });


// // Écouteur d'événements pour le bouton de déconnexion
// document.getElementById("logoutBtn").addEventListener("click", () => {
  // // Envoi de la requête de déconnexion à l'API
  // fetch("https://api.recharge.cielnewton.fr/logout", {
    // method: "GET",
    // credentials: "include", // Permet d'envoyer le cookie de session
  // })
    // .then((response) => response.json()) // On attend la réponse JSON de l'API
    // .then((data) => {
      // if (data.redirect) {
        // // Si une redirection est indiquée, on redirige l'utilisateur
        // window.location.href = data.redirect;
      // }
    // })
    // .catch((error) => console.error("Erreur lors de la déconnexion :", error));
// });
