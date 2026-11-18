# StockWise-AI

A full-stack inventory management application built with **React, Node.js, Express, and MongoDB**, featuring a custom rule-based inventory intelligence engine.

## Problem Statement

Small businesses often manage inventory using spreadsheets or manual records. This can make it difficult to monitor stock levels, identify stock-outs early, maintain movement history, and make informed restocking decisions.

StockWise-AI provides a centralized platform to manage products and stock movements, monitor inventory through dashboard analytics, receive low-stock alerts, and generate inventory-based insights and restocking recommendations.

## Key Technical Contributions

- Developed a full-stack inventory management application using React, Node.js, Express, and MongoDB.
- Implemented JWT authentication, protected routes, password hashing, and user-specific data access.
- Built product management, stock tracking, and movement history with stock validation.
- Developed dashboard analytics, stock alerts, and rule-based restocking recommendations.
- Implemented inventory-based chat and insights using predefined rules and calculations.
- Added automated backend tests for inventory statistics and restocking logic.

## Features

- **Authentication:** Registration, login, logout, bcrypt-hashed passwords, JWT authentication, protected routes, and per-user data isolation.
- **Product management:** Create, read, update, and delete products; search, filter, sort, and paginate; unique SKU per user; automatic stock status (In Stock, Low Stock, or Out of Stock).
- **Inventory management:** Stock In, Stock Out, and Adjustment operations; records previous and updated quantities, reason, and date; stock-out safeguards against negative quantities; movement history with filters.
- **Dashboard:** Total products and units, low-stock and out-of-stock counts, inventory value, category chart, six-month movement chart, recent activity, and attention list.
- **Rule-based AI insights and restocking:** Inventory analysis and restock recommendations calculated from the signed-in user's inventory, stock thresholds, prices, and recorded stock movements.
- **AI chat (rule-based):** Answers supported inventory-related questions using predefined logic and the user's inventory data.
- **Additional features:** Categories, reports, charts, CSV export for products and movements, notifications for low/out-of-stock items, profile and settings (currency, default threshold, password change), 404 page, and responsive layout.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, Vite, React Router DOM, Axios, Recharts, Lucide React, CSS |
| Backend | Node.js (ES modules), Express, JWT, bcryptjs, Helmet, CORS, express-rate-limit |
| Database | MongoDB, Mongoose |
| Inventory intelligence | Custom rule-based engine (`insightEngine.js`, `chatEngine.js`); no external AI API |

## Architecture

```text
React SPA --Axios (Bearer JWT)--> Express REST API --Mongoose--> MongoDB
                                      |
                                      +--> Rule-based inventory engine
                                           (uses authenticated user's data)
```

Backend request flow:

`routes -> auth middleware -> controller -> service/model -> error middleware`

Database queries are scoped to the authenticated user to help prevent users from accessing each other's data.

## Folder Structure

```text
StockWise-AI/
├── README.md
├── .gitignore
├── backend/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── server.js, app.js
│       ├── config/          env.js, db.js
│       ├── models/          User, Product, Category, StockMovement
│       ├── controllers/     auth, product, category, inventory,
│       │                   dashboard, report, ai
│       ├── routes/          resource routers and index.js
│       ├── middleware/       auth.js, error.js
│       ├── services/         inventoryService.js, aiService.js,
│       │                    insightEngine.js, chatEngine.js
│       └── utils/            ApiError, asyncHandler, csv, helpers
└── frontend/
    ├── .env.example
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── api/axios.js
        ├── context/AuthContext.jsx
        ├── components/
        ├── pages/
        └── utils/
```

## Database Models

- **User:** Name, email, hashed password, business name, currency, and default low-stock threshold.
- **Category:** User, name (unique per user, case-insensitive), description, and color.
- **Product:** User, name, SKU (unique per user), category reference, description, cost price, selling price, quantity, supplier, and low-stock threshold. Status is derived from quantity and threshold.
- **StockMovement:** User, product reference, product-name and SKU snapshots, movement type (`IN`, `OUT`, or `ADJUSTMENT`), quantity, previous quantity, new quantity, reason, and timestamp.

## API Endpoints

All routes are prefixed with `/api`. Except for registration, login, and health, routes require an `Authorization: Bearer <token>` header.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | Register or log in; returns JWT |
| GET | `/auth/me` | Get current user |
| PUT | `/auth/profile`, `/auth/password` | Update profile or password |
| GET, POST | `/products` | List or create products |
| GET, PUT, DELETE | `/products/:id` | Read, update, or delete product |
| GET, POST | `/categories` | List categories with product counts or create |
| PUT, DELETE | `/categories/:id` | Update or delete category (deletion blocked while products use it) |
| POST | `/inventory/stock-in`, `/inventory/stock-out`, `/inventory/adjust` | Perform stock operations |
| GET | `/inventory/movements` | Retrieve movement history |
| GET | `/dashboard`, `/dashboard/alerts` | Dashboard analytics and alert lists |
| GET | `/reports/summary` | Report data |
| GET | `/reports/export/products`, `/reports/export/movements` | CSV exports |
| GET | `/ai/status` | AI engine status |
| POST | `/ai/analysis`, `/ai/restock`, `/ai/chat` | Inventory analysis, restock plan, and chat |
| GET | `/health` | Health check |

## Installation (Windows CMD)

### Prerequisites

- Node.js 18 or newer (`node -v`)
- MongoDB Community Server running locally, or a MongoDB Atlas cluster

### 1. Extract and open the project

Extract `StockWise-AI.zip`, open Command Prompt in the project folder, and run:

```cmd
cd StockWise-AI
code .
```

### 2. Backend setup

In a Command Prompt terminal:

```cmd
cd backend
npm install
copy .env.example .env
notepad .env
```

Configure the environment variables in `.env`, save the file, and start the backend:

```cmd
npm run dev
```

You should see a MongoDB connection message and the API running on the configured port (default `5000`).

### 3. Frontend setup

Open a **new terminal** in VS Code:

```cmd
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), register an account, create a category, and add products.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Purpose |
|---|---|
| `PORT` | API port (default 5000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign JWTs |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `CLIENT_URL` | Allowed frontend origin(s) for CORS |

Frontend environment variable (`frontend/.env`):

```env
VITE_API_URL=http://localhost:5000/api
```

Restart the development server after changing environment variables.

## MongoDB Configuration

- **Local MongoDB:** Use the local connection string in the environment file. The database and collections are created automatically as data is inserted.
- **MongoDB Atlas:** Create a cluster and database user, allow your IP under Network Access, and use the Atlas connection string. URL-encode special characters in the password when needed.

## Inventory Intelligence (Rule-Based)

AI Insights, Smart Restocking, and AI Chat use a custom rule-based engine within the backend. No external AI API key, billing, or external AI service is required.

### How the engine works

- **Stock status:** Out of Stock at zero units; Low Stock at or below the product threshold; otherwise In Stock.
- **Overstock:** Uses predefined quantity and suggested-stock-level conditions.
- **Restock target:** Based on twice the low-stock threshold. If stock-out movements have been recorded in the last 30 days, the target can use the larger of that threshold-based target or estimated 30-day usage.
- **Restock quantity:** Target minus current quantity (minimum one where applicable); estimated cost is based on quantity multiplied by cost price.
- **Priority:** Determined using stock levels and estimated days of cover.
- **Slow-moving products:** Identified using predefined conditions involving stock availability and stock-out history.
- **Health score:** Calculated using the in-stock and low-stock product counts.
- **Chat:** Handles supported inventory-related question types and product, category, or supplier lookups. If it cannot match a supported question, it indicates that instead of guessing.
- **Usage estimates:** Based on recorded stock movements. Without stock-out history, recommendations rely on threshold-based logic.

This is rule-based inventory intelligence, not a generative AI or machine-learning forecasting model.

## Automated Testing

The backend includes five automated tests using Node.js's built-in test runner. They cover inventory statistics, restock-target calculations, and restock recommendations.

Run tests from the backend directory:

```cmd
npm test
```

**Latest local test run: 5 tests passed, 0 failed.**

These are function-level tests of core calculations and recommendations; they are not a full API or database integration test suite.

## Production Build

Run the frontend production build from the frontend directory:

```cmd
npm run build
```

**Latest local build:** Completed successfully. Vite reported a large JavaScript bundle warning; the build itself completed successfully.

## Design Decisions and Scalability Considerations

- **Stock safeguards:** Stock operations use validation and atomic stock updates to help prevent invalid stock quantities. Stock quantity and movement-record creation are separate writes; multi-document transactions could improve consistency when deployed on a MongoDB replica set.
- **Derived stock status:** Status is calculated from quantity and threshold to avoid storing stale status values.
- **Indexes:** Database indexes support per-user product and movement queries.
- **Server-side processing:** Dashboard and report data use backend/database aggregation.
- **User data isolation:** Inventory intelligence uses data associated with the authenticated user.
- **Security middleware:** JWT authentication, rate limiting, Helmet, and CORS configuration are included.
- **Stateless API:** JWT-based authentication can support multiple backend instances, subject to deployment configuration.

## Known Limitations

- Product pickers on the Inventory page load up to 100 products.
- Overstock, restock targets, and priorities are rule-based heuristics, not machine-learning forecasts.
- Chat uses keyword/rule matching, does not retain conversational memory, and does not support unrestricted questions.
- Stock quantity updates and movement-history creation are separate database operations. If movement-record creation fails after a stock update, the history could become incomplete.
- Automated tests cover core calculation functions; they do not cover all API routes or database integration.
- The frontend build reports a large JavaScript bundle warning, although it completes successfully.

## Future Enhancements

Sales-order tracking, improved statistical forecasting, an optional LLM layer for natural-language explanations, supplier purchase orders, barcode scanning, multi-warehouse support, team roles, email alerts, refresh tokens, expanded API and integration tests, and CI automation.
