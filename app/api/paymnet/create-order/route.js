import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import connectDB from '@/lib/db'
import Tenant from '@/models/Tenant'
import { requireAuth } from '@/lib/auth'

export async function POST(request) {
  const user = requireAuth(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { tenantId, amount, month, year } = await request.json()

    if (!tenantId || !amount || !month || !year) {
      return NextResponse.json({ error: 'tenantId, amount, month and year are required' }, { status: 400 })
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: 'Razorpay keys not configured in .env.local' }, { status: 500 })
    }

    await connectDB()

    // FIX: Check if pending order already exists for this month to avoid duplicates
    const existingTenant = await Tenant.findById(tenantId)
    if (!existingTenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const alreadyPaid = existingTenant.payments?.some(
      p => p.month === month && p.year === Number(year) && p.status === 'paid'
    )
    if (alreadyPaid) {
      return NextResponse.json({ error: `Rent for ${month} ${year} is already paid` }, { status: 409 })
    }

    // Remove any stale pending entries for same month/year before creating new order
    await Tenant.findByIdAndUpdate(tenantId, {
      $pull: {
        payments: { month, year: Number(year), status: 'pending' }
      }
    })

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })

    const order = await razorpay.orders.create({
      amount: Math.round(Number(amount) * 100),
      currency: 'INR',
      receipt: `rent_${tenantId}_${month}_${year}`,
      notes: { tenantId, month, year },
    })

    await Tenant.findByIdAndUpdate(tenantId, {
      $push: {
        payments: {
          amount: Number(amount),
          month,
          year: Number(year),
          status: 'pending',
          razorpayOrderId: order.id,
        }
      }
    })

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    })
  } catch (err) {
    console.error('Create order error:', err)
    return NextResponse.json({ error: err.message || 'Failed to create order' }, { status: 500 })
  }
}
