const fs = require('fs');
const path = require('path');

// Remplace le chemin par le tien si besoin
const logFilePath = path.resolve(__dirname, '../../logs/failed_logins.log');

// S'assurer que le dossier existe
const logDirectory = path.dirname(logFilePath);
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

// Test d’écriture
fs.appendFile(logFilePath, 'test\n', (err) => {
  if (err) console.error('❌ Échec de l’écriture :', err);
  else console.log('✅ Test réussi : écriture dans le fichier');
});
