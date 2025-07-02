// src/components/ProductList.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db, storage } from '../firebase'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  getBytes,
} from 'firebase/storage'
import Modal from 'react-modal'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { useParams } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import { ColDef, GridReadyEvent, SelectionChangedEvent } from 'ag-grid-community'
import { themeQuartz, iconSetMaterial } from 'ag-grid-community'
import './product-list.css'

Modal.setAppElement('#root')

// Create the custom theme
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
  })

interface Product {
  id: string
  name: string
  sku: string
  stockLevel: number
  retailPrice: number
  brand?: string
  brand_normalized?: string
  quantity?: number
}

// Custom Cell Renderers
const ImageCellRenderer = (props: any) => {
  const [url, setUrl] = useState<string>('')
  const [open, setOpen] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    getDownloadURL(storageRef(storage, `product-images/${props.data.sku}.jpg`))
      .then((u) => mounted.current && setUrl(u))
      .catch(() => mounted.current && setUrl('/fallback.png'))
    return () => {
      mounted.current = false
    }
  }, [props.data.sku])

  return (
    <>
      <img
        src={url}
        className="ag-cell-image"
        onClick={() => setOpen(true)}
        alt={props.data.sku}
      />
      <Modal
        isOpen={open}
        onRequestClose={() => setOpen(false)}
        overlayClassName="modal-overlay"
        className="modal-content"
      >
        <img src={url} style={{ maxWidth: '100%', maxHeight: '100%' }} alt={props.data.sku} />
        <button onClick={() => setOpen(false)}>Close</button>
      </Modal>
    </>
  )
}

const QuantityRenderer = (props: any) => {
  return (
    <input
      type="number"
      min={1}
      value={props.value || 1}
      onChange={(e) => {
        const newValue = Math.max(1, parseInt(e.target.value) || 1)
        props.setValue(newValue)
        props.context.updateQuantity(props.data.id, newValue)
      }}
      style={{ width: '60px' }}
    />
  )
}

const TotalRenderer = (props: any) => {
  const total = props.data.retailPrice * (props.data.quantity || 1)
  return <>£{total.toFixed(2)}</>
}

const StockRenderer = (props: any) => {
  const value = props.value
  return (
    <span className={`stock-badge ${value > 0 ? 'stock-in' : 'stock-out'}`}>
      {value > 0 ? `In Stock (${value})` : 'Out of Stock'}
    </span>
  )
}

const UploadRenderer = (props: any) => {
  return (
    <input
      type="file"
      accept="image/*"
      onChange={async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        await uploadBytes(
          storageRef(storage, `product-images/${props.data.sku}.jpg`),
          file
        )
        // Refresh the image
        props.api.refreshCells({ rowNodes: [props.node], columns: ['productImage'] })
      }}
    />
  )
}

const LOADER_SRC = 'https://lottie.host/728e2499-1d39-4c3c-b924-3e84b16fa75f/73WYrXNuA2.lottie'

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      res(dataUrl.split(',')[1])
    }
    reader.onerror = () => rej(reader.error)
    reader.readAsDataURL(blob)
  })
}

export default function ProductList() {
  const { brandName } = useParams<{ brandName?: string }>()
  const gridRef = useRef<AgGridReact>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [companyName, setCompanyName] = useState('')
  const [agentName, setAgentName] = useState('')
  const [printing, setPrinting] = useState(false)
  const [printingItems, setPrintingItems] = useState<any[]>([])
  const [pageSize, setPageSize] = useState(50)

  // Column definitions - removed duplicate checkbox column
  const columnDefs = useMemo<ColDef[]>(() => [
    {
      field: 'checkbox',
      headerCheckboxSelection: true,
      checkboxSelection: true,
      width: 50,
      pinned: 'left',
      headerName: ''
    },
    {
      field: 'productImage',
      headerName: 'Image',
      cellRenderer: ImageCellRenderer,
      width: 80,
      sortable: false
    },
    {
      field: 'name',
      headerName: 'Name',
      width: 300,
      tooltipField: 'name'
    },
    {
      field: 'sku',
      headerName: 'SKU',
      width: 120
    },
    {
      field: 'retailPrice',
      headerName: 'Price',
      width: 100,
      valueFormatter: (params) => `£${params.value.toFixed(2)}`
    },
    {
      field: 'quantity',
      headerName: 'Quantity',
      width: 100,
      cellRenderer: QuantityRenderer,
      sortable: false
    },
    {
      field: 'total',
      headerName: 'Total',
      width: 100,
      cellRenderer: TotalRenderer,
      sortable: false
    },
    {
      field: 'stockLevel',
      headerName: 'Stock',
      width: 120,
      cellRenderer: StockRenderer
    },
    {
      field: 'upload',
      headerName: 'Upload',
      width: 120,
      cellRenderer: UploadRenderer,
      sortable: false
    }
  ], [])

  useEffect(() => {
  ;(async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'items'));
      
      const all: Product[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name || data.item_name || '',
          sku: data.sku || data.item_id || '',
          stockLevel: data.stock_on_hand ?? data.stockLevel ?? 0,
          retailPrice: data.rate ?? data.retailPrice ?? 0,
          brand: data.brand || '',
          brand_normalized: data.brand_normalized || normalize(data.brand || ''),
          quantity: 1
        };
      });

      console.log('All items loaded:', all.length);
      console.log('Brand filter:', brandName);

      // More flexible filtering
      const filteredByBrand = brandName
        ? all.filter((p) => {
            const productBrand = normalize(p.brand_normalized || p.brand || '');
            const filterBrand = normalize(brandName);
            return productBrand.includes(filterBrand) || filterBrand.includes(productBrand);
          })
        : all;

      console.log('Filtered items:', filteredByBrand.length);

      // Remove stock level filter for debugging
      const productsWithQuantity = filteredByBrand.map(p => ({
        ...p,
        quantity: 1
      }));

      setProducts(productsWithQuantity);
      
      const qInit: Record<string, number> = {};
      productsWithQuantity.forEach((p) => {
        qInit[p.id] = 1;
      });
      setQuantities(qInit);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  })();
}, [brandName]);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setQuantities(prev => ({ ...prev, [id]: quantity }))
    setProducts(prev => prev.map(p => 
      p.id === id ? { ...p, quantity } : p
    ))
  }, [])

  const onGridReady = (params: GridReadyEvent) => {
    // Auto-size columns
    params.api.sizeColumnsToFit()
  }

  const onSelectionChanged = (event: SelectionChangedEvent) => {
    // Handle selection changes if needed
  }

  const onFilterTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    gridRef.current?.api.setGridOption('quickFilterText', e.target.value)
  }

  const exportPDF = async () => {
    const selectedRows = gridRef.current?.api.getSelectedRows() || []
    if (selectedRows.length === 0) {
      alert('Please select some products to export')
      return
    }

    const comp = window.prompt('Enter Company Name:', companyName)
    if (comp === null) return
    const agent = window.prompt('Enter Agent Name:', agentName)
    if (agent === null) return
    setCompanyName(comp)
    setAgentName(agent)

    setPrinting(true)

    const items = await Promise.all(
      selectedRows.map(async (product) => {
        const qty = quantities[product.id] || 1
        const total = product.retailPrice * qty
        let dataUrl = ''

        try {
          const fileRef = storageRef(storage, `product-images/${product.sku}.jpg`)
          const bytes = await getBytes(fileRef)
          const blob = new Blob([bytes], { type: 'image/jpeg' })
          const b64 = await blobToBase64(blob)
          dataUrl = `data:${blob.type};base64,${b64}`
        } catch {
          const resp = await fetch('/fallback.png')
          const blob = await resp.blob()
          const b64 = await blobToBase64(blob)
          dataUrl = `data:${blob.type};base64,${b64}`
        }

        return { original: product, dataUrl, quantity: qty, total }
      })
    )

    setPrintingItems(items)
    await new Promise((r) => setTimeout(r, 50))

    const el = document.getElementById('pdf-content')!
    el.classList.add('pdf-template--visible')
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: false,
      allowTaint: false,
    })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      unit: 'pt',
      format: [canvas.width, canvas.height],
    })
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
    pdf.save('photo-quotation.pdf')

    el.classList.remove('pdf-template--visible')
    setPrinting(false)
  }

  const exportExcel = async () => {
    const selectedRows = gridRef.current?.api.getSelectedRows() || []
    if (selectedRows.length === 0) {
      alert('Please select some products to export')
      return
    }

    const rows = await Promise.all(
      selectedRows.map(async (product) => {
        let imgBase64 = ''
        try {
          const url = await getDownloadURL(
            storageRef(storage, `product-images/${product.sku}.jpg`)
          )
          const resp = await fetch(url)
          const blob = await resp.blob()
          imgBase64 = await blobToBase64(blob)
        } catch {
          imgBase64 = ''
        }
        const qty = quantities[product.id] || 1
        return { original: product, imgBase64, qty }
      })
    )

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Stocklist')

    ws.addRow(['Image', 'Name', 'SKU', 'Price', 'Qty', 'Total'])

    ;[12, 30, 15, 12, 8, 12].forEach((w, i) => {
      ws.getColumn(i + 1).width = w
    })

    rows.forEach(({ original, imgBase64, qty }, idx) => {
      const total = original.retailPrice * qty
      const rowIndex = idx + 2

      ws.addRow(['', original.name, original.sku, original.retailPrice, qty, total])

      if (imgBase64) {
        const imageId = wb.addImage({
          base64: imgBase64,
          extension: 'png',
        })
        ws.addImage(imageId, {
          tl: { col: 0, row: rowIndex - 1 },
          ext: { width: 50, height: 50 },
          editAs: 'oneCell',
        })
      }
    })

    const buf = await wb.xlsx.writeBuffer()
    saveAs(new Blob([buf]), 'stocklist.xlsx')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <DotLottieReact
          src={LOADER_SRC}
          loop
          autoplay
          className="w-32 h-32"
        />
      </div>
    )
  }

  return (
    <div className="product-table-container">
      {brandName && (
        <div className="brand-logo-banner">
          <div className="brand-logo-box">
            <img
              src={`/logos/${normalize(brandName)}.png`}
              alt={`${brandName} logo`}
              className="brand-page-logo"
            />
          </div>
        </div>
      )}

      <div className="product-controls">
        <input
          className="search-input"
          value={search}
          onChange={onFilterTextChange}
          placeholder="Search by name or SKU..."
        />
        <div className="controls-right">
          <div className="select-wrapper">
            <label>Show</label>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value)
                setPageSize(newSize)
                gridRef.current?.api.setGridOption('paginationPageSize', newSize)
              }}
            >
              {[50, 100, 200].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="button-group">
            <button
              className="export-button"
              onClick={exportPDF}
            >
              Generate PDF Quote
            </button>
            <button
              className="export-button"
              onClick={exportExcel}
            >
              Generate Excel Quote
            </button>
          </div>
        </div>
      </div>

      <div className="ag-theme-custom" style={{ height: '600px', width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          rowData={products}
          columnDefs={columnDefs}
          theme={myTheme}
          onGridReady={onGridReady}
          onSelectionChanged={onSelectionChanged}
          rowSelection={{
            mode: 'multiRow',
            enableClickSelection: false
          }}
          pagination={true}
          paginationPageSize={pageSize}
          paginationPageSizeSelector={false}
          context={{ updateQuantity }}
          animateRows={true}
        />
      </div>

      {printing && (
        <div className="pdf-loading-overlay">
          <DotLottieReact
            src={LOADER_SRC}
            loop
            autoplay
            className="loader"
          />
        </div>
      )}

      <div
        id="pdf-content"
        className={`pdf-template${printing ? ' visible' : ''}`}
      >
        <div className="pdf-header-banner">
          <h1 className="pdf-title">Photo Quote</h1>
          {brandName && (
            <img
              className="pdf-brand-logo"
              src={`/logos/${normalize(brandName)}.png`}
              alt={`${brandName} logo`}
            />
          )}
        </div>
        <div className="pdf-info-row">
          <div className="pdf-info-left">
            <div className="pdf-company">{companyName}</div>
            <div className="pdf-agent">{agentName}</div>
          </div>
          <div className="pdf-info-right">
            Quotation Date: {new Date().toLocaleDateString()}
          </div>
        </div>
        <table className="pdf-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Description</th>
              <th>Price</th>
              <th>Qty</th>
              <th>Total</th>
              <th>SKU</th>
            </tr>
          </thead>
          <tbody>
            {printingItems.map(({ original, dataUrl, quantity, total }) => (
              <tr key={original.id}>
                <td className="pdf-td-image">
                  <img src={dataUrl} alt={original.sku} />
                </td>
                <td>{original.name}</td>
                <td>£{original.retailPrice.toFixed(2)}</td>
                <td>{quantity}</td>
                <td>£{total.toFixed(2)}</td>
                <td>{original.sku}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pdf-footer-banner" />
      </div>
    </div>
  )
}