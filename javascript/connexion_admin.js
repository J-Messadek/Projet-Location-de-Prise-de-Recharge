  // Optionnel : Définir sanitizeInput si nécessaire
  function sanitizeInput(input) {
    return input.trim();
  }

  document.getElementById("login-form").addEventListener("submit", function (event) {
      event.preventDefault();
      // Utiliser sanitizeInput ou directement récupérer la valeur
      let email = sanitizeInput(document.getElementById("login-email").value);
      let password = sanitizeInput(document.getElementById("login-password").value);

      fetch("https://api.recharge.cielnewton.fr/admin/login", {
          method: "POST",
          credentials: 'include',  // Inclure les cookies (session)
          headers: {
              "Content-Type": "application/json"
          },
          body: JSON.stringify({ email, password })
      })
      .then(response => {
          console.log("Status:", response.status);
          return response.json();
      })
      .then(data => {
          console.log("Réponse de l'API:", data);
          if (data.redirect) {
              window.location.href = data.redirect;
          } else {
              alert('Erreur : ' + data.message);
          }
      })
      .catch(error => console.error("Erreur lors de la connexion:", error));
  });

  // Pour les boutons de chargement (optionnel)
  document.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", function () {
          this.classList.add("loading");
          setTimeout(() => this.classList.remove("loading"), 1000);
      });
  });

  document.querySelectorAll(".toggle-password-login").forEach(button => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-target");
      const passwordField = document.getElementById(targetId);
      const isPassword = passwordField.type === "password";
      passwordField.type = isPassword ? "text" : "password";
      button.textContent = isPassword ? "✖️" : "🔍";  // Change le texte
    });
  });
