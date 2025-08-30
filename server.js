const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const nodemailer = require("nodemailer")
const crypto = require("crypto")
require("dotenv").config()

const app = express()

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://daily-task-frontend-gamma.vercel.app',  // Production frontend
      'http://localhost:3000',                         // Local development
      'https://daily-task-backend-eight.vercel.app'    // Backend URL
    ]
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.'
      return callback(new Error(msg), false)
    }
    return callback(null, true)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}

// Apply CORS
app.use(cors(corsOptions))

// Handle preflight requests
app.options('*', cors(corsOptions))

// Other middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB connection error:", err));


// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
})

const User = mongoose.model("User", userSchema)


// Define task subdocument schema
const taskItemSchema = new mongoose.Schema({
  id: String,  // Changed from ObjectId to String
  startTime: String,
  endTime: String,
  planTask: String,
  actualTask: String,
  category: String,
  duration: Number
}, { _id: false });  // Disable _id for subdocuments


// Task Schema
const taskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true },
  tasks: [taskItemSchema],
    // {
    //   startTime: String,
    //   endTime: String,
    //   planTask: String,
    //   actualTask: String,
    //   category: String,
    //   duration: Number,
    // },
  // ],
  summary: {
    totalPlannedTime: Number,
    totalActualTime: Number,
    efficiency: Number,
    categories: Object,
  },
})

const Task = mongoose.model("Task", taskSchema)

// OTP Schema
const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 }, // 5 minutes
})

const OTP = mongoose.model("OTP", otpSchema)

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

// JWT Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (token == null) {
    // Let routes handle unauthenticated users, don't block here
    // This allows for public routes or routes with optional authentication
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      // If token is invalid (e.g., expired), treat as unauthenticated
      return next(); 
    }
    req.user = user
    next()
  })
}

// Routes

// Register
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body

    // Check if user exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Get current date in IST (YYYY-MM-DD format)
    const now = new Date();
    const istDate = new Date(now.getTime() + (5.5 * 60 * 60 * 1000)).toISOString().split('T')[0];

    // Create user with explicit IST date
    const user = new User({
      name,
      email,
      password: hashedPassword,
      createdAt: istDate
    })

    await user.save()

    // Generate token
    const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "24h" })

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: istDate
      },
    })
  } catch (error) {
    console.error("❌ Register error:", error);
    res.status(500).json({ error: "Server error" })
  }
})

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body

    // Find user
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" })
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" })
    }

    // Generate token
    const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "24h" })

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// Forgot Password
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body

    // Check if user exists
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({ error: "User not found" })
    }

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString()

    // Save OTP
    await OTP.findOneAndDelete({ email }) // Remove existing OTP
    const otpDoc = new OTP({ email, otp })
    await otpDoc.save()

    // Send email
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Password Reset OTP",
      html: `
        <h2>Password Reset Request</h2>
        <p>Your OTP for password reset is: <strong>${otp}</strong></p>
        <p>This OTP will expire in 5 minutes.</p>
      `,
    }

    await transporter.sendMail(mailOptions)

    res.json({ message: "OTP sent to your email" })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// Reset Password
app.post("/api/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body

    // Verify OTP
    const otpDoc = await OTP.findOne({ email, otp })
    if (!otpDoc) {
      return res.status(400).json({ error: "Invalid or expired OTP" })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update user password
    await User.findOneAndUpdate({ email }, { password: hashedPassword })

    // Delete OTP
    await OTP.findOneAndDelete({ email, otp })

    res.json({ message: "Password reset successful" })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// Get Tasks
app.get("/api/tasks/:date", authenticateToken, async (req, res) => {
  try {
    console.log("Save tasks request received:", {
      date: req.params.date,
      userId: req.user.userId,
      body: req.body
    });
    
    const { date } = req.params
    const userId = req.user.userId
    const { tasks, summary } = req.body

    if (!tasks || !Array.isArray(tasks)) {
      console.error("Invalid tasks data:", tasks);
      return res.status(400).json({ error: "Invalid tasks data" });
    }

    const result = await Task.findOneAndUpdate(
      { userId, date }, 
      { tasks, summary }, 
      { upsert: true, new: true }
    );
    
    console.log("Save successful:", result ? "Task updated" : "No task found");
    res.json({ message: "Tasks saved successfully" });
  } catch (error) {
    console.error("Error saving tasks:", error);
    res.status(500).json({ 
      error: "Server error",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
})

// Save Tasks
app.post("/api/tasks/:date", authenticateToken, async (req, res) => {
  try {
    const { date } = req.params
    const userId = req.user.userId
    const { tasks, summary } = req.body

    await Task.findOneAndUpdate({ userId, date }, { tasks, summary }, { upsert: true, new: true })

    res.json({ message: "Tasks saved successfully" })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
