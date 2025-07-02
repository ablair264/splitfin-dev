import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
from collections import defaultdict

# Initialize Firebase Admin SDK
cred = credentials.Certificate('key.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

def fix_unknown_customers_cross_collection():
    """
    Updates customer_name in one collection by looking up 
    the customer_id in another collection
    """
    
    # Adjust these collection names based on your setup
    source_collection = 'customers'  # Collection with "Unknown Customer" names
    lookup_collection = 'normalized_customers'  # Collection with correct names
    
    source_ref = db.collection(normalized_customers)
    lookup_ref = db.collection(customers)
    
    print(f"Fetching customers from {source_collection}...")
    
    # Get all documents where customer_name is "Unknown Customer"
    unknown_customers = source_ref.where('customer_name', '==', 'Unknown Customer').get()
    
    if not unknown_customers:
        print("No unknown customers found!")
        return
    
    fixed_count = 0
    not_found_count = 0
    error_count = 0
    
    for doc in unknown_customers:
        try:
            data = doc.to_dict()
            doc_id = doc.id
            customer_id = data.get('customer_id') or doc_id
            
            print(f"\nProcessing: {doc_id} (customer_id: {customer_id})")
            
            # Look up in the normalized collection
            # First try by document ID
            lookup_doc = lookup_ref.document(customer_id).get()
            
            if not lookup_doc.exists:
                # Try querying by customer_id field
                query_results = lookup_ref.where('customer_id', '==', customer_id).limit(1).get()
                if query_results:
                    lookup_doc = query_results[0]
                else:
                    print(f"  - Customer not found in {lookup_collection}")
                    not_found_count += 1
                    continue
            
            lookup_data = lookup_doc.to_dict()
            
            # Get the correct name
            correct_name = (
                lookup_data.get('name') or 
                lookup_data.get('customer_name') or 
                lookup_data.get('company_name') or
                ''
            )
            
            if correct_name and correct_name != 'Unknown Customer':
                print(f"  - Found name: '{correct_name}'")
                
                # Update the source document
                source_ref.document(doc_id).update({
                    'customer_name': correct_name,
                    'name': correct_name,  # Update both fields to be safe
                    'updated_at': datetime.now(),
                    'updated_by': 'fix_unknown_customers_script'
                })
                
                fixed_count += 1
                print(f"  - Updated successfully!")
            else:
                print(f"  - No valid name found in lookup collection")
                not_found_count += 1
                
        except Exception as e:
            error_count += 1
            print(f"  - Error: {str(e)}")
    
    print(f"\n--- Summary ---")
    print(f"Total unknown customers processed: {len(unknown_customers)}")
    print(f"Successfully fixed: {fixed_count}")
    print(f"Not found or no valid name: {not_found_count}")
    print(f"Errors: {error_count}")

if __name__ == "__main__":
    # Run version 1 or 2 based on your needs
    fix_unknown_customers()  # Version 1
    # fix_unknown_customers_cross_collection()  # Version 2