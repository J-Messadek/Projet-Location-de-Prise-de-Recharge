const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
const port = 3046;

// Connexion à la base de données
const db = mysql.createConnection({
  host: 'localhost',
  user: 'ciel',
  password: 'ciel', // Change avec ton mot de passe
  database: 'Projet', // Change avec ton nom de base de données
});

db.connect((err) => {
  if (err) {
    console.error('Erreur de connexion à la base de données: ', err);
    return;
  }
  console.log('Connecté à la base de données MySQL');
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Bienvenue sur la page d\'accueil');
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
          return res.status(500).json({ message: 'Erreur lors de la création du compte' });
        }

        // Récupérer l'ID de l'utilisateur nouvellement créé
        const userId = result.insertId;

        // Ajouter 10 crédits dans la table "credits"
        const creditsQuery = 'INSERT INTO credits (user_id, credit) VALUES (?, ?)';
        db.query(creditsQuery, [userId, 10.00], (err, result) => {
          if (err) {
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

// Route de connexion
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Vérification des données
  if (!email || !password) {
    console.log("refuser")//remettre celui d'avant
  }

  // Vérification si l'email existe dans la base de données
  db.query('SELECT * FROM users WHERE email = ?', [email], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Erreur de vérification de l\'email' });
    }

    // Si l'utilisateur n'existe pas
    if (result.length === 0) {
      console.log("refuser")//remettre celui d'avant
    }

    // Si l'utilisateur existe, on récupère l'utilisateur trouvé
    const user = result[0];

    // Comparaison du mot de passe
    bcrypt.compare(password, user.mot_de_passe, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la comparaison du mot de passe' });
      }

      if (!isMatch) {
        return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
      }

      // Connexion réussie
      res.status(200).json({ message: 'Connexion réussie' });
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
        
            return res.status(200).json({ message: 'Compte désactivé avec succès' });
          }
        );          
    });
  });
});
  

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

  // Créer la base de données si elle n'existe pas
  db.query('CREATE DATABASE IF NOT EXISTS Projet', (err, result) => {
    if (err) throw err;
    console.log('Database created or already exists');
  });

  // Créer la table users si elle n'existe pas
  const createUsersTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL
    )
  `;
  db.query(createUsersTableQuery, (err, result) => {
    if (err) throw err;
    console.log('Table users created or already exists');
  });

  // Créer la table achats_kwh si elle n'existe pas
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS achats_kwh (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      kwh_achetes DECIMAL(10, 2) NOT NULL,
      montant DECIMAL(10, 2) NOT NULL,
      date_achat DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `;
  db.query(createTableQuery, (err, result) => {
    if (err) throw err;
    console.log('Table achats_kwh created or already exists');
  });

// Route pour enregistrer l'achat
app.post('/enregistrer-achat', (req, res) => {
  const { email, kwh, montant } = req.body;
  const date = new Date().toISOString().slice(0, 19).replace('T', ' '); // format de date MySQL

  console.log(`Requête reçue: email=${email}, kwh=${kwh}, montant=${montant}`);  // Pour déboguer

  // Vérifier si l'utilisateur existe déjà
  db.query('SELECT id FROM users WHERE email = ?', [email], (err, result) => {
    if (err) {
      console.error('Erreur lors de la vérification de l\'utilisateur:', err); // Afficher l'erreur
      return res.status(500).send('Erreur lors de la vérification de l\'utilisateur');
    }

    let userId = result.length > 0 ? result[0].id : null;
    console.log(`User ID trouvé : ${userId}`);

    // Si l'utilisateur n'existe pas, on l'ajoute à la table users
    if (!userId) {
      db.query('INSERT INTO users (email) VALUES (?)', [email], (err, result) => {
        if (err) {
          console.error('Erreur lors de l\'ajout de l\'utilisateur:', err);  // Afficher l'erreur
          return res.status(500).send('Erreur lors de l\'ajout de l\'utilisateur');
        }
        userId = result.insertId; // On récupère l'ID de l'utilisateur créé
        console.log(`Utilisateur ajouté avec ID : ${userId}`);

        // Après avoir ajouté l'utilisateur, on enregistre l'achat
        enregistrerAchat(userId, kwh, montant, date, res);
      });
    } else {
      // L'utilisateur existe déjà, on enregistre l'achat directement
      console.log('Utilisateur déjà existant');
      enregistrerAchat(userId, kwh, montant, date, res);
    }
  });
});


// Fonction pour enregistrer un achat
function enregistrerAchat(userId, kwh, montant, date, res) {
  const query = 'INSERT INTO achats_kwh (user_id, kwh_achetes, montant, date_achat) VALUES (?, ?, ?, ?)';
  db.query(query, [userId, kwh, montant, date], (err, result) => {
    if (err) {
      console.error('Erreur lors de l\'insertion dans la base de données:', err);  // Log d'erreur
      return res.status(500).send('Erreur lors de l\'enregistrement de l\'achat');
    }

    // Afficher le résultat de la requête d'insertion
    console.log('Achat enregistré:', result);  // Cela permet de voir le résultat

    res.status(200).send('Achat enregistré avec succès');
  });
}

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////


///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////


///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Le serveur écoute sur le port ${port}`);
});
