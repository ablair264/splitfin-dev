import React, { useState, useEffect } from 'react';
import './product-list.css';
import { createPurchaseOrder, fetchItems } from '../api/zoho';

interface ItemOption {
  item_id: string;
  item_code: string;
}

const NewPurchaseOrder: React.FC = () => {
  const [vendorId, setVendorId] = useState('');
  const [items, setItems] = useState<ItemOption[]>([]);
  const [selectedSku, setSelectedSku] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchItems()
      .then(data => setItems(data.map(i => ({ item_id: i.item_id, item_code: i.item_code }))))
      .catch(err => console.error('Failed to load items', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const item = items.find(i => i.item_code === selectedSku);
      if (!item) throw new Error('Selected SKU not found');
      const po = await createPurchaseOrder(vendorId, [{ item_id: item.item_id, quantity }]);
      setSuccess(`Created PO ID: ${po.purchaseorder_id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create purchase order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="product-table-container">
      <h2>New Purchase Order</h2>
      <form onSubmit={handleSubmit} className="product-controls">
        <div className="select-wrapper">
          <label>Vendor ID</label>
          <input
            type="text"
            value={vendorId}
            onChange={e => setVendorId(e.target.value)}
            className="search-input"
            placeholder="Zoho Vendor ID"
            required
          />
        </div>
        <div className="select-wrapper">
          <label>SKU</label>
          <select
            value={selectedSku}
            onChange={e => setSelectedSku(e.target.value)}
            className="search-input"
            required
          >
            <option value="">Select SKU</option>
            {items.map(i => (
              <option key={i.item_id} value={i.item_code}>{i.item_code}</option>
            ))}
          </select>
        </div>
        <div className="select-wrapper">
          <label>Quantity</label>
          <input
            type="number"
            value={quantity}
            min={1}
            onChange={e => setQuantity(Number(e.target.value))}
            className="input-narrow"
            required
          />
        </div>
        <button type="submit" className="export-button" disabled={loading}>
          {loading ? 'Creating...' : 'Create Purchase Order'}
        </button>
      </form>
      {error && <div style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}
      {success && <div style={{ color: 'green', marginTop: '1rem' }}>{success}</div>}
    </div>
  );
};

export default NewPurchaseOrder;
