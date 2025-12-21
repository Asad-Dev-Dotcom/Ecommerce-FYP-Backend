import { server, io } from "./src/app.js";
import { getEnv } from "./src/configs/config.js";
import { connectDB } from "./src/configs/connectDb.js";
import { configureCloudinary } from "./src/utils/cloudinary.js";
import { initNotificationWatcher } from "./src/utils/notificationWatcher.js";

console.log("hello")

const port = getEnv("PORT");

(async () =>
{
  await configureCloudinary();
  await connectDB(getEnv("MONGODB_URL"));
  // await initNotificationWatcher(io);
  server.listen(port, () =>
  {
    console.log(`Server running on port ${port}`);
  });
})();
