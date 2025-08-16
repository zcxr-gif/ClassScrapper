// database.mjs
import sqlite3 from "sqlite3";
import { open } from "sqlite";

// All cached data will be considered stale after 24 hours.
const CACHE_DURATION_HOURS = 24;

/**
 * Sets up the SQLite database connection and creates the cache table if it doesn't exist.
 * @returns {Promise<Database>} A promise that resolves to the database instance.
 */
export async function setupDatabase() {
  const db = await open({
    filename: "./course_cache.sqlite", // The database will be stored in this file
    driver: sqlite3.Database,
  });

  // This table will store all our cached data as key-value pairs.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      data TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

/**
 * Retrieves fresh data from the cache for a given key.
 * @param {Database} db The database instance.
 * @param {string} key The unique key for the cached item.
 * @returns {Promise<any|null>} The parsed data or null if it's stale or doesn't exist.
 */
export async function getFromCache(db, key) {
  const cacheStaleTime = new Date(Date.now() - CACHE_DURATION_HOURS * 60 * 60 * 1000).toISOString();
  const row = await db.get(
    "SELECT data FROM cache WHERE key = ? AND timestamp > ?",
    [key, cacheStaleTime]
  );
  return row ? JSON.parse(row.data) : null;
}

/**
 * Saves data to the cache with a specific key. It overwrites any existing data for that key.
 * @param {Database} db The database instance.
 * @param {string} key The unique key for the item.
 * @param {any} data The data to be stored (will be stringified).
 */
export async function saveToCache(db, key, data) {
  // This command will INSERT a new row or, if the key already exists, UPDATE it.
  const query = `
    INSERT INTO cache (key, data, timestamp) 
    VALUES (?, ?, CURRENT_TIMESTAMP) 
    ON CONFLICT(key) DO UPDATE SET 
      data = excluded.data, 
      timestamp = CURRENT_TIMESTAMP
  `;
  await db.run(query, [key, JSON.stringify(data)]);
}