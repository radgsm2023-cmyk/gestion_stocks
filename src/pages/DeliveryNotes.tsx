import { useState, useEffect } from 'react';
import { Plus, Trash2, FileSignature, Eye, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, generateReference } from '@/lib/utils';
import type { Product, Customer, DeliveryNote } from '@/types';
import { Card, Button, Input, Select, Textarea, Badge, EmptyState } from '@/components/ui';
import Modal from '@/components/Modal';
import Loading from '@/components/Loading';

interface ItemRow {
  product_id: string;
  quantity: string;
  unit_price: string;
}

export default function DeliveryNotes() {
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailNote, setDetailNote] = useState<DeliveryNote | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_id: '',
    reference: '',
    delivery_date: new Date().toISOString().slice(0, 10),
    status: 'draft',
    notes: '',
  });
  const [items, setItems] = useState<ItemRow[]>([{ product_id: '', quantity: '1', unit_price: '0' }]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [nRes, prodRes, custRes] = await Promise.all([
      supabase.from('delivery_notes').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*').order('name'),
      supabase.from('customers').select('*').order('name'),
    ]);
    const custList = custRes.data || [];
    const enriched = (nRes.data || []).map((n: any) => ({ ...n, customer: custList.find((c) => c.id === n.customer_id) || null }));
    setNotes(enriched);
    setProducts(prodRes.data || []);
    setCustomers(custList);
    setLoading(false);
  }

  function openAdd() {
    setForm({
      customer_id: '',
      reference: generateReference('BL'),
      delivery_date: new Date().toISOString().slice(0, 10),
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
      if (prod) next[i].unit_price = String(prod.sale_price);
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
    const { data: note } = await supabase
      .from('delivery_notes')
      .insert({
        customer_id: form.customer_id || null,
        reference: form.reference,
        status: form.status,
        total_amount: totalAmount,
        delivery_date: form.delivery_date,
        notes: form.notes,
      })
      .select()
      .single();

    if (note) {
      const itemRows = items
        .filter((it) => it.product_id)
        .map((it) => ({
          delivery_note_id: note.id,
          product_id: it.product_id,
          quantity: parseFloat(it.quantity) || 0,
          unit_price: parseFloat(it.unit_price) || 0,
          total: (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0),
        }));
      if (itemRows.length > 0) {
        await supabase.from('delivery_note_items').insert(itemRows);
      }
    }
    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function openDetail(n: DeliveryNote) {
    const { data } = await supabase.from('delivery_note_items').select('*').eq('delivery_note_id', n.id);
    const enrichedItems = (data || []).map((it: any) => ({ ...it, product: products.find((p) => p.id === it.product_id) || null }));
    setDetailNote({ ...n, delivery_note_items: enrichedItems });
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bons de livraison</h1>
          <p className="text-sm text-slate-500 mt-1">{notes.length} bon(s) de livraison</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4" /> Nouveau bon
        </Button>
      </div>

      {notes.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileSignature}
            title="Aucun bon de livraison"
            description="Créez des bons de livraison pour vos clients."
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
                  <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden md:table-cell">Client</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden lg:table-cell">Date</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Total</th>
                  <th className="text-center font-semibold text-slate-600 px-4 py-3">Statut</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {notes.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{n.reference}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-600">{n.customer?.name || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-600">{formatDate(n.delivery_date)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(n.total_amount)}</td>
                    <td className="px-4 py-3 text-center"><Badge status={n.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openDetail(n)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau bon de livraison" size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Client" value={form.customer_id} onChange={(v) => setForm({ ...form, customer_id: v })} options={customers.map((c) => ({ value: c.id, label: c.name }))} placeholder="Sélectionner..." />
            <Input label="Référence" value={form.reference} onChange={(v) => setForm({ ...form, reference: v })} required />
            <Input label="Date de livraison" type="date" value={form.delivery_date} onChange={(v) => setForm({ ...form, delivery_date: v })} />
            <Select label="Statut" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={[{ value: 'draft', label: 'Brouillon' }, { value: 'delivered', label: 'Livré' }, { value: 'cancelled', label: 'Annulé' }]} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Produits</label>
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

      <Modal open={!!detailNote} onClose={() => setDetailNote(null)} title={detailNote?.reference || ''} subtitle={detailNote?.customer?.name || 'Client'} size="lg">
        {detailNote && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge status={detailNote.status} />
              <span className="text-sm text-slate-500">{formatDate(detailNote.delivery_date)}</span>
              <span className="text-lg font-bold text-slate-800 ml-auto">{formatCurrency(detailNote.total_amount)}</span>
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
                  {detailNote.delivery_note_items?.map((it) => (
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
