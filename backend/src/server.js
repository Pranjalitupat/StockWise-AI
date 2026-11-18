import app from './app.js';
import { connectDB } from './config/db.js';
import { assertRequiredEnv, env } from './config/env.js';

async function start() {
  try {
    assertRequiredEnv();
    await connectDB();
    app.listen(env.port, () => {
      console.log(`StockWise API running on http://localhost:${env.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
