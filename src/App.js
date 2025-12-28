import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  updateDoc,
  serverTimestamp, 
  query, 
  orderBy,
  setDoc
} from 'firebase/firestore';
import { 
  LayoutDashboard, ShoppingCart, Package, Users, FileText, LogOut, Plus, Search, 
  Trash2, Printer, CreditCard, Wallet, DollarSign, Truck, Factory, User, X, 
  TrendingUp, AlertCircle, Settings, Shield, PieChart,
  Store, Globe, CheckCircle, Menu, Star, ShoppingBag, Edit, Image as ImageIcon, BarChart3,
  Coins, MapPin, Receipt
} from 'lucide-react';

// --- Firebase Config (Replace with your own for Production) ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : { apiKey: "placeholder", projectId: "placeholder" }; 

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- CURRENCY CONFIGURATION ---
const CURRENCIES = {
  USD: { code: 'USD', rate: 1, symbol: '$', locale: 'en-US', name: 'US Dollar' },
  BIF: { code: 'BIF', rate: 2850, symbol: 'FBu', locale: 'fr-BI', name: 'Franc Burundais' },
  EUR: { code: 'EUR', rate: 0.92, symbol: '€', locale: 'de-DE', name: 'Euro' },
  GBP: { code: 'GBP', rate: 0.79, symbol: '£', locale: 'en-GB', name: 'British Pound' }
};

// --- Helpers ---
const formatCurrency = (amountInUSD, currencyCode = 'USD') => {
  const config = CURRENCIES[currencyCode] || CURRENCIES.USD;
  const converted = amountInUSD * config.rate;
  return new Intl.NumberFormat(config.locale, { 
    style: 'currency', 
    currency: currencyCode,
    minimumFractionDigits: currencyCode === 'BIF' ? 0 : 2,
    maximumFractionDigits: currencyCode === 'BIF' ? 0 : 2
  }).format(converted);
};

// --- UI Components ---
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className={`fixed bottom-4 right-4 z-[100] px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 text-white animate-in slide-in-from-bottom-5 fade-in duration-300 ${type === 'error' ? 'bg-red-500' : 'bg-emerald-600'}`}>
      {type === 'error' ? <AlertCircle size={20}/> : <CheckCircle size={20}/>}
      <span className="font-medium">{message}</span>
    </div>
  );
};

const CurrencySwitcher = ({ current, onChange, dark = false }) => (
  <div className="relative group inline-block">
    <button className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${dark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'}`}>
      <Coins size={16} className={dark ? "text-indigo-400" : "text-indigo-600"}/>
      <span>{current}</span>
    </button>
    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden hidden group-hover:block z-50 animate-in fade-in zoom-in-95 duration-200">
      {Object.values(CURRENCIES).map(c => (
        <button key={c.code} onClick={() => onChange(c.code)} className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center justify-between ${current === c.code ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600'}`}>
          <span>{c.name}</span><span className="text-xs font-mono opacity-50">{c.symbol}</span>
        </button>
      ))}
    </div>
  </div>
);

const InvoiceModal = ({ order, settings, onClose, currency }) => {
  const printRef = useRef();
  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>Print Invoice</title>');
    printWindow.document.write('<style>body{font-family:sans-serif; padding: 20px;} .header{text-align:center; margin-bottom:20px;} table{width:100%; border-collapse:collapse; margin-bottom:20px;} th,td{padding:8px; text-align:left; border-bottom:1px solid #ddd;} .total{text-align:right; font-size:1.2em; font-weight:bold;} @media print { body { -webkit-print-color-adjust: exact; } }</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(content);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg">Invoice Preview</h3>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-indigo-700 flex items-center gap-1"><Printer size={16}/> Print</button>
            <button onClick={onClose} className="text-slate-500 hover:bg-slate-200 p-1.5 rounded"><X size={20}/></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 bg-white" ref={printRef}>
           <div className="text-center mb-8">
             <h1 className="text-2xl font-bold uppercase tracking-widest text-slate-900">{settings.storeName || 'My Store'}</h1>
             <p className="text-slate-500 text-sm">{settings.address || '123 Business Rd, Commerce City'}</p>
             <p className="text-slate-500 text-sm">Tel: {settings.phone || '+1 234 567 890'}</p>
           </div>
           <div className="flex justify-between mb-6 text-sm">
             <div>
               <div className="text-slate-500 uppercase text-xs font-bold">Bill To</div>
               <div className="font-bold">{order.customerName || 'Walk-in Customer'}</div>
               <div>Ref: #{order.id.slice(0,8).toUpperCase()}</div>
             </div>
             <div className="text-right">
               <div className="text-slate-500 uppercase text-xs font-bold">Date</div>
               <div>{new Date(order.createdAt?.toMillis ? order.createdAt.toMillis() : Date.now()).toLocaleDateString()}</div>
               <div>{new Date(order.createdAt?.toMillis ? order.createdAt.toMillis() : Date.now()).toLocaleTimeString()}</div>
             </div>
           </div>
           <table className="w-full text-sm mb-6">
             <thead>
               <tr className="border-b-2 border-slate-800">
                 <th className="py-2 text-left">Item</th>
                 <th className="py-2 text-center">Qty</th>
                 <th className="py-2 text-right">Price</th>
                 <th className="py-2 text-right">Amount</th>
               </tr>
             </thead>
             <tbody>
               {order.items.map((item, i) => (
                 <tr key={i} className="border-b border-slate-100">
                   <td className="py-2">{item.name}</td>
                   <td className="py-2 text-center">{item.qty}</td>
                   <td className="py-2 text-right">{formatCurrency(item.price, currency)}</td>
                   <td className="py-2 text-right">{formatCurrency(item.price * item.qty, currency)}</td>
                 </tr>
               ))}
             </tbody>
           </table>
           <div className="flex justify-end">
             <div className="w-1/2 text-right space-y-1">
               <div className="flex justify-between text-sm text-slate-500"><span>Subtotal</span><span>{formatCurrency(order.total, currency)}</span></div>
               <div className="flex justify-between text-lg font-bold border-t border-slate-800 pt-2 mt-2"><span>Total</span><span>{formatCurrency(order.total, currency)}</span></div>
             </div>
           </div>
           <div className="mt-12 text-center text-xs text-slate-400">
             <p>Thank you for your business!</p>
             <p className="mt-1">Returns accepted within 30 days with receipt.</p>
           </div>
        </div>
      </div>
    </div>
  );
};

const SimpleBarChart = ({ data, currency }) => {
  if (!data || data.length === 0) return <div className="h-48 flex items-center justify-center text-slate-400">No data available</div>;
  const maxVal = Math.max(...data.map(d => d.value));
  return (
    <div className="h-64 flex items-end gap-2 pt-8 pb-2">
      {data.map((item, idx) => (
        <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
           <div className="relative w-full flex justify-center items-end h-48 bg-slate-50 rounded-t-lg overflow-hidden">
             <div className="w-4/5 bg-indigo-500 rounded-t-sm transition-all duration-500 group-hover:bg-indigo-600 relative" style={{ height: `${maxVal > 0 ? (item.value / maxVal) * 100 : 0}%` }}>
               <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">{formatCurrency(item.value, currency)}</div>
             </div>
           </div>
           <span className="text-xs text-slate-500 font-medium rotate-0 truncate w-full text-center">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

// --- 1. STOREFRONT COMPONENT ---
const Storefront = ({ products, onPlaceOrder, onSwitchToAdmin, cart, setCart, showToast, currency, setCurrency }) => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [category, setCategory] = useState('All');
  
  const addToCart = (p) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id);
      if (ex) return prev.map(i => i.id === p.id ? {...i, qty: i.qty+1} : i);
      return [...prev, {...p, qty: 1}];
    });
    showToast(`Added ${p.name} to cart`);
  };

  const handleCheckout = () => {
    const totalUSD = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);
    onPlaceOrder(cart, totalUSD);
    setCart([]);
    setIsCartOpen(false);
  };

  const filtered = category === 'All' ? products : products.filter(p => p.category === category);
  const categories = ['All', ...new Set(products.map(p => p.category || 'General'))];
  const totalDisplay = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <nav className="bg-white sticky top-0 z-20 shadow-sm border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-700">
            <Store size={24}/> <span className="font-bold text-xl tracking-tight">Lumina Store</span>
          </div>
          <div className="flex items-center gap-4">
            <CurrencySwitcher current={currency} onChange={setCurrency} />
            <button onClick={()=>setIsCartOpen(true)} className="relative p-2 text-slate-600 hover:text-indigo-600">
              <ShoppingBag size={24}/>
              {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">{cart.reduce((a,b)=>a+b.qty,0)}</span>}
            </button>
            <button onClick={onSwitchToAdmin} className="text-xs font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-wider hidden sm:block">Staff Access</button>
          </div>
        </div>
      </nav>

      <div className="bg-indigo-900 text-white py-16 px-4 text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4">Summer Collection 2025</h1>
        <p className="text-indigo-200 text-lg mb-8 max-w-xl mx-auto">Shop the latest trends. Real-time inventory from our warehouse.</p>
        <button onClick={() => document.getElementById('shop').scrollIntoView({behavior: 'smooth'})} className="bg-white text-indigo-900 px-8 py-3 rounded-full font-bold hover:bg-indigo-50 transition-transform hover:scale-105 shadow-lg">Start Shopping</button>
      </div>

      <div id="shop" className="max-w-7xl mx-auto px-4">
         <div className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
           {categories.map(c => (
             <button key={c} onClick={()=>setCategory(c)} className={`px-5 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${category===c ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'}`}>{c}</button>
           ))}
         </div>
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
           {filtered.map(p => (
             <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group hover:shadow-xl transition-all duration-300">
               <div className="h-56 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                 {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={(e) => e.target.style.display = 'none'} /> : <Package size={48} className="text-slate-300"/>}
                 {p.stock <= 0 && <div className="absolute inset-0 bg-white/90 flex items-center justify-center font-bold text-slate-500 tracking-widest">OUT OF STOCK</div>}
                 {p.stock > 0 && <button onClick={()=>addToCart(p)} className="absolute bottom-4 right-4 bg-indigo-600 text-white p-3 rounded-full shadow-lg translate-y-20 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300"><Plus size={20}/></button>}
               </div>
               <div className="p-5">
                 <div className="text-xs font-bold text-indigo-500 mb-1 uppercase tracking-wide">{p.category || 'General'}</div>
                 <h3 className="font-bold text-slate-800 mb-2 truncate text-lg">{p.name}</h3>
                 <div className="flex justify-between items-center mt-3">
                   <span className="font-bold text-slate-900 text-xl">{formatCurrency(p.price, currency)}</span>
                   {p.stock < 5 && p.stock > 0 && <span className="text-xs text-orange-500 font-medium bg-orange-50 px-2 py-1 rounded">Only {p.stock} left!</span>}
                 </div>
               </div>
             </div>
           ))}
         </div>
      </div>

      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setIsCartOpen(false)}/>
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-5 border-b flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-xl">Your Cart ({cart.length})</h2>
              <button onClick={()=>setIsCartOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {cart.map(i => (
                <div key={i.id} className="flex gap-4 items-center">
                   <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">{i.imageUrl ? <img src={i.imageUrl} className="w-full h-full object-cover"/> : <Package size={24} className="text-slate-400"/>}</div>
                   <div className="flex-1"><div className="font-bold text-slate-800">{i.name}</div><div className="text-sm text-slate-500 mt-1">{formatCurrency(i.price, currency)} x {i.qty}</div></div>
                   <div className="font-bold text-indigo-600">{formatCurrency(i.price * i.qty, currency)}</div>
                </div>
              ))}
              {cart.length === 0 && <div className="flex flex-col items-center justify-center h-64 text-slate-400"><ShoppingBag size={48} className="mb-4 opacity-50"/><p>Your cart is empty</p></div>}
            </div>
            <div className="p-6 border-t bg-slate-50">
              <div className="flex justify-between font-bold text-2xl mb-6 text-slate-800"><span>Total</span><span>{formatCurrency(totalDisplay, currency)}</span></div>
              <button onClick={handleCheckout} disabled={cart.length === 0} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 shadow-lg hover:shadow-indigo-200 transition-all">Secure Checkout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- 2. ADMIN MODULES ---

const InventoryModule = ({ products, onAdd, onUpdate, onDelete, currency }) => {
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [editMode, setEditMode] = useState(false);
   const [formData, setFormData] = useState({ id: null, name: '', price: '', stock: '', category: 'General', imageUrl: '', location: '' });

   const handleEdit = (product) => {
     setFormData(product);
     setEditMode(true);
     setIsModalOpen(true);
   };

   const handleSubmit = () => {
     const payload = { ...formData, price: parseFloat(formData.price), stock: parseInt(formData.stock) };
     if (editMode) onUpdate(formData.id, payload);
     else { const { id, ...newProduct } = payload; onAdd(newProduct); }
     setIsModalOpen(false);
     setFormData({ id: null, name: '', price: '', stock: '', category: 'General', imageUrl: '', location: '' });
     setEditMode(false);
   };

   return (
     <div className="p-6 max-w-7xl mx-auto">
       <div className="flex justify-between items-center mb-8">
         <div><h2 className="font-bold text-2xl text-slate-800">Inventory</h2><p className="text-slate-500">Warehouse & Stock Management</p></div>
         <button onClick={()=>{setEditMode(false); setFormData({name:'',price:'',stock:'',category:'General',imageUrl:'', location: ''}); setIsModalOpen(true)}} className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg"><Plus size={18}/> Add Product</button>
       </div>

       {isModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
           <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
             <h3 className="font-bold text-xl mb-6">{editMode ? 'Edit Product' : 'New Product'}</h3>
             <div className="space-y-4">
               <div><label className="text-xs font-bold text-slate-500 uppercase">Name</label><input className="w-full p-3 border rounded-lg mt-1 outline-none" value={formData.name} onChange={e=>setFormData({...formData,name:e.target.value})}/></div>
               <div className="grid grid-cols-2 gap-4">
                 <div><label className="text-xs font-bold text-slate-500 uppercase">Price (USD)</label><input type="number" className="w-full p-3 border rounded-lg mt-1 outline-none" value={formData.price} onChange={e=>setFormData({...formData,price:e.target.value})}/></div>
                 <div><label className="text-xs font-bold text-slate-500 uppercase">Stock</label><input type="number" className="w-full p-3 border rounded-lg mt-1 outline-none" value={formData.stock} onChange={e=>setFormData({...formData,stock:e.target.value})}/></div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-bold text-slate-500 uppercase">Category</label><input className="w-full p-3 border rounded-lg mt-1 outline-none" value={formData.category} onChange={e=>setFormData({...formData,category:e.target.value})}/></div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase">Location (Bin/Shelf)</label><input className="w-full p-3 border rounded-lg mt-1 outline-none" placeholder="e.g. A-12" value={formData.location} onChange={e=>setFormData({...formData,location:e.target.value})}/></div>
               </div>
               <div><label className="text-xs font-bold text-slate-500 uppercase">Image URL</label><div className="flex gap-2"><div className="p-3 bg-slate-100 rounded-lg text-slate-500"><ImageIcon size={20}/></div><input className="flex-1 p-3 border rounded-lg outline-none" placeholder="https://..." value={formData.imageUrl || ''} onChange={e=>setFormData({...formData,imageUrl:e.target.value})}/></div></div>
               <div className="flex gap-3 mt-8">
                 <button onClick={()=>setIsModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Cancel</button>
                 <button onClick={handleSubmit} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg">{editMode ? 'Save Changes' : 'Create Product'}</button>
               </div>
             </div>
           </div>
         </div>
       )}

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
         {products.map(p => (
           <div key={p.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group">
              <div className="h-40 bg-slate-100 relative">
                {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover"/> : <div className="flex items-center justify-center h-full text-slate-300"><Package size={40}/></div>}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={()=>handleEdit(p)} className="p-2 bg-white rounded-full shadow-sm text-slate-600 hover:text-indigo-600"><Edit size={14}/></button>
                  <button onClick={()=>onDelete(p.id)} className="p-2 bg-white rounded-full shadow-sm text-slate-600 hover:text-red-500"><Trash2 size={14}/></button>
                </div>
                {p.location && <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1"><MapPin size={10}/> {p.location}</div>}
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2"><h3 className="font-bold text-slate-800 truncate flex-1">{p.name}</h3><span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{p.stock}</span></div>
                <div className="text-indigo-600 font-bold">{formatCurrency(p.price, currency)}</div>
              </div>
           </div>
         ))}
       </div>
     </div>
   );
};

const POSModule = ({ products, customers, settings, onProcessSale, showToast, currency }) => {
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const addToCart = (p) => setCart(prev => { const ex = prev.find(i=>i.id===p.id); return ex ? prev.map(i=>i.id===p.id?{...i,qty:i.qty+1}:i) : [...prev,{...p,qty:1}] });
  const totalUSD = cart.reduce((a,b)=>a+(b.price*b.qty),0);

  return (
    <div className="flex h-full gap-6 p-6 max-w-7xl mx-auto">
       <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
          <div className="mb-6 relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
             <input className="w-full pl-10 pr-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Search products..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pr-2">
             {products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())).map(p=>(
               <button key={p.id} onClick={()=>addToCart(p)} className="p-4 border border-slate-100 rounded-xl hover:border-indigo-500 text-left hover:shadow-md transition-all group bg-slate-50 hover:bg-white">
                  <div className="font-bold text-slate-700 group-hover:text-indigo-700 truncate">{p.name}</div>
                  <div className="flex justify-between items-center mt-2"><div className="text-indigo-600 font-bold">{formatCurrency(p.price, currency)}</div><div className="text-xs text-slate-400 bg-white px-2 py-1 rounded border">Qty: {p.stock}</div></div>
               </button>
             ))}
          </div>
       </div>
       <div className="w-96 bg-white rounded-2xl shadow-lg border border-slate-200 p-6 flex flex-col">
          <h2 className="font-bold text-xl mb-6 flex items-center gap-2"><ShoppingCart size={20} className="text-indigo-600"/> Current Order</h2>
          <div className="flex-1 overflow-y-auto space-y-3 mb-4">
             {cart.map(i=>(
               <div key={i.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                 <div><div className="font-bold text-sm">{i.name}</div><div className="text-xs text-slate-500">{formatCurrency(i.price, currency)} x {i.qty}</div></div>
                 <div className="font-bold text-slate-700">{formatCurrency(i.price*i.qty, currency)}</div>
               </div>
             ))}
             {cart.length === 0 && <div className="text-center text-slate-400 mt-10">Cart is empty</div>}
          </div>
          <div className="border-t border-slate-100 pt-6">
             <div className="flex justify-between font-bold text-2xl mb-6 text-slate-800"><span>Total</span><span>{formatCurrency(totalUSD, currency)}</span></div>
             <button onClick={()=>{onProcessSale(cart, totalUSD, null); setCart([]); showToast("Sale Completed!", "success")}} disabled={cart.length===0} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 shadow-lg transition-all">Complete Payment</button>
          </div>
       </div>
    </div>
  );
};

// --- 3. MAIN APP SHELL ---
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('store'); 
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cart, setCart] = useState([]);
  const [toast, setToast] = useState(null); 
  const [currency, setCurrency] = useState('USD');
  const [printOrder, setPrintOrder] = useState(null);

  // Data State
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState({});

  // 1. All Hooks Must Be At Top Level
  const chartData = useMemo(() => {
    const data = {};
    sales.forEach(s => {
      const date = new Date(s.createdAt?.toMillis ? s.createdAt.toMillis() : Date.now()).toLocaleDateString('en-US', { weekday: 'short' });
      data[date] = (data[date] || 0) + s.total;
    });
    return Object.entries(data).map(([label, value]) => ({ label, value }));
  }, [sales]);

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, u => setUser(u));
  }, []);

  useEffect(() => {
    if (!user) return;
    const subs = [
      onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'products'), s => setProducts(s.docs.map(d => ({id:d.id, ...d.data()})))),
      onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'sales'), orderBy('createdAt', 'desc')), s => setSales(s.docs.map(d => ({id:d.id, ...d.data()})))),
      onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'crm_customers'), s => setCustomers(s.docs.map(d => ({id:d.id, ...d.data()})))),
      onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), d => setSettings(d.exists() ? d.data() : {}))
    ];
    return () => subs.forEach(u => u());
  }, [user]);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const handlePlaceOrder = async (items, total) => {
    try {
      if (!user) return;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sales'), { items, total, createdAt: serverTimestamp(), source: 'online', deliveryStatus: 'pending' });
      items.forEach(async (i) => {
         const p = products.find(prod => prod.id === i.id);
         if(p) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', i.id), { stock: Math.max(0, p.stock - i.qty) });
      });
      showToast("Order Placed Successfully!");
    } catch(e) { console.error(e); showToast("Failed to place order", "error"); }
  };

  const handlePOSSale = async (items, total, customer) => {
    if (!user) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sales'), { items, total, createdAt: serverTimestamp(), source: 'pos', customerName: customer?.name || 'Walk-in' });
    items.forEach(async (i) => {
        const p = products.find(prod => prod.id === i.id);
        if(p) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', i.id), { stock: Math.max(0, p.stock - i.qty) });
    });
  };

  const handleShipOrder = async (id) => {
    if (!user) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sales', id), { deliveryStatus: 'shipped' });
    showToast("Order Marked as Shipped");
  };

  const adminMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: PieChart },
    { id: 'logistics', label: 'Logistics', icon: Truck, badge: sales.filter(s=>s.source==='online' && s.deliveryStatus==='pending').length },
    { id: 'pos', label: 'POS Terminal', icon: CreditCard },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'crm', label: 'Customers', icon: Users }
  ];

  // --- View Routing ---
  if (view === 'store') return (
    <>
      <Storefront 
        products={products} cart={cart} setCart={setCart} onPlaceOrder={handlePlaceOrder} onSwitchToAdmin={() => setView('login')} showToast={showToast} currency={currency} setCurrency={setCurrency}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)} />}
    </>
  );

  if (view === 'login') return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl w-full max-w-md text-center shadow-2xl">
           <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600"><Shield size={32}/></div>
           <h2 className="text-2xl font-bold mb-2 text-slate-800">Staff Portal</h2>
           <p className="text-slate-500 mb-8">Secure Access Only</p>
           <button onClick={() => setView('admin')} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold mb-4 hover:bg-indigo-700 transition-colors">Login as Administrator</button>
           <button onClick={() => setView('store')} className="text-slate-500 hover:text-indigo-600 font-medium text-sm">Return to Storefront</button>
        </div>
      </div>
  );

  // --- Admin Layout ---
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-10">
         <div className="p-6 font-bold text-white text-xl flex items-center gap-3"><div className="p-1.5 bg-indigo-600 rounded"><LayoutDashboard size={20}/></div> ERP System</div>
         <nav className="flex-1 px-3 space-y-1 mt-4">
           {adminMenu.map(item => (
             <button key={item.id} onClick={()=>setActiveTab(item.id)} className={`w-full flex items-center gap-3 p-3 rounded-lg font-medium transition-colors ${activeTab===item.id?'bg-indigo-600 text-white shadow-md':'hover:bg-slate-800 text-slate-400 hover:text-white'}`}>
               <item.icon size={20}/> {item.label}
               {item.badge > 0 && <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{item.badge}</span>}
             </button>
           ))}
         </nav>
         <div className="px-4 py-2"><div className="bg-slate-800 rounded-lg p-3"><div className="text-xs font-bold text-slate-500 uppercase mb-2">Display Currency</div><CurrencySwitcher current={currency} onChange={setCurrency} dark /></div></div>
         <div className="p-4 border-t border-slate-800">
           <button onClick={()=>setView('store')} className="w-full bg-slate-800 text-white py-2 rounded-lg flex items-center justify-center gap-2 mb-2 hover:bg-slate-700 transition-colors text-sm font-medium"><Globe size={16}/> Visit Store</button>
           <button onClick={()=>signOut(auth)} className="w-full text-center text-xs font-bold text-slate-500 hover:text-white uppercase tracking-wider">Sign Out</button>
         </div>
      </aside>

      <main className="flex-1 overflow-auto h-screen relative">
         {activeTab === 'dashboard' && (
           <div className="p-8 max-w-7xl mx-auto">
             <h2 className="text-2xl font-bold mb-8 text-slate-800">Performance Overview</h2>
             <div className="grid grid-cols-4 gap-6 mb-8">
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col"><div className="text-slate-500 text-xs font-bold uppercase mb-2">Total Revenue</div><div className="text-3xl font-bold text-slate-800">{formatCurrency(sales.reduce((a,b)=>a+b.total,0), currency)}</div></div>
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col"><div className="text-slate-500 text-xs font-bold uppercase mb-2">Online Sales</div><div className="text-3xl font-bold text-indigo-600">{formatCurrency(sales.filter(s=>s.source==='online').reduce((a,b)=>a+b.total,0), currency)}</div></div>
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col"><div className="text-slate-500 text-xs font-bold uppercase mb-2">POS Sales</div><div className="text-3xl font-bold text-emerald-600">{formatCurrency(sales.filter(s=>s.source==='pos').reduce((a,b)=>a+b.total,0), currency)}</div></div>
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col"><div className="text-slate-500 text-xs font-bold uppercase mb-2">Total Orders</div><div className="text-3xl font-bold text-blue-600">{sales.length}</div></div>
             </div>
             <div className="grid grid-cols-3 gap-8">
                <div className="col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-slate-100"><h3 className="font-bold text-lg mb-6 flex items-center gap-2"><BarChart3 size={20} className="text-slate-400"/> Sales Trend</h3><SimpleBarChart data={chartData} currency={currency} /></div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                   <h3 className="font-bold text-lg mb-6">Recent Activity</h3>
                   <div className="space-y-4">
                     {sales.slice(0,6).map(s => (
                       <div key={s.id} className="flex items-center gap-4">
                         <div className={`p-2 rounded-full ${s.source==='online' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>{s.source==='online' ? <Globe size={14}/> : <Store size={14}/>}</div>
                         <div className="flex-1"><div className="text-sm font-bold text-slate-700">{s.source === 'online' ? 'Web Order' : 'POS Sale'}</div><div className="text-xs text-slate-400">{new Date(s.createdAt?.toMillis ? s.createdAt.toMillis() : Date.now()).toLocaleTimeString()}</div></div>
                         <div className="flex flex-col items-end"><span className="font-bold text-sm">{formatCurrency(s.total, currency)}</span><button onClick={()=>setPrintOrder(s)} className="text-xs text-indigo-500 hover:underline flex items-center gap-1"><Printer size={10}/> Receipt</button></div>
                       </div>
                     ))}
                   </div>
                </div>
             </div>
           </div>
         )}
         
         {activeTab === 'logistics' && (
           <div className="p-6 max-w-6xl mx-auto">
             <div className="flex items-center gap-4 mb-8"><div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl"><Truck size={24}/></div><div><h2 className="text-2xl font-bold text-slate-800">Logistics Center</h2><p className="text-slate-500">Manage online orders and shipments</p></div></div>
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-6 border-b border-slate-100 flex justify-between items-center"><h3 className="font-bold text-lg">Order Queue</h3><span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">{sales.filter(s=>s.source==='online' && s.deliveryStatus==='pending').length} Pending</span></div>
               <div className="divide-y divide-slate-100">
                 {sales.filter(s=>s.source==='online').map(o => (
                   <div key={o.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start gap-4">
                         <div className={`p-3 rounded-full ${o.deliveryStatus==='pending' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>{o.deliveryStatus==='pending' ? <Package size={20}/> : <CheckCircle size={20}/>}</div>
                         <div>
                            <div className="flex items-center gap-2 mb-1"><span className="font-mono text-xs font-bold text-slate-400">#{o.id.slice(0,8).toUpperCase()}</span><span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{new Date(o.createdAt?.toMillis ? o.createdAt.toMillis() : Date.now()).toLocaleDateString()}</span></div>
                            <div className="font-bold text-slate-800">Web Customer <span className="text-slate-400 font-normal">({o.items.length} items)</span></div>
                            <div className="text-sm text-slate-500 mt-1">Total Value: <span className="font-bold text-slate-700">{formatCurrency(o.total, currency)}</span></div>
                         </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={()=>setPrintOrder(o)} className="text-slate-400 hover:text-indigo-600 p-2 border rounded hover:border-indigo-600 transition-colors"><Printer size={18}/></button>
                        {o.deliveryStatus === 'pending' ? <button onClick={() => handleShipOrder(o.id)} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-sm hover:shadow-md transition-all flex items-center gap-2"><Truck size={16}/> Mark as Shipped</button> : <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100"><CheckCircle size={16}/> Fulfilled</div>}
                      </div>
                   </div>
                 ))}
                 {sales.filter(s=>s.source==='online').length === 0 && <div className="p-12 text-center text-slate-400">No online orders found.</div>}
               </div>
             </div>
           </div>
         )}

         {activeTab === 'pos' && <POSModule products={products} customers={customers} settings={{}} onProcessSale={handlePOSSale} showToast={showToast} currency={currency}/>}
         {activeTab === 'inventory' && <InventoryModule products={products} onAdd={async(p)=>addDoc(collection(db,'artifacts',appId,'public','data','products'),p)} onUpdate={async(id, p)=>updateDoc(doc(db,'artifacts',appId,'public','data','products',id), p)} onDelete={async(id)=>deleteDoc(doc(db,'artifacts',appId,'public','data','products',id))} currency={currency}/>}
         {activeTab === 'crm' && (
           <div className="p-8 max-w-5xl mx-auto">
             <div className="flex justify-between items-center mb-8"><h2 className="text-2xl font-bold text-slate-800">Customer Management</h2><button onClick={()=>{const n=prompt("Customer Name"); if(n) addDoc(collection(db,'artifacts',appId,'public','data','crm_customers'),{name:n})}} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Plus size={18}/> Add Customer</button></div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{customers.map(c => (<div key={c.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4"><div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-xl">{c.name[0]}</div><div><div className="font-bold text-slate-800">{c.name}</div><div className="text-xs text-slate-500">Customer ID: {c.id.slice(0,6)}</div></div></div>))}</div>
           </div>
         )}
         
         {toast && <Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)} />}
         {printOrder && <InvoiceModal order={printOrder} settings={settings} onClose={()=>setPrintOrder(null)} currency={currency}/>}
      </main>
    </div>
  );
}