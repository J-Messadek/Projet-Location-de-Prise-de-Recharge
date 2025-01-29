//CREATION DE COMPTE
document.getElementById('signup-form').addEventListener('submit', (e) => {
    e.preventDefault();
  
    // Récupérer les valeurs du formulaire
    const nom = document.getElementById('nom').value;
    const prenom = document.getElementById('prenom').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
  
    // Créer l'objet de données
    const data = {
      nom: nom,
      prenom: prenom,
      email: email,
      password: password,
      confirmPassword: confirmPassword
    };
  
    // Envoyer la requête POST
    fetch('http://localhost:3002/create-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
      console.log('Réponse du serveur:', data);
      alert(data.message); // Affiche le message du serveur
    })
    .catch(error => {
      console.error('Erreur:', error);
      alert('Une erreur est survenue');
    });
  });