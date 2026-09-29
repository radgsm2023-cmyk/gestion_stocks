import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, Package, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/types';
import {
  Card,
  Button,
  Input,
  Select,
  Textarea,
  Badge,
  EmptyState,
  ConfirmDialog,
} from '@/components/ui';
import Modal from '@/components/Modal';
import Loading from '@/components/Loading';

const emptyForm = {
  name: '',
  sku: '',
  category: 'Général',
  description: '',
  unit: 'pièce',
  cost_price: '0',
  sale_price: '0',
  stock_quantity: '0',
  min_stock: '0',
};

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  }

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || '').toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setForm(emptyForm);
    setEditId(null);
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setForm({
      name: p.name,
      sku: p.sku || '',
      category: p.category,
      description: p.description,
      unit: p.unit,
      cost_price: String(p.cost_price),
      sale_price: String(p.sale_price),
      stock_quantity: String(p.stock_quantity),
      min_stock: String(p.min_stock),
    });
    setEditId(p.id);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      category: form.category.trim(),
      description: form.description.trim(),
      unit: form.unit.trim(),
      cost_price: parseFloat(form.cost_price) || 0,
      sale_price: parseFloat(form.sale_price) || 0,
      stock_quantity: parseFloat(form.stock_quantity) || 0,
      min_stock: parseFloat(form.min_stock) || 0,
      updated_at: new Date().toISOString(),
    };
    if (editId) {
      await supabase.from('products').update(payload).eq('id', editId);
    } else {
      await supabase.from('products').insert(payload);
    }
    setSaving(false);
    setModalOpen(false);
    loadProducts();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await supabase.from('products').delete().eq('id', deleteId);
    setDeleteId(null);
    loadProducts();
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Produits</h1>
          <p className="text-sm text-slate-500 mt-1">{products.length} produit(s) au total</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4" /> Nouveau produit
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher un produit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title="Aucun produit"
            description="Commencez par ajouter votre premier produit à l'inventaire."
            action={
              <Button onClick={openAdd}>
                <Plus className="w-4 h-4" /> Ajouter un produit
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
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Produit</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden md:table-cell">Catégorie</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Prix achat</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Prix vente</th>
                  <th className="text-center font-semibold text-slate-600 px-4 py-3">Stock</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => {
                  const low = p.stock_quantity <= p.min_stock;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{p.name}</div>
                        <div className="text-xs text-slate-400">{p.sku || '—'}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-slate-600">{p.category}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(p.cost_price)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(p.sale_price)}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                            low ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {low && <AlertTriangle className="w-3 h-3" />}
                          {p.stock_quantity} {p.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteId(p.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Modifier le produit' : 'Nouveau produit'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nom du produit" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <Input label="SKU / Référence" value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Catégorie" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
            <Input label="Unité" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
            <Input label="Stock minimum" type="number" step="0.01" value={form.min_stock} onChange={(v) => setForm({ ...form, min_stock: v })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Prix d'achat (€)" type="number" step="0.01" value={form.cost_price} onChange={(v) => setForm({ ...form, cost_price: v })} />
            <Input label="Prix de vente (€)" type="number" step="0.01" value={form.sale_price} onChange={(v) => setForm({ ...form, sale_price: v })} />
            <Input label="Quantité en stock" type="number" step="0.01" value={form.stock_quantity} onChange={(v) => setForm({ ...form, stock_quantity: v })} />
          </div>
          <Textarea label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1">
              {saving ? 'Enregistrement...' : editId ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Supprimer le produit"
        message="Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible."
      />
    </div>
  );
}
