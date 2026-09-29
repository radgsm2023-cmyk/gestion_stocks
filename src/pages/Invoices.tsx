import { useState, useEffect } from 'react';
import { Receipt, Eye, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Invoice } from '@/types';
import { Card, Button, Input, Select, Badge, EmptyState } from '@/components/ui';
import Modal from '@/components/Modal';
import Loading from '@/components/Loading';

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [paymentModal, setPaymentModal] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [payment, setPayment] = useState({ amount: '0', payment_date: new Date().toISOString().slice(0, 10) });
  const [filter, setFilter] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });
    const [custRes] = await Promise.all([
      supabase.from('customers').select('*'),
    ]);
    const custList = custRes.data || [];
    const enriched = (data || []).map((inv: any) => ({ ...inv, customer: custList.find((c) => c.id === inv.customer_id) || null }));
    setInvoices(enriched);
    setLoading(false);
  }

  const filtered = invoices.filter(
    (i) =>
      i.reference.toLowerCase().includes(filter.toLowerCase()) ||
      (i.customer?.name || '').toLowerCase().includes(filter.toLowerCase())
  );

  async function openDetail(inv: Invoice) {
    const [itemsRes, prodRes] = await Promise.all([
      supabase.from('sale_items').select('*').eq('sale_id', inv.sale_id),
      supabase.from('products').select('*'),
    ]);
    const prodList = prodRes.data || [];
    const enrichedItems = (itemsRes.data || []).map((it: any) => ({ ...it, product: prodList.find((p) => p.id === it.product_id) || null }));
    setDetailInvoice({ ...inv, sale: inv.sale ? { ...inv.sale, sale_items: enrichedItems } as any : null });
  }

  function openPayment(inv: Invoice) {
    setPayment({
      amount: String((inv.total_amount - inv.paid_amount).toFixed(2)),
      payment_date: new Date().toISOString().slice(0, 10),
    });
    setPaymentModal(inv);
  }

  async function handlePayment() {
    if (!paymentModal) return;
    const amt = parseFloat(payment.amount) || 0;
    setSaving(true);
    const newPaid = paymentModal.paid_amount + amt;
    const newStatus = newPaid >= paymentModal.total_amount ? 'paid' : 'partial';
    await supabase
      .from('invoices')
      .update({ paid_amount: newPaid, status: newStatus })
      .eq('id', paymentModal.id);

    if (paymentModal.sale_id) {
      await supabase
        .from('sales')
        .update({ paid_amount: newPaid, status: newPaid >= paymentModal.total_amount ? 'delivered' : 'pending' })
        .eq('id', paymentModal.sale_id);
    }
    setSaving(false);
    setPaymentModal(null);
    load();
  }

  if (loading) return <Loading />;

  const totalUnpaid = invoices
    .filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
    .reduce((sum, i) => sum + (i.total_amount - i.paid_amount), 0);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Factures</h1>
          <p className="text-sm text-slate-500 mt-1">
            {invoices.length} facture(s) · {formatCurrency(totalUnpaid)} non payé
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <input
          type="text"
          placeholder="Rechercher une facture..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title="Aucune facture"
            description="Les factures sont créées automatiquement lors de la création d'une vente."
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
                  <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden lg:table-cell">Émission</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden lg:table-cell">Échéance</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Total</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3 hidden sm:table-cell">Payé</th>
                  <th className="text-center font-semibold text-slate-600 px-4 py-3">Statut</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{inv.reference}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-600">{inv.customer?.name || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-600">{formatDate(inv.issue_date)}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-600">{formatDate(inv.due_date)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(inv.total_amount)}</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell text-slate-600">{formatCurrency(inv.paid_amount)}</td>
                    <td className="px-4 py-3 text-center"><Badge status={inv.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openDetail(inv)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Détails">
                          <Eye className="w-4 h-4" />
                        </button>
                        {inv.paid_amount < inv.total_amount && inv.status !== 'cancelled' && (
                          <button onClick={() => openPayment(inv)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Paiement">
                            <CreditCard className="w-4 h-4" />
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

      {/* Modal détail */}
      <Modal
        open={!!detailInvoice}
        onClose={() => setDetailInvoice(null)}
        title={detailInvoice?.reference || ''}
        subtitle={detailInvoice?.customer?.name || 'Client'}
        size="lg"
      >
        {detailInvoice && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Badge status={detailInvoice.status} />
              <span className="text-sm text-slate-500">Émise le {formatDate(detailInvoice.issue_date)}</span>
              {detailInvoice.due_date && <span className="text-sm text-slate-500">Échéance: {formatDate(detailInvoice.due_date)}</span>}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-500">Total</p>
                <p className="text-lg font-bold text-slate-800">{formatCurrency(detailInvoice.total_amount)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-500">Payé</p>
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(detailInvoice.paid_amount)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-500">Reste</p>
                <p className="text-lg font-bold text-amber-600">
                  {formatCurrency(detailInvoice.total_amount - detailInvoice.paid_amount)}
                </p>
              </div>
            </div>
            {(detailInvoice.sale as any)?.sale_items && (
              <div>
                <h4 className="font-semibold text-slate-700 mb-2 text-sm">Détail</h4>
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
                      {(detailInvoice.sale as any).sale_items.map((it: any) => (
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
            {detailInvoice.paid_amount < detailInvoice.total_amount && detailInvoice.status !== 'cancelled' && (
              <Button onClick={() => { const inv = detailInvoice; setDetailInvoice(null); openPayment(inv); }} className="w-full">
                <CreditCard className="w-4 h-4" /> Enregistrer un paiement
              </Button>
            )}
          </div>
        )}
      </Modal>

      {/* Modal paiement */}
      <Modal
        open={!!paymentModal}
        onClose={() => setPaymentModal(null)}
        title="Paiement de facture"
        subtitle={paymentModal?.reference}
        size="sm"
      >
        <div className="space-y-4">
          {paymentModal && (
            <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-700">
              Reste à payer: {formatCurrency(paymentModal.total_amount - paymentModal.paid_amount)}
            </div>
          )}
          <Input label="Montant" type="number" step="0.01" value={payment.amount} onChange={(v) => setPayment({ ...payment, amount: v })} required />
          <Input label="Date" type="date" value={payment.payment_date} onChange={(v) => setPayment({ ...payment, payment_date: v })} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setPaymentModal(null)} className="flex-1">Annuler</Button>
            <Button onClick={handlePayment} disabled={saving} className="flex-1">{saving ? '...' : 'Enregistrer'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
