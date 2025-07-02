import React, { useState, useEffect, useMemo } from 'react';
import { GoogleMap, LoadScript, Marker, MarkerClusterer, InfoWindow } from '@react-google-maps/api';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore'; // Add missing imports
import { db, auth } from '../firebase'; // Add auth import
import { useNavigate } from 'react-router-dom';
import './CustomerMap.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyB3fpUZexx1zRETMigOVtWFUNDe9Xe_sfs';

// UK Regions - keeping just centers for zoom functionality
const UK_REGIONS = {
  'Scotland': {
    center: { lat: 56.4907, lng: -4.2026 },
    color: '#1f77b4'
  },
  'North East': {
    center: { lat: 54.9783, lng: -1.6178 },
    color: '#ff7f0e'
  },
  'North West': {
    center: { lat: 53.7632, lng: -2.7044 },
    color: '#2ca02c'
  },
  'Wales': {
    center: { lat: 52.1307, lng: -3.7837 },
    color: '#d62728'
  },
  'Midlands': {
    center: { lat: 52.4862, lng: -1.8904 },
    color: '#9467bd'
  },
  'London': {
    center: { lat: 51.5074, lng: -0.1278 },
    color: '#8c564b'
  },
  'South East': {
    center: { lat: 51.2787, lng: 0.5217 },
    color: '#e377c2'
  },
  'South West': {
    center: { lat: 50.7772, lng: -3.9997 },
    color: '#7f7f7f'
  },
  'Ireland': {
    center: { lat: 53.4129, lng: -8.2439 },
    color: '#ff6b6b'
  }
};

interface Customer {
  id: string;
  customer_id: string; // Add this property
  customer_name: string;
  email: string;
  postcode: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  location_region?: string;
  total_spent?: number;
  order_count?: number;
  brand_preferences?: string;
}

// Add type for user data
interface UserData {
  role: string;
  zohospID?: string;
  zohoAgentID?: string;
  name?: string;
}

// Add type for order data
interface OrderData {
  customer_id: string;
  salesperson_id?: string;
  [key: string]: any;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: 54.5,
  lng: -4
};

const options = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
  styles: [
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#1a2332" }]
    },
    {
      featureType: "landscape",
      elementType: "geometry",
      stylers: [{ color: "#2c3e50" }]
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#34495e" }]
    },
    {
      featureType: "poi",
      elementType: "geometry",
      stylers: [{ color: "#34495e" }]
    },
    {
      featureType: "transit",
      elementType: "geometry",
      stylers: [{ color: "#34495e" }]
    },
    {
      elementType: "labels.text.stroke",
      stylers: [{ color: "#1a1f2a" }]
    },
    {
      elementType: "labels.text.fill",
      stylers: [{ color: "#95a5a6" }]
    }
  ]
};

export default function CustomerMapGoogle() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      
      // Get current user info
      const currentUserId = auth.currentUser?.uid;
      if (!currentUserId) {
        console.log('No authenticated user');
        setLoading(false);
        return;
      }
      
      // Get user document
      const userDoc = await getDoc(doc(db, 'users', currentUserId));
      
      if (!userDoc.exists()) {
        console.log('User document not found');
        setLoading(false);
        return;
      }
      
      const userData = userDoc.data() as UserData;
      const isAgent = userData.role === 'salesAgent';
      const userZohoId = userData.zohospID || userData.zohoAgentID;
      
      const customersSnapshot = await getDocs(collection(db, 'customer_data'));
      console.log('Total documents:', customersSnapshot.size);
      
      if (!customersSnapshot.empty) {
        const firstDoc = customersSnapshot.docs[0];
        const firstData = firstDoc.data();
        
        console.log('=== DOCUMENT STRUCTURE ===');
        console.log('Root fields:', Object.keys(firstData));
        
        // Check original_firebase_data
        if (firstData.original_firebase_data) {
          console.log('\n=== ORIGINAL_FIREBASE_DATA ===');
          console.log('Type:', typeof firstData.original_firebase_data);
          console.log('Fields:', Object.keys(firstData.original_firebase_data || {}));
          
          // Check for coordinates
          if (firstData.original_firebase_data.coordinates) {
            console.log('✅ Found coordinates:', firstData.original_firebase_data.coordinates);
          }
          
          // Check for customer_name
          if (firstData.original_firebase_data.customer_name) {
            console.log('✅ Found customer_name:', firstData.original_firebase_data.customer_name);
          }
        }
      }
      
      // Now map the data correctly from original_firebase_data
      let customersData = customersSnapshot.docs
        .map(doc => {
          const data = doc.data();
          const originalData = data.original_firebase_data || {};
          const zohoData = data.zoho_data || {};
          
          // Check for coordinates in original_firebase_data
          if (!originalData.coordinates?.latitude || !originalData.coordinates?.longitude) {
            return null;
          }
          
          return {
            id: doc.id,
            customer_id: data.firebase_uid || doc.id,
            customer_name: originalData.customer_name || 
                          originalData.company_name || 
                          zohoData.contact_name || 
                          'Unknown',
            email: originalData.email || zohoData.email || '',
            postcode: originalData.postcode || zohoData.zip || '',
            coordinates: {
              latitude: originalData.coordinates.latitude,
              longitude: originalData.coordinates.longitude
            },
            location_region: originalData.location_region || '',
            total_spent: originalData.total_spent || 0,
            order_count: originalData.order_count || 0,
            brand_preferences: originalData.brand_preferences || ''
          };
        })
        .filter(customer => customer !== null) as Customer[];
      
      // Filter for agents
      if (isAgent && userZohoId) {
        try {
          // Get agent's orders to find their customer IDs
          const ordersSnapshot = await getDocs(
            query(
              collection(db, 'salesorders'),
              where('salesperson_id', '==', userZohoId)
            )
          );
          
          const agentCustomerIds = new Set<string>();
          ordersSnapshot.docs.forEach(doc => {
            const data = doc.data() as OrderData;
            if (data.customer_id) {
              agentCustomerIds.add(data.customer_id);
            }
          });
          
          // Filter customers to only include agent's customers
          customersData = customersData.filter(customer => 
            agentCustomerIds.has(customer.customer_id)
          );
          
          console.log(`Agent ${userData.name} has ${agentCustomerIds.size} customers, ${customersData.length} with coordinates`);
        } catch (error) {
          console.error('Error filtering customers for agent:', error);
        }
      }
      
      console.log('\n=== RESULTS ===');
      console.log('Customers with coordinates:', customersData.length);
      if (customersData.length > 0) {
        console.log('First customer:', customersData[0]);
      }
      
      setCustomers(customersData);
      
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!selectedRegion) return customers;
    return customers.filter(customer => customer.location_region === selectedRegion);
  }, [customers, selectedRegion]);

  const regionStats = useMemo(() => {
    const stats: Record<string, { count: number; revenue: number }> = {};
    
    Object.keys(UK_REGIONS).forEach(region => {
      stats[region] = { count: 0, revenue: 0 };
    });
    
    customers.forEach(customer => {
      const region = customer.location_region;
      if (region && stats[region]) {
        stats[region].count++;
        stats[region].revenue += customer.total_spent || 0;
      }
    });
    
    return stats;
  }, [customers]);

  // Single handleRegionClick function with mobile logic
  const handleRegionClick = (region: string) => {
    setSelectedRegion(region === selectedRegion ? null : region);
    
    // Close sidebar on mobile after selection
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
    
    if (map && region !== selectedRegion && UK_REGIONS[region as keyof typeof UK_REGIONS]) {
      const regionData = UK_REGIONS[region as keyof typeof UK_REGIONS];
      map.panTo(regionData.center);
      map.setZoom(8);
    } else if (map) {
      map.panTo(defaultCenter);
      map.setZoom(6);
    }
  };

  const getMarkerIcon = (customer: Customer): google.maps.Symbol => {
    const scale = customer.total_spent 
      ? Math.min(Math.max(customer.total_spent / 1000, 10), 20) 
      : 10;
    
    const color = customer.total_spent && customer.total_spent > 10000 ? '#ff4444' : 
                  customer.total_spent && customer.total_spent > 5000 ? '#ff8800' : 
                  '#4CAF50';
    
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: scale,
      fillColor: color,
      fillOpacity: 0.8,
      strokeColor: 'white',
      strokeWeight: 2
    };
  };

  if (loading) {
    return (
      <div className="customer-map-loading">
        <div className="spinner"></div>
        <p>Loading customer locations...</p>
      </div>
    );
  }

  return (
    <div className="customer-map-container">
      {/* Mobile menu toggle */}
      <button 
        className="mobile-menu-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
        </svg>
      </button>

      {/* Sidebar overlay for mobile */}
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className={`map-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <h2>UK Regions</h2>
        <div className="region-list">
          {Object.entries(UK_REGIONS).map(([region, config]) => (
            <div
              key={region}
              className={`region-item ${selectedRegion === region ? 'active' : ''}`}
              onClick={() => handleRegionClick(region)}
              style={{ borderLeftColor: config.color }}
            >
              <h3>{region}</h3>
              <div className="region-stats">
                <span>{regionStats[region]?.count || 0} customers</span>
                <span>£{(regionStats[region]?.revenue || 0).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
        
        <div className="map-legend">
          <h3>Customer Value</h3>
          <div className="legend-item">
            <div className="legend-marker" style={{ backgroundColor: '#4CAF50' }}></div>
            <span>&lt; £5,000</span>
          </div>
          <div className="legend-item">
            <div className="legend-marker" style={{ backgroundColor: '#ff8800' }}></div>
            <span>£5,000 - £10,000</span>
          </div>
          <div className="legend-item">
            <div className="legend-marker" style={{ backgroundColor: '#ff4444' }}></div>
            <span>&gt; £10,000</span>
          </div>
        </div>
      </div>

      <div className="map-content">
        <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={defaultCenter}
            zoom={6}
            options={options}
            onLoad={setMap}
          >
            <MarkerClusterer
              options={{
                imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m',
                gridSize: 60,
                minimumClusterSize: 3,
                styles: [{
                  textColor: 'white',
                  url: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m1.png',
                  height: 53,
                  width: 53
                }]
              }}
            >
              {(clusterer) => (
                <>
                  {filteredCustomers.map(customer => (
                    <Marker
                      key={customer.id}
                      position={{
                        lat: customer.coordinates!.latitude,
                        lng: customer.coordinates!.longitude
                      }}
                      icon={getMarkerIcon(customer)}
                      clusterer={clusterer}
                      onClick={() => setSelectedCustomer(customer)}
                    />
                  ))}
                </>
              )}
            </MarkerClusterer>

            {selectedCustomer && (
              <InfoWindow
                position={{
                  lat: selectedCustomer.coordinates!.latitude,
                  lng: selectedCustomer.coordinates!.longitude
                }}
                onCloseClick={() => setSelectedCustomer(null)}
              >
                <div className="customer-popup-enhanced">
                  <div className="popup-header">
                    <h4>{selectedCustomer.customer_name}</h4>
                    <p className="customer-email">{selectedCustomer.email}</p>
                  </div>
                  
                  <div className="popup-info">
                    <div className="info-item">
                      <span className="info-label">Location:</span>
                      <span className="info-value">{selectedCustomer.postcode}</span>
                    </div>
                    <div className="popup-stats">
                      <div className="stat-item">
                        <span className="stat-label">Orders</span>
                        <span className="stat-value">{selectedCustomer.order_count || 0}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Total Spent</span>
                        <span className="stat-value">£{(selectedCustomer.total_spent || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="popup-actions">
                    <button 
                      className="popup-btn btn-view"
                      onClick={() => {
                        setSelectedCustomer(null);
                        navigate(`/customers/${selectedCustomer.id}`);
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                      </svg>
                      View Customer
                    </button>
                    <button 
                      className="popup-btn btn-directions"
                      onClick={() => {
                        const destination = `${selectedCustomer.coordinates!.latitude},${selectedCustomer.coordinates!.longitude}`;
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21.71 11.29l-9-9c-.39-.39-1.02-.39-1.41 0l-9 9c-.39.39-.39 1.02 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9c.39-.38.39-1.01 0-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z"/>
                      </svg>
                      Get Directions
                    </button>
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </LoadScript>
      </div>
    </div>
  );
}