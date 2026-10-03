
import { useState, useEffect } from 'react';
import {
  Plus,
  ShoppingCart,
  Eye,
  CreditCard,
  X,
  FileText,
  Printer,
  Search,
  Filter,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, generatePurchaseRef, generateBCRef, getNextSeq } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import type { Product, Supplier, Purchase } from '@/types';
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

interface ItemRow {
  product_id: string;
  quantity: string;
  unit_price: string;
}

interface PurchaseOrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total: number;
  product?: Product | null;
}

interface PurchaseOrderPreview {
  reference: string;
  date: string;
  supplier: Supplier | null;
  purchase: Purchase;
  items: PurchaseOrderItem[];
  total: number;
}

export default function Purchases() {
  const { settings } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [detailPurchase, setDetailPurchase] = useState<Purchase | null>(null);
  const [paymentModal, setPaymentModal] = useState<Purchase | null>(null);

  // Bon de commande
  const [purchaseOrderModal, setPurchaseOrderModal] =
    useState<PurchaseOrderPreview | null>(null);

  const [loadingPurchaseOrder, setLoadingPurchaseOrder] = useState(false);

  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const [form, setForm] = useState({
    supplier_id: '',
    reference: '',
    purchase_date: new Date().toISOString().slice(0, 10),
    status: 'pending',
    notes: '',
    handling_fee: '0',
  });

  const [items, setItems] = useState<ItemRow[]>([
    {
      product_id: '',
      quantity: '1',
      unit_price: '0',
    },
  ]);

  const [payment, setPayment] = useState({
    amount: '0',
    method: 'espèces',
    payment_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const [pRes, prodRes, supRes] = await Promise.all([
      supabase
        .from('purchases')
        .select('*')
        .order('created_at', { ascending: false }),

      supabase
        .from('products')
        .select('*')
        .order('name'),

      supabase
        .from('suppliers')
        .select('*')
        .order('name'),
    ]);

    const supList = supRes.data || [];

    const enriched = (pRes.data || []).map((p: any) => ({
      ...p,
      supplier:
        supList.find((s) => s.id === p.supplier_id) || null,
    }));

    setPurchases(enriched);
    setProducts(prodRes.data || []);
    setSuppliers(supList);

    setLoading(false);
  }

  async function getNextPurchaseReference(
    purchaseDate: string
  ): Promise<string> {
    const seq = await getNextSeq('purchases');
    return generatePurchaseRef(seq);
  }

  async function openAdd() {
    const purchaseDate = new Date()
      .toISOString()
      .slice(0, 10);

    const reference = await getNextPurchaseReference(
      purchaseDate
    );

    setForm({
      supplier_id: '',
      reference,
      purchase_date: purchaseDate,
      status: 'pending',
      notes: '',
      handling_fee: '0',
    });

    setItems([
      {
        product_id: '',
        quantity: '1',
        unit_price: '0',
      },
    ]);

    setModalOpen(true);
  }

  function addItem() {
    setItems([
      ...items,
      {
        product_id: '',
        quantity: '1',
        unit_price: '0',
      },
    ]);
  }

  function removeItem(i: number) {
    setItems(
      items.filter((_, idx) => idx !== i)
    );
  }

  function updateItem(
    i: number,
    field: keyof ItemRow,
    val: string
  ) {
    const next = [...items];

    next[i] = {
      ...next[i],
      [field]: val,
    };

    if (field === 'product_id') {
      const prod = products.find(
        (p) => p.id === val
      );

      if (prod) {
        next[i].unit_price = String(
          prod.cost_price
        );
      }
    }

    setItems(next);
  }

  const itemsTotal = items.reduce(
    (sum, it) =>
      sum +
      (parseFloat(it.quantity) || 0) *
        (parseFloat(it.unit_price) || 0),
    0
  );

  const handlingFee = parseFloat(form.handling_fee) || 0;
  const totalAmount = itemsTotal + handlingFee;

  async function handleSave() {
    if (
      !form.reference.trim() ||
      items.length === 0
    ) {
      return;
    }

    const validItems = items.filter(
      (it) =>
        it.product_id &&
        (parseFloat(it.quantity) || 0) > 0
    );

    if (validItems.length === 0) {
      return;
    }

    setSaving(true);

    try {
      const { data: purchase, error: purchaseError } =
        await supabase
          .from('purchases')
          .insert({
            supplier_id:
              form.supplier_id || null,

            reference: form.reference,

            status: form.status,

            total_amount: totalAmount,

            paid_amount: 0,

            handling_fee: handlingFee,

            purchase_date:
              form.purchase_date,

            notes: form.notes,
          })
          .select()
          .single();

      if (purchaseError || !purchase) {
        console.error(
          'Erreur création achat:',
          purchaseError
        );

        return;
      }

      const itemRows = validItems.map(
        (it) => ({
          purchase_id: purchase.id,

          product_id: it.product_id,

          quantity:
            parseFloat(it.quantity) || 0,

          unit_price:
            parseFloat(it.unit_price) || 0,

          total:
            (parseFloat(it.quantity) || 0) *
            (parseFloat(it.unit_price) || 0),
        })
      );

      if (itemRows.length > 0) {
        const { error: itemsError } =
          await supabase
            .from('purchase_items')
            .insert(itemRows);

        if (itemsError) {
          console.error(
            'Erreur création lignes achat:',
            itemsError
          );
        }

        for (const it of itemRows) {
          const prod = products.find(
            (p) => p.id === it.product_id
          );

          if (prod) {
            await supabase
              .from('products')
              .update({
                stock_quantity:
                  prod.stock_quantity +
                  it.quantity,
              })
              .eq('id', it.product_id);
          }
        }
      }

      setModalOpen(false);

      await load();
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(p: Purchase) {
    const [
      itemsRes,
      paymentsRes,
    ] = await Promise.all([
      supabase
        .from('purchase_items')
        .select('*')
        .eq('purchase_id', p.id),

      supabase
        .from('purchase_payments')
        .select('*')
        .eq('purchase_id', p.id)
        .order('payment_date'),
    ]);

    const enrichedItems =
      (itemsRes.data || []).map(
        (it: any) => ({
          ...it,

          product:
            products.find(
              (prod) =>
                prod.id === it.product_id
            ) || null,
        })
      );

    setDetailPurchase({
      ...p,
      purchase_items: enrichedItems,
      purchase_payments:
        paymentsRes.data || [],
    });
  }

  /**
   * Affiche le bon de commande correspondant
   * à l'achat sélectionné.
   *
   * Aucune nouvelle saisie n'est demandée :
   * les informations viennent directement
   * de l'achat enregistré.
   */
  async function openPurchaseOrder(
    purchase: Purchase
  ) {
    setLoadingPurchaseOrder(true);

    try {
      const { data, error } =
        await supabase
          .from('purchase_items')
          .select('*')
          .eq('purchase_id', purchase.id);

      if (error) {
        console.error(
          'Erreur chargement bon de commande:',
          error
        );

        return;
      }

      const orderItems: PurchaseOrderItem[] =
        (data || []).map((item: any) => ({
          id: item.id,

          product_id:
            item.product_id,

          quantity:
            Number(item.quantity) || 0,

          unit_price:
            Number(item.unit_price) || 0,

          total:
            Number(item.total) || 0,

          product:
            products.find(
              (product) =>
                product.id ===
                item.product_id
            ) || null,
        }));

      const total = orderItems.reduce(
        (sum, item) =>
          sum + Number(item.total || 0),
        0
      );

      let orderReference =
        purchase.reference;

      const bcSeq = await getNextSeq('purchase_orders');
      orderReference = generateBCRef(bcSeq);

      setPurchaseOrderModal({
        reference: orderReference,

        date: purchase.purchase_date,

        supplier:
          purchase.supplier || null,

        purchase,

        items: orderItems,

        total,
      });
    } finally {
      setLoadingPurchaseOrder(false);
    }
  }

  function openPayment(p: Purchase) {
    setPayment({
      amount: String(
        (
          p.total_amount -
          p.paid_amount
        ).toFixed(2)
      ),

      method: 'espèces',

      payment_date:
        new Date()
          .toISOString()
          .slice(0, 10),

      notes: '',
    });

    setPaymentModal(p);
  }

  async function handlePayment() {
    if (!paymentModal) {
      return;
    }

    const amt =
      parseFloat(payment.amount) || 0;

    const remaining =
      paymentModal.total_amount -
      paymentModal.paid_amount;

    if (amt <= 0 || amt > remaining) {
      return;
    }

    setSaving(true);

    try {
      await supabase
        .from('purchase_payments')
        .insert({
          purchase_id:
            paymentModal.id,

          amount: amt,

          payment_date:
            payment.payment_date,

          method: payment.method,

          notes: payment.notes,
        });

      const newPaid =
        paymentModal.paid_amount +
        amt;

      const newStatus =
        newPaid >=
        paymentModal.total_amount
          ? 'received'
          : paymentModal.status;

      await supabase
        .from('purchases')
        .update({
          paid_amount: newPaid,
          status: newStatus,
        })
        .eq(
          'id',
          paymentModal.id
        );

      setPaymentModal(null);

      await load();
    } finally {
      setSaving(false);
    }
  }

  /**
   * Impression du bon de commande.
   */
  function printPurchaseOrder() {
    if (!purchaseOrderModal) {
      return;
    }

    const order =
      purchaseOrderModal;

    const supplierName =
      order.supplier?.name ||
      'Fournisseur non spécifié';

    const supplierContact =
      order.supplier?.contact_person ||
      '';

    const supplierPhone =
      order.supplier?.phone ||
      '';

    const supplierEmail =
      order.supplier?.email ||
      '';

    const supplierRC =
      order.supplier?.rc ||
      '';

    const supplierNIF =
      order.supplier?.nif ||
      '';

    const supplierAI =
      order.supplier?.ai ||
      '';

    const company = settings;

    const companyInfo = company && (company.company_name || company.company_address)
      ? `
        <div class="company-box">
          ${company.company_name ? `<div class="company-name">${escapeHtml(company.company_name)}</div>` : ''}
          ${company.company_address ? `<div>${escapeHtml(company.company_address)}</div>` : ''}
          ${company.company_phone ? `<div>Tél : ${escapeHtml(company.company_phone)}</div>` : ''}
          ${company.company_email ? `<div>${escapeHtml(company.company_email)}</div>` : ''}
          ${(company.rc || company.nif || company.ai) ? `<div class="company-ids">${company.rc ? `RC: ${escapeHtml(company.rc)} · ` : ''}${company.nif ? `NIF: ${escapeHtml(company.nif)} · ` : ''}${company.ai ? `AI: ${escapeHtml(company.ai)}` : ''}</div>` : ''}
        </div>
      `
      : '';

    const rows =
      order.items
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(
                item.product?.name ||
                  'Produit'
              )}</td>
              <td>${item.quantity}</td>
              <td>${formatCurrency(
                item.unit_price
              )}</td>
              <td>${formatCurrency(
                item.total
              )}</td>
            </tr>
          `
        )
        .join('');

    const printWindow =
      window.open(
        '',
        '_blank',
        'width=900,height=700'
      );

    if (!printWindow) {
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8" />

        <title>
          Bon de commande ${escapeHtml(
            order.reference
          )}
        </title>

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 40px;
            color: #1e293b;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #1e293b;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }

          .company-box {
            text-align: right;
            font-size: 13px;
            color: #475569;
          }

          .company-name {
            font-weight: bold;
            font-size: 15px;
            color: #1e293b;
            margin-bottom: 4px;
          }

          .company-ids {
            font-size: 11px;
            color: #94a3b8;
            margin-top: 2px;
          }

          .title {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 8px;
          }

          .reference {
            font-size: 15px;
            color: #475569;
          }

          .supplier-box {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 25px;
          }

          .supplier-title {
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 10px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }

          th {
            background: #f1f5f9;
            text-align: left;
            padding: 12px;
            border: 1px solid #cbd5e1;
          }

          td {
            padding: 12px;
            border: 1px solid #cbd5e1;
          }

          th:nth-child(n+2),
          td:nth-child(n+2) {
            text-align: right;
          }

          .total {
            margin-top: 20px;
            display: flex;
            justify-content: flex-end;
          }

          .total-box {
            width: 300px;
            border: 2px solid #1e293b;
            padding: 15px;
            display: flex;
            justify-content: space-between;
            font-size: 18px;
            font-weight: bold;
          }

          .total-detail {
            width: 300px;
            padding: 8px 15px;
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            color: #475569;
          }

          .notes {
            margin-top: 30px;
            padding: 15px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
          }

          .footer {
            margin-top: 60px;
            text-align: center;
            color: #64748b;
            font-size: 12px;
          }

          @media print {
            body {
              padding: 20px;
            }
          }
        </style>
      </head>

      <body>

        <div class="header">

          <div>
            <div class="title">
              BON DE COMMANDE
            </div>

            <div class="reference">
              Référence :
              <strong>
                ${escapeHtml(
                  order.reference
                )}
              </strong>
            </div>

            <div class="reference">
              Date :
              ${escapeHtml(
                formatDate(
                  order.date
                )
              )}
            </div>
          </div>

          <div>
            <strong>ACHAT</strong>
          </div>

          ${companyInfo}

        </div>

        <div class="supplier-box">

          <div class="supplier-title">
            FOURNISSEUR
          </div>

          <div>
            <strong>
              ${escapeHtml(
                supplierName
              )}
            </strong>
          </div>

          ${
            supplierContact
              ? `<div>Contact : ${escapeHtml(
                  supplierContact
                )}</div>`
              : ''
          }

          ${
            supplierPhone
              ? `<div>Téléphone : ${escapeHtml(
                  supplierPhone
                )}</div>`
              : ''
          }

          ${
            supplierEmail
              ? `<div>Email : ${escapeHtml(
                  supplierEmail
                )}</div>`
              : ''
          }

          ${
            supplierRC
              ? `<div>RC : ${escapeHtml(
                  supplierRC
                )}</div>`
              : ''
          }

          ${
            supplierNIF
              ? `<div>NIF : ${escapeHtml(
                  supplierNIF
                )}</div>`
              : ''
          }

          ${
            supplierAI
              ? `<div>AI : ${escapeHtml(
                  supplierAI
                )}</div>`
              : ''
          }

        </div>

        <table>

          <thead>
            <tr>
              <th>Produit</th>
              <th>Quantité</th>
              <th>Prix unitaire</th>
              <th>Total</th>
            </tr>
          </thead>

          <tbody>
            ${rows}
          </tbody>

        </table>

        <div class="total">

          ${order.purchase.handling_fee > 0 ? `
            <div class="total-detail">
              <span>Sous-total</span>
              <span>${formatCurrency(order.total)}</span>
            </div>
            <div class="total-detail">
              <span>Manutention</span>
              <span>${formatCurrency(order.purchase.handling_fee)}</span>
            </div>
          ` : ''}

          <div class="total-box">

            <span>
              TOTAL
            </span>

            <span>
              ${formatCurrency(
                order.total + (order.purchase.handling_fee || 0)
              )}
            </span>

          </div>

        </div>

        ${
          order.purchase.notes
            ? `
              <div class="notes">
                <strong>Notes :</strong>
                <br />
                ${escapeHtml(
                  order.purchase.notes
                )}
              </div>
            `
            : ''
        }

        <div class="footer">
          Bon de commande généré à partir
          de l'achat ${escapeHtml(
            order.purchase.reference
          )}
        </div>

      </body>
      </html>
    `);

    printWindow.document.close();

    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 300);
  }

  function escapeHtml(
    value: string
  ): string {
    return value
      .replace(
        /&/g,
        '&amp;'
      )
      .replace(
        /</g,
        '&lt;'
      )
      .replace(
        />/g,
        '&gt;'
      )
      .replace(
        /"/g,
        '&quot;'
      )
      .replace(
        /'/g,
        '&#039;'
      );
  }

  const filteredPurchases = purchases.filter((p) => {
    if (filterSupplier && p.supplier_id !== filterSupplier) return false;
    if (filterDateFrom && p.purchase_date < filterDateFrom) return false;
    if (filterDateTo && p.purchase_date > filterDateTo) return false;
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
          <h1 className="text-2xl font-bold text-slate-800">
            Achats
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            {filteredPurchases.length} achat(s)
          </p>
        </div>

        <Button onClick={openAdd}>
          <Plus className="w-4 h-4" />
          Nouvel achat
        </Button>

      </div>

      {/* Filtres */}

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterSupplier}
            onChange={(e) => setFilterSupplier(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Tous les fournisseurs</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
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
        {(filterSupplier || filterDateFrom || filterDateTo) && (
          <button
            onClick={() => { setFilterSupplier(''); setFilterDateFrom(''); setFilterDateTo(''); }}
            className="px-3 py-2.5 rounded-lg text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Liste */}

      {filteredPurchases.length === 0 ? (

        <Card>

          <EmptyState
            icon={ShoppingCart}
            title="Aucun achat"
            description="Enregistrez vos achats auprès de vos fournisseurs."
            action={
              <Button onClick={openAdd}>
                <Plus className="w-4 h-4" />
                Créer un achat
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
                    Fournisseur
                  </th>

                  <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden lg:table-cell">
                    Date
                  </th>

                  <th className="text-right font-semibold text-slate-600 px-4 py-3 hidden xl:table-cell">
                    Manutention
                  </th>

                  <th className="text-right font-semibold text-slate-600 px-4 py-3">
                    Total
                  </th>

                  <th className="text-right font-semibold text-slate-600 px-4 py-3 hidden sm:table-cell">
                    Payé
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

                {filteredPurchases.map((p) => (

                  <tr
                    key={p.id}
                    className="hover:bg-slate-50 transition-colors"
                  >

                    <td className="px-4 py-3 font-medium text-slate-800">
                      {p.reference}
                    </td>

                    <td className="px-4 py-3 hidden md:table-cell text-slate-600">
                      {p.supplier?.name || '—'}
                    </td>

                    <td className="px-4 py-3 hidden lg:table-cell text-slate-600">
                      {formatDate(
                        p.purchase_date
                      )}
                    </td>

                    <td className="px-4 py-3 text-right hidden xl:table-cell text-slate-600">
                      {p.handling_fee > 0 ? formatCurrency(p.handling_fee) : '—'}
                    </td>

                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {formatCurrency(
                        p.total_amount
                      )}
                    </td>

                    <td className="px-4 py-3 text-right hidden sm:table-cell text-slate-600">
                      {formatCurrency(
                        p.paid_amount
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <Badge status={p.status} />
                    </td>

                    <td className="px-4 py-3">

                      <div className="flex items-center justify-end gap-1">

                        {/* Détails */}

                        <button
                          onClick={() =>
                            openDetail(p)
                          }
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Bon de commande */}

                        <button
                          onClick={() =>
                            openPurchaseOrder(
                              p
                            )
                          }
                          disabled={
                            loadingPurchaseOrder
                          }
                          className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                          title="Bon de commande"
                        >
                          <FileText className="w-4 h-4" />
                        </button>

                        {/* Paiement */}

                        {p.paid_amount <
                          p.total_amount && (

                          <button
                            onClick={() =>
                              openPayment(p)
                            }
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Paiement"
                          >
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

      {/* =====================================================
          MODAL CRÉATION ACHAT
          ===================================================== */}

      <Modal
        open={modalOpen}
        onClose={() =>
          setModalOpen(false)
        }
        title="Nouvel achat"
        size="xl"
      >

        <div className="space-y-4">

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            <Select
              label="Fournisseur"
              value={form.supplier_id}
              onChange={(v) =>
                setForm({
                  ...form,
                  supplier_id: v,
                })
              }
              options={suppliers.map(
                (s) => ({
                  value: s.id,
                  label: s.name,
                })
              )}
              placeholder="Sélectionner..."
            />

            <Input
              label="Référence"
              value={form.reference}
              onChange={(v) =>
                setForm({
                  ...form,
                  reference: v,
                })
              }
              required
            />

            <Input
              label="Date"
              type="date"
              value={
                form.purchase_date
              }
              onChange={(v) =>
                setForm({
                  ...form,
                  purchase_date: v,
                })
              }
            />

          </div>

          <Input
            label="Frais de manutention"
            type="number"
            step="0.01"
            value={form.handling_fee}
            onChange={(v) =>
              setForm({
                ...form,
                handling_fee: v,
              })
            }
          />

          <div>

            <div className="flex items-center justify-between mb-2">

              <label className="text-sm font-medium text-slate-700">
                Lignes d'achat
              </label>

              <Button
                size="sm"
                variant="secondary"
                onClick={addItem}
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter une ligne
              </Button>

            </div>

            <div className="space-y-2">

              {items.map(
                (it, i) => (

                  <div
                    key={i}
                    className="flex gap-2 items-start"
                  >

                    <select
                      value={
                        it.product_id
                      }
                      onChange={(e) =>
                        updateItem(
                          i,
                          'product_id',
                          e.target.value
                        )
                      }
                      className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >

                      <option value="">
                        Sélectionner un produit...
                      </option>

                      {products.map(
                        (p) => (
                          <option
                            key={p.id}
                            value={p.id}
                          >
                            {p.name}
                          </option>
                        )
                      )}

                    </select>

                    <input
                      type="number"
                      step="0.01"
                      placeholder="Qté"
                      value={
                        it.quantity
                      }
                      onChange={(e) =>
                        updateItem(
                          i,
                          'quantity',
                          e.target.value
                        )
                      }
                      className="w-20 px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <input
                      type="number"
                      step="0.01"
                      placeholder="Prix"
                      value={
                        it.unit_price
                      }
                      onChange={(e) =>
                        updateItem(
                          i,
                          'unit_price',
                          e.target.value
                        )
                      }
                      className="w-24 px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <div className="w-24 text-right py-2.5 text-sm font-medium text-slate-700">

                      {formatCurrency(
                        (parseFloat(
                          it.quantity
                        ) || 0) *
                          (parseFloat(
                            it.unit_price
                          ) || 0)
                      )}

                    </div>

                    {items.length >
                      1 && (

                      <button
                        onClick={() =>
                          removeItem(i)
                        }
                        className="p-2.5 text-slate-400 hover:text-red-600 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>

                    )}

                  </div>

                )
              )}

            </div>

            <div className="flex justify-end mt-3 text-lg font-bold text-slate-800 flex-col items-end gap-1">
              <div className="text-sm font-normal text-slate-500">
                Sous-total : {formatCurrency(itemsTotal)}
              </div>
              <div className="text-sm font-normal text-slate-500">
                Manutention : {formatCurrency(handlingFee)}
              </div>
              <div>
                Total :{' '}
                {formatCurrency(totalAmount)}
              </div>
            </div>

          </div>

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(v) =>
              setForm({
                ...form,
                notes: v,
              })
            }
          />

          <div className="flex gap-3 pt-2">

            <Button
              variant="secondary"
              onClick={() =>
                setModalOpen(false)
              }
              className="flex-1"
            >
              Annuler
            </Button>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1"
            >
              {saving
                ? 'Enregistrement...'
                : "Créer l'achat"}
            </Button>

          </div>

        </div>

      </Modal>

      {/* =====================================================
          MODAL DÉTAIL ACHAT
          ===================================================== */}

      <Modal
        open={!!detailPurchase}
        onClose={() =>
          setDetailPurchase(null)
        }
        title={
          detailPurchase?.reference ||
          ''
        }
        subtitle={
          detailPurchase?.supplier
            ?.name ||
          'Fournisseur non spécifié'
        }
        size="lg"
      >

        {detailPurchase && (

          <div className="space-y-4">

            <div className="flex items-center gap-4">

              <Badge
                status={
                  detailPurchase.status
                }
              />

              <span className="text-sm text-slate-500">
                {formatDate(
                  detailPurchase.purchase_date
                )}
              </span>

            </div>

            <div className="grid grid-cols-3 gap-4">

              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-500">
                  Total
                </p>

                <p className="text-lg font-bold text-slate-800">
                  {formatCurrency(
                    detailPurchase.total_amount
                  )}
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-500">
                  Payé
                </p>

                <p className="text-lg font-bold text-emerald-600">
                  {formatCurrency(
                    detailPurchase.paid_amount
                  )}
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-500">
                  Reste à payer
                </p>

                <p className="text-lg font-bold text-amber-600">
                  {formatCurrency(
                    detailPurchase.total_amount -
                      detailPurchase.paid_amount
                  )}
                </p>
              </div>

            </div>

            {detailPurchase.handling_fee > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700 flex items-center justify-between">
                <span>Frais de manutention</span>
                <span className="font-semibold">{formatCurrency(detailPurchase.handling_fee)}</span>
              </div>
            )}

            <div>

              <h4 className="font-semibold text-slate-700 mb-2 text-sm">
                Produits
              </h4>

              <div className="border border-slate-200 rounded-lg overflow-hidden">

                <table className="w-full text-sm">

                  <thead className="bg-slate-50">

                    <tr>

                      <th className="text-left px-3 py-2 font-medium text-slate-600">
                        Produit
                      </th>

                      <th className="text-right px-3 py-2 font-medium text-slate-600">
                        Qté
                      </th>

                      <th className="text-right px-3 py-2 font-medium text-slate-600">
                        Prix unit.
                      </th>

                      <th className="text-right px-3 py-2 font-medium text-slate-600">
                        Total
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {detailPurchase.purchase_items?.map(
                      (it) => (

                        <tr key={it.id}>

                          <td className="px-3 py-2 text-slate-700">
                            {it.product?.name ||
                              '—'}
                          </td>

                          <td className="px-3 py-2 text-right text-slate-600">
                            {it.quantity}
                          </td>

                          <td className="px-3 py-2 text-right text-slate-600">
                            {formatCurrency(
                              it.unit_price
                            )}
                          </td>

                          <td className="px-3 py-2 text-right font-medium text-slate-700">
                            {formatCurrency(
                              it.total
                            )}
                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            </div>

            {detailPurchase.purchase_payments &&
              detailPurchase.purchase_payments.length >
                0 && (

              <div>

                <h4 className="font-semibold text-slate-700 mb-2 text-sm">
                  Paiements
                </h4>

                <div className="space-y-2">

                  {detailPurchase.purchase_payments.map(
                    (pay) => (

                      <div
                        key={pay.id}
                        className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg text-sm"
                      >

                        <span className="text-slate-600">
                          {formatDate(
                            pay.payment_date
                          )}{' '}
                          ·{' '}
                          {pay.method}
                        </span>

                        <span className="font-medium text-emerald-600">
                          {formatCurrency(
                            pay.amount
                          )}
                        </span>

                      </div>

                    )
                  )}

                </div>

              </div>

            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              <Button
                variant="secondary"
                onClick={() =>
                  openPurchaseOrder(
                    detailPurchase
                  )
                }
                className="w-full"
              >
                <FileText className="w-4 h-4" />
                Bon de commande
              </Button>

              {detailPurchase.paid_amount <
                detailPurchase.total_amount && (

                <Button
                  onClick={() => {
                    const p =
                      detailPurchase;

                    setDetailPurchase(
                      null
                    );

                    openPayment(p);
                  }}
                  className="w-full"
                >
                  <CreditCard className="w-4 h-4" />
                  Ajouter un paiement
                </Button>

              )}

            </div>

          </div>

        )}

      </Modal>

      {/* =====================================================
          MODAL BON DE COMMANDE
          ===================================================== */}

      <Modal
        open={
          !!purchaseOrderModal
        }
        onClose={() =>
          setPurchaseOrderModal(null)
        }
        title="Bon de commande"
        size="xl"
      >

        {purchaseOrderModal && (

          <div className="space-y-6">

            {/* En-tête du bon */}

            <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-slate-200 pb-5">

              <div>

                <h2 className="text-2xl font-bold text-slate-800">
                  BON DE COMMANDE
                </h2>

                <div className="mt-2 space-y-1 text-sm text-slate-600">

                  <p>
                    Référence :{' '}
                    <span className="font-semibold text-slate-800">
                      {
                        purchaseOrderModal.reference
                      }
                    </span>
                  </p>

                  <p>
                    Date :{' '}
                    <span className="font-medium">
                      {formatDate(
                        purchaseOrderModal.date
                      )}
                    </span>
                  </p>

                </div>

              </div>

              <div className="text-left sm:text-right">

                {settings && (
                  <div className="text-sm text-slate-600 space-y-0.5">
                    {settings.company_name && (
                      <p className="font-bold text-slate-800">{settings.company_name}</p>
                    )}
                    {settings.company_address && (
                      <p>{settings.company_address}</p>
                    )}
                    {settings.company_phone && (
                      <p>Tél : {settings.company_phone}</p>
                    )}
                    {settings.company_email && (
                      <p>{settings.company_email}</p>
                    )}
                    {(settings.rc || settings.nif || settings.ai) && (
                      <p className="text-xs text-slate-400">
                        {settings.rc && `RC: ${settings.rc} · `}
                        {settings.nif && `NIF: ${settings.nif} · `}
                        {settings.ai && `AI: ${settings.ai}`}
                      </p>
                    )}
                  </div>
                )}

              </div>

            </div>

            {/* Fournisseur */}

            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">

              <h3 className="font-semibold text-slate-800 mb-3">
                FOURNISSEUR
              </h3>

              {purchaseOrderModal.supplier ? (

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">

                  <div>
                    <span className="text-slate-500">
                      Nom :
                    </span>{' '}
                    <span className="font-medium text-slate-800">
                      {
                        purchaseOrderModal
                          .supplier.name
                      }
                    </span>
                  </div>

                  {purchaseOrderModal
                    .supplier
                    .contact_person && (

                    <div>
                      <span className="text-slate-500">
                        Contact :
                      </span>{' '}
                      {
                        purchaseOrderModal
                          .supplier
                          .contact_person
                      }
                    </div>

                  )}

                  {purchaseOrderModal
                    .supplier
                    .phone && (

                    <div>
                      <span className="text-slate-500">
                        Téléphone :
                      </span>{' '}
                      {
                        purchaseOrderModal
                          .supplier
                          .phone
                      }
                    </div>

                  )}

                  {purchaseOrderModal
                    .supplier
                    .email && (

                    <div>
                      <span className="text-slate-500">
                        Email :
                      </span>{' '}
                      {
                        purchaseOrderModal
                          .supplier
                          .email
                      }
                    </div>

                  )}

                  {purchaseOrderModal
                    .supplier
                    .address && (

                    <div className="sm:col-span-2">

                      <span className="text-slate-500">
                        Adresse :
                      </span>{' '}

                      {
                        purchaseOrderModal
                          .supplier
                          .address
                      }

                    </div>

                  )}

                  {purchaseOrderModal.supplier.rc && (
                    <div>
                      <span className="text-slate-500">RC :</span>{' '}
                      {purchaseOrderModal.supplier.rc}
                    </div>
                  )}

                  {purchaseOrderModal.supplier.nif && (
                    <div>
                      <span className="text-slate-500">NIF :</span>{' '}
                      {purchaseOrderModal.supplier.nif}
                    </div>
                  )}

                  {purchaseOrderModal.supplier.ai && (
                    <div>
                      <span className="text-slate-500">AI :</span>{' '}
                      {purchaseOrderModal.supplier.ai}
                    </div>
                  )}

                </div>

              ) : (

                <p className="text-sm text-slate-500">
                  Aucun fournisseur
                  spécifié
                </p>

              )}

            </div>

            {/* Produits */}

            <div>

              <h3 className="font-semibold text-slate-800 mb-3">
                PRODUITS COMMANDÉS
              </h3>

              <div className="border border-slate-200 rounded-xl overflow-hidden">

                <div className="overflow-x-auto">

                  <table className="w-full text-sm">

                    <thead className="bg-slate-50 border-b border-slate-200">

                      <tr>

                        <th className="text-left px-4 py-3 font-semibold text-slate-600">
                          #
                        </th>

                        <th className="text-left px-4 py-3 font-semibold text-slate-600">
                          Produit
                        </th>

                        <th className="text-right px-4 py-3 font-semibold text-slate-600">
                          Quantité
                        </th>

                        <th className="text-right px-4 py-3 font-semibold text-slate-600">
                          Prix unitaire
                        </th>

                        <th className="text-right px-4 py-3 font-semibold text-slate-600">
                          Total
                        </th>

                      </tr>

                    </thead>

                    <tbody className="divide-y divide-slate-100">

                      {purchaseOrderModal.items.length >
                      0 ? (

                        purchaseOrderModal.items.map(
                          (item, index) => (

                            <tr
                              key={item.id}
                              className="hover:bg-slate-50"
                            >

                              <td className="px-4 py-3 text-slate-500">
                                {index + 1}
                              </td>

                              <td className="px-4 py-3 font-medium text-slate-800">
                                {item.product
                                  ?.name ||
                                  'Produit supprimé'}
                              </td>

                              <td className="px-4 py-3 text-right text-slate-600">
                                {item.quantity}
                              </td>

                              <td className="px-4 py-3 text-right text-slate-600">
                                {formatCurrency(
                                  item.unit_price
                                )}
                              </td>

                              <td className="px-4 py-3 text-right font-medium text-slate-800">
                                {formatCurrency(
                                  item.total
                                )}
                              </td>

                            </tr>

                          )
                        )

                      ) : (

                        <tr>

                          <td
                            colSpan={5}
                            className="px-4 py-8 text-center text-slate-500"
                          >
                            Aucun produit
                            dans cet achat.
                          </td>

                        </tr>

                      )}

                    </tbody>

                  </table>

                </div>

              </div>

            </div>

            {/* Total */}

            <div className="flex justify-end">

              <div className="w-full sm:w-80 border-2 border-slate-800 rounded-xl overflow-hidden">

                {purchaseOrderModal.purchase.handling_fee > 0 && (
                  <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
                    <span className="text-sm text-slate-600">Sous-total</span>
                    <span className="text-sm font-medium text-slate-700">
                      {formatCurrency(purchaseOrderModal.total)}
                    </span>
                  </div>
                )}

                {purchaseOrderModal.purchase.handling_fee > 0 && (
                  <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
                    <span className="text-sm text-slate-600">Manutention</span>
                    <span className="text-sm font-medium text-slate-700">
                      {formatCurrency(purchaseOrderModal.purchase.handling_fee)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between px-5 py-4">

                  <span className="font-bold text-slate-800">
                    TOTAL
                  </span>

                  <span className="text-xl font-bold text-slate-800">
                    {formatCurrency(
                      purchaseOrderModal.total + (purchaseOrderModal.purchase.handling_fee || 0)
                    )}
                  </span>

                </div>

              </div>

            </div>

            {/* Notes */}

            {purchaseOrderModal.purchase
              .notes && (

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">

                <h3 className="font-semibold text-slate-700 mb-2">
                  Notes
                </h3>

                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                  {
                    purchaseOrderModal
                      .purchase
                      .notes
                  }
                </p>

              </div>

            )}

            {/* Actions */}

            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-200">

              <Button
                variant="secondary"
                onClick={() =>
                  setPurchaseOrderModal(
                    null
                  )
                }
                className="flex-1"
              >
                Fermer
              </Button>

              <Button
                onClick={
                  printPurchaseOrder
                }
                className="flex-1"
              >
                <Printer className="w-4 h-4" />
                Imprimer le bon
              </Button>

            </div>

          </div>

        )}

      </Modal>

      {/* =====================================================
          MODAL PAIEMENT
          ===================================================== */}

      <Modal
        open={!!paymentModal}
        onClose={() =>
          setPaymentModal(null)
        }
        title="Ajouter un paiement"
        subtitle={
          paymentModal?.reference
        }
        size="sm"
      >

        <div className="space-y-4">

          {paymentModal && (

            <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-700">

              Reste à payer :{' '}

              {formatCurrency(
                paymentModal.total_amount -
                  paymentModal.paid_amount
              )}

            </div>

          )}

          <Input
            label="Montant"
            type="number"
            step="0.01"
            value={payment.amount}
            onChange={(v) =>
              setPayment({
                ...payment,
                amount: v,
              })
            }
            required
          />

          <Select
            label="Méthode"
            value={payment.method}
            onChange={(v) =>
              setPayment({
                ...payment,
                method: v,
              })
            }
            options={[
              {
                value: 'espèces',
                label: 'Espèces',
              },
              {
                value: 'chèque',
                label: 'Chèque',
              },
              {
                value: 'virement',
                label: 'Virement',
              },
              {
                value: 'carte',
                label: 'Carte bancaire',
              },
            ]}
          />

          <Input
            label="Date"
            type="date"
            value={
              payment.payment_date
            }
            onChange={(v) =>
              setPayment({
                ...payment,
                payment_date: v,
              })
            }
          />

          <Input
            label="Notes"
            value={payment.notes}
            onChange={(v) =>
              setPayment({
                ...payment,
                notes: v,
              })
            }
          />

          <div className="flex gap-3 pt-2">

            <Button
              variant="secondary"
              onClick={() =>
                setPaymentModal(null)
              }
              className="flex-1"
            >
              Annuler
            </Button>

            <Button
              onClick={handlePayment}
              disabled={saving}
              className="flex-1"
            >
              {saving
                ? '...'
                : 'Enregistrer'}
            </Button>

          </div>

        </div>

      </Modal>

    </div>
  );
}

