import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('users', (t) => {
    t.increments('id')
    t.string('first_name', 100).notNullable()
    t.string('last_name', 100).notNullable()
    t.string('email', 255).notNullable().unique()
    t.string('password_hash', 255).notNullable()
    t.enu('role', ['admin', 'manager', 'staff']).notNullable().defaultTo('staff')
    t.string('region', 50).notNullable().defaultTo('us-east-1')
    t.timestamps(true, true)
  })

  await knex.schema.createTable('transactions', (t) => {
    t.increments('id')
    t.string('txn_id', 20).notNullable().unique()
    t.decimal('amount', 12, 2).notNullable()
    t.string('currency', 3).defaultTo('USD')
    t.enu('status', ['completed', 'pending', 'processing', 'failed']).notNullable().defaultTo('pending')
    t.enu('type', ['payment', 'refund', 'payout', 'transfer']).notNullable()
    t.string('merchant', 255).notNullable()
    t.string('region', 50).notNullable()
    t.timestamp('timestamp').defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('tasks', (t) => {
    t.increments('id')
    t.string('task_id', 20).notNullable().unique()
    t.string('title', 255).notNullable()
    t.text('description')
    t.string('assignee', 255).notNullable()
    t.enu('priority', ['low', 'medium', 'high', 'critical']).notNullable().defaultTo('medium')
    t.enu('status', ['pending', 'in_progress', 'completed']).notNullable().defaultTo('pending')
    t.date('due_date').notNullable()
    t.string('created_by', 255).notNullable()
    t.timestamps(true, true)
  })

  await knex.schema.createTable('alerts', (t) => {
    t.increments('id')
    t.string('alert_id', 20).notNullable().unique()
    t.enu('type', ['cpu', 'memory', 'disk', 'network', 'application', 'security']).notNullable()
    t.enu('severity', ['info', 'warning', 'critical']).notNullable().defaultTo('info')
    t.text('message').notNullable()
    t.string('region', 50).notNullable()
    t.timestamp('timestamp').defaultTo(knex.fn.now())
    t.boolean('acknowledged').defaultTo(false)
  })

  await knex.schema.createTable('regions', (t) => {
    t.string('id', 50).primary()
    t.string('name', 255).notNullable()
    t.enu('status', ['healthy', 'degraded', 'offline']).notNullable().defaultTo('healthy')
    t.integer('instances').defaultTo(0)
    t.integer('load_pct').defaultTo(0)
    t.integer('latency_ms').defaultTo(0)
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('alerts')
  await knex.schema.dropTableIfExists('tasks')
  await knex.schema.dropTableIfExists('transactions')
  await knex.schema.dropTableIfExists('regions')
  await knex.schema.dropTableIfExists('users')
}
