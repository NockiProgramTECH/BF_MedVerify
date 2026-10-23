-- Donnees de TEST (faux labos, faux codes AMM) : aucune vraie donnee de la nomenclature
insert into produit (nom, dci, laboratoire, titulaire_amm, code_amm, dosage, forme) values
 ('Paracetamol-Test', 'Paracetamol', 'LABO-TEST-A', 'LABO-TEST-A', 'TEST-0001', '500 mg', 'Comprime'),
 ('Amoxicilline-Test', 'Amoxicilline', 'LABO-TEST-B', 'LABO-TEST-B', 'TEST-0002', '500 mg', 'Gelule'),
 ('Artemether-Lumefantrine-Test', 'Artemether-Lumefantrine', 'LABO-TEST-C', 'LABO-TEST-C', 'TEST-0003', '20/120 mg', 'Comprime');

insert into lot (id_produit, numero_lot, date_fabrication, date_expiration) values
 (1, 'L24A17', '2026-01-15', '2028-03-31'),
 (2, 'L24B02', '2026-02-10', '2028-02-28'),
 (3, 'L24C09', '2026-03-05', '2027-12-31'),
 (1, 'L23Z99', '2024-01-10', '2025-12-31');   -- lot 4 deja expire, pour tester
