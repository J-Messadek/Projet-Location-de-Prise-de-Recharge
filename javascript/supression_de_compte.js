document
  .getElementById("deleteAccountForm")
  .addEventListener("submit", function (e) {
    e.preventDefault(); // Empêche le comportement par défaut du formulaire

    // Récupération des données du formulaire
    const email = document.getElementById("deleteEmail").value;
    const password = document.getElementById("deletePassword").value;
    // Vérifie si la case à cocher est activée
    if (!confirmDelete) {
      alert("Vous devez confirmer la suppression de votre compte.");
      return;
    }

    console.log("Données envoyées:", { email, password }); // Vérification des données

    // Création de l'objet à envoyer
    const data = {
      email: email,
      password: password,
    };

    fetch("https://api.recharge.cielnewton.fr/delete-account", {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
      .then((response) => {
        if (!response.ok) {
          console.error("Erreur HTTP:", response.status, response.statusText);
          return response.json(); // Essaie de récupérer l'erreur détaillée du serveur
        }
        return response.json();
      })
      .then((data) => {
        console.log("Réponse du serveur:", data);
        // Gérer la réponse ici
        // Vérifie si un champ "redirect" est inclus dans la réponse
        if (data.redirect) {
          // Redirige l'utilisateur vers l'URL spécifiée
          window.location.href = data.redirect;
        }
      })
      .catch((error) => {
        console.error("Erreur lors de la requête:", error);
      });
  });
