import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Tenant from '@/models/Tenant'
import { requireAuth } from '@/lib/auth'

export async function POST(request) {
  const user = requireAuth(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { tenantId, amount, month, year } = await request.json()
    if (!tenantId || !amount || !month || !year) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await connectDB()
    const existingTenant = await Tenant.findById(tenantId)
    if (!existingTenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const alreadyPaid = existingTenant.payments?.some(
      p => p.month === month && p.year === Number(year) && p.status === 'paid'
    )
    if (alreadyPaid) {
      return NextResponse.json({ error: `Rent for ${month} ${year} is already paid` }, { status: 409 })
    }

    // Remove stale pending entries for same month
    await Tenant.findByIdAndUpdate(tenantId, {
      $pull: { payments: { month, year: Number(year), status: 'pending' } }
    })

    const transactionId = `CASH${Date.now()}`
    await Tenant.findByIdAndUpdate(tenantId, {
      $push: {
        payments: {
          amount: Number(amount),
          month,
          year: Number(year),
          status: 'paid',
          transactionId,
          paidAt: new Date(),
        }
      }
    })

    return NextResponse.json({ success: true, transactionId, message: 'Cash payment recorded' })
  } catch (err) {
    console.error('Cash payment error:', err)
    return NextResponse.json({ error: err.message || 'Failed to record payment' }, { status: 500 })
  }
}
