import { MongoClient, Db } from 'mongodb';

// MongoDB连接URL
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/stardata';
const MONGODB_DB = process.env.MONGODB_DB || 'stardata';

// 缓存数据库连接
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

// 连接到MongoDB数据库
export async function connectToDatabase() {
  // 如果已有缓存的连接，直接返回
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // 若没有缓存的连接，创建新连接
  if (!cachedClient) {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    cachedClient = client;
  }

  // 获取数据库实例
  const db = cachedClient.db(MONGODB_DB);
  cachedDb = db;

  return { client: cachedClient, db };
}
