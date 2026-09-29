import { useState, useEffect } from 'react';
import { Plus, Trash2, FileText, Eye, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, generateReference } from '@/lib/utils';
import type { Product, Supplier, PurchaseOrder } from '@/types';
import { Card, Button, Input, Select, Textarea, Badge, EmptyState } from '@/components/ui';
import Modal from '@/components/Modal';
import Loading from '@/components/Loading';

interface ItemRow {
  product_id: string;
  quantity: string;
  unit_price: string;
}

export default function PurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplier_id: '',
    reference: '',
    order_date: new Date().toISOString().slice(0, 10),
    expected_date: '',
    status: 'draft',
    notes: '',
  });
  const [items, setItems] = useState<ItemRow[]>([{ product_id: '', quantity: '1', unit_price: '0' }]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [oRes, prodRes, supRes] = await Promise.all([
      supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*').order('name'),
      supabase.from('suppliers').select('*').order('name'),
    ]);
    const supList = supRes.data || [];
    const enriched = (oRes.data || []).map((o: any) => ({ ...o, supplier: supList.find((s) => s.id === o.supplier_id) || null }));
    setOrders(enriched);
    setProducts(prodRes.data || []);
    setSuppliers(supList);
    setLoading(false);
  }

  function openAdd() {
    setForm({
      supplier_id: '',
      reference: generateReference('BC'),
      order_date: new Date().toISOString().slice(0, 10),
      expected_date: '',
      status: 'draft',
      notes: '',
    });
    setItems([{ product_id: '', quantity: '1', unit_price: '0' }]);
    setModalOpen(true);
  }

  function addItem() {
    setItems([...items, { product_id: '', quantity: '1', unit_price: '0' }]);
  }

  function removeItem(i: number) {
    setItems(items.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, field: keyof ItemRow, val: string) {
    const next = [...items];
    next[i] = { ...next[i], [field]: val };
    if (field === 'product_id') {
      const prod = products.find((p) => p.id === val);
      if (prod) next[i].unit_price = String(prod.cost_price);
    }
    setItems(next);
  }

  const totalAmount = items.reduce(
    (sum, it) => sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0),
    0
  );

  async function handleSave() {
    if (!form.reference.trim()) return;
    setSaving(true);
    const { data: order } = await supabase
      .from('purchase_orders')
      .insert({
        supplier_id: form.supplier_id || null,
        reference: form.reference,
        status: form.status,
        total_amount: totalAmount,
        order_date: form.order_date,
        expected_date: form.expected_date || null,
        notes: form.notes,
      })
      .select()
      .single();

    if (order) {
      const itemRows = items
        .filter((it) => it.product_id)
        .map((it) => ({
          order_id: order.id,
          product_id: it.product_id,
          quantity: parseFloat(it.quantity) || 0,
          unit_price: parseFloat(it.unit_price) || 0,
          total: (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0),
        }));
      if (itemRows.length > 0) {
        await supabase.from('purchase_order_items').insert(itemRows);
      }
    }
    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function openDetail(o: PurchaseOrder) {
    const { data } = await supabase.from('purchase_order_items').select('*').eq('order_id', o.id);
    const enrichedItems = (data || []).map((it: any) => ({ ...it, product: products.find((p) => p.id === it.product_id) || null }));
    setDetailOrder({ ...o, purchase_order_items: enrichedItems });
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bons de commande</h1>
          <p className="text-sm text-slate-500 mt-1">{orders.length} bon(s) de commande</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4" /> Nouveau bon
        </Button>
      </div>

      {orders.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="Aucun bon de commande"
            description="Créez des bons de commande pour vos fournisseurs."
            action={<Button onClick={openAdd}><Plus className="w-4 h-4" /> Créer un bon</Button>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Référence</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden md:table-cell">Fournisseur</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden lg:table-cell">Date</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Total</th>
                  <th className="text-center font-semibold text-slate-600 px-4 py-3">Statut</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{o.reference}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-600">{o.supplier?.name || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-600">{formatDate(o.order_date)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(o.total_amount)}</td>
                    <td className="px-4 py-3 text-center"><Badge status={o.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openDetail(o)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau bon de commande" size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Fournisseur" value={form.supplier_id} onChange={(v) => setForm({ ...form, supplier_id: v })} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} placeholder="Sélectionner..." />
            <Input label="Référence" value={form.reference} onChange={(v) => setForm({ ...form, reference: v })} required />
            <Input label="Date de commande" type="date" value={form.order_date} onChange={(v) => setForm({ ...form, order_date: v })} />
            <Input label="Date prévue" type="date" value={form.expected_date} onChange={(v) => setForm({ ...form, expected_date: v })} />
          </div>
          <Select label="Statut" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={[{ value: 'draft', label: 'Brouillon' }, { value: 'sent', label: 'Envoyé' }, { value: 'received', label: 'Reçu' }, { value: 'cancelled', label: 'Annulé' }]} />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Lignes</label>
              <Button size="sm" variant="secondary" onClick={addItem}><Plus className="w-3.5 h-3.5" /> Ajouter</Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <select value={it.product_id} onChange={(e) => updateItem(i, 'product_id', e.target.value)} className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Sélectionner...</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" step="0.01" placeholder="Qté" value={it.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} className="w-20 px-3 py-2.5 rounded-lg border border-slate-300 text-sm" />
                  <input type="number" step="0.01" placeholder="Prix" value={it.unit_price} onChange={(e) => updateItem(i, 'unit_price', e.target.value)} className="w-24 px-3 py-2.5 rounded-lg border border-slate-300 text-sm" />
                  <div className="w-24 text-right py-2.5 text-sm font-medium text-slate-700">{formatCurrency((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0))}</div>
                  {items.length > 1 && <button onClick={() => removeItem(i)} className="p-2.5 text-slate-400 hover:text-red-600"><X className="w-4 h-4" /></button>}
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-3 text-lg font-bold text-slate-800">Total: {formatCurrency(totalAmount)}</div>
          </div>
          <Textarea label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">Annuler</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">{saving ? '...' : 'Créer'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detailOrder} onClose={() => setDetailOrder(null)} title={detailOrder?.reference || ''} subtitle={detailOrder?.supplier?.name || 'Fournisseur'} size="lg">
        {detailOrder && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Badge status={detailOrder.status} />
              <span className="text-sm text-slate-500">Commande: {formatDate(detailOrder.order_date)}</span>
              {detailOrder.expected_date && <span className="text-sm text-slate-500">Prévu: {formatDate(detailOrder.expected_date)}</span>}
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-500">Total</p>
              <p className="text-lg font-bold text-slate-800">{formatCurrency(detailOrder.total_amount)}</p>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Produit</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Qté</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Prix</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detailOrder.purchase_order_items?.map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2 text-slate-700">{it.product?.name || '—'}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{it.quantity}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(it.unit_price)}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-700">{formatCurrency(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
