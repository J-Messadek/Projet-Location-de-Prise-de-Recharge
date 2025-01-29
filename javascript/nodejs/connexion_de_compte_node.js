const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
const port = 3004;

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

// Route de connexion
app.post('/login', (req, res) => {
    const { email, password } = req.body;
  
    // Vérification des données
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe sont requis' });
    }
  
    // Vérification si l'email existe dans la base de données
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur de vérification de l\'email' });
      }
  
      // Si l'utilisateur n'existe pas
      if (result.length === 0) {
        return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
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
  
  
// Démarrer le serveur
app.listen(port, () => {
  console.log(`Le serveur écoute sur le port ${port}`);
});
