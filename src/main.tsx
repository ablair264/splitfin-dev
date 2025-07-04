// main.tsx - Updated routes
import './styles.css'
import './styles/variables.css';  // If importing here too
import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth, db } from './firebase'
import { doc, getDoc } from 'firebase/firestore'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { PurchaseOrderSuggestions } from './components/PurchaseOrderSuggestions';
import { MessagingProvider } from './contexts/MessagingContext';
import './styles/tailwind.css';

ModuleRegistry.registerModules([AllCommunityModule])

// Import components
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import CustomersManagement from './components/CustomersManagement'
import NewCustomer from './components/NewCustomer'
import AllProducts from './components/AllProducts'
import ReviewOrder from './components/ReviewOrderPage'
import BrandSelector from './components/BrandSelector'
import ViewOrders from './components/ViewOrders'
import LiveStockList from './components/ProductList'
import OrderManagement from './components/OrderManagement'
import NewPurchaseOrder from './components/NewPurchaseOrder'
import ViewPurchaseOrders from './components/ViewPurchaseOrders'
import MasterLayout from './layouts/MasterLayout'
import { UserProvider } from './components/UserContext'
import LottieLoader from './components/LottieLoader'
import CustomerMapGoogle from './components/CustomerMapGoogle'
import CustomerDetail from './components/CustomerDetail';
import CustomerCheckout from './components/CustomerCheckout/CustomerCheckout';
import CustomerOrderConfirmation from './components/CustomerOrderConfirmation/CustomerOrderConfirmation';
import OrderSummary from './components/OrderSummary';
import OrderConfirmation from './components/OrderConfirmation';
import CustomerOrderDetail from './components/CustomerOrderDetail/CustomerOrderDetail';
import ReportGenerator from './components/ReportGenerator/ReportGenerator';

import CustomerLogin from './components/CustomerAuth/CustomerLogin';
import CustomerLayout from './components/CustomerLayout/CustomerLayout';
import CustomerDashboard from './components/CustomerDashboard/CustomerDashboard';
import CustomerProducts from './components/CustomerProducts/CustomerProducts';
import CustomerCart from './components/CustomerCart/CustomerCart';
import CustomerOrders from './components/CustomerOrders/CustomerOrders';
import CustomerAccount from './components/CustomerAccount/CustomerAccount';
import BrandSelection from './components/BrandSelection/BrandSelection';
import CreateCustomer from './components/CreateCustomer';
import PendingCustomers from './components/PendingCustomers/PendingCustomers';
import CustomerSignup from './components/CustomerSignup/CustomerSignup';
import OrderDetail from './components/OrderDetail';
import InvoiceManagement from './components/InvoiceManagement';
import CustomerProtectedRoute from './components/CustomerAuth/CustomerProtectedRoute';
import CustomerNewOrder from './components/CustomerNewOrder/CustomerNewOrder';
import CustomerAmendOrder from './components/CustomerAmendOrder/CustomerAmendOrder';
import CustomerInvoices from './components/CustomerInvoices/CustomerInvoices';
import CustomerPayInvoice from './components/CustomerPayInvoice/CustomerPayInvoice';
import CustomerCatalogues from './components/CustomerCatalogues/CustomerCatalogues';
import CustomerRequestCatalogue from './components/CustomerRequestCatalogue/CustomerRequestCatalogue';
import CustomerBrands from './components/CustomerBrands/CustomerBrands';
import AgentManagement from './components/AgentManagement'
import CustomerApproval from './components/CustomerApproval/CustomerApproval';
import OrderApproval from './components/OrderApproval/OrderApproval';
import CustomerSettings from './components/CustomerSettings/CustomerSettings';

// Import messaging CSS
import './contexts/Messaging.css';

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [userLoading, setUserLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        try {
          const userRef = doc(db, 'users', u.uid)
          const userSnap = await getDoc(userRef)
          if (userSnap.exists()) {
            const userData = userSnap.data()
            if (userData?.role === 'salesAgent' && userData?.agentID) {
              localStorage.setItem('agentID', userData.agentID)
            }
          }
        } catch (error) {
          console.error('Failed to fetch user data:', error)
        }
      } else {
        localStorage.removeItem('agentID')
      }
      setUserLoading(false)
    })

    return () => unsubscribe()
  }, [])

  if (userLoading) {
    return (
      <LottieLoader
        size="large"
        message="Loading Splitfin Dashboard..."
        subMessage="Initializing your workspace"
        overlay={true}
        style={{ backgroundColor: '#0f1419' }}
      />
    )
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route index element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
      <Route path="/customer/login" element={<CustomerLogin />} />
      <Route path="/customer/signup" element={<CustomerSignup />} /> 

      {/* Customer Routes - MessagingProvider is already wrapping these via the root provider */}
      <Route path="/customer" element={<CustomerProtectedRoute><CustomerLayout /></CustomerProtectedRoute>}>
        <Route path="dashboard" element={<CustomerDashboard />} />
        <Route path="new-order" element={<CustomerNewOrder />} />
        <Route path="orders" element={<CustomerOrders />} />
        <Route path="orders/amend" element={<CustomerAmendOrder />} />
        <Route path="orders/detail" element={<CustomerOrderDetail />} />
        <Route path="invoices" element={<CustomerInvoices />} />
        <Route path="invoices/pay" element={<CustomerPayInvoice />} />
        <Route path="catalogues" element={<CustomerCatalogues />} />
        <Route path="catalogues/request" element={<CustomerRequestCatalogue />} />
        <Route path="account" element={<CustomerAccount />} />
        <Route path="brands" element={<CustomerBrands />} />
        <Route path="brand/:brandId" element={<CustomerProducts />} />
        <Route path="cart" element={<CustomerCart />} />
        <Route path="checkout" element={<CustomerCheckout />} />
        <Route path="order-confirmation" element={<CustomerOrderConfirmation />} />
        <Route index element={<Navigate to="/customer/dashboard" />} />
      </Route>

      {/* Protected Routes */}
      <Route element={user ? <MasterLayout /> : <Navigate to="/login" replace />}>
        {/* Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Customers */}
        <Route path="/customers" element={<CustomersManagement />} />
        <Route path="/customers/new" element={<NewCustomer />} />
        <Route path="/customers/map" element={<CustomerMapGoogle />} /> 
        <Route path="/customers/create-account" element={<CreateCustomer />} />
        <Route path="/customers/pending" element={<PendingCustomers />} />
        <Route path="/customer/:customerId" element={<CustomerDetail />} />
        <Route path="/customers/approval" element={<CustomerApproval />} />
        <Route path="/customers/management" element={<CustomerSettings />} />
        
        <Route path="/reports" element={<ReportGenerator />} />
		<Route path="/reports/saved" element={<ReportGenerator />} /> {/* Will show saved tab by default */}
		<Route path="/reports/templates" element={<ReportGenerator />} /> {/* Brand manager templates */}
        
        
        {/* Orders */}
        <Route path="/orders" element={<ViewOrders />} />
        <Route path="/orders/approval" element={<OrderApproval />} />
        <Route path="/select-brand/:customerId" element={<BrandSelector />} />
        <Route path="/products/:customerId/:brandID" element={<AllProducts />} />
        <Route path="/review-order" element={<ReviewOrder />} />
        <Route path="/order/:orderId" element={<OrderDetail />} />
        <Route path="/new-customer" element={<NewCustomer />} />
<Route path="/order-summary" element={<OrderSummary />} />
<Route path="/order-confirmation" element={<OrderConfirmation />} />
        
        {/* Live Stocklists */}
        <Route path="/brand/:brandName" element={<LiveStockList />} />
        
        {/* Purchase Orders */}
        <Route path="/purchase-orders" element={<ViewPurchaseOrders />} />
        <Route path="/purchase-orders/new" element={<NewPurchaseOrder />} />
        <Route path="/purchase-orders/order-management" element={<OrderManagement />} />
        <Route path="/purchase-orders/purchase-suggestions" element={<PurchaseOrderSuggestions />} />
        
        {/* Invoices */}
        <Route path="/invoices" element={<InvoiceManagement />} />
        <Route path="/invoice/:invoiceId" element={<InvoiceManagement />} />
        
        {/* Agent Management */}
        <Route path="/agents" element={<AgentManagement />} />
        
        {/* Settings */}
        <Route path="/settings" element={<div>Settings Page</div>} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
    </Routes>
  )
}

// Root App Component with all providers
function RootApp() {
  return (
    <React.StrictMode>
      <BrowserRouter>
        <UserProvider>
          <MessagingProvider>
            <App />
          </MessagingProvider>
        </UserProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<RootApp />);