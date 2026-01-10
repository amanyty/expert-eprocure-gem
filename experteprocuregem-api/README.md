# Expert Eprocure GeM - Backend API

Backend API for Expert Eprocure GeM contact form and admin panel.

## Quick Start

### 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up (free)
2. Create a new project
3. Go to **SQL Editor** and run the contents of `supabase-schema.sql`
4. Copy your **Project URL** and **anon/service_role key** from Settings > API

### 2. Deploy to Vercel

Click the button below to deploy:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/experteprocuregem-api)

Or deploy manually:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd experteprocuregem-api
vercel --prod
```

### 3. Set Environment Variables

In Vercel dashboard, go to your project > Settings > Environment Variables:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `JWT_SECRET` | A random 32+ character string |

### 4. Create Admin User

Generate a bcrypt hash for your admin password:

```javascript
const bcrypt = require('bcryptjs');
bcrypt.hash('YourSecurePassword', 10).then(console.log);
```

Then run this SQL in Supabase:

```sql
UPDATE admin_users 
SET password_hash = 'YOUR_BCRYPT_HASH_HERE'
WHERE email = 'admin@experteprocure.com';
```

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/contacts/submit` | Submit contact form |

### Admin Endpoints (Requires JWT)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Admin login |
| GET | `/api/admin/contacts` | Get all contacts |
| GET | `/api/admin/contacts/:id` | Get single contact |
| PUT | `/api/admin/contacts/:id` | Update contact |
| DELETE | `/api/admin/contacts/:id` | Delete contact |
| GET | `/api/analytics/summary` | Get analytics summary |

## Local Development

```bash
# Install dependencies
npm install

# Create .env file (copy from .env.example)
cp .env.example .env

# Edit .env with your Supabase credentials

# Start server
npm start
```

## Folder Structure

```
experteprocuregem-api/
├── api/
│   └── index.js          # Main Express app (Vercel serverless)
├── config/
│   └── database.js       # Supabase client
├── middleware/
│   └── auth.js           # JWT authentication
├── package.json
├── vercel.json           # Vercel config
├── supabase-schema.sql   # Database schema
└── README.md
```
