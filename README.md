# കേരളദേശം (Kerala Desam) - Node.js + Express + MongoDB Backend

കേരളദേശം ന്യൂസ് പോർട്ടലിനായുള്ള പ്രത്യേക ബാക്കെൻഡ് സർവീസ് (Standalone REST API Backend).

---

## ഘടന (Folder Structure)

```
backend/
├── config/
│   └── db.js                 # MongoDB Mongoose കണക്ഷൻ കോൺഫിഗറേഷൻ
├── controllers/
│   ├── articleController.js  # വാർത്തകൾ (CRUD) നിയന്ത്രിക്കുന്ന ലോജിക്
│   └── breakingController.js # ബ്രേക്കിംഗ് ന്യൂസ് കൺട്രോളർ
├── data/
│   └── seedData.js           # ആദ്യഘട്ട മലയാളം വാർത്തകളുടെ ഡാറ്റ
├── models/
│   ├── Article.js            # വാർത്തകളുടെ Mongoose Schema
│   └── BreakingNews.js       # ബ്രേക്കിംഗ് ന്യൂസ് Schema
├── routes/
│   ├── articleRoutes.js      # /api/articles എൻഡ്‌പോയിന്റുകൾ
│   ├── breakingRoutes.js     # /api/breaking എൻഡ്‌പോയിന്റുകൾ
│   └── seedRoutes.js         # /api/seed ഡാറ്റാബേസ് പോപ്പുലേഷൻ
├── .env                      # പോർട്ട്, ഡാറ്റാബേസ് URI വിവരങ്ങൾ
├── .env.example              # കോൺഫിഗറേഷൻ മാതൃക
├── package.json              # Express, Mongoose, Cors ഡിപൻഡൻസികൾ
└── server.js                 # പ്രധാന എക്സ്പ്രസ് സെർവർ ഫയൽ
```

---

## എങ്ങനെ പ്രവർത്തിപ്പിക്കാം (How to Run)

### 1. ഡിപൻഡൻസികൾ ഇൻസ്റ്റാൾ ചെയ്യുക:
```bash
cd backend
npm install
```

### 2. സെർവർ റൺ ചെയ്യുക:
```bash
# ഡെവലപ്‌മെന്റ് മോഡ് (Auto-reload on file change)
npm run dev

# അല്ലെങ്കിൽ പ്രൊഡക്ഷൻ മോഡ്:
npm start
```

സെർവർ വിജയകരമായി **`http://localhost:5000`**-ൽ പ്രവർത്തിക്കും.

---

## API എൻഡ്‌പോയിന്റുകൾ (REST API Endpoints)

| Method | Endpoint | വിവരണം |
| :--- | :--- | :--- |
| **GET** | `/api/health` | സെർവറും MongoDB-യും ലൈവ് ആണോ എന്ന് പരിശോധിക്കാൻ |
| **GET** | `/api/articles` | മുഴുവൻ വാർത്തകളും ലഭിക്കാൻ (`?category=രാഷ്ട്രീയം&search=വയനാട്`) |
| **GET** | `/api/articles/:id` | ഒരു പ്രത്യേക വാർത്തയുടെ വിവരങ്ങൾ ലഭിക്കാൻ |
| **POST** | `/api/articles` | പുതിയ വാർത്ത പ്രസിദ്ധീകരിക്കാൻ |
| **PUT** | `/api/articles/:id` | വാർത്ത എഡിറ്റ് ചെയ്യാൻ |
| **DELETE** | `/api/articles/:id` | വാർത്ത നീക്കം ചെയ്യാൻ |
| **GET** | `/api/breaking` | തത്സമയ ബ്രേക്കിംഗ് ന്യൂസുകൾ ലഭിക്കാൻ |
| **POST** | `/api/breaking` | പുതിയ ബ്രേക്കിംഗ് ന്യൂസ് ചേർക്കാൻ |
| **POST** | `/api/seed` | ആദ്യഘട്ട വാർത്തകൾ ഒരൊറ്റ ക്ലിക്കിൽ MongoDB-ലേക്ക് അപ്‌ലോഡ് ചെയ്യാൻ |
