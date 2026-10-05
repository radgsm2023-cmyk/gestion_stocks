/*
# Ajout logo et second téléphone dans app_settings

## Description
Ajoute deux colonnes à la table `app_settings` :
- `company_logo` (text) : URL publique du logo de l'entreprise (stocké dans Supabase Storage)
- `company_phone2` (text) : deuxième numéro de téléphone

## Tables modifiées
- `app_settings` : ajout de `company_logo` et `company_phone2`

## Sécurité
- Aucun changement de politique. Les politiques existantes sur `app_settings` restent inchangées.
*/

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS company_logo text DEFAULT '';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS company_phone2 text DEFAULT '';
