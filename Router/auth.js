const express = require("express");
const Routers = express.Router();
const User = require("../Modles/User");
const Admin = require('../Modles/Admin');
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid"); // For generating unique IDs
const bodyParser = require("body-parser");
const Wallet = require("ethereumjs-wallet");
const util = require('util');
const Tx = require("ethereumjs-tx");
const Web3 = require("web3");
const ethereumjsutil = require("ethereumjs-util");
const qrcode = require("qrcode");
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const app = express();
const port = 3001;

app.use(bodyParser.json());
app.use(express.static("public")); // Serve static files from the 'public' directory

// laiq end points
const STATUS_PENDING = "Pending";

// Test route
Routers.get('/test', (req, res) => {
  res.status(200).json({ message: 'API is working!' });
});



module.exports = Routers;