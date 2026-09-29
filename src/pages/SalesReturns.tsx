import { useState, useEffect } from 'react';
import { Plus, Undo2, Eye, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, generateReference } from '@/lib/utils';
import type { Product, Sale, SalesReturn } from '@/types';
import { Card, Button, Input, Select, Textarea, EmptyState } from '@/components/ui';
import Modal from '@/components/Modal';
import Loading from '@/components/Loading';

interface ItemRow {
  product_id: string;
  quantity: string;
  unit_price: string;
}

export default function SalesReturns() {
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailReturn, setDetailReturn] = useState<SalesReturn | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sale_id: '',
    reference: '',
    return_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [items, setItems] = useState<ItemRow[]>([{ product_id: '', quantity: '1', unit_price: '0' }]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [rRes, sRes, prodRes] = await Promise.all([
      supabase.from('sales_returns').select('*').order('created_at', { ascending: false }),
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*').order('name'),
    ]);
    const saleList = sRes.data || [];
    const enriched = (rRes.data || []).map((r: any) => ({ ...r, sale: saleList.find((s) => s.id === r.sale_id) || null }));
    setReturns(enriched);
    setSales(saleList);
    setProducts(prodRes.data || []);
    setLoading(false);
  }

  async function onSaleChange(saleId: string) {
    setForm({ ...form, sale_id: saleId });
    if (saleId) {
      const { data } = await supabase.from('sale_items').select('*').eq('sale_id', saleId);
      const existingItems = (data || []).map((it: any) => ({
        product_id: it.product_id || '',
        quantity: String(it.quantity),
        unit_price: String(it.unit_price),
      }));
      setItems(existingItems.length > 0 ? existingItems : [{ product_id: '', quantity: '1', unit_price: '0' }]);
    } else {
      setItems([{ product_id: '', quantity: '1', unit_price: '0' }]);
    }
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
    setItems(next);
  }

  const totalAmount = items.reduce(
    (sum, it) => sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0),
    0
  );

  async function handleSave() {
    if (!form.sale_id || !form.reference.trim()) return;
    setSaving(true);
    const { data: ret } = await supabase
      .from('sales_returns')
      .insert({
        sale_id: form.sale_id,
        reference: form.reference,
        total_amount: totalAmount,
        return_date: form.return_date,
        notes: form.notes,
      })
      .select()
      .single();

    if (ret) {
      const itemRows = items
        .filter((it) => it.product_id && parseFloat(it.quantity) > 0)
        .map((it) => ({
          return_id: ret.id,
          product_id: it.product_id,
          quantity: parseFloat(it.quantity) || 0,
          unit_price: parseFloat(it.unit_price) || 0,
          total: (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0),
        }));
      if (itemRows.length > 0) {
        await supabase.from('sales_return_items').insert(itemRows);
        for (const it of itemRows) {
          const prod = products.find((p) => p.id === it.product_id);
          if (prod) {
            await supabase
              .from('products')
              .update({ stock_quantity: prod.stock_quantity + it.quantity })
              .eq('id', it.product_id);
          }
        }
      }
    }
    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function openDetail(r: SalesReturn) {
    const { data } = await supabase.from('sales_return_items').select('*').eq('return_id', r.id);
    const enrichedItems = (data || []).map((it: any) => ({ ...it, product: products.find((p) => p.id === it.product_id) || null }));
    setDetailReturn({ ...r, sales_return_items: enrichedItems });
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Retours de ventes</h1>
          <p className="text-sm text-slate-500 mt-1">{returns.length} retour(s)</p>
        </div>
        <Button onClick={() => { setForm({ sale_id: '', reference: generateReference('RVTE'), return_date: new Date().toISOString().slice(0, 10), notes: '' }); setItems([{ product_id: '', quantity: '1', unit_price: '0' }]); setModalOpen(true); }}>
          <Plus className="w-4 h-4" /> Nouveau retour
        </Button>
      </div>

      {returns.length === 0 ? (
        <Card>
          <EmptyState
            icon={Undo2}
            title="Aucun retour de vente"
            description="Enregistrez les retours de marchandises de vos clients."
            action={
              <Button onClick={() => { setForm({ sale_id: '', reference: generateReference('RVTE'), return_date: new Date().toISOString().slice(0, 10), notes: '' }); setItems([{ product_id: '', quantity: '1', unit_price: '0' }]); setModalOpen(true); }}>
                <Plus className="w-4 h-4" /> Créer un retour
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Référence</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden md:table-cell">Vente</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden lg:table-cell">Date</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Total</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.reference}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-600">{r.sale?.reference || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-600">{formatDate(r.return_date)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(r.total_amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openDetail(r)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau retour de vente" size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select label="Vente" value={form.sale_id} onChange={onSaleChange} options={sales.map((s) => ({ value: s.id, label: s.reference }))} placeholder="Sélectionner..." required />
            <Input label="Référence" value={form.reference} onChange={(v) => setForm({ ...form, reference: v })} required />
            <Input label="Date" type="date" value={form.return_date} onChange={(v) => setForm({ ...form, return_date: v })} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Produits retournés</label>
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
            <Button onClick={handleSave} disabled={saving || !form.sale_id} className="flex-1">{saving ? '...' : 'Créer'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detailReturn} onClose={() => setDetailReturn(null)} title={detailReturn?.reference || ''} subtitle="Retour de vente" size="lg">
        {detailReturn && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">{formatDate(detailReturn.return_date)}</span>
              <span className="text-lg font-bold text-slate-800">{formatCurrency(detailReturn.total_amount)}</span>
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
                  {detailReturn.sales_return_items?.map((it) => (
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
