import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Tenant from '@/models/Tenant'
import { requireAuth } from '@/lib/auth'

export async function GET(request, { params }) {
  const user = requireAuth(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await connectDB()
    const tenant = await Tenant.findById(params.id)
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    return NextResponse.json({ tenant })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch tenant' }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  const user = requireAuth(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await connectDB()
    const body = await request.json()

    // FIX: Only update allowed fields — never overwrite payments array
    const { name, phone, email, roomNumber, rentAmount, depositAmount, address, notes, joinDate } = body
    const updateFields = {}
    if (name !== undefined) updateFields.name = name
    if (phone !== undefined) updateFields.phone = phone
    if (email !== undefined) updateFields.email = email
    if (roomNumber !== undefined) updateFields.roomNumber = roomNumber
    if (rentAmount !== undefined) updateFields.rentAmount = Number(rentAmount)
    if (depositAmount !== undefined) updateFields.depositAmount = Number(depositAmount)
    if (address !== undefined) updateFields.address = address
    if (notes !== undefined) updateFields.notes = notes
    if (joinDate !== undefined) updateFields.joinDate = new Date(joinDate)

    const tenant = await Tenant.findByIdAndUpdate(
      params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    )

    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    return NextResponse.json({ tenant })
  } catch (err) {
    console.error('PUT tenant error:', err)
    return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const user = requireAuth(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await connectDB()
    const tenant = await Tenant.findByIdAndUpdate(
      params.id,
      { isActive: false },
      { new: true }
    )
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    return NextResponse.json({ message: 'Tenant deactivated successfully' })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete tenant' }, { status: 500 })
  }
}
