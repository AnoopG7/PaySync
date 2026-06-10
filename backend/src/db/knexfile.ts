import type { Knex } from 'knex'
import dotenv from 'dotenv'

dotenv.config()

const isSQLite = (process.env.DB_TYPE || 'sqlite') === 'sqlite'

const config: Knex.Config = isSQLite
  ? {
      client: 'better-sqlite3',
      connection: { filename: './data/paysync.db' },
      useNullAsDefault: true,
      migrations: { directory: './src/db/migrations', extension: 'ts' },
      seeds: { directory: './src/db/seeds', extension: 'ts' },
    }
  : {
      client: 'mysql2',
      connection: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      },
      migrations: { directory: './src/db/migrations' },
      seeds: { directory: './src/db/seeds' },
    }

export default config
