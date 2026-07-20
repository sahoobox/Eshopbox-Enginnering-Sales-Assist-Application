CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Sales rep',
  password_hash TEXT,
  invited_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  is_active INTEGER DEFAULT 1,
  zoho_refresh_token TEXT
);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  accepted INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS deal_form_data (
  deal_id TEXT PRIMARY KEY,
  zoho_id TEXT NOT NULL,
  prospect_name TEXT,
  prospect_email TEXT,
  brand_name TEXT,
  order_volume TEXT,
  product_category TEXT,
  solution_interest TEXT,
  demo_format TEXT,
  meeting_location TEXT,
  dm_present TEXT,
  brand_type TEXT,
  procurement_involved TEXT,
  champion_strength TEXT,
  oms TEXT,
  shopping_cart TEXT,
  shipping_setup TEXT,
  warehousing_setup TEXT,
  shipping_pains TEXT,
  warehousing_pains TEXT,
  shipping_pain_other TEXT,
  warehousing_pain_other TEXT,
  pain_clarity TEXT,
  engagement_level TEXT,
  objections TEXT,
  competitor_mentioned TEXT,
  budget_signal TEXT,
  purchase_timeline TEXT,
  next_step TEXT,
  followup_meeting_date TEXT,
  urgency_driver TEXT,
  pricing_raised TEXT,
  features_shown TEXT,
  rep_notes TEXT,
  rep_name TEXT,
  rep_email TEXT,
  grade TEXT,
  score INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  ai_analysis TEXT,
  transcript TEXT,
  deal_summary TEXT
);

CREATE TABLE IF NOT EXISTS deal_emails (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  email_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_for TEXT,
  sent_at TEXT,
  zoho_message_id TEXT,
  rep_email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  reminder_sent INTEGER DEFAULT 0,
  zoho_task_id TEXT
);

CREATE TABLE IF NOT EXISTS deal_notes (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  content TEXT NOT NULL,
  author_email TEXT,
  author_name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

ALTER TABLE users ADD COLUMN gmail_signature TEXT;

CREATE TABLE IF NOT EXISTS lead_deal_mapping (
  lead_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  contact_email TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (deal_id)
);

CREATE INDEX IF NOT EXISTS idx_ldm_lead_id
  ON lead_deal_mapping(lead_id);
CREATE INDEX IF NOT EXISTS idx_ldm_email
  ON lead_deal_mapping(contact_email);

CREATE TABLE IF NOT EXISTS action_log (
  id TEXT PRIMARY KEY,
  lead_id TEXT,
  deal_id TEXT,
  actor_email TEXT NOT NULL,
  actor_name TEXT,
  action TEXT NOT NULL,
  details TEXT,
  success INTEGER DEFAULT 1,
  error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_al_lead
  ON action_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_al_deal
  ON action_log(deal_id);
CREATE INDEX IF NOT EXISTS idx_al_actor
  ON action_log(actor_email);
CREATE INDEX IF NOT EXISTS idx_al_created
  ON action_log(created_at);
