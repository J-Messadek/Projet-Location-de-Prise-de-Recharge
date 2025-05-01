document.addEventListener("DOMContentLoaded", function () {
  // 1) Éléments du DOM
  const dynamicCaptcha     = document.getElementById("dynamic-recaptcha");
  const loginPlaceholder   = document.getElementById("login-captcha-placeholder");
  const blockedTimeElement = document.getElementById("blocked-time");
  const loginButton        = document.getElementById("login-submit");
  const loginForm          = document.getElementById("login-form");

  // 2) Fonction pour déplacer le widget reCAPTCHA
  function moveCaptcha(target) {
    target.appendChild(dynamicCaptcha);
  }

  // 3) On place initialement le captcha dans le formulaire
  moveCaptcha(loginPlaceholder);

  // 4) Gestion des tentatives locales / blocage
  let attemptsRemaining = parseInt(localStorage.getItem("attemptsRemaining")) || 3;
  let blockTime         = parseInt(localStorage.getItem("blockTime"))         || null;

  // 5) Fonction de sanitation (optionnelle)
  function sanitizeInput(input) {
    return input.trim();
  }

  // 6) Gestion du submit
  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    // Si encore bloqué côté front
    if (blockTime && Date.now() < blockTime) {
      return;
    }

    // Récupérer et valider le token reCAPTCHA
    const captchaToken = grecaptcha.getResponse();
    if (!captchaToken) {
      alert("Veuillez valider le CAPTCHA");
      return;
    }

    // Récupération des champs
    const email    = sanitizeInput(document.getElementById("login-email").value);
    const password = sanitizeInput(document.getElementById("login-password").value);

    try {
      const response = await fetch("https://api.recharge.cielnewton.fr/admin/login", {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ email, password, captchaToken })
      });

      const data = await response.json();

      if (response.ok && data.redirect) {
        // Connexion réussie
        window.location.href = data.redirect;
        // Réinitialiser blocage front
        localStorage.removeItem("blockTime");
        localStorage.removeItem("attemptsRemaining");
      } else {
        // Échec : décrémenter les essais
        grecaptcha.reset();
        attemptsRemaining--;
        localStorage.setItem("attemptsRemaining", attemptsRemaining);

        if (attemptsRemaining > 0) {
          blockedTimeElement.textContent =
            `Erreur : ${data.message || "Identifiants incorrects"}. ` +
            `Il vous reste ${attemptsRemaining} tentative${attemptsRemaining>1?'s':''}.`;
        } else {
          blockTime = Date.now() + 10*60*1000; // 10 min
          localStorage.setItem("blockTime", blockTime);
          blockedTimeElement.textContent =
            "Trop de tentatives. Veuillez patienter 10 minutes.";
          loginButton.disabled = true;
        }
        blockedTimeElement.style.color = "red";
      }
    } catch (err) {
      console.error("Erreur lors de la connexion Admin:", err);
      grecaptcha.reset();
      blockedTimeElement.textContent = "Erreur serveur, veuillez réessayer.";
      blockedTimeElement.style.color = "red";
    }
  });

  // 7) Mise à jour du timer de blocage
  function updateBlockedTime() {
    const now = Date.now();
    if (blockTime && now < blockTime) {
      const rem = Math.ceil((blockTime - now)/1000);
      blockedTimeElement.textContent =
        `Attendez ${rem} seconde${rem>1?'s':''} avant de réessayer.`;
      loginButton.disabled = true;
    } else if (blockTime && now >= blockTime) {
      // Déblocage
      blockTime = null;
      attemptsRemaining = 3;
      blockedTimeElement.textContent = "";
      loginButton.disabled = false;
      localStorage.removeItem("blockTime");
      localStorage.removeItem("attemptsRemaining");
    }
  }
  setInterval(updateBlockedTime, 1000);

  // 8) Animation des boutons
  document.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.classList.add("loading");
      setTimeout(() => btn.classList.remove("loading"), 1000);
    });
  });

  // 9) Toggle mot de passe
  document.querySelectorAll(".toggle-password-login").forEach(button => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-target");
      const field    = document.getElementById(targetId);
      const isPwd    = field.type === "password";
      field.type     = isPwd ? "text" : "password";
      button.textContent = isPwd ? "✖️" : "🔍";
    });
  });
});
