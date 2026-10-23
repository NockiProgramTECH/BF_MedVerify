-- Le coeur du projet. Recoit des EMPREINTES (calculees par l'API), jamais le code ni le numero.
create or replace function verifier_code(
  p_code_hash text,
  p_tel_hash  text,
  p_canal     text default 'SMS'
) returns json
language plpgsql
as $$
declare
  c        record;
  v_res    text;
  v_nb     int;
  v_alerte text := null;
begin
  -- 1) Anti-spam : 5 demandes par minute et par telephone
  select count(*) into v_nb from verification
   where tel_hash = p_tel_hash and date_heure > now() - interval '1 minute';
  if v_nb >= 5 then
    insert into verification (code_hash, tel_hash, canal, resultat)
    values (p_code_hash, p_tel_hash, p_canal, 'LIMITE');
    return json_build_object('resultat', 'LIMITE');
  end if;

  -- 2) Recherche du code. FOR UPDATE verrouille la ligne : si deux telephones
  --    envoient le meme code en meme temps, un seul peut etre "premier".
  select cs.id_code, cs.statut, cs.premier_tel_hash, cs.date_premiere_verification,
         l.numero_lot, l.date_expiration, l.statut as statut_lot, p.nom, p.dosage
    into c
    from code_securite cs
    join lot l     on l.id_lot = cs.id_lot
    join produit p on p.id_produit = l.id_produit
   where cs.code_hash = p_code_hash
     for update of cs;

  if not found then                                   -- code bien forme mais inconnu
    insert into verification (id_code, code_hash, tel_hash, canal, resultat)
    values (null, p_code_hash, p_tel_hash, p_canal, 'INCONNU');
    select count(*) into v_nb from verification
     where resultat = 'INCONNU' and date_heure > now() - interval '24 hours';
    if v_nb >= 3 and not exists (select 1 from alerte where type = 'CODES_INCONNUS'
                                  and date_heure > now() - interval '24 hours') then
      v_alerte := v_nb || ' codes inconnus en 24 h';
      insert into alerte (type, detail) values ('CODES_INCONNUS', v_alerte);
    end if;
    return json_build_object('resultat', 'INCONNU', 'alerte', v_alerte);
  end if;

  if c.statut = 'REVOQUE' or c.statut_lot = 'RAPPELE' then
    v_res := 'REVOQUE';
  elsif c.date_expiration < current_date then
    v_res := 'EXPIRE';
  elsif c.statut = 'NON_UTILISE' then                 -- premiere verification
    update code_securite
       set statut = 'UTILISE', date_premiere_verification = now(), premier_tel_hash = p_tel_hash
     where id_code = c.id_code;
    v_res := 'VRAI';
  elsif c.premier_tel_hash = p_tel_hash then          -- le meme telephone re-verifie
    v_res := 'VRAI';
  else
    v_res := 'DEJA_UTILISE';                          -- un AUTRE telephone
  end if;

  insert into verification (id_code, code_hash, tel_hash, canal, resultat)
  values (c.id_code, p_code_hash, p_tel_hash, p_canal, v_res);

  -- 3) Alerte : un meme code verifie par au moins 3 telephones differents
  if v_res = 'DEJA_UTILISE' then
    select count(distinct tel_hash) into v_nb from verification
     where id_code = c.id_code and resultat in ('VRAI', 'DEJA_UTILISE');
    if v_nb >= 3 and not exists (select 1 from alerte
                                  where type = 'CODE_COPIE_PROBABLE' and id_code = c.id_code) then
      v_alerte := v_nb || ' telephones differents';
      insert into alerte (type, id_code, detail) values ('CODE_COPIE_PROBABLE', c.id_code, v_alerte);
    end if;
  end if;

  return json_build_object('resultat', v_res, 'produit', c.nom, 'dosage', c.dosage,
                           'lot', c.numero_lot, 'expiration', c.date_expiration,
                           'date_premiere', c.date_premiere_verification, 'alerte', v_alerte);
end $$;
