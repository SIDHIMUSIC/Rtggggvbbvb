'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'

export default function TenantsPage() {
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

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch('/api/tenants')
      if (res.status === 401) { router.push('/login'); return }
      const data = await res.json()
      const list = data.tenants || []
      setTenants(list)
      if (selectedId) {
        const found = list.find(t => t._id === selectedId)
        if (found) {
          setSelected(found)
          // FIX: Only set editForm with plain fields, not payments
          setEditForm({
            name: found.name, phone: found.phone, email: found.email,
            roomNumber: found.roomNumber, rentAmount: found.rentAmount,
            depositAmount: found.depositAmount, address: found.address,
            notes: found.notes, joinDate: found.joinDate,
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
    // FIX: editForm only has editable fields, no payments
    setEditForm({
      name: t.name, phone: t.phone, email: t.email,
      roomNumber: t.roomNumber, rentAmount: t.rentAmount,
      depositAmount: t.depositAmount, address: t.address,
      notes: t.notes, joinDate: t.joinDate,
    })
    setEditMode(false)
    setMsg('')
    setShowPayModal(false)
    router.push(`/tenants?id=${t._id}`, { scroll: false })
  }

  async function handleEdit(e) {
    e.preventDefault()
    const res = await fetch(`/api/tenants/${selected._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    const data = await res.json()
    if (res.ok) {
      setMsg('✅ Updated successfully!')
      setEditMode(false)
      await fetchTenants()
    } else {
      setMsg(`❌ ${data.error}`)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Is tenant ko deactivate karna chahte ho?')) return
    const res = await fetch(`/api/tenants/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setSelected(null)
      router.push('/tenants')
      await fetchTenants()
    }
  }

  // Cash payment
  async function handleCashPayment() {
    setPayLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/payments/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: selected._id,
          amount: selected.rentAmount,
          month: thisMonth,
          year: thisYear,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg(`✅ Cash payment recorded! Transaction ID: ${data.transactionId}`)
        setShowPayModal(false)
        await fetchTenants()
      } else {
        setMsg(`❌ ${data.error}`)
        setShowPayModal(false)
      }
    } catch (err) {
      setMsg(`❌ Error: ${err.message}`)
    } finally {
      setPayLoading(false)
    }
  }

  // Online (Razorpay) payment
  async function handleOnlinePayment() {
    setPayLoading(true)
    setMsg('')
    setShowPayModal(false)
    try {
      await loadRazorpayScript()

      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: selected._id,
          amount: selected.rentAmount,
          month: thisMonth,
          year: thisYear,
        }),
      })
      const order = await res.json()
      if (!res.ok) throw new Error(order.error)

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'RentWeb',
        description: `Rent for ${thisMonth} ${thisYear}`,
        order_id: order.orderId,
        prefill: {
          name: selected.name,
          contact: selected.phone,
          email: selected.email || '',
        },
        theme: { color: '#3b82f6' },
        handler: async function (response) {
          const verifyRes = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              tenantId: selected._id,
            }),
          })
          const verifyData = await verifyRes.json()
          if (verifyRes.ok) {
            setMsg(`✅ Online payment successful! TXN: ${verifyData.transactionId}`)
            await fetchTenants()
          } else {
            setMsg(`❌ Verification failed: ${verifyData.error}`)
          }
        },
        modal: {
          ondismiss: () => { setPayLoading(false) }
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      setMsg(`❌ Payment error: ${err.message}`)
      setPayLoading(false)
    }
  }

  function loadRazorpayScript() {
    return new Promise((resolve) => {
      if (window.Razorpay) { resolve(); return }
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = resolve
      document.body.appendChild(script)
    })
  }

  const active = tenants.filter(t => t.isActive)

  // Re-sync selected from fetched tenants (so payment history updates)
  const selectedFresh = selected ? tenants.find(t => t._id === selected._id) : null
  const selectedPaid = selectedFresh?.payments?.some(
    p => p.month === thisMonth && p.year === thisYear && p.status === 'paid'
  )

  return (
    <div>
      <Navbar />
      <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>

        {/* Left: Tenant List */}
        <div style={{
          width: '300px', minWidth: '300px',
          borderRight: '1px solid #334155',
          overflowY: 'auto', background: '#0f172a',
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '15px' }}>Tenants ({active.length})</span>
            <button onClick={() => router.push('/add-tenant')} style={{
              background: '#1d4ed8', border: 'none', color: 'white',
              padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
            }}>+ Add</button>
          </div>

          {loading ? <p style={{ padding: '20px', color: '#64748b', textAlign: 'center' }}>Loading...</p> :
            active.length === 0 ? (
              <p style={{ padding: '24px 16px', color: '#64748b', textAlign: 'center', fontSize: '13px' }}>
                Koi tenant nahi hai. Pehla tenant add karo!
              </p>
            ) :
            active.map(t => {
              const paid = t.payments?.some(p => p.month === thisMonth && p.year === thisYear && p.status === 'paid')
              return (
                <div key={t._id} onClick={() => selectTenant(t)} style={{
                  padding: '14px 16px', cursor: 'pointer',
                  borderBottom: '1px solid #1e293b',
                  background: selectedFresh?._id === t._id ? '#1e293b' : 'transparent',
                  borderLeft: selectedFresh?._id === t._id ? '3px solid #3b82f6' : '3px solid transparent',
                }}>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{t.name}</div>
                  <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                    Room #{t.roomNumber} · ₹{t.rentAmount?.toLocaleString()}
                  </div>
                  <span style={{
                    fontSize: '11px', padding: '2px 8px', borderRadius: '10px', marginTop: '4px', display: 'inline-block',
                    background: paid ? '#14532d' : '#7f1d1d',
                    color: paid ? '#86efac' : '#fca5a5',
                  }}>{paid ? '✓ Paid' : '⏳ Pending'}</span>
                </div>
              )
            })
          }
        </div>

        {/* Right: Detail Panel */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', position: 'relative' }}>
          {!selectedFresh ? (
            <div style={{ textAlign: 'center', marginTop: '80px', color: '#475569' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>👈</div>
              <p>Tenant select karo details dekhne ke liye</p>
            </div>
          ) : (
            <>
              {msg && (
                <div style={{
                  background: msg.startsWith('✅') ? '#14532d' : '#7f1d1d',
                  border: `1px solid ${msg.startsWith('✅') ? '#22c55e' : '#ef4444'}`,
                  borderRadius: '8px', padding: '10px 16px', marginBottom: '20px',
                  color: msg.startsWith('✅') ? '#86efac' : '#fca5a5', fontSize: '14px',
                }}>{msg}</div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>{selectedFresh.name}</h2>
                  <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>Room #{selectedFresh.roomNumber}</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { setEditMode(!editMode); setMsg('') }} style={{
                    background: '#1e40af', border: 'none', color: '#93c5fd',
                    padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
                  }}>{editMode ? 'Cancel' : '✏️ Edit'}</button>
                  <button onClick={() => handleDelete(selectedFresh._id)} style={{
                    background: '#7f1d1d', border: 'none', color: '#fca5a5',
                    padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
                  }}>🗑️ Remove</button>
                </div>
              </div>

              {!editMode ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '24px' }}>
                    {[
                      { label: 'Monthly Rent', value: `₹${selectedFresh.rentAmount?.toLocaleString()}`, color: '#10b981' },
                      { label: 'Deposit', value: `₹${selectedFresh.depositAmount?.toLocaleString() || 0}`, color: '#8b5cf6' },
                      { label: 'Phone', value: selectedFresh.phone, color: '#3b82f6' },
                      { label: 'Email', value: selectedFresh.email || '—', color: '#f59e0b' },
                      { label: 'Join Date', value: selectedFresh.joinDate ? new Date(selectedFresh.joinDate).toLocaleDateString('en-IN') : '—', color: '#94a3b8' },
                      { label: 'Address', value: selectedFresh.address || '—', color: '#94a3b8' },
                    ].map((item, i) => (
                      <div key={i} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '14px 16px' }}>
                        <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>{item.label}</div>
                        <div style={{ color: item.color, fontWeight: 600, fontSize: '14px' }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Payment Section */}
                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '15px' }}>Rent for {thisMonth} {thisYear}</div>
                        <div style={{ color: '#64748b', fontSize: '13px', marginTop: '3px' }}>Amount: ₹{selectedFresh.rentAmount?.toLocaleString()}</div>
                      </div>
                      {selectedPaid ? (
                        <span style={{ background: '#14532d', color: '#86efac', padding: '8px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '14px' }}>✓ Paid</span>
                      ) : (
                        <button
                          onClick={() => setShowPayModal(true)}
                          disabled={payLoading}
                          style={{
                            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                            border: 'none', color: 'white',
                            padding: '10px 24px', borderRadius: '8px',
                            cursor: payLoading ? 'not-allowed' : 'pointer',
                            fontWeight: 600, fontSize: '14px',
                          }}
                        >
                          {payLoading ? 'Processing...' : '💳 Pay Rent'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Payment History */}
                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', fontWeight: 600 }}>Payment History</div>
                    {!selectedFresh.payments?.filter(p => p.status === 'paid').length ? (
                      <p style={{ padding: '20px', color: '#64748b', textAlign: 'center', fontSize: '14px' }}>No payments yet</p>
                    ) : (
                      selectedFresh.payments
                        .filter(p => p.status === 'paid')
                        .slice().reverse()
                        .map((p, i) => (
                          <div key={i} style={{ padding: '12px 20px', borderBottom: '1px solid #0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 500, fontSize: '14px' }}>{p.month} {p.year}</div>
                              <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                                {p.transactionId?.startsWith('CASH') ? '💵 Cash' : '💳 Online'} · TXN: {p.transactionId}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 600, color: '#10b981' }}>₹{p.amount?.toLocaleString()}</div>
                              <span style={{
                                fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                                background: '#14532d', color: '#86efac',
                              }}>paid</span>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </>
              ) : (
                /* Edit Form */
                <form onSubmit={handleEdit} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
                  <h3 style={{ margin: '0 0 20px', fontSize: '16px' }}>Edit Tenant Details</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    {[
                      { label: 'Name', name: 'name', type: 'text' },
                      { label: 'Phone', name: 'phone', type: 'tel' },
                      { label: 'Email', name: 'email', type: 'email' },
                      { label: 'Room Number', name: 'roomNumber', type: 'text' },
                      { label: 'Rent Amount (₹)', name: 'rentAmount', type: 'number' },
                      { label: 'Deposit Amount (₹)', name: 'depositAmount', type: 'number' },
                    ].map(f => (
                      <div key={f.name}>
                        <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>{f.label}</label>
                        <input
                          type={f.type} value={editForm[f.name] || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, [f.name]: e.target.value }))}
                          style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '7px', color: '#f1f5f9', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                    ))}
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>Notes</label>
                      <textarea value={editForm.notes || ''} rows={3}
                        onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                        style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '7px', color: '#f1f5f9', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                      />
                    </div>
                  </div>
                  <button type="submit" style={{
                    marginTop: '20px', padding: '11px 28px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none', borderRadius: '8px', color: 'white',
                    fontWeight: 600, cursor: 'pointer', fontSize: '14px',
                  }}>Save Changes</button>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      {/* Payment Method Modal */}
      {showPayModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowPayModal(false)}>
          <div style={{
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: '16px', padding: '32px', width: '360px',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700 }}>Payment Method Chunein</h3>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px' }}>
              {selectedFresh?.name} — {thisMonth} {thisYear} · ₹{selectedFresh?.rentAmount?.toLocaleString()}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Cash Option */}
              <button onClick={handleCashPayment} disabled={payLoading} style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                background: '#0f172a', border: '2px solid #334155',
                borderRadius: '12px', padding: '18px 20px', cursor: 'pointer',
                color: '#f1f5f9', textAlign: 'left', transition: 'border-color 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#10b981'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}
              >
                <span style={{ fontSize: '32px' }}>💵</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>Cash Payment</div>
                  <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>Haath se cash liya, record karo</div>
                </div>
              </button>

              {/* Online / Razorpay Option */}
              <button onClick={handleOnlinePayment} disabled={payLoading} style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                background: '#0f172a', border: '2px solid #334155',
                borderRadius: '12px', padding: '18px 20px', cursor: 'pointer',
                color: '#f1f5f9', textAlign: 'left',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}
              >
                <span style={{ fontSize: '32px' }}>💳</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>Online Payment</div>
                  <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>Razorpay se UPI / Card / Net Banking</div>
                </div>
              </button>
            </div>

            <button onClick={() => setShowPayModal(false)} style={{
              marginTop: '20px', width: '100%', padding: '10px',
              background: 'transparent', border: '1px solid #334155',
              borderRadius: '8px', color: '#64748b', cursor: 'pointer', fontSize: '14px',
            }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
