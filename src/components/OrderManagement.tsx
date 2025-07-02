// src/components/OrderManagement.tsx
import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
} from 'react';
import './purchase-list.css';
import './dashboard.css';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import Lottie from 'lottie-react';
import loaderAnimation from '../loader.json'; 
import { auth } from '../firebase';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent, SelectionChangedEvent } from 'ag-grid-community';
import { themeQuartz, iconSetMaterial } from 'ag-grid-community';

// Theme configuration
const myTheme = themeQuartz
  .withPart(iconSetMaterial)
  .withParams({
    accentColor: "#89C7B5",
    backgroundColor: "#1A1F2A",
    browserColorScheme: "dark",
    chromeBackgroundColor: {
      ref: "foregroundColor",
      mix: 0.07,
      onto: "backgroundColor"
    },
    foregroundColor: "#FFF",
    headerFontSize: 14
  });

const STATUS_OPTIONS = [
  'All',
  'Order Required',
  'No Order Required',
  'Surplus Warning!',
  'Stock Surplus',
] as const;
type Status = typeof STATUS_OPTIONS[number];

interface StockRow {
  sku: string;
  name: string;
  brand: string;
  price: number;
  currentStock: number;
  actualAvailable: number;
  committedStock: number;
  backorderQty: number;
}

type ProductInfo = {
  name: string;
  brand: string;
  price: number;
  available: number;
  actual: number;
};

// Cell Renderers
const CheckboxRenderer = (props: any) => {
  return (
    <input
      type="checkbox"
      checked={!!props.context.selected[props.data.sku]}
      onChange={() => props.context.toggleSelect(props.data.sku)}
    />
  );
};

const onSelectionChanged = (event: SelectionChangedEvent) => {
  // Handle selection changes if needed
};

// Add grid ready handler
const onGridReady = (params: GridReadyEvent) => {
  // Auto-size columns if needed
  params.api.sizeColumnsToFit();
};

const QuantityRenderer = (props: any) => {
  const disabled = !props.context.selected[props.data.sku];
  return (
    <input
      type="number"
      min={1}
      disabled={disabled}
      value={props.context.quantities[props.data.sku] || 1}
      onChange={(e) => 
        props.context.updateQuantity(props.data.sku, Number(e.target.value))
      }
      style={{ width: '3rem' }}
    />
  );
};

const StatusRenderer = (props: any) => {
  const total = props.data.currentStock + props.data.backorderQty;
  const deficit = total - props.data.committedStock;
  const status = deficit < 0
    ? 'Order Required'
    : deficit === 0
    ? 'No Order Required'
    : deficit > 40
    ? 'Surplus Warning!'
    : 'Stock Surplus';
  
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Stock Surplus':
        return 'stock-surplus';
      case 'Surplus Warning!':
        return 'surplus-warning';
      case 'No Order Required':
        return 'no-order-required';
      case 'Order Required':
        return 'order-required';
      default:
        return '';
    }
  };

  return (
    <span className={`stock-badge ${getStatusClass(status)}`}>
      {status}
    </span>
  );
};

export default function OrderManagement() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<Status>('All');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const gridRef = useRef<AgGridReact>(null);

  // Column definitions
  const columnDefs = useMemo<ColDef[]>(() => [
    {
      field: 'select',
      headerName: '✓',
      width: 50,
      cellRenderer: CheckboxRenderer,
      sortable: false,
      filter: false
    },
    {
      field: 'quantity',
      headerName: 'Qty',
      width: 80,
      cellRenderer: QuantityRenderer,
      sortable: false,
      filter: false
    },
    {
      field: 'sku',
      headerName: 'SKU',
      width: 120
    },
    {
      field: 'name',
      headerName: 'Item Name',
      width: 200,
      wrapText: true,
      autoHeight: true
    },
    {
      field: 'brand',
      headerName: 'Brand',
      width: 120
    },
    {
      field: 'price',
      headerName: 'Price',
      width: 100,
      valueFormatter: (params) => `£${params.value.toFixed(2)}`
    },
    {
      field: 'currentStock',
      headerName: 'Current Stock',
      width: 120
    },
    {
      field: 'backorderQty',
      headerName: 'Back Order',
      width: 100
    },
    {
      field: 'committedStock',
      headerName: 'Committed Stock',
      width: 130
    },
    {
      field: 'total',
      headerName: 'Total Stock',
      width: 100,
      valueGetter: (params) => params.data.currentStock + params.data.backorderQty
    },
    {
      field: 'deficit',
      headerName: 'Stock Deficit',
      width: 120,
      valueGetter: (params) => {
        const total = params.data.currentStock + params.data.backorderQty;
        return total - params.data.committedStock;
      }
    },
    {
      field: 'status',
      headerName: 'Order Status',
      width: 150,
      cellRenderer: StatusRenderer,
      sortable: false
    }
  ], [selected, quantities]);

  // Helper function to get status class name
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Stock Surplus':
        return 'stock-surplus';
      case 'Surplus Warning!':
        return 'surplus-warning';
      case 'No Order Required':
        return 'no-order-required';
      case 'Order Required':
        return 'order-required';
      default:
        return '';
    }
  };

  // Fetch data
  useEffect(() => {
    (async () => {
      try {
        const productsQuery = collection(db, 'items'); // Changed from 'products' to 'items'
        const snap = await getDocs(productsQuery);
        const infoMap = new Map<string, ProductInfo>();
        
        snap.docs.forEach((d) => {
          const p = d.data() as any;
          if (p.sku) {
            infoMap.set(p.sku, {
              name: String(p.item_name || p.name || ''), // Updated field name
              brand: String(p.brand || p.brand_normalized || ''),
              price: Number(p.rate || p.retailPrice || 0),
              available: Number(p.available_stock || p.available_stock || 0),
              actual: Number(p.actual_available_stock || p.actual_available_stock || 0),
            });
          }
        });

        const apiUrl = import.meta.env.VITE_API_BASE || 'https://splitfin-zoho-api.onrender.com';
        const currentUserId = auth.currentUser?.uid || localStorage.getItem('userId') || '';

        const poResponse = await fetch(`${apiUrl}/api/reports/purchase-orders?dateRange=year&status=all&userId=${currentUserId}`, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!poResponse.ok) {
          throw new Error(`Failed to fetch purchase orders: ${poResponse.status}`);
        }

        const poResult = await poResponse.json();
        const pos = poResult.data?.purchaseorders || [];

        const boMap: Record<string, number> = {};
        pos.forEach((po: any) => {
          // Only count orders that aren't fully received
          if (po.status !== 'closed' && po.received_status !== 'fully_received') {
            (po.line_items ?? []).forEach((li: any) => {
              // Use 'quantity' field from Firebase structure
              const ordered = li.quantity || 0;
              const received = li.quantity_received || 0;
              const diff = ordered - received;
              
              // Only count positive differences as backorders
              if (diff > 0 && li.sku) {
                // Use the SKU field directly
                boMap[li.sku] = (boMap[li.sku] || 0) + diff;
              }
            });
          }
        });

        const out: StockRow[] = [];
        infoMap.forEach(({ name, brand, price, available, actual }, sku) => {
          if (price > 0) {
            out.push({
              sku,
              name,
              brand,
              price,
              currentStock: available,
              actualAvailable: actual,
              committedStock: available - actual,
              backorderQty: boMap[sku] || 0, // This will now correctly match by SKU
            });
          }
        });
        setRows(out);
      } catch (e: any) {
        console.error(e);
        setError(e.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Derived state
  const brands = useMemo(() => {
    const b = Array.from(new Set(rows.map((r) => r.brand))).filter(Boolean);
    return ['All', ...b];
  }, [rows]);

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        const term = search.toLowerCase();
        if (
          term &&
          !(
            r.sku.toLowerCase().includes(term) ||
            r.name.toLowerCase().includes(term)
          )
        )
          return false;
        if (brandFilter !== 'All' && r.brand !== brandFilter) return false;
        if (statusFilter !== 'All') {
          const total = r.currentStock + r.backorderQty;
          const deficit = total - r.committedStock;
          const st =
            deficit < 0
              ? 'Order Required'
              : deficit === 0
              ? 'No Order Required'
              : deficit > 40
              ? 'Surplus Warning!'
              : 'Stock Surplus';
          if (st !== statusFilter) return false;
        }
        return true;
      }),
    [rows, search, brandFilter, statusFilter]
  );

  const runningTotal = useMemo(
    () =>
      rows.reduce((sum, r) => {
        if (selected[r.sku]) {
          const qty = quantities[r.sku] || 1;
          return sum + r.price * qty;
        }
        return sum;
      }, 0),
    [rows, selected, quantities]
  );

  // Handlers
  const toggleSelect = (sku: string) => {
    setSelected((s) => ({ ...s, [sku]: !s[sku] }));
    setQuantities((q) => ({ ...q, [sku]: q[sku] || 1 }));
  };

  const updateQuantity = (sku: string, qty: number) => {
    setQuantities(q => ({ ...q, [sku]: qty }));
  };

  const generateCSV = () => {
    const cols = ['Name', 'SKU', 'Quantity', 'TotalPrice'];
    const lines = [cols.join(',')];
    Object.entries(selected).forEach(([sku, sel]) => {
      if (sel) {
        const r = rows.find((x) => x.sku === sku)!;
        const qty = quantities[sku] || 1;
        lines.push(
          [
            `"${r.name.replace(/"/g, '""')}"`,
            sku,
            String(qty),
            (r.price * qty).toFixed(2),
          ].join(',')
        );
      }
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase-order-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Update grid filter when search changes
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.setGridOption('quickFilterText', search);
    }
  }, [search]);

  // Early returns
  if (loading) {
    return (
      <div className="ai-loading">
        <div className="ai-loading-lottie">
          <Lottie 
            animationData={loaderAnimation}
            loop={true}
            autoplay={true}
            style={{ width: 100, height: 100 }}
          />
        </div>
        <p>Fetching Items & Orders...</p>
      </div>  
    );
  }
  
  if (error) {
    return (
      <div className="product-table-container">
        <div style={{ color: 'red', textAlign: 'center', padding: '2rem' }}>
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Render
  return (
    <div className="product-table-container" style={{ position: 'relative' }}>
      <h2>Order Management</h2>

      <div className="product-controls">
        <input
          type="search"
          className="search-input"
          placeholder="Search SKU or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="select-wrapper">
          <label>Brand:&nbsp;</label>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
          >
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="select-wrapper">
          <label>Status:&nbsp;</label>
          {STATUS_OPTIONS.map((s) => {
            const isActive = statusFilter === s;
            const cls = isActive
              ? getStatusClass(s)
              : 'stock-badge-outline';
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`stock-badge ${cls}`}
              >
                {s}
              </button>
            );
          })}
        </div>

        <button
          onClick={generateCSV}
          disabled={!Object.values(selected).some(Boolean)}
          className="export-button"
        >
          Generate Purchase Order
        </button>
      </div>

      <div className="ag-theme-custom" style={{ height: '600px', width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          rowData={filteredRows}
          columnDefs={columnDefs}
          theme={myTheme}
          onGridReady={onGridReady}
          onSelectionChanged={onSelectionChanged}
          rowSelection={{
            mode: 'multiRow',
            enableClickSelection: false
          }}
          context={{
            selected,
            quantities,
            toggleSelect,
            updateQuantity
          }}
          animateRows={true}
          rowHeight={52}
        />
      </div>

      {Object.values(selected).some(Boolean) && (
        <div className="running-total-box">
          Total: £{runningTotal.toFixed(2)}
        </div>
      )}
    </div>
  );
}