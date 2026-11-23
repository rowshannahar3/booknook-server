# BookNook — Backend API

The backend service for BookNook, a full-stack online library application. It provides RESTful APIs for book management, borrowing operations, inventory management, and authenticated access.

## Core Features

- **RESTful API:** Provides endpoints for book and borrowing operations.
- **Book Management:** Create, retrieve, update, and delete book records.
- **JWT Authentication:** Verifies Better Auth-issued JWTs using public JWKS keys.
- **Authorization:** Protects restricted endpoints and enforces book ownership.
- **Borrowing Management:** Creates and retrieves user-specific borrowing records.
- **Inventory Management:** Uses MongoDB atomic updates and conditional operations to maintain book availability.
- **Return Workflow:** Processes book returns and restores available inventory.
- **Due Date Management:** Supports a seven-day borrowing period.

## API Endpoints

| Method | Endpoint | Access |
|---|---|---|
| GET | `/books` | Public |
| GET | `/books/:id` | Public |
| POST | `/books` | Protected |
| PATCH | `/books/:id` | Owner only |
| DELETE | `/books/:id` | Owner only |
| POST | `/borrows` | Protected |
| GET | `/borrows` | Protected |
| DELETE | `/borrows/:id` | Protected |

## Technology Stack

- Node.js
- Express.js
- MongoDB
- Better Auth JWT
- JWKS Public-Key Verification
- REST API

## Local Setup

```bash
git clone https://github.com/rowshannahar3/booknook-server.git
cd booknook-server
npm install
```

Configure the required environment variables in a `.env` file, including the MongoDB connection and JWT verification settings.

Start the development server:

```bash
npm run dev
```

## Related Repository

**Frontend:** https://github.com/rowshannahar3/booknook-client

## Author

**Rowshan Nahar**

[GitHub](https://github.com/rowshannahar3) · [LinkedIn](https://www.linkedin.com/in/rowshannahar/)
