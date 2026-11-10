"use client"
import {useEffect,useState} from 'react'
import {MessageCircle} from 'lucide-react'
export function WhatsAppButton(){
 const [phone,set]=useState('')
 useEffect(()=>{fetch('/api/loja').then(r=>r.json()).then(d=>set(d.phone||'')).catch(()=>{})},[])
 return phone?<a aria-label="WhatsApp da loja" className="fixed bottom-6 right-6 p-3 rounded-full bg-green-800 text-white" href={'https://wa.me/'+phone}><MessageCircle/></a>:null
}
