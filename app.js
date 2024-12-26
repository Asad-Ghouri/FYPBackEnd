require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./DB/connection'); // Import the connection function

const app = express();
const port = 5000;

// Connect to the database before starting the server
(async () => {
  await connectDB(); // Await the database connection
  app.use(express.json());
  app.use(cors());
  app.use('/api', require('./api/auth.js'));

  // Start the server only after DB connection is successful
  app.listen(port, () => {
    console.log(`Server is running at localhost:${port}`);
  });
})();
