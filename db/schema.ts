import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

// ponytail: this file mirrors 0001_init.sql for typed queries. Migration source of truth is the SQL file.

export const companies = sqliteTable('companies', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  gstin: text('gstin').notNull(),
  address: text('address').notNull().default(''),
  stateCode: text('state_code').notNull().default(''),
  phone: text('phone').notNull().default(''),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const parties = sqliteTable('parties', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role', { enum: ['customer', 'supplier', 'both'] }).notNull(),
  gstin: text('gstin'),
  phone: text('phone'),
  address: text('address').notNull().default(''),
  stateCode: text('state_code').notNull().default(''),
  openingCash: integer('opening_cash').notNull().default(0),
  openingMetalMg: integer('opening_metal_mg').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const items = sqliteTable('items', {
  id: integer('id').primaryKey(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  category: text('category', { enum: ['gold', 'silver', 'stone', 'artificial'] }).notNull(),
  unit: text('unit', { enum: ['gms', 'carat', 'pcs'] }).notNull(),
  stamp: text('stamp'),
  hsn: text('hsn').notNull().default(''),
  gstBp: integer('gst_bp').notNull().default(300),
  labourMode: text('labour_mode', { enum: ['pct', 'per_gram', 'per_pcs'] }).notNull(),
  labourValue: integer('labour_value').notNull().default(0),
  wastageMode: text('wastage_mode', { enum: ['pct', 'per_gram', 'per_pcs'] }).notNull(),
  wastageValue: integer('wastage_value').notNull().default(0),
  stockQty: integer('stock_qty').notNull().default(0),
  stockWtMg: integer('stock_wt_mg').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey(),
  ts: integer('ts').notNull(),
  actor: text('actor').notNull().default('system'),
  entity: text('entity').notNull(),
  entityId: integer('entity_id'),
  action: text('action').notNull(),
  before: text('before'),
  after: text('after'),
});
