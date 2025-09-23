# Romona Server (Express API)

This is the backend API for the Ramona Jewels e‑commerce platform.

## Getting Started

1) Install dependencies
```bash
npm install
# or
yarn
```

2) Create .env (see sample keys below)

3) Run development server
```bash
npm run dev
```
The API runs on http://localhost:5000 by default.

## Environment Variables (.env)
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/ramona
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30

SMTP_HOST=...
SMTP_PORT=...
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM="Ramona Jewels <no-reply@ramonajewels.com>"

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...

STRIPE_SECRET=sk_test_...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...

CLIENT_URL=http://localhost:3000
```

## Key Features
- Products, Categories, Product Types
- Orders, Cart, Returns
- Auth (email/password, Google, Facebook)
- Reviews with aggregation and real‑time events
- Admin analytics endpoints
- Swagger API docs at /api-docs
- Welcome email on successful registration

## Routes Summary
- /api/v1/auth
- /api/v1/users
- /api/v1/perfumes
- /api/v1/categories
- /api/v1/product-types
- /api/v1/cart
- /api/v1/orders
- /api/v1/admin and /api/v1/admin/analytics
- /api/v1/returns
- /api/v1/perfumes/:id/reviews and /api/v1/perfumes/reviews/random

## Production
Use `npm start` (node server.js) with a process manager like PM2. Ensure environment variables are set and MongoDB is reachable.