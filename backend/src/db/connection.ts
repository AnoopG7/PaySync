import knexLib, { Knex } from 'knex'
import config from './knexfile.js'

const db: Knex = knexLib(config)

export default db
