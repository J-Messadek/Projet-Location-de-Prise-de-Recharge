require("dotenv").config();
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const session = require("express-session");
const { log } = require("console");
const app = express();
const nodemailer = require("nodemailer");
const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const port = 3047;

// Configuration CORS pour autoriser les domaines spécifiques et Google reCAPTCHA
const corsOptions = {
  origin: [
    "https://recharge.cielnewton.fr",
    "https://admin.recharge.cielnewton.fr",
    "https://www.google.com", // Ajouter Google reCAPTCHA
    "https://www.gstatic.com", // Ajouter le domaine des ressources reCAPTCHA
  ],
  credentials: true, // Permettre l'envoi de cookies et d'en-têtes d'autorisation
};

app.set("trust proxy", true); // Permet à Express de faire confiance au X-Forwarded-For

app.use(cookieParser());
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(express.json());

// Configuration de la session
app.use(
  session({
    name: process.env.SESSION_NAME, // par exemple "sid"
    resave: false,
    saveUninitialized: false,
    secret: process.env.SESSION_SECRET,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      secure: false, // en prod, mettre true si HTTPS
      httpOnly: true,
      sameSite: "Lax",
      domain: ".recharge.cielnewton.fr", // Pour partager le cookie entre ports sur localhost
    },
  })
);

// Middleware de protection (renvoie JSON en cas d'échec)
function protectionRoute(req, res, next) {
  if (req.session.idUtilisateur) {
    return next();
  } else {
    return res.status(401).json({ message: "Utilisateur non authentifié" });
  }
}

// Route pour récupérer l'ID utilisateur
app.get("/get-user-id", (req, res) => {
  if (req.session.idUtilisateur) {
    res.json({ userId: req.session.idUtilisateur });
  } else {
    res.status(401).json({ message: "Utilisateur non connecté" });
  }
});

// Middleware pour servir dynamiquement les fichiers CSS/JS
app.use("/css", express.static(path.join(__dirname, "../../css")));
app.use(
  "/javascript",
  express.static(path.join(__dirname, "../../javascript"))
);
app.use("/javascript", express.static(path.join(__dirname, "../../admin")));
app.use("/html", express.static(path.join(__dirname, "../../html")));
app.use("/images", express.static(path.join(__dirname, "../../images")));

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

const createUsersTableQuery = `
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    prenom VARCHAR(255) NOT NULL,
    nom VARCHAR(255) NOT NULL,
    mot_de_passe VARCHAR(255) NOT NULL,
    status ENUM('actif', 'supprimé') NOT NULL DEFAULT 'actif',
    old_email VARCHAR(255) DEFAULT NULL,
    salt VARCHAR(255) NOT NULL,
    is_verified BOOLEAN     NOT NULL DEFAULT FALSE,
    verify_token VARCHAR(64) NULL,
    token_expiry DATETIME    NULL
  )
`;

const createFailedLoginsTableQuery = `
  CREATE TABLE IF NOT EXISTS failed_logins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip VARCHAR(45) NOT NULL,
    device_id VARCHAR(32) NULL,
    attempt_count INT NOT NULL DEFAULT 1,
    first_attempt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    block_until DATETIME NULL,
    last_attempt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_ip_device (ip, device_id)
  )
`;

const createAdminsTableQuery = `
  CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    prenom VARCHAR(255) NOT NULL,
    nom VARCHAR(255) NOT NULL,
    mot_de_passe VARCHAR(255) NOT NULL
  )
`;

const createCreditsTableQuery = `
  CREATE TABLE IF NOT EXISTS credits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    credit DECIMAL(10,5) DEFAULT NULL,
    total_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

const createAchatsKwhTableQuery = `
  CREATE TABLE IF NOT EXISTS achats_kwh (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    kwh_achetes DECIMAL(10,2) NOT NULL,
    montant DECIMAL(10,2) NOT NULL,
    prix_kwh DECIMAL(10,4) NOT NULL,
    date_achat DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

const createHistoriqueTableQuery = `
  CREATE TABLE IF NOT EXISTS historique (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_prise VARCHAR(50) NOT NULL,
    id_user INT NOT NULL,
    puissance_consomme DECIMAL(10,2) NOT NULL,
    temps_utilise INT NOT NULL,
    energie_consomme DECIMAL(10,5) NOT NULL,
    prix_de_reference DECIMAL(10,4) NOT NULL,
    date_enregistrement DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_user) REFERENCES users(id) ON DELETE CASCADE
  )
`;

const createIdsTableQuery = `
  CREATE TABLE IF NOT EXISTS ids (
    id INT AUTO_INCREMENT PRIMARY KEY,
    valeur_id VARCHAR(100) NOT NULL,
    nom_prise VARCHAR(100) NOT NULL,
    localite VARCHAR(100) NOT NULL
  );
`;

const createTarifsTableQuery = `
  CREATE TABLE IF NOT EXISTS tarifs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prix_kwh DECIMAL(10,4) NOT NULL,
    date_maj TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
`;

const createTables = () => {
  db.query(createUsersTableQuery, (err) => {
    if (err) throw err;
    console.log("Table users created or already exists");

    db.query(createAdminsTableQuery, (err) => {
      if (err) throw err;
      console.log("Table admins created or already exists");

      db.query(createCreditsTableQuery, (err) => {
        if (err) throw err;
        console.log("Table credits created or already exists");

        db.query(createAchatsKwhTableQuery, (err) => {
          if (err) throw err;
          console.log("Table achats_kwh created or already exists");

          db.query(createHistoriqueTableQuery, (err) => {
            if (err) throw err;
            console.log("Table historique created or already exists");

            db.query(createTarifsTableQuery, (err) => {
              if (err) throw err;
              console.log("Table tarifs created or already exists");

              db.query(createFailedLoginsTableQuery, (err) => {
                if (err) throw err;
                console.log("Table failed_logins created or already exists");

                db.query(createIdsTableQuery, (err) => {
                  if (err) throw err;
                  console.log("Table failed_logins created or already exists");
                });
              });
            });
          });
        });
      });
    });
  });
};

// Connexion à la base de données
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Connexion à MySQL
db.connect((err) => {
  if (err) {
    console.error("Erreur de connexion à MySQL:", err);
    return;
  }
  console.log("Connecté à MySQL");

  // Créer la base de données si elle n'existe pas
  db.query("CREATE DATABASE IF NOT EXISTS Projet", (err) => {
    if (err) throw err;
    console.log('Base de données "Projet" créée ou déjà existante');

    // Sélectionner la base de données
    db.query("USE Projet", (err) => {
      if (err) throw err;
      console.log('Utilisation de la base de données "Projet"');

      // Création des tables après avoir sélectionné la base de données
      createTables();
    });
  });
});

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

// --- 2) Fonction d’insertion/maj en base ---
function recordFailedLogin(ip, deviceId) {
  const query = `
      INSERT INTO failed_logins
        (ip, device_id, attempt_count, first_attempt, block_until, last_attempt)
      VALUES
        (?, ?, 1, NOW(), DATE_ADD(NOW(), INTERVAL 10 MINUTE), NOW())
      ON DUPLICATE KEY UPDATE
        attempt_count = attempt_count + 1,
        last_attempt   = NOW(),
        block_until    = IF(
                           attempt_count + 1 >= 3,
                           DATE_ADD(GREATEST(first_attempt, NOW()), INTERVAL 10 MINUTE),
                           block_until
                         )
    `;
  db.query(query, [ip, deviceId], (err) => {
    if (err) console.error("❌ Échec enregistrement failed_logins :", err);
    else console.log(`✅ failed_logins enregistré pour ${ip} / ${deviceId}`);
  });
}

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

//Vérifie le token de Google reCAPTCHA
// async function verifyCaptcha(token) {
//   const secretKey = "6LfyXycrAAAAAJ_V2AtSB21P0Nj30wKfdUhn7eVY"; // Remplace par ta clé secrète
//   const url = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;

//   const response = await axios.post(url);
//   return response.data.success;
// }

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

// Configuration du transporteur SMTP (ici exemple Gmail / OAuth ou SMTP classique)
const transporter = nodemailer.createTransport({
  service: "gmail", // ou utiliser "host" si tu utilises un SMTP dédié comme Mailgun, Sendinblue, etc.
  auth: {
    user: "projetlpr@gmail.com", // ton vrai mail Gmail
    pass: "bjzb xsca nabe bxms", // mot de passe ou mot de passe d’application
  },
});

app.post("/create-account", async (req, res) => {
  const { nom, prenom, email, password, confirmPassword } = req.body;

  // if (!await verifyCaptcha(captchaToken)) {
  // return res.status(400).json({ message: "Échec du CAPTCHA. Veuillez réessayer." });
  // }

  // 1) Vérifications de base
  if (!nom || !prenom || !email || !password || !confirmPassword)
    return res.status(400).json({ message: "Tous les champs sont requis" });
  if (password !== confirmPassword)
    return res
      .status(400)
      .json({ message: "Les mots de passe ne correspondent pas" });

  // 2) Vérifier si l'email existe déjà
  db.query("SELECT id FROM users WHERE email = ?", [email], (err, result) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Erreur de vérification de l'email" });
    if (result.length > 0)
      return res.status(400).json({ message: "Cet email est déjà utilisé" });

    // Génération d'un salt unique
    const salt = crypto.randomBytes(16).toString("hex");

    // 3) Hachage du mot de passe
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Erreur lors du hachage du mot de passe" });

      // 4) Génération du token de vérification
      const token = crypto.randomBytes(32).toString("hex");
      const expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

      // 5) Insertion de l'utilisateur en base, avec token & expiry
      const insertQuery = `
          INSERT INTO users 
            (nom, prenom, email, mot_de_passe, salt, is_verified, verify_token, token_expiry)
          VALUES (?, ?, ?, ?, ?, FALSE, ?, ?)
        `;
      db.query(
        insertQuery,
        [nom, prenom, email, hashedPassword, salt, token, expiryDate],
        (err, result) => {
          if (err) {
            console.error("Erreur SQL :", err);
            return res
              .status(500)
              .json({ message: "Erreur lors de la création du compte" });
          }

          // 6) Envoi de l'email de vérification
          const verifyLink = `https://api.recharge.cielnewton.fr/verify-email?token=${token}`;
          transporter.sendMail(
            {
              from: '"Recharge Électrique Lycée" <projetlpr@gmail.com>',
              to: email,
              subject: "Veuillez vérifier votre adresse email",
              html: `
                <p>Bonjour ${prenom},</p>
                <p>Merci de vous être inscrit. Cliquez sur le lien ci-dessous pour activer votre compte :</p>
                <p><a href="${verifyLink}">Vérifier mon adresse email</a></p>
                <p>Ce lien expire dans 24 heures.</p>
              `,
            },
            (err, info) => {
              if (err) {
                console.error("📧 Erreur envoi email :", err);
                // On ne bloque pas la création de compte, mais on informe le nav.
              }
              // 7) Réponse au front
              return res.status(201).json({
                message:
                  "Compte créé ! Un email de vérification vous a été envoyé.",
              });
            }
          );
        }
      );
    });
  });
});

// 4) Route de vérification du token
app.get("/verify-email", (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send("Token manquant");

  const selectQ = `
      SELECT id, token_expiry 
        FROM users 
       WHERE verify_token = ?
    `;
  db.query(selectQ, [token], (err, rows) => {
    if (err) return res.status(500).send("Erreur serveur");
    if (rows.length === 0) return res.status(400).send("Token invalide");
    const { id, token_expiry } = rows[0];
    if (new Date(token_expiry) < new Date())
      return res.status(400).send("Token expiré");

    // Activation du compte
    const updateQ = `
        UPDATE users 
           SET is_verified=TRUE, 
               verify_token=NULL, 
               token_expiry=NULL 
         WHERE id=?
      `;
    db.query(updateQ, [id], (err) => {
      if (err) return res.status(500).send("Erreur mise à jour");
      return res.send(
        "Adresse email vérifiée ! Vous pouvez maintenant vous connecter."
      );
    });
  });
});

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

// Route admin/login
app.post("/admin/login", async (req, res) => {
  const { email, password /*, captchaToken*/ } = req.body;

  // 1) Champs requis
  if (!email || !password /* || !captchaToken*/) {
    return res
      .status(400)
      .json({ message: "Email, mot de passe et CAPTCHA sont requis" });
  }

  // 2) Vérification du CAPTCHA
  // try {
  //   if (!(await verifyCaptcha(captchaToken))) {
  //     return res
  //       .status(400)
  //       .json({ message: "Échec du CAPTCHA. Veuillez réessayer." });
  //   }
  // } catch (err) {
  //   console.error("Erreur verifyCaptcha :", err);
  //   return res.status(500).json({ message: "Erreur de vérification CAPTCHA" });
  // }

  // 3) Gestion du deviceId
  let deviceId = req.cookies.deviceId;
  if (!deviceId) {
    deviceId = crypto.randomBytes(16).toString("hex");
    res.cookie("deviceId", deviceId, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
    });
  }

  // 4) Récupération de l’IP publique
  const ip = req.ip;

  // 5) Rate-limiting : vérifier si bloqué
  db.query(
    `SELECT attempt_count, block_until
         FROM failed_logins
        WHERE ip = ? AND device_id = ?`,
    [ip, deviceId],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Erreur base de données" });
      }

      if (rows.length && rows[0].attempt_count >= 3) {
        const unblock = new Date(rows[0].block_until).getTime();
        if (Date.now() < unblock) {
          const secs = Math.ceil((unblock - Date.now()) / 1000);
          return res.status(429).json({
            message: `Trop de tentatives. Réessayez dans ${secs}s.`,
            blockTime: rows[0].block_until,
          });
        }
      }

      // 6) Vérification de l’admin en base
      db.query(
        "SELECT * FROM admins WHERE email = ?",
        [email],
        (err, result) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ message: "Erreur vérif email" });
          }

          // Admin non trouvé
          if (result.length === 0) {
            recordFailedLogin(ip, deviceId);
            return res
              .status(400)
              .json({ message: "Email ou mot de passe incorrect" });
          }

          const admin = result[0];

          // 7) Comparaison du mot de passe
          bcrypt.compare(password, admin.mot_de_passe, (err, isMatch) => {
            if (err) {
              console.error(err);
              return res.status(500).json({ message: "Erreur bcrypt" });
            }
            if (!isMatch) {
              recordFailedLogin(ip, deviceId);
              return res
                .status(400)
                .json({ message: "Email ou mot de passe incorrect" });
            }

            // 8) Succès : purge des tentatives puis création de session
            db.query(
              "DELETE FROM failed_logins WHERE ip = ? AND device_id = ?",
              [ip, deviceId],
              (err) => {
                if (err)
                  console.error("❌ Erreur suppression failed_logins :", err);

                req.session.idUtilisateur = admin.id;
                return res.status(200).json({
                  message: "Connexion réussie",
                  userId: admin.id,
                  redirect: "/access-control-dashboard",
                });
              }
            );
          });
        }
      );
    }
  );
});

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

// Route de connexion
app.post("/login", async (req, res) => {
  const { email, password /*, captchaToken*/ } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Veuillez remplir tous les champs" });
  }

  // if (!(await verifyCaptcha(captchaToken))) {
  //   return res
  //     .status(400)
  //     .json({ message: "Échec du CAPTCHA. Veuillez réessayer." });
  // }

  let deviceId = req.cookies.deviceId;
  if (!deviceId) {
    deviceId = crypto.randomBytes(16).toString("hex");
    // cookie persistant 30 jours
    res.cookie("deviceId", deviceId, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  // Express récupère pour nous la vraie IP publique
  const ip = req.ip;

  // 3.1) Vérifier en base si IP est déjà bloquée
  db.query(
    `SELECT attempt_count, block_until
     FROM failed_logins
    WHERE ip = ? AND device_id = ?`,
    [ip, deviceId],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Erreur base de données" });
      }

      if (rows.length && rows[0].attempt_count >= 3) {
        const unblock = new Date(rows[0].block_until).getTime();
        if (Date.now() < unblock) {
          const secs = Math.ceil((unblock - Date.now()) / 1000);
          return res.status(429).json({
            message: `Trop de tentatives. Réessayez dans ${secs}s.`,
            blockTime: rows[0].block_until,
          });
        }
      }

      // 3.2) Vérification de l’utilisateur
      db.query(
        "SELECT * FROM users WHERE email = ?",
        [email],
        (err, result) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ message: "Erreur vérif email" });
          }

          // Email non trouvé
          if (result.length === 0) {
            recordFailedLogin(ip, deviceId);
            return res
              .status(400)
              .json({ message: "Email ou mot de passe incorrect" });
          }

          const user = result[0];

          // Empêcher la connexion si email non vérifié
          if (!user.is_verified) {
            return res.status(403).json({
              message:
                "Veuillez vérifier votre adresse email avant de vous connecter.",
            });
          }

          // 🔥 Comparaison du mot de passe
          bcrypt.compare(password, user.mot_de_passe, (err, isMatch) => {
            if (err) {
              console.error(err);
              return res.status(500).json({ message: "Erreur bcrypt" });
            }

            // Mauvais mot de passe
            if (!isMatch) {
              recordFailedLogin(ip, deviceId);
              return res
                .status(400)
                .json({ message: "Email ou mot de passe incorrect" });
            }

            // Succès : on purge les tentatives en base
            db.query(
              "DELETE FROM failed_logins WHERE ip = ? AND device_id = ?",
              [ip, deviceId],
              (err) => {
                if (err)
                  console.error("❌ Erreur suppression failed_logins :", err);
                // On peut ignorer l’erreur ici, l’utilisateur est authentifié
                req.session.idUtilisateur = user.id;
                res.status(200).json({
                  message: "Connexion réussie",
                  userId: user.id,
                  redirect: "/dashboard",
                });
              }
            );
          });
        }
      );
    }
  );
});

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

//Route de suppression de compte
app.delete("/delete-account", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email et mot de passe sont requis" });
  }

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, result) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Erreur lors de la vérification de l'utilisateur" });
    }

    if (result.length === 0) {
      return res
        .status(400)
        .json({ message: "Email ou mot de passe incorrect" });
    }

    const user = result[0];
    const deletedPassword = bcrypt.hashSync("deIeted", 10);

    bcrypt.compare(password, user.mot_de_passe, (err, isMatch) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Erreur lors de la vérification du mot de passe" });
      }

      if (!isMatch) {
        return res
          .status(400)
          .json({ message: "Email ou mot de passe incorrect" });
      }

      // Stocker l'ancien email, anonymiser le champ email et mot de passe, et marquer comme supprimé
      db.query(
        "UPDATE users SET old_email = email, email = CONCAT('deleted_', id, '@deleted.com'), mot_de_passe = ?, status = 'supprimé' WHERE id = ?",
        [deletedPassword, user.id],
        (err) => {
          if (err) {
            return res
              .status(500)
              .json({ message: "Erreur lors de la suppression du compte" });
          }

          return res
            .status(200)
            .json({ message: "Compte désactivé avec succès", redirect: "/" });
        }
      );
    });
  });
});

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

const ADMIN_EMAIL = "projetlpr@gmail.com";

app.post("/contact", async (req, res) => {
  const userId = req.session.idUtilisateur;
  if (!userId) {
    return res.status(401).json({ message: "Utilisateur non authentifié." });
  }

  const { subject, message } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ message: "Sujet et message sont requis." });
  }

  try {
    // 1) Récupérer l'email en base
    const [rows] = await new Promise((resolve, reject) => {
      db.query(
        "SELECT email FROM users WHERE id = ?",
        [userId],
        (err, result) => {
          err ? reject(err) : resolve([result]);
        }
      );
    });
    if (rows.length === 0) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }
    const userEmail = rows[0].email;

    // 2) Envoi à l’administrateur
    await transporter.sendMail({
      from: userEmail,
      to: ADMIN_EMAIL,
      subject: `[Contact Utilisateur] ${subject}`,
      text: `Email : ${userEmail}\n\nMessage :\n${message}`,
    });

    // 3) Accusé de réception
    await transporter.sendMail({
      from: ADMIN_EMAIL,
      to: userEmail,
      subject: "Demande bien reçue",
      text: `Bonjour,\n\nNous avons reçu votre message : "${subject}".\nNous revenons vers vous très vite.\n\nL'équipe support.`,
    });

    res.json({ message: "Votre message a bien été envoyé." });
  } catch (err) {
    console.error("Erreur /contact :", err);
    res.status(500).json({ message: "Erreur lors de l'envoi du message." });
  }
});

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

// Route protégée pour afficher le dashboard
app.get("/access-control-dashboard", protectionRoute, (req, res) => {
  res.sendFile(path.resolve(__dirname, "../../admin/dashboard_admin.html"));
});

// Route protégée pour afficher le dashboard
app.get("/dashboard", protectionRoute, (req, res) => {
  res.sendFile(path.resolve(__dirname, "../../html/dashboard_admin.html"));
});

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

// Route POST pour enregistrer un achat et ensuite afficher le dashboard
app.post("/dashboard", protectionRoute, (req, res) => {
  const { email, kwh, montant } = req.body;
  const date = new Date().toISOString().slice(0, 19).replace("T", " ");

  // Log initial pour vérifier que la route est atteinte
  console.log("Réception de la requête pour /dashboard");
  console.log("Données reçues : ", { email, kwh, montant });

  if (!email) {
    console.log("L'email est manquant.");
    return res.status(400).send("L'email est requis.");
  }

  // Vérification si l'utilisateur existe déjà
  db.query("SELECT id FROM users WHERE email = ?", [email], (err, result) => {
    if (err) {
      console.error(
        "Erreur MySQL lors de la vérification de l'utilisateur :",
        err
      );
      return res.status(500).send("Erreur interne");
    }

    // Log du résultat de la recherche d'utilisateur
    console.log("Résultat de la recherche utilisateur :", result);

    let userId = result.length > 0 ? result[0].id : null;
    console.log("ID utilisateur trouvé :", userId);

    // Si l'utilisateur n'existe pas, on l'ajoute
    if (!userId) {
      console.log("L'utilisateur n'existe pas, ajout de l'utilisateur...");

      db.query(
        "INSERT INTO users (email) VALUES (?)",
        [email.trim()],
        (err, result) => {
          if (err) {
            console.error(
              "Erreur MySQL lors de l'ajout de l'utilisateur :",
              err
            );
            return res.status(500).send("Erreur interne");
          }

          userId = result.insertId; // On récupère l'id de l'utilisateur ajouté
          console.log("Nouvel utilisateur ajouté avec ID :", userId); // Log de l'ID utilisateur

          // Appel de la fonction pour enregistrer l'achat après l'ajout
          enregistrerAchat(userId, kwh, montant, date, res);
        }
      );
    } else {
      console.log(
        "Utilisateur existant, utilisation de l'ID utilisateur :",
        userId
      );
      // Appel de la fonction pour enregistrer l'achat si l'utilisateur existe
      enregistrerAchat(userId, kwh, montant, date, res);
    }
  });
});

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

// Fonction pour enregistrer un achat
function enregistrerAchat(userId, kwh, montant, date, res) {
  console.log(
    "Tentative d'enregistrement de l'achat dans la base de données..."
  );
  const query =
    "INSERT INTO achats_kwh (user_id, kwh_achetes, montant, date_achat) VALUES (?, ?, ?, ?)";

  // Ajout de l'ID de l'utilisateur, kWh, montant et date pour être sûr que les bonnes données sont envoyées à la DB
  console.log("Données pour l'achat :", { userId, kwh, montant, date });

  db.query(query, [userId, kwh, montant, date], (err, result) => {
    if (err) {
      console.error("Erreur lors de l'insertion dans la base de données:", err);
      return res.status(500).send("Erreur lors de l'enregistrement de l'achat");
    }

    // Log du résultat de l'insertion dans la base de données
    console.log("Achat enregistré avec succès. Résultat:", result);
    return res.status(200).send("Achat enregistré avec succès");
  });
}

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Erreur lors de la déconnexion." });
    }
    res.json({ redirect: "/" });
  });
});

// Vérifier la session
app.get("/check-session", (req, res) => {
  if (req.session.idUtilisateur) {
    res.status(200).json({ sessionActive: true });
  } else {
    res.status(401).json({ sessionActive: false });
  }
});

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

app.get("/get-user-info", protectionRoute, (req, res) => {
  console.log(req.session); // Vérifie si la session contient bien l'idUtilisateur
  if (!req.session.idUtilisateur) {
    return res.status(401).json({ message: "Utilisateur non authentifié" });
  }

  db.query(
    "SELECT u.id AS user_id, u.email, u.prenom, u.nom, u.status, a.id AS achat_id, a.kwh_achetes, a.montant AS achat_montant, a.date_achat, c.id AS credit_id, c.credit AS credit_montant FROM users u LEFT JOIN achats_kwh a ON u.id = a.user_id LEFT JOIN credits c ON u.id = c.user_id WHERE u.id = ?;",
    [req.session.idUtilisateur],
    (err, result) => {
      if (err) {
        return res.status(500).json({ message: "Erreur serveur" });
      }
      if (result.length === 0) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      res.status(200).json(result[0]);
    }
  );
});

// Route pour récupérer le nom et prénom
app.get("/get-user-info-nom-prenom", protectionRoute, (req, res) => {
  if (!req.session.idUtilisateur) {
    return res.status(401).json({ message: "Utilisateur non authentifié" });
  }
  db.query(
    "SELECT u.prenom, u.nom FROM users u WHERE u.id = ?;",
    [req.session.idUtilisateur],
    (err, result) => {
      if (err) {
        return res.status(500).json({ message: "Erreur serveur" });
      }
      if (result.length === 0) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      const user = result[0];
      const message = `Bonjour ${user.prenom} ${user.nom} !`;
      res.status(200).json({ message: message });
    }
  );
});

app.get("/get-user-info-credits", protectionRoute, (req, res) => {
  if (!req.session.idUtilisateur) {
    return res.status(401).json({ message: "Utilisateur non authentifié" });
  }

  // Récupérer les crédits et le total payé de l'utilisateur
  db.query(
    "SELECT c.credit, c.total_paid FROM users u LEFT JOIN credits c ON u.id = c.user_id WHERE u.id = ?;",
    [req.session.idUtilisateur],
    (err, result) => {
      if (err) {
        return res.status(500).json({ message: "Erreur serveur" });
      }
      if (result.length === 0) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }

      // Si l'utilisateur a des crédits ou un total payé, les renvoyer, sinon renvoyer 0
      const credits = result[0].credit ? result[0].credit : 0;
      const totalPaid = result[0].total_paid ? result[0].total_paid : 0;

      // Envoi des crédits et du total payé au client
      res.status(200).json({
        credits: credits, // Montant des crédits restants
        totalPaid: totalPaid, // Montant total payé
      });
    }
  );
});

app.get("/get-user-id", (req, res) => {
  if (!req.session || !req.session.idUtilisateur) {
    return res.status(401).json({ message: "Utilisateur non connecté" });
  }

  res.status(200).json({ userId: req.session.idUtilisateur });
});

app.get("/get-current-kwh-price", async (req, res) => {
  db.query(
    "SELECT prix_kwh FROM tarifs ORDER BY date_maj DESC LIMIT 1",
    (err, result) => {
      if (err) {
        console.error("Erreur lors de la récupération du prix du kWh:", err);
        return res.status(500).json({ error: "Erreur serveur" });
      }
      res.json({ prix_kwh: result[0]?.prix_kwh || 0.2 }); // Valeur par défaut si pas trouvé
    }
  );
});

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

app.post("/update-credits", protectionRoute, (req, res) => {
  const { kwh } = req.body;

  if (!req.session.idUtilisateur) {
    return res.status(401).json({ message: "Utilisateur non authentifié" });
  }

  const kwhAchat = parseFloat(kwh);
  if (isNaN(kwhAchat) || kwhAchat <= 0) {
    return res.status(400).json({ message: "Valeur de kWh invalide" });
  }

  // Étape 1 : Récupérer le tarif actuel
  db.query(
    "SELECT prix_kwh FROM tarifs ORDER BY date_maj DESC LIMIT 1",
    (err, resultTarif) => {
      if (err || resultTarif.length === 0) {
        console.error("Erreur tarif:", err);
        return res
          .status(500)
          .json({ message: "Erreur récupération du tarif" });
      }

      const tarifParKwh = resultTarif[0].prix_kwh;
      const montantPaye = kwhAchat * tarifParKwh;

      // Étape 2 : Insérer l'achat dans `achats_kwh`
      db.query(
        "INSERT INTO achats_kwh (user_id, kwh_achetes, montant, prix_kwh) VALUES (?, ?, ?, ?)",
        [req.session.idUtilisateur, kwhAchat, montantPaye, tarifParKwh],
        (err) => {
          if (err) {
            console.error("Erreur insertion achats_kwh:", err);
            return res
              .status(500)
              .json({ message: "Erreur lors de l'enregistrement de l'achat" });
          }

          // Étape 3 : Ajouter les crédits sans modifier le total_paid si déjà existant
          db.query(
            "SELECT credit FROM credits WHERE user_id = ?",
            [req.session.idUtilisateur],
            (err, resultCredit) => {
              if (err) {
                console.error("Erreur lecture crédits:", err);
                return res
                  .status(500)
                  .json({ message: "Erreur lecture crédits" });
              }

              if (resultCredit.length > 0) {
                db.query(
                  "UPDATE credits SET credit = credit + ? WHERE user_id = ?",
                  [kwhAchat, req.session.idUtilisateur],
                  (err) => {
                    if (err) {
                      console.error("Erreur mise à jour crédits:", err);
                      return res
                        .status(500)
                        .json({ message: "Erreur mise à jour crédits" });
                    }

                    return res
                      .status(200)
                      .json({ message: "Crédits mis à jour avec succès" });
                  }
                );
              } else {
                // Premier achat : on initialise aussi total_paid
                db.query(
                  "INSERT INTO credits (user_id, credit, total_paid) VALUES (?, ?, ?)",
                  [req.session.idUtilisateur, kwhAchat, montantPaye],
                  (err) => {
                    if (err) {
                      console.error("Erreur création ligne crédits:", err);
                      return res
                        .status(500)
                        .json({ message: "Erreur création crédits" });
                    }

                    return res
                      .status(200)
                      .json({ message: "Crédits ajoutés avec succès" });
                  }
                );
              }
            }
          );
        }
      );
    }
  );
});

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

app.post("/update-kwh-price", (req, res) => {
  const { prix_kwh } = req.body; // Le nouveau prix envoyé en POST

  if (!prix_kwh || isNaN(prix_kwh) || prix_kwh <= 0) {
    console.log("Prix invalide:", prix_kwh);
    return res.status(400).json({ error: "Prix invalide" });
  }

  // Récupérer le prix actuel du kWh pour ajuster les crédits
  db.query(
    "SELECT prix_kwh FROM tarifs ORDER BY date_maj DESC LIMIT 1",
    (err, result) => {
      if (err) {
        console.error(
          "Erreur lors de la récupération du prix actuel du kWh:",
          err
        );
        return res.status(500).json({
          error: "Erreur serveur lors de la récupération du prix actuel du kWh",
        });
      }

      const ancienPrixKwh = result[0]?.prix_kwh; // Valeur par défaut si pas trouvé

      console.log("Ancien prix du kWh:", ancienPrixKwh);

      // Mise à jour du prix du kWh dans la table tarifs
      db.query(
        "INSERT INTO tarifs (prix_kwh) VALUES (?)",
        [prix_kwh],
        (err, result) => {
          if (err) {
            console.error("Erreur lors de la mise à jour du prix du kWh:", err);
            return res.status(500).json({
              error: "Erreur serveur lors de la mise à jour du prix du kWh",
            });
          }

          console.log("Nouveau prix du kWh inséré:", prix_kwh);

          // Récupérer les crédits des utilisateurs et ajuster en fonction du changement de prix
          db.query(
            "SELECT user_id, credit FROM credits",
            (err, utilisateurs) => {
              if (err) {
                console.error(
                  "Erreur lors de la récupération des crédits des utilisateurs:",
                  err
                );
                return res.status(500).json({
                  error: "Erreur serveur lors de la récupération des crédits",
                });
              }

              // Mise à jour des crédits pour chaque utilisateur
              utilisateurs.forEach((user) => {
                const creditsAjustes = (user.credit * ancienPrixKwh) / prix_kwh;

                // Mise à jour des crédits pour chaque utilisateur
                db.query(
                  "UPDATE credits SET credit = ? WHERE user_id = ?",
                  [creditsAjustes, user.user_id],
                  (err) => {
                    if (err) {
                      console.error(
                        "Erreur lors de la mise à jour des crédits pour l'utilisateur",
                        user.user_id,
                        err
                      );
                    } else {
                      console.log(
                        `Crédits ajustés pour l'utilisateur ${user.user_id}: ${creditsAjustes}`
                      );
                    }
                  }
                );
              });

              res.json({
                success: true,
                message: "Prix du kWh mis à jour et crédits ajustés",
              });
            }
          );
        }
      );
    }
  );
});

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

const mqtt = require("mqtt");

app.post("/api/scan", protectionRoute, (req, res) => {
  const { id_prise } = req.body;
  if (!id_prise) {
    return res.status(400).json({ message: "ID de prise manquant" });
  }

  // Requête vers la table `ids`
  db.query(
    "SELECT valeur_id, nom_prise, localite FROM ids WHERE valeur_id = ?",
    [id_prise],
    (err, results) => {
      if (err) {
        console.error("Erreur SQL (scan) :", err);
        return res.status(500).json({ message: "Erreur serveur" });
      }
      if (results.length === 0) {
        // pas trouvé → 404
        return res.status(404).json({ message: "Prise inconnue" });
      }

      // trouvé → on renvoie les infos + topic MQTT
      const prise = results[0];
      res.json({
        nom: prise.nom_prise,
        id: prise.valeur_id,
        localite: prise.localite,
        topic: `shellyplusplugs-${prise.valeur_id}/rpc`,
      });
    }
  );
});

// Connexion MQTT
const mqttOptions = {
  host: "47567f9a74b445e6bef394abec5c83a1.s1.eu.hivemq.cloud",
  port: 8884, // Utilisez le bon port MQTT WebSocket
  username: "ShellyPlusPlugS",
  password: "Ciel92110",
  protocol: "wss", // Assurez-vous d'utiliser WebSocket sécurisé (WSS)
};

const client = mqtt.connect(
  `wss://${mqttOptions.host}:${mqttOptions.port}/mqtt`,
  mqttOptions
);

const outletStates = {};
// { [id_prise]: { isPlugOn, powerReadings, onTimestamp, userId, creditChecker } }

client.on("connect", () => {
  console.log("✅ Connecté au broker MQTT");
});

client.on("message", (topic, message) => {
  const idMatch = topic.match(/shellyplusplugs-(.*)\/(status|apower)/);
  if (!idMatch) return;
  const id_prise = idMatch[1];
  const state = outletStates[id_prise];
  if (!state) return;

  try {
    const data = JSON.parse(message.toString());
    if (topic.endsWith("/status") && data.switch) {
      state.isPlugOn = data.switch.output;
    }
    if (
      topic.endsWith("/apower") &&
      state.isPlugOn &&
      data.apower !== undefined
    ) {
      state.powerReadings.push(data.apower);
      // après chaque relevé, tu peux vérifier si crédit encore OK
      checkCreditsAndPower(state.userId, id_prise);
    }
  } catch (e) {
    console.error(`❌ Erreur de parsing MQTT :`, e);
  }
});

// --- refacto de ta fonction de contrôle automatique ---
async function checkCreditsAndPower(userId, id_prise) {
  const state = outletStates[id_prise];
  if (!state || !state.isPlugOn) return;

  const now = Date.now();
  const durationSec = Math.floor((now - state.onTimestamp) / 1000);
  const avgPower =
    state.powerReadings.length > 0
      ? state.powerReadings.reduce((a, b) => a + b, 0) /
        state.powerReadings.length
      : 0;
  const energyKWh = (avgPower * durationSec) / 3600000;

  try {
    // Récupérer tarif et crédit
    const [[{ prix_kwh }]] = await db
      .promise()
      .query("SELECT prix_kwh FROM tarifs ORDER BY date_maj DESC LIMIT 1");
    const [[{ credit }]] = await db
      .promise()
      .query("SELECT credit FROM credits WHERE user_id = ?", [userId]);

    const remaining = parseFloat(credit) - energyKWh;

    if (remaining <= 0) {
      // 1) enregistrer l’historique + reset crédit
      await recordHistoryAndReset(
        id_prise,
        userId,
        avgPower,
        durationSec,
        energyKWh,
        prix_kwh
      );

      // 2) couper la prise
      const topic = `shellyplusplugs-${id_prise}/rpc`;
      const msg = JSON.stringify({
        id: 999,
        src: "auto",
        method: "Switch.Set",
        params: { id: 0, on: false },
      });
      client.publish(topic, msg, (err) => {
        if (err) console.error("Erreur MQTT auto-off :", err);
        else console.log(`⚠️ Crédit épuisé : extinction auto ${id_prise}`);
      });

      // 3) nettoyage
      clearInterval(state.creditChecker);
      delete outletStates[id_prise];
    } else {
      // simple mise à jour du crédit
      await db
        .promise()
        .query("UPDATE credits SET credit = ? WHERE user_id = ?", [
          remaining.toFixed(5),
          userId,
        ]);
      console.log(
        `🔄 Crédit mis à jour pour ${id_prise} : ${remaining.toFixed(5)} kWh`
      );
    }
  } catch (err) {
    console.error("Erreur checkCreditsAndPower :", err);
  }
}

// --- Allumer la prise avec démarrage du timer ---
app.post("/allumer-prise", protectionRoute, (req, res) => {
  const userId = req.session.idUtilisateur;
  const { id_prise } = req.body;
  if (!userId) return res.status(401).send("Utilisateur non authentifié.");
  if (!id_prise) return res.status(400).send("ID de prise manquant");

  db.query("SELECT 1 FROM ids WHERE valeur_id = ?", [id_prise], (err, rows) => {
    if (err) return res.status(500).send("Erreur serveur");
    if (rows.length === 0) return res.status(404).send("Prise inconnue");

    db.query(
      "SELECT credit FROM credits WHERE user_id = ?",
      [userId],
      (err2, result) => {
        if (err2 || result.length === 0)
          return res.status(500).send("Erreur crédits");
        const credits = result[0].credit || 0;
        if (credits <= 0) return res.status(403).send("Crédits insuffisants");

        const topic = `shellyplusplugs-${id_prise}/rpc`;
        const message = JSON.stringify({
          id: 123,
          src: "user",
          method: "Switch.Set",
          params: { id: 0, on: true },
        });

        client.publish(topic, message, (err3) => {
          if (err3) return res.status(500).send("Erreur MQTT");

          client.subscribe([
            `shellyplusplugs-${id_prise}/apower`,
            `shellyplusplugs-${id_prise}/status`,
          ]);

          // initialise l'état
          outletStates[id_prise] = {
            isPlugOn: true,
            powerReadings: [],
            onTimestamp: Date.now(),
            userId,
            creditChecker: null,
          };

          // démarre le timer toutes les 60s
          outletStates[id_prise].creditChecker = setInterval(() => {
            checkCreditsAndPower(userId, id_prise);
          }, 60 * 1000);

          // débite un tout petit en attendant
          db.query(
            "UPDATE credits SET credit = credit - 0.01 WHERE user_id = ?",
            [userId],
            () => {
              return res.status(200).send(`✅ Prise ${id_prise} allumée`);
            }
          );
        });
      }
    );
  });
});

// --- Éteindre la prise et clearInterval ---
app.post("/eteindre-prise", protectionRoute, async (req, res) => {
  const userId = req.session.idUtilisateur;
  const { id_prise } = req.body;
  const state = outletStates[id_prise];

  if (!userId) return res.status(401).send("Utilisateur non authentifié.");
  if (!state) return res.status(400).send("Prise inconnue");

  // calculs identiques à checkCreditsAndPower
  const now = Date.now();
  const durationSec = Math.floor((now - state.onTimestamp) / 1000);
  const avgPower =
    state.powerReadings.length > 0
      ? state.powerReadings.reduce((a, b) => a + b, 0) /
        state.powerReadings.length
      : 0;
  const energyKWh = (avgPower * durationSec) / 3600000;
  const [[{ prix_kwh }]] = await db
    .promise()
    .query("SELECT prix_kwh FROM tarifs ORDER BY date_maj DESC LIMIT 1");

  // 1) enregistrer l’historique complet
  await db.promise().query(
    `INSERT INTO historique 
       (id_prise, id_user, puissance_consomme, temps_utilise, energie_consomme, prix_de_reference)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id_prise,
      userId,
      avgPower.toFixed(2),
      durationSec,
      energyKWh.toFixed(5),
      prix_kwh,
    ]
  );

  // 2) couper la prise MQTT
  const topic = `shellyplusplugs-${id_prise}/rpc`;
  const msg = JSON.stringify({
    id: 124,
    src: "user",
    method: "Switch.Set",
    params: { id: 0, on: false },
  });
  client.publish(topic, msg, (err) => {
    if (err) return res.status(500).send("Erreur MQTT");
  });

  // 3) stop timer et nettoie l’état
  if (state.creditChecker) clearInterval(state.creditChecker);
  delete outletStates[id_prise];

  console.log(`✅ Prise ${id_prise} éteinte manuellement`);
  return res.status(200).json({ message: `Prise ${id_prise} éteinte` });
});

module.exports = app;

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

// Route pour afficher l'historique de consommation de l'utilisateur
app.get("/historique-consommation", protectionRoute, (req, res) => {
  const userId = req.session.idUtilisateur;
  if (!userId) {
    return res.status(401).json({ message: "Utilisateur non authentifié" });
  }

  // On suppose que la table d'historique s'appelle "historique"
  // et que les colonnes sont nommées comme indiqué.
  const query = `
    SELECT id_prise, id_user, puissance_consomme, temps_utilise, energie_consomme, prix_de_reference, date_enregistrement 
    FROM historique 
    WHERE id_user = ? 
    ORDER BY date_enregistrement DESC
  `;
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Erreur lors de la récupération de l'historique :", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }
    res.status(200).json(results);
  });
});

async function recordHistoryAndReset(
  id_prise,
  userId,
  avgPower,
  durationSec,
  energyKWh,
  prix_kwh
) {
  // 1. Insérer l’historique
  await db.promise().query(
    `INSERT INTO historique 
       (id_prise, id_user, puissance_consomme, temps_utilise, energie_consomme, prix_de_reference)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id_prise,
      userId,
      avgPower.toFixed(2),
      durationSec,
      energyKWh.toFixed(5),
      prix_kwh,
    ]
  );

  // 2. Remettre le crédit à zéro
  await db
    .promise()
    .query("UPDATE credits SET credit = 0 WHERE user_id = ?", [userId]);
}

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

app.get("/ids", (req, res) => {
  const sql = "SELECT id, valeur_id, nom_prise, localite FROM ids";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Erreur SQL (lecture) :", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }
    res.json(results);
  });
});

// 3.2. Ajouter une prise
// Attend { valeur_id, nom_prise, localite } en JSON, renvoie { message }
app.post("/add", (req, res) => {
  const { valeur_id, nom_prise, localite } = req.body;
  if (!valeur_id || !nom_prise || !localite) {
    return res.status(400).json({ message: "Champs manquants" });
  }
  const sql =
    "INSERT INTO ids (valeur_id, nom_prise, localite) VALUES (?, ?, ?)";
  db.query(sql, [valeur_id, nom_prise, localite], (err) => {
    if (err) {
      console.error("Erreur SQL (ajout) :", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }
    res.json({ message: "Prise ajoutée avec succès" });
  });
});

// 3.3. Mettre à jour une prise
// Paramètre URL : l’ID de table (champ `id`), body { nom_prise, localite }
app.put("/update/:id", (req, res) => {
  const id = req.params.id;
  const { nom_prise, localite } = req.body;
  if (!nom_prise || !localite) {
    return res
      .status(400)
      .json({ message: "Champs de modification manquants" });
  }
  const sql = "UPDATE ids SET nom_prise = ?, localite = ? WHERE id = ?";
  db.query(sql, [nom_prise, localite, id], (err) => {
    if (err) {
      console.error("Erreur SQL (modification) :", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }
    res.json({ message: "Prise modifiée avec succès" });
  });
});

// 3.4. Supprimer une prise
// Paramètre URL : l’ID de table (champ `id`)
app.delete("/prises/:id", (req, res) => {
  const id = req.params.id;
  const sql = "DELETE FROM ids WHERE id = ?";
  db.query(sql, [id], (err) => {
    if (err) {
      console.error("Erreur SQL (suppression) :", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }
    res.json({ message: "Prise supprimée avec succès" });
  });
});

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

app.listen(port, () => {
  console.log(`Le serveur web écoute sur le port ${port}`);
});
