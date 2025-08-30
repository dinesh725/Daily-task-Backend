# Task Manager Backend

This is the backend service for the Daily Task Manager application, built with Node.js, Express, and MongoDB.

## Features

- **RESTful API** for task management
- **User Authentication** using JWT
- **Rate Limiting** to prevent abuse
- **Request Validation** with express-validator
- **Security Middlewares** (helmet, xss-clean, hpp, mongo-sanitize)
- **Logging** with Winston
- **Error Handling** centralized error handling middleware
- **Testing** with Jest and Supertest

## API Documentation

### Authentication

- `POST /api/register` - Register a new user
- `POST /api/login` - Login user
- `GET /api/me` - Get current user profile

### Tasks

- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create a new task
- `GET /api/tasks/:id` - Get task by ID
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

## Environment Variables

Create a `.env` file in the root directory and add the following:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=90d
NODE_ENV=development
```

## Installation

```bash
npm install
```

## Running the Server

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## Testing

Run tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm test -- --coverage
```

## Linting

```bash
npm run lint
```

## Deployment

### PM2 (Production)

1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```

2. Start the application:
   ```bash
   npm run prod
   ```

3. Other PM2 commands:
   ```bash
   npm run stop     # Stop the application
   npm run restart  # Restart the application
   npm run logs     # View logs
   ```

## Project Structure

```
backend/
├── config/           # Configuration files
├── controllers/      # Route controllers
├── middleware/       # Custom express middlewares
├── models/           # Mongoose models
├── routes/           # Route definitions
├── utils/            # Utility classes and functions
├── validators/       # Request validation schemas
├── tests/            # Test files
├── server.js         # Application entry point
└── ecosystem.config.js # PM2 configuration
```

## Dependencies

- express: Web framework
- mongoose: MongoDB ODM
- jsonwebtoken: For authentication
- bcryptjs: Password hashing
- winston: Logging
- helmet: Security headers
- express-rate-limit: Rate limiting
- express-mongo-sanitize: Data sanitization
- xss-clean: XSS protection
- hpp: HTTP Parameter Pollution protection
- dotenv: Environment variables
- nodemailer: For email functionality

## Dev Dependencies

- nodemon: For development
- jest: Testing framework
- supertest: HTTP assertions
- eslint: Code linting
- pm2: Process manager for production

## License

MIT
