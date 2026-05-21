import Redis from "ioredis";
import { config } from "./config.js";

let clientCounter = 0;

export function createRedisClient(label?: string): Redis {
  const { host, port, password } = config.redis;
  const client = new Redis({
    host,
    port,
    password,
    lazyConnect: true,
    retryStrategy: () => null,
    maxRetriesPerRequest: 1,
  });

  const name = label 
    ? `${config.queue.prefix}${label}` 
    : `${config.queue.prefix}${process.pid}-${++clientCounter}`;
    
  client.on("ready", () => {
    client.client("SETNAME", name).catch(() => {});
  });

  return client;
}

export async function withRedis<T>(
  fn: (redis: Redis) => Promise<T>,
  label?: string,
): Promise<T> {
  const redis = createRedisClient(label);
  await redis.connect();
  try {
    return await fn(redis);
  } finally {
    await redis.quit();
  }
}
