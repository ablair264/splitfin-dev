import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// UK Regions boundaries
const UK_REGIONS = {
  'Scotland': {
    bounds: [[54.6, -8.2], [60.9, -0.7]],
    center: [56.4907, -4.2026] as [number, number],
    color: '#1f77b4'
  },
  'North East': {
    bounds: [[54.5, -3.5], [55.8, -0.7]],
    center: [54.9783, -1.6178] as [number, number],
    color: '#ff7f0e'
  },
  'North West': {
    bounds: [[52.9, -3.7], [55.2, -2.0]],
    center: [53.7632, -2.7044] as [number, number],
    color: '#2ca02c'
  },
  'Wales': {
    bounds: [[51.3, -5.3], [53.4, -2.6]],
    center: [52.1307, -3.7837] as [number, number],
    color: '#d62728'
  },
  'Midlands': {
    bounds: [[51.8, -3.5], [53.5, -0.5]],
    center: [52.4862, -1.8904] as [number, number],
    color: '#9467bd'
  },
  'London': {
    bounds: [[51.28, -0.51], [51.7, 0.33]],
    center: [51.5074, -0.1278] as [number, number],
    color: '#8c564b'
  },
  'South East': {
    bounds: [[50.7, -1.8], [51.7, 1.8]],
    center: [51.2787, 0.5217] as [number, number],
    color: '#e377c2'
  },
  'South West': {
    bounds: [[49.9, -6.4], [51.7, -2.0]],
    center: [50.7772, -3.9997] as [number, number],
    color: '#7f7f7f'
  }
};

interface Customer {
  id: string;
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
}

interface Props {
  customers: Customer[];
}

export default function CustomerMapInner({ customers }: Props) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([54.5, -4]);
  const [mapZoom, setMapZoom] = useState(6);

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

  const handleRegionClick = (region: string) => {
    setSelectedRegion(region === selectedRegion ? null : region);
    
    if (region !== selectedRegion && UK_REGIONS[region as keyof typeof UK_REGIONS]) {
      setMapCenter(UK_REGIONS[region as keyof typeof UK_REGIONS].center);
      setMapZoom(8);
    } else {
      setMapCenter([54.5, -4]);
      setMapZoom(6);
    }
  };

  const createCustomIcon = (customer: Customer) => {
    const size = customer.total_spent ? Math.min(Math.max(customer.total_spent / 1000, 20), 40) : 20;
    
    return L.divIcon({
      className: 'customer-marker',
      html: `<div style="width: ${size}px; height: ${size}px; background-color: ${
        customer.total_spent && customer.total_spent > 10000 ? '#ff4444' : 
        customer.total_spent && customer.total_spent > 5000 ? '#ff8800' : 
        '#4CAF50'
      }; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  };

  return (
    <div className="customer-map-container">
      <div className="map-sidebar">
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
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {filteredCustomers.map(customer => (
            <Marker
              key={customer.id}
              position={[customer.coordinates!.latitude, customer.coordinates!.longitude]}
              icon={createCustomIcon(customer)}
            >
              <Popup>
                <div className="customer-popup">
                  <h4>{customer.customer_name}</h4>
                  <p>{customer.email}</p>
                  <p>{customer.postcode}</p>
                  <div className="popup-stats">
                    <span>Orders: {customer.order_count || 0}</span>
                    <span>Total: £{(customer.total_spent || 0).toLocaleString()}</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}