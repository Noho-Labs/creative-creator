import { drizzle } from 'drizzle-orm/d1';
import type { D1Database } from '@cloudflare/workers-types';
import { getBindings } from '@/server/bindings';
import * as schema from './schema';

export function getDb(binding: D1Database = getBindings().DB) {
  return drizzle(binding, { schema });
}
