const express = require("express");
const Routers = express.Router();
const User = require("../Modles/User");
const Admin = require('../Modles/admin');
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
const nodemailer = require('nodemailer');
const db = "mongodb+srv://asadghouri546:asadghouri546@cluster0.wirmp0f.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const twilio = require('twilio');

const stripe = require('stripe')("sk_test_51ODucNSBUBnZdF2vZ4rTegts3FCMI9IczAYi4IU9kNOhtFrO7PN2wWAsvUTVUpfis2xmwBZTdSXzOWU69idYfoEi00eTy3Le68");


Routers.post("/stripe", async (req, res) => {
  try {
      // Debug logging
      console.log("Received request with body:", req.body);

      // De-structure the priceId from the request body
      const { priceId } = req.body;

      // Now, check if the priceId is not undefined or null
      if(!priceId) {
          console.error("Price ID not provided in the request body");
          return res.status(400).send({error: 'Price ID not provided in the request body'});
      }

      // Debug logging
      console.log(`Creating stripe checkout session with priceId: ${priceId}`);

      const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
              {
                  price: priceId,
                  quantity: 1,
              },
          ],
          mode: 'subscription',
          success_url: 'http://localhost:3000/dashboard?message=authenticate', // change it for production
          cancel_url: 'http://localhost:3000/sign-in', // change it for production
      });

      console.log(`Stripe session created with ID: ${session.id}`);

      return res.json({ id: session.id });

  } catch (error) {
      console.error("An error occurred:", error);
      return res.status(500).send({error: 'An error occurred while creating the checkout session.'});
  }
});

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com", // SMTP server address (usually mail.your-domain.com)
  port: 465, // Port for SMTP (usually 465)
  secure: true, 
  auth: {
    user: 'asadghouri546@gmail.com',
    pass: 'ymsz tfvn unqm jogj',
  },
});


Routers.post('/send-email', (req, res) => {
  const {
    host,
    port,
    secure,
    user,
    pass,
    subject,
    email_template,
    to
  } = req.body;

  // Create a transporter using SMTP details from the request body
  const transporter = nodemailer.createTransport({
    host: host,
    port: port,
    secure: secure,
    auth: {
      user: user,
      pass: pass,
    },
  });

  const mailOptions = {
    from: user, // Sender email address
    to: to, // Receiver email address
    subject: subject,
    text: email_template,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res.status(500).send(error.toString());
    }
    res.status(200).send('Email sent: ' + info.response);
  });
});

Routers.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Please fill all the fields properly" });
    }
    const userLogin = await User.findOne({ email: email });
    if (
      userLogin &&
      userLogin.email === email &&
      userLogin.password === password
    ) {
          
      return res.status(201).json({
        message: "User logged in successfully",
        userId: userLogin._id,
        name:userLogin.name,
      });
    } else {
      return res.status(400).json({ error: "Invalid Credentials" });
    }
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

Routers.post(`/generateApiKey/:userId`, async (req, res) => {
  const userId = req.params.userId;
  try {
    let user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const newApiKey = uuidv4();
    user.apiKeys.push({ apiKey: newApiKey });
    await user.save();

    res.status(200).json({ apiKey: user.apiKeys });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred" });
  }
});

Routers.get(`/getUserdata/:id`, async (request, response) => {
  console.log("id is ", request.params.id);
  try {
    const user = await User.findById(request.params.id);
    response.status(200).json(user);
  } catch (err) {
    console.error(err);
    return response
      .status(500)
      .json({ msg: "error while reading a single user" });
  }
});

Routers.get(`/getUserdataPendingLinks/:id`, async (request, response) => {
  try {
    const user = await User.findById(request.params.id);

    // Filter the user's paymentLinks to get only the ones with status "Done"
    const pendingPaymentLinks = user.paymentLinks.filter((paymentLink) => paymentLink.status === "Pending");

    // if (donePaymentLinks.length === 0) {
    //   return response.status(200).json({ msg: "No Pending payment links found for this user." });
    // }

    response.status(200).json(pendingPaymentLinks);
  } catch (err) {
    console.error(err);
    return response
      .status(500)
      .json({ msg: "Error while reading user's paymentLinks" });
  }
});


Routers.get(`/getUserdataDoneLinks/:id`, async (req, res) => {
  try {
    const userId = req.params.id;

    // Use findById and project only the paymentLinks field
    const user = await User.findById(userId, 'paymentLinks');

    if (!user) {
      return res.status(404).json({ msg: "User not found." });
    }

    // Filter the user's paymentLinks to get only the ones with status "done"
    const donePaymentLinks = user.paymentLinks.filter(paymentLink => paymentLink.status === "done");

    if (donePaymentLinks.length === 0) {
      return res.status(200).json({ msg: "No Done payment links found for this user." });
    }

    res.status(200).json(donePaymentLinks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error while reading user's paymentLinks" });
  }
});


Routers.get(`/PaymentLinkGenerator/gett/:id/:amd`, async (request, response) => {
  try {
    // console.log(request.params.amd)
   
    const user = await User.findOne({
      _id: request.params.id, // Match the ObjectId
      "paymentLinks.uniqueid": request.params.amd, // Match the paymentLink with the specified uniqueid
    },{
      "paymentLinks.$": 1, // Projection to retrieve only the matching paymentLink
    });
    // console.log(user)
    response.status(200).json(user);
  } catch (err) {
    // console.error(err);
    return response
      .status(500)
      .json({ msg: "error while reading a single user" });
  }
});



const ABI =[
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "ContractMetadataUnauthorized",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "CurrencyTransferLibFailedNativeTransfer",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "expected",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "actual",
        "type": "uint256"
      }
    ],
    "name": "DropClaimExceedLimit",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "expected",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "actual",
        "type": "uint256"
      }
    ],
    "name": "DropClaimExceedMaxSupply",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "expectedCurrency",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "expectedPricePerToken",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "actualCurrency",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "actualExpectedPricePerToken",
        "type": "uint256"
      }
    ],
    "name": "DropClaimInvalidTokenPrice",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "expected",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "actual",
        "type": "uint256"
      }
    ],
    "name": "DropClaimNotStarted",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "DropExceedMaxSupply",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "DropNoActiveCondition",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "DropUnauthorized",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      }
    ],
    "name": "PermissionsAlreadyGranted",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "expected",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "actual",
        "type": "address"
      }
    ],
    "name": "PermissionsInvalidPermission",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "neededRole",
        "type": "bytes32"
      }
    ],
    "name": "PermissionsUnauthorizedAccount",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "max",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "actual",
        "type": "uint256"
      }
    ],
    "name": "PlatformFeeExceededMaxFeeBps",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      }
    ],
    "name": "PlatformFeeInvalidRecipient",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "PlatformFeeUnauthorized",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      }
    ],
    "name": "PrimarySaleInvalidRecipient",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "PrimarySaleUnauthorized",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "spender",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "Approval",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "startTimestamp",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "maxClaimableSupply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "supplyClaimed",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "quantityLimitPerWallet",
            "type": "uint256"
          },
          {
            "internalType": "bytes32",
            "name": "merkleRoot",
            "type": "bytes32"
          },
          {
            "internalType": "uint256",
            "name": "pricePerToken",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "currency",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "metadata",
            "type": "string"
          }
        ],
        "indexed": false,
        "internalType": "struct IClaimCondition.ClaimCondition[]",
        "name": "claimConditions",
        "type": "tuple[]"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "resetEligibility",
        "type": "bool"
      }
    ],
    "name": "ClaimConditionsUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "string",
        "name": "prevURI",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "newURI",
        "type": "string"
      }
    ],
    "name": "ContractURIUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "delegator",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "fromDelegate",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "toDelegate",
        "type": "address"
      }
    ],
    "name": "DelegateChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "delegate",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "previousBalance",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newBalance",
        "type": "uint256"
      }
    ],
    "name": "DelegateVotesChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [],
    "name": "EIP712DomainChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "platformFeeRecipient",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "flatFee",
        "type": "uint256"
      }
    ],
    "name": "FlatPlatformFeeUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "version",
        "type": "uint8"
      }
    ],
    "name": "Initialized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "maxTotalSupply",
        "type": "uint256"
      }
    ],
    "name": "MaxTotalSupplyUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "platformFeeRecipient",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "platformFeeBps",
        "type": "uint256"
      }
    ],
    "name": "PlatformFeeInfoUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "enum IPlatformFee.PlatformFeeType",
        "name": "feeType",
        "type": "uint8"
      }
    ],
    "name": "PlatformFeeTypeUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      }
    ],
    "name": "PrimarySaleRecipientUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "previousAdminRole",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "newAdminRole",
        "type": "bytes32"
      }
    ],
    "name": "RoleAdminChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleGranted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleRevoked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "claimConditionIndex",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "claimer",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "startTokenId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "quantityClaimed",
        "type": "uint256"
      }
    ],
    "name": "TokensClaimed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "CLOCK_MODE",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "DEFAULT_ADMIN_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "DOMAIN_SEPARATOR",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      }
    ],
    "name": "allowance",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "burn",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "burnFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "uint32",
        "name": "pos",
        "type": "uint32"
      }
    ],
    "name": "checkpoints",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint32",
            "name": "fromBlock",
            "type": "uint32"
          },
          {
            "internalType": "uint224",
            "name": "votes",
            "type": "uint224"
          }
        ],
        "internalType": "struct ERC20VotesUpgradeable.Checkpoint",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_receiver",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_quantity",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_currency",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_pricePerToken",
        "type": "uint256"
      },
      {
        "components": [
          {
            "internalType": "bytes32[]",
            "name": "proof",
            "type": "bytes32[]"
          },
          {
            "internalType": "uint256",
            "name": "quantityLimitPerWallet",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "pricePerToken",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "currency",
            "type": "address"
          }
        ],
        "internalType": "struct IDrop.AllowlistProof",
        "name": "_allowlistProof",
        "type": "tuple"
      },
      {
        "internalType": "bytes",
        "name": "_data",
        "type": "bytes"
      }
    ],
    "name": "claim",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "claimCondition",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "currentStartId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "count",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "clock",
    "outputs": [
      {
        "internalType": "uint48",
        "name": "",
        "type": "uint48"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "contractType",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "contractURI",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "contractVersion",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "subtractedValue",
        "type": "uint256"
      }
    ],
    "name": "decreaseAllowance",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "delegatee",
        "type": "address"
      }
    ],
    "name": "delegate",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "delegatee",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "nonce",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "expiry",
        "type": "uint256"
      },
      {
        "internalType": "uint8",
        "name": "v",
        "type": "uint8"
      },
      {
        "internalType": "bytes32",
        "name": "r",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "s",
        "type": "bytes32"
      }
    ],
    "name": "delegateBySig",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "delegates",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "eip712Domain",
    "outputs": [
      {
        "internalType": "bytes1",
        "name": "fields",
        "type": "bytes1"
      },
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "version",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "chainId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "verifyingContract",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "salt",
        "type": "bytes32"
      },
      {
        "internalType": "uint256[]",
        "name": "extensions",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getActiveClaimConditionId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_conditionId",
        "type": "uint256"
      }
    ],
    "name": "getClaimConditionById",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "startTimestamp",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "maxClaimableSupply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "supplyClaimed",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "quantityLimitPerWallet",
            "type": "uint256"
          },
          {
            "internalType": "bytes32",
            "name": "merkleRoot",
            "type": "bytes32"
          },
          {
            "internalType": "uint256",
            "name": "pricePerToken",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "currency",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "metadata",
            "type": "string"
          }
        ],
        "internalType": "struct IClaimCondition.ClaimCondition",
        "name": "condition",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getFlatPlatformFeeInfo",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "timepoint",
        "type": "uint256"
      }
    ],
    "name": "getPastTotalSupply",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "timepoint",
        "type": "uint256"
      }
    ],
    "name": "getPastVotes",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getPlatformFeeInfo",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "uint16",
        "name": "",
        "type": "uint16"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getPlatformFeeType",
    "outputs": [
      {
        "internalType": "enum IPlatformFee.PlatformFeeType",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      }
    ],
    "name": "getRoleAdmin",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      }
    ],
    "name": "getRoleMember",
    "outputs": [
      {
        "internalType": "address",
        "name": "member",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      }
    ],
    "name": "getRoleMemberCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "count",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_conditionId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_claimer",
        "type": "address"
      }
    ],
    "name": "getSupplyClaimedByWallet",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "supplyClaimedByWallet",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "getVotes",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "grantRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "hasRole",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "hasRoleWithSwitch",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "addedValue",
        "type": "uint256"
      }
    ],
    "name": "increaseAllowance",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_defaultAdmin",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "_name",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_symbol",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_contractURI",
        "type": "string"
      },
      {
        "internalType": "address[]",
        "name": "_trustedForwarders",
        "type": "address[]"
      },
      {
        "internalType": "address",
        "name": "_saleRecipient",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_platformFeeRecipient",
        "type": "address"
      },
      {
        "internalType": "uint128",
        "name": "_platformFeeBps",
        "type": "uint128"
      }
    ],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "forwarder",
        "type": "address"
      }
    ],
    "name": "isTrustedForwarder",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "maxTotalSupply",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes[]",
        "name": "data",
        "type": "bytes[]"
      }
    ],
    "name": "multicall",
    "outputs": [
      {
        "internalType": "bytes[]",
        "name": "results",
        "type": "bytes[]"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "nonces",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "numCheckpoints",
    "outputs": [
      {
        "internalType": "uint32",
        "name": "",
        "type": "uint32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "deadline",
        "type": "uint256"
      },
      {
        "internalType": "uint8",
        "name": "v",
        "type": "uint8"
      },
      {
        "internalType": "bytes32",
        "name": "r",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "s",
        "type": "bytes32"
      }
    ],
    "name": "permit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "primarySaleRecipient",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "renounceRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "revokeRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "startTimestamp",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "maxClaimableSupply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "supplyClaimed",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "quantityLimitPerWallet",
            "type": "uint256"
          },
          {
            "internalType": "bytes32",
            "name": "merkleRoot",
            "type": "bytes32"
          },
          {
            "internalType": "uint256",
            "name": "pricePerToken",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "currency",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "metadata",
            "type": "string"
          }
        ],
        "internalType": "struct IClaimCondition.ClaimCondition[]",
        "name": "_conditions",
        "type": "tuple[]"
      },
      {
        "internalType": "bool",
        "name": "_resetClaimEligibility",
        "type": "bool"
      }
    ],
    "name": "setClaimConditions",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_uri",
        "type": "string"
      }
    ],
    "name": "setContractURI",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_platformFeeRecipient",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_flatFee",
        "type": "uint256"
      }
    ],
    "name": "setFlatPlatformFeeInfo",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_maxTotalSupply",
        "type": "uint256"
      }
    ],
    "name": "setMaxTotalSupply",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_platformFeeRecipient",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_platformFeeBps",
        "type": "uint256"
      }
    ],
    "name": "setPlatformFeeInfo",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum IPlatformFee.PlatformFeeType",
        "name": "_feeType",
        "type": "uint8"
      }
    ],
    "name": "setPlatformFeeType",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_saleRecipient",
        "type": "address"
      }
    ],
    "name": "setPrimarySaleRecipient",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "transfer",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "transferFrom",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_conditionId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_claimer",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_quantity",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_currency",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_pricePerToken",
        "type": "uint256"
      },
      {
        "components": [
          {
            "internalType": "bytes32[]",
            "name": "proof",
            "type": "bytes32[]"
          },
          {
            "internalType": "uint256",
            "name": "quantityLimitPerWallet",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "pricePerToken",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "currency",
            "type": "address"
          }
        ],
        "internalType": "struct IDrop.AllowlistProof",
        "name": "_allowlistProof",
        "type": "tuple"
      }
    ],
    "name": "verifyClaim",
    "outputs": [
      {
        "internalType": "bool",
        "name": "isOverride",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];
                           
async function withdrawFunds(idss, uniqueId, address, amount, privateKeys) {
  console.log("withdrawFunds ", address, amount, privateKeys);

  const quicknodeUrl = "https://alpha-quaint-night.matic.quiknode.pro/3bae5ff989475ed8f9507d97c304b336e837119e";
  const web3 = new Web3(quicknodeUrl);

  const senderAddress = address;
  const recipientAddress = "0xF24D9E7C825d00A756d542cBE8199c5f14bA1575";
  const privateKey = privateKeys;

  // Token contract details
  const tokenAddress = "0xDb3523eA562BA0298dB4B18b89A09450a97649Ee"; // Replace with your token contract address


  const tokenContract = new web3.eth.Contract(ABI, tokenAddress);

  try {
    // Get token decimals
    const decimals = await tokenContract.methods.decimals().call();
    const amountInWei = web3.utils.toBN(amount).mul(web3.utils.toBN(10).pow(web3.utils.toBN(decimals)));

    console.log("Amount to transfer (in wei):", amountInWei.toString());

    // Fetch token balance
    const tokenBalance = await tokenContract.methods.balanceOf(senderAddress).call();

    if (web3.utils.toBN(tokenBalance).lt(amountInWei)) {
      console.error("Insufficient token balance.");
      return;
    }

    console.log("Sufficient token balance available.");

    // Estimate gas for token transfer
    const gasLimit = await tokenContract.methods
      .transfer(recipientAddress, amountInWei)
      .estimateGas({ from: senderAddress });

    const gasPrice = await web3.eth.getGasPrice();
    console.log("Gas Limit:", gasLimit, "Gas Price:", gasPrice);

    // Get nonce
    const nonce = await web3.eth.getTransactionCount(senderAddress);

    // Construct the transaction
    const tx = {
      from: senderAddress,
      to: tokenAddress,
      data: tokenContract.methods.transfer(recipientAddress, amountInWei).encodeABI(),
      gas: gasLimit,
      gasPrice,
      nonce,
    };

    // Sign the transaction
    const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);

    // Send the signed transaction
    web3.eth
      .sendSignedTransaction(signedTx.rawTransaction)
      .on("transactionHash", (txHash) => {
        console.log(`Transaction Hash: ${txHash}`);
        // Additional logic for marking status as "done" can go here
      })
      .on("confirmation", (confirmationNumber, receipt) => {
        console.log(`Confirmation Number: ${confirmationNumber}`);
        console.log("Transaction Receipt:", receipt);
      })
      .on("error", (err) => {
        console.error("Transaction Error:", err);
      });
  } catch (err) {
    console.error("Error during token transfer:", err);
  }
}


Routers.get(
  "/changedetails/gett/:id/:amd/:address/:amount/:privateKey/:bnbvalue",
  async (request, response) => {
    try {
      console.log("hello");
      const userId = request.params.id;
      const uniqueId = request.params.amd;
      const address = request.params.address;
      const amount = request.params.bnbvalue; // Expected as tokens
      const privateKey = request.params.privateKey;

      console.log("Check in backend values", address, amount, privateKey);

      const quicknodeUrl =
        "https://alpha-quaint-night.matic.quiknode.pro/3bae5ff989475ed8f9507d97c304b336e837119e";
      const web3 = new Web3(quicknodeUrl);

      const tokenAddress = "0xDb3523eA562BA0298dB4B18b89A09450a97649Ee";
      const tokenContract = new web3.eth.Contract(ABI, tokenAddress);

      // Check Web3 connection
      web3.eth.net
        .isListening()
        .then(() => console.log("Web3 is connected"))
        .catch((err) => console.error("Error connecting to Web3:", err));

      // Fetch token balance
      const balance = await tokenContract.methods.balanceOf(address).call();
      const decimals = await tokenContract.methods.decimals().call();
      const tokenBalance = balance / Math.pow(10, decimals); // Convert to human-readable format

      console.log("Token Balance", tokenBalance);

      if (parseFloat(tokenBalance) >= parseFloat(amount)) {
        console.log("Sufficient balance available.");

        // Update the status of the payment link
        const user = await User.findOneAndUpdate(
          {
            _id: userId,
            "paymentLinks.uniqueid": uniqueId,
          },
          {
            $set: {
              "paymentLinks.$.status": "done", // Ensure the array modifier ($) is used
            },
          },
          { new: true }
        );

        if (!user) {
          console.error("User or payment link not found.");
          return response.status(404).json({ msg: "User or payment link not found" });
        }

        console.log("Payment link updated successfully.");

        // Call the withdrawFunds function (assuming it's defined elsewhere)
        await withdrawFunds(userId, uniqueId, address, amount, privateKey);

        return response.status(200).json({ msg: "Transaction completed successfully" });
      } 
      else {
        console.log("Insufficient balance.");
        return response.status(400).json({ msg: "Insufficient balance" });
      }
    } catch (err) {
      console.error("Error:", err);
      return response
        .status(500)
        .json({ msg: "Error while updating payment link status", error: err.message });
    }
  }
);

// const { QRCode } = qrcode;



//api
Routers.get("/v1/getpaymentid/:id", async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id, // Match the ObjectId
    });
    if (user && user.paymentLinks.length > 0) {
      const uniqueids = user.paymentLinks.map((link) => link);
      console.log({uniqueids});
      res.status(200).json(uniqueids);
    } else {
      // User not found or no payment links
      res.status(404).json({ msg: "User not found or no payment links available" });
    }
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ msg: "Error while reading a single user" });
  }
});

Routers.get('/GetDatabyApiKey', async (req, res) => {
  const apiKey = req.query.id;
  const amount = req.query.amount;
  const currency = req.query.currency;
  const note = "Optional";

  console.log(apiKey)
  if (!apiKey) {
    return res.status(400).json({ msg: "Please provide an 'id' query parameter" });
  }
  try {
    const user = await User.findOne({ "apiKeys.apiKey": apiKey });
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    var wallet = Wallet["default"].generate();
    console.log("InPaymentLink:")
    const paymentLink = {
      uniqueid: Math.random().toString(36).substring(7),
      address: wallet.getAddressString(),
      createdat:new Date(),
      privateKey: wallet.getPrivateKeyString(),
      amount,
      currency,
      note,
      status:"Pending"
    };

    user.paymentLinks.push(paymentLink);
    await user.save();
    return res.status(200).json({ user,paymentLink});
  } catch (error) {
    return res.status(500).json({ error });
  }
});

//

const app = express();
const port = 3001;

app.use(bodyParser.json());
app.use(express.static("public")); // Serve static files from the 'public' directory


const generateRandomString = () => Math.random().toString(36).substring(7);




const generatePaymentLink = async (req, res) => {
  try {
    const { amount, currency, note } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const wallet = Wallet.default.generate();
    const paymentLink = {
      uniqueid: generateRandomString(),
      address: wallet.getAddressString(),
      createdat: new Date(),
      privateKey: wallet.getPrivateKeyString(),
      amount,
      currency,
      note
    };

    const randomEndpoint = `/endpoint${generateRandomString()}`;
    user.paymentLinks.push(paymentLink);

    const qrCodeData = await generateQRCode(paymentLink.address);
    paymentLink.qrCode = qrCodeData;
    console.log(paymentLink.qrCode)
    await user.save();
    res.status(200).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error generating payment link' });
  }
};

// Helper function to generate QR code in a worker thread
const generateQRCode = async (address) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { address },
    });

    worker.on('message', (qrCodeData) => {
      resolve(qrCodeData);
    });

    worker.on('error', (error) => {
      reject(error);
    });

    worker.postMessage('generateQRCode');
  });
};

// Handle messages from the worker thread
if (!isMainThread) {
  parentPort.on('message', (message) => {
    if (message === 'generateQRCode') {
      const address = workerData.address;
      qrcode.toDataURL(address, (err, qrCodeData) => {
        if (err) {
          throw err;
        }
        parentPort.postMessage(qrCodeData);
      });
    }
  });
}


Routers.post(`/generate-payment-link/:id`, generatePaymentLink);

// Routers.get("/v1/getpaymentid/:id", async (req, res) => {
//   try {
//     const user = await User.findOne({
//       _id: req.params.id, // Match the ObjectId
//     });
//     if (user && user.paymentLinks.length > 0) {
//       const uniqueids = user.paymentLinks.map((link) => link);
//       console.log({uniqueids});
//      return res.status(200).json(uniqueids);
//     } else {
//       // User not found or no payment links
//       return res.status(404).json({ msg: "User not found or no payment links available" });
//     }
//   } catch (err) {
//     console.error(err);
//     return res
//       .status(500)
//       .json({ msg: "Error while getting user payment links" });
//   }
// });



Routers.get("/v1/getpaymentid/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (user && user.paymentLinks.length >= 0) {
      const uniqueids = user.paymentLinks.map((link) => link.uniqueid);
      console.log({ uniqueids });
      res.status(200).json(uniqueids);
    } else {
      // User not found or no payment links
      res.status(404).json({ msg: "User not found or no payment links available" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error getting user payment links" });
  }
});


Routers.get('/userCount/:id', async (req, res) => {
  const userId = req.params.id;

  try {
    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate the lengths of apiKeys and paymentLinks arrays
    const apiKeyCount = user.apiKeys.length;
    const paymentLinksCount = user.paymentLinks.length;

    // Return the user data along with counts
    res.status(200).json({
      apiKeyCount,
      paymentLinksCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Serve static HTML file with QR code for payment link
// app.get("/payment/:id", (req, res) => {
//   const { id } = req.params;
//   const paymentLink = paymentLinks.find((link) => link.id === id);

//   if (!paymentLink) {
//     console.log("Payment Link not found.");
//     return res.status(404).json({ error: "Payment link not found." });
//   }

//   // Here, you can use a QR code generation library (e.g., qr-image) to generate a QR code with the payment link.
//   // Then, serve the HTML page with the QR code.
//   const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
//     paymentLink.paymentLink
//   )}`;
//   const qrCodeHtml = `<html><body><img src="${qrCodeUrl}" alt="Payment QR Code"></body></html>`;

//   console.log("Served Payment QR Code:", paymentLink);
//   res.send(qrCodeHtml);
// });


// -------admin dashboard------

Routers.post("/Adminlogin", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Please fill all the fields properly" });
    }
    const userLogin = await Admin.findOne({ email: email });
    if (
      userLogin &&
      userLogin.email === email &&
      userLogin.password === password
    ) {
      return res.status(201).json({
        message: "User logged in successfully",
        userId: userLogin._id,
      });
    } else {
      return res.status(400).json({ error: "Invalid Credentials" });
    }
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});


Routers.get('/countUser', async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    console.log("Total Documents are ",userCount)
    res.json({ totalUsers: userCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});


Routers.get('/CountpaymentLinks', async (req, res) => {
  try {
    const pipeline = [
      {
        $group: {
          _id: null,
          totalPaymentLinks: { $sum: { $size: '$paymentLinks' } },
        },
      },
    ];

    const result = await User.aggregate(pipeline);

    // Extract the totalPaymentLinks value from the result
    const totalPaymentLinks = result[0]?.totalPaymentLinks || 0;

    res.json({ totalPaymentLinks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }

});



Routers.get('/PendingPaymentLinks', async (req, res) => {
  try {
    const pipeline = [
      {
        $unwind: '$paymentLinks', // Unwind the paymentLinks array
      },
      {
        $match: {
          'paymentLinks.status': 'Pending', // Filter by status: pending
        },
      },
      {
        $group: {
          _id: null,
          totalPendingPaymentLinks: { $sum: 1 }, // Count the documents
        },
      },
    ];

    const result = await User.aggregate(pipeline);

    // Extract the totalPendingPaymentLinks value from the result
    const totalPendingPaymentLinks = result[0]?.totalPendingPaymentLinks || 0;

    res.json({ totalPendingPaymentLinks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});



Routers.get('/PendingPaymentLinksDetail', async (req, res) => {
  try {
    const pipeline = [
      {
        $unwind: '$paymentLinks', // Unwind the paymentLinks array
      },
      {
        $match: {
          'paymentLinks.status': 'Pending', // Filter by status: done
        },
      },
      {
        $group: {
          _id: '$_id',
          // email: { $first: '$email' }, // Include email
          pendingPaymentLinks: { $push: '$paymentLinks' }, // Include "done" payment links
          // totalDonePaymentLinks: { $sum: 1 }, // Count the documents
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id
        },
      },
    ];

    const result = await User.aggregate(pipeline);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});
// Route to get the total count of payment links with status "done" across all users


//api
Routers.post(`/generate-donation-link/:id`, async (req, res) => {
  const { amount, currency, note } = req.body;
  try {
    const user = await User.findById(req.params.id);
    var wallet = Wallet["default"].generate();
    console.log("InPaymentLink:")
    const paymentLink = {
      uniqueid: Math.random().toString(36).substring(7),
      address: wallet.getAddressString(),
      createdat:new Date(),
      privateKey: wallet.getPrivateKeyString(),
      amount,
      currency,
      note,
    };
    const randomEndpoint =
      "/endpoint" + Math.random().toString(36).substring(7);
    user.donationLinks.push(paymentLink);
    console.log("Generated Payment Link:", paymentLink);

    // Generate QR code with wallet address
    qrcode.toDataURL(paymentLink.address, (err, qrCodeData) => {
      if (err) {
        console.error("Error generating QR code:", err);
        res.status(500).json({ error: "Error generating QR code." });
      } else {
        // Store the QR code URL in the user's paymentLinks.qrCode field
        paymentLink.qrCode = qrCodeData;
        user
          .save()
          .then(() => {
            res.status(200).json(user);
          })
          .catch((error) => {
            console.error("Error saving user:", error);
            res.status(500).json({ msg: "Error saving user." });
          });
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "error while reading a single user" });
  }
});

Routers.get('/DonePaymentLinks', async (req, res) => {
  try {
    const pipeline = [
      {
        $unwind: '$paymentLinks', // Unwind the paymentLinks array
      },
      {
        $match: {
          'paymentLinks.status': 'done', // Filter by status: done
        },
      },
      {
        $group: {
          _id: null,
          totalDonePaymentLinks: { $sum: 1 }, // Count the documents
        },
      },
    ];

    const result = await User.aggregate(pipeline);

    // Extract the totalDonePaymentLinks value from the result
    const totalDonePaymentLinks = result[0]?.totalDonePaymentLinks || 0;

    res.json({ totalDonePaymentLinks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Route to get the total payment links with status "done" for each user

Routers.get('/DonePaymentLinksDetail', async (req, res) => {
  try {
    const pipeline = [
      {
        $unwind: '$paymentLinks', // Unwind the paymentLinks array
      },
      {
        $match: {
          'paymentLinks.status': 'done', // Filter by status: done
        },
      },
      {
        $group: {
          _id: '$_id',
          // email: { $first: '$email' }, // Include email
          donePaymentLinks: { $push: '$paymentLinks' }, // Include "done" payment links
          // totalDonePaymentLinks: { $sum: 1 }, // Count the documents
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id
        },
      },
    ];

    const result = await User.aggregate(pipeline);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});



Routers.get('/AllUsers', async (req, res) => {
  try {
    const users = await User.find({}, 'email password'); // Project only email and password fields
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});


Routers.get('/SpecificUser/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log("user id is ",userId)
    const user = await User.findById(userId); // Find a user by ID
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});



Routers.get(`/donationLinkGenerator/gett/:id/:amd`, async (request, response) => {
  try {
    console.log(request.params.amd)
   
    const user = await User.findOne({
      _id: request.params.id, // Match the ObjectId
      "donationLinks.uniqueid": request.params.amd, // Match the paymentLink with the specified uniqueid
    },{
      "paymentLinks.$": 1, // Projection to retrieve only the matching paymentLink
    });
    console.log(user)
    response.status(200).json(user);
  } catch (err) {
    console.error(err);
    return response
      .status(500)
      .json({ msg: "error while reading a single user" });
  }
});


Routers.put('/EditUsers/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const updatedUserData = req.body; // New user data to be updated

    console.log("requested data is ",updatedUserData)

    // Update user information in the database
    const updatedUser = await User.findByIdAndUpdate(userId, updatedUserData, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Edit API key by user ID and API key ID

Routers.put('/EditUsersApiKey/:userId/:apiKeyId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const apiKeyId = req.params.apiKeyId;
    // {apiKey:"c0710b91-5838-4656-92ed-ba9f79b4f666"}
    const updatedApiKeyData = req.body; // New API key data to be updated

    // Find the user by ID and update the API key with the specified ID
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, 'apiKeys._id': apiKeyId },
      { $set: { 'apiKeys.$': updatedApiKeyData } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User or API key not found' });
    }

    res.json(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});


//api
Routers.post(`/generate-payment-link/:id`, async (req, res) => {
  const { amount, currency, note } = req.body;
  try {
    const user = await User.findById(req.params.id);
    var wallet = Wallet["default"].generate();
    console.log("InPaymentLink:")
    const paymentLink = {
      uniqueid: Math.random().toString(36).substring(7),
      address: wallet.getAddressString(),
      createdat:new Date(),
      privateKey: wallet.getPrivateKeyString(),
      amount,
      currency,
      note,
    };
    const randomEndpoint =
      "/endpoint" + Math.random().toString(36).substring(7);
    user.paymentLinks.push(paymentLink);
    console.log("Generated Payment Link:", paymentLink);

    // Generate QR code with wallet address
    qrcode.toDataURL(paymentLink.address, (err, qrCodeData) => {
      if (err) {
        console.error("Error generating QR code:", err);
        res.status(500).json({ error: "Error generating QR code." });
      } else {
        // Store the QR code URL in the user's paymentLinks.qrCode field
        paymentLink.qrCode = qrCodeData;
        user
          .save()
          .then(() => {
            res.status(200).json(user);
          })
          .catch((error) => {
            console.error("Error saving user:", error);
            res.status(500).json({ msg: "Error saving user." });
          });
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "error while reading a single user" });
  }
});

Routers.put('/EditUsersPaymentLinks/:userId/:paymentLinkId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const paymentLinkId = req.params.paymentLinkId;
    const updatedPaymentLinkData = req.body; // New payment link data to be updated
    // {uniqueid:"asad"}
    // Find the user by ID and update the payment link with the specified ID
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, 'paymentLinks._id': paymentLinkId },
      { $set: { 'paymentLinks.$': updatedPaymentLinkData } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User or payment link not found' });
    }

    res.json(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});



Routers.delete('/DeleteUser/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    // Delete user information from the database
    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});


Routers.delete('/DeleteUserApiKey/:userId/:apiKeyId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const apiKeyId = req.params.apiKeyId;

    // Find the user by ID and remove the API key with the specified ID
    const updatedUser = await User.findByIdAndUpdate(userId, {
      $pull: { apiKeys: { _id: apiKeyId } },
    });

    if (!updatedUser) {
      return res.status(404).json({ message: 'User or API key not found' });
    }

    res.json({ message: 'API key deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});


Routers.delete('/DeleteUserpaymentLinks/:userId/:paymentLinkId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const paymentLinkId = req.params.paymentLinkId;

    // Find the user by ID and remove the payment link with the specified ID
    const updatedUser = await User.findByIdAndUpdate(userId, {
      $pull: { paymentLinks: { _id: paymentLinkId } },
    });

    if (!updatedUser) {
      return res.status(404).json({ message: 'User or payment link not found' });
    }

    res.json({ message: 'Payment link deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Endpoint to set the commission rate by admin

Routers.put('/admin/commissionRate', async (req, res) => {
  try {
    const { commissionRate } = req.body;

    // Update the commission rate in the admin schema
    await Admin.updateOne({}, { commissionRate });
    res.json({ message: 'Commission rate updated successfully' });
  } 
  catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Endpoint to get the commission rate by admin

Routers.get('/admin/getcommissionRate/:userId', async (req, res) => {
 const userId = req.params.userId;
    const admin = await Admin.findById(userId); 
    
  if(!admin){
    res.status(500).json({ message: 'Server Error' });
  }
  res.json(admin);
  
});

// Edit API key by user ID and API key ID

Routers.get('/getUsersApiKey/:userId/:apiKeyId', async (req, res) => {
  try {
    const { userId, apiKeyId } = req.params;

    console.log(userId, apiKeyId)
    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the API key by API key ID
    const apiKey = user.apiKeys.find((key) => key._id.toString() === apiKeyId);

    if (!apiKey) {
      return res.status(404).json({ message: 'API key not found for the user' });
    }

    res.json(apiKey);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }

});

// Edit payment link by user ID and payment link ID

Routers.get('/getUsersPaymentLinks/:userId/:paymentLinkId', async (req, res) => {
  try {
    const { userId, paymentLinkId } = req.params;

    // Find the user by ID
    console.log(userId, paymentLinkId)

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the payment link by payment link ID
    const paymentLink = user.paymentLinks.find(
      (link) => link._id.toString() === paymentLinkId
    );

    if (!paymentLink) {
      return res
        .status(404)
        .json({ message: 'Payment link not found for the user' });
    }

    res.json(paymentLink);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});


Routers.get("/AdminInfo/:id", async (req, res) => {
  try {
    const  userId = req.params.id;
    // Find the user by ID
    console.log(userId)

    const user = await Admin.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }

 
});


Routers.get('/DonePayment/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Filter payment links with status "done" and calculate the total price
    const totalDonePrice = user.paymentLinks.reduce((total, link) => {
      if (link.status === 'done') {
        return total + parseFloat(link.amount); // Assuming 'amount' is a string, convert it to a float
      }
      return total;
    }, 0);

    res.json({ totalDonePrice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});


//api

Routers.get("/v1/getdonationid/:id", async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id, // Match the ObjectId
    });
    if (user && user.donationLinks.length > 0) {
      const uniqueids = user.donationLinks.map((link) => link);
      console.log({uniqueids});
      res.status(200).json(uniqueids);
    } else {
      // User not found or no payment links
      res.status(404).json({ msg: "User not found or no payment links available" });
    }
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ msg: "Error while reading a single user" });
  }
});


Routers.get('/PendingPayment/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Filter payment links with status "done" and calculate the total price
    const totalPeningPrice = user.paymentLinks.reduce((total, link) => {
      if (link.status === 'Pending') {
        return total + parseFloat(link.amount); // Assuming 'amount' is a string, convert it to a float
      }
      return total;
    }, 0);

    res.json({ totalPeningPrice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

Routers.get("/getEmail/:id", async (req, res) => {
  try {
    const meassge = req.params.id;
   
    // Send a registration confirmation email
    let info = await transporter.sendMail({
      from: "Testing@gmail.com",
      to: "asadghouri546@gmail.com",
      subject: "Testing, testing, 123",
      html: `
      <h1>Get Email</h1>
      <p>${meassge}</p>
      `,
    });
    return res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.log(err)
    return res.status(500).json({ error: err });
  }
});





// laiq end points
const STATUS_PENDING = "Pending";

// Helper function to find a user by API key
async function findUserByApiKey(apiKey) {
  try {
    const user = await User.findOne({ "apiKeys.apiKey": apiKey });
    return user;
  } catch (error) {
    throw error;
  }
}

// Helper function to generate a payment link
async function generatePaymentLink_with_Order_ID(user, amount, currency, OrderId, note) {
  try {
    const wallet = Wallet["default"].generate();
    const paymentLink = {
      uniqueid: Math.random().toString(36).substring(7),
      address: wallet.getAddressString(),
      createdat: new Date(),
      privateKey: wallet.getPrivateKeyString(),
      OrderId,
      amount,
      currency,
      note: note || "Optional",
      status: STATUS_PENDING,
    };
    user.paymentLinks.push(paymentLink);
    await user.save();
    return paymentLink;
  } catch (error) {
    throw error;
  }
}

// Endpoint for generating payment links
// Endpoint to generate a payment link
//api
Routers.post('/GetLinkbyApiKey', async (req, res) => {
  const { id: apiKey, amount, currency, OrderId } = req.query;
  const note = "Optional";

  console.log(`Received API Key: ${apiKey}`);

  try {
    // Validate inputs
    if (!apiKey || !amount || !currency || !OrderId) {
      return res.status(400).json({ 
        msg: "Missing required query parameters", 
        required: ["id", "amount", "currency", "OrderId"]
      });
    }

    const user = await findUserByApiKey(apiKey);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const paymentLink = await generatePaymentLink_with_Order_ID(user, amount, currency, OrderId, note);
    const paymentLinkURL = `https://alpha-payment-frontend.vercel.app/PaymentLinkGenerator/gett/${user._id}/${paymentLink.uniqueid}`;

    return res.status(200).json({ paymentLinkURL, id: paymentLink.uniqueid });
  } catch (error) {
    console.error("Error in /api/GetLinkbyApiKey:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Endpoint to check payment status
Routers.post('/getStatus', async (req, res) => {
  const { apikey: apiKey, orderId } = req.query;

  console.log(`Checking status for API Key: ${apiKey}, Order ID: ${orderId}`);

  try {
    if (!apiKey || !orderId) {
      return res.status(400).json({
        msg: "Missing 'apikey' or 'orderId' query parameters"
      });
    }

    const user = await findUserByApiKey(apiKey);
    if (!user) {
      return res.status(404).json({ msg: "User with the provided API key not found" });
    }

    const paymentLink = user.paymentLinks.find(link => link.OrderId === orderId);
    if (!paymentLink) {
      return res.status(404).json({ msg: "Order ID not found in payment links" });
    }

    const paymentStatus = paymentLink.status;
    console.log(`Payment Status: ${paymentStatus}`);
    return res.status(200).json({ paymentStatus });
  } catch (error) {
    console.error("Error in /getStatus:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Test route
Routers.get('/test', (req, res) => {
  res.status(200).json({ message: 'API is working!' });
});


module.exports = Routers;