# കേരളദേശം (Kerala Desam) - REST API Backend

Node.js, Express, and MongoDB REST API backend service for Kerala Desam Malayalam digital news portal.

---

## ഘടന (Folder Structure)

```
backend/
├── config/
│   └── db.js                 # MongoDB Mongoose connection with serverless connection pooling
├── controllers/
│   ├── articleController.js  # Article CRUD, headline pinning, image upload logic
│   ├── authController.js     # User authentication, JWT issuance, admin self-registration
│   ├── breakingController.js # Real-time breaking news updates
│   └── videoController.js    # Video items CRUD, YouTube ID parsing, thumbnail handling
├── data/
│   └── seedData.js           # Malayalam initial seed articles, breaking items, and videos
├── middleware/
│   └── auth.js               # JWT bearer token verification & role authorization
├── models/
│   ├── Article.js            # Article Mongoose Schema
│   ├── BreakingNews.js       # Breaking News Mongoose Schema
│   ├── User.js               # Admin / Editor User Schema with bcrypt password hashing
│   └── Video.js              # Video item Schema
├── routes/
│   ├── articleRoutes.js      # /api/articles routes (supports JSON & Multipart form-data)
│   ├── authRoutes.js         # /api/auth routes (login, register, me)
│   ├── breakingRoutes.js     # /api/breaking routes
│   ├── forexRoutes.js        # /api/forex live gold and currency exchange rates
│   ├── seedRoutes.js         # /api/seed database auto-population
│   ├── ttsRoutes.js          # /api/tts Malayalam text-to-speech companion
│   └── videoRoutes.js        # /api/videos routes
├── api/
│   └── index.js              # Vercel serverless entry point
├── public/
│   ├── favicon.ico
│   ├── favicon.png
│   ├── index.html            # Admin redirect page
│   └── images/
│       └── logo.png
├── .env                      # Environment variables (ignored by git)
├── .env.example              # Sample environment template
├── package.json              # Express, Mongoose, JWT, Multer dependencies
├── vercel.json               # Vercel deployment & rewrite configuration
└── server.js                 # Express application & server listener
```

---

## പരിസ്ഥിതി വേരിയബിളുകൾ (Environment Variables)

Create a `.env` file inside the `backend/` directory:

```env
PORT=5000
MONGODB_URL=mongodb+srv://<username>:<password>@cluster0.mongodb.net/KeralaDesham?retryWrites=true&w=majority
JWTSecretKey=your_strong_jwt_secret_key_here
NODE_ENV=development
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
# ഡെവലപ്‌മെന്റ് മോഡ് (Node watch / Auto-reload)
npm run dev

# പ്രൊഡക്ഷൻ മോഡ്:
npm start
```

സെർവർ വിജയകരമായി **`http://localhost:5000`**-ൽ പ്രവർത്തിക്കും.

---

## REST API എൻഡ്‌പോയിന്റുകൾ (API Endpoints)

### 1. ഹെൽത്ത് & സിസ്റ്റം (Health)
| Method | Endpoint | വിവരണം |
| :--- | :--- | :--- |
| **GET** | `/api/health` | സെർവറും MongoDB-യും ലൈവ് ആണോ എന്ന് പരിശോധിക്കാൻ |

### 2. വാർത്തകൾ (Articles)
| Method | Endpoint | വിവരണം |
| :--- | :--- | :--- |
| **GET** | `/api/articles` | മുഴുവൻ വാർത്തകളും ലഭിക്കാൻ (`?category=രാഷ്ട്രീയം&search=വയനാട്&limit=20`) |
| **GET** | `/api/articles/:id` | ഒരു പ്രത്യേക വാർത്തയുടെ വിവരങ്ങൾ ലഭിക്കാൻ |
| **POST** | `/api/articles` | പുതിയ വാർത്ത പ്രസിദ്ധീകരിക്കാൻ (Protected, supports image upload) |
| **PUT** | `/api/articles/:id` | വാർത്ത എഡിറ്റ് ചെയ്യാൻ (Protected) |
| **PATCH** | `/api/articles/:id/headline` | പ്രധാന വാർത്തയായി പിൻ ചെയ്യുക / പിൻ മാറ്റുക (Protected) |
| **DELETE** | `/api/articles/:id` | വാർത്ത നീക്കം ചെയ്യാൻ (Protected) |

### 3. ബ്രേക്കിംഗ് ന്യൂസ് (Breaking News)
| Method | Endpoint | വിവരണം |
| :--- | :--- | :--- |
| **GET** | `/api/breaking` | തത്സമയ ബ്രേക്കിംഗ് ന്യൂസുകൾ ലഭിക്കാൻ |
| **POST** | `/api/breaking` | പുതിയ ബ്രേക്കിംഗ് ന്യൂസ് ചേർക്കാൻ (Protected) |
| **PUT** | `/api/breaking/:id` | ബ്രേക്കിംഗ് ന്യൂസ് തിരുത്താൻ (Protected) |
| **DELETE** | `/api/breaking/:id` | ബ്രേക്കിംഗ് ന്യൂസ് നീക്കം ചെയ്യാൻ (Protected) |

### 4. വീഡിയോകൾ (Videos)
| Method | Endpoint | വിവരണം |
| :--- | :--- | :--- |
| **GET** | `/api/videos` | മുഴുവൻ വീഡിയോകളും ലഭിക്കാൻ (`?category=KERALA&limit=10`) |
| **GET** | `/api/videos/:id` | ഒരു പ്രത്യേക വീഡിയോ വിവരങ്ങൾ ലഭിക്കാൻ |
| **POST** | `/api/videos` | പുതിയ വീഡിയോ അപ്‌ലോഡ് ചെയ്യാൻ (Protected) |
| **PUT** | `/api/videos/:id` | വീഡിയോ വിവരങ്ങൾ എഡിറ്റ് ചെയ്യാൻ (Protected) |
| **DELETE** | `/api/videos/:id` | വീഡിയോ നീക്കം ചെയ്യാൻ (Protected) |

### 5. ഓഥന്റിക്കേഷൻ (Authentication)
| Method | Endpoint | വിവരണം |
| :--- | :--- | :--- |
| **POST** | `/api/auth/login` | അഡ്മിൻ / എഡിറ്റർ ലോഗിൻ & JWT ടോക്കൺ ലഭിക്കാൻ |
| **POST** | `/api/auth/register` | പുതിയ എഡിറ്റർ അക്കൗണ്ട് രജിസ്റ്റർ ചെയ്യാൻ |
| **GET** | `/api/auth/me` | ലോഗിൻ ചെയ്ത യൂസറുടെ പ്രൊഫൈൽ വിവരങ്ങൾ ലഭിക്കാൻ (Protected) |

### 6. മറ്റ് യൂട്ടിലിറ്റികൾ (Utilities)
| Method | Endpoint | വിവരണം |
| :--- | :--- | :--- |
| **GET** | `/api/forex` | തത്സമയ 22K സ്വർണ്ണവിലയും വിദേശ കറൻസി നിരക്കുകളും |
| **GET** | `/api/tts?text=...` | മലയാളം ഓഡിയോ ന്യൂസ് വായന (Text-to-speech) |
| **POST** | `/api/seed` | ഡിഫോൾട്ട് വാർത്തകളും വീഡിയോകളും MongoDB-യിലേക്ക് അപ്‌ലോഡ് ചെയ്യാൻ |
