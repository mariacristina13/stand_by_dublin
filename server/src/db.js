import 'dotenv/config';
import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set (copy .env.example to .env)');
  process.exit(1);
}

export const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();

export const db = client.db(process.env.DB_NAME || 'lockride');
export const reports = db.collection('theft_reports');
export const spots = db.collection('parking_spots');
