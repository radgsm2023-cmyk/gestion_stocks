/*
# Création de la table des livraisons

## Description
Ajoute une table `deliveries` pour gérer les livraisons liées aux ventes.
Chaque livraison est associée à une vente, avec un moyen de livraison
(interne ou externe/transporteur), une immatriculation, des frais de transport,
une date de livraison prévue, un statut et des notes.

## Tables créées
- `deliveries` :
  - `id` (uuid, PK)
  - `sale_id` (uuid, FK vers sales)
  - `reference` (text, non null)
  - `method` (text: 'interne' ou 'externe')
  - `vehicle` (text: immatriculation du véhicule)
  - `transport_cost` (numeric: frais de transport, single field)
  - `delivery_date` (date: date de livraison prévue)
  - `status` (text: 'pending', 'in_transit', 'delivered', 'cancelled')
  - `notes` (text)
  - `created_at` (timestamptz)

## Sécurité
- RLS activée sur `deliveries`.
- Application mono-utilisateur : politiques `TO anon, authenticated` avec `USING (true)`.
*/

CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  reference text NOT NULL,
  method text NOT NULL DEFAULT 'interne',
  vehicle text DEFAULT '',
  transport_cost numeric(12,2) NOT NULL DEFAULT 0,
  delivery_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pending',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_deliveries" ON deliveries;
CREATE POLICY "anon_select_deliveries" ON deliveries FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_deliveries" ON deliveries;
CREATE POLICY "anon_insert_deliveries" ON deliveries FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_deliveries" ON deliveries;
CREATE POLICY "anon_update_deliveries" ON deliveries FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_deliveries" ON deliveries;
CREATE POLICY "anon_delete_deliveries" ON deliveries FOR DELETE
TO anon, authenticated USING (true);
