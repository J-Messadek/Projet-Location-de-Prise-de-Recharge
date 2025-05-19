require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const port = 3046;

app.use(cors());
app.use(bodyParser.json());

// Servir les fichiers statiques
app.use("/css", express.static(path.join(__dirname, "../../css")));
app.use(
  "/javascript",
  express.static(path.join(__dirname, "../../javascript"))
);
app.use("/images", express.static(path.join(__dirname, "../../images")));

// Page d'accueil
app.get("/", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../../admin/connexion.html"));
});

// Dashboard (le front-end) qui va ensuite appeler l'API pour vérifier la session et récupérer les infos
app.get("/access-control-dashboard", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../../admin/dashboard_admin.html"));
});

app.listen(port, () => {
  console.log(`Le serveur web écoute sur le port ${port}`);
});
