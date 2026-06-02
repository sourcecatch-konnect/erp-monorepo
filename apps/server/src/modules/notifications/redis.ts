type RedisConnectionOptions = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  maxRetriesPerRequest: null;
};

export const getRedisConnectionOptions = (): RedisConnectionOptions => {
  const redisUrl = new URL(process.env.REDIS_URL || "redis://localhost:6379");
  const db = redisUrl.pathname ? Number(redisUrl.pathname.slice(1)) : undefined;

  return {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    username: redisUrl.username || undefined,
    password: redisUrl.password || undefined,
    db: Number.isFinite(db) ? db : undefined,
    maxRetriesPerRequest: null,
  };
};
