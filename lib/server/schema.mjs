export const schema = [
  `CREATE TABLE IF NOT EXISTS mn_products (id VARCHAR(80) PRIMARY KEY, name VARCHAR(160) NOT NULL, category VARCHAR(100) NOT NULL, weight_label VARCHAR(80) NOT NULL, is_bulk TINYINT NOT NULL, sale_cents INT UNSIGNED NOT NULL, cost_cents INT UNSIGNED NULL, active TINYINT NOT NULL DEFAULT 1, image_sha CHAR(64) NULL, updated_at BIGINT NOT NULL) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS mn_images (id CHAR(64) PRIMARY KEY, data MEDIUMBLOB NOT NULL, byte_length INT UNSIGNED NOT NULL, created_at BIGINT NOT NULL) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS mn_orders (id VARCHAR(80) PRIMARY KEY, reference VARCHAR(80) NOT NULL, total_cents INT UNSIGNED NOT NULL, paid_cents INT UNSIGNED NOT NULL DEFAULT 0, refunded_cents INT UNSIGNED NULL, fee_cents INT UNSIGNED NULL, cost_total_cents BIGINT UNSIGNED NULL, state VARCHAR(20) NOT NULL, provider_status VARCHAR(80) NOT NULL, customer_name VARCHAR(160) NOT NULL DEFAULT '', customer_email VARCHAR(180) NOT NULL DEFAULT '', fulfillment_status VARCHAR(20) NOT NULL DEFAULT 'new', provider_updated_at BIGINT NOT NULL, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, INDEX mn_orders_created (created_at), INDEX mn_orders_state (state)) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS mn_order_items (order_id VARCHAR(80) NOT NULL, line_key VARCHAR(100) NOT NULL, product_id VARCHAR(80) NOT NULL, title VARCHAR(220) NOT NULL, quantity INT UNSIGNED NOT NULL, weight_grams INT UNSIGNED NOT NULL, unit_cents INT UNSIGNED NOT NULL, cost_unit_cents INT UNSIGNED NULL, PRIMARY KEY(order_id,line_key), CONSTRAINT mn_items_order FOREIGN KEY(order_id) REFERENCES mn_orders(id)) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS mn_expenses (id CHAR(36) PRIMARY KEY, description VARCHAR(180) NOT NULL, amount_cents INT UNSIGNED NOT NULL, incurred_at BIGINT NOT NULL, created_at BIGINT NOT NULL, deleted_at BIGINT NULL, INDEX mn_expenses_date (incurred_at)) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS mn_admin_sessions (token_hash CHAR(64) PRIMARY KEY, created_at BIGINT NOT NULL, last_seen BIGINT NOT NULL, expires_at BIGINT NOT NULL) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS mn_admin_limits (bucket VARCHAR(100) PRIMARY KEY, hits INT UNSIGNED NOT NULL, expires_at BIGINT NOT NULL) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS mn_admin_totp (step BIGINT PRIMARY KEY) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS mn_audit (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, event VARCHAR(80) NOT NULL, entity_id VARCHAR(100) NOT NULL, details TEXT NOT NULL, created_at BIGINT NOT NULL) ENGINE=InnoDB`,
];
export async function migrate(pool) {
  for (const statement of schema) await pool.query(statement);
}
