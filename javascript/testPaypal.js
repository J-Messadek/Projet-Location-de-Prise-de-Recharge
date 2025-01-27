paypal.Buttons({
  createOrder: function(data, actions) {
    // Récupérer la valeur sélectionnée (kWh)
    var kwhValue = document.getElementById("kwh-select").value;
    var amount = 0;

    // Déterminer le montant en fonction du kWh choisi
    if (kwhValue == "5") {
      amount = "0.50";
    } else if (kwhValue == "10") {
      amount = "1.00";
    } else if (kwhValue == "20") {
      amount = "2.00";
    }

    // Créer une commande avec le montant choisi
    return actions.order.create({
      purchase_units: [{
        amount: {
          value: amount // Montant basé sur le choix de kWh
        }
      }]
    });
  },
  onApprove: function(data, actions) {
// Quand la transaction est approuvée, capturer le paiement
return actions.order.capture().then(function(details) {
alert('Transaction réussie pour : ' + details.payer.name.given_name);

// Récupérer les données nécessaires (email de l'utilisateur, kWh achetés, montant)
const email = details.payer.email_address; // Remplace par le champ email approprié
const kwhValue = document.getElementById("kwh-select").value;
let montant = 0;

// Déterminer le montant en fonction du kWh choisi
if (kwhValue == "5") {
  montant = "0.50";
} else if (kwhValue == "10") {
  montant = "1.00";
} else if (kwhValue == "20") {
  montant = "2.00";
}

// Envoi des données au backend
fetch('http://localhost:3000/enregistrer-achat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ email: email, kwh: kwhValue, montant: montant })
})
.then(response => response.json())
.then(data => console.log('Achat enregistré :', data))
.catch(error => console.error('Erreur lors de l\'enregistrement de l\'achat :', error));

console.log('Détails de la transaction :', details);
});
},
  onError: function(err) {
    // En cas d'erreur, afficher les détails dans la console
    console.error('Erreur PayPal :', err);
  }
}).render('#paypal-button-container'); // Affiche le bouton PayPal