const mongoose = require("mongoose")

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  tasks: [
    {
      startTime: String,
      endTime: String,
      planTask: String,
      actualTask: String,
      category: String,
      duration: Number,
    },
  ],
  summary: {
    totalPlannedTime: Number,
    totalActualTime: Number,
    efficiency: Number,
    categories: Object,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

// Update the updatedAt field before saving
taskSchema.pre("save", function (next) {
  this.updatedAt = Date.now()
  next()
})

module.exports = mongoose.model("Task", taskSchema)
