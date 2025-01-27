const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Connexion à la base de données
const db = mysql.createConnection({
  host: 'localhost',
  user: 'ciel', // remplace avec ton utilisateur
  password: '', // remplace avec ton mot de passe
  database: 'Projet' // remplace par ton nom de base de données
});

db.connect((err) => {
  if (err) throw err;
  console.log('Connected to the database');
});

// Route pour enregistrer l'achat
app.post('/enregistrer-achat', (req, res) => {
  const { email, kwh, montant } = req.body;
  const date = new Date().toISOString().slice(0, 19).replace('T', ' '); // format de date MySQL

  const query = 'INSERT INTO achats_kwh (user_email, kwh_achetes, montant, date_achat) VALUES (?, ?, ?, ?)';
  db.query(query, [email, kwh, montant, date], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erreur lors de l\'enregistrement');
    }
    res.status(200).send('Achat enregistré avec succès');
  });
});

// Lancer le serveur
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
