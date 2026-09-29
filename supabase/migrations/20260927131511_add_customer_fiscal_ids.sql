/*
# Ajouter identifiants fiscaux aux clients

## Description
Ajoute les colonnes d'identifiants fiscaux à la table customers pour la facturation.

## Modifications
### Table `customers`
- `ice` (text) — Identifiant Commun de l'Entreprise
- `nif` (text) — Numéro d'Identification Fiscale
- `rc` (text) — Registre de Commerce
- `patente` (text) — Patente
- `cnss` (text) — CNSS
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'ice') THEN
    ALTER TABLE customers ADD COLUMN ice text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'nif') THEN
    ALTER TABLE customers ADD COLUMN nif text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'rc') THEN
    ALTER TABLE customers ADD COLUMN rc text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'patente') THEN
    ALTER TABLE customers ADD COLUMN patente text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'cnss') THEN
    ALTER TABLE customers ADD COLUMN cnss text DEFAULT '';
  END IF;
END $$;
