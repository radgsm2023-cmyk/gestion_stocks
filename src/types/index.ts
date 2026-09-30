export interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  description: string;
  unit: string;
  cost_price: number;
  sale_price: number;
  stock_quantity: number;
  min_stock: number;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  rc: string;
  nif: string;
  ai: string;
  created_at: string;
}

export interface Purchase {
  id: string;
  supplier_id: string | null;
  reference: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  purchase_date: string;
  notes: string;
  created_at: string;
  supplier?: Supplier | null;
  purchase_items?: PurchaseItem[];
  purchase_payments?: PurchasePayment[];
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  product?: Product | null;
}

export interface PurchasePayment {
  id: string;
  purchase_id: string;
  amount: number;
  payment_date: string;
  method: string;
  notes: string;
  created_at: string;
}

export interface PurchaseReturn {
  id: string;
  purchase_id: string;
  reference: string;
  total_amount: number;
  return_date: string;
  notes: string;
  created_at: string;
  purchase?: Purchase | null;
  purchase_return_items?: PurchaseReturnItem[];
}

export interface PurchaseReturnItem {
  id: string;
  return_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  product?: Product | null;
}

export interface Sale {
  id: string;
  customer_id: string | null;
  customer_name: string;
  reference: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  sale_date: string;
  notes: string;
  created_at: string;
  customer?: Customer | null;
  sale_items?: SaleItem[];
  sale_payments?: SalePayment[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  product?: Product | null;
}

export interface SalePayment {
  id: string;
  sale_id: string;
  amount: number;
  payment_date: string;
  method: string;
  notes: string;
  created_at: string;
}

export interface SalesReturn {
  id: string;
  sale_id: string;
  reference: string;
  total_amount: number;
  return_date: string;
  notes: string;
  created_at: string;
  sale?: Sale | null;
  sales_return_items?: SalesReturnItem[];
}

export interface SalesReturnItem {
  id: string;
  return_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  product?: Product | null;
}

export interface PurchaseOrder {
  id: string;
  supplier_id: string | null;
  reference: string;
  status: string;
  total_amount: number;
  order_date: string;
  expected_date: string | null;
  notes: string;
  created_at: string;
  supplier?: Supplier | null;
  purchase_order_items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  product?: Product | null;
}

export interface DeliveryNote {
  id: string;
  customer_id: string | null;
  reference: string;
  status: string;
  total_amount: number;
  delivery_date: string;
  notes: string;
  created_at: string;
  customer?: Customer | null;
  delivery_note_items?: DeliveryNoteItem[];
}

export interface DeliveryNoteItem {
  id: string;
  delivery_note_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  product?: Product | null;
}

export interface Invoice {
  id: string;
  sale_id: string | null;
  customer_id: string | null;
  reference: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  issue_date: string;
  due_date: string | null;
  notes: string;
  created_at: string;
  customer?: Customer | null;
  sale?: Sale | null;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'vendeur';
  active: boolean;
  created_at: string;
}

export interface AppSettings {
  id: number;
  app_title: string;
  currency_symbol: string;
  currency_code: string;
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  rc: string;
  nif: string;
  ai: string;
  updated_at: string;
}

export type PageKey =
  | 'dashboard'
  | 'products'
  | 'suppliers'
  | 'customers'
  | 'purchases'
  | 'purchase-returns'
  | 'sales'
  | 'sales-returns'
  | 'invoices'
  | 'users'
  | 'settings';
