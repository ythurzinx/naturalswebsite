import mysql from "mysql2/promise";

export function databaseOptions(env) {
  if (!env.DATABASE_URL) return null;
  const url = new URL(env.DATABASE_URL);
  if (
    url.protocol !== "mysql:" ||
    !url.hostname ||
    !url.username ||
    !url.pathname.slice(1) ||
    url.search ||
    url.hash
  )
    throw Error("Invalid database configuration");
  const local = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(
    url.hostname,
  );
  if (!local && env.DATABASE_SSL === "false")
    throw Error("Remote database requires TLS");
  return {
    host: url.hostname,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    port: Number(url.port || 3306),
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 30,
    connectTimeout: 8000,
    multipleStatements: false,
    timezone: "Z",
    supportBigNumbers: true,
    bigNumberStrings: false,
    ...(!local ? { ssl: { rejectUnauthorized: true } } : {}),
  };
}
export function createDatabase(env) {
  const options = databaseOptions(env);
  if (!options) return null;
  const pool = mysql.createPool(options);
  pool.on("connection", (connection) =>
    connection.query("SET time_zone = '+00:00'"),
  );
  return pool;
}
