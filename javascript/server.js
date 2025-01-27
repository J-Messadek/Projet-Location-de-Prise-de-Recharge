const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});


// Connexion à la base de données
const db = mysql.createConnection({
  host: 'localhost',
  user: 'ciel', // Remplace avec ton utilisateur
  password: 'ciel', // Remplace avec ton mot de passe
  database: 'Projet' // Remplace par ton nom de base de données
});

db.connect((err) => {
  if (err) throw err;
  console.log('Connected to the database');

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
});

app.get('/', (req, res) => {
  res.send('Bienvenue sur la page d\'accueil');
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


// Lancer le serveur
app.listen(3001, () => {
  console.log('Server running on port 3001');
});
