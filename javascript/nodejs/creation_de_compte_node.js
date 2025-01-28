const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
const port = 3002;

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

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Le serveur écoute sur le port ${port}`);
});
