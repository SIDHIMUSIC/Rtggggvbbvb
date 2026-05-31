'use client'
import { Suspense } from 'react'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function TenantsContent() {
  const [tenants, setTenants] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [payLoading, setPayLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [msg, setMsg] = useState('')
  const [showPayModal, setShowPayModal] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('id')

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const now = new Date()
  const thisMonth = months[now.getMonth()]
  const thisYear = now.getFullYear()

  // Auto-clear message after 3 seconds
  useEffect(() => {
    if (msg) {
      const t = setTimeout(() => setMsg(''), 3000)
      return () => clearTimeout(t)
    }
  }, [msg])

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch('/api/tenants')
      if (res.status === 401) { router.push('/login'); return }
      const data = await res.json()
      const list = Array.isArray(data) ? data : (data.tenants || [])
      setTenants(list)
      if (selectedId) {
        const found = list.find(t => t._id === selectedId)
        if (found) {
          setSelected(found)
          setEditForm({
            name: found.name, phone: found.phone, email: found.email || '',
            roomNumber: found.roomNumber, rentAmount: found.rentAmount,
            depositAmount: found.depositAmount || 0, address: found.address || '',
            notes: found.notes || '', joinDate: found.joinDate || found.startDate,
          })
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedId, router])

  useEffect(() => { fetchTenants() }, [fetchTenants])

  function selectTenant(t) {
    setSelected(t)
    setEditForm({
      name: t.name, phone: t.phone, email: t.email || '',
      roomNumber: t.roomNumber, rentAmount: t.rentAmount,
      depositAmount: t.depositAmount || 0, address: t.address || '',
      notes: t.notes || '', joinDate: t.joinDate || t.startDate,
    })
    setEditMode(false)
    setMsg('')
    setShowPayModal(false)
    router.push(`/tenants?id=${t._id}`, { scroll: false })
  }

  async function handleEdit(e) {
    e.preventDefault()
    const token = document.cookie.match(/token=([^;]+)/)?.[1] || ''
    const res = await fetch(`/api/tenants/${selected._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(editForm),
    })
    const data = await res.json()
    if (res.ok || data.success) {
      setMsg('✅ Updated successfully!')
      setEditMode(false)
      await fetchTenants()
    } else {
      setMsg(`❌ ${data.error || data.message}`)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Is tenant ko remove karna chahte ho?')) return
    const token = document.cookie.match(/token=([^;]+)/)?.[1] || ''
    const res = await fetch(`/api/tenants`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setSelected(null)
      router.push('/tenants')
      await fetchTenants()
    }
  }

  // ✅ FIXED: Sahi API body bhej raha hai ab
  async function handleCashPayment() {
    setPayLoading(true)
    setMsg('')
    try {
      const token = document.cookie.match(/token=([^;]+)/)?.[1] || ''
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tenant: selected._id,
          month: `${thisMonth} ${thisYear}`,
          paidAmount: selected.rentAmount,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setMsg('✅ Cash payment record ho gaya!')
        setShowPayModal(false)
        await fetchTenants()
      } else {
        setMsg(`❌ ${data.message || 'Kuch galat hua'}`)
        setShowPayModal(false)
      }
    } catch (err) {
      setMsg(`❌ Error: ${err.message}`)
    } finally {
      setPayLoading(false) // ✅ ALWAYS reset — button kabhi freeze nahi hoga
    }
  }

  // ✅ FIXED: payLoading har case mein false hoga, logout nahi karna padega
  async function handleOnlinePayment() {
    setPayLoading(true)
    setMsg('')
    setShowPayModal(false)
    try {
      await loadRazorpayScript()
      const token = document.cookie.match(/token=([^;]+)/)?.[1] || ''
      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tenantId: selected._id,
          amount: selected.rentAmount,
          month: thisMonth,
          year: thisYear,
        }),
      })
      const order = await res.json()
      if (!res.ok) throw new Error(order.error || 'Order create nahi hua')

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Harry Rent House',
        description: `Rent for ${thisMonth} ${thisYear}`,
        order_id: order.orderId,
        prefill: {
          name: selected.name,
          contact: selected.phone,
          email: selected.email || '',
        },
        theme: { color: '#3b82f6' },
        handler: async function (response) {
          try {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                tenantId: selected._id,
              }),
            })
            const verifyData = await verifyRes.json()
            if (verifyRes.ok) {
              setMsg('✅ Payment successful!')
              await fetchTenants()
            } else {
              setMsg(`❌ Verification failed: ${verifyData.error}`)
            }
          } catch (err) {
            setMsg(`❌ Verify error: ${err.message}`)
          } finally {
            setPayLoading(false) // ✅ FIXED: yeh line pehle missing thi
          }
        },
        modal: {
          ondismiss: () => {
            setMsg('ℹ️ Payment cancelled')
            setPayLoading(false) // ✅ FIXED: modal band karne pe bhi reset
          },
        },
      }
      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', function (response) {
        setMsg(`❌ Payment failed: ${response.error.description}`)
        setPayLoading(false) // ✅ FIXED: failure pe bhi reset
      })
      rzp.open()
    } catch (err) {
      setMsg(`❌ Payment error: ${err.message}`)
      setPayLoading(false) // ✅ FIXED: catch mein bhi reset
    }
  }

  function loadRazorpayScript() {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) { resolve(); return }
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = resolve
      script.onerror = () => reject(new Error('Razorpay script load nahi hua'))
      document.body.appendChild(script)
    })
  }

  const active = tenants.filter(t => t.isActive !== false)
  const selectedFresh = selected ? tenants.find(t => t._id === selected._id) : null
  const selectedPaid = selectedFresh?.payments?.some(
    p => p.month === thisMonth && String(p.year) === String(thisYear) && p.status === 'paid'
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9' }}>
      {/* Header */}
      <div style={{
        background: '#1e293b', borderBottom: '1px solid #334155',
        padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>🏠 Rent Management</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => router.push('/dashboard')}
            style={{ background: '#334155', border: 'none', color: '#cbd5e1', padding: '7px 14px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px' }}
          >
            ← Dashboard
          </button>
          <button
            onClick={() => router.push('/add-tenant')}
            style={{ background: '#1d4ed8', border: 'none', color: 'white', padding: '7px 14px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
          >
            + Tenant Add
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
        {/* Left List */}
        <div style={{
          width: '280px', minWidth: '280px', borderRight: '1px solid #334155',
          overflowY: 'auto', background: '#0f172a'
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #334155' }}>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Tenants ({active.length})</span>
          </div>

          {loading ? (
            <p style={{ padding: '20px', color: '#64748b', textAlign: 'center' }}>Loading...</p>
          ) : active.length === 0 ? (
            <p style={{ padding: '24px 16px', color: '#64748b', textAlign: 'center', fontSize: '13px' }}>
              Koi tenant nahi. Add karo!
            </p>
          ) : active.map(t => {
            const paid = t.payments?.some(
              p => p.month === thisMonth && String(p.year) === String(thisYear) && p.status === 'paid'
            )
            return (
              <div
                key={t._id}
                onClick={() => selectTenant(t)}
                style={{
                  padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid #1e293b',
                  background: selectedFresh?._id === t._id ? '#1e293b' : 'transparent',
                  borderLeft: selectedFresh?._id === t._id ? '3px solid #3b82f6' : '3px solid transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{t.name}</div>
                <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                  Room {t.roomNumber} · ₹{t.rentAmount?.toLocaleString()}
                </div>
                <span style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '10px', marginTop: '4px',
                  display: 'inline-block',
                  background: paid ? '#14532d' : '#7f1d1d',
                  color: paid ? '#86efac' : '#fca5a5',
                }}>
                  {paid ? '✓ Paid' : '⏳ Pending'}
                </span>
              </div>
            )
          })}
        </div>

        {/* Right Detail */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {!selectedFresh ? (
            <div style={{ textAlign: 'center', marginTop: '80px', color: '#475569' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>👈</div>
              <p>Tenant select karo details dekhne ke liye</p>
            </div>
          ) : (
            <>
              {/* Message Bar */}
              {msg && (
                <div style={{
                  background: msg.startsWith('✅') ? '#14532d' : msg.startsWith('ℹ️') ? '#1e3a5f' : '#7f1d1d',
                  border: `1px solid ${msg.startsWith('✅') ? '#22c55e' : msg.startsWith('ℹ️') ? '#3b82f6' : '#ef4444'}`,
                  borderRadius: '8px', padding: '10px 16px', marginBottom: '20px',
                  color: msg.startsWith('✅') ? '#86efac' : msg.startsWith('ℹ️') ? '#93c5fd' : '#fca5a5',
                  fontSize: '14px', transition: 'all 0.3s',
                }}>
                  {msg}
                </div>
              )}

              {/* Top Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{selectedFresh.name}</h2>
                  <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
                    Room {selectedFresh.roomNumber} · ₹{selectedFresh.rentAmount?.toLocaleString()}/month
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => { setEditMode(!editMode); setMsg('') }}
                    style={{ background: '#1e40af', border: 'none', color: '#93c5fd', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    {editMode ? 'Cancel' : '✏️ Edit'}
                  </button>
                  <button
                    onClick={() => handleDelete(selectedFresh._id)}
                    style={{ background: '#7f1d1d', border: 'none', color: '#fca5a5', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    🗑️ Remove
                  </button>
                </div>
              </div>

              {!editMode ? (
                <>
                  {/* Info Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                    {[
                      { label: 'Monthly Rent', value: `₹${selectedFresh.rentAmount?.toLocaleString()}`, color: '#10b981' },
                      { label: 'Phone', value: selectedFresh.phone, color: '#3b82f6' },
                      {
                        label: 'Join Date',
                        value: selectedFresh.startDate
                          ? new Date(selectedFresh.startDate).toLocaleDateString('en-IN')
                          : selectedFresh.joinDate
                            ? new Date(selectedFresh.joinDate).toLocaleDateString('en-IN')
                            : '—',
                        color: '#94a3b8',
                      },
                    ].map((item, i) => (
                      <div key={i} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '14px 16px' }}>
                        <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>{item.label}</div>
                        <div style={{ color: item.color, fontWeight: 600, fontSize: '14px' }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* This month payment card */}
                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '18px 20px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{thisMonth} {thisYear} ka Rent</div>
                        <div style={{ color: '#64748b', fontSize: '13px', marginTop: '3px' }}>
                          ₹{selectedFresh.rentAmount?.toLocaleString()}
                        </div>
                      </div>
                      {selectedPaid ? (
                        <span style={{ background: '#14532d', color: '#86efac', padding: '8px 18px', borderRadius: '8px', fontWeight: 600 }}>
                          ✓ Paid
                        </span>
                      ) : (
                        <button
                          onClick={() => setShowPayModal(true)}
                          disabled={payLoading}
                          style={{
                            background: payLoading ? '#334155' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                            border: 'none', color: 'white', padding: '10px 20px',
                            borderRadius: '8px', cursor: payLoading ? 'not-allowed' : 'pointer',
                            fontWeight: 600, fontSize: '14px', transition: 'all 0.2s',
                          }}
                        >
                          {payLoading ? '⏳ Processing...' : '💳 Pay Rent'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Payment History */}
                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid #334155', fontWeight: 600 }}>
                      📋 Poora Hisaab
                    </div>
                    {!selectedFresh.payments?.length ? (
                      <p style={{ padding: '20px', color: '#64748b', textAlign: 'center', fontSize: '14px' }}>
                        Koi record nahi
                      </p>
                    ) : (
                      [...selectedFresh.payments].reverse().map((p, i) => (
                        <div key={i} style={{
                          padding: '12px 18px', borderBottom: '1px solid #0f172a',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                          <div>
                            <div style={{ fontWeight: 500, fontSize: '14px' }}>{p.month} {p.year}</div>
                            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                              {p.paidBy === 'cash' ? '💵 Cash' : p.paidBy === 'razorpay' ? '💳 Razorpay' : '—'}
                              {p.paidAt ? ` · ${new Date(p.paidAt).toLocaleDateString('en-IN')}` : ''}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{
                              fontWeight: 600,
                              color: p.status === 'paid' ? '#10b981' : p.status === 'partial' ? '#f59e0b' : '#ef4444',
                            }}>
                              ₹{p.paidAmount} / ₹{p.totalRent}
                            </div>
                            <span style={{
                              fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                              background: p.status === 'paid' ? '#14532d' : p.status === 'partial' ? '#78350f' : '#7f1d1d',
                              color: p.status === 'paid' ? '#86efac' : p.status === 'partial' ? '#fde68a' : '#fca5a5',
                            }}>
                              {p.status === 'paid' ? 'Paid ✅' : p.status === 'partial' ? `₹${p.remainingAmount} baki` : 'Unpaid'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                /* Edit Form */
                <form onSubmit={handleEdit} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
                  <h3 style={{ margin: '0 0 20px', fontSize: '16px' }}>Edit Tenant</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    {[
                      { label: 'Name', name: 'name', type: 'text' },
                      { label: 'Phone', name: 'phone', type: 'tel' },
                      { label: 'Room Number', name: 'roomNumber', type: 'text' },
                      { label: 'Rent Amount (₹)', name: 'rentAmount', type: 'number' },
                    ].map(f => (
                      <div key={f.name}>
                        <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '12px' }}>
                          {f.label}
                        </label>
                        <input
                          type={f.type}
                          value={editForm[f.name] || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, [f.name]: e.target.value }))}
                          style={{
                            width: '100%', padding: '10px 12px', background: '#0f172a',
                            border: '1px solid #334155', borderRadius: '7px', color: '#f1f5f9',
                            fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="submit"
                    style={{ marginTop: '20px', padding: '11px 28px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Save Changes
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPayModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowPayModal(false)}
        >
          <div
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '32px', width: '360px' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700 }}>Payment Method</h3>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px' }}>
              {selectedFresh?.name} — {thisMonth} {thisYear} · ₹{selectedFresh?.rentAmount?.toLocaleString()}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Cash Button */}
              <button
                onClick={handleCashPayment}
                disabled={payLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  background: '#0f172a', border: '2px solid #334155', borderRadius: '12px',
                  padding: '18px 20px', cursor: payLoading ? 'not-allowed' : 'pointer',
                  color: '#f1f5f9', textAlign: 'left', opacity: payLoading ? 0.6 : 1,
                  transition: 'border-color 0.2s',
                }}
              >
                <span style={{ fontSize: '32px' }}>💵</span>
                <div>
                  <div style={{ fontWeight: 700 }}>Cash Payment</div>
                  <div style={{ color: '#64748b', fontSize: '12px' }}>Haath se cash liya, record karo</div>
                </div>
              </button>

              {/* Razorpay Button */}
              <button
                onClick={handleOnlinePayment}
                disabled={payLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  background: '#0f172a', border: '2px solid #334155', borderRadius: '12px',
                  padding: '18px 20px', cursor: payLoading ? 'not-allowed' : 'pointer',
                  color: '#f1f5f9', textAlign: 'left', opacity: payLoading ? 0.6 : 1,
                  transition: 'border-color 0.2s',
                }}
              >
                <span style={{ fontSize: '32px' }}>💳</span>
                <div>
                  <div style={{ fontWeight: 700 }}>Online (Razorpay)</div>
                  <div style={{ color: '#64748b', fontSize: '12px' }}>UPI / Card / Net Banking</div>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowPayModal(false)}
              style={{ marginTop: '16px', width: '100%', padding: '10px', background: 'transparent', border: '1px solid #334155', borderRadius: '8px', color: '#64748b', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TenantsPage() {
  return (
    <Suspense fallback={
      <div style={{ background: '#0f172a', color: '#f1f5f9', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading...
      </div>
    }>
      <TenantsContent />
    </Suspense>
  )
}
