
"use client";
import {useEffect,useState} from "react";

export default function PaymentForm(){
  const [tenants,setTenants]=useState([]);
  const [f,setF]=useState({tenant:"",month:"",totalRent:3000,paidAmount:0,remainingAmount:0,paymentMode:"Cash"});

  useEffect(()=>{
    fetch("/api/tenants").then(r=>r.json()).then(setTenants);
  },[]);

  const submit=async(e)=>{
    e.preventDefault();
    await fetch("/api/payments",{method:"POST",body:JSON.stringify(f)});
    alert("Saved");
    location.reload();
  };

  return(
    <form onSubmit={submit} className="space-y-2">
      <select className="border p-2 w-full" onChange={e=>setF({...f,tenant:e.target.value})}>
        <option>Select Tenant</option>
        {tenants.map(t=><option key={t._id} value={t._id}>{t.name}</option>)}
      </select>
      <input className="border p-2 w-full" placeholder="Month" onChange={e=>setF({...f,month:e.target.value})}/>
      <input className="border p-2 w-full" placeholder="Paid" onChange={e=>setF({...f,paidAmount:Number(e.target.value)})}/>
      <input className="border p-2 w-full" placeholder="Remaining" onChange={e=>setF({...f,remainingAmount:Number(e.target.value)})}/>
      <button className="bg-blue-500 text-white px-4 py-2">Add Payment</button>
    </form>
  )
}
