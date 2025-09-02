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

// MongoDB connection helper with caching for serverless
const mongoOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 5,
};

let mongoPromise = null;
async function ensureDb() {
  // 1 = connected, 2 = connecting
  if (mongoose.connection.readyState === 1) return;
  if (!mongoPromise) {
    console.log('Connecting to MongoDB...');
    mongoPromise = mongoose.connect(process.env.MONGODB_URI, mongoOptions)
      .then((m) => {
        console.log('✅ MongoDB connected');
        return m;
      })
      .catch((err) => {
        console.error('❌ MongoDB connection error:', err);
        mongoPromise = null;
        throw err;
      });
  }
  await mongoPromise;
}

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
    await ensureDb();
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
    await ensureDb();
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
    await ensureDb();
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
    await ensureDb();
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
// {{ ... }}
// {{ ... }}
// Get Tasks for a specific date
app.get("/api/tasks/:date", authenticateToken, async (req, res) => {
  const { date } = req.params;
  const userId = req.user?.userId;

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    console.error('Invalid date format:', date);
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  if (!userId) {
    console.error('No user ID in request');
    return res.status(400).json({ error: 'Invalid user' });
  }

  try {
    await ensureDb();
    console.log('Fetching tasks for:', { userId, date });
    
    const tasks = await Task.findOne({ userId, date });
    
    if (!tasks) {
      console.log('No tasks found for date:', date);
      return res.status(200).json({ 
        message: 'No tasks found for this date',
        tasks: []
      });
    }

    // Ensure tasks.tasks is an array and transform each task
    const taskList = Array.isArray(tasks.tasks) ? tasks.tasks : [];
    
    // Transform tasks to ensure consistent structure
    const transformedTasks = taskList.map(task => ({
      id: task.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      startTime: task.startTime || '',
      endTime: task.endTime || '',
      planTask: task.planTask || '',
      actualTask: task.actualTask || '',
      category: task.category || 'Default',
      duration: typeof task.duration === 'number' ? task.duration : 0
    }));

    console.log(`Found ${transformedTasks.length} tasks for date:`, date);
    
    res.json({
      tasks: transformedTasks,
      summary: tasks.summary || {
        totalPlannedTime: 0,
        totalActualTime: 0,
        efficiency: 0,
        categories: {}
      }
    });
    
  } catch (error) {
    console.error('Error fetching tasks:', {
      error: error.message,
      name: error.name,
      stack: error.stack,
      userId,
      date
    });

    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Failed to fetch tasks. Please try again.'
      : error.message;

    res.status(500).json({ 
      error: errorMessage,
      ...(process.env.NODE_ENV !== 'production' && { details: error.message })
    });
  }
});

// {{ ... }}
// {{ ... }}
// Save Tasks
app.post("/api/tasks/:date", authenticateToken, async (req, res) => {
  const { date } = req.params;
  const userId = req.user?.userId;
  const { tasks, summary } = req.body;

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    console.error('Invalid date format:', date);
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  // Validate required fields
  if (!userId) {
    console.error('No user ID in request');
    return res.status(400).json({ error: 'Invalid user' });
  }

  if (!tasks || !Array.isArray(tasks)) {
    console.error('Invalid tasks data:', { tasks });
    return res.status(400).json({ error: 'Tasks must be an array' });
  }

  try {
    await ensureDb();
    console.log('Saving tasks:', {
      userId,
      date,
      taskCount: tasks.length,
      hasSummary: !!summary,
      firstTask: tasks[0]
    });

    // Transform tasks to ensure they have all required fields
    const transformedTasks = tasks.map(task => ({
      id: task.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      startTime: task.startTime || '',
      endTime: task.endTime || '',
      planTask: task.planTask || '',
      actualTask: task.actualTask || '',
      category: task.category || 'Default',
      duration: typeof task.duration === 'number' ? task.duration : 0
    }));

    const result = await Task.findOneAndUpdate(
      { userId, date },
      { 
        userId,
        date,
        tasks: transformedTasks,
        summary: {
          totalPlannedTime: summary?.totalPlannedTime || 0,
          totalActualTime: summary?.totalActualTime || 0,
          efficiency: summary?.efficiency || 0,
          categories: summary?.categories || {}
        }
      },
      { 
        upsert: true, 
        new: true, 
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );
    
    if (!result) {
      console.error('No result from database operation');
      throw new Error('Failed to save tasks');
    }

    console.log('Successfully saved tasks for user:', userId);
    res.json({ message: "Tasks saved successfully" });
  } catch (error) {
    console.error('Error in /api/tasks:', {
      error: error.message,
      name: error.name,
      stack: error.stack,
      userId,
      date,
      taskCount: tasks?.length,
      hasSummary: !!summary
    });

    if (error.name === 'ValidationError') {
      const errors = {};
      Object.keys(error.errors).forEach(key => {
        errors[key] = error.errors[key].message;
      });
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors 
      });
    }

    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Failed to save tasks. Please try again.'
      : error.message;

    res.status(500).json({ 
      error: errorMessage,
      ...(process.env.NODE_ENV !== 'production' && { details: error.message })
    });
  }
});
// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() })
})

// Export app for Vercel serverless; run locally otherwise
if (process.env.VERCEL) {
  module.exports = app;
} else {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
