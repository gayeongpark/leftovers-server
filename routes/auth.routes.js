const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const Auth = require("../models/auth.model.js");
const crypto = require("crypto");

const router = express.Router();

router.post("/signup", async (req, res, next) => {
  try {
    const { email, password, password2, firstname, lastname } = req.body;

    // Input validation (add your validation rules here)
    if (!email || !password || !password2 || !firstname || !lastname) {
      return res.status(400).json({ error: "All fields are required." });
    }

    if (password !== password2) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    // Check if the user already exists
    const existingUser = await Auth.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already registered." });
    }

    // Hash the password
    const salt = bcrypt.genSaltSync(10); // 10 times of intensive the password hashing process
    const hash = bcrypt.hashSync(password, salt);
    const hash2 = bcrypt.hashSync(password2, salt);

    function generateRandom4DigitNumber() {
      // Generate a random 4-digit number
      const randomBytes = crypto.randomBytes(2); // 2 bytes = 16 bits
      const randomNumber = randomBytes.readUInt16BE(0); // Read 16 bits as an unsigned integer
      const fourDigitNumber = (randomNumber % 9000) + 1000; // Ensure it's 4 digits
      return fourDigitNumber;
    }

    // Generate an email token for email verification
    const token = generateRandom4DigitNumber();
    console.log(token);

    // Create a new user
    const newAuth = new Auth({
      firstname,
      lastname,
      email,
      password: hash,
      password2: hash2,
      emailToken: token,
      isVerified: false,
      isActive: false,
    });

    // await newAuth.save();

    // Attempt to send the verification email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODEMAILER_ID,
        pass: process.env.NODEMAILER_PASS,
      },
    });

    const url = `http://localhost:8000/auth/signup/${token}`;
    try {
      await transporter.sendMail({
        from: `"Leftovers Team" <${process.env.NODEMAILER_ID}>`,
        to: newAuth.email,
        subject: "Important: verify your email to use leftovers app",
        html: `<h3>Hello user!</h3> <div>Comer received a request to create an account for you.</div> <div>Before we proceed, we need you to verify the email address you provided.</div> <div>Click <a href='${url}'>here</a> to verify your email.</div> <div> </div> <div>Thank you,</div> <div>Leftovers</div>`,
      });
    } catch (error) {
      // If sending the email fails, remove the user data and return an error response
      await newAuth.deleteOne();
      return res
        .status(500)
        .json("Failed to send email verification. Please try again later.");
    }

    // If everything is successful, save the user data and send a success response.
    // In order to input the numbers from the client side, I use four digit numbers using crypto
    await newAuth.save();

    res.status(200).json({
      message:
        "Welcome to Leftovers! You successfully signed up! Please check your email inbox.",
    });
  } catch (error) {
    next(error);
  }
});

// I chnaged from URL to enter emailToken because there is no URL on react native app.
router.get("/verifyEmail/:token", async (req, res, next) => {
  try {
    const emailToken = req.params.token;

    // Find the user by emailToken and update the fields
    const user = await Auth.findOneAndUpdate(
      { emailToken: emailToken },
      { isVerified: true, isActive: true, emailToken: null },
      { new: true }
    );

    if (user) {
      // User found and updated successfully
      res.status(200).json("Your email is verified!");
    } else {
      // User not found with the provided token
      res.status(404).json("User not found!");
    }
  } catch (error) {
    // Handle any errors that occur during the process
    res.status(500).json("Server Error!");
  }
});

router.post("/login", async (req, res, next) => {});
router.post("/logout", async (req, res, next) => {});

router.post("/forgotPassword", async (req, res, next) => {});

router.post("/resetPassword", async (req, res, next) => {});

module.exports = router;