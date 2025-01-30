document.getElementById("signup-form").addEventListener("submit", function (e) {
  e.preventDefault(); // Empêche la soumission du formulaire

  // Récupération des champs
  const nom = document.getElementById("nom");
  const prenom = document.getElementById("prenom");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const confirmPassword = document.getElementById("confirm-password");

  // Regex
  const nameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ\s'-]+$/; // Accepte uniquement les lettres et espaces
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Vérifie un email valide
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  let isValid = true;

  // Fonction pour afficher les erreurs sous les champs
  function showError(input, message) {
    let errorElement = input.nextElementSibling;
    if (!errorElement || !errorElement.classList.contains("error-message")) {
      errorElement = document.createElement("p");
      errorElement.classList.add("error-message");
      errorElement.style.color = "red";
      errorElement.style.fontSize = "12px";
      input.parentNode.appendChild(errorElement);
    }
    errorElement.textContent = message;
    isValid = false;
  }

  // Fonction pour retirer l'erreur si valide
  function clearError(input) {
    let errorElement = input.nextElementSibling;
    if (errorElement && errorElement.classList.contains("error-message")) {
      errorElement.textContent = "";
    }
  }

  // Validation du nom
  if (!nameRegex.test(nom.value.trim())) {
    showError(nom, "Le nom ne doit contenir que des lettres.");
  } else {
    clearError(nom);
  }

  // Validation du prénom
  if (!nameRegex.test(prenom.value.trim())) {
    showError(prenom, "Le prénom ne doit contenir que des lettres.");
  } else {
    clearError(prenom);
  }

  // Validation de l'email
  if (!emailRegex.test(email.value.trim())) {
    showError(email, "L'adresse email n'est pas valide.");
  } else {
    clearError(email);
  }

  // Validation du mot de passe
  if (!passwordRegex.test(password.value.trim())) {
    showError(
      password,
      "Le mot de passe doit contenir au moins 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre et 1 caractère spécial."
    );
  } else {
    clearError(password);
  }

  // Vérification de la confirmation du mot de passe
  if (password.value !== confirmPassword.value) {
    showError(confirmPassword, "Les mots de passe ne correspondent pas.");
  } else {
    clearError(confirmPassword);
  }

  //Si tout est valide, envoi des données à l'API
  if (isValid) {
    const data = {
      nom: nom.value.trim(),
      prenom: prenom.value.trim(),
      email: email.value.trim(),
      password: password.value.trim(),
      confirmPassword: confirmPassword.value.trim(),
    };

    fetch("http://localhost:3046/create-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("Réponse du serveur:", data);
        alert(data.message); // Affiche le message du serveur
        if (data.success) {
          window.location.href = "/dashboard.html"; // Redirection après succès
        }
      })
      .catch((error) => {
        console.error("Erreur:", error);
        alert("Une erreur est survenue lors de la création du compte.");
      });
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const passwordInput = document.getElementById("password");
  const passwordStrength = document.getElementById("password-strength");

  passwordInput.addEventListener("input", function () {
    const password = passwordInput.value;
    let strength = 0;

    if (password.length >= 8) strength++; // Longueur
    if (/[A-Z]/.test(password)) strength++; // Majuscule
    if (/\d/.test(password)) strength++; // Chiffre
    if (/[@$!%*?&]/.test(password)) strength++; // Symbole

    if (strength === 0) {
      passwordStrength.textContent = "Force : Très faible";
      passwordStrength.style.color = "red";
    } else if (strength === 1) {
      passwordStrength.textContent = "Force : Faible";
      passwordStrength.style.color = "orangered";
    } else if (strength === 2) {
      passwordStrength.textContent = "Force : Moyenne";
      passwordStrength.style.color = "orange";
    } else if (strength === 3) {
      passwordStrength.textContent = "Force : Bonne";
      passwordStrength.style.color = "lightgreen";
    } else {
      passwordStrength.textContent = "Force : Très forte";
      passwordStrength.style.color = "green";
    }
  });
});
