
import { useState, useEffect } from 'react';
import {
  Plus,
  TrendingUp,
  Eye,
  CreditCard,
  X,
  Receipt,
  Truck,
  Printer,
  Search,
  Filter,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import {
  formatCurrency,
  formatDate,
  generateSalesRef,
  generateBLRef,
  generateFTRef,
  getNextSeq,
} from '@/lib/utils';
import { useAuth } from '@/lib/auth';

import type {
  Product,
  Customer,
  Sale,
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

interface ItemRow {
  product_id: string;
  quantity: string;
  unit_price: string;
}

interface SaleItemDocument {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total: number;
  product?: Product | null;
}

interface DocumentData {
  reference: string;
  date: string;
  sale: Sale;
  customer: Customer | null;
  items: SaleItemDocument[];
  total: number;
}

export default function Sales() {
  const { settings } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [paymentModal, setPaymentModal] =
    useState<Sale | null>(null);

  // Facture
  const [invoiceModal, setInvoiceModal] =
    useState<DocumentData | null>(null);

  // Bon de livraison
  const [deliveryModal, setDeliveryModal] =
    useState<DocumentData | null>(null);

  const [saving, setSaving] = useState(false);
  const [loadingDocument, setLoadingDocument] =
    useState(false);

  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const [form, setForm] = useState({
    customer_type:
      'registered' as 'registered' | 'walkin',

    customer_id: '',

    customer_name: '',

    reference: '',

    sale_date: new Date()
      .toISOString()
      .slice(0, 10),

    status: 'pending',

    notes: '',

    create_invoice: true,
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
    payment_date: new Date()
      .toISOString()
      .slice(0, 10),
    notes: '',
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const [
      sRes,
      prodRes,
      custRes,
    ] = await Promise.all([
      supabase
        .from('sales')
        .select('*')
        .order('created_at', {
          ascending: false,
        }),

      supabase
        .from('products')
        .select('*')
        .order('name'),

      supabase
        .from('customers')
        .select('*')
        .order('name'),
    ]);

    const custList =
      custRes.data || [];

    const enriched =
      (sRes.data || []).map(
        (s: any) => ({
          ...s,

          customer:
            custList.find(
              (c) =>
                c.id ===
                s.customer_id
            ) || null,
        })
      );

    setSales(enriched);
    setProducts(
      prodRes.data || []
    );
    setCustomers(custList);

    setLoading(false);
  }

  async function openAdd() {
    const seq = await getNextSeq('sales');
    setForm({
      customer_type: 'registered',
      customer_id: '',
      customer_name: '',
      reference: generateSalesRef(seq),
      sale_date: new Date()
        .toISOString()
        .slice(0, 10),
      status: 'pending',
      notes: '',
      create_invoice: true,
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
      items.filter(
        (_, idx) => idx !== i
      )
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
        next[i].unit_price =
          String(prod.sale_price);
      }
    }

    setItems(next);
  }

  const totalAmount =
    items.reduce(
      (sum, it) =>
        sum +
        (parseFloat(
          it.quantity
        ) || 0) *
          (parseFloat(
            it.unit_price
          ) || 0),
      0
    );

  async function handleSave() {
    if (
      !form.reference.trim() ||
      items.length === 0
    ) {
      return;
    }

    setSaving(true);

    try {
      const customerId =
        form.customer_type ===
        'registered'
          ? form.customer_id || null
          : null;

      const customerName =
        form.customer_type ===
        'walkin'
          ? form.customer_name.trim()
          : '';

      const {
        data: sale,
        error,
      } = await supabase
        .from('sales')
        .insert({
          customer_id:
            customerId,

          customer_name:
            customerName,

          reference:
            form.reference,

          status:
            form.status,

          total_amount:
            totalAmount,

          paid_amount: 0,

          sale_date:
            form.sale_date,

          notes:
            form.notes,
        })
        .select()
        .single();

      if (error || !sale) {
        console.error(
          'Erreur création vente:',
          error
        );

        return;
      }

      const itemRows =
        items
          .filter(
            (it) =>
              it.product_id
          )
          .map((it) => ({
            sale_id: sale.id,

            product_id:
              it.product_id,

            quantity:
              parseFloat(
                it.quantity
              ) || 0,

            unit_price:
              parseFloat(
                it.unit_price
              ) || 0,

            total:
              (parseFloat(
                it.quantity
              ) || 0) *
              (parseFloat(
                it.unit_price
              ) || 0),
          }));

      if (
        itemRows.length > 0
      ) {
        await supabase
          .from('sale_items')
          .insert(itemRows);

        for (const it of itemRows) {
          const prod =
            products.find(
              (p) =>
                p.id ===
                it.product_id
            );

          if (prod) {
            await supabase
              .from('products')
              .update({
                stock_quantity:
                  Math.max(
                    0,
                    prod.stock_quantity -
                      it.quantity
                  ),
              })
              .eq(
                'id',
                it.product_id
              );
          }
        }
      }

      if (
        form.create_invoice
      ) {
        const ftSeq = await getNextSeq('invoices');
        await supabase
          .from('invoices')
          .insert({
            sale_id: sale.id,
            customer_id: customerId,
            reference: generateFTRef(ftSeq),
            total_amount: totalAmount,
            paid_amount: 0,
            status: 'unpaid',
            issue_date: form.sale_date,
            due_date: null,
            notes: '',
          });
      }

      setModalOpen(false);

      await load();
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(
    s: Sale
  ) {
    const [
      itemsRes,
      paymentsRes,
    ] = await Promise.all([
      supabase
        .from('sale_items')
        .select('*')
        .eq(
          'sale_id',
          s.id
        ),

      supabase
        .from('sale_payments')
        .select('*')
        .eq(
          'sale_id',
          s.id
        )
        .order('payment_date'),
    ]);

    const enrichedItems =
      (itemsRes.data || []).map(
        (it: any) => ({
          ...it,

          product:
            products.find(
              (prod) =>
                prod.id ===
                it.product_id
            ) || null,
        })
      );

    setDetailSale({
      ...s,

      sale_items:
        enrichedItems,

      sale_payments:
        paymentsRes.data || [],
    });
  }

  /**
   * Charge les données communes
   * utilisées par la facture et
   * le bon de livraison.
   */
  async function loadDocumentData(
    sale: Sale
  ): Promise<DocumentData | null> {
    const {
      data,
      error,
    } = await supabase
      .from('sale_items')
      .select('*')
      .eq(
        'sale_id',
        sale.id
      );

    if (error) {
      console.error(
        'Erreur chargement lignes vente:',
        error
      );

      return null;
    }

    const documentItems: SaleItemDocument[] =
      (data || []).map(
        (item: any) => ({
          id: item.id,

          product_id:
            item.product_id,

          quantity:
            Number(item.quantity) ||
            0,

          unit_price:
            Number(
              item.unit_price
            ) || 0,

          total:
            Number(item.total) ||
            0,

          product:
            products.find(
              (product) =>
                product.id ===
                item.product_id
            ) || null,
        })
      );

    const total =
      documentItems.reduce(
        (sum, item) =>
          sum +
          Number(
            item.total || 0
          ),
        0
      );

    let documentReference =
      sale.reference;

    return {
      reference:
        documentReference,

      date:
        sale.sale_date,

      sale,

      customer:
        sale.customer ||
        customers.find(
          (c) =>
            c.id ===
            sale.customer_id
        ) ||
        null,

      items:
        documentItems,

      total,
    };
  }

  /**
   * Ouvre la facture.
   */
  async function openInvoice(
    sale: Sale
  ) {
    setLoadingDocument(true);

    try {
      const data =
        await loadDocumentData(
          sale
        );

      if (!data) {
        return;
      }

      /*
       * On recherche la facture
       * déjà créée pour cette vente
       * afin d'afficher sa référence.
       */
      const {
        data: invoice,
      } = await supabase
        .from('invoices')
        .select('*')
        .eq(
          'sale_id',
          sale.id
        )
        .maybeSingle();

      if (invoice) {
        data.reference =
          invoice.reference;
      } else {
        const ftSeq = await getNextSeq('invoices');
        await supabase
          .from('invoices')
          .insert({
            sale_id: sale.id,
            customer_id: sale.customer_id,
            reference: generateFTRef(ftSeq),
            total_amount: sale.total_amount,
            paid_amount: sale.paid_amount,
            status: sale.paid_amount >= sale.total_amount ? 'paid' : 'unpaid',
            issue_date: sale.sale_date,
            due_date: null,
            notes: '',
          });
        data.reference = generateFTRef(ftSeq);
      }

      setInvoiceModal(data);
    } finally {
      setLoadingDocument(false);
    }
  }

  /**
   * Ouvre le bon de livraison.
   *
   * Le document est généré
   * directement depuis la vente.
   */
  async function openDeliveryNote(
    sale: Sale
  ) {
    setLoadingDocument(true);

    try {
      const data =
        await loadDocumentData(
          sale
        );

      if (!data) {
        return;
      }

      const blSeq = await getNextSeq('delivery_notes');
      data.reference = generateBLRef(blSeq);

      setDeliveryModal(data);
    } finally {
      setLoadingDocument(false);
    }
  }

  function openPayment(
    s: Sale
  ) {
    setPayment({
      amount: String(
        (
          s.total_amount -
          s.paid_amount
        ).toFixed(2)
      ),

      method: 'espèces',

      payment_date:
        new Date()
          .toISOString()
          .slice(0, 10),

      notes: '',
    });

    setPaymentModal(s);
  }

  async function handlePayment() {
    if (!paymentModal) {
      return;
    }

    const amt =
      parseFloat(
        payment.amount
      ) || 0;

    setSaving(true);

    try {
      await supabase
        .from(
          'sale_payments'
        )
        .insert({
          sale_id:
            paymentModal.id,

          amount: amt,

          payment_date:
            payment.payment_date,

          method:
            payment.method,

          notes:
            payment.notes,
        });

      const newPaid =
        paymentModal.paid_amount +
        amt;

      const newStatus =
        newPaid >=
        paymentModal.total_amount
          ? 'delivered'
          : paymentModal.status;

      await supabase
        .from('sales')
        .update({
          paid_amount:
            newPaid,

          status:
            newStatus,
        })
        .eq(
          'id',
          paymentModal.id
        );

      const invStatus =
        newPaid >=
        paymentModal.total_amount
          ? 'paid'
          : 'partial';

      await supabase
        .from('invoices')
        .update({
          paid_amount:
            newPaid,

          status:
            invStatus,
        })
        .eq(
          'sale_id',
          paymentModal.id
        );

      setPaymentModal(null);

      await load();
    } finally {
      setSaving(false);
    }
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

  /**
   * Impression d'une facture
   * ou d'un bon de livraison.
   */
  function printDocument(
    data: DocumentData,
    type:
      | 'invoice'
      | 'delivery'
  ) {
    const isInvoice =
      type === 'invoice';

    const title = isInvoice
      ? 'FACTURE'
      : 'BON DE LIVRAISON';

    const customerName =
      data.customer?.name ||
      data.sale.customer_name ||
      'Client de passage';

    const customerPhone =
      data.customer?.phone ||
      '';

    const customerEmail =
      data.customer?.email ||
      '';

    const customerAddress =
      data.customer?.address ||
      '';

    const customerRC =
      data.customer?.rc ||
      ''

    const customerNIF =
      data.customer?.nif ||
      ''

    const customerAI =
      data.customer?.ai ||
      ''

    const company = settings;

    const companyInfo = company && (company.company_name || company.company_address || company.company_logo)
      ? `
        <div class="company-box">
          ${company.company_logo ? `<img src="${company.company_logo}" alt="Logo" class="company-logo" />` : ''}
          ${company.company_name ? `<div class="company-name">${escapeHtml(company.company_name)}</div>` : ''}
          ${company.company_address ? `<div>${escapeHtml(company.company_address)}</div>` : ''}
          ${company.company_phone ? `<div>Tél : ${escapeHtml(company.company_phone)}${company.company_phone2 ? ` / ${escapeHtml(company.company_phone2)}` : ''}</div>` : ''}
          ${company.company_email ? `<div>${escapeHtml(company.company_email)}</div>` : ''}
          ${(company.rc || company.nif || company.ai) ? `<div class="company-ids">${company.rc ? `RC: ${escapeHtml(company.rc)} · ` : ''}${company.nif ? `NIF: ${escapeHtml(company.nif)} · ` : ''}${company.ai ? `AI: ${escapeHtml(company.ai)}` : ''}</div>` : ''}
        </div>
      `
      : '';

    const rows =
      data.items
        .map(
          (item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>
                ${escapeHtml(
                  item.product
                    ?.name ||
                    'Produit'
                )}
              </td>
              <td>
                ${item.quantity}
              </td>
              ${
                isInvoice
                  ? `
                    <td>
                      ${formatCurrency(
                        item.unit_price
                      )}
                    </td>
                    <td>
                      ${formatCurrency(
                        item.total
                      )}
                    </td>
                  `
                  : ''
              }
            </tr>
          `
        )
        .join('');

    const totalSection =
      isInvoice
        ? `
          <div class="total-container">
            <div class="total-box">
              <span>TOTAL</span>
              <strong>
                ${formatCurrency(
                  data.total
                )}
              </strong>
            </div>
          </div>
        `
        : '';

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
          ${title}
          ${escapeHtml(
            data.reference
          )}
        </title>

        <style>

          * {
            box-sizing: border-box;
          }

          body {
            font-family:
              Arial,
              Helvetica,
              sans-serif;

            margin: 0;

            padding: 40px;

            color: #1e293b;
          }

          .header {
            display: flex;

            justify-content:
              space-between;

            align-items:
              flex-start;

            border-bottom:
              2px solid #1e293b;

            padding-bottom:
              20px;

            margin-bottom:
              30px;
          }

          .company-box {
            text-align: right;
            font-size: 13px;
            color: #475569;
          }

          .company-logo {
            max-width: 120px;
            max-height: 80px;
            margin-bottom: 6px;
            object-fit: contain;
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

            margin-bottom:
              10px;
          }

          .reference {
            font-size: 14px;

            color: #475569;

            margin-top: 5px;
          }

          .client {
            border:
              1px solid #cbd5e1;

            border-radius:
              8px;

            padding: 18px;

            margin-bottom:
              25px;
          }

          .client-title {
            font-size: 16px;

            font-weight: bold;

            margin-bottom:
              10px;
          }

          .client div {
            margin-top: 4px;
          }

          table {
            width: 100%;

            border-collapse:
              collapse;

            margin-top: 20px;
          }

          th {
            background:
              #f1f5f9;

            padding: 12px;

            border:
              1px solid #cbd5e1;

            text-align:
              left;
          }

          td {
            padding: 12px;

            border:
              1px solid #cbd5e1;
          }

          th:first-child,
          td:first-child {
            width: 50px;

            text-align:
              center;
          }

          th:nth-child(n+3),
          td:nth-child(n+3) {
            text-align:
              right;
          }

          .total-container {
            display: flex;

            justify-content:
              flex-end;

            margin-top: 25px;
          }

          .total-box {
            width: 320px;

            display: flex;

            justify-content:
              space-between;

            padding: 15px;

            border:
              2px solid #1e293b;

            font-size: 18px;
          }

          .notes {
            margin-top: 30px;

            padding: 15px;

            background:
              #f8fafc;

            border:
              1px solid #e2e8f0;

            border-radius:
              6px;
          }

          .footer {
            margin-top: 60px;

            text-align:
              center;

            font-size: 12px;

            color: #64748b;
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
              ${title}
            </div>

            <div class="reference">
              Référence :
              <strong>
                ${escapeHtml(
                  data.reference
                )}
              </strong>
            </div>

            <div class="reference">
              Date :
              ${escapeHtml(
                formatDate(
                  data.date
                )
              )}
            </div>

          </div>

          ${companyInfo}

        </div>

        <div class="client">

          <div class="client-title">
            CLIENT
          </div>

          <div>
            <strong>
              ${escapeHtml(
                customerName
              )}
            </strong>
          </div>

          ${
            customerPhone
              ? `
                <div>
                  Téléphone :
                  ${escapeHtml(
                    customerPhone
                  )}
                </div>
              `
              : ''
          }

          ${
            customerEmail
              ? `
                <div>
                  Email :
                  ${escapeHtml(
                    customerEmail
                  )}
                </div>
              `
              : ''
          }

          ${
            customerAddress
              ? `
                <div>
                  Adresse :
                  ${escapeHtml(
                    customerAddress
                  )}
                </div>
              `
              : ''
          }

          ${
            customerRC
              ? `
                <div>
                  RC : ${escapeHtml(
                    customerRC
                  )}
                </div>
              `
              : ''
          }

          ${
            customerNIF
              ? `
                <div>
                  NIF : ${escapeHtml(
                    customerNIF
                  )}
                </div>
              `
              : ''
          }

          ${
            customerAI
              ? `
                <div>
                  AI : ${escapeHtml(
                    customerAI
                  )}
                </div>
              `
              : ''
          }

        </div>

        <table>

          <thead>

            <tr>

              <th>#</th>

              <th>Produit</th>

              <th>Quantité</th>

              ${
                isInvoice
                  ? `
                    <th>
                      Prix unitaire
                    </th>

                    <th>
                      Total
                    </th>
                  `
                  : ''
              }

            </tr>

          </thead>

          <tbody>

            ${rows}

          </tbody>

        </table>

        ${totalSection}

        ${
          data.sale.notes
            ? `
              <div class="notes">

                <strong>
                  Notes :
                </strong>

                <br />

                ${escapeHtml(
                  data.sale
                    .notes
                )}

              </div>
            `
            : ''
        }

        <div class="footer">

          ${
            isInvoice
              ? 'Document commercial - Facture'
              : 'Document de livraison - Bon de livraison'
          }

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

  const filteredSales = sales.filter((s) => {
    if (filterCustomer && s.customer_id !== filterCustomer) return false;
    if (filterDateFrom && s.sale_date < filterDateFrom) return false;
    if (filterDateTo && s.sale_date > filterDateTo) return false;
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
            Ventes
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            {filteredSales.length} vente(s)
          </p>

        </div>

        <Button
          onClick={openAdd}
        >
          <Plus className="w-4 h-4" />

          Nouvelle vente
        </Button>

      </div>

      {/* Filtres */}

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Tous les clients</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
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
        {(filterCustomer || filterDateFrom || filterDateTo) && (
          <button
            onClick={() => { setFilterCustomer(''); setFilterDateFrom(''); setFilterDateTo(''); }}
            className="px-3 py-2.5 rounded-lg text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Liste des ventes */}

      {filteredSales.length === 0 ? (

        <Card>

          <EmptyState
            icon={TrendingUp}
            title="Aucune vente"
            description="Enregistrez vos ventes pour suivre votre chiffre d'affaires."
            action={
              <Button
                onClick={openAdd}
              >
                <Plus className="w-4 h-4" />

                Créer une vente
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
                    Client
                  </th>

                  <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden lg:table-cell">
                    Date
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

                {filteredSales.map(
                  (s) => (

                    <tr
                      key={s.id}
                      className="hover:bg-slate-50 transition-colors"
                    >

                      <td className="px-4 py-3 font-medium text-slate-800">
                        {s.reference}
                      </td>

                      <td className="px-4 py-3 hidden md:table-cell text-slate-600">
                        {s.customer?.name ||
                          s.customer_name ||
                          '—'}
                      </td>

                      <td className="px-4 py-3 hidden lg:table-cell text-slate-600">
                        {formatDate(
                          s.sale_date
                        )}
                      </td>

                      <td className="px-4 py-3 text-right font-medium text-slate-800">
                        {formatCurrency(
                          s.total_amount
                        )}
                      </td>

                      <td className="px-4 py-3 text-right hidden sm:table-cell text-slate-600">
                        {formatCurrency(
                          s.paid_amount
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <Badge
                          status={
                            s.status
                          }
                        />
                      </td>

                      <td className="px-4 py-3">

                        <div className="flex items-center justify-end gap-1">

                          {/* Détails */}

                          <button
                            onClick={() =>
                              openDetail(
                                s
                              )
                            }
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Détails"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* FACTURE */}

                          <button
                            onClick={() =>
                              openInvoice(
                                s
                              )
                            }
                            disabled={
                              loadingDocument
                            }
                            className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                            title="Facture"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>

                          {/* BON DE LIVRAISON */}

                          <button
                            onClick={() =>
                              openDeliveryNote(
                                s
                              )
                            }
                            disabled={
                              loadingDocument
                            }
                            className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Bon de livraison"
                          >
                            <Truck className="w-4 h-4" />
                          </button>

                          {/* PAIEMENT */}

                          {s.paid_amount <
                            s.total_amount && (

                            <button
                              onClick={() =>
                                openPayment(
                                  s
                                )
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

                  )
                )}

              </tbody>

            </table>

          </div>

        </Card>

      )}

      {/* =====================================================
          MODAL CRÉATION VENTE
          ===================================================== */}

      <Modal
        open={modalOpen}
        onClose={() =>
          setModalOpen(false)
        }
        title="Nouvelle vente"
        size="xl"
      >

        <div className="space-y-4">

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            <div>

              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Type de client
              </label>

              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">

                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      customer_type:
                        'registered',
                    })
                  }
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                    form.customer_type ===
                    'registered'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  Client enregistré
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      customer_type:
                        'walkin',
                    })
                  }
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                    form.customer_type ===
                    'walkin'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  Client de passage
                </button>

              </div>

            </div>

            {form.customer_type ===
            'registered' ? (

              <Select
                label="Client"
                value={
                  form.customer_id
                }
                onChange={(v) =>
                  setForm({
                    ...form,
                    customer_id: v,
                  })
                }
                options={customers.map(
                  (c) => ({
                    value: c.id,
                    label: c.name,
                  })
                )}
                placeholder="Sélectionner..."
              />

            ) : (

              <Input
                label="Nom du client"
                value={
                  form.customer_name
                }
                onChange={(v) =>
                  setForm({
                    ...form,
                    customer_name:
                      v,
                  })
                }
                placeholder="Client de passage"
              />

            )}

            <Input
              label="Référence"
              value={
                form.reference
              }
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
                form.sale_date
              }
              onChange={(v) =>
                setForm({
                  ...form,
                  sale_date: v,
                })
              }
            />

          </div>

          <div>

            <div className="flex items-center justify-between mb-2">

              <label className="text-sm font-medium text-slate-700">
                Lignes de vente
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
                            {p.name}{' '}
                            (Stock:{' '}
                            {
                              p.stock_quantity
                            })
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
                          removeItem(
                            i
                          )
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

            <div className="flex justify-end mt-3 text-lg font-bold text-slate-800">
              Total:{' '}
              {formatCurrency(
                totalAmount
              )}
            </div>

          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">

            <input
              type="checkbox"
              checked={
                form.create_invoice
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  create_invoice:
                    e.target
                      .checked,
                })
              }
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />

            Créer une facture automatiquement

          </label>

          <Textarea
            label="Notes"
            value={
              form.notes
            }
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
              onClick={
                handleSave
              }
              disabled={
                saving
              }
              className="flex-1"
            >
              {saving
                ? 'Enregistrement...'
                : 'Créer la vente'}
            </Button>

          </div>

        </div>

      </Modal>

      {/* =====================================================
          MODAL DÉTAIL
          ===================================================== */}

      <Modal
        open={!!detailSale}
        onClose={() =>
          setDetailSale(null)
        }
        title={
          detailSale?.reference ||
          ''
        }
        subtitle={
          detailSale?.customer
            ?.name ||
          detailSale?.customer_name ||
          'Client non spécifié'
        }
        size="lg"
      >

        {detailSale && (

          <div className="space-y-4">

            <div className="flex items-center gap-4">

              <Badge
                status={
                  detailSale.status
                }
              />

              <span className="text-sm text-slate-500">
                {formatDate(
                  detailSale.sale_date
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
                    detailSale.total_amount
                  )}
                </p>

              </div>

              <div className="bg-slate-50 rounded-lg p-4">

                <p className="text-xs text-slate-500">
                  Payé
                </p>

                <p className="text-lg font-bold text-emerald-600">
                  {formatCurrency(
                    detailSale.paid_amount
                  )}
                </p>

              </div>

              <div className="bg-slate-50 rounded-lg p-4">

                <p className="text-xs text-slate-500">
                  Reste à payer
                </p>

                <p className="text-lg font-bold text-amber-600">

                  {formatCurrency(
                    detailSale.total_amount -
                      detailSale.paid_amount
                  )}

                </p>

              </div>

            </div>

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

                    {detailSale.sale_items?.map(
                      (it) => (

                        <tr
                          key={
                            it.id
                          }
                        >

                          <td className="px-3 py-2 text-slate-700">
                            {it.product
                              ?.name ||
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

            {detailSale.sale_payments &&
              detailSale.sale_payments
                .length > 0 && (

              <div>

                <h4 className="font-semibold text-slate-700 mb-2 text-sm">
                  Paiements
                </h4>

                <div className="space-y-2">

                  {detailSale.sale_payments.map(
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
                          {
                            pay.method
                          }
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

            {/* Documents */}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              <Button
                variant="secondary"
                onClick={() => {
                  const s =
                    detailSale;

                  setDetailSale(
                    null
                  );

                  openInvoice(s);
                }}
                className="w-full"
              >
                <Receipt className="w-4 h-4" />

                Facture
              </Button>

              <Button
                variant="secondary"
                onClick={() => {
                  const s =
                    detailSale;

                  setDetailSale(
                    null
                  );

                  openDeliveryNote(
                    s
                  );
                }}
                className="w-full"
              >
                <Truck className="w-4 h-4" />

                Bon de livraison
              </Button>

            </div>

            {detailSale.paid_amount <
              detailSale.total_amount && (

              <Button
                onClick={() => {
                  const s =
                    detailSale;

                  setDetailSale(
                    null
                  );

                  openPayment(
                    s
                  );
                }}
                className="w-full"
              >
                <CreditCard className="w-4 h-4" />

                Ajouter un paiement
              </Button>

            )}

          </div>

        )}

      </Modal>

      {/* =====================================================
          MODAL FACTURE
          ===================================================== */}

      <Modal
        open={!!invoiceModal}
        onClose={() =>
          setInvoiceModal(null)
        }
        title="Facture"
        size="xl"
      >

        {invoiceModal && (

          <div className="space-y-6">

            {/* En-tête */}

            <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-slate-200 pb-5">

              <div>

                <h2 className="text-2xl font-bold text-slate-800">
                  FACTURE
                </h2>

                <div className="mt-2 space-y-1 text-sm text-slate-600">

                  <p>
                    Référence :{' '}

                    <span className="font-semibold text-slate-800">
                      {
                        invoiceModal.reference
                      }
                    </span>
                  </p>

                  <p>
                    Date :{' '}

                    <span className="font-medium">
                      {formatDate(
                        invoiceModal.date
                      )}
                    </span>
                  </p>

                </div>

              </div>

              <div className="text-left sm:text-right">

                {settings && (
                  <div className="text-sm text-slate-600 space-y-0.5">
                    {settings.company_logo && (
                      <img src={settings.company_logo} alt="Logo" className="h-16 w-auto mb-1 inline-block" />
                    )}
                    {settings.company_name && (
                      <p className="font-bold text-slate-800">{settings.company_name}</p>
                    )}
                    {settings.company_address && (
                      <p>{settings.company_address}</p>
                    )}
                    {settings.company_phone && (
                      <p>Tél : {settings.company_phone}{settings.company_phone2 ? ` / ${settings.company_phone2}` : ''}</p>
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

                <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 text-violet-700 font-medium text-sm mt-2">

                  <Receipt className="w-4 h-4" />

                  Facture

                </span>

              </div>

            </div>

            {/* Client */}

            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">

              <h3 className="font-semibold text-slate-800 mb-3">
                CLIENT
              </h3>

              {invoiceModal.customer ? (

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">

                  <div>

                    <span className="text-slate-500">
                      Nom :
                    </span>{' '}

                    <span className="font-medium text-slate-800">
                      {
                        invoiceModal
                          .customer
                          .name
                      }
                    </span>

                  </div>

                  {invoiceModal.customer
                    .phone && (

                    <div>

                      <span className="text-slate-500">
                        Téléphone :
                      </span>{' '}

                      {
                        invoiceModal
                          .customer
                          .phone
                      }

                    </div>

                  )}

                  {invoiceModal.customer
                    .email && (

                    <div>

                      <span className="text-slate-500">
                        Email :
                      </span>{' '}

                      {
                        invoiceModal
                          .customer
                          .email
                      }

                    </div>

                  )}

                  {invoiceModal.customer
                    .address && (

                    <div className="sm:col-span-2">

                      <span className="text-slate-500">
                        Adresse :
                      </span>{' '}

                      {
                        invoiceModal
                          .customer
                          .address
                      }

                    </div>

                  )}

                  {invoiceModal.customer.rc && (

                    <div>

                      <span className="text-slate-500">
                        RC :
                      </span>{' '}

                      {
                        invoiceModal
                          .customer.rc
                      }

                    </div>

                  )}

                  {invoiceModal.customer.nif && (

                    <div>

                      <span className="text-slate-500">
                        NIF :
                      </span>{' '}

                      {
                        invoiceModal
                          .customer.nif
                      }

                    </div>

                  )}

                  {invoiceModal.customer.ai && (

                    <div>

                      <span className="text-slate-500">
                        AI :
                      </span>{' '}

                      {
                        invoiceModal
                          .customer.ai
                      }

                    </div>

                  )}

                </div>

              ) : (

                <p className="text-sm text-slate-600">
                  {invoiceModal.sale.customer_name ||
                    'Client de passage'}
                </p>

              )}

            </div>

            {/* Produits */}

            <div>

              <h3 className="font-semibold text-slate-800 mb-3">
                DÉTAIL DE LA FACTURE
              </h3>

              <div className="border border-slate-200 rounded-xl overflow-hidden">

                <div className="overflow-x-auto">

                  <table className="w-full text-sm">

                    <thead className="bg-slate-50">

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

                      {invoiceModal.items.map(
                        (
                          item,
                          index
                        ) => (

                          <tr
                            key={
                              item.id
                            }
                          >

                            <td className="px-4 py-3 text-slate-500">
                              {index +
                                1}
                            </td>

                            <td className="px-4 py-3 font-medium text-slate-800">
                              {item.product
                                ?.name ||
                                'Produit'}
                            </td>

                            <td className="px-4 py-3 text-right text-slate-600">
                              {
                                item.quantity
                              }
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
                      )}

                    </tbody>

                  </table>

                </div>

              </div>

            </div>

            {/* Total */}

            <div className="flex justify-end">

              <div className="w-full sm:w-80 border-2 border-slate-800 rounded-xl overflow-hidden">

                <div className="flex items-center justify-between px-5 py-4">

                  <span className="font-bold text-slate-800">
                    TOTAL
                  </span>

                  <span className="text-xl font-bold text-slate-800">
                    {formatCurrency(
                      invoiceModal.total
                    )}
                  </span>

                </div>

              </div>

            </div>

            {/* Actions */}

            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-200">

              <Button
                variant="secondary"
                onClick={() =>
                  setInvoiceModal(
                    null
                  )
                }
                className="flex-1"
              >
                Fermer
              </Button>

              <Button
                onClick={() =>
                  printDocument(
                    invoiceModal,
                    'invoice'
                  )
                }
                className="flex-1"
              >
                <Printer className="w-4 h-4" />

                Imprimer la facture
              </Button>

            </div>

          </div>

        )}

      </Modal>

      {/* =====================================================
          MODAL BON DE LIVRAISON
          ===================================================== */}

      <Modal
        open={!!deliveryModal}
        onClose={() =>
          setDeliveryModal(null)
        }
        title="Bon de livraison"
        size="xl"
      >

        {deliveryModal && (

          <div className="space-y-6">

            {/* En-tête */}

            <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-slate-200 pb-5">

              <div>

                <h2 className="text-2xl font-bold text-slate-800">
                  BON DE LIVRAISON
                </h2>

                <div className="mt-2 space-y-1 text-sm text-slate-600">

                  <p>
                    Référence :{' '}

                    <span className="font-semibold text-slate-800">
                      {
                        deliveryModal.reference
                      }
                    </span>
                  </p>

                  <p>
                    Date :{' '}

                    <span className="font-medium">
                      {formatDate(
                        deliveryModal.date
                      )}
                    </span>
                  </p>

                </div>

              </div>

              <div className="text-left sm:text-right">

                {settings && (
                  <div className="text-sm text-slate-600 space-y-0.5">
                    {settings.company_logo && (
                      <img src={settings.company_logo} alt="Logo" className="h-16 w-auto mb-1 inline-block" />
                    )}
                    {settings.company_name && (
                      <p className="font-bold text-slate-800">{settings.company_name}</p>
                    )}
                    {settings.company_address && (
                      <p>{settings.company_address}</p>
                    )}
                    {settings.company_phone && (
                      <p>Tél : {settings.company_phone}{settings.company_phone2 ? ` / ${settings.company_phone2}` : ''}</p>
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

                <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 text-orange-700 font-medium text-sm mt-2">

                  <Truck className="w-4 h-4" />

                  Livraison

                </span>

              </div>

            </div>

            {/* Client */}

            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">

              <h3 className="font-semibold text-slate-800 mb-3">
                CLIENT
              </h3>

              {deliveryModal.customer ? (

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">

                  <div>

                    <span className="text-slate-500">
                      Nom :
                    </span>{' '}

                    <span className="font-medium text-slate-800">
                      {
                        deliveryModal
                          .customer
                          .name
                      }
                    </span>

                  </div>

                  {deliveryModal.customer
                    .phone && (

                    <div>

                      <span className="text-slate-500">
                        Téléphone :
                      </span>{' '}

                      {
                        deliveryModal
                          .customer
                          .phone
                      }

                    </div>

                  )}

                  {deliveryModal.customer
                    .email && (

                    <div>

                      <span className="text-slate-500">
                        Email :
                      </span>{' '}

                      {
                        deliveryModal
                          .customer
                          .email
                      }

                    </div>

                  )}

                  {deliveryModal.customer
                    .address && (

                    <div className="sm:col-span-2">

                      <span className="text-slate-500">
                        Adresse :
                      </span>{' '}

                      {
                        deliveryModal
                          .customer
                          .address
                      }

                    </div>

                  )}

                  {deliveryModal.customer.rc && (

                    <div>

                      <span className="text-slate-500">
                        RC :
                      </span>{' '}

                      {
                        deliveryModal
                          .customer.rc
                      }

                    </div>

                  )}

                  {deliveryModal.customer.nif && (

                    <div>

                      <span className="text-slate-500">
                        NIF :
                      </span>{' '}

                      {
                        deliveryModal
                          .customer.nif
                      }

                    </div>

                  )}

                  {deliveryModal.customer.ai && (

                    <div>

                      <span className="text-slate-500">
                        AI :
                      </span>{' '}

                      {
                        deliveryModal
                          .customer.ai
                      }

                    </div>

                  )}

                </div>

              ) : (

                <p className="text-sm text-slate-600">
                  {deliveryModal.sale.customer_name ||
                    'Client de passage'}
                </p>

              )}

            </div>

            {/* Produits */}

            <div>

              <h3 className="font-semibold text-slate-800 mb-3">
                PRODUITS LIVRÉS
              </h3>

              <div className="border border-slate-200 rounded-xl overflow-hidden">

                <div className="overflow-x-auto">

                  <table className="w-full text-sm">

                    <thead className="bg-slate-50">

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

                      </tr>

                    </thead>

                    <tbody className="divide-y divide-slate-100">

                      {deliveryModal.items.map(
                        (
                          item,
                          index
                        ) => (

                          <tr
                            key={
                              item.id
                            }
                          >

                            <td className="px-4 py-3 text-slate-500">
                              {index +
                                1}
                            </td>

                            <td className="px-4 py-3 font-medium text-slate-800">
                              {item.product
                                ?.name ||
                                'Produit'}
                            </td>

                            <td className="px-4 py-3 text-right font-medium text-slate-700">
                              {
                                item.quantity
                              }
                            </td>

                          </tr>

                        )
                      )}

                    </tbody>

                  </table>

                </div>

              </div>

            </div>

            {/* Information vente */}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div className="bg-slate-50 rounded-xl p-4">

                <p className="text-xs text-slate-500">
                  Référence de la vente
                </p>

                <p className="font-semibold text-slate-800 mt-1">
                  {
                    deliveryModal
                      .sale
                      .reference
                  }
                </p>

              </div>

              <div className="bg-slate-50 rounded-xl p-4">

                <p className="text-xs text-slate-500">
                  Nombre de lignes
                </p>

                <p className="font-semibold text-slate-800 mt-1">
                  {
                    deliveryModal
                      .items
                      .length
                  }
                </p>

              </div>

            </div>

            {/* Notes */}

            {deliveryModal.sale
              .notes && (

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">

                <h3 className="font-semibold text-slate-700 mb-2">
                  Notes
                </h3>

                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                  {
                    deliveryModal
                      .sale
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
                  setDeliveryModal(
                    null
                  )
                }
                className="flex-1"
              >
                Fermer
              </Button>

              <Button
                onClick={() =>
                  printDocument(
                    deliveryModal,
                    'delivery'
                  )
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

              Reste à payer:{' '}

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
            value={
              payment.amount
            }
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
            value={
              payment.method
            }
            onChange={(v) =>
              setPayment({
                ...payment,
                method: v,
              })
            }
            options={[
              {
                value:
                  'espèces',
                label:
                  'Espèces',
              },
              {
                value:
                  'chèque',
                label:
                  'Chèque',
              },
              {
                value:
                  'virement',
                label:
                  'Virement',
              },
              {
                value:
                  'carte',
                label:
                  'Carte bancaire',
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
            value={
              payment.notes
            }
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
                setPaymentModal(
                  null
                )
              }
              className="flex-1"
            >
              Annuler
            </Button>

            <Button
              onClick={
                handlePayment
              }
              disabled={
                saving
              }
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

