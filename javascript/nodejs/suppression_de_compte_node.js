const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const cors = require('cors');
const mysql = require('mysql2'); // Assure-toi d'avoir cette ligne pour importer mysql

const app = express();  // Initialisation de l'application
const port = 3005;

// Middleware
app.use(cors());  // Ajoute les middlewares après avoir initialisé 'app'
app.use(bodyParser.json());

// Connexion à la base de données
const db = mysql.createConnection({
    host: 'localhost',
    user: 'ciel', // Remplace avec ton utilisateur
    password: 'ciel', // Remplace avec ton mot de passe
    database: 'Projet' // Remplace par ton nom de base de données
});

// Vérifier la connexion à la base de données
db.connect((err) => {
    if (err) {
        console.error('Erreur de connexion à la base de données:', err);
        return;
    }
    console.log('Connecté à la base de données MySQL');
});

const deletedPassword = bcrypt.hashSync('deIeted', 10);

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
  

// Démarrer le serveur
app.listen(port, () => {
    console.log(`Le serveur écoute sur le port ${port}`);
});
