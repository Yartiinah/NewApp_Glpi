# NewApp

Application Vue.js 3 connectée à GLPI via API REST.

## Structure

```
NewApp/
├── newapp-backend/     → Spring Boot + SQLite (port 8080)
└── newapp-frontend/    → Vue.js 3 + Vite (port 5173)
```

## Démarrage

### Backend
```bash
cd newapp-backend
mvn spring-boot:run
```

### Frontend
```bash
cd newapp-frontend
npm install
npm run dev
```

## Configuration GLPI
Dans `newapp-frontend/src/services/glpi.service.js` :
```js
const APP_TOKEN     = 'TON_APP_TOKEN_ICI'
const SESSION_TOKEN = 'TON_SESSION_TOKEN_ICI'
```

## Fonctionnalités
1. Réinitialisation des données → DELETE /api/reset
2. Import fichier CSV/JSON  → POST /api/import
3. Base SQLite locale        → GET /api/data
4. Échange JSON avec GLPI   → via Axios + App-Token
