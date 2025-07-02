import React, { useState } from 'react';
import { auth } from '../../firebase';

export function CustomerSyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const syncCurrentCustomer = async () => {
    if (!auth.currentUser) return;
    
    setSyncing(true);
    setSyncResult(null);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://splitfin-zoho-api.onrender.com'}/api/customers/sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerId: auth.currentUser.uid
          })
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setSyncResult('✅ Your account has been synced successfully!');
        // Reload the page to refresh customer data
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setSyncResult(`❌ Sync failed: ${data.error}`);
      }
    } catch (error) {
      setSyncResult(`❌ Error: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="customer-sync">
      <button 
        onClick={syncCurrentCustomer}
        disabled={syncing}
        className="sync-button"
      >
        {syncing ? 'Syncing...' : 'Sync My Account'}
      </button>
      {syncResult && <p className="sync-result">{syncResult}</p>}
    </div>
  );
}