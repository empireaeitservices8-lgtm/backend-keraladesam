# കേരളദേശം (Kerala Desam) - REST API Backend

Node.js, Express, and MySQL REST API backend service for Kerala Desam Malayalam digital news portal.

---

## ഘടന (Folder Structure)

```
backend/
├── config/
│   └── mysql.js              # MySQL connection pool & automatic table schema initialization
├── controllers/
│   ├── articleController.js  # Article CRUD, headline pinning, image upload logic
│   ├── authController.js     # User authentication, JWT issuance, admin self-registration
│   ├── breakingController.js # Real-time breaking news updates
│   ├── videoController.js    # Video items CRUD, YouTube ID parsing, thumbnail handling
│   ├── subscriberController.js # Newsletter email subscriber management
│   ├── adController.js       # Advertising inquiries management
│   └── photoStoryController.js # Photo story section management
├── data/
│   └── seedData.js           # Malayalam initial seed articles, breaking items, and videos
├── middleware/
│   └── auth.js               # JWT bearer token verification & role authorization
├── routes/
│   ├── articleRoutes.js      # /api/articles routes (supports JSON & Multipart form-data)
│   ├── authRoutes.js         # /api/auth routes (login, register, me)
│   ├── breakingRoutes.js     # /api/breaking routes
│   ├── forexRoutes.js        # /api/forex live gold and currency exchange rates
│   ├── seedRoutes.js         # /api/seed database auto-population
│   ├── ttsRoutes.js          # /api/tts Malayalam text-to-speech companion
│   ├── videoRoutes.js        # /api/videos routes
│   ├── subscriberRoutes.js   # /api/subscribers routes
│   ├── adRoutes.js           # /api/ads routes
│   └── photoStoryRoutes.js   # /api/photo-story routes
├── services/
│   └── mysqlService.js       # Unified MySQL queries and data mappings
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
├── package.json              # Express, MySQL2, JWT, Multer dependencies
├── vercel.json               # Vercel deployment & rewrite configuration
└── server.js                 # Express application & server listener
```

---

## പരിസ്ഥിതി വേരിയബിളുകൾ (Environment Variables)

Create a `.env` file inside the `backend/` directory:

```env
PORT=5000
DB_TYPE=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=keraladesam_db
JWTSecretKey=your_strong_jwt_secret_key_here
```

---

## ഡാറ്റാബേസ് ആരംഭിക്കൽ (Database Initialization)

MySQL സെർവറിൽ `keraladesam_db` എന്ന ഡാറ്റാബേസ് ഉണ്ടാക്കുകയോ, സെർവർ റൺ ചെയ്യുമ്പോൾ അത് സ്വയമേവ സൃഷ്ടിക്കപ്പെടുകയോ ചെയ്യും:

```bash
npm install
npm start
```
