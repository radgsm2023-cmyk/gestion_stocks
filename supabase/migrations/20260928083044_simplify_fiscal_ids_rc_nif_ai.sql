/*
# Simplifier les identifiants fiscaux : RC, NIF, AI uniquement

## Description
1. Ajoute la colonne `ai` (Article d'Imposition) à la table customers
2. Supprime les colonnes `patente` et `cnss` de app_settings (non utilisés)
3. Ajoute la colonne `ai` à app_settings
*/

-- ===== Ajouter AI aux clients =====
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'ai') THEN
    ALTER TABLE customers ADD COLUMN ai text DEFAULT '';
  END IF;
END $$;

-- ===== Nettoyer app_settings : ajouter AI, supprimer patente et cnss =====
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'ai') THEN
    ALTER TABLE app_settings ADD COLUMN ai text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Supprimer patente et cnss de app_settings
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'patente') THEN
    ALTER TABLE app_settings DROP COLUMN patente;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'cnss') THEN
    ALTER TABLE app_settings DROP COLUMN cnss;
  END IF;
END $$;

-- ===== Nettoyer customers : supprimer patente et cnss =====
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'patente') THEN
    ALTER TABLE customers DROP COLUMN patente;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'cnss') THEN
    ALTER TABLE customers DROP COLUMN cnss;
  END IF;
END $$;
