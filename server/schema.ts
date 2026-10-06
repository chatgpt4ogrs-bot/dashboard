/** Esquema idempotente: roda a cada inicialização e só cria o que ainda não existe. */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS app_meta (
  key   text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  name          text,
  role          text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz,
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS condominiums (
  id         uuid PRIMARY KEY,
  name       text NOT NULL,
  address    text,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipments (
  id                  uuid PRIMARY KEY,
  condominium_id      uuid NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
  name                text NOT NULL,
  brand               text NOT NULL,
  type                text,
  host                text NOT NULL,
  port                integer NOT NULL,
  use_https           boolean NOT NULL DEFAULT false,
  username            text NOT NULL,
  password            text NOT NULL DEFAULT '',
  notes               text,
  model               text,
  firmware            text,
  serial              text,
  mac                 text,
  installed_at        date,
  last_maintenance_at date,
  responsible         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS equipments_condominium_id_idx ON equipments (condominium_id);
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS management_sync text;

-- Sem chave estrangeira: o histórico permanece após a exclusão do equipamento.
CREATE TABLE IF NOT EXISTS equipment_events (
  seq          bigserial PRIMARY KEY,
  id           uuid NOT NULL UNIQUE,
  equipment_id uuid NOT NULL,
  type         text NOT NULL,
  at           timestamptz NOT NULL,
  actor_id     uuid,
  actor_email  text,
  actor_name   text,
  status       text,
  latency_ms   integer,
  detail       text,
  duration_ms  bigint
);
CREATE INDEX IF NOT EXISTS equipment_events_equipment_at_idx ON equipment_events (equipment_id, at DESC, seq DESC);
CREATE INDEX IF NOT EXISTS equipment_events_at_idx ON equipment_events (at);

-- Estado do monitor (última verificação, verificações da última hora e agregados de 24h).
CREATE TABLE IF NOT EXISTS monitor_states (
  equipment_id uuid PRIMARY KEY REFERENCES equipments(id) ON DELETE CASCADE,
  state        jsonb NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipment_reboots (
  id           bigserial PRIMARY KEY,
  equipment_id uuid NOT NULL REFERENCES equipments(id) ON DELETE CASCADE,
  at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS equipment_reboots_at_idx ON equipment_reboots (at);

INSERT INTO app_meta (key, value) VALUES ('schema_version', '1') ON CONFLICT (key) DO NOTHING;
`;
