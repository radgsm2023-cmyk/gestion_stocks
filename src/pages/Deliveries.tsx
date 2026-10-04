import { useState, useEffect } from 'react';
import {
  Plus,
  Truck,
  Eye,
  Search,
  Filter,
  Package,
  X,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import {
  formatCurrency,
  formatDate,
  generateLIVRef,
  getNextSeq,
} from '@/lib/utils';
import { useAuth } from '@/lib/auth';

import type {
  Sale,
  Customer,
  Delivery,
} from '@/types';

import {
  Card,
  Button,
  Input,
  Select,
  Textarea,
  Badge,
  EmptyState,
} from '@/components/ui';

import Modal from '@/components/Modal';
import Loading from '@/components/Loading';

const deliveryStatusMap: Record<string, string> = {
  pending: 'warning',
  in_transit: 'info',
  delivered: 'success',
  cancelled: 'error',
};

const deliveryStatusLabel: Record<string, string> = {
  pending: 'En attente',
  in_transit: 'En cours',
  delivered: 'Livré',
  cancelled: 'Annulé',
};

export default function Deliveries() {
  const { settings } = useAuth();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailDelivery, setDetailDelivery] = useState<Delivery | null>(null);
  const [saving, setSaving] = useState(false);

  const [filterMethod, setFilterMethod] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    sale_id: '',
    reference: '',
    method: 'interne',
    vehicle: '',
    transport_cost: '0',
    delivery_date: new Date().toISOString().slice(0, 10),
    status: 'pending',
    notes: '',
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const [dRes, sRes, cRes] = await Promise.all([
      supabase
        .from('deliveries')
        .select('*')
        .order('created_at', { ascending: false }),

      supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false }),

      supabase
        .from('customers')
        .select('*')
        .order('name'),
    ]);

    const custList = cRes.data || [];
    const saleList = (sRes.data || []).map((s: any) => ({
      ...s,
      customer: custList.find((c) => c.id === s.customer_id) || null,
    }));

    const enriched = (dRes.data || []).map((d: any) => ({
      ...d,
      sale: saleList.find((s) => s.id === d.sale_id) || null,
    }));

    setDeliveries(enriched);
    setSales(saleList);
    setCustomers(custList);
    setLoading(false);
  }

  async function openAdd() {
    const seq = await getNextSeq('deliveries');
    setForm({
      sale_id: '',
      reference: generateLIVRef(seq),
      method: 'interne',
      vehicle: '',
      transport_cost: '0',
      delivery_date: new Date().toISOString().slice(0, 10),
      status: 'pending',
      notes: '',
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (
      !form.reference.trim() ||
      !form.sale_id ||
      !form.method ||
      !form.vehicle.trim() ||
      !form.transport_cost ||
      !form.delivery_date ||
      !form.status
    ) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('deliveries').insert({
        sale_id: form.sale_id || null,
        reference: form.reference,
        method: form.method,
        vehicle: form.vehicle,
        transport_cost: parseFloat(form.transport_cost) || 0,
        delivery_date: form.delivery_date,
        status: form.status,
        notes: form.notes,
      });

      if (error) {
        console.error('Erreur création livraison:', error);
        return;
      }

      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(d: Delivery, newStatus: string) {
    const { error } = await supabase
      .from('deliveries')
      .update({ status: newStatus })
      .eq('id', d.id);

    if (error) {
      console.error('Erreur mise à jour statut:', error);
      return;
    }

    await load();
  }

  function openDetail(d: Delivery) {
    setDetailDelivery(d);
  }

  const filteredDeliveries = deliveries.filter((d) => {
    if (filterMethod && d.method !== filterMethod) return false;
    if (filterStatus && d.status !== filterStatus) return false;
    if (filterDateFrom && d.delivery_date < filterDateFrom) return false;
    if (filterDateTo && d.delivery_date > filterDateTo) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchRef = d.reference.toLowerCase().includes(q);
      const matchVehicle = (d.vehicle || '').toLowerCase().includes(q);
      const matchSaleRef = d.sale?.reference?.toLowerCase().includes(q) || false;
      const matchCustomer = d.sale?.customer?.name?.toLowerCase().includes(q) || false;
      if (!matchRef && !matchVehicle && !matchSaleRef && !matchCustomer) return false;
    }
    return true;
  });

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Livraisons</h1>
          <p className="text-sm text-slate-500 mt-1">
            {filteredDeliveries.length} livraison(s)
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4" />
          Programmer une livraison
        </Button>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Rechercher (réf, immatriculation, client...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Tous les moyens</option>
            <option value="interne">Interne</option>
            <option value="externe">Externe</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="in_transit">En cours</option>
            <option value="delivered">Livré</option>
            <option value="cancelled">Annulé</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400 shrink-0">Du</span>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400 shrink-0">Au</span>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        {(filterMethod || filterStatus || filterDateFrom || filterDateTo || search) && (
          <button
            onClick={() => {
              setFilterMethod('');
              setFilterStatus('');
              setFilterDateFrom('');
              setFilterDateTo('');
              setSearch('');
            }}
            className="px-3 py-2.5 rounded-lg text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Liste */}
      {filteredDeliveries.length === 0 ? (
        <Card>
          <EmptyState
            icon={Truck}
            title="Aucune livraison"
            description="Programmez vos livraisons à partir de vos ventes."
            action={
              <Button onClick={openAdd}>
                <Plus className="w-4 h-4" />
                Programmer une livraison
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
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">
                    Référence
                  </th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden md:table-cell">
                    Vente
                  </th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden lg:table-cell">
                    Client
                  </th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">
                    Moyen
                  </th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden lg:table-cell">
                    Immatricule
                  </th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3 hidden lg:table-cell">
                    Frais transport
                  </th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden md:table-cell">
                    Date
                  </th>
                  <th className="text-center font-semibold text-slate-600 px-4 py-3">
                    Statut
                  </th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDeliveries.map((d) => (
                  <tr
                    key={d.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {d.reference}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-600">
                      {d.sale?.reference || '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-600">
                      {d.sale?.customer?.name || d.sale?.customer_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-slate-400" />
                        {d.method === 'interne' ? 'Interne' : 'Externe'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-600">
                      {d.vehicle || '—'}
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell text-slate-600">
                      {d.transport_cost > 0 ? formatCurrency(d.transport_cost) : '—'}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-600">
                      {formatDate(d.delivery_date)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        status={d.status}
                        variant={deliveryStatusMap[d.status] || 'default'}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openDetail(d)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {d.status === 'pending' && (
                          <button
                            onClick={() => updateStatus(d, 'in_transit')}
                            className="px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            Démarrer
                          </button>
                        )}
                        {d.status === 'in_transit' && (
                          <button
                            onClick={() => updateStatus(d, 'delivered')}
                            className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                          >
                            Livrer
                          </button>
                        )}
                        {(d.status === 'pending' || d.status === 'in_transit') && (
                          <button
                            onClick={() => updateStatus(d, 'cancelled')}
                            className="px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            Annuler
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL CRÉATION LIVRAISON */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Programmer une livraison"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Vente associée"
              value={form.sale_id}
              onChange={(v) => setForm({ ...form, sale_id: v })}
              options={sales.map((s) => ({
                value: s.id,
                label: `${s.reference} — ${s.customer?.name || s.customer_name || 'Client'}`,
              }))}
              placeholder="Sélectionner une vente..."
              required
            />
            <Input
              label="Référence"
              value={form.reference}
              onChange={(v) => setForm({ ...form, reference: v })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Moyen de livraison"
              value={form.method}
              onChange={(v) => setForm({ ...form, method: v })}
              options={[
                { value: 'interne', label: 'Interne' },
                { value: 'externe', label: 'Externe (Transporteur)' },
              ]}
              required
            />
            <Input
              label="Immatriculation"
              value={form.vehicle}
              onChange={(v) => setForm({ ...form, vehicle: v })}
              placeholder="Ex: 123456-A-7"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Frais de transport"
              type="number"
              step="0.01"
              value={form.transport_cost}
              onChange={(v) => setForm({ ...form, transport_cost: v })}
              required
            />
            <Input
              label="Date de livraison"
              type="date"
              value={form.delivery_date}
              onChange={(v) => setForm({ ...form, delivery_date: v })}
              required
            />
            <Select
              label="Statut"
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v })}
              options={[
                { value: 'pending', label: 'En attente' },
                { value: 'in_transit', label: 'En cours' },
                { value: 'delivered', label: 'Livré' },
                { value: 'cancelled', label: 'Annulé' },
              ]}
              required
            />
          </div>

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(v) => setForm({ ...form, notes: v })}
            placeholder="Instructions de livraison, adresse, etc."
          />

          {/* Aperçu de la vente sélectionnée */}
          {form.sale_id && (() => {
            const selectedSale = sales.find((s) => s.id === form.sale_id);
            if (!selectedSale) return null;
            return (
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">
                    Détails de la vente
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-slate-400 text-xs">Référence</p>
                    <p className="text-slate-700 font-medium">{selectedSale.reference}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Client</p>
                    <p className="text-slate-700 font-medium">
                      {selectedSale.customer?.name || selectedSale.customer_name || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Montant</p>
                    <p className="text-slate-700 font-medium">
                      {formatCurrency(selectedSale.total_amount)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="flex gap-3 pt-2 border-t border-slate-200">
            <Button
              variant="secondary"
              onClick={() => setModalOpen(false)}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1"
            >
              {saving ? '...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL DÉTAILS LIVRAISON */}
      <Modal
        open={!!detailDelivery}
        onClose={() => setDetailDelivery(null)}
        title="Détails de la livraison"
        subtitle={detailDelivery?.reference}
        size="lg"
      >
        {detailDelivery && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs text-slate-400 mb-1">Vente associée</p>
                <p className="text-sm font-medium text-slate-700">
                  {detailDelivery.sale?.reference || '—'}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {detailDelivery.sale?.customer?.name || detailDelivery.sale?.customer_name || '—'}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs text-slate-400 mb-1">Statut</p>
                <Badge
                  status={detailDelivery.status}
                  variant={deliveryStatusMap[detailDelivery.status] || 'default'}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs text-slate-400 mb-1">Moyen de livraison</p>
                <p className="text-sm font-medium text-slate-700">
                  {detailDelivery.method === 'interne' ? 'Interne' : 'Externe (Transporteur)'}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs text-slate-400 mb-1">Immatriculation</p>
                <p className="text-sm font-medium text-slate-700">
                  {detailDelivery.vehicle || '—'}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs text-slate-400 mb-1">Frais de transport</p>
                <p className="text-sm font-medium text-slate-700">
                  {formatCurrency(detailDelivery.transport_cost)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs text-slate-400 mb-1">Date de livraison</p>
                <p className="text-sm font-medium text-slate-700">
                  {formatDate(detailDelivery.delivery_date)}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs text-slate-400 mb-1">Créé le</p>
                <p className="text-sm font-medium text-slate-700">
                  {formatDate(detailDelivery.created_at)}
                </p>
              </div>
            </div>

            {detailDelivery.notes && (
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs text-slate-400 mb-1">Notes</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                  {detailDelivery.notes}
                </p>
              </div>
            )}

            {/* Actions statut */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
              {detailDelivery.status === 'pending' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    updateStatus(detailDelivery, 'in_transit');
                    setDetailDelivery(null);
                  }}
                >
                  Démarrer la livraison
                </Button>
              )}
              {detailDelivery.status === 'in_transit' && (
                <Button
                  size="sm"
                  onClick={() => {
                    updateStatus(detailDelivery, 'delivered');
                    setDetailDelivery(null);
                  }}
                >
                  Marquer comme livré
                </Button>
              )}
              {(detailDelivery.status === 'pending' || detailDelivery.status === 'in_transit') && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    updateStatus(detailDelivery, 'cancelled');
                    setDetailDelivery(null);
                  }}
                >
                  Annuler la livraison
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDetailDelivery(null)}
                className="ml-auto"
              >
                Fermer
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
