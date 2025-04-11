fetch('https://api.recharge.cielnewton.fr/get-user-id', {  // L'API écoute sur 3047
  method: 'GET',
  credentials: 'include'  // Envoie les cookies de session
})
.then(response => response.json())
.then(data => {
  if (data.userId) {
      console.log("ID utilisateur récupéré :", data.userId);
  } else {
      console.log("Utilisateur non connecté");
  }
})
.catch(error => console.error("Erreur :", error));



//DECONNEXION  

document.getElementById("logoutBtn").addEventListener("click", () => {
  fetch('https://api.recharge.cielnewton.fr/logout', {
    method: 'GET',
    credentials: 'include' // Permet d'envoyer le cookie de session
  })
        .then(response => response.json())
        .then(data => {
            if (data.redirect) {
                window.location.href = data.redirect;
            }
        })
        .catch(error => console.error("Erreur lors de la déconnexion :", error));
});


//VERIFIER SI LA SESSION 
fetch('https://api.recharge.cielnewton.fr/check-session', {
  method: 'GET',
  credentials: 'include' // Permet d'envoyer le cookie de session
})
    .then(response => response.json())
    .then(data => {
        if (!data.sessionActive) {
            window.location.href = "/"; // Redirige vers la connexion si session expirée
        }
    });

  
    document.addEventListener('DOMContentLoaded', () => {
      const messageEl = document.getElementById('message-bienvenue');
      if (!messageEl) {
        console.error("L'élément #message-bienvenue est introuvable dans le DOM.");
        return;
      }
    
      // Appel à l'API pour récupérer le nom et prénom
      // On encode le & en %26 pour éviter des problèmes d'URL
      fetch('https://api.recharge.cielnewton.fr/get-user-info-nom-prenom', {
          method: 'GET',
          credentials: 'include',
          headers: {
              'Content-Type': 'application/json'
          }
      })
      .then(response => {
        if (!response.ok) {
          console.error(`Erreur HTTP: ${response.status}`);
          return response.text(); // Pour déboguer, on récupère le texte
        }
        return response.json();
      })
      .then(data => {
        if (data && data.message) {
          messageEl.innerText = data.message;
        } else {
          messageEl.innerText = "Utilisateur non authentifié.";
        }
      })
      .catch(error => {
        console.error('Erreur lors de la récupération des données :', error);
        messageEl.innerText = "Une erreur est survenue.";
      });
    });
    
