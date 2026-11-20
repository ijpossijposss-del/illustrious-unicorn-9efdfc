import type { Sale } from '../store/useStore';

export function getSaleTimestamp(sale: Pick<Sale, 'timestamp' | 'date'>) {
  if (Number.isFinite(sale.timestamp) && sale.timestamp > 0) return sale.timestamp;
  const parsedDate = Date.parse(sale.date);
  return Number.isFinite(parsedDate) ? parsedDate : 0;
}

export function getSaleRevenue(sale: Pick<Sale, 'total' | 'subtotal' | 'discount' | 'additionalCharge'>) {
  if (Number.isFinite(sale.total)) return sale.total;
  return (Number.isFinite(sale.subtotal) ? sale.subtotal : 0)
    - (Number.isFinite(sale.discount) ? sale.discount : 0)
    + (typeof sale.additionalCharge === 'number' && Number.isFinite(sale.additionalCharge) ? sale.additionalCharge : 0);
}

export function getSaleProfit(sale: Pick<Sale, 'total' | 'subtotal' | 'discount' | 'additionalCharge' | 'items'>) {
  let cost = 0;
  sale.items.forEach((item) => {
    if (!item) return;
    const itemCost = typeof item.cost === 'number' && Number.isFinite(item.cost) ? item.cost : 0;
    const quantity = typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : 0;
    cost += itemCost * quantity;
  });
  return Math.round((getSaleRevenue(sale) - cost + Number.EPSILON) * 100) / 100;
}

export function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getSaleDateKey(sale: Pick<Sale, 'timestamp' | 'date'>) {
  const timestamp = getSaleTimestamp(sale);
  return timestamp ? getLocalDateKey(new Date(timestamp)) : '';
}
