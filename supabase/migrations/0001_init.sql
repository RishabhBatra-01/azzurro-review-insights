-- Azzurro review insights — initial schema.
-- Source-of-truth review data is kept separate from derived classifications
-- so the classifier can be re-run without touching collected facts.

create table if not exists property (
  id                bigserial primary key,
  slug              text not null unique,          -- booking.com URL slug: stable identity
  assessment_label  text not null,                 -- label used in the brief
  display_name      text not null,                 -- live name on booking.com
  booking_hotel_id  bigint,                        -- numeric id used by the GraphQL API
  url               text not null,
  created_at        timestamptz not null default now()
);

create table if not exists review (
  id                   bigserial primary key,
  property_id          bigint not null references property(id) on delete cascade,

  -- Stable id from booking.com (reviewUrl). Verified unique per review in M1.
  external_id          text not null,

  reviewer_name        text,
  reviewer_country     text,
  reviewer_country_code text,
  guest_type           text,

  room_type            text,
  num_nights           integer,
  checkin_date         date,
  checkout_date        date,
  stay_status          text,

  review_score         numeric(3,1),               -- nullable: score-less reviews exist
  title                text,
  positive_text        text,
  negative_text        text,
  lang                 text,
  partner_reply        text,
  helpful_votes        integer not null default 0,

  reviewed_at          timestamptz not null,       -- from unix timestamp

  -- Week bucketing happens in Sydney time. Generated in the database so every
  -- consumer agrees on which week a review belongs to.
  reviewed_on_sydney   date not null
    generated always as (((reviewed_at at time zone 'Australia/Sydney'))::date) stored,

  source               text not null default 'booking.com',
  first_seen_at        timestamptz not null default now(),
  last_seen_at         timestamptz not null default now(),

  constraint review_unique_per_property unique (property_id, external_id),
  constraint review_score_range check (review_score is null or (review_score >= 0 and review_score <= 10)),
  constraint review_source_known check (source in ('booking.com', 'fixture'))
);

create index if not exists review_property_date_idx on review (property_id, reviewed_on_sydney desc);
create index if not exists review_date_idx on review (reviewed_on_sydney desc);

-- Derived classifications. Safe to delete and rebuild from review text.
create table if not exists review_topic (
  review_id    bigint not null references review(id) on delete cascade,
  topic        text not null,
  polarity     text not null check (polarity in ('positive', 'negative')),
  matched_term text,
  primary key (review_id, topic, polarity)
);

create index if not exists review_topic_lookup_idx on review_topic (topic, polarity);

-- Provenance: every collection attempt is recorded, success or failure.
create table if not exists collection_run (
  id                bigserial primary key,
  property_id       bigint references property(id) on delete set null,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  status            text not null check (status in ('ok', 'partial', 'failed')),
  reviews_seen      integer not null default 0,
  reviews_inserted  integer not null default 0,
  reviews_updated   integer not null default 0,
  error             text
);

-- No anonymous access. All reads and writes go through the server using the
-- secret key; the browser never talks to Supabase directly.
alter table property       enable row level security;
alter table review         enable row level security;
alter table review_topic   enable row level security;
alter table collection_run enable row level security;
