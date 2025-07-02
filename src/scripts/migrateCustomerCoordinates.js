import admin from 'firebase-admin';
import axios from 'axios';

// Initialize Firebase Admin (adjust path as needed)
admin.initializeApp({
  // your config
});

const db = admin.firestore();

// UK Postcode regex
const UK_POSTCODE_REGEX = /^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}|GIR ?0A{2})$/i;

// Function to get coordinates from postcode using Postcodes.io (free UK postcode API)
async function getCoordinatesFromPostcode(postcode) {
  try {
    const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
    const response = await axios.get(`https://api.postcodes.io/postcodes/${cleanPostcode}`);
    
    if (response.data.status === 200 && response.data.result) {
      return {
        latitude: response.data.result.latitude,
        longitude: response.data.result.longitude,
        region: response.data.result.european_electoral_region,
        country: response.data.result.country,
        admin_district: response.data.result.admin_district,
        parish: response.data.result.parish
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching coordinates for postcode ${postcode}:`, error.message);
    return null;
  }
}

// Function to determine UK region from coordinates/location data
function determineUKRegion(locationData) {
  if (!locationData) return 'Unknown';
  
  const region = locationData.region?.toLowerCase() || '';
  const country = locationData.country?.toLowerCase() || '';
  const district = locationData.admin_district?.toLowerCase() || '';
  
  // Scotland
  if (country === 'scotland') return 'Scotland';
  
  // Wales
  if (country === 'wales') return 'Wales';
  
  // London
  if (region.includes('london') || district.includes('london')) return 'London';
  
  // Map European electoral regions to our custom regions
  if (region.includes('north east')) return 'North East';
  if (region.includes('north west')) return 'North West';
  if (region.includes('yorkshire')) return 'North East'; // Group Yorkshire with North East
  if (region.includes('east midlands') || region.includes('west midlands')) return 'Midlands';
  if (region.includes('south east')) return 'South East';
  if (region.includes('south west')) return 'South West';
  if (region.includes('eastern')) return 'South East'; // Group Eastern with South East
  
  return 'Unknown';
}

// Main migration function
async function migrateCustomerCoordinates() {
  console.log('🚀 Starting customer coordinates migration...');
  
  try {
    // Get all customers
    const customersSnapshot = await db.collection('normalized_customers').get();
    console.log(`Found ${customersSnapshot.size} customers to process`);
    
    let processed = 0;
    let updated = 0;
    let errors = 0;
    
    // Process in batches to avoid rate limits
    const batchSize = 10;
    const batches = [];
    let currentBatch = [];
    
    customersSnapshot.forEach(doc => {
      currentBatch.push(doc);
      if (currentBatch.length === batchSize) {
        batches.push(currentBatch);
        currentBatch = [];
      }
    });
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }
    
    // Process each batch
    for (const batch of batches) {
      const promises = batch.map(async (doc) => {
        const data = doc.data();
        const postcode = data.postcode || data.postal_code || data.zip_code;
        
        processed++;
        
        if (!postcode) {
          console.log(`⚠️  Customer ${data.customer_name || doc.id} has no postcode`);
          return;
        }
        
        // Check if postcode is valid UK format
        if (!UK_POSTCODE_REGEX.test(postcode)) {
          console.log(`⚠️  Invalid UK postcode for ${data.customer_name}: ${postcode}`);
          return;
        }
        
        try {
          // Get coordinates
          const locationData = await getCoordinatesFromPostcode(postcode);
          
          if (locationData) {
            const region = determineUKRegion(locationData);
            
            // Update the document
            await doc.ref.update({
              postcode: postcode.toUpperCase(),
              coordinates: {
                latitude: locationData.latitude,
                longitude: locationData.longitude
              },
              location_region: region,
              location_country: locationData.country,
              location_district: locationData.admin_district,
              location_updated: admin.firestore.FieldValue.serverTimestamp()
            });
            
            updated++;
            console.log(`✅ Updated ${data.customer_name} - ${region}`);
          } else {
            errors++;
            console.log(`❌ Could not get coordinates for ${data.customer_name} - ${postcode}`);
          }
        } catch (error) {
          errors++;
          console.error(`❌ Error updating ${data.customer_name}:`, error.message);
        }
      });
      
      await Promise.all(promises);
      
      // Add delay between batches to respect rate limits
      if (batches.indexOf(batch) < batches.length - 1) {
        console.log(`Processed batch ${batches.indexOf(batch) + 1}/${batches.length}, waiting 1 second...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`Total customers: ${customersSnapshot.size}`);
    console.log(`Processed: ${processed}`);
    console.log(`Updated: ${updated}`);
    console.log(`Errors: ${errors}`);
    console.log('✅ Migration complete!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run the migration
migrateCustomerCoordinates();