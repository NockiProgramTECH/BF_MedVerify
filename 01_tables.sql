-- BF-MedVerify V2 : les tables (a coller dans Supabase > SQL Editor, puis Run)

create table produit (
  id_produit    serial primary key,
  nom           text not null,
  dci           text,               -- denomination commune internationale
  laboratoire   text,               -- fabricant (nomenclature nationale)
  titulaire_amm text,               -- titulaire de l'AMM (nomenclature)
  code_amm      text,               -- code AMM de la nomenclature
  dosage        text,
  forme         text
);

create table lot (
  id_lot          serial primary key,
  id_produit      int not null references produit(id_produit),
  numero_lot      text not null,
  date_fabrication date,
  date_expiration  date not null,
  statut          text not null default 'ACTIF'
                  check (statut in ('ACTIF', 'RAPPELE')),   -- RAPPELE = lot retire
  unique (id_produit, numero_lot)
);

create table code_securite (
  id_code      serial primary key,
  id_lot       int not null references lot(id_lot),
  code_hash    char(64) not null unique,      -- empreinte du code, JAMAIS le code
  statut       text not null default 'NON_UTILISE'
               check (statut in ('NON_UTILISE', 'UTILISE', 'REVOQUE')),
  date_premiere_verification timestamptz,
  premier_tel_hash char(64)                   -- empreinte du 1er telephone
);

create table verification (
  id_verification bigserial primary key,
  id_code     int references code_securite(id_code),   -- vide si code inconnu
  code_hash   char(64),
  date_heure  timestamptz not null default now(),
  canal       text default 'SMS',
  tel_hash    char(64) not null,                       -- empreinte, pas le numero
  resultat    text not null
);
create index on verification (tel_hash, date_heure);
create index on verification (id_code);
create index on verification (resultat, date_heure);

create table alerte (
  id_alerte  serial primary key,
  type       text not null,        -- CODE_COPIE_PROBABLE | CODES_INCONNUS
  id_code    int references code_securite(id_code),
  detail     text,
  date_heure timestamptz not null default now()
);

-- Securite : personne ne lit la base sans autorisation (RLS)
alter table produit       enable row level security;
alter table lot           enable row level security;
alter table code_securite enable row level security;
alter table verification  enable row level security;
alter table alerte        enable row level security;
