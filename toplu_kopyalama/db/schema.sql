-- Toplu kopyalama cədvəlləri (PostgreSQL).
-- Mövcud məhsul cədvəlinə toxunmur; maya və təchizatçı botun mövcud sahələrinə
-- Repository.set_cost_and_supplier vasitəsilə yazılır.
-- CLI: mövcud miqrasiya alətinə (Alembic və s.) köçürsün.

CREATE TABLE IF NOT EXISTS bulk_copy_jobs (
    id              BIGSERIAL PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      TEXT,
    source_type     TEXT NOT NULL,                 -- whatsapp | telegram | pdf | link
    source_ref      TEXT NOT NULL,                 -- qrup adı / pdf adı / link
    stock_filter    TEXT NOT NULL,                 -- only_inactive (rəqibsiz) | only_active (rəqibli) | both
    merchant_id     TEXT NOT NULL,                 -- işin başladıldığı mağaza paneli (məs. Trendify)
    sale_pct        NUMERIC(6,2) NOT NULL DEFAULT 110,
    discount_pct    NUMERIC(6,2) NOT NULL DEFAULT 40,
    upper_limit_pct NUMERIC(6,2) NOT NULL DEFAULT 100,
    days_back       INT NOT NULL DEFAULT 15,
    item_limit      INT,                           -- ilk sınaq üçün 3
    status          TEXT NOT NULL DEFAULT 'running',  -- running | paused_captcha | done | failed
    stats           JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS bulk_copy_items (
    id              BIGSERIAL PRIMARY KEY,
    job_id          BIGINT NOT NULL REFERENCES bulk_copy_jobs(id) ON DELETE CASCADE,
    source_ref      TEXT NOT NULL,
    supplier        TEXT NOT NULL,
    posted_at       TIMESTAMPTZ,
    text            TEXT,
    image_paths     TEXT[] NOT NULL DEFAULT '{}',
    mpns            TEXT[] NOT NULL DEFAULT '{}',
    cost            NUMERIC(12,2),
    cost_uncertain  BOOLEAN NOT NULL DEFAULT false,
    state           TEXT NOT NULL DEFAULT 'pending',
    note            TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (job_id, source_ref)
);

CREATE TABLE IF NOT EXISTS bulk_copy_candidates (
    id              BIGSERIAL PRIMARY KEY,
    item_id         BIGINT NOT NULL REFERENCES bulk_copy_items(id) ON DELETE CASCADE,
    url             TEXT NOT NULL,
    sku             TEXT NOT NULL,
    title           TEXT,
    sku_status      TEXT NOT NULL,                 -- active | inactive | unknown
    score           NUMERIC(4,3) NOT NULL,
    reasons         TEXT[] NOT NULL DEFAULT '{}',
    merchant_id     TEXT,
    state           TEXT NOT NULL,                 -- needs_approval | copying | copied | skipped | failed | rejected
    note            TEXT,
    product_id      TEXT,                          -- botdakı məhsul id (kopyalandıqdan sonra)
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (item_id, sku)
);

CREATE INDEX IF NOT EXISTS ix_bcc_state ON bulk_copy_candidates(state);
CREATE INDEX IF NOT EXISTS ix_bcc_merchant_sku ON bulk_copy_candidates(merchant_id, sku);
CREATE INDEX IF NOT EXISTS ix_bci_job_state ON bulk_copy_items(job_id, state);

-- Təsdiq paneli üçün görünüş
CREATE OR REPLACE VIEW bulk_copy_approval_queue AS
SELECT c.id AS candidate_id, i.job_id, i.supplier, i.cost, i.cost_uncertain, i.text,
       i.image_paths, c.url, c.sku, c.title, c.sku_status, c.score, c.reasons,
       c.merchant_id, c.note, c.updated_at
FROM bulk_copy_candidates c
JOIN bulk_copy_items i ON i.id = c.item_id
WHERE c.state = 'needs_approval'
ORDER BY c.updated_at;
