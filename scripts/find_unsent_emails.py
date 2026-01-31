import csv
import sys
import os

def find_unsent_emails(customers_csv_path, sent_log_path):
    sent_emails = set()
    if os.path.exists(sent_log_path):
        with open(sent_log_path, 'r') as f:
            for line in f:
                sent_emails.add(line.strip().lower())

    all_customer_emails = set()
    unsent_emails_details = []

    if not os.path.exists(customers_csv_path):
        print(f"Error: Customer CSV file not found at {customers_csv_path}", file=sys.stderr)
        return []

    with open(customers_csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            email = row.get('Email', '').strip().lower()
            if email:
                all_customer_emails.add(email)
                if email not in sent_emails:
                    unsent_emails_details.append(row)
    
    return unsent_emails_details

if __name__ == "__main__":
    customers_csv_path = 'unified_customers.csv'
    sent_log_path = 'sent_unified_pnp_latino.log'

    unsent = find_unsent_emails(customers_csv_path, sent_log_path)

    if unsent:
        print("Emails not yet sent (or failed):")
        for customer in unsent:
            print(f"- {customer.get('Email', 'N/A')} (Name: {customer.get('Name', 'N/A')}, ID: {customer.get('id', 'N/A')})")
        print(f"\nTotal unsent/failed emails: {len(unsent)}")
    else:
        print("All emails from unified_customers.csv are marked as sent in the log.")
