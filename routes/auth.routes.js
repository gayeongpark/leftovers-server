const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const Auth = require("../models/auth.model.js");
const crypto = require("crypto");

const router = express.Router();

router.post("/signup", async (req, res) => {
  try {
    const { email, password, password2, firstname, lastname } = req.body;

    if (!email || !password || !password2 || !firstname || !lastname) {
      return res.status(400).json({ error: "All fields are required." });
    }

    if (password !== password2) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    const existingUser = await Auth.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already registered." });
    }

    // Hash the password
    const salt = bcrypt.genSaltSync(10);
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
    // console.log(token);

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

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODEMAILER_ID,
        pass: process.env.NODEMAILER_PASS,
      },
    });

    try {
      await transporter.sendMail({
        from: `"Leftovers Team" <${process.env.NODEMAILER_ID}>`,
        to: newAuth.email,
        subject: "Important: verify your email to use leftovers app",
        html: `<h3>Hello ${firstname}!</h3> <div>Thank you for join us! Leftovers received a request to create an account for you.</div> <div>Before we proceed, we need you to verify the email address you provided.</div> <div>Input your verification code on this app.</div> <div> Verfication code: ${token}</div> <div>Thank you,</div> <div>Leftovers team</div>`,
      });
    } catch (error) {
      await newAuth.deleteOne();
      return res
        .status(500)
        .json("Failed to send email verification. Please try again later.");
    }

    await newAuth.save();
    // console.log(newAuth);

    res.status(200).json({
      message:
        "Welcome to Leftovers! You successfully signed up! Please check your email inbox.",
    });
  } catch (error) {
    res.status(500).json({
      error: "You could not successfully signup, please try it again!",
    });
  }
});

router.get("/verifyEmail/:token", async (req, res) => {
  try {
    const emailToken = req.params.token;

    const user = await Auth.findOneAndUpdate(
      { emailToken: emailToken },
      { isVerified: true, isActive: true, emailToken: null },
      { new: true }
    );

    if (user) {
      res.status(200).json({ message: "Your email is verified!" });
    } else {
      res.status(404).json("User not found!");
    }
  } catch (error) {
    res.status(500).json("Verfication was not updated successfully!");
  }
});

router.post("/resendValidationCode/:email", async (req, res) => {
  try {
    const { email } = req.params;
    console.log({ email });
    const user = await Auth.findOne({ email });
    // console.log("After findOne:", user);

    if (!user) {
      return res.status(404).json("User not found");
    }

    function generateRandom4DigitNumber() {
      const randomBytes = crypto.randomBytes(2);
      const randomNumber = randomBytes.readUInt16BE(0);
      const fourDigitNumber = (randomNumber % 9000) + 1000;
      return fourDigitNumber;
    }

    const token = generateRandom4DigitNumber();
    // console.log(token); // Implement your code generation logic

    user.emailToken = token;
    // user.isVerified = false; // Set isVerified to false since you're resending the code
    await user.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODEMAILER_ID,
        pass: process.env.NODEMAILER_PASS,
      },
    });

    try {
      await transporter.sendMail({
        from: `"Leftovers Team" <${process.env.NODEMAILER_ID}>`,
        to: user.email,
        subject: "Important: verify your email to use leftovers app",
        html: `<h3>Hello ${user.firstname}!</h3> <div>Thank you for join us! Leftovers received a request to create an account for you.</div> <div>Before we proceed, we need you to verify the email address you provided.</div> <div>Input your verification code on this app.</div> <div> Verfication code: ${user.emailToken}</div> <div>Thank you,</div> <div>Leftovers team</div>`,
      });
    } catch (error) {
      return res
        .status(500)
        .json("Failed to send email verification. Please try again later.");
    }
    res.status(200).json({ message: "Validation code resent successfully" });
  } catch (error) {
    console.error("Error resending validation code:", error);
    res.status(500).json("Validation code was not successfully updated!");
  }
});

// "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1MTZhNDIyOWIzNzZmMWYzMjgxOWIwNyIsImlhdCI6MTY5NzY1MjY1NSwiZXhwIjoxNjk3NjUyOTU1fQ.jH8XskPfO8uuvIhYt9NIaD_IcB2e_4kFY5tmnxaleOQ",
// "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1MTZhNDIyOWIzNzZmMWYzMjgxOWIwNyIsImlhdCI6MTY5NzY1MjY1NSwiZXhwIjoxNjk3NjUzMjU1fQ.glOc9yDxf2Lohg_uwWi-rvUU7KDmk9DuPUvlRdtq3o4",

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await Auth.findOne({ email });

    if (!user) {
      return res.status(401).json({ error: "This user was not registered!" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res
        .status(402)
        .json({ error: "Incorrect password or username, please check it!" });
    }

    const accessToken = jwt.sign(
      {
        id: user._id,
        // email: user.email,
      },
      process.env.ACCESS_SECRET,
      {
        expiresIn: "5m",
      }
    );

    const refreshToken = jwt.sign(
      {
        id: user._id,
        // email: user.email,
      },
      process.env.REFRESH_SECRET,
      {
        expiresIn: "10m",
      }
    );

    res.status(200).json({
      accessToken,
      refreshToken,
      userData: {
        email: user.email,
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        profileImage: user.profileImage,
      },
    });
    // console.log("Login succss on server!");
  } catch (error) {
    console.error("Login error:", error);
    res.status(400).json({ error: "Login failed, try it again!" });
  }
});

// router.post('/refreshToken', async (req, res) => {
//   const refreshToken = req.body.refreshToken;

//   if (!refreshToken) {
//     return res.status(401).json({ error: 'Refresh token is required.' });
//   }

//   try {
//     const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);

//     const user = await Auth.findById(decoded.id);
//     if (!user) {
//       return res.status(401).json({ error: 'User not found or invalid.' });
//     }

//     // Create a new access token and return it
//     const newAccessToken = jwt.sign(
//       {
//         id: user._id,
//         email: user.email,
//       },
//       process.env.ACCESS_SECRET,
//       {
//         expiresIn: '5m', // Adjust the expiration time as needed
//       }
//     );

//     res.json({
//       accessToken: newAccessToken,
//     });
//   } catch (error) {
//     console.error('Token refresh error:', error);
//     res.status(401).json({ error: 'Invalid refresh token.' });
//   }
// });

router.post("/logout", async (req, res) => {
  try {
    res.status(200).json("Logged out successfully");
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed, try it again!" });
  }
});

router.post("/forgotPassword", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await Auth.findOne({ email });
    // console.log("forgotpassword:", user);
    if (!user) {
      return res.status(400).json("You are not the joined member!");
    }

    function generateRandom4DigitNumber() {
      const randomBytes = crypto.randomBytes(2);
      const randomNumber = randomBytes.readUInt16BE(0);
      const fourDigitNumber = (randomNumber % 9000) + 1000;
      return fourDigitNumber;
    }

    const token = generateRandom4DigitNumber();
    // console.log(token);

    user.resetPasswordEmailToken = token;
    await user.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODEMAILER_ID,
        pass: process.env.NODEMAILER_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Leftovers Team" <${process.env.NODEMAILER_ID}>`,
      to: user.email,
      subject: "Important: Reset your password to use leftovers app",
      html: `<h3>Hello ${user.firstname}!</h3> <div>Thank you for reaching us! Leftovers received a request to reset password for you.</div> <div>Before we proceed, we need you to verify the email address you provided.</div> <div>Input your verification code on this app.</div> <div> Verfication code: ${user.resetPasswordEmailToken}</div> <div>Thank you,</div> <div>Leftovers team</div>`,
    });
    res.status(200).json({
      message:
        "Please check your email! and then input the verification code to reset your password now!",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/verifyEmailToResetPassword/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const user = await Auth.findOne({
      resetPasswordEmailToken: token,
    });

    if (user) {
      res
        .status(200)
        .json({ message: "Your email is verified to reset the password!" });
    } else {
      res.status(404).json("User not found!");
    }
  } catch (error) {
    res.status(500).json("Verification was not updated successfully!");
  }
});

router.post("/resetPassword/:token", async (req, res) => {
  try {
    const { password, password2 } = req.body;
    const { token: resetPasswordEmailToken } = req.params;
    if (resetPasswordEmailToken === null) {
      return res.status(400).json("You have to verify your email address!");
    }
    if (password !== password2) {
      return res.status(400).json("Password does not match");
    }
    const user = await Auth.findOne({ resetPasswordEmailToken });
    if (!user) {
      return res.status(400).json("We cannot find your account!");
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    const hash2 = bcrypt.hashSync(password2, salt);

    await Auth.findOneAndUpdate(
      { resetPasswordEmailToken },
      {
        password: hash,
        password2: hash2,
        resetPasswordEmailToken: null,
      }
    );
    res.status(200).json({ message: "Password updated successfully!" });
  } catch (error) {
    res.status(500).json("Verification was not updated successfully!");
  }
});

module.exports = router;
