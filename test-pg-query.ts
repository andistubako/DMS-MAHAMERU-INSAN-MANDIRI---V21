import { sqlDb } from './src/db/index.js';
import { outlets as pgOutlets } from './src/db/schema.js';
import { eq, ilike, and, or, desc, sql } from 'drizzle-orm';
// Test drizzle logic
