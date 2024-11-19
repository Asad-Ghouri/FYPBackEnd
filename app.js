// const express = require('express');
// const cors = require('cors');
// const dotenv = require('dotenv');

// dotenv.config({ path: './config.env' });
// require('./DB/connection');

// const app = express();
// const port = process.env.PORT || 5000;

// // Enable CORS
// app.use(
//   cors({
//     origin: 'https://alpha-payment-frontend.vercel.app',
//     methods: ['GET', 'POST', 'PUT', 'DELETE'],
//     credentials: true,
//   })
// );

// // Middleware to parse JSON
// app.use(express.json());

// // Use the auth routes under the `/api` prefix
// const authRoutes = require('./Router/auth');
// app.use('/api', authRoutes);

// // Handle 404 errors for unknown routes
// app.use((req, res) => {
//   res.status(404).json({
//     error: 'NOT_FOUND',
//     message: `The requested URL ${req.originalUrl} was not found.`,
//   });
// });

// // Start the server
// app.listen(port, () => {
//   console.log(`Server is running at http://localhost:${port}`);
// });

require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
require('./DB/connection');
app.use(express.json());
const port =  5000;

app.use(cors());
app.use('/api', require('./api/auth.js'));
app.listen(port, () => {
  console.log(`Server is running at localhost:${port}`);
});
