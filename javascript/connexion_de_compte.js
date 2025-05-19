document.addEventListener("DOMContentLoaded", function () {
  // Déclaration des éléments HTML
  const captchaContainer = document.getElementById("captcha-container");
  const dynamicCaptcha = document.getElementById("dynamic-recaptcha");
  const signupPlaceholder = document.getElementById(
    "signup-captcha-placeholder"
  );
  const loginPlaceholder = document.getElementById("login-captcha-placeholder");
  const blockedTimeElement = document.getElementById("blocked-time");
  const loginButton = document.getElementById("login-submit");
  const loginForm = document.getElementById("login-form");

  //Fonction de déplacement du CAPTCHA entre les formulaires
  function moveCaptcha(target) {
    target.appendChild(dynamicCaptcha);
  }

  // Gestion de l'affichage des formulaires
  document
    .getElementById("show-login-form")
    .addEventListener("click", function (e) {
      e.preventDefault();
      document.getElementById("signup-form-container").style.display = "none";
      document.getElementById("login-form-container").style.display = "block";
      moveCaptcha(loginPlaceholder);
    });

  document
    .getElementById("show-signup-form")
    .addEventListener("click", function (e) {
      e.preventDefault();
      document.getElementById("login-form-container").style.display = "none";
      document.getElementById("signup-form-container").style.display = "block";
      moveCaptcha(signupPlaceholder);
    });

  // Placer initialement le CAPTCHA dans le formulaire d'inscription
  moveCaptcha(signupPlaceholder);

  // Gestion des tentatives locales / blocage
  let attemptsRemaining =
    parseInt(localStorage.getItem("attemptsRemaining")) || 3;
  let blockTime = parseInt(localStorage.getItem("blockTime")) || null;

  if (blockTime && Date.now() < blockTime) {
    loginButton.disabled = true;
    updateBlockedTime(); // Affiche le message dès le chargement
  }

  // Sanitation des entrées
  function sanitizeInput(input) {
    return input.replace(/[&<>'"/]/g, function (char) {
      const escapeChars = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#x27;",
        '"': "&quot;",
        "/": "&#x2F;",
      };
      return escapeChars[char];
    });
  }

  // Gestion du submit du formulaire de connexion
  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    // Si encore bloqué côté front
    if (blockTime && Date.now() < blockTime) {
      return;
    }

    // Vérification du CAPTCHA
    const token = grecaptcha.getResponse();
    if (!token) {
      alert("Veuillez valider le CAPTCHA");
      return;
    }

    const email = sanitizeInput(document.getElementById("login-email").value);
    const password = sanitizeInput(
      document.getElementById("login-password").value
    );

    try {
      const response = await fetch("https://api.recharge.cielnewton.fr/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, captchaToken: token }),
      });

      const data = await response.json();

      if (response.ok && data.redirect) {
        // Connexion réussie
        window.location.href = data.redirect;
        blockedTimeElement.textContent = "";
        localStorage.removeItem("blockTime");
        localStorage.removeItem("attemptsRemaining");
      } else {
        // Échec
        grecaptcha.reset();
        attemptsRemaining--;
        localStorage.setItem("attemptsRemaining", attemptsRemaining);

        if (attemptsRemaining > 0) {
          blockedTimeElement.textContent =
            `Erreur : ${data.message || "Email ou mot de passe incorrect"}. ` +
            `Il vous reste ${attemptsRemaining} tentative${
              attemptsRemaining > 1 ? "s" : ""
            }.`;
        } else {
          blockTime = Date.now() + 600000; // 10 minutes
          localStorage.setItem("blockTime", blockTime);
          blockedTimeElement.textContent =
            "Vous avez atteint le nombre maximal de tentatives. Veuillez patienter 10 minutes.";
          loginButton.disabled = true;
        }
        blockedTimeElement.style.color = "red";
      }
    } catch (error) {
      console.error("Erreur lors de la connexion:", error);
      blockedTimeElement.textContent = "Erreur serveur, veuillez réessayer.";
      blockedTimeElement.style.color = "red";
    }
  });

  // Mise à jour automatique du temps de blocage
  function updateBlockedTime() {
    const now = Date.now();
    if (blockTime && now < blockTime) {
      const remainingTime = Math.ceil((blockTime - now) / 1000);
      blockedTimeElement.textContent = `Vous devez attendre ${remainingTime} seconde${
        remainingTime > 1 ? "s" : ""
      } avant de réessayer.`;
      blockedTimeElement.style.color = "red";
      loginButton.disabled = true;
    } else if (blockTime && now >= blockTime) {
      blockTime = null;
      attemptsRemaining = 3;
      blockedTimeElement.textContent = "";
      loginButton.disabled = false;
      localStorage.removeItem("blockTime");
      localStorage.removeItem("attemptsRemaining");
    }
  }

  setInterval(updateBlockedTime, 1000);

  // Gestion animation chargement boutons
  document.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", function () {
      this.classList.add("loading");
      setTimeout(() => this.classList.remove("loading"), 1000);
    });
  });
});
