module.exports = {
  apps: [
    {
      name: "task-manager-api",
      script: "server.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "development",
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      // Logging
      log_file: "./logs/combined.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Auto restart
      watch: false,
      ignore_watch: ["node_modules", "logs"],

      // Memory management
      max_memory_restart: "1G",

      // Health monitoring
      min_uptime: "10s",
      max_restarts: 10,

      // Environment variables
      env_file: ".env",
    },
  ],
}
