const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Initialize app
const app = express();

// Load environment variables
dotenv.config({ path: './config.env' });
require('./DB/connection'); // Ensure the database connection is established

const port = process.env.PORT || 5000;

// Enable CORS for all routes
app.use(
  cors({
    origin: 'https://alpha-payment-frontend.vercel.app', // Correct origin without trailing slash
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
    credentials: true, // Allow cookies and other credentials
  })
);

// Parse JSON payloads
app.use(express.json());

// Load and prefix routes with '/api'
const authRoutes = require('./Router/auth.js');
app.use('/api', authRoutes); // Add '/api' prefix to all routes in auth.js

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `The requested URL ${req.originalUrl} was not found on this server.`,
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
