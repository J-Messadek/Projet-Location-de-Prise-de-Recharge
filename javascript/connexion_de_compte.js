document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("show-login-form").addEventListener("click", function (event) {
      event.preventDefault();
      document.getElementById("signup-form-container").style.display = "none";
      document.getElementById("login-form-container").style.display = "block";
  });

  document.getElementById("show-signup-form").addEventListener("click", function (event) {
      event.preventDefault();
      document.getElementById("signup-form-container").style.display = "block";
      document.getElementById("login-form-container").style.display = "none";
  });

  function sanitizeInput(input) {
      return input.replace(/[&<>'"/]/g, function (char) {
          const escapeChars = {
              '&': "&amp;",
              '<': "&lt;",
              '>': "&gt;",
              "'": "&#x27;",
              '"': "&quot;",
              '/': "&#x2F;"
          };
          return escapeChars[char];
      });
  }

  document.getElementById("signup-form").addEventListener("submit", function (event) {
      event.preventDefault();
      let email = sanitizeInput(document.getElementById("email").value);
      let password = sanitizeInput(document.getElementById("password").value);
      let confirmPassword = sanitizeInput(document.getElementById("confirm-password").value);

      if (password !== confirmPassword) {
          alert("Les mots de passe ne correspondent pas.");
          return;
      }

      fetch("http://localhost:3046/signup", {
          method: "POST",
          headers: {
              "Content-Type": "application/json"
          },
          body: JSON.stringify({ email, password })
      })
      .then(response => response.json())
      .then(data => {
        if (data.redirect) {
            window.location.href = data.redirect;
        } else {
            alert('Erreur : ' + data.message);
        }
    })
    
  });

  document.getElementById("login-form").addEventListener("submit", function (event) {
      event.preventDefault();
      let email = sanitizeInput(document.getElementById("login-email").value);
      let password = sanitizeInput(document.getElementById("login-password").value);

      fetch("http://localhost:3046/login", {
          method: "POST",
          headers: {
              "Content-Type": "application/json"
          },
          body: JSON.stringify({ email, password })
      })
      .then(response => response.json())
      .then(data => {
        if (data.redirect) {
            window.location.href = data.redirect;
              // Rediriger ou effectuer d'autres actions
          } else {
              alert('Erreur : ' + data.message);
          }
      })
      .catch(error => console.error("Erreur lors de la connexion:", error));
  });

  document.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", function () {
          this.classList.add("loading");
          setTimeout(() => this.classList.remove("loading"), 1000);
      });
  });
});
