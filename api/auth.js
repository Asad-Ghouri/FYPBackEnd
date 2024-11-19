const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const Wallet = require("ethereumjs-wallet");
const Web3 = require("web3");
const qrcode = require("qrcode");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const stripe = require("stripe")("sk_test_51ODucNSBUBnZdF2vZ4rTegts3FCMI9IczAYi4IU9kNOhtFrO7PN2wWAsvUTVUpfis2xmwBZTdSXzOWU69idYfoEi00eTy3Le68");

// MongoDB connection
const db = "mongodb+srv://asadghouri546:asadghouri546@cluster0.wirmp0f.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(db, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// Load models
const User = require("../Modles/User");
const Admin = require("../Modles/Admin");

// Create a new Express application
const app = express();
app.use(bodyParser.json());

// Add your routes
app.post("/stripe", async (req, res) => {
  try {
    const { priceId } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: "Price ID is required" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: "http://localhost:3000/dashboard?message=authenticate",
      cancel_url: "http://localhost:3000/sign-in",
    });

    res.json({ id: session.id });
  } catch (error) {
    res.status(500).json({ error: "Failed to create Stripe session" });
  }
});

app.get("/test", (req, res) => {
  res.json({ message: "API is working!" });
});

// Add more routes here...

// Export the Express app as the default export
module.exports = app;
