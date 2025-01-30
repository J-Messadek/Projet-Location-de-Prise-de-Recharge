document.getElementById('deleteAccountForm').addEventListener('submit', function(e) {
    e.preventDefault();  // Empêche le comportement par défaut du formulaire

    // Récupération des données du formulaire
    const email = document.getElementById('deleteEmail').value;
    const password = document.getElementById('deletePassword').value;

    console.log("Données envoyées:", { email, password });  // Vérification des données

    // Création de l'objet à envoyer
    const data = {
        email: email,
        password: password
    };

    fetch('http://localhost:3046/delete-account', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            console.error('Erreur HTTP:', response.status, response.statusText); 
            return response.json();  // Essaie de récupérer l'erreur détaillée du serveur
        }
        return response.json();
    })
    .then(data => {
        console.log('Réponse du serveur:', data);
        // Gérer la réponse ici
    })
    .catch(error => {
        console.error('Erreur lors de la requête:', error);
    });
    
});
