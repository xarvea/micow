CREATE TABLE IF NOT EXISTS indexed_blocks (
  chain_id BIGINT NOT NULL,
  block_number BIGINT NOT NULL,
  block_hash TEXT NOT NULL,
  parent_hash TEXT NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, block_number)
);

CREATE TABLE IF NOT EXISTS indexed_events (
  chain_id BIGINT NOT NULL,
  event_id TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  block_number BIGINT NOT NULL,
  block_hash TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  topic0 TEXT NOT NULL,
  topics JSONB NOT NULL,
  data TEXT NOT NULL,
  event_name TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, tx_hash, log_index),
  UNIQUE (chain_id, event_id)
);
CREATE INDEX IF NOT EXISTS indexed_events_block_idx ON indexed_events (chain_id, block_number);

CREATE TABLE IF NOT EXISTS tokens (
  chain_id BIGINT NOT NULL,
  token_address TEXT NOT NULL,
  market_address TEXT NOT NULL,
  creator_address TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  total_supply NUMERIC(78, 0) NOT NULL,
  metadata_uri TEXT NOT NULL,
  created_block BIGINT NOT NULL,
  PRIMARY KEY (chain_id, token_address),
  UNIQUE (chain_id, market_address)
);
CREATE INDEX IF NOT EXISTS tokens_created_block_idx ON tokens (chain_id, created_block DESC);

CREATE TABLE IF NOT EXISTS trades (
  chain_id BIGINT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  token_address TEXT NOT NULL,
  market_address TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  trader_address TEXT NOT NULL,
  amount_in NUMERIC(78, 0) NOT NULL,
  amount_out NUMERIC(78, 0) NOT NULL,
  protocol_fee NUMERIC(78, 0) NOT NULL,
  creator_fee NUMERIC(78, 0) NOT NULL,
  block_number BIGINT NOT NULL,
  block_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS trades_token_block_idx ON trades (chain_id, token_address, block_number DESC, log_index DESC);
CREATE INDEX IF NOT EXISTS trades_market_block_idx ON trades (chain_id, market_address, block_number DESC);
