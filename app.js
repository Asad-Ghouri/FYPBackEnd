const express = require('express');
const cors = require('cors'); // Import cors
const dotenv = require('dotenv');

const app = express();

dotenv.config({ path: './config.env' });
require('./DB/connection');

const port = 5000;

// Enable CORS for all routes
app.use(cors({
    origin: '*', // Allow this specific origin
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
    credentials: true, // Allow cookies and other credentials
}));

// Parse JSON
app.use(express.json());

// Use routes
app.use(require('./Router/auth.js'));

// Start the server
app.listen(port, () => {
    console.log(`Server is running at localhost:${port}`);
});
