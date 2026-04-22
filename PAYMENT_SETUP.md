# Payment Gateway Setup Instructions

## Razorpay Setup

1. Create a Razorpay account at https://razorpay.com
2. Go to Dashboard > Settings > API Keys
3. Generate Test/Live API Keys
4. Copy the following to your .env.local file:

```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
```

## Supabase Setup

Your Supabase database is already configured. The transactions table has been created automatically.

## Environment Variables

Add these to your .env.local file:

```
JWT_SECRET=MyRentApp@2026#SecureKey!

MONGODB_URI=your_mongodb_connection_string

RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key_id

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Payment Features

1. UPI Payments
2. Debit/Credit Card Payments
3. Net Banking
4. Automatic Payment Verification
5. Transaction History Tracking
6. Digital Receipts with Transaction IDs

## How It Works

1. Tenant selects "Pay Now" on pending payment
2. Chooses payment method (UPI/Card/Net Banking)
3. Razorpay payment gateway opens
4. Payment is processed securely
5. System automatically verifies payment
6. Payment status updates automatically
7. Transaction ID generated and stored
8. Digital receipt available for download

## Testing

Use Razorpay test mode credentials for testing:
- Test Card: 4111 1111 1111 1111
- CVV: Any 3 digits
- Expiry: Any future date
