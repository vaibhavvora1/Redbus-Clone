import mongoose from "mongoose";
import dns from "node:dns";

const connectDB = async () => {
  try {
    try {
      dns.setServers(["8.8.8.8", "1.1.1.1"]);
    } catch {
      // ignore in environments where custom DNS is restricted
    }
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.info(`MongoDB connected to database: ${conn.connection.name}`);
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};

export default connectDB;
