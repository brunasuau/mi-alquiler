import { useState, useEffect, useRef } from "react";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, collection, query, where,
  onSnapshot, addDoc, orderBy, serverTimestamp, updateDoc
} from "firebase/firestore";

// ── OWNER EMAIL (only this user is owner) ──────────────────────────────────
const OWNER_EMAIL = "bertasuau@gmail.com"; // <-- cambia esto por tu email real

// ── TRANSLATIONS ────────────────────────────────────────────────────────────
const T = {
  es: {
    appName: "MiAlquiler",
    selectLang: "Elige tu idioma",
    loginTitle: "Bienvenido",
    email: "Correo electrónico",
    password: "Contraseña",
    login: "Entrar",
    logout: "Salir",
    owner: "Propietario",
    tenant: "Inquilino",
    dashboard: "Resumen",
    tenants: "Inquilinos",
    finances: "Finanzas",
    maintenance: "Mantenimiento",
    myHome: "Mi Piso",
    myCosts: "Mis Costes",
    incidents: "Incidencias",
    messages: "Mensajes",
    paid: "Pagado",
    pending: "Pendiente",
    markPaid: "Marcar pagado",
    revert: "Revertir",
    addCost: "Añadir coste",
    save: "Guardar",
    send: "Enviar",
    newTenant: "Nuevo inquilino",
    name: "Nombre completo",
    unit: "Piso / Habitación",
    phone: "Teléfono",
    rent: "Alquiler mensual (€)",
    createAccess: "Crear acceso",
    concept: "Concepto",
    amount: "Importe (€)",
    month: "Mes",
    typeMsg: "Escribe un mensaje...",
    sendIncident: "Enviar al propietario",
    incidentType: "Tipo de problema",
    description: "Descripción",
    noTenants: "No hay inquilinos todavía",
    noMessages: "No hay mensajes aún",
    noIncidents: "No hay incidencias",
    noCosts: "Sin costes registrados",
    rentStatus: "Estado del alquiler",
    costBreakdown: "Desglose de costes",
    paymentHistory: "Historial de pagos",
    registered: "Registrado el",
    dueThisMonth: "Vence este mes",
    inReview: "En revisión",
    resolved: "Resuelto",
    status: "Estado",
    update: "Actualizar",
    wrongCredentials: "Email o contraseña incorrectos",
    saving: "Guardando...",
    profile: "Perfil",
    joinedSince: "Inquilino desde",
    totalCosts: "Total costes",
    monthlyRent: "Alquiler fijo",
    incomeMonth: "Ingreso mensual",
    paidCount: "Pagos recibidos",
    activeTenants: "Inquilinos activos",
    pendingMaint: "Mantenimiento pendiente",
    recentIncidents: "Incidencias recientes",
    paymentsMarch: "Pagos · Marzo 2025",
    hello: "Hola",
  },
  en: {
    appName: "MyRental",
    selectLang: "Choose your language",
    loginTitle: "Welcome",
    email: "Email address",
    password: "Password",
    login: "Sign in",
    logout: "Sign out",
    owner: "Owner",
    tenant: "Tenant",
    dashboard: "Overview",
    tenants: "Tenants",
    finances: "Finances",
    maintenance: "Maintenance",
    myHome: "My Flat",
    myCosts: "My Costs",
    incidents: "Issues",
    messages: "Messages",
    paid: "Paid",
    pending: "Pending",
    markPaid: "Mark as paid",
    revert: "Revert",
    addCost: "Add cost",
    save: "Save",
    send: "Send",
    newTenant: "New tenant",
    name: "Full name",
    unit: "Flat / Room",
    phone: "Phone",
    rent: "Monthly rent (€)",
    createAccess: "Create access",
    concept: "Concept",
    amount: "Amount (€)",
    month: "Month",
    typeMsg: "Type a message...",
    sendIncident: "Send to owner",
    incidentType: "Problem type",
    description: "Description",
    noTenants: "No tenants yet",
    noMessages: "No messages yet",
    noIncidents: "No issues reported",
    noCosts: "No costs registered",
    rentStatus: "Rent status",
    costBreakdown: "Cost breakdown",
    paymentHistory: "Payment history",
    registered: "Registered on",
    dueThisMonth: "Due this month",
    inReview: "In review",
    resolved: "Resolved",
    status: "Status",
    update: "Update",
    wrongCredentials: "Wrong email or password",
    saving: "Saving...",
    profile: "Profile",
    joinedSince: "Tenant since",
    totalCosts: "Total costs",
    monthlyRent: "Fixed rent",
    incomeMonth: "Monthly income",
    paidCount: "Payments received",
    activeTenants: "Active tenants",
    pendingMaint: "Pending maintenance",
    recentIncidents: "Recent issues",
    paymentsMarch: "Payments · March 2025",
    hello: "Hello",
  },
  ar: {
    appName: "إيجاري",
    selectLang: "اختر لغتك",
    loginTitle: "مرحباً",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    login: "دخول",
    logout: "خروج",
    owner: "المالك",
    tenant: "المستأجر",
    dashboard: "ملخص",
    tenants: "المستأجرون",
    finances: "الماليات",
    maintenance: "الصيانة",
    myHome: "شقتي",
    myCosts: "تكاليفي",
    incidents: "البلاغات",
    messages: "الرسائل",
    paid: "مدفوع",
    pending: "معلق",
    markPaid: "تأكيد الدفع",
    revert: "تراجع",
    addCost: "إضافة تكلفة",
    save: "حفظ",
    send: "إرسال",
    newTenant: "مستأجر جديد",
    name: "الاسم الكامل",
    unit: "الشقة / الغرفة",
    phone: "الهاتف",
    rent: "الإيجار الشهري (€)",
    createAccess: "إنشاء حساب",
    concept: "البند",
    amount: "المبلغ (€)",
    month: "الشهر",
    typeMsg: "اكتب رسالة...",
    sendIncident: "إرسال للمالك",
    incidentType: "نوع المشكلة",
    description: "الوصف",
    noTenants: "لا يوجد مستأجرون",
    noMessages: "لا توجد رسائل",
    noIncidents: "لا توجد بلاغات",
    noCosts: "لا توجد تكاليف",
    rentStatus: "حالة الإيجار",
    costBreakdown: "تفاصيل التكاليف",
    paymentHistory: "سجل المدفوعات",
    registered: "تم التسجيل في",
    dueThisMonth: "مستحق هذا الشهر",
    inReview: "قيد المراجعة",
    resolved: "تم الحل",
    status: "الحالة",
    update: "تحديث",
    wrongCredentials: "بريد إلكتروني أو كلمة مرور خاطئة",
    saving: "جاري الحفظ...",
    profile: "الملف الشخصي",
    joinedSince: "مستأجر منذ",
    totalCosts: "إجمالي التكاليف",
    monthlyRent: "الإيجار الثابت",
    incomeMonth: "الدخل الشهري",
    paidCount: "المدفوعات المستلمة",
    activeTenants: "المستأجرون النشطون",
    pendingMaint: "صيانة معلقة",
    recentIncidents: "البلاغات الأخيرة",
    paymentsMarch: "المدفوعات · مارس 2025",
    hello: "مرحباً",
  }
};

// ── HELPERS ─────────────────────────────────────────────────────────────────
const avatarColors = ["#C4622D","#7A9E7E","#D4A853","#6B8CBA","#9B6BB5","#C4844A"];
const getColor = (str) => avatarColors[str?.charCodeAt(0) % avatarColors.length] || "#C4622D";
const initials = (name) => name?.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2) || "?";
const today = () => new Date().toLocaleDateString("es-ES");

const maintIcons = {
  "Fontanería":"🚿","Plumbing":"🚿","السباكة":"🚿",
  "Electricidad":"⚡","Electricity":"⚡","الكهرباء":"⚡",
  "Calefacción":"🌡️","Heating":"🌡️","التدفئة":"🌡️",
  "Ventanas":"🪟","Windows":"🪟","النوافذ":"🪟",
  "Electrodomésticos":"🔌","Appliances":"🔌","الأجهزة":"🔌",
  "Otros":"🔧","Others":"🔧","أخرى":"🔧",
};

// ── CSS ──────────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --cream:#F7F3EE;--dark:#1A1612;--terra:#C4622D;--terra-l:#E8845A;
  --sage:#7A9E7E;--sage-l:#A8C5AB;--gold:#D4A853;--warm:#8C7B6E;
  --bg:#FFFCF9;--border:#E8DDD4;--red:#D94F3D;--green:#4A9B6F;
}
body{font-family:'DM Sans',sans-serif;background:var(--cream);color:var(--dark);font-size:15px}
.serif{font-family:'DM Serif Display',serif}

/* LANG SELECT */
.lang-screen{min-height:100vh;background:var(--dark);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px;padding:20px}
.lang-title{font-family:'DM Serif Display',serif;font-size:52px;color:var(--cream);letter-spacing:-1px;text-align:center}
.lang-title em{color:var(--terra-l);font-style:italic}
.lang-cards{display:flex;gap:16px;flex-wrap:wrap;justify-content:center}
.lang-card{background:#2A2420;border:2px solid #3A3028;border-radius:16px;padding:24px 32px;cursor:pointer;text-align:center;transition:all .2s;color:var(--cream)}
.lang-card:hover,.lang-card.sel{border-color:var(--terra);background:#332A25}
.lang-card .flag{font-size:36px;margin-bottom:8px}
.lang-card p{font-size:15px;font-weight:500}

/* LOGIN */
.login-wrap{min-height:100vh;background:var(--dark);display:flex;align-items:center;justify-content:center;padding:20px}
.login-box{background:#2A2420;border:1px solid #3A3028;border-radius:24px;padding:40px 36px;width:100%;max-width:380px}
.login-box h2{font-family:'DM Serif Display',serif;font-size:28px;color:var(--cream);margin-bottom:6px}
.login-box p{color:var(--warm);font-size:13px;margin-bottom:28px}
.login-err{background:#3D1A18;border:1px solid var(--red);color:#F5A49A;padding:10px 14px;border-radius:10px;font-size:13px;margin-bottom:16px}

/* SIDEBAR */
.app{display:flex;min-height:100vh}
.sidebar{width:220px;background:var(--dark);display:flex;flex-direction:column;padding:28px 16px;position:fixed;top:0;left:0;bottom:0;z-index:50}
.s-logo{font-family:'DM Serif Display',serif;font-size:22px;color:var(--cream);padding:0 10px}
.s-logo em{color:var(--terra-l);font-style:italic}
.s-role{font-size:11px;color:var(--warm);text-transform:uppercase;letter-spacing:1px;padding:0 10px;margin:4px 0 24px}
.s-nav{flex:1;display:flex;flex-direction:column;gap:3px}
.nav-item{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:10px;cursor:pointer;color:var(--warm);font-size:14px;font-weight:500;transition:all .2s;border:none;background:none;width:100%;text-align:left;font-family:'DM Sans',sans-serif}
.nav-item:hover{background:#2A2420;color:var(--cream)}
.nav-item.active-o{background:var(--terra);color:#fff}
.nav-item.active-t{background:var(--sage);color:#fff}
.s-footer{border-top:1px solid #2A2420;padding-top:14px;margin-top:auto;display:flex;align-items:center;gap:10px}
.s-user-info{flex:1;min-width:0}
.s-user-info strong{font-size:13px;color:var(--cream);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.s-user-info span{font-size:11px;color:var(--warm)}
.logout-btn{background:none;border:none;color:var(--warm);cursor:pointer;font-size:16px;padding:4px;transition:color .2s}
.logout-btn:hover{color:var(--cream)}

/* CONTENT */
.content{margin-left:220px;padding:40px;flex:1;min-height:100vh}
@media(max-width:800px){.sidebar{width:180px}.content{margin-left:180px;padding:24px 16px}}

/* AVATAR */
.av{border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;color:#fff;flex-shrink:0}
.av-sm{width:34px;height:34px;font-size:13px}
.av-md{width:48px;height:48px;font-size:18px;font-family:'DM Serif Display',serif}
.av-lg{width:72px;height:72px;font-size:26px;font-family:'DM Serif Display',serif}

/* PAGE */
.page-hd{margin-bottom:32px}
.page-hd h2{font-family:'DM Serif Display',serif;font-size:32px;letter-spacing:-.5px}
.page-hd p{color:var(--warm);font-size:14px;margin-top:4px}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.fade{animation:fadeIn .3s ease}

/* STATS */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:28px}
.stat{background:var(--bg);border:1px solid var(--border);border-radius:16px;padding:22px 20px}
.stat .lbl{font-size:11px;color:var(--warm);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px}
.stat .val{font-family:'DM Serif Display',serif;font-size:30px;line-height:1}
.stat .sub{font-size:12px;color:var(--warm);margin-top:6px}
.stat.tl{border-left:4px solid var(--terra)}
.stat.sl{border-left:4px solid var(--sage)}
.stat.gl{border-left:4px solid var(--gold)}
.stat.rl{border-left:4px solid var(--red)}

/* CARD */
.card{background:var(--bg);border:1px solid var(--border);border-radius:16px;padding:24px;margin-bottom:20px}
.card-title{font-family:'DM Serif Display',serif;font-size:18px;margin-bottom:18px;display:flex;align-items:center;gap:8px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media(max-width:900px){.g2{grid-template-columns:1fr}}

/* TENANT ROW */
.t-row{display:flex;align-items:center;gap:14px;padding:16px;border-radius:12px;border:1px solid var(--border);background:#fff;cursor:pointer;transition:box-shadow .2s;margin-bottom:10px}
.t-row:hover{box-shadow:0 4px 16px rgba(0,0,0,.07)}
.t-info{flex:1}
.t-info strong{font-size:15px;display:block}
.t-info span{font-size:13px;color:var(--warm)}

/* BADGE */
.badge{font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}

/* MAINT */
.mi{display:flex;align-items:flex-start;gap:14px;padding:16px;border-radius:12px;border:1px solid var(--border);background:#fff;margin-bottom:10px}
.mi-icon{width:40px;height:40px;border-radius:10px;background:#FDF3EE;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.mi-info{flex:1}
.mi-info strong{font-size:14px;display:block}
.mi-info .meta{font-size:12px;color:var(--warm);margin-top:3px}
.mi-info p{font-size:13px;color:#555;margin-top:6px;line-height:1.5}

/* TABLE */
.tbl-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--warm);padding:0 14px 12px;border-bottom:1px solid var(--border);font-weight:600;white-space:nowrap}
td{padding:13px 14px;border-bottom:1px solid var(--border);font-size:14px}
tr:last-child td{border-bottom:none}
tbody tr:hover td{background:var(--cream)}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;transition:all .2s;font-family:'DM Sans',sans-serif}
.btn-p{background:var(--terra);color:#fff}
.btn-p:hover{background:var(--terra-l)}
.btn-s{background:var(--sage);color:#fff}
.btn-s:hover{background:var(--sage-l)}
.btn-o{background:transparent;border:1.5px solid var(--border);color:var(--dark)}
.btn-o:hover{border-color:var(--terra);color:var(--terra)}
.btn-sm{padding:5px 10px;font-size:12px}
.btn-full{width:100%;justify-content:center}

/* FORM */
.fg{margin-bottom:16px}
.fg label{font-size:12px;font-weight:600;color:var(--warm);text-transform:uppercase;letter-spacing:.7px;display:block;margin-bottom:6px}
.fg input,.fg select,.fg textarea{width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;background:#fff;color:var(--dark);transition:border-color .2s;outline:none}
.fg input:focus,.fg select:focus,.fg textarea:focus{border-color:var(--terra)}
.fg textarea{resize:vertical;min-height:80px}
.gr2{display:grid;grid-template-columns:1fr 1fr;gap:14px}

/* PAY STATUS */
.pay-box{border-radius:20px;padding:28px;text-align:center;margin-bottom:20px}
.pay-box h3{font-family:'DM Serif Display',serif;font-size:24px;margin-bottom:4px}
.pay-box .amount{font-family:'DM Serif Display',serif;font-size:40px;margin:14px 0;color:var(--dark)}
.pay-box p{font-size:14px;color:var(--warm)}
.pay-box .sico{font-size:48px;margin-bottom:10px}

/* COST ROW */
.cr{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid var(--border)}
.cr:last-child{border-bottom:none}
.cr .cn{font-size:14px;display:flex;align-items:center;gap:8px}
.cr .ca{font-weight:600;font-size:15px}

/* MODAL */
.overlay{position:fixed;inset:0;background:rgba(20,15,10,.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px}
.modal{background:var(--bg);border-radius:20px;padding:32px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto}
.modal-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
.modal-hd h3{font-family:'DM Serif Display',serif;font-size:22px}
.close-btn{background:none;border:none;font-size:20px;cursor:pointer;color:var(--warm);padding:4px}
.close-btn:hover{color:var(--dark)}

/* PROFILE */
.prof-hd{display:flex;align-items:center;gap:18px;margin-bottom:24px}
.prof-hd-info h3{font-family:'DM Serif Display',serif;font-size:22px}
.prof-hd-info p{color:var(--warm);font-size:14px}
.prof-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pf-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--warm);font-weight:600;margin-bottom:3px}
.pf-val{font-size:15px;font-weight:500}

/* CHAT */
.chat-wrap{display:flex;flex-direction:column;height:calc(100vh - 200px);min-height:400px}
.chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#fff;border-radius:16px 16px 0 0;border:1px solid var(--border)}
.msg{max-width:75%;padding:10px 14px;border-radius:14px;font-size:14px;line-height:1.5}
.msg.mine{align-self:flex-end;background:var(--terra);color:#fff;border-bottom-right-radius:4px}
.msg.theirs{align-self:flex-start;background:var(--cream);color:var(--dark);border-bottom-left-radius:4px}
.msg .msg-meta{font-size:11px;opacity:.7;margin-top:4px}
.chat-input{display:flex;gap:8px;padding:12px;background:#fff;border:1px solid var(--border);border-top:none;border-radius:0 0 16px 16px}
.chat-input input{flex:1;padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;outline:none}
.chat-input input:focus{border-color:var(--terra)}
.chat-tabs{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.chat-tab{padding:8px 16px;border-radius:20px;border:1.5px solid var(--border);font-size:13px;cursor:pointer;background:#fff;transition:all .2s;font-family:'DM Sans',sans-serif}
.chat-tab.active{background:var(--terra);border-color:var(--terra);color:#fff}

hr{border:none;border-top:1px solid var(--border);margin:18px 0}
.saving{font-size:11px;color:var(--warm);display:flex;align-items:center;gap:6px;margin-bottom:16px}
.saving::before{content:'';width:8px;height:8px;border-radius:50%;background:var(--sage);display:inline-block}
.status-sel{font-size:12px;padding:4px 8px;border:1px solid var(--border);border-radius:8px;background:#fff;cursor:pointer;font-family:'DM Sans',sans-serif}
.toast{position:fixed;bottom:30px;right:30px;background:var(--dark);color:var(--cream);padding:14px 20px;border-radius:12px;font-size:14px;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.2)}
@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
.toast{animation:slideUp .3s ease}
`;

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [lang, setLang] = useState(null);
  const [user, setUser] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tenants, setTenants] = useState([]);

  const t = T[lang || "es"];
  const isOwner = profile?.role === "owner";

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          setProfile(snap.data());
          setLang(snap.data().lang || "es");
        }
      } else {
        setProfile(null);
      }
    });
    return unsub;
  }, []);

  // Load tenants (owner only)
  useEffect(() => {
    if (!isOwner) return;
    const q = query(collection(db, "users"), where("role", "==", "tenant"));
    const unsub = onSnapshot(q, (snap) => {
      setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [isOwner]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const persist = async (ref, data) => {
    setSaving(true);
    await updateDoc(ref, data);
    setSaving(false);
    showToast("✅ Guardado");
  };

  // Loading
  if (user === undefined) return (
    <>
      <style>{css}</style>
      <div style={{ minHeight:"100vh", background:"#1A1612", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <p style={{ color:"#8C7B6E", fontFamily:"'DM Sans',sans-serif" }}>Cargando...</p>
      </div>
    </>
  );

  // Lang select (only for non-logged users or tenants without lang)
  if (!lang && !user) return (
    <>
      <style>{css}</style>
      <LangSelect onSelect={setLang} />
    </>
  );

  // Login
  if (!user) return (
    <>
      <style>{css}</style>
      <LoginScreen t={t} onLogin={(u, p) => { setUser(u); setProfile(p); setPage(p.role === "owner" ? "dashboard" : "t-home"); }} />
    </>
  );

  // Logged in
  const ownerNav = [
    { id:"dashboard", icon:"📊", label:t.dashboard },
    { id:"tenants", icon:"👥", label:t.tenants },
    { id:"finances", icon:"💰", label:t.finances },
    { id:"maintenance", icon:"🔧", label:t.maintenance },
    { id:"messages", icon:"💬", label:t.messages },
  ];
  const tenantNav = [
    { id:"t-home", icon:"🏠", label:t.myHome },
    { id:"t-costs", icon:"⚡", label:t.myCosts },
    { id:"t-maint", icon:"🔧", label:t.incidents },
    { id:"t-messages", icon:"💬", label:t.messages },
  ];
  const nav = isOwner ? ownerNav : tenantNav;

  const renderPage = () => {
    if (isOwner) {
      if (page === "dashboard") return <Dashboard t={t} tenants={tenants} onNav={setPage} onSelect={id => setModal({ type:"profile", id })} />;
      if (page === "tenants") return <Tenants t={t} tenants={tenants} onSelect={id => setModal({ type:"profile", id })} onNew={() => setModal({ type:"new-tenant" })} />;
      if (page === "finances") return <Finances t={t} tenants={tenants} onToggle={togglePayment} onAddCost={() => setModal({ type:"add-cost" })} />;
      if (page === "maintenance") return <Maintenance t={t} tenants={tenants} onStatus={changeStatus} />;
      if (page === "messages") return <OwnerMessages t={t} tenants={tenants} ownerId={user.uid} />;
    } else {
      if (page === "t-home") return <TenantHome t={t} profile={profile} />;
      if (page === "t-costs") return <TenantCosts t={t} profile={profile} />;
      if (page === "t-maint") return <TenantMaintenance t={t} profile={profile} onSend={sendMaintenance} />;
      if (page === "t-messages") return <TenantMessages t={t} tenantId={user.uid} />;
    }
  };

  async function togglePayment(tenantId, month) {
    const t2 = tenants.find(x => x.id === tenantId);
    if (!t2) return;
    const payments = { ...(t2.payments || {}) };
    const cur = payments[month] || { paid: false };
    payments[month] = { paid: !cur.paid, date: !cur.paid ? today() : null };
    await persist(doc(db, "users", tenantId), { payments });
    showToast(payments[month].paid ? "✅ Pago registrado" : "❌ Pago revertido");
  }

  async function changeStatus(tenantId, maintId, status) {
    const t2 = tenants.find(x => x.id === tenantId);
    const maintenance = (t2.maintenance || []).map(m => m.id === maintId ? { ...m, status } : m);
    await persist(doc(db, "users", tenantId), { maintenance });
  }

  async function sendMaintenance(type, desc) {
    const maintenance = [...(profile.maintenance || []), { id: Date.now(), type, date: today(), status: "Pendiente", desc }];
    await persist(doc(db, "users", user.uid), { maintenance });
    setProfile(p => ({ ...p, maintenance }));
  }

  const renderModal = () => {
    if (!modal) return null;
    if (modal.type === "profile") {
      const ten = tenants.find(x => x.id === modal.id);
      return <TenantProfileModal t={t} tenant={ten} onToggle={togglePayment} onAddCost={addCost} onClose={() => setModal(null)} />;
    }
    if (modal.type === "new-tenant") return <NewTenantModal t={t} onClose={() => setModal(null)} onSave={createTenant} />;
    if (modal.type === "add-cost") return <AddCostModal t={t} tenants={tenants} onSave={addCost} onClose={() => setModal(null)} />;
    return null;
  };

  async function addCost(tenantId, cost) {
    const ten = tenants.find(x => x.id === tenantId);
    const costs = [...(ten.costs || []), { id: Date.now(), ...cost }];
    await persist(doc(db, "users", tenantId), { costs });
    setModal(null);
  }

  async function createTenant({ name, unit, phone, rent, email, password }) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", cred.user.uid), {
        name, unit, phone, rent: parseFloat(rent), email,
        role: "tenant", joined: today(),
        payments: {}, costs: [], maintenance: [], lang: "es"
      });
      // sign back in as owner
      await signInWithEmailAndPassword(auth, OWNER_EMAIL, window._ownerPass || "");
      setModal(null);
      showToast("✅ Inquilino creado");
    } catch (e) {
      showToast("❌ Error: " + e.message);
    }
  }

  const activeClass = (id) => id === page ? (isOwner ? "nav-item active-o" : "nav-item active-t") : "nav-item";

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <aside className="sidebar">
          <div className="s-logo">Mi<em>Alquiler</em></div>
          <div className="s-role">{isOwner ? t.owner : t.tenant}</div>
          <nav className="s-nav">
            {nav.map(item => (
              <button key={item.id} className={activeClass(item.id)} onClick={() => setPage(item.id)}>
                <span>{item.icon}</span> {item.label}
              </button>
            ))}
          </nav>
          <div className="s-footer">
            <div className="av av-sm" style={{ background: getColor(profile?.name || "") }}>{initials(profile?.name || "?")}</div>
            <div className="s-user-info">
              <strong>{profile?.name || user.email}</strong>
              <span>{isOwner ? t.owner : profile?.unit}</span>
            </div>
            <button className="logout-btn" onClick={() => signOut(auth)} title={t.logout}>↩</button>
          </div>
        </aside>

        <main className="content fade" key={page}>
          {saving && <div className="saving">{t.saving}</div>}
          {renderPage()}
        </main>
      </div>

      {modal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          {renderModal()}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

// ── LANG SELECT ───────────────────────────────────────────────────────────────
function LangSelect({ onSelect }) {
  const langs = [
    { code: "es", flag: "🇪🇸", label: "Español" },
    { code: "en", flag: "🇬🇧", label: "English" },
    { code: "ar", flag: "🇸🇦", label: "العربية" },
  ];
  return (
    <div className="lang-screen">
      <h1 className="lang-title">Mi<em>Alquiler</em></h1>
      <div className="lang-cards">
        {langs.map(l => (
          <div key={l.code} className="lang-card" onClick={() => onSelect(l.code)}>
            <div className="flag">{l.flag}</div>
            <p>{l.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginScreen({ t, onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setErr(""); setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      window._ownerPass = pass;
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (snap.exists()) onLogin(cred.user, snap.data());
    } catch {
      setErr(t.wrongCredentials);
    }
    setLoading(false);
  };

  return (
    <div className="login-wrap">
      <div className="login-box">
        <h2>{t.loginTitle}</h2>
        <p>MiAlquiler · {t.owner} / {t.tenant}</p>
        {err && <div className="login-err">{err}</div>}
        <div className="fg"><label>{t.email}</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==="Enter" && handle()} /></div>
        <div className="fg"><label>{t.password}</label><input type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key==="Enter" && handle()} /></div>
        <button className="btn btn-p btn-full" onClick={handle} disabled={loading}>{loading ? "..." : t.login}</button>
      </div>
    </div>
  );
}

// ── OWNER PAGES ───────────────────────────────────────────────────────────────
function Dashboard({ t, tenants, onNav, onSelect }) {
  const totalRent = tenants.reduce((s, t2) => s + (t2.rent || 0), 0);
  const currentMonth = new Date().toLocaleString("es-ES", { month:"long", year:"numeric" });
  const paidCount = tenants.filter(t2 => {
    const payments = t2.payments || {};
    return Object.values(payments).some(p => p.paid);
  }).length;
  const pendingMaint = tenants.reduce((s, t2) => s + (t2.maintenance||[]).filter(m => m.status==="Pendiente").length, 0);
  const allMaint = tenants.flatMap(t2 => (t2.maintenance||[]).map(m => ({ ...m, tenant: t2 }))).slice(0,4);

  return (
    <div>
      <div className="page-hd"><h2>{t.hello} 👋</h2><p>{currentMonth}</p></div>
      <div className="stats">
        <div className="stat tl"><div className="lbl">{t.incomeMonth}</div><div className="val">{totalRent}€</div></div>
        <div className="stat sl"><div className="lbl">{t.paidCount}</div><div className="val">{paidCount}/{tenants.length}</div></div>
        <div className="stat gl"><div className="lbl">{t.activeTenants}</div><div className="val">{tenants.length}</div></div>
        <div className="stat rl"><div className="lbl">{t.pendingMaint}</div><div className="val">{pendingMaint}</div></div>
      </div>
      <div className="g2">
        <div className="card">
          <div className="card-title">👥 {t.tenants}</div>
          {tenants.length === 0 ? <p style={{color:"var(--warm)",fontSize:14}}>{t.noTenants}</p> :
            tenants.slice(0,4).map(ten => (
              <div key={ten.id} className="t-row" onClick={() => onSelect(ten.id)}>
                <div className="av av-md" style={{background:getColor(ten.name)}}>{initials(ten.name)}</div>
                <div className="t-info"><strong>{ten.name}</strong><span>{ten.unit}</span></div>
                <span style={{color:"var(--warm)",fontSize:18}}>›</span>
              </div>
            ))}
        </div>
        <div className="card">
          <div className="card-title">🔧 {t.recentIncidents}</div>
          {allMaint.length === 0 ? <p style={{color:"var(--warm)",fontSize:14}}>🎉 Sin incidencias</p> :
            allMaint.map(m => (
              <div key={m.id} className="mi">
                <div className="mi-icon">{maintIcons[m.type]||"🔧"}</div>
                <div className="mi-info"><strong>{m.type}</strong><div className="meta">{m.tenant.name} · {m.date}</div><p>{m.desc}</p></div>
                <StatusBadge status={m.status} t={t} />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function Tenants({ t, tenants, onSelect, onNew }) {
  return (
    <div>
      <div className="page-hd" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div><h2>{t.tenants}</h2><p>{tenants.length} {t.activeTenants.toLowerCase()}</p></div>
        <button className="btn btn-p" onClick={onNew}>➕ {t.newTenant}</button>
      </div>
      {tenants.length === 0 ? <div className="card"><p style={{color:"var(--warm)",fontSize:14,textAlign:"center",padding:20}}>{t.noTenants}</p></div> :
        tenants.map(ten => (
          <div key={ten.id} className="t-row" onClick={() => onSelect(ten.id)}>
            <div className="av av-md" style={{background:getColor(ten.name)}}>{initials(ten.name)}</div>
            <div className="t-info" style={{flex:1}}><strong>{ten.name}</strong><span>{ten.unit} · {t.joinedSince} {ten.joined}</span></div>
            <div style={{textAlign:"right",marginRight:14}}>
              <div style={{fontWeight:600,fontSize:16}}>{ten.rent}€<span style={{fontSize:12,fontWeight:400,color:"var(--warm)"}}>/mes</span></div>
            </div>
            <span style={{color:"var(--warm)",fontSize:18}}>›</span>
          </div>
        ))}
    </div>
  );
}

function Finances({ t, tenants, onToggle, onAddCost }) {
  const months = ["Enero 2025","Febrero 2025","Marzo 2025"];
  return (
    <div>
      <div className="page-hd"><h2>{t.finances}</h2></div>
      <div className="card">
        <div className="card-title">💶 {t.paymentHistory}</div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>{t.name}</th><th>{t.unit}</th><th>{t.rent}</th>{months.map(m=><th key={m}>{m}</th>)}</tr></thead>
            <tbody>
              {tenants.map(ten => (
                <tr key={ten.id}>
                  <td><strong>{ten.name}</strong></td>
                  <td>{ten.unit}</td>
                  <td>{ten.rent}€</td>
                  {months.map(m => {
                    const p = (ten.payments||{})[m];
                    return (
                      <td key={m}>
                        <span className="badge" style={p?.paid ? {background:"#E6F4ED",color:"#4A9B6F",cursor:"pointer"} : {background:"#FDECEA",color:"#D94F3D",cursor:"pointer"}}
                          onClick={() => onToggle(ten.id, m)}>
                          {p?.paid ? `✓ ${p.date}` : "✗ Pend."}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-title">⚡ {t.costBreakdown}</div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>{t.name}</th><th>{t.concept}</th><th>{t.month}</th><th>{t.amount}</th></tr></thead>
            <tbody>
              {tenants.flatMap(ten => (ten.costs||[]).map(c => (
                <tr key={c.id}><td>{ten.name}</td><td>{c.icon} {c.name}</td><td>{c.month}</td><td>{c.amount}€</td></tr>
              )))}
            </tbody>
          </table>
        </div>
        <div style={{marginTop:14}}><button className="btn btn-p" onClick={onAddCost}>➕ {t.addCost}</button></div>
      </div>
    </div>
  );
}

function Maintenance({ t, tenants, onStatus }) {
  const all = tenants.flatMap(ten => (ten.maintenance||[]).map(m => ({ ...m, tenant: ten })));
  return (
    <div>
      <div className="page-hd"><h2>{t.maintenance}</h2><p>{all.filter(m=>m.status==="Pendiente").length} {t.pending.toLowerCase()}</p></div>
      {all.length === 0 ? <div className="card"><p style={{color:"var(--warm)",textAlign:"center",padding:20}}>🎉 {t.noIncidents}</p></div> :
        all.map(m => (
          <div key={m.id} className="mi">
            <div className="mi-icon">{maintIcons[m.type]||"🔧"}</div>
            <div className="mi-info"><strong>{m.type}</strong><div className="meta">{m.tenant.name} · {m.tenant.unit} · {m.date}</div><p>{m.desc}</p></div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
              <StatusBadge status={m.status} t={t} />
              <select className="status-sel" value={m.status} onChange={e => onStatus(m.tenant.id, m.id, e.target.value)}>
                <option>Pendiente</option><option>En revisión</option><option>Resuelto</option>
              </select>
            </div>
          </div>
        ))}
    </div>
  );
}

// ── MESSAGES ─────────────────────────────────────────────────────────────────
function OwnerMessages({ t, tenants, ownerId }) {
  const [activeTenant, setActiveTenant] = useState(tenants[0]?.id || null);
  useEffect(() => { if (!activeTenant && tenants.length > 0) setActiveTenant(tenants[0].id); }, [tenants]);
  if (tenants.length === 0) return <div className="page-hd"><h2>{t.messages}</h2><p style={{color:"var(--warm)"}}>{t.noTenants}</p></div>;
  return (
    <div>
      <div className="page-hd"><h2>{t.messages}</h2></div>
      <div className="chat-tabs">
        {tenants.map(ten => (
          <button key={ten.id} className={`chat-tab ${activeTenant===ten.id?"active":""}`} onClick={() => setActiveTenant(ten.id)}>
            {ten.name.split(" ")[0]}
          </button>
        ))}
      </div>
      {activeTenant && <ChatWindow roomId={[ownerId, activeTenant].sort().join("_")} senderId={ownerId} t={t} />}
    </div>
  );
}

function TenantMessages({ t, tenantId }) {
  const [ownerId, setOwnerId] = useState(null);
  useEffect(() => {
    const q = query(collection(db, "users"), where("role","==","owner"));
    onSnapshot(q, snap => { if (!snap.empty) setOwnerId(snap.docs[0].id); });
  }, []);
  if (!ownerId) return <div className="page-hd"><h2>{t.messages}</h2></div>;
  const roomId = [ownerId, tenantId].sort().join("_");
  return (
    <div>
      <div className="page-hd"><h2>{t.messages}</h2></div>
      <ChatWindow roomId={roomId} senderId={tenantId} t={t} />
    </div>
  );
}

function ChatWindow({ roomId, senderId, t }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, "chats", roomId, "messages"), orderBy("createdAt"));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [roomId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  const sendMsg = async () => {
    if (!text.trim()) return;
    await addDoc(collection(db, "chats", roomId, "messages"), {
      text: text.trim(), senderId, createdAt: serverTimestamp()
    });
    setText("");
  };

  return (
    <div className="chat-wrap">
      <div className="chat-messages">
        {messages.length === 0 && <p style={{color:"var(--warm)",fontSize:14,textAlign:"center",margin:"auto"}}>{t.noMessages}</p>}
        {messages.map(m => (
          <div key={m.id} className={`msg ${m.senderId===senderId?"mine":"theirs"}`}>
            {m.text}
            <div className="msg-meta">{m.createdAt?.toDate?.()?.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key==="Enter" && sendMsg()} placeholder={t.typeMsg} />
        <button className="btn btn-p" onClick={sendMsg}>↑</button>
      </div>
    </div>
  );
}

// ── TENANT PAGES ──────────────────────────────────────────────────────────────
function TenantHome({ t, profile }) {
  if (!profile) return null;
  const months = Object.keys(profile.payments || {});
  const current = months[months.length - 1] || "";
  const p = (profile.payments || {})[current] || { paid: false };

  return (
    <div>
      <div className="page-hd"><h2>{t.hello}, {profile.name?.split(" ")[0]} 👋</h2><p>{profile.unit}</p></div>
      <div className="pay-box" style={p.paid
        ? {background:"linear-gradient(135deg,#E6F4ED,#D0EBDA)",border:"2px solid #4A9B6F"}
        : {background:"linear-gradient(135deg,#FDECEA,#FAD8D5)",border:"2px solid #D94F3D"}}>
        <div className="sico">{p.paid ? "✅" : "⚠️"}</div>
        <h3>{p.paid ? `${t.paid} ✓` : t.pending}</h3>
        <div className="amount">{profile.rent}€</div>
        <p>{p.paid ? `${t.registered} ${p.date}` : `${t.dueThisMonth} · ${current}`}</p>
      </div>
      <div className="card">
        <div className="card-title">📋 {t.paymentHistory}</div>
        {months.length === 0 ? <p style={{color:"var(--warm)",fontSize:14}}>{t.pending}</p> :
          months.map(m => {
            const pm = (profile.payments||{})[m];
            return (
              <div key={m} className="cr">
                <div className="cn">{m}</div>
                <span className="badge" style={pm.paid?{background:"#E6F4ED",color:"#4A9B6F"}:{background:"#FDECEA",color:"#D94F3D"}}>
                  {pm.paid ? `✓ ${pm.date}` : "✗ Pendiente"}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function TenantCosts({ t, profile }) {
  const costs = profile?.costs || [];
  const total = costs.reduce((s, c) => s + (c.amount||0), 0);
  return (
    <div>
      <div className="page-hd"><h2>{t.myCosts}</h2></div>
      <div className="stats">
        <div className="stat gl"><div className="lbl">{t.totalCosts}</div><div className="val">{total}€</div></div>
        <div className="stat tl"><div className="lbl">{t.monthlyRent}</div><div className="val">{profile?.rent}€</div></div>
      </div>
      <div className="card">
        <div className="card-title">⚡ {t.costBreakdown}</div>
        {costs.length === 0 ? <p style={{color:"var(--warm)",fontSize:14}}>{t.noCosts}</p> :
          costs.map(c => (
            <div key={c.id} className="cr">
              <div className="cn"><span style={{fontSize:20}}>{c.icon}</span><div><div>{c.name}</div><div style={{fontSize:12,color:"var(--warm)"}}>{c.month}</div></div></div>
              <div className="ca">{c.amount}€</div>
            </div>
          ))}
        {costs.length > 0 && <><hr /><div className="cr"><div className="cn"><strong>Total</strong></div><div className="ca" style={{fontSize:18}}>{total}€</div></div></>}
      </div>
    </div>
  );
}

function TenantMaintenance({ t, profile, onSend }) {
  const [type, setType] = useState("Fontanería");
  const [desc, setDesc] = useState("");
  const types = ["Fontanería","Electricidad","Calefacción","Ventanas","Electrodomésticos","Otros"];
  const handle = () => { if (!desc.trim()) return; onSend(type, desc.trim()); setDesc(""); };

  return (
    <div>
      <div className="page-hd"><h2>{t.incidents}</h2></div>
      <div className="card">
        <div className="card-title">➕ {t.sendIncident}</div>
        <div className="fg"><label>{t.incidentType}</label>
          <select value={type} onChange={e => setType(e.target.value)}>
            {types.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="fg"><label>{t.description}</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="..." />
        </div>
        <button className="btn btn-s" onClick={handle}>📤 {t.sendIncident}</button>
      </div>
      <div className="card">
        <div className="card-title">🕐 {t.incidents}</div>
        {(profile?.maintenance||[]).length === 0 ? <p style={{color:"var(--warm)",fontSize:14}}>{t.noIncidents}</p> :
          (profile.maintenance||[]).map(m => (
            <div key={m.id} className="mi">
              <div className="mi-icon">{maintIcons[m.type]||"🔧"}</div>
              <div className="mi-info"><strong>{m.type}</strong><div className="meta">{m.date}</div><p>{m.desc}</p></div>
              <StatusBadge status={m.status} t={t} />
            </div>
          ))}
      </div>
    </div>
  );
}

// ── MODALS ────────────────────────────────────────────────────────────────────
function TenantProfileModal({ t, tenant, onToggle, onAddCost, onClose }) {
  const [costType, setCostType] = useState("💡 Electricidad");
  const [costAmt, setCostAmt] = useState("");
  const [costMonth, setCostMonth] = useState("Marzo 2025");
  const months = Object.keys(tenant?.payments || {});
  const icons = {"💡 Electricidad":"💡","💧 Agua":"💧","🌡️ Calefacción":"🌡️","🗑️ Basuras":"🗑️","Otro":"📋"};

  const handleAddCost = () => {
    if (!costAmt || !costMonth) return;
    const icon = icons[costType]||"📋";
    const name = costType.replace(/^\S+\s/,"");
    onAddCost(tenant.id, { icon, name, month: costMonth, amount: parseFloat(costAmt) });
    setCostAmt("");
  };

  if (!tenant) return null;
  return (
    <div className="modal">
      <div className="modal-hd"><h3>{tenant.name}</h3><button className="close-btn" onClick={onClose}>✕</button></div>
      <div className="prof-hd">
        <div className="av av-lg" style={{background:getColor(tenant.name)}}>{initials(tenant.name)}</div>
        <div className="prof-hd-info"><h3>{tenant.name}</h3><p>{tenant.unit} · {t.joinedSince} {tenant.joined}</p></div>
      </div>
      <div className="prof-grid">
        <div><div className="pf-lbl">{t.phone}</div><div className="pf-val">{tenant.phone}</div></div>
        <div><div className="pf-lbl">{t.email}</div><div className="pf-val">{tenant.email}</div></div>
        <div><div className="pf-lbl">{t.rent}</div><div className="pf-val">{tenant.rent}€/mes</div></div>
        <div><div className="pf-lbl">{t.joinedSince}</div><div className="pf-val">{tenant.joined}</div></div>
      </div>
      <hr />
      <div className="serif" style={{fontSize:16,marginBottom:12}}>{t.paymentHistory}</div>
      {months.map(m => {
        const p = (tenant.payments||{})[m];
        return (
          <div key={m} className="cr">
            <div className="cn">{m}</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span className="badge" style={p.paid?{background:"#E6F4ED",color:"#4A9B6F"}:{background:"#FDECEA",color:"#D94F3D"}}>
                {p.paid ? `✓ ${p.date}` : "✗ Pendiente"}
              </span>
              <button className="btn btn-o btn-sm" onClick={() => onToggle(tenant.id, m)}>
                {p.paid ? t.revert : t.markPaid}
              </button>
            </div>
          </div>
        );
      })}
      <hr />
      <div className="serif" style={{fontSize:16,marginBottom:12}}>➕ {t.addCost}</div>
      <div className="gr2">
        <div className="fg"><label>{t.concept}</label>
          <select value={costType} onChange={e => setCostType(e.target.value)}>
            {["💡 Electricidad","💧 Agua","🌡️ Calefacción","🗑️ Basuras","Otro"].map(o=><option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="fg"><label>{t.amount}</label><input type="number" value={costAmt} onChange={e => setCostAmt(e.target.value)} placeholder="0" /></div>
      </div>
      <div className="fg"><label>{t.month}</label><input value={costMonth} onChange={e => setCostMonth(e.target.value)} /></div>
      <button className="btn btn-p" onClick={handleAddCost}>➕ {t.addCost}</button>
    </div>
  );
}

function NewTenantModal({ t, onClose, onSave }) {
  const [form, setForm] = useState({ name:"", unit:"", phone:"", rent:"", email:"", password:"" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="modal">
      <div className="modal-hd"><h3>➕ {t.newTenant}</h3><button className="close-btn" onClick={onClose}>✕</button></div>
      <div className="fg"><label>{t.name}</label><input value={form.name} onChange={e => set("name",e.target.value)} /></div>
      <div className="gr2">
        <div className="fg"><label>{t.unit}</label><input value={form.unit} onChange={e => set("unit",e.target.value)} /></div>
        <div className="fg"><label>{t.phone}</label><input value={form.phone} onChange={e => set("phone",e.target.value)} /></div>
      </div>
      <div className="fg"><label>{t.rent}</label><input type="number" value={form.rent} onChange={e => set("rent",e.target.value)} /></div>
      <hr />
      <div className="fg"><label>{t.email} (acceso)</label><input type="email" value={form.email} onChange={e => set("email",e.target.value)} /></div>
      <div className="fg"><label>{t.password}</label><input type="password" value={form.password} onChange={e => set("password",e.target.value)} /></div>
      <button className="btn btn-p btn-full" onClick={() => onSave(form)}>{t.createAccess}</button>
    </div>
  );
}

function AddCostModal({ t, tenants, onSave, onClose }) {
  const [tid, setTid] = useState(tenants[0]?.id || "");
  const [costType, setCostType] = useState("💡 Electricidad");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState("Marzo 2025");
  const icons = {"💡 Electricidad":"💡","💧 Agua":"💧","🌡️ Calefacción":"🌡️","🗑️ Basuras":"🗑️","Otro":"📋"};
  const handle = () => {
    if (!amount) return;
    const icon = icons[costType]||"📋";
    const name = costType.replace(/^\S+\s/,"");
    onSave(tid, { icon, name, month, amount: parseFloat(amount) });
  };
  return (
    <div className="modal">
      <div className="modal-hd"><h3>➕ {t.addCost}</h3><button className="close-btn" onClick={onClose}>✕</button></div>
      <div className="fg"><label>{t.tenant}</label>
        <select value={tid} onChange={e => setTid(e.target.value)}>
          {tenants.map(ten => <option key={ten.id} value={ten.id}>{ten.name} ({ten.unit})</option>)}
        </select>
      </div>
      <div className="gr2">
        <div className="fg"><label>{t.concept}</label>
          <select value={costType} onChange={e => setCostType(e.target.value)}>
            {["💡 Electricidad","💧 Agua","🌡️ Calefacción","🗑️ Basuras","Otro"].map(o=><option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="fg"><label>{t.amount}</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></div>
      </div>
      <div className="fg"><label>{t.month}</label><input value={month} onChange={e => setMonth(e.target.value)} /></div>
      <button className="btn btn-p btn-full" onClick={handle}>{t.save}</button>
    </div>
  );
}

// ── STATUS BADGE ──────────────────────────────────────────────────────────────
function StatusBadge({ status, t }) {
  const map = {
    "Pendiente": { bg:"#FDECEA", color:"#D94F3D", label: t?.pending || "Pendiente" },
    "En revisión": { bg:"#FDF6E3", color:"#D4A853", label: t?.inReview || "En revisión" },
    "Resuelto": { bg:"#E6F4ED", color:"#4A9B6F", label: t?.resolved || "Resuelto" },
  };
  const s = map[status] || { bg:"#F0ECE8", color:"#8C7B6E", label: status };
  return <span className="badge" style={{ background:s.bg, color:s.color }}>{s.label}</span>;
}
