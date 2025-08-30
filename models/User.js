const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  createdAt: { 
    type: String, 
    default: () => {
      const now = new Date();
      // Convert to IST (UTC+5:30)
      const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      // Format as YYYY-MM-DD
      return istTime.toISOString().split('T')[0];
    }
  }
})

module.exports = mongoose.model("User", userSchema)
