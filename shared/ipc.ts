// Barrel: existing renderer + electron files import types from '@shared/ipc'.
// Splitting by domain kept import paths stable.

export * from './enums';
export * from './party';
export * from './item';
export * from './search';
export * from './sale';
export * from './purchase';
export * from './karigar';
export * from './pipelines';
export * from './refining';
export * from './rates';
export * from './ledger';

// ────────────────────────────────────────────────────────────
// Channel names — single source of truth for both processes
// ────────────────────────────────────────────────────────────
export const CH = {
  ping: 'app.ping',
  backupNow: 'backup.now',
  partiesList: 'parties.list',
  partiesCreate: 'parties.create',
  partiesUpdate: 'parties.update',
  partiesDelete: 'parties.delete',
  itemsList: 'items.list',
  itemsCreate: 'items.create',
  itemsUpdate: 'items.update',
  itemsDelete: 'items.delete',
  stockAdjust: 'stock.adjust',
  stockAdjustments: 'stock.adjustments',
  search: 'search',
  // phase 2
  salePost: 'sale.post',
  saleGet: 'sale.get',
  salesList: 'sales.list',
  salePrint: 'sale.print',
  purchasePost: 'purchase.post',
  purchasesList: 'purchases.list',
  ledgerCash: 'ledger.cash',
  ledgerMetal: 'ledger.metal',
  ledgerParty: 'ledger.party',
  metalBuckets: 'ledger.metal.buckets',
  exportSalesCsv: 'export.sales.csv',
  exportPurchasesCsv: 'export.purchases.csv',
  companyGet: 'company.get',
  companyUpdate: 'company.update',
  devSmoke: 'dev.smoke',
  // phase 3 — karigar
  karigarsList: 'karigars.list',
  karigarsCreate: 'karigars.create',
  karigarsUpdate: 'karigars.update',
  karigarsDelete: 'karigars.delete',
  karigarIssuePost: 'karigar.issue.post',
  karigarReceiptPost: 'karigar.receipt.post',
  karigarPay: 'karigar.pay',
  karigarIssuesList: 'karigar.issues.list',
  karigarReceiptsList: 'karigar.receipts.list',
  karigarLedger: 'karigar.ledger',
  karigarBalances: 'karigar.balances',
  // settings — metal rates
  ratesList: 'rates.list',
  ratesUpsert: 'rates.upsert',
  ratesDelete: 'rates.delete',
  // pipelines — approval / repair / order
  approvalCreate: 'approval.create',
  approvalResolve: 'approval.resolve',
  approvalsList: 'approvals.list',
  repairCreate: 'repair.create',
  repairStatus: 'repair.status',
  repairDeliver: 'repair.deliver',
  repairsList: 'repairs.list',
  orderCreate: 'order.create',
  orderAdvance: 'order.advance',
  orderStatus: 'order.status',
  ordersList: 'orders.list',
  // refining
  refiningSend: 'refining.send',
  refiningReceive: 'refining.receive',
  refiningCancel: 'refining.cancel',
  refiningList: 'refining.list',
  // catalog / tagging
  photosList: 'photos.list',
  photosAdd: 'photos.add',
  photosDelete: 'photos.delete',
  photosSetPrimary: 'photos.setPrimary',
  catalogGrid: 'catalog.grid',
  collectionsList: 'collections.list',
  collectionsCreate: 'collections.create',
  collectionsDelete: 'collections.delete',
  itemCollectionsGet: 'item.collections.get',
  itemCollectionsSet: 'item.collections.set',
  itemTagsSet: 'item.tags.set',
  labelsPrint: 'labels.print',
  // phase 3 — GST reports
  gstGstr1View: 'gst.gstr1.view',
  gstGstr1Csv: 'gst.gstr1.csv',
  gstGstr3bView: 'gst.gstr3b.view',
  gstGstr3bCsv: 'gst.gstr3b.csv',
  gstHsnView: 'gst.hsn.view',
  gstHsnCsv: 'gst.hsn.csv',
  // auth + users
  authListUsers: 'auth.list',
  authWhoami: 'auth.whoami',
  authLogin: 'auth.login',
  authLogout: 'auth.logout',
  usersCreate: 'users.create',
  usersSetPin: 'users.setPin',
  usersDeactivate: 'users.deactivate',
} as const;
