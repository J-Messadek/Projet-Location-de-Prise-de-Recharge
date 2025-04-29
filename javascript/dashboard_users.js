document.addEventListener("DOMContentLoaded", function() {
  let currentKwhPrice = 0;
  
  // Récupérer les éléments du DOM
  const montantEurosInput = document.getElementById("montant-euros");
  const montantKwhInput = document.getElementById("montant-kwh");
  const prixKwhAffiche = document.getElementById("prix-kwh-affiche");

  // Fonction pour récupérer le prix actuel du kWh depuis l'API (utilisation du port 3047)
  function updateKwhPrice() {
    fetch('https://api.recharge.cielnewton.fr/get-current-kwh-price', {
      method: 'GET',
      credentials: 'include'
    })
    .then(response => {
      // Essaye de lire le corps en tant que JSON
      return response.text();
    })
    .then(text => {
      try {
        const data = JSON.parse(text);
        currentKwhPrice = parseFloat(data.prix_kwh);
        if (!isNaN(currentKwhPrice)) {
          prixKwhAffiche.innerText = currentKwhPrice.toFixed(2);
        } else {
          prixKwhAffiche.innerText = "Erreur : Prix invalide";
        }
      } catch (e) {
        console.error('Erreur lors du parsing JSON:', e);
        prixKwhAffiche.innerText = "Erreur de format";
      }
    })
    .catch(error => {
      console.error('Erreur de récupération du prix :', error);
      prixKwhAffiche.innerText = "Erreur de connexion";
    });
  }

  // Met à jour le champ en kWh lorsque l'utilisateur saisit un montant en euros
  montantEurosInput.addEventListener("input", function() {
    const montant = parseFloat(montantEurosInput.value);
    if (!isNaN(montant) && currentKwhPrice > 0) {
      montantKwhInput.value = (montant / currentKwhPrice).toFixed(2);
    } else {
      montantKwhInput.value = "";
    }
  });

  // Met à jour le champ en euros lorsque l'utilisateur saisit un montant en kWh
  montantKwhInput.addEventListener("input", function() {
    const kwh = parseFloat(montantKwhInput.value);
    if (!isNaN(kwh) && currentKwhPrice > 0) {
      montantEurosInput.value = (kwh * currentKwhPrice).toFixed(2);
    } else {
      montantEurosInput.value = "";
    }
  });

  // Appel initial pour charger le prix du kWh
  updateKwhPrice();

  // Configuration du bouton PayPal
  paypal.Buttons({
    createOrder: function (data, actions) {
      const montant = parseFloat(montantEurosInput.value);
      if (isNaN(montant) || montant <= 0) {
        alert("Veuillez saisir un montant en euros valide.");
        return;
      }
      return actions.order.create({
        purchase_units: [{
          amount: { value: montant.toFixed(2) }
        }]
      });
    },
    onApprove: function (data, actions) {
      return actions.order.capture().then(function (details) {
          alert('Transaction réussie pour : ' + details.payer.name.given_name);
  
          // Récupérer le montant en kWh acheté
          const kwhAchat = parseFloat(document.getElementById("montant-kwh").value);
          if (isNaN(kwhAchat) || kwhAchat <= 0) {
              alert("Erreur dans le montant des kWh.");
              return;
          }
  
          // Envoyer la mise à jour des crédits à l'API
          fetch('https://api.recharge.cielnewton.fr/update-credits', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
              credentials: 'include',
              body: JSON.stringify({ kwh: kwhAchat })
          })
          .then(response => response.json())
          .then(data => {
              if (data.message.includes("succès")) {
                  // Actualiser les crédits affichés
                  fetchCredits();
              } else {
                  alert("Erreur lors de la mise à jour des crédits.");
              }
          })
          .catch(error => console.error("Erreur lors de l'envoi des crédits :", error));
      });
  },
    onError: function (err) {
      console.error('Erreur PayPal :', err);
    }
  }).render('#paypal-button-container');
});

function fetchCredits() {
  fetch('https://api.recharge.cielnewton.fr/get-user-info-credits', {
      method: 'GET',
      credentials: 'include'
  })
  .then(response => response.json())
  .then(data => {
      // Affichage des crédits restants
      document.getElementById("credits-restant").innerText = data.credits + " kWh";
      // Affichage du total payé
      document.getElementById("total-paid").innerText = data.totalPaid + " €";
  })
  .catch(error => console.error("Erreur lors de la récupération des crédits :", error));
}

document.addEventListener("DOMContentLoaded", function () {
  fetchCredits();
});



// ✅ Fonction pour charger les crédits
function chargerCredits() {
  fetch('https://api.recharge.cielnewton.fr/get-user-info-credits', {
    method: 'GET',
    credentials: 'include'
  })
  .then(response => {
    if (!response.ok) throw new Error("Erreur lors de la récupération des crédits.");
    return response.json();
  })
  .then(data => {
    document.getElementById("credits-restant").innerText = data.credits + " kWh";
  })
  .catch(error => {
    console.error("Erreur lors de la récupération des crédits :", error);
    document.getElementById("credits-restant").innerText = "Erreur de chargement";
  });
}

// ✅ Fonction pour charger l'historique
function chargerHistorique() {
  fetch('https://api.recharge.cielnewton.fr/historique-consommation', {
    method: 'GET',
    credentials: 'include'
  })
  .then(response => {
    if (!response.ok) throw new Error("Erreur lors de la récupération de l'historique.");
    return response.json();
  })
  .then(data => {
    const tbody = document.getElementById('historyTable').querySelector('tbody');
    tbody.innerHTML = "";

    if (data.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = '<td colspan="6">Aucun historique disponible.</td>';
      tbody.appendChild(row);
    } else {
      data.forEach(record => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${record.id_prise}</td>
          <td>${record.puissance_consomme}</td>
          <td>${record.temps_utilise}</td>
          <td>${record.energie_consomme}</td>
          <td>${record.prix_de_reference}</td>
          <td>${new Date(record.date_enregistrement).toLocaleString()}</td>
        `;
        tbody.appendChild(row);
      });
    }
  })
  .catch(error => {
    console.error('Erreur:', error);
    const tbody = document.getElementById('historyTable').querySelector('tbody');
    tbody.innerHTML = '<tr><td colspan="7">Erreur lors du chargement des données.</td></tr>';
  });
}


// ✅ Chargement initial de l'historique + crédits dès que la page est prête
document.addEventListener("DOMContentLoaded", function () {
  chargerHistorique();
  chargerCredits();
});
