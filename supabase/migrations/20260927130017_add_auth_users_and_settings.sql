/*
# Système d'authentification, rôles utilisateurs et paramètres

## Description
Ajoute le système de gestion des utilisateurs (administrateur, vendeur) avec authentification,
une table de paramètres de l'application (symbole monétaire, titre, registre, fiscal),
et modifie les ventes pour supporter les clients de passage (non enregistrés).

## Tables créées

### `profiles`
- Profils utilisateurs liés à auth.users
- `id` (uuid, PK, FK vers auth.users)
- `email` (text)
- `full_name` (text)
- `role` (text: 'admin' ou 'vendeur')
- `active` (boolean, défaut true)
- `created_at` (timestamptz)

### `app_settings`
- Paramètres globaux de l'application (ligne unique)
- `id` (int, PK, défaut 1)
- `app_title` (text, défaut 'StockFlow')
- `currency_symbol` (text, défaut '€')
- `currency_code` (text, défaut 'EUR')
- `company_name` (text)
- `company_address` (text)
- `company_phone` (text)
- `company_email` (text)
- `rc` (text — registre de commerce)
- `ice` (text — identifiant commun de l'entreprise)
- `nif` (text — numéro d'identification fiscale)
- `patente` (text)
- `cnss` (text)
- `updated_at` (timestamptz)

## Table modifiée

### `sales`
- Ajout colonne `customer_name` (text) pour les ventes à clients de passage
- Quand `customer_id` est NULL, `customer_name` contient le nom du client de passage

## Sécurité
- RLS activée sur `profiles` et `app_settings`
- `profiles` : SELECT pour tous les authentifiés, INSERT/UPDATE/DELETE pour admin uniquement
- `app_settings` : SELECT pour tous les authentifiés, UPDATE pour admin uniquement
- Trigger `on_auth_user_created` : crée automatiquement un profil à l'inscription
- Les tables existantes passent de `anon, authenticated` à `authenticated` uniquement

## Notes importantes
1. Les politiques des tables existantes sont mises à jour pour `authenticated` uniquement
2. Le premier utilisateur inscrit devient administrateur
3. L'email de confirmation reste désactivé
*/

-- ===== TABLE PROFILES =====
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'vendeur' CHECK (role IN ('admin', 'vendeur')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_admin" ON profiles;
CREATE POLICY "profiles_insert_admin" ON profiles FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ===== TABLE APP_SETTINGS =====
CREATE TABLE IF NOT EXISTS app_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  app_title text NOT NULL DEFAULT 'StockFlow',
  currency_symbol text NOT NULL DEFAULT '€',
  currency_code text NOT NULL DEFAULT 'EUR',
  company_name text NOT NULL DEFAULT '',
  company_address text NOT NULL DEFAULT '',
  company_phone text NOT NULL DEFAULT '',
  company_email text NOT NULL DEFAULT '',
  rc text NOT NULL DEFAULT '',
  ice text NOT NULL DEFAULT '',
  nif text NOT NULL DEFAULT '',
  patente text NOT NULL DEFAULT '',
  cnss text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

-- Insérer la ligne par défaut si elle n'existe pas
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select_all" ON app_settings;
CREATE POLICY "settings_select_all" ON app_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "settings_update_admin" ON app_settings;
CREATE POLICY "settings_update_admin" ON app_settings FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ===== TRIGGER : auto-création de profil à l'inscription =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Le premier utilisateur devient admin, les autres vendeurs
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE WHEN (SELECT COUNT(*) FROM profiles) = 0 THEN 'admin' ELSE 'vendeur' END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== COLONNE customer_name SUR SALES =====
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'customer_name') THEN
    ALTER TABLE sales ADD COLUMN customer_name text DEFAULT '';
  END IF;
END $$;

-- ===== MISE À JOUR DES POLITIQUES : passer de anon à authenticated =====
-- products
DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "auth_select_products" ON products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "auth_insert_products" ON products FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "auth_update_products" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "auth_delete_products" ON products FOR DELETE TO authenticated USING (true);

-- suppliers
DROP POLICY IF EXISTS "anon_select_suppliers" ON suppliers;
CREATE POLICY "auth_select_suppliers" ON suppliers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_suppliers" ON suppliers;
CREATE POLICY "auth_insert_suppliers" ON suppliers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_suppliers" ON suppliers;
CREATE POLICY "auth_update_suppliers" ON suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_suppliers" ON suppliers;
CREATE POLICY "auth_delete_suppliers" ON suppliers FOR DELETE TO authenticated USING (true);

-- customers
DROP POLICY IF EXISTS "anon_select_customers" ON customers;
CREATE POLICY "auth_select_customers" ON customers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "auth_insert_customers" ON customers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "auth_update_customers" ON customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_customers" ON customers;
CREATE POLICY "auth_delete_customers" ON customers FOR DELETE TO authenticated USING (true);

-- purchases
DROP POLICY IF EXISTS "anon_select_purchases" ON purchases;
CREATE POLICY "auth_select_purchases" ON purchases FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_purchases" ON purchases;
CREATE POLICY "auth_insert_purchases" ON purchases FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_purchases" ON purchases;
CREATE POLICY "auth_update_purchases" ON purchases FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_purchases" ON purchases;
CREATE POLICY "auth_delete_purchases" ON purchases FOR DELETE TO authenticated USING (true);

-- purchase_items
DROP POLICY IF EXISTS "anon_select_purchase_items" ON purchase_items;
CREATE POLICY "auth_select_purchase_items" ON purchase_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_purchase_items" ON purchase_items;
CREATE POLICY "auth_insert_purchase_items" ON purchase_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_purchase_items" ON purchase_items;
CREATE POLICY "auth_update_purchase_items" ON purchase_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_purchase_items" ON purchase_items;
CREATE POLICY "auth_delete_purchase_items" ON purchase_items FOR DELETE TO authenticated USING (true);

-- purchase_payments
DROP POLICY IF EXISTS "anon_select_purchase_payments" ON purchase_payments;
CREATE POLICY "auth_select_purchase_payments" ON purchase_payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_purchase_payments" ON purchase_payments;
CREATE POLICY "auth_insert_purchase_payments" ON purchase_payments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_purchase_payments" ON purchase_payments;
CREATE POLICY "auth_update_purchase_payments" ON purchase_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_purchase_payments" ON purchase_payments;
CREATE POLICY "auth_delete_purchase_payments" ON purchase_payments FOR DELETE TO authenticated USING (true);

-- purchase_returns
DROP POLICY IF EXISTS "anon_select_purchase_returns" ON purchase_returns;
CREATE POLICY "auth_select_purchase_returns" ON purchase_returns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_purchase_returns" ON purchase_returns;
CREATE POLICY "auth_insert_purchase_returns" ON purchase_returns FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_purchase_returns" ON purchase_returns;
CREATE POLICY "auth_update_purchase_returns" ON purchase_returns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_purchase_returns" ON purchase_returns;
CREATE POLICY "auth_delete_purchase_returns" ON purchase_returns FOR DELETE TO authenticated USING (true);

-- purchase_return_items
DROP POLICY IF EXISTS "anon_select_purchase_return_items" ON purchase_return_items;
CREATE POLICY "auth_select_purchase_return_items" ON purchase_return_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_purchase_return_items" ON purchase_return_items;
CREATE POLICY "auth_insert_purchase_return_items" ON purchase_return_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_purchase_return_items" ON purchase_return_items;
CREATE POLICY "auth_update_purchase_return_items" ON purchase_return_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_purchase_return_items" ON purchase_return_items;
CREATE POLICY "auth_delete_purchase_return_items" ON purchase_return_items FOR DELETE TO authenticated USING (true);

-- sales
DROP POLICY IF EXISTS "anon_select_sales" ON sales;
CREATE POLICY "auth_select_sales" ON sales FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_sales" ON sales;
CREATE POLICY "auth_insert_sales" ON sales FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_sales" ON sales;
CREATE POLICY "auth_update_sales" ON sales FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sales" ON sales;
CREATE POLICY "auth_delete_sales" ON sales FOR DELETE TO authenticated USING (true);

-- sale_items
DROP POLICY IF EXISTS "anon_select_sale_items" ON sale_items;
CREATE POLICY "auth_select_sale_items" ON sale_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_sale_items" ON sale_items;
CREATE POLICY "auth_insert_sale_items" ON sale_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_sale_items" ON sale_items;
CREATE POLICY "auth_update_sale_items" ON sale_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sale_items" ON sale_items;
CREATE POLICY "auth_delete_sale_items" ON sale_items FOR DELETE TO authenticated USING (true);

-- sale_payments
DROP POLICY IF EXISTS "anon_select_sale_payments" ON sale_payments;
CREATE POLICY "auth_select_sale_payments" ON sale_payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_sale_payments" ON sale_payments;
CREATE POLICY "auth_insert_sale_payments" ON sale_payments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_sale_payments" ON sale_payments;
CREATE POLICY "auth_update_sale_payments" ON sale_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sale_payments" ON sale_payments;
CREATE POLICY "auth_delete_sale_payments" ON sale_payments FOR DELETE TO authenticated USING (true);

-- sales_returns
DROP POLICY IF EXISTS "anon_select_sales_returns" ON sales_returns;
CREATE POLICY "auth_select_sales_returns" ON sales_returns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_sales_returns" ON sales_returns;
CREATE POLICY "auth_insert_sales_returns" ON sales_returns FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_sales_returns" ON sales_returns;
CREATE POLICY "auth_update_sales_returns" ON sales_returns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sales_returns" ON sales_returns;
CREATE POLICY "auth_delete_sales_returns" ON sales_returns FOR DELETE TO authenticated USING (true);

-- sales_return_items
DROP POLICY IF EXISTS "anon_select_sales_return_items" ON sales_return_items;
CREATE POLICY "auth_select_sales_return_items" ON sales_return_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_sales_return_items" ON sales_return_items;
CREATE POLICY "auth_insert_sales_return_items" ON sales_return_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_sales_return_items" ON sales_return_items;
CREATE POLICY "auth_update_sales_return_items" ON sales_return_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sales_return_items" ON sales_return_items;
CREATE POLICY "auth_delete_sales_return_items" ON sales_return_items FOR DELETE TO authenticated USING (true);

-- purchase_orders
DROP POLICY IF EXISTS "anon_select_purchase_orders" ON purchase_orders;
CREATE POLICY "auth_select_purchase_orders" ON purchase_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_purchase_orders" ON purchase_orders;
CREATE POLICY "auth_insert_purchase_orders" ON purchase_orders FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_purchase_orders" ON purchase_orders;
CREATE POLICY "auth_update_purchase_orders" ON purchase_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_purchase_orders" ON purchase_orders;
CREATE POLICY "auth_delete_purchase_orders" ON purchase_orders FOR DELETE TO authenticated USING (true);

-- purchase_order_items
DROP POLICY IF EXISTS "anon_select_purchase_order_items" ON purchase_order_items;
CREATE POLICY "auth_select_purchase_order_items" ON purchase_order_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_purchase_order_items" ON purchase_order_items;
CREATE POLICY "auth_insert_purchase_order_items" ON purchase_order_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_purchase_order_items" ON purchase_order_items;
CREATE POLICY "auth_update_purchase_order_items" ON purchase_order_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_purchase_order_items" ON purchase_order_items;
CREATE POLICY "auth_delete_purchase_order_items" ON purchase_order_items FOR DELETE TO authenticated USING (true);

-- delivery_notes
DROP POLICY IF EXISTS "anon_select_delivery_notes" ON delivery_notes;
CREATE POLICY "auth_select_delivery_notes" ON delivery_notes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_delivery_notes" ON delivery_notes;
CREATE POLICY "auth_insert_delivery_notes" ON delivery_notes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_delivery_notes" ON delivery_notes;
CREATE POLICY "auth_update_delivery_notes" ON delivery_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_delivery_notes" ON delivery_notes;
CREATE POLICY "auth_delete_delivery_notes" ON delivery_notes FOR DELETE TO authenticated USING (true);

-- delivery_note_items
DROP POLICY IF EXISTS "anon_select_delivery_note_items" ON delivery_note_items;
CREATE POLICY "auth_select_delivery_note_items" ON delivery_note_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_delivery_note_items" ON delivery_note_items;
CREATE POLICY "auth_insert_delivery_note_items" ON delivery_note_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_delivery_note_items" ON delivery_note_items;
CREATE POLICY "auth_update_delivery_note_items" ON delivery_note_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_delivery_note_items" ON delivery_note_items;
CREATE POLICY "auth_delete_delivery_note_items" ON delivery_note_items FOR DELETE TO authenticated USING (true);

-- invoices
DROP POLICY IF EXISTS "anon_select_invoices" ON invoices;
CREATE POLICY "auth_select_invoices" ON invoices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_invoices" ON invoices;
CREATE POLICY "auth_insert_invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_invoices" ON invoices;
CREATE POLICY "auth_update_invoices" ON invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_invoices" ON invoices;
CREATE POLICY "auth_delete_invoices" ON invoices FOR DELETE TO authenticated USING (true);
