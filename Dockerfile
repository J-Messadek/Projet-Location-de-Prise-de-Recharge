FROM node:18

# Installation des dépendances système
RUN apt-get update && apt-get install -y \
  default-mysql-client \
  && rm -rf /var/lib/apt/lists/*
  
# Répertoire de travail dans le conteneur
WORKDIR /app

# Copier tout le projet dans le conteneur
COPY . .

# Vérifier que le répertoire et les fichiers nécessaires existent
RUN ls -la /app/javascript/nodejs

# Installer les dépendances dans le dossier de l'API
RUN cd /app/javascript/nodejs && npm install --production --omit=dev

# Exposer le port de l'API
EXPOSE 3047

# Lancer l'API
CMD ["node", "/app/javascript/nodejs/api.js"]
