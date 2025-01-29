const form = document.getElementById('login-form');
form.addEventListener('submit', function(event) {
  event.preventDefault();

  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  fetch('http://localhost:3004/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password })
  })
  .then(response => response.json())
  .then(data => {
    if (data.message === 'Connexion réussie') {
      alert('Connexion réussie !');
      // Rediriger ou effectuer d'autres actions
    } else {
      alert('Erreur : ' + data.message); // Affiche "Identifiants incorrects" si erreur
    }
  })
  .catch(error => {
    console.error('Erreur lors de la connexion :', error);
  });
});
