require("dotenv").config();
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const session = require('express-session');
const { log } = require("console");
const app = express();
const port = 3047;

// Configuration CORS pour autoriser le serveur web (port 3045)
const corsOptions = {
  origin: ['https://recharge.cielnewton.fr', 'https://admin.recharge.cielnewton.fr'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(express.json());

// Configuration de la session
app.use(session({
  name : process.env.SESSION_NAME, // par exemple "sid"
  resave : false,
  saveUninitialized : false,
  secret : process.env.SESSION_SECRET,
  cookie : {
      maxAge : 1000 * 60 * 60 * 24,
      secure : false,       // en prod, mettre true si HTTPS
      httpOnly: true,
      sameSite: 'Lax',
      domain: '.recharge.cielnewton.fr'  // Pour partager le cookie entre ports sur localhost
  }
}));

// Middleware de protection (renvoie JSON en cas d'échec)
function protectionRoute(req, res, next) {
  if (req.session.idUtilisateur) {
    return next();
  } else {
    return res.status(401).json({ message: "Utilisateur non authentifié" });
  }
}

// Route pour récupérer l'ID utilisateur
app.get('/get-user-id', (req, res) => {
  if (req.session.idUtilisateur) {
      res.json({ userId: req.session.idUtilisateur });
  } else {
      res.status(401).json({ message: "Utilisateur non connecté" });
  }
});

// Middleware pour servir dynamiquement les fichiers CSS/JS
app.use('/css', express.static(path.join(__dirname, '../../css')));
app.use('/javascript', express.static(path.join(__dirname, '../../javascript')));
app.use('/javascript', express.static(path.join(__dirname, '../../admin')));

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
    old_email VARCHAR(255) DEFAULT NULL
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
    console.log('Table users created or already exists');

    db.query(createAdminsTableQuery, (err) => {
      if (err) throw err;
      console.log('Table admins created or already exists');

      db.query(createCreditsTableQuery, (err) => {
        if (err) throw err;
        console.log('Table credits created or already exists');

        db.query(createAchatsKwhTableQuery, (err) => {
          if (err) throw err;
          console.log('Table achats_kwh created or already exists');

          db.query(createHistoriqueTableQuery, (err) => {
            if (err) throw err;
            console.log('Table historique created or already exists');

            db.query(createTarifsTableQuery, (err) => {
              if (err) throw err;
              console.log('Table tarifs created or already exists');
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
    console.error('Erreur de connexion à MySQL:', err);
    return;
  }
  console.log('Connecté à MySQL');

  // Créer la base de données si elle n'existe pas
  db.query('CREATE DATABASE IF NOT EXISTS Projet', (err) => {
    if (err) throw err;
    console.log('Base de données "Projet" créée ou déjà existante');

    // Sélectionner la base de données
    db.query('USE Projet', (err) => {
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

// Route de création de compte
app.post('/create-account', (req, res) => {
  const { nom, prenom, email, password, confirmPassword } = req.body;

  // Vérification des données
  if (!nom || !prenom || !email || !password || !confirmPassword) {
    return res.status(400).json({ message: 'Tous les champs sont requis' });
  }

  // Vérification de la correspondance des mots de passe
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Les mots de passe ne correspondent pas' });
  }

  // Vérification si l'email existe déjà
  db.query('SELECT * FROM users WHERE email = ?', [email], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Erreur de vérification de l\'email' });
    }

    if (result.length > 0) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    // Hachage du mot de passe
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors du hachage du mot de passe' });
      }

      // Insertion dans la table "users"
      const query = 'INSERT INTO users (nom, prenom, email, mot_de_passe) VALUES (?, ?, ?, ?)';
      db.query(query, [nom, prenom, email, hashedPassword], (err, result) => {
        if (err) {
          return res.status(500).json({ message: 'Erreur lors de la création du compte', err });
        }

        // Récupérer l'ID de l'utilisateur nouvellement créé
        const userId = result.insertId;

        // Ajouter 10 crédits dans la table "credits"
        const creditsQuery = 'INSERT INTO credits (user_id, credit) VALUES (?, ?)';
        db.query(creditsQuery, [userId, 10.00], (err, result) => {
          if (err) {
            console.log(err)
            return res.status(500).json({ message: 'Erreur lors de l\'ajout des crédits' });
          }

          res.status(201).json({ message: 'Compte créé avec succès et crédit ajouté' });
        });
      });
    });
  });
});

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////


app.post('/admin/login', (req, res) => {
  console.log("Requête reçue sur /admin/login avec le body:", req.body);
  const { email, password } = req.body;
  if (!email || !password) {
    console.log("Champs manquants");
    return res.status(400).json({ message: "Veuillez remplir tous les champs" });
  }
  db.query('SELECT * FROM admins WHERE email = ?', [email], (err, result) => {
    if (err) {
      console.error("Erreur de DB:", err);
      return res.status(500).json({ message: 'Erreur de vérification de l\'email' });
    }
    if (result.length === 0) {
      console.log("Admin non trouvé");
      return res.status(400).json({ message: "Email ou mot de passe incorrect" });
    }
    const admin = result[0];
    bcrypt.compare(password, admin.mot_de_passe, (err, isMatch) => {
      if (err) {
        console.error("Erreur lors de la comparaison:", err);
        return res.status(500).json({ message: 'Erreur lors de la comparaison du mot de passe' });
      }
      if (!isMatch) {
        console.log("Mot de passe incorrect");
        return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
      }
      req.session.idUtilisateur = admin.id;
      console.log("Connexion réussie (admin), session:", req.session);
      return res.status(200).json({ message: "Connexion réussie", userId: admin.id, redirect: "/access-control-dashboard" });
    });
  });
});

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Veuillez remplir tous les champs" });
  }

  // Recherche dans la table users
  db.query('SELECT * FROM users WHERE email = ?', [email], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Erreur de vérification de l\'email' });
    }

    // Vérifiez si un utilisateur a été trouvé
    if (result.length === 0) {
      return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Utilisateur trouvé
    const user = result[0];

    // Comparer le mot de passe
    bcrypt.compare(password, user.mot_de_passe, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la comparaison du mot de passe' });
      }
      if (!isMatch) {
        return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
      }

      // Authentification réussie, enregistrez la session
      req.session.idUtilisateur = user.id;
      console.log("Connexion réussie (user) avec ID :", req.session.idUtilisateur);
      return res.status(200).json({ message: "Connexion réussie", userId: user.id, redirect: "/dashboard" });
    });
  });
});


///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

// Route de suppression de compte
app.delete('/delete-account', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email et mot de passe sont requis' });
  }

  db.query('SELECT * FROM users WHERE email = ?', [email], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Erreur lors de la vérification de l\'utilisateur' });
    }

    if (result.length === 0) {
      return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
    }

    const user = result[0];
    const deletedPassword = bcrypt.hashSync('deIeted', 10);

    bcrypt.compare(password, user.mot_de_passe, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la vérification du mot de passe' });
      }

      if (!isMatch) {
        return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
      }

      // Stocker l'ancien email, anonymiser le champ email et mot de passe, et marquer comme supprimé
      db.query(
          "UPDATE users SET old_email = email, email = CONCAT('deleted_', id, '@deleted.com'), mot_de_passe = ?, status = 'supprimé' WHERE id = ?",
          [deletedPassword, user.id],
          (err) => {
            if (err) {
              return res.status(500).json({ message: 'Erreur lors de la suppression du compte' });
            }

            return res.status(200).json({ message: 'Compte désactivé avec succès', redirect: "/"});
            
          }
        );          
    });
  });
});
  

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////


// Route protégée pour afficher le dashboard
app.get('/access-control-dashboard', protectionRoute, (req, res) => {
  res.sendFile(path.resolve(__dirname, '../../admin/dashboard_admin.html'));
});


// Route protégée pour afficher le dashboard
app.get('/dashboard', protectionRoute, (req, res) => {
  res.sendFile(path.resolve(__dirname, '../../html/dashboard_admin.html'));
});

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

// Route POST pour enregistrer un achat et ensuite afficher le dashboard
app.post('/dashboard', protectionRoute, (req, res) => {
  const { email, kwh, montant } = req.body;
  const date = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Log initial pour vérifier que la route est atteinte
  console.log('Réception de la requête pour /dashboard');
  console.log('Données reçues : ', { email, kwh, montant });

  if (!email) {
    console.log("L'email est manquant.");
    return res.status(400).send("L'email est requis.");
  }

  // Vérification si l'utilisateur existe déjà
  db.query('SELECT id FROM users WHERE email = ?', [email], (err, result) => {
    if (err) {
      console.error("Erreur MySQL lors de la vérification de l'utilisateur :", err);
      return res.status(500).send("Erreur interne");
    }

    // Log du résultat de la recherche d'utilisateur
    console.log('Résultat de la recherche utilisateur :', result);

    let userId = result.length > 0 ? result[0].id : null;
    console.log('ID utilisateur trouvé :', userId);

    // Si l'utilisateur n'existe pas, on l'ajoute
    if (!userId) {
      console.log('L\'utilisateur n\'existe pas, ajout de l\'utilisateur...');

      db.query('INSERT INTO users (email) VALUES (?)', [email.trim()], (err, result) => {
        if (err) {
          console.error("Erreur MySQL lors de l'ajout de l'utilisateur :", err);
          return res.status(500).send("Erreur interne");
        }

        userId = result.insertId; // On récupère l'id de l'utilisateur ajouté
        console.log('Nouvel utilisateur ajouté avec ID :', userId); // Log de l'ID utilisateur

        // Appel de la fonction pour enregistrer l'achat après l'ajout
        enregistrerAchat(userId, kwh, montant, date, res);
      });
    } else {
      console.log('Utilisateur existant, utilisation de l\'ID utilisateur :', userId);
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
  console.log('Tentative d\'enregistrement de l\'achat dans la base de données...');
  const query = 'INSERT INTO achats_kwh (user_id, kwh_achetes, montant, date_achat) VALUES (?, ?, ?, ?)';
  
  // Ajout de l'ID de l'utilisateur, kWh, montant et date pour être sûr que les bonnes données sont envoyées à la DB
  console.log('Données pour l\'achat :', { userId, kwh, montant, date });

  db.query(query, [userId, kwh, montant, date], (err, result) => {
    if (err) {
      console.error('Erreur lors de l\'insertion dans la base de données:', err);
      return res.status(500).send('Erreur lors de l\'enregistrement de l\'achat');
    }

    // Log du résultat de l'insertion dans la base de données
    console.log('Achat enregistré avec succès. Résultat:', result);
    return res.status(200).send('Achat enregistré avec succès');
  });
}

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: "Erreur lors de la déconnexion." });
        }
        res.json({ redirect: "/" });
    });
});

// Vérifier la session
app.get('/check-session', (req, res) => {
  if (req.session.idUtilisateur) {
    res.status(200).json({ sessionActive: true });
  } else {
    res.status(401).json({ sessionActive: false });
  }
});

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

app.get('/get-user-info', protectionRoute, (req, res) => {
  console.log(req.session); // Vérifie si la session contient bien l'idUtilisateur
  if (!req.session.idUtilisateur) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
  }

  db.query('SELECT u.id AS user_id, u.email, u.prenom, u.nom, u.mot_de_passe, u.status, u.old_email, a.id AS achat_id, a.kwh_achetes, a.montant AS achat_montant, a.date_achat, c.id AS credit_id, c.credit AS credit_montant FROM users u LEFT JOIN achats_kwh a ON u.id = a.user_id LEFT JOIN credits c ON u.id = c.user_id WHERE u.id = ?;', [req.session.idUtilisateur], (err, result) => {
      if (err) {
          return res.status(500).json({ message: "Erreur serveur" });
      }
      if (result.length === 0) {
          return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      res.status(200).json(result[0]);
  });
  
});


// Route pour récupérer le nom et prénom
app.get('/get-user-info-nom-prenom', protectionRoute, (req, res) => {
  if (!req.session.idUtilisateur) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
  }
  db.query('SELECT u.prenom, u.nom FROM users u WHERE u.id = ?;', [req.session.idUtilisateur], (err, result) => {
      if (err) {
          return res.status(500).json({ message: "Erreur serveur" });
      }
      if (result.length === 0) {
          return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      const user = result[0];
      const message = `Bonjour ${user.prenom} ${user.nom} !`;
      res.status(200).json({ message: message });
  });
});


app.get('/get-user-info-credits', protectionRoute, (req, res) => {
  if (!req.session.idUtilisateur) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
  }

  // Récupérer les crédits et le total payé de l'utilisateur
  db.query('SELECT c.credit, c.total_paid FROM users u LEFT JOIN credits c ON u.id = c.user_id WHERE u.id = ?;', [req.session.idUtilisateur], (err, result) => {
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
        credits: credits,         // Montant des crédits restants
        totalPaid: totalPaid     // Montant total payé
      });
  });
});

app.get('/get-user-id', (req, res) => {
  if (!req.session || !req.session.idUtilisateur) {
      return res.status(401).json({ message: "Utilisateur non connecté" });
  }
  
  res.status(200).json({ userId: req.session.idUtilisateur });
});

app.get('/get-current-kwh-price', async (req, res) => {
  db.query('SELECT prix_kwh FROM tarifs ORDER BY date_maj DESC LIMIT 1', (err, result) => {
      if (err) {
          console.error('Erreur lors de la récupération du prix du kWh:', err);
          return res.status(500).json({ error: 'Erreur serveur' });
      }
      res.json({ prix_kwh: result[0]?.prix_kwh || 0.20 }); // Valeur par défaut si pas trouvé
  });
});


///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

app.post('/update-credits', protectionRoute, (req, res) => {
  const { kwh } = req.body;

  if (!req.session.idUtilisateur) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
  }

  const kwhAchat = parseInt(kwh, 10);
  if (isNaN(kwhAchat) || kwhAchat <= 0) {
      return res.status(400).json({ message: "Valeur de kWh invalide" });
  }

  // Tarif par kWh (par exemple, 0.20 € par kWh, tu peux récupérer ça dans ta base de données si nécessaire)
  const tarifParKwh = 0.20;
  const montantPaye = kwhAchat * tarifParKwh;

  // Vérifier si l'utilisateur a déjà un crédit dans la table
  db.query('SELECT credit, total_paid FROM credits WHERE user_id = ?', [req.session.idUtilisateur], (err, result) => {
      if (err) {
          console.error(err);
          return res.status(500).json({ message: "Erreur serveur" });
      }

      if (result.length > 0) {
          // Mise à jour des crédits existants et du montant payé
          db.query('UPDATE credits SET credit = credit + ?, total_paid = total_paid + ? WHERE user_id = ?', 
              [kwhAchat, montantPaye, req.session.idUtilisateur], 
              (err, updateResult) => {
                  if (err) {
                      console.error(err);
                      return res.status(500).json({ message: "Erreur serveur" });
                  }
                  res.status(200).json({ message: "Crédits et paiement mis à jour avec succès" });
              }
          );
      } else {
          // Insérer un nouveau crédit et initialiser le paiement
          db.query('INSERT INTO credits (user_id, credit, total_paid) VALUES (?, ?, ?)', 
              [req.session.idUtilisateur, kwhAchat, montantPaye], 
              (err, insertResult) => {
                  if (err) {
                      console.error(err);
                      return res.status(500).json({ message: "Erreur serveur" });
                  }
                  res.status(200).json({ message: "Crédits et paiement ajoutés avec succès" });
              }
          );
      }
  });
});

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

app.post('/update-kwh-price', (req, res) => {
  const { prix_kwh } = req.body; // Le nouveau prix envoyé en POST

  if (!prix_kwh || isNaN(prix_kwh) || prix_kwh <= 0) {
      console.log("Prix invalide:", prix_kwh);
      return res.status(400).json({ error: 'Prix invalide' });
  }

  // Récupérer le prix actuel du kWh pour ajuster les crédits
  db.query('SELECT prix_kwh FROM tarifs ORDER BY date_maj DESC LIMIT 1', (err, result) => {
      if (err) {
          console.error('Erreur lors de la récupération du prix actuel du kWh:', err);
          return res.status(500).json({ error: 'Erreur serveur lors de la récupération du prix actuel du kWh' });
      }

      const ancienPrixKwh = result[0]?.prix_kwh; // Valeur par défaut si pas trouvé

      console.log("Ancien prix du kWh:", ancienPrixKwh);

      // Mise à jour du prix du kWh dans la table tarifs
      db.query('INSERT INTO tarifs (prix_kwh) VALUES (?)', [prix_kwh], (err, result) => {
          if (err) {
              console.error('Erreur lors de la mise à jour du prix du kWh:', err);
              return res.status(500).json({ error: 'Erreur serveur lors de la mise à jour du prix du kWh' });
          }

          console.log("Nouveau prix du kWh inséré:", prix_kwh);

          // Récupérer les crédits des utilisateurs et ajuster en fonction du changement de prix
          db.query('SELECT user_id, credit FROM credits', (err, utilisateurs) => {
              if (err) {
                  console.error('Erreur lors de la récupération des crédits des utilisateurs:', err);
                  return res.status(500).json({ error: 'Erreur serveur lors de la récupération des crédits' });
              }

              // Mise à jour des crédits pour chaque utilisateur
              utilisateurs.forEach(user => {
                  const creditsAjustes = (user.credit * ancienPrixKwh) / prix_kwh;

                  // Mise à jour des crédits pour chaque utilisateur
                  db.query('UPDATE credits SET credit = ? WHERE user_id = ?', [creditsAjustes, user.user_id], (err) => {
                      if (err) {
                          console.error('Erreur lors de la mise à jour des crédits pour l\'utilisateur', user.user_id, err);
                      } else {
                          console.log(`Crédits ajustés pour l'utilisateur ${user.user_id}: ${creditsAjustes}`);
                      }
                  });
              });

              res.json({ success: true, message: 'Prix du kWh mis à jour et crédits ajustés' });
          });
      });
  });
});


///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

const mqtt = require('mqtt');

app.post('/api/scan', (req, res) => {
  const { id_prise } = req.body;

  console.log("ID reçu :", id_prise);

  // ⚠️ À adapter avec une vraie requête DB si besoin
  res.status(200).json({
    nom: "Prise scannée",
    id: id_prise,
    localite: "Aucune localité",
    topic: `shellyplusplugs-${id_prise}/rpc`
  });
});

// Connexion MQTT
const mqttOptions = {
  host: 'xxx.s1.eu.hivemq.cloud',
  port: 8883,
  username: 'xxx',
  password: 'xxx',
  protocol: 'xxx'
};

const client = mqtt.connect(mqttOptions);

// États dynamiques par prise
const outletStates = {}; // { [id_prise]: { isPlugOn, powerReadings, onTimestamp } }

client.on('connect', () => {
  console.log('✅ Connecté au broker MQTT');
});

client.on('message', (topic, message) => {
  const idMatch = topic.match(/shellyplusplugs-(.*)\/(status|apower)/);
  if (!idMatch) return;
  const id_prise = idMatch[1];

  const state = outletStates[id_prise];
  if (!state) return;

  try {
    const data = JSON.parse(message.toString());

    if (topic.endsWith('/status') && data.switch) {
      state.isPlugOn = data.switch.output;
    }

    if (topic.endsWith('/apower') && state.isPlugOn && data.apower !== undefined) {
      state.powerReadings.push(data.apower);
      console.log(`📊 ${id_prise} - Relevé : ${data.apower} W`);
    }
  } catch (e) {
    console.error(`❌ Erreur de parsing MQTT :`, e);
  }
});


// Allumer la prise
app.post('/allumer-prise', protectionRoute, (req, res) => {
  const userId = req.session.idUtilisateur;
  const { id_prise } = req.body;

  if (!userId) return res.status(401).send("Utilisateur non authentifié.");
  if (!id_prise) return res.status(400).send("ID de prise manquant");

  const state = outletStates[id_prise] = outletStates[id_prise] || {
    isPlugOn: false,
    powerReadings: [],
    onTimestamp: null,
  };

  const topicCommande = `shellyplusplugs-${id_prise}/rpc`;
  const topicApower = `shellyplusplugs-${id_prise}/apower`;
  const topicStatus = `shellyplusplugs-${id_prise}/status`;

  db.query('SELECT c.credit FROM credits c JOIN users u ON u.id = c.user_id WHERE u.id = ?', [userId], (err, result) => {
    if (err || result.length === 0) return res.status(500).send("Erreur ou utilisateur introuvable");

    const credits = result[0].credit || 0;
    if (credits <= 0) return res.status(403).send("Crédits insuffisants");

    const message = JSON.stringify({
      id: 123,
      src: "user_1",
      method: "Switch.Set",
      params: { id: 0, on: true }
    });

    client.publish(topicCommande, message, (err) => {
      if (err) return res.status(500).send("Erreur d’envoi MQTT");

      client.subscribe([topicApower, topicStatus]);

      state.powerReadings = [];
      state.onTimestamp = Date.now();
      state.isPlugOn = true;

      db.query('UPDATE credits SET credit = credit - 0.01 WHERE user_id = ?', [userId]);
      res.status(200).send(`✅ Prise ${id_prise} allumée`);
    });
  });
});


// Éteindre la prise
app.post('/eteindre-prise', protectionRoute, (req, res) => {
  const userId = req.session.idUtilisateur;
  const { id_prise } = req.body;

  if (!userId) return res.status(401).send("Utilisateur non authentifié.");
  if (!id_prise || !outletStates[id_prise]) return res.status(400).send("Prise inconnue");

  const state = outletStates[id_prise];
  const topic = `shellyplusplugs-${id_prise}/rpc`;
  const message = JSON.stringify({
    id: 124,
    src: 'user_1',
    method: 'Switch.Set',
    params: { id: 0, on: false }
  });

  client.publish(topic, message, async (err) => {
    if (err) return res.status(500).send("Erreur d’envoi MQTT");

    const offTimestamp = Date.now();
    const durationSec = Math.floor((offTimestamp - state.onTimestamp) / 1000);
    const averagePower = state.powerReadings.length
      ? state.powerReadings.reduce((a, b) => a + b, 0) / state.powerReadings.length
      : 0;
    const energyWattSec = averagePower * durationSec;
    const energyKWh = energyWattSec / 3600000;

    const [tarifRows] = await db.promise().query('SELECT prix_kwh FROM tarifs ORDER BY date_maj DESC LIMIT 1');
    const prix_kwh = tarifRows[0]?.prix_kwh || 0.20;

    await db.promise().query(`
      INSERT INTO historique (id_prise, id_user, puissance_consomme, temps_utilise, energie_consomme, prix_de_reference)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [id_prise, userId, averagePower.toFixed(2), durationSec, energyKWh.toFixed(5), prix_kwh]);

    const [creditRows] = await db.promise().query('SELECT credit FROM credits WHERE user_id = ?', [userId]);
    let credits = creditRows[0].credit;
    credits = Math.max(0, credits - energyKWh);

    await db.promise().query('UPDATE credits SET credit = ? WHERE user_id = ?', [credits.toFixed(5), userId]);

    res.status(200).json({ message: `Prise ${id_prise} éteinte`, newCredits: credits.toFixed(5) });

    client.unsubscribe([`shellyplusplugs-${id_prise}/apower`, `shellyplusplugs-${id_prise}/status`]);
    delete outletStates[id_prise];
  });
});

client.on('error', (err) => {
  console.error("Erreur de connexion MQTT :", err);
});

module.exports = app;

// Fonction pour vérifier les crédits de l'utilisateur et éteindre la prise si nécessaire
function checkCreditsAndPower(userId) {
  // Calculer la consommation d'énergie pour la dernière minute (en kWh)
  const offTimestamp = Date.now();
  const durationSec = Math.floor((offTimestamp - onTimestamp) / 1000);
  let averagePower = 0;
  if (powerReadings.length > 0) {
    const sum = powerReadings.reduce((acc, value) => acc + value, 0);
    averagePower = sum / powerReadings.length;
  }

  // Calcul de l'énergie consommée (en kWh)
  const energyWattSec = averagePower * durationSec;
  const energyKWh = energyWattSec / 3600000;

  // Vérifier les crédits de l'utilisateur
  db.promise().execute('SELECT credit FROM credits WHERE user_id = ?', [userId])
    .then(([rows]) => {
      if (rows.length === 0) {
        throw new Error('Utilisateur introuvable');
      }

      const currentCredits = parseFloat(rows[0].credit);
      let newCredits = currentCredits - energyKWh;
      if (newCredits < 0) newCredits = 0;

      // Si l'utilisateur n'a plus de crédits, éteindre la prise
      if (newCredits <= 0) {
        // Éteindre la prise
        const topic = 'shellyplusplugs-64b7080cdc04/rpc';
        const message = JSON.stringify({
          id: 123,
          src: 'user_1',
          method: 'Switch.Set',
          params: { id: 0, on: false }
        });

        client.publish(topic, message, (err) => {
          if (err) {
            console.error('Erreur lors de l\'envoi du message MQTT (éteindre) :', err);
          } else {
            console.log('Prise éteinte automatiquement faute de crédits suffisants');
            isPlugOn = false;

            // Désabonner des topics
            client.unsubscribe([topicConsommation, topicStatut], (err) => {
              if (err) {
                console.error('Erreur lors du désabonnement des topics :', err);
              } else {
                console.log('Désabonné des topics de consommation.');
              }
            });
          }
        });
      } else {
        // Mettre à jour les crédits dans la base de données
        return db.promise().execute('UPDATE credits SET credit = ? WHERE user_id = ?', [newCredits.toFixed(5), userId])
          .then(() => {
            console.log(`Crédit mis à jour pour l'utilisateur ${userId}: ${newCredits.toFixed(5)} kWh`);
          });
      }
    })
    .catch((err) => {
      console.error('Erreur lors de la vérification ou de la mise à jour du crédit :', err);
    });
}



///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////


// Route pour afficher l'historique de consommation de l'utilisateur
app.get('/historique-consommation', protectionRoute, (req, res) => {
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

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

app.listen(port, () => {
  console.log(`Le serveur web écoute sur le port ${port}`);
});

