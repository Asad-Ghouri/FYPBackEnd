const express = require('express');
const cors = require('cors'); // Import cors
const dotenv = require('dotenv');

const app = express();

dotenv.config({ path: './config.env' });
require('./DB/connection');

const port = process.env.PORT || 5000;

// Enable CORS for all routes
app.use(
  cors({
    origin: 'https://alpha-payment-frontend.vercel.app', // Correct origin without trailing slash
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
    credentials: true, // Allow cookies and other credentials
  })
);

// Parse JSON
app.use(express.json());

// Prefix all routes with '/api'
const authRoutes = require('./Router/auth.js');
app.use('/api', authRoutes); // All endpoints in auth.js will now have '/api' prefixed

// Start the server
app.listen(port, () => {
  console.log(`Server is running at localhost:${port}`);
});
