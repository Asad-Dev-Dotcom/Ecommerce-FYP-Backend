import mongoose from "mongoose";
import { getEnv } from "./config.js";

// connect mongodb
// --------------
export const connectDB = async (

  dbUrl = getEnv("MONGODB_URL"),
  dbName = getEnv("MONGODB_NAME")
) =>
{
  try
  {
    const res = await mongoose.connect(dbUrl, { dbName });
    if (res?.connection?.readyState === 1)
    {
      console.log(
        `Connected to ${res?.connection?.db?.databaseName} successfully`
      );
      return res;
    } else
    {
      console.log("Connection failed...");
      mongoose.connection.close();
    }
  } catch (error)
  {
    console.log("Connection failed...", error);
    mongoose.connection.close();
  }
};
