
import { useEffect, useState } from 'react';
import {
  Package,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Receipt,
  Undo2,
  Wallet,
  CreditCard,
  Users,
  Truck,
  Send,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { Card, StatCard } from '@/components/ui';
import Loading from '@/components/Loading';
import type { PageKey } from '@/types';

type DashboardStats = {
  productCount: number;

  // Stock
  totalStockValue: number;
  totalStockCost: number;
  lowStockCount: number;
  outOfStockCount: number;

  // Ventes
  salesTotal: number;
  salesCost: number;
  salesProfit: number;
  salesPaid: number;
  salesReceivable: number;

  // Achats
  purchaseTotal: number;
  purchasePaid: number;
  purchaseDebt: number;

  // Frais
  handlingFeesTotal: number;
  transportCostTotal: number;

  // Livraisons
  deliveriesCount: number;

  // Clients / fournisseurs
  customerCount: number;
  supplierCount: number;

  // Retours
  salesReturnTotal: number;
  purchaseReturnTotal: number;
  salesReturnCount: number;
  purchaseReturnCount: number;

  // Factures
  unpaidInvoices: number;
  partialInvoices: number;
};

const emptyStats: DashboardStats = {
  productCount: 0,

  totalStockValue: 0,
  totalStockCost: 0,
  lowStockCount: 0,
  outOfStockCount: 0,

  salesTotal: 0,
  salesCost: 0,
  salesProfit: 0,
  salesPaid: 0,
  salesReceivable: 0,

  purchaseTotal: 0,
  purchasePaid: 0,
  purchaseDebt: 0,

  handlingFeesTotal: 0,
  transportCostTotal: 0,

  deliveriesCount: 0,

  customerCount: 0,
  supplierCount: 0,

  salesReturnTotal: 0,
  purchaseReturnTotal: 0,
  salesReturnCount: 0,
  purchaseReturnCount: 0,

  unpaidInvoices: 0,
  partialInvoices: 0,
};

export default function Dashboard({
  onNavigate,
}: {
  onNavigate: (p: PageKey) => void;
}) {
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<DashboardStats>(emptyStats);

  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);

    try {
      /*
       * ============================================================
       * CHARGEMENT DES DONNÉES
       * ============================================================
       *
       * Chaque requête est indépendante.
       *
       * Important :
       * deliveriesRes est bien présent ici et dans le destructuring.
       */

      const [
        productsRes,
        salesRes,
        recentSalesRes,
        purchasesRes,
        saleItemsRes,
        purchasePaymentsRes,
        salePaymentsRes,
        invoicesRes,
        customersRes,
        suppliersRes,
        salesReturnsRes,
        purchaseReturnsRes,
        deliveriesRes,
      ] = await Promise.all([
        // ----------------------------------------------------------
        // PRODUITS
        // ----------------------------------------------------------
        supabase
          .from('products')
          .select('*'),

        // ----------------------------------------------------------
        // VENTES
        // ----------------------------------------------------------
        supabase
          .from('sales')
          .select('*'),

        // ----------------------------------------------------------
        // VENTES RÉCENTES
        // ----------------------------------------------------------
        supabase
          .from('sales')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5),

        // ----------------------------------------------------------
        // ACHATS
        // ----------------------------------------------------------
        supabase
          .from('purchases')
          .select('*'),

        // ----------------------------------------------------------
        // LIGNES DE VENTE
        // ----------------------------------------------------------
        supabase
          .from('sale_items')
          .select('*'),

        // ----------------------------------------------------------
        // PAIEMENTS FOURNISSEURS
        // ----------------------------------------------------------
        supabase
          .from('purchase_payments')
          .select('*'),

        // ----------------------------------------------------------
        // PAIEMENTS CLIENTS
        // ----------------------------------------------------------
        supabase
          .from('sale_payments')
          .select('*'),

        // ----------------------------------------------------------
        // FACTURES
        // ----------------------------------------------------------
        supabase
          .from('invoices')
          .select('*'),

        // ----------------------------------------------------------
        // CLIENTS
        // ----------------------------------------------------------
        supabase
          .from('customers')
          .select('id'),

        // ----------------------------------------------------------
        // FOURNISSEURS
        // ----------------------------------------------------------
        supabase
          .from('suppliers')
          .select('id'),

        // ----------------------------------------------------------
        // RETOURS VENTES
        // ----------------------------------------------------------
        supabase
          .from('sales_returns')
          .select('*'),

        // ----------------------------------------------------------
        // RETOURS ACHATS
        // ----------------------------------------------------------
        supabase
          .from('purchase_returns')
          .select('*'),

        // ----------------------------------------------------------
        // LIVRAISONS
        // ----------------------------------------------------------
        supabase
          .from('deliveries')
          .select('*'),
      ]);

      /*
       * ============================================================
       * AFFICHAGE DES ERREURS
       * ============================================================
       *
       * Une erreur sur une table ne doit pas faire disparaître
       * toutes les statistiques.
       */

      const errors = [
        ['products', productsRes.error],
        ['sales', salesRes.error],
        ['recentSales', recentSalesRes.error],
        ['purchases', purchasesRes.error],
        ['sale_items', saleItemsRes.error],
        ['purchase_payments', purchasePaymentsRes.error],
        ['sale_payments', salePaymentsRes.error],
        ['invoices', invoicesRes.error],
        ['customers', customersRes.error],
        ['suppliers', suppliersRes.error],
        ['sales_returns', salesReturnsRes.error],
        ['purchase_returns', purchaseReturnsRes.error],
        ['deliveries', deliveriesRes.error],
      ].filter(([, error]) => Boolean(error));

      if (errors.length > 0) {
        console.error(
          'Erreurs Supabase Dashboard:',
          errors
        );
      }

      /*
       * ============================================================
       * DONNÉES
       * ============================================================
       */

      const products = productsRes.data || [];
      const sales = salesRes.data || [];
      const purchases = purchasesRes.data || [];
      const saleItems = saleItemsRes.data || [];
      const salePayments = salePaymentsRes.data || [];
      const purchasePayments = purchasePaymentsRes.data || [];
      const invoices = invoicesRes.data || [];
      const customers = customersRes.data || [];
      const suppliers = suppliersRes.data || [];
      const salesReturns = salesReturnsRes.data || [];
      const purchaseReturns = purchaseReturnsRes.data || [];
      const deliveries = deliveriesRes.data || [];

      /*
       * ============================================================
       * STOCK
       * ============================================================
       */

      const totalStockValue = products.reduce(
        (sum, product) => {
          const salePrice = Number(
            product.sale_price ?? 0
          );

          const quantity = Number(
            product.stock_quantity ?? 0
          );

          return sum + salePrice * quantity;
        },
        0
      );

      const totalStockCost = products.reduce(
        (sum, product) => {
          const costPrice = Number(
            product.cost_price ?? 0
          );

          const quantity = Number(
            product.stock_quantity ?? 0
          );

          return sum + costPrice * quantity;
        },
        0
      );

      const lowStock = products.filter((product) => {
        const quantity = Number(
          product.stock_quantity ?? 0
        );

        const minimum = Number(
          product.min_stock ?? 0
        );

        return quantity > 0 && quantity <= minimum;
      });

      const outOfStock = products.filter((product) => {
        const quantity = Number(
          product.stock_quantity ?? 0
        );

        return quantity <= 0;
      });

      /*
       * ============================================================
       * PRIX D'ACHAT DES PRODUITS
       * ============================================================
       */

      const productCostMap = new Map<
        string,
        number
      >();

      products.forEach((product) => {
        productCostMap.set(
          String(product.id),
          Number(product.cost_price ?? 0)
        );
      });

      /*
       * ============================================================
       * VENTES
       * ============================================================
       */

      const salesTotal = sales.reduce(
        (sum, sale) => {
          return (
            sum +
            Number(sale.total_amount ?? 0)
          );
        },
        0
      );

      /*
       * Coût des marchandises vendues.
       *
       * sale_items :
       * - product_id
       * - quantity
       *
       * Le prix d'achat est récupéré dans products.
       */

      const salesCost = saleItems.reduce(
        (sum, item) => {
          const productId = String(
            item.product_id ?? ''
          );

          const costPrice =
            productCostMap.get(productId) ?? 0;

          const quantity = Number(
            item.quantity ?? 0
          );

          return (
            sum +
            quantity * costPrice
          );
        },
        0
      );

      const salesProfit =
        salesTotal - salesCost;

      /*
       * ============================================================
       * PAIEMENTS CLIENTS
       * ============================================================
       */

      const salesPaid = salePayments.reduce(
        (sum, payment) => {
          return (
            sum +
            Number(payment.amount ?? 0)
          );
        },
        0
      );

      /*
       * Créances clients.
       *
       * CA - paiements encaissés.
       */

      const salesReceivable = Math.max(
        0,
        salesTotal - salesPaid
      );

      /*
       * ============================================================
       * ACHATS
       * ============================================================
       */

      const purchaseTotal = purchases.reduce(
        (sum, purchase) => {
          return (
            sum +
            Number(
              purchase.total_amount ?? 0
            )
          );
        },
        0
      );

      /*
       * Paiements fournisseurs.
       */

      const purchasePaid =
        purchasePayments.reduce(
          (sum, payment) => {
            return (
              sum +
              Number(payment.amount ?? 0)
            );
          },
          0
        );

      /*
       * Dette fournisseurs.
       */

      const purchaseDebt = Math.max(
        0,
        purchaseTotal - purchasePaid
      );

      /*
       * ============================================================
       * FRAIS DE MANUTENTION
       * ============================================================
       */

      const handlingFeesTotal =
        purchases.reduce(
          (sum, purchase) => {
            return (
              sum +
              Number(
                purchase.handling_fee ?? 0
              )
            );
          },
          0
        );

      /*
       * ============================================================
       * LIVRAISONS
       * ============================================================
       */

      const deliveriesCount =
        deliveries.length;

      const transportCostTotal =
        deliveries.reduce(
          (sum, delivery) => {
            return (
              sum +
              Number(
                delivery.transport_cost ?? 0
              )
            );
          },
          0
        );

      /*
       * ============================================================
       * FACTURES
       * ============================================================
       */

      const unpaidInvoices =
        invoices.filter(
          (invoice) =>
            String(
              invoice.status ?? ''
            ).toLowerCase() === 'unpaid'
        ).length;

      const partialInvoices =
        invoices.filter(
          (invoice) =>
            String(
              invoice.status ?? ''
            ).toLowerCase() === 'partial'
        ).length;

      /*
       * ============================================================
       * RETOURS VENTES
       * ============================================================
       */

      const salesReturnTotal =
        salesReturns.reduce(
          (sum, item) => {
            return (
              sum +
              Number(
                item.total_amount ?? 0
              )
            );
          },
          0
        );

      /*
       * ============================================================
       * RETOURS ACHATS
       * ============================================================
       */

      const purchaseReturnTotal =
        purchaseReturns.reduce(
          (sum, item) => {
            return (
              sum +
              Number(
                item.total_amount ?? 0
              )
            );
          },
          0
        );

      /*
       * ============================================================
       * BÉNÉFICE NET
       * ============================================================
       *
       * Bénéfice commercial
       * - frais de manutention
       * - frais de livraison
       *
       * Les retours ne sont pas automatiquement déduits ici
       * car leur impact dépend de la manière dont les retours
       * sont enregistrés dans les ventes.
       */

      const netProfit =
        salesProfit -
        handlingFeesTotal -
        transportCostTotal;

      /*
       * ============================================================
       * MISE À JOUR DES STATISTIQUES
       * ============================================================
       */

      setStats({
        productCount: products.length,

        totalStockValue,
        totalStockCost,
        lowStockCount: lowStock.length,
        outOfStockCount: outOfStock.length,

        salesTotal,
        salesCost,
        salesProfit,
        salesPaid,
        salesReceivable,

        purchaseTotal,
        purchasePaid,
        purchaseDebt,

        handlingFeesTotal,
        transportCostTotal,

        deliveriesCount,

        customerCount: customers.length,
        supplierCount: suppliers.length,

        salesReturnTotal,
        purchaseReturnTotal,
        salesReturnCount:
          salesReturns.length,
        purchaseReturnCount:
          purchaseReturns.length,

        unpaidInvoices,
        partialInvoices,
      });

      /*
       * ============================================================
       * VENTES RÉCENTES
       * ============================================================
       */

      setRecentSales(
        recentSalesRes.data || []
      );

      /*
       * ============================================================
       * STOCK FAIBLE
       * ============================================================
       */

      const sortedLowStock =
        [...lowStock]
          .sort(
            (a, b) =>
              Number(
                a.stock_quantity ?? 0
              ) -
              Number(
                b.stock_quantity ?? 0
              )
          )
          .slice(0, 5);

      setLowStockProducts(
        sortedLowStock
      );

      /*
       * ============================================================
       * LOG UTILE POUR LE DÉBOGAGE
       * ============================================================
       */

      console.log(
        'Dashboard chargé:',
        {
          produits: products.length,
          ventes: sales.length,
          achats: purchases.length,
          clients: customers.length,
          fournisseurs: suppliers.length,
          livraisons: deliveries.length,
          retoursVentes:
            salesReturns.length,
          retoursAchats:
            purchaseReturns.length,
        }
      );
    } catch (error) {
      console.error(
        'Erreur lors du chargement du Dashboard:',
        error
      );

      /*
       * On garde les valeurs déjà disponibles
       * au lieu de casser complètement le Dashboard.
       */
    } finally {
      setLoading(false);
    }
  }

  /*
   * ==============================================================
   * CHARGEMENT
   * ==============================================================
   */

  if (loading) {
    return <Loading />;
  }

  const netProfit =
    stats.salesProfit -
    stats.handlingFeesTotal -
    stats.transportCostTotal;

  /*
   * ==============================================================
   * AFFICHAGE
   * ==============================================================
   */

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* ==========================================================
          TITRE
      =========================================================== */}

      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Tableau de bord
        </h1>

        <p className="text-sm text-slate-500 mt-1">
          Vue d'ensemble de votre activité commerciale
        </p>
      </div>

      {/* ==========================================================
          ACTIVITÉ COMMERCIALE
      =========================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <StatCard
          label="CA des ventes"
          value={formatCurrency(
            stats.salesTotal
          )}
          icon={TrendingUp}
          color="#059669"
        />

        <StatCard
          label="Bénéfice commercial"
          value={formatCurrency(
            stats.salesProfit
          )}
          icon={TrendingUp}
          color="#2563eb"
        />

        <StatCard
          label="Total encaissé"
          value={formatCurrency(
            stats.salesPaid
          )}
          icon={Wallet}
          color="#0891b2"
        />

        <StatCard
          label="Créances clients"
          value={formatCurrency(
            stats.salesReceivable
          )}
          icon={CreditCard}
          color="#dc2626"
        />

      </div>

      {/* ==========================================================
          STOCK / ACHATS
      =========================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <StatCard
          label="Valeur du stock"
          value={formatCurrency(
            stats.totalStockValue
          )}
          icon={Package}
          color="#7c3aed"
        />

        <StatCard
          label="Total des achats"
          value={formatCurrency(
            stats.purchaseTotal
          )}
          icon={ShoppingCart}
          color="#d97706"
        />

        <StatCard
          label="Fournisseurs payé"
          value={formatCurrency(
            stats.purchasePaid
          )}
          icon={Wallet}
          color="#059669"
        />

        <StatCard
          label="Dette fournisseurs"
          value={formatCurrency(
            stats.purchaseDebt
          )}
          icon={Truck}
          color="#dc2626"
        />

      </div>

      {/* ==========================================================
          FRAIS / LIVRAISONS
      =========================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <StatCard
          label="Frais de manutention"
          value={formatCurrency(
            stats.handlingFeesTotal
          )}
          icon={Package}
          color="#d97706"
        />

        <StatCard
          label="Frais de livraison"
          value={formatCurrency(
            stats.transportCostTotal
          )}
          icon={Send}
          color="#0891b2"
        />

        <StatCard
          label="Nombre de livraisons"
          value={stats.deliveriesCount}
          icon={Truck}
          color="#2563eb"
        />

        <StatCard
          label="Bénéfice net"
          value={formatCurrency(
            netProfit
          )}
          icon={TrendingUp}
          color="#059669"
        />

      </div>

      {/* ==========================================================
          INFORMATIONS GÉNÉRALES
      =========================================================== */}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        <Card className="p-5">
          <div className="flex items-center gap-3">

            <Package className="w-5 h-5 text-blue-600" />

            <div>
              <p className="text-xs text-slate-500">
                Produits
              </p>

              <p className="text-xl font-bold text-slate-800">
                {stats.productCount}
              </p>
            </div>

          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">

            <Users className="w-5 h-5 text-indigo-600" />

            <div>
              <p className="text-xs text-slate-500">
                Clients
              </p>

              <p className="text-xl font-bold text-slate-800">
                {stats.customerCount}
              </p>
            </div>

          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">

            <Truck className="w-5 h-5 text-orange-600" />

            <div>
              <p className="text-xs text-slate-500">
                Fournisseurs
              </p>

              <p className="text-xl font-bold text-slate-800">
                {stats.supplierCount}
              </p>
            </div>

          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">

            <AlertTriangle className="w-5 h-5 text-amber-500" />

            <div>
              <p className="text-xs text-slate-500">
                Stock faible
              </p>

              <p className="text-xl font-bold text-slate-800">
                {stats.lowStockCount}
              </p>
            </div>

          </div>
        </Card>

      </div>

      {/* ==========================================================
          VENTES RÉCENTES + STOCK FAIBLE
      =========================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* --------------------------------------------------------
            VENTES RÉCENTES
        --------------------------------------------------------- */}

        <div className="lg:col-span-2">

          <Card className="p-6">

            <div className="flex items-center justify-between mb-4">

              <div>
                <h3 className="font-semibold text-slate-800">
                  Ventes récentes
                </h3>

                <p className="text-xs text-slate-400 mt-1">
                  Les 5 dernières ventes
                </p>
              </div>

              <button
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                onClick={() =>
                  onNavigate('sales')
                }
              >
                Voir tout →
              </button>

            </div>

            {recentSales.length === 0 ? (

              <p className="text-sm text-slate-400 py-8 text-center">
                Aucune vente pour le moment
              </p>

            ) : (

              <div className="space-y-2">

                {recentSales.map((sale) => {

                  const total =
                    Number(
                      sale.total_amount ?? 0
                    );

                  /*
                   * paid_amount peut être présent
                   * directement sur sales.
                   *
                   * S'il n'est pas présent,
                   * on affiche 0 ici.
                   */

                  const paid =
                    Number(
                      sale.paid_amount ?? 0
                    );

                  const remaining =
                    Math.max(
                      0,
                      total - paid
                    );

                  return (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-slate-50 transition-colors"
                    >

                      <div>
                        <p className="font-medium text-slate-700 text-sm">
                          {sale.reference ||
                            sale.id}
                        </p>

                        <p className="text-xs text-slate-400">
                          {sale.sale_date
                            ? new Date(
                                sale.sale_date
                              ).toLocaleDateString(
                                'fr-FR'
                              )
                            : sale.created_at
                            ? new Date(
                                sale.created_at
                              ).toLocaleDateString(
                                'fr-FR'
                              )
                            : '-'}
                        </p>
                      </div>

                      <div className="text-right">

                        <p className="font-semibold text-slate-700 text-sm">
                          {formatCurrency(
                            total
                          )}
                        </p>

                        {paid > 0 && (
                          <p className="text-xs text-emerald-600">
                            Payé :{' '}
                            {formatCurrency(
                              paid
                            )}
                          </p>
                        )}

                        {remaining > 0 && (
                          <p className="text-xs text-red-500">
                            Reste :{' '}
                            {formatCurrency(
                              remaining
                            )}
                          </p>
                        )}

                      </div>

                    </div>
                  );
                })}

              </div>
            )}

          </Card>

        </div>

        {/* --------------------------------------------------------
            STOCK FAIBLE
        --------------------------------------------------------- */}

        <Card className="p-6">

          <div className="flex items-center gap-2 mb-4">

            <AlertTriangle className="w-5 h-5 text-amber-500" />

            <div>
              <h3 className="font-semibold text-slate-800">
                Stock faible
              </h3>

              <p className="text-xs text-slate-400">
                Produits nécessitant une attention
              </p>
            </div>

          </div>

          {lowStockProducts.length === 0 ? (

            <p className="text-sm text-slate-400 py-8 text-center">
              Aucun stock faible
            </p>

          ) : (

            <div className="space-y-2">

              {lowStockProducts.map(
                (product) => (

                  <div
                    key={product.id}
                    className="flex items-center justify-between py-3 px-4 rounded-lg bg-amber-50 border border-amber-100"
                  >

                    <div className="min-w-0">

                      <p className="font-medium text-slate-700 text-sm truncate">
                        {product.name}
                      </p>

                      <p className="text-xs text-slate-400">
                        Minimum :{' '}
                        {product.min_stock ?? 0}
                      </p>

                    </div>

                    <span className="text-sm font-bold text-amber-600 shrink-0 ml-2">
                      {product.stock_quantity ??
                        0}{' '}
                      {product.unit || ''}
                    </span>

                  </div>
                )
              )}

            </div>
          )}

          {stats.lowStockCount > 0 && (
            <button
              className="w-full mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
              onClick={() =>
                onNavigate('products')
              }
            >
              Gérer les produits →
            </button>
          )}

        </Card>

      </div>

      {/* ==========================================================
          RÉSUMÉ FINANCIER
      =========================================================== */}

      <Card className="p-6">

        <div className="flex items-center justify-between mb-5">

          <div>
            <h3 className="font-semibold text-slate-800">
              Résumé financier
            </h3>

            <p className="text-xs text-slate-400 mt-1">
              Situation globale
            </p>
          </div>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

          {/* BÉNÉFICE */}

          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">

            <div className="flex items-center gap-2 mb-2">

              <TrendingUp className="w-5 h-5 text-emerald-600" />

              <span className="text-sm font-medium text-slate-600">
                Bénéfice commercial
              </span>

            </div>

            <p className="text-xl font-bold text-emerald-700">
              {formatCurrency(
                stats.salesProfit
              )}
            </p>

          </div>

          {/* BÉNÉFICE NET */}

          <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">

            <div className="flex items-center gap-2 mb-2">

              <TrendingUp className="w-5 h-5 text-blue-600" />

              <span className="text-sm font-medium text-slate-600">
                Bénéfice net
              </span>

            </div>

            <p className="text-xl font-bold text-blue-700">
              {formatCurrency(
                netProfit
              )}
            </p>

          </div>

          {/* CRÉANCES */}

          <div className="p-4 rounded-xl bg-red-50 border border-red-100">

            <div className="flex items-center gap-2 mb-2">

              <CreditCard className="w-5 h-5 text-red-600" />

              <span className="text-sm font-medium text-slate-600">
                Créances clients
              </span>

            </div>

            <p className="text-xl font-bold text-red-700">
              {formatCurrency(
                stats.salesReceivable
              )}
            </p>

          </div>

          {/* DETTES */}

          <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">

            <div className="flex items-center gap-2 mb-2">

              <TrendingDown className="w-5 h-5 text-orange-600" />

              <span className="text-sm font-medium text-slate-600">
                Dette fournisseurs
              </span>

            </div>

            <p className="text-xl font-bold text-orange-700">
              {formatCurrency(
                stats.purchaseDebt
              )}
            </p>

          </div>

        </div>

      </Card>

      {/* ==========================================================
          RETOURS
      =========================================================== */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* RETOURS VENTES */}

        <Card className="p-5">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-3">

              <Undo2 className="w-5 h-5 text-purple-600" />

              <div>

                <p className="font-medium text-slate-700">
                  Retours ventes
                </p>

                <p className="text-xs text-slate-400">
                  {stats.salesReturnCount}{' '}
                  retour(s)
                </p>

              </div>

            </div>

            <p className="font-bold text-purple-700">
              {formatCurrency(
                stats.salesReturnTotal
              )}
            </p>

          </div>

        </Card>

        {/* RETOURS ACHATS */}

        <Card className="p-5">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-3">

              <Undo2 className="w-5 h-5 text-cyan-600" />

              <div>

                <p className="font-medium text-slate-700">
                  Retours achats
                </p>

                <p className="text-xs text-slate-400">
                  {stats.purchaseReturnCount}{' '}
                  retour(s)
                </p>

              </div>

            </div>

            <p className="font-bold text-cyan-700">
              {formatCurrency(
                stats.purchaseReturnTotal
              )}
            </p>

          </div>

        </Card>

      </div>

      {/* ==========================================================
          FACTURES
      =========================================================== */}

      <Card className="p-6">

        <div className="flex items-center gap-2 mb-4">

          <Receipt className="w-5 h-5 text-red-500" />

          <h3 className="font-semibold text-slate-800">
            Situation des factures
          </h3>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* IMPAYÉES */}

          <div className="p-4 rounded-lg bg-red-50 border border-red-100">

            <p className="text-sm text-slate-500">
              Factures impayées
            </p>

            <p className="text-2xl font-bold text-red-600 mt-1">
              {stats.unpaidInvoices}
            </p>

          </div>

          {/* PARTIELLES */}

          <div className="p-4 rounded-lg bg-amber-50 border border-amber-100">

            <p className="text-sm text-slate-500">
              Factures partiellement payées
            </p>

            <p className="text-2xl font-bold text-amber-600 mt-1">
              {stats.partialInvoices}
            </p>

          </div>

        </div>

      </Card>

      {/* ==========================================================
          STOCK À ZÉRO
      =========================================================== */}

      {stats.outOfStockCount > 0 && (

        <Card className="p-5 border border-red-100 bg-red-50">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-3">

              <AlertTriangle className="w-6 h-6 text-red-600" />

              <div>

                <p className="font-semibold text-red-800">
                  Produits en rupture de stock
                </p>

                <p className="text-sm text-red-600">
                  {stats.outOfStockCount}{' '}
                  produit(s) avec un stock nul
                </p>

              </div>

            </div>

            <button
              className="text-sm font-medium text-red-700 hover:text-red-800"
              onClick={() =>
                onNavigate('products')
              }
            >
              Voir les produits →
            </button>

          </div>

        </Card>

      )}

    </div>
  );
}

