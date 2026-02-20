import { useState, useEffect, useCallback, createContext, useContext } from "react";

// ─── TRANSLATIONS ────────────────────────────────────────────────────────────
const LANGS = {
  es: {
    dir: "ltr", flag: "🇪🇸", name: "Español",
    appName: ["Mi", "Alquiler"],
    loginSub: "Gestión de propiedades · Acceso rápido",
    loginOwnerTitle: "Propietario",
    loginOwnerDesc: "Gestiona inquilinos, finanzas y mantenimiento",
    loginOwnerBtn: "Entrar como propietario",
    loginTenantTitle: "Inquilino",
    loginTenantDesc: "Consulta tu estado de pago y envía incidencias",
    loginTenantBtn: "Entrar como inquilino",
    saving: "Guardando cambios…",
    nav: { dashboard: "Resumen", tenants: "Inquilinos", finances: "Finanzas", maintenance: "Mantenimiento", tHome: "Mi Piso", tCosts: "Mis Costes", tMaint: "Incidencias" },
    roles: { owner: "Propietario", tenant: "Inquilino" },
    dashboard: { title: "Buenos días", subtitle: "Resumen de tu propiedad", payments: "Pagos", recent: "Incidencias recientes", noMaint: "No hay incidencias 🎉" },
    stats: { monthly: "Ingreso mensual", totalRent: "Alquiler total", received: "Pagos recibidos", tenants: "Inquilinos", active: "Activos", maintenance: "Mantenimiento", pending: "Pendientes" },
    tenants: { title: "Inquilinos", active: "inquilinos activos", since: "Desde", paidMarch: "✓ Marzo pagado", pendingMarch: "✗ Marzo pendiente" },
    profile: { phone: "Teléfono", email: "Email", rent: "Alquiler mensual", since: "Inquilino desde", history: "Historial de pagos", addCost: "Añadir coste", concept: "Concepto", amount: "Importe (€)", month: "Mes", save: "➕ Añadir coste", revert: "Revertir", markPaid: "Marcar pagado" },
    finances: { title: "Finanzas", sub: "Registro de pagos y costes", rentTable: "💶 Alquileres por mes", costTable: "⚡ Costes por inquilino", addCost: "➕ Añadir coste", tenant: "Inquilino", unit: "Piso", rentCol: "Alquiler", total: "Total" },
    maint: { title: "Mantenimiento", pending: "pendientes", total: "en total", noIssues: "🎉 Sin incidencias activas", statusLabel: "Estado" },
    statuses: { Pendiente: "Pendiente", "En revisión": "En revisión", Resuelto: "Resuelto" },
    statusOptions: ["Pendiente", "En revisión", "Resuelto"],
    tHome: { hello: "Hola", paid: "Alquiler pagado", unpaid: "Alquiler pendiente", registeredOn: "Registrado el", dueThis: "Vence este mes", history: "📋 Historial de pagos", info: "ℹ️ Mi información", unitLabel: "Piso", rentLabel: "Alquiler", sinceLabel: "Desde", ownerLabel: "Propietario" },
    tCosts: { title: "Mis Costes", sub: "Suministros registrados por el propietario", totalCosts: "Total costes", fixedRent: "Alquiler fijo", breakdown: "⚡ Desglose de costes", noCosts: "Sin costes registrados", totalLabel: "Total" },
    tMaint: { title: "Incidencias", sub: "Comunica cualquier problema al propietario", newIssue: "➕ Nueva incidencia", typeLabel: "Tipo de problema", descLabel: "Descripción", descPlaceholder: "Describe el problema con detalle…", send: "📤 Enviar al propietario", history: "🕐 Mis incidencias", noSent: "No has enviado ninguna incidencia" },
    costTypes: ["💡 Electricidad", "💧 Agua", "🌡️ Calefacción", "🗑️ Basuras", "Otro"],
    maintTypes: ["Fontanería", "Electricidad", "Calefacción / A/C", "Ventanas / Puertas", "Humedades", "Electrodomésticos", "Otros"],
    addCostModal: { title: "Añadir coste", tenantLabel: "Inquilino", save: "Guardar" },
    toast: { payRegistered: "✅ Pago registrado", payReverted: "❌ Pago revertido", costSaved: "✅ Coste guardado", statusUpdated: "✅ Estado actualizado", issueSent: "✅ Incidencia enviada al propietario" },
    paid: "✓ Pagado", unpaid: "✗ Pendiente", paidShort: "✓ Pag.", pendingShort: "✗ Pend.", logout: "Salir",
    langLabel: "Idioma",
  },
  en: {
    dir: "ltr", flag: "🇬🇧", name: "English",
    appName: ["My", "Rental"],
    loginSub: "Property management · Quick access",
    loginOwnerTitle: "Owner",
    loginOwnerDesc: "Manage tenants, finances and maintenance",
    loginOwnerBtn: "Enter as owner",
    loginTenantTitle: "Tenant",
    loginTenantDesc: "Check your payment status and send reports",
    loginTenantBtn: "Enter as tenant",
    saving: "Saving changes…",
    nav: { dashboard: "Overview", tenants: "Tenants", finances: "Finances", maintenance: "Maintenance", tHome: "My Flat", tCosts: "My Costs", tMaint: "Issues" },
    roles: { owner: "Owner", tenant: "Tenant" },
    dashboard: { title: "Good morning", subtitle: "Property overview", payments: "Payments", recent: "Recent issues", noMaint: "No issues 🎉" },
    stats: { monthly: "Monthly income", totalRent: "Total rent", received: "Payments received", tenants: "Tenants", active: "Active", maintenance: "Maintenance", pending: "Pending" },
    tenants: { title: "Tenants", active: "active tenants", since: "Since", paidMarch: "✓ March paid", pendingMarch: "✗ March pending" },
    profile: { phone: "Phone", email: "Email", rent: "Monthly rent", since: "Tenant since", history: "Payment history", addCost: "Add cost", concept: "Concept", amount: "Amount (€)", month: "Month", save: "➕ Add cost", revert: "Revert", markPaid: "Mark as paid" },
    finances: { title: "Finances", sub: "Payment and cost records", rentTable: "💶 Rent by month", costTable: "⚡ Costs by tenant", addCost: "➕ Add cost", tenant: "Tenant", unit: "Unit", rentCol: "Rent", total: "Total" },
    maint: { title: "Maintenance", pending: "pending", total: "total", noIssues: "🎉 No active issues", statusLabel: "Status" },
    statuses: { Pendiente: "Pending", "En revisión": "In review", Resuelto: "Resolved" },
    statusOptions: ["Pendiente", "En revisión", "Resuelto"],
    tHome: { hello: "Hello", paid: "Rent paid", unpaid: "Rent pending", registeredOn: "Registered on", dueThis: "Due this month", history: "📋 Payment history", info: "ℹ️ My information", unitLabel: "Unit", rentLabel: "Rent", sinceLabel: "Since", ownerLabel: "Owner" },
    tCosts: { title: "My Costs", sub: "Costs added by the owner", totalCosts: "Total costs", fixedRent: "Fixed rent", breakdown: "⚡ Cost breakdown", noCosts: "No costs registered", totalLabel: "Total" },
    tMaint: { title: "Issues", sub: "Report any problem to the owner", newIssue: "➕ New issue", typeLabel: "Problem type", descLabel: "Description", descPlaceholder: "Describe the problem in detail…", send: "📤 Send to owner", history: "🕐 My issues", noSent: "You haven't sent any issues" },
    costTypes: ["💡 Electricity", "💧 Water", "🌡️ Heating", "🗑️ Waste", "Other"],
    maintTypes: ["Plumbing", "Electricity", "Heating / A/C", "Windows / Doors", "Dampness", "Appliances", "Other"],
    addCostModal: { title: "Add cost", tenantLabel: "Tenant", save: "Save" },
    toast: { payRegistered: "✅ Payment registered", payReverted: "❌ Payment reverted", costSaved: "✅ Cost saved", statusUpdated: "✅ Status updated", issueSent: "✅ Issue sent to owner" },
    paid: "✓ Paid", unpaid: "✗ Pending", paidShort: "✓ Paid", pendingShort: "✗ Pend.", logout: "Log out",
    langLabel: "Language",
  },
  ar: {
    dir: "rtl", flag: "🇸🇦", name: "العربية",
    appName: ["إيجاري", ""],
    loginSub: "إدارة العقارات · دخول سريع",
    loginOwnerTitle: "المالك",
    loginOwnerDesc: "إدارة المستأجرين والتمويل والصيانة",
    loginOwnerBtn: "الدخول كمالك",
    loginTenantTitle: "المستأجر",
    loginTenantDesc: "تحقق من حالة دفعك وأرسل البلاغات",
    loginTenantBtn: "الدخول كمستأجر",
    saving: "جارٍ الحفظ…",
    nav: { dashboard: "نظرة عامة", tenants: "المستأجرون", finances: "المالية", maintenance: "الصيانة", tHome: "شقتي", tCosts: "تكاليفي", tMaint: "البلاغات" },
    roles: { owner: "المالك", tenant: "المستأجر" },
    dashboard: { title: "صباح الخير", subtitle: "ملخص العقار", payments: "المدفوعات", recent: "آخر البلاغات", noMaint: "لا توجد بلاغات 🎉" },
    stats: { monthly: "الدخل الشهري", totalRent: "إجمالي الإيجار", received: "مدفوعات مستلمة", tenants: "المستأجرون", active: "نشطون", maintenance: "الصيانة", pending: "معلّقة" },
    tenants: { title: "المستأجرون", active: "مستأجر نشط", since: "منذ", paidMarch: "✓ مارس مدفوع", pendingMarch: "✗ مارس معلّق" },
    profile: { phone: "الهاتف", email: "البريد الإلكتروني", rent: "الإيجار الشهري", since: "مستأجر منذ", history: "سجل المدفوعات", addCost: "إضافة تكلفة", concept: "النوع", amount: "المبلغ (€)", month: "الشهر", save: "➕ إضافة تكلفة", revert: "التراجع", markPaid: "تعيين مدفوع" },
    finances: { title: "المالية", sub: "سجل المدفوعات والتكاليف", rentTable: "💶 الإيجار حسب الشهر", costTable: "⚡ التكاليف حسب المستأجر", addCost: "➕ إضافة تكلفة", tenant: "المستأجر", unit: "الوحدة", rentCol: "الإيجار", total: "المجموع" },
    maint: { title: "الصيانة", pending: "معلّقة", total: "إجمالي", noIssues: "🎉 لا توجد بلاغات نشطة", statusLabel: "الحالة" },
    statuses: { Pendiente: "معلّق", "En revisión": "قيد المراجعة", Resuelto: "تم الحل" },
    statusOptions: ["Pendiente", "En revisión", "Resuelto"],
    tHome: { hello: "مرحباً", paid: "الإيجار مدفوع", unpaid: "الإيجار معلّق", registeredOn: "مسجّل في", dueThis: "مستحق هذا الشهر", history: "📋 سجل المدفوعات", info: "ℹ️ معلوماتي", unitLabel: "الوحدة", rentLabel: "الإيجار", sinceLabel: "منذ", ownerLabel: "المالك" },
    tCosts: { title: "تكاليفي", sub: "التكاليف المضافة من قِبل المالك", totalCosts: "إجمالي التكاليف", fixedRent: "إيجار ثابت", breakdown: "⚡ تفصيل التكاليف", noCosts: "لا توجد تكاليف مسجّلة", totalLabel: "المجموع" },
    tMaint: { title: "البلاغات", sub: "أبلغ المالك عن أي مشكلة", newIssue: "➕ بلاغ جديد", typeLabel: "نوع المشكلة", descLabel: "الوصف", descPlaceholder: "صف المشكلة بالتفصيل…", send: "📤 إرسال للمالك", history: "🕐 بلاغاتي", noSent: "لم ترسل أي بلاغات" },
    costTypes: ["💡 كهرباء", "💧 ماء", "🌡️ تدفئة", "🗑️ نفايات", "أخرى"],
    maintTypes: ["سباكة", "كهرباء", "تدفئة / تكييف", "نوافذ / أبواب", "رطوبة", "أجهزة", "أخرى"],
    addCostModal: { title: "إضافة تكلفة", tenantLabel: "المستأجر", save: "حفظ" },
    toast: { payRegistered: "✅ تم تسجيل الدفع", payReverted: "❌ تم التراجع عن الدفع", costSaved: "✅ تم حفظ التكلفة", statusUpdated: "✅ تم تحديث الحالة", issueSent: "✅ تم إرسال البلاغ للمالك" },
    paid: "✓ مدفوع", unpaid: "✗ معلّق", paidShort: "✓ مدفوع", pendingShort: "✗ معلّق", logout: "خروج",
    langLabel: "اللغة",
  }
};

// ─── CONTEXT ─────────────────────────────────────────────────────────────────
const LangCtx = createContext({ lang: "es", t: LANGS.es });
const useLang = () => useContext(LangCtx);

// ─── INITIAL DATA ────────────────────────────────────────────────────────────
const INITIAL_DATA = {
  owner: { name: "Carlos Moreno", phone: "+34 611 222 333", email: "carlos@email.com" },
  tenants: [
    { id: 1, name: "Ana García", unit: "Piso 1A", avatar: "AG", phone: "+34 622 111 444", email: "ana@email.com", joined: "Enero 2024", rent: 750,
      payments: { "Enero 2025": { paid: true, date: "03/01/2025" }, "Febrero 2025": { paid: true, date: "02/02/2025" }, "Marzo 2025": { paid: false, date: null } },
      costs: [{ id: 1, icon: "💡", name: "Electricidad", month: "Febrero 2025", amount: 68 }, { id: 2, icon: "💧", name: "Agua", month: "Febrero 2025", amount: 22 }],
      maintenance: [{ id: 1, type: "Fontanería", date: "12/03/2025", status: "Pendiente", desc: "La llave del baño gotea constantemente." }]
    },
    { id: 2, name: "Luis Pérez", unit: "Piso 2B", avatar: "LP", phone: "+34 633 555 777", email: "luis@email.com", joined: "Marzo 2023", rent: 850,
      payments: { "Enero 2025": { paid: true, date: "05/01/2025" }, "Febrero 2025": { paid: true, date: "04/02/2025" }, "Marzo 2025": { paid: true, date: "01/03/2025" } },
      costs: [{ id: 3, icon: "💡", name: "Electricidad", month: "Febrero 2025", amount: 55 }, { id: 4, icon: "💧", name: "Agua", month: "Febrero 2025", amount: 18 }],
      maintenance: []
    },
    { id: 3, name: "Sara Jiménez", unit: "Piso 3C", avatar: "SJ", phone: "+34 644 888 000", email: "sara@email.com", joined: "Junio 2024", rent: 680,
      payments: { "Enero 2025": { paid: true, date: "02/01/2025" }, "Febrero 2025": { paid: false, date: null }, "Marzo 2025": { paid: false, date: null } },
      costs: [{ id: 5, icon: "💡", name: "Electricidad", month: "Febrero 2025", amount: 72 }, { id: 6, icon: "💧", name: "Agua", month: "Febrero 2025", amount: 25 }],
      maintenance: [{ id: 2, type: "Electricidad", date: "08/03/2025", status: "En revisión", desc: "El enchufe del salón no funciona." }]
    }
  ]
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const avatarColors = ["#C4622D", "#7A9E7E", "#D4A853", "#6B8CBA", "#9B6BB5"];
const getColor = (id) => avatarColors[(id - 1) % avatarColors.length];
const maintIcon = (type) => ({ "Fontanería": "🚿", "Plumbing": "🚿", "سباكة": "🚿", "Electricidad": "⚡", "Electricity": "⚡", "كهرباء": "⚡", "Calefacción / A/C": "🌡️", "Heating / A/C": "🌡️", "تدفئة / تكييف": "🌡️", "Ventanas / Puertas": "🪟", "Windows / Doors": "🪟", "نوافذ / أبواب": "🪟", "Humedades": "💧", "Dampness": "💧", "رطوبة": "💧", "Electrodomésticos": "🔌", "Appliances": "🔌", "أجهزة": "🔌" }[type] || "🔧");
const statusColor = (s) => ({ "Pendiente": { bg: "#FDECEA", color: "#D94F3D" }, "En revisión": { bg: "#FDF6E3", color: "#D4A853" }, "Resuelto": { bg: "#E6F4ED", color: "#4A9B6F" } }[s] || { bg: "#F0ECE8", color: "#8C7B6E" });
const today = () => new Date().toLocaleDateString("es-ES");
const STORAGE_KEY = "rental-app-data-v3";
const LANG_KEY = "rental-app-lang";

async function loadData() {
  try { const r = await window.storage.get(STORAGE_KEY); if (r?.value) return JSON.parse(r.value); } catch (e) {}
  return null;
}
async function saveData(data) { try { await window.storage.set(STORAGE_KEY, JSON.stringify(data)); } catch (e) {} }
async function loadLang() {
  try { const r = await window.storage.get(LANG_KEY); if (r?.value) return r.value; } catch (e) {}
  return "es";
}
async function saveLang(lang) { try { await window.storage.set(LANG_KEY, lang); } catch (e) {} }

// ─── STYLES ──────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&family=Noto+Sans+Arabic:wght@400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{--cream:#F7F3EE;--dark:#1A1612;--terra:#C4622D;--terra-l:#E8845A;--sage:#7A9E7E;--sage-l:#A8C5AB;--gold:#D4A853;--warm:#8C7B6E;--bg:#FFFCF9;--border:#E8DDD4;--red:#D94F3D;--green:#4A9B6F}
  body{font-family:'DM Sans',sans-serif;background:var(--cream);color:var(--dark)}
  [dir="rtl"]{font-family:'Noto Sans Arabic','DM Sans',sans-serif}
  .serif{font-family:'DM Serif Display',serif}
  /* LOGIN */
  .login-wrap{min-height:100vh;background:var(--dark);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px}
  .login-title{font-family:'DM Serif Display',serif;font-size:54px;color:var(--cream);letter-spacing:-1px;text-align:center;line-height:1}
  .login-title em{color:var(--terra-l);font-style:italic}
  .login-sub{color:var(--warm);font-size:13px;text-transform:uppercase;letter-spacing:1px;text-align:center;margin-top:10px;margin-bottom:40px}
  .login-cards{display:flex;gap:20px;flex-wrap:wrap;justify-content:center}
  .login-card{background:#2A2420;border:1px solid #3A3028;border-radius:20px;padding:36px 28px;width:230px;text-align:center;transition:all .25s}
  .login-card:hover{border-color:var(--terra);transform:translateY(-4px)}
  .login-card .ico{font-size:42px;margin-bottom:14px}
  .login-card h3{font-family:'DM Serif Display',serif;font-size:22px;color:var(--cream);margin-bottom:8px}
  .login-card p{color:var(--warm);font-size:13px;line-height:1.5;margin-bottom:20px}
  .lbtn{width:100%;padding:11px;border-radius:10px;border:none;cursor:pointer;font-family:'DM Sans','Noto Sans Arabic',sans-serif;font-size:13px;font-weight:600;transition:all .2s}
  .lbtn-o{background:var(--terra);color:#fff}.lbtn-o:hover{background:var(--terra-l)}
  .lbtn-t{background:var(--sage);color:#fff}.lbtn-t:hover{background:var(--sage-l)}
  /* LANG PICKER */
  .lang-bar{display:flex;gap:6px;margin-bottom:28px;justify-content:center}
  .lang-btn{background:#2A2420;border:1.5px solid #3A3028;border-radius:20px;padding:6px 14px;color:var(--warm);font-size:13px;cursor:pointer;transition:all .2s;font-family:'DM Sans','Noto Sans Arabic',sans-serif}
  .lang-btn:hover{border-color:var(--terra-l);color:var(--cream)}
  .lang-btn.active{background:var(--terra);border-color:var(--terra);color:#fff}
  .lang-btn-inline{background:#2A2420;border:1.5px solid #3A3028;border-radius:20px;padding:4px 10px;color:var(--warm);font-size:12px;cursor:pointer;transition:all .2s;font-family:'DM Sans','Noto Sans Arabic',sans-serif}
  .lang-btn-inline:hover{border-color:var(--terra-l);color:var(--cream)}
  .lang-btn-inline.active{background:var(--terra);border-color:var(--terra);color:#fff}
  /* LAYOUT */
  .app{display:flex;min-height:100vh}
  .sidebar{width:220px;background:var(--dark);display:flex;flex-direction:column;padding:28px 16px;position:fixed;top:0;bottom:0;z-index:50}
  [dir="ltr"] .sidebar{left:0}
  [dir="rtl"] .sidebar{right:0}
  .s-logo{font-family:'DM Serif Display',serif;font-size:22px;color:var(--cream);padding:0 10px}
  .s-logo em{color:var(--terra-l);font-style:italic}
  .s-role{font-size:11px;color:var(--warm);text-transform:uppercase;letter-spacing:1px;padding:0 10px;margin:4px 0 20px}
  .s-nav{flex:1;display:flex;flex-direction:column;gap:3px}
  .nav-item{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:10px;cursor:pointer;color:var(--warm);font-size:14px;font-weight:500;transition:all .2s;border:none;background:none;width:100%;font-family:'DM Sans','Noto Sans Arabic',sans-serif}
  [dir="ltr"] .nav-item{text-align:left}
  [dir="rtl"] .nav-item{text-align:right;flex-direction:row-reverse}
  .nav-item:hover{background:#2A2420;color:var(--cream)}
  .nav-item.active-o{background:var(--terra);color:#fff}
  .nav-item.active-t{background:var(--sage);color:#fff}
  .s-lang{padding:0 4px;margin-bottom:10px;display:flex;gap:4px;flex-wrap:wrap}
  .s-footer{border-top:1px solid #2A2420;padding-top:14px;margin-top:auto;display:flex;align-items:center;gap:10px}
  [dir="rtl"] .s-footer{flex-direction:row-reverse}
  .s-user-info{flex:1;min-width:0}
  .s-user-info strong{font-size:13px;color:var(--cream);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .s-user-info span{font-size:11px;color:var(--warm)}
  .logout{background:none;border:none;color:var(--warm);cursor:pointer;font-size:16px;padding:4px;transition:color .2s}
  .logout:hover{color:var(--cream)}
  /* CONTENT */
  .content{padding:40px;flex:1;min-height:100vh}
  [dir="ltr"] .content{margin-left:220px}
  [dir="rtl"] .content{margin-right:220px}
  /* AVATAR */
  .av{border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;color:#fff;flex-shrink:0}
  .av-sm{width:34px;height:34px;font-size:13px}
  .av-md{width:48px;height:48px;font-size:18px}
  .av-lg{width:72px;height:72px;font-size:28px;font-family:'DM Serif Display',serif}
  /* PAGE */
  .page-hd{margin-bottom:32px;display:flex;justify-content:space-between;align-items:flex-start}
  .page-hd h2{font-family:'DM Serif Display',serif;font-size:32px;letter-spacing:-0.5px}
  .page-hd p{color:var(--warm);font-size:14px;margin-top:4px}
  /* STATS */
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:16px;margin-bottom:28px}
  .stat{background:var(--bg);border:1px solid var(--border);border-radius:16px;padding:22px 20px}
  .stat .lbl{font-size:11px;color:var(--warm);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px}
  .stat .val{font-family:'DM Serif Display',serif;font-size:30px;line-height:1}
  .stat .sub{font-size:12px;color:var(--warm);margin-top:6px}
  .stat.tl{border-left:4px solid var(--terra)}.stat.sl{border-left:4px solid var(--sage)}.stat.gl{border-left:4px solid var(--gold)}.stat.rl{border-left:4px solid var(--red)}
  [dir="rtl"] .stat.tl{border-left:none;border-right:4px solid var(--terra)}
  [dir="rtl"] .stat.sl{border-left:none;border-right:4px solid var(--sage)}
  [dir="rtl"] .stat.gl{border-left:none;border-right:4px solid var(--gold)}
  [dir="rtl"] .stat.rl{border-left:none;border-right:4px solid var(--red)}
  /* CARD */
  .card{background:var(--bg);border:1px solid var(--border);border-radius:16px;padding:24px;margin-bottom:20px}
  .card-title{font-family:'DM Serif Display',serif;font-size:18px;margin-bottom:18px;display:flex;align-items:center;gap:8px}
  /* GRID */
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
  @media(max-width:900px){.g2{grid-template-columns:1fr}.content{padding:24px 16px}}
  /* TENANT ROW */
  .t-row{display:flex;align-items:center;gap:14px;padding:16px;border-radius:12px;border:1px solid var(--border);background:#fff;cursor:pointer;transition:box-shadow .2s;margin-bottom:10px}
  [dir="rtl"] .t-row{flex-direction:row-reverse}
  .t-row:hover{box-shadow:0 4px 16px rgba(0,0,0,.07)}
  .t-info{flex:1}
  .t-info strong{font-size:15px;display:block}
  .t-info span{font-size:13px;color:var(--warm)}
  /* BADGE */
  .badge{font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
  /* MAINT */
  .mi{display:flex;align-items:flex-start;gap:14px;padding:16px;border-radius:12px;border:1px solid var(--border);background:#fff;margin-bottom:10px}
  [dir="rtl"] .mi{flex-direction:row-reverse}
  .mi-icon{width:40px;height:40px;border-radius:10px;background:#FDF3EE;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
  .mi-info{flex:1}
  .mi-info strong{font-size:14px;display:block}
  .mi-info .meta{font-size:12px;color:var(--warm);margin-top:3px}
  .mi-info p{font-size:13px;color:#555;margin-top:6px;line-height:1.5}
  /* TABLE */
  .tbl-wrap{overflow-x:auto}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--warm);padding:0 14px 12px;border-bottom:1px solid var(--border);font-weight:600;white-space:nowrap}
  [dir="rtl"] th{text-align:right}
  td{padding:13px 14px;border-bottom:1px solid var(--border);font-size:14px}
  tr:last-child td{border-bottom:none}
  tbody tr:hover td{background:var(--cream)}
  /* BUTTONS */
  .btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;transition:all .2s;font-family:'DM Sans','Noto Sans Arabic',sans-serif}
  .btn-p{background:var(--terra);color:#fff}.btn-p:hover{background:var(--terra-l)}
  .btn-s{background:var(--sage);color:#fff}.btn-s:hover{background:var(--sage-l)}
  .btn-o{background:transparent;border:1.5px solid var(--border);color:var(--dark)}.btn-o:hover{border-color:var(--terra);color:var(--terra)}
  .btn-sm{padding:5px 10px;font-size:12px}
  /* FORM */
  .fg{margin-bottom:16px}
  .fg label{font-size:12px;font-weight:600;color:var(--warm);text-transform:uppercase;letter-spacing:.7px;display:block;margin-bottom:6px}
  .fg input,.fg select,.fg textarea{width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;font-family:'DM Sans','Noto Sans Arabic',sans-serif;font-size:14px;background:#fff;color:var(--dark);transition:border-color .2s;outline:none}
  .fg input:focus,.fg select:focus,.fg textarea:focus{border-color:var(--terra)}
  .fg textarea{resize:vertical;min-height:80px}
  .gr2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  /* PAY STATUS */
  .pay-status{border-radius:20px;padding:28px;text-align:center;margin-bottom:20px}
  .pay-status h3{font-family:'DM Serif Display',serif;font-size:24px;margin-bottom:4px}
  .pay-status .amount{font-family:'DM Serif Display',serif;font-size:40px;margin:14px 0;color:var(--dark)}
  .pay-status p{font-size:14px;color:var(--warm)}
  .sico{font-size:48px;margin-bottom:10px}
  /* COST ROW */
  .cr{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid var(--border)}
  [dir="rtl"] .cr{flex-direction:row-reverse}
  .cr:last-child{border-bottom:none}
  .cr .cn{font-size:14px;display:flex;align-items:center;gap:8px}
  [dir="rtl"] .cr .cn{flex-direction:row-reverse}
  .cr .ca{font-weight:600;font-size:15px}
  /* PROFILE */
  .prof-hd{display:flex;align-items:center;gap:18px;margin-bottom:24px}
  [dir="rtl"] .prof-hd{flex-direction:row-reverse}
  .prof-hd-info h3{font-family:'DM Serif Display',serif;font-size:22px}
  .prof-hd-info p{color:var(--warm);font-size:14px}
  .prof-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .pf-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--warm);font-weight:600;margin-bottom:3px}
  .pf-val{font-size:15px;font-weight:500}
  hr{border:none;border-top:1px solid var(--border);margin:18px 0}
  /* MODAL */
  .overlay{position:fixed;inset:0;background:rgba(20,15,10,.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px}
  .modal{background:var(--bg);border-radius:20px;padding:32px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto}
  .modal-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
  [dir="rtl"] .modal-hd{flex-direction:row-reverse}
  .modal-hd h3{font-family:'DM Serif Display',serif;font-size:22px}
  .close-btn{background:none;border:none;font-size:20px;cursor:pointer;color:var(--warm);padding:4px}
  .close-btn:hover{color:var(--dark)}
  /* TOAST */
  .toast{position:fixed;bottom:30px;background:var(--dark);color:var(--cream);padding:14px 20px;border-radius:12px;font-size:14px;z-index:9999;animation:slideUp .3s ease;box-shadow:0 8px 24px rgba(0,0,0,.2)}
  [dir="ltr"] .toast{right:30px}
  [dir="rtl"] .toast{left:30px}
  @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .fade{animation:fadeIn .3s ease}
  .saving{font-size:11px;color:var(--warm);display:flex;align-items:center;gap:6px;margin-bottom:16px}
  .saving::before{content:'';width:8px;height:8px;border-radius:50%;background:var(--sage);display:inline-block}
  select.status-sel{font-size:12px;padding:4px 8px;border:1px solid var(--border);border-radius:8px;background:#fff;cursor:pointer;font-family:'DM Sans','Noto Sans Arabic',sans-serif}
`;

// ─── LANG PICKER ─────────────────────────────────────────────────────────────
function LangPicker({ current, onChange, inline }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: inline ? "flex-start" : "center" }}>
      {Object.entries(LANGS).map(([code, l]) => (
        <button key={code} className={inline ? `lang-btn-inline ${current === code ? "active" : ""}` : `lang-btn ${current === code ? "active" : ""}`}
          onClick={() => onChange(code)}>
          {l.flag} {l.name}
        </button>
      ))}
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [lang, setLang] = useState("es");
  const [role, setRole] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const TENANT_ID = 1;
  const t = LANGS[lang];

  useEffect(() => {
    Promise.all([loadData(), loadLang()]).then(([saved, savedLang]) => {
      setDb(saved || INITIAL_DATA);
      setLang(savedLang || "es");
      setLoading(false);
    });
  }, []);

  // Apply dir to document
  useEffect(() => {
    document.documentElement.dir = t.dir;
  }, [lang, t.dir]);

  const changeLang = (code) => { setLang(code); saveLang(code); };

  const persist = useCallback(async (newDb) => {
    setDb(newDb); setSaving(true);
    await saveData(newDb); setSaving(false);
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  if (loading) return (
    <>
      <style>{css}</style>
      <div style={{ minHeight: "100vh", background: "#1A1612", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#8C7B6E", fontFamily: "'DM Sans',sans-serif", fontSize: 14 }}>Cargando…</p>
      </div>
    </>
  );

  // ── MUTATIONS
  const togglePayment = (tenantId, month) => {
    const newDb = JSON.parse(JSON.stringify(db));
    const tn = newDb.tenants.find(x => x.id === tenantId);
    const p = tn.payments[month]; p.paid = !p.paid; p.date = p.paid ? today() : null;
    persist(newDb);
    showToast(p.paid ? t.toast.payRegistered : t.toast.payReverted);
    if (modal?.type === "tenant-profile") setModal({ type: "tenant-profile", data: { id: tenantId } });
  };

  const addCost = (tenantId, icon, name, month, amount) => {
    const newDb = JSON.parse(JSON.stringify(db));
    const tn = newDb.tenants.find(x => x.id === tenantId);
    const newId = Math.max(0, ...newDb.tenants.flatMap(x => x.costs.map(c => c.id))) + 1;
    tn.costs.push({ id: newId, icon, name, month, amount });
    persist(newDb); showToast(t.toast.costSaved);
  };

  const changeStatus = (tenantId, maintId, status) => {
    const newDb = JSON.parse(JSON.stringify(db));
    newDb.tenants.find(x => x.id === tenantId).maintenance.find(m => m.id === maintId).status = status;
    persist(newDb); showToast(t.toast.statusUpdated);
  };

  const sendMaintenance = (tenantId, type, desc) => {
    const newDb = JSON.parse(JSON.stringify(db));
    const tn = newDb.tenants.find(x => x.id === tenantId);
    const newId = Math.max(0, ...newDb.tenants.flatMap(x => x.maintenance.map(m => m.id))) + 1;
    tn.maintenance.push({ id: newId, type, date: today(), status: "Pendiente", desc });
    persist(newDb); showToast(t.toast.issueSent);
  };

  // ── LOGIN
  if (!role) return (
    <LangCtx.Provider value={{ lang, t }}>
      <style>{css}</style>
      <div className="login-wrap" dir={t.dir}>
        <h1 className="login-title">{t.appName[0]}<em>{t.appName[1]}</em></h1>
        <p className="login-sub">{t.loginSub}</p>
        <div className="lang-bar">
          <LangPicker current={lang} onChange={changeLang} />
        </div>
        <div className="login-cards">
          <div className="login-card">
            <div className="ico">🏠</div>
            <h3>{t.loginOwnerTitle}</h3>
            <p>{t.loginOwnerDesc}</p>
            <button className="lbtn lbtn-o" onClick={() => { setRole("owner"); setPage("dashboard"); }}>{t.loginOwnerBtn}</button>
          </div>
          <div className="login-card">
            <div className="ico">🔑</div>
            <h3>{t.loginTenantTitle}</h3>
            <p>{t.loginTenantDesc}</p>
            <button className="lbtn lbtn-t" onClick={() => { setRole("tenant"); setPage("t-home"); }}>{t.loginTenantBtn}</button>
          </div>
        </div>
      </div>
    </LangCtx.Provider>
  );

  const tenant = db.tenants.find(x => x.id === TENANT_ID);
  const ownerNav = [
    { id: "dashboard", icon: "📊", label: t.nav.dashboard },
    { id: "tenants", icon: "👥", label: t.nav.tenants },
    { id: "finances", icon: "💰", label: t.nav.finances },
    { id: "maintenance", icon: "🔧", label: t.nav.maintenance },
  ];
  const tenantNav = [
    { id: "t-home", icon: "🏠", label: t.nav.tHome },
    { id: "t-costs", icon: "⚡", label: t.nav.tCosts },
    { id: "t-maint", icon: "🔧", label: t.nav.tMaint },
  ];
  const nav = role === "owner" ? ownerNav : tenantNav;
  const activeClass = (id) => id === page ? (role === "owner" ? "nav-item active-o" : "nav-item active-t") : "nav-item";

  const renderPage = () => {
    if (role === "owner") {
      if (page === "dashboard") return <Dashboard db={db} t={t} onNav={setPage} onToggle={togglePayment} />;
      if (page === "tenants") return <Tenants db={db} t={t} onSelect={id => setModal({ type: "tenant-profile", data: { id } })} />;
      if (page === "finances") return <Finances db={db} t={t} onToggle={togglePayment} onAddCost={() => setModal({ type: "add-cost", data: {} })} />;
      if (page === "maintenance") return <Maintenance db={db} t={t} onStatus={changeStatus} />;
    } else {
      if (page === "t-home") return <TenantHome tenant={tenant} t={t} />;
      if (page === "t-costs") return <TenantCosts tenant={tenant} t={t} />;
      if (page === "t-maint") return <TenantMaintenance tenant={tenant} t={t} onSend={sendMaintenance} />;
    }
  };

  const renderModal = () => {
    if (!modal) return null;
    if (modal.type === "tenant-profile") {
      const tn = db.tenants.find(x => x.id === modal.data.id);
      return <TenantProfileModal t={t} tn={tn} onToggle={togglePayment} onAddCost={addCost} onClose={() => setModal(null)} />;
    }
    if (modal.type === "add-cost") {
      return <AddCostModal t={t} tenants={db.tenants} onSave={addCost} onClose={() => setModal(null)} />;
    }
  };

  return (
    <LangCtx.Provider value={{ lang, t }}>
      <style>{css}</style>
      <div className="app" dir={t.dir}>
        <aside className="sidebar">
          <div className="s-logo">{t.appName[0]}<em>{t.appName[1]}</em></div>
          <div className="s-role">{role === "owner" ? t.roles.owner : t.roles.tenant}</div>
          <nav className="s-nav">
            {nav.map(item => (
              <button key={item.id} className={activeClass(item.id)} onClick={() => setPage(item.id)}>
                <span>{item.icon}</span> {item.label}
              </button>
            ))}
          </nav>
          <div className="s-lang">
            <LangPicker current={lang} onChange={changeLang} inline />
          </div>
          <div className="s-footer">
            <div className="av av-sm" style={{ background: role === "owner" ? "#C4622D" : getColor(TENANT_ID) }}>
              {role === "owner" ? "CM" : tenant.avatar}
            </div>
            <div className="s-user-info">
              <strong>{role === "owner" ? db.owner.name : tenant.name}</strong>
              <span>{role === "owner" ? t.roles.owner : tenant.unit}</span>
            </div>
            <button className="logout" onClick={() => setRole(null)} title={t.logout}>↩</button>
          </div>
        </aside>

        <main className="content fade" key={page}>
          {saving && <div className="saving">{t.saving}</div>}
          {renderPage()}
        </main>
      </div>

      {modal && (
        <div className="overlay" dir={t.dir} onClick={e => e.target === e.currentTarget && setModal(null)}>
          {renderModal()}
        </div>
      )}

      {toast && <div className="toast" dir={t.dir}>{toast}</div>}
    </LangCtx.Provider>
  );
}

// ─── OWNER PAGES ──────────────────────────────────────────────────────────────
function Dashboard({ db, t, onNav, onToggle }) {
  const totalRent = db.tenants.reduce((s, tn) => s + tn.rent, 0);
  const paidCount = db.tenants.filter(tn => tn.payments["Marzo 2025"]?.paid).length;
  const pendingMaint = db.tenants.reduce((s, tn) => s + tn.maintenance.filter(m => m.status === "Pendiente").length, 0);
  const allMaint = db.tenants.flatMap(tn => tn.maintenance.map(m => ({ ...m, tenant: tn }))).slice(0, 4);

  return (
    <div>
      <div className="page-hd"><div>
        <h2>{t.dashboard.title}, Carlos 👋</h2>
        <p>{t.dashboard.subtitle} · Marzo 2025</p>
      </div></div>
      <div className="stats">
        <div className="stat tl"><div className="lbl">{t.stats.monthly}</div><div className="val">{totalRent}€</div><div className="sub">{t.stats.totalRent}</div></div>
        <div className="stat sl"><div className="lbl">{t.stats.received}</div><div className="val">{paidCount}/{db.tenants.length}</div><div className="sub">Marzo 2025</div></div>
        <div className="stat gl"><div className="lbl">{t.stats.tenants}</div><div className="val">{db.tenants.length}</div><div className="sub">{t.stats.active}</div></div>
        <div className="stat rl"><div className="lbl">{t.stats.maintenance}</div><div className="val">{pendingMaint}</div><div className="sub">{t.stats.pending}</div></div>
      </div>
      <div className="g2">
        <div className="card">
          <div className="card-title">👥 {t.dashboard.payments} · Marzo 2025</div>
          {db.tenants.map(tn => {
            const p = tn.payments["Marzo 2025"];
            const sc = statusColor(p?.paid ? "Resuelto" : "Pendiente");
            return (
              <div key={tn.id} className="t-row" onClick={() => onNav("tenants")}>
                <div className="av av-md" style={{ background: getColor(tn.id) }}>{tn.avatar}</div>
                <div className="t-info"><strong>{tn.name}</strong><span>{tn.unit} · {tn.rent}€/mes</span></div>
                <span className="badge" style={{ background: sc.bg, color: sc.color }}>{p?.paid ? t.paid : t.unpaid}</span>
              </div>
            );
          })}
        </div>
        <div className="card">
          <div className="card-title">🔧 {t.dashboard.recent}</div>
          {allMaint.length === 0
            ? <p style={{ color: "var(--warm)", fontSize: 14 }}>{t.dashboard.noMaint}</p>
            : allMaint.map(m => {
              const sc = statusColor(m.status);
              return (
                <div key={m.id} className="mi">
                  <div className="mi-icon">{maintIcon(m.type)}</div>
                  <div className="mi-info"><strong>{m.type}</strong><div className="meta">{m.tenant.name} · {m.date}</div><p>{m.desc}</p></div>
                  <span className="badge" style={{ background: sc.bg, color: sc.color }}>{t.statuses[m.status]}</span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

function Tenants({ db, t, onSelect }) {
  return (
    <div>
      <div className="page-hd"><div><h2>{t.tenants.title}</h2><p>{db.tenants.length} {t.tenants.active}</p></div></div>
      {db.tenants.map(tn => {
        const p = tn.payments["Marzo 2025"];
        const sc = statusColor(p?.paid ? "Resuelto" : "Pendiente");
        return (
          <div key={tn.id} className="t-row" onClick={() => onSelect(tn.id)}>
            <div className="av av-md" style={{ background: getColor(tn.id) }}>{tn.avatar}</div>
            <div className="t-info" style={{ flex: 1 }}><strong>{tn.name}</strong><span>{tn.unit} · {t.tenants.since} {tn.joined}</span></div>
            <div style={{ textAlign: t.dir === "rtl" ? "left" : "right", marginRight: t.dir === "rtl" ? 0 : 14, marginLeft: t.dir === "rtl" ? 14 : 0 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{tn.rent}€<span style={{ fontSize: 12, fontWeight: 400, color: "var(--warm)" }}>/mes</span></div>
              <span className="badge" style={{ background: sc.bg, color: sc.color }}>{p?.paid ? t.tenants.paidMarch : t.tenants.pendingMarch}</span>
            </div>
            <span style={{ color: "var(--warm)", fontSize: 20 }}>{t.dir === "rtl" ? "‹" : "›"}</span>
          </div>
        );
      })}
    </div>
  );
}

function TenantProfileModal({ t, tn, onToggle, onAddCost, onClose }) {
  const [costType, setCostType] = useState(t.costTypes[0]);
  const [costAmt, setCostAmt] = useState("");
  const [costMonth, setCostMonth] = useState("Marzo 2025");
  const months = Object.keys(tn.payments);
  const iconMap = {};
  t.costTypes.forEach(ct => { const parts = ct.split(" "); iconMap[ct] = parts[0]; });

  const handleAddCost = () => {
    if (!costAmt || !costMonth) return;
    const icon = iconMap[costType] || "📋";
    const name = costType.replace(/^\S+\s/, "");
    onAddCost(tn.id, icon, name, costMonth, parseFloat(costAmt));
    setCostAmt(""); setCostMonth("Marzo 2025");
  };

  return (
    <div className="modal">
      <div className="modal-hd"><h3>{tn.name}</h3><button className="close-btn" onClick={onClose}>✕</button></div>
      <div className="prof-hd">
        <div className="av av-lg" style={{ background: getColor(tn.id) }}>{tn.avatar}</div>
        <div className="prof-hd-info"><h3>{tn.name}</h3><p>{tn.unit} · {t.profile.since}: {tn.joined}</p></div>
      </div>
      <div className="prof-grid">
        <div><div className="pf-lbl">{t.profile.phone}</div><div className="pf-val">{tn.phone}</div></div>
        <div><div className="pf-lbl">{t.profile.email}</div><div className="pf-val">{tn.email}</div></div>
        <div><div className="pf-lbl">{t.profile.rent}</div><div className="pf-val">{tn.rent}€/mes</div></div>
        <div><div className="pf-lbl">{t.profile.since}</div><div className="pf-val">{tn.joined}</div></div>
      </div>
      <hr />
      <div className="serif" style={{ fontSize: 16, marginBottom: 12 }}>{t.profile.history}</div>
      {months.map(m => {
        const p = tn.payments[m]; const sc = statusColor(p.paid ? "Resuelto" : "Pendiente");
        return (
          <div key={m} className="cr">
            <div className="cn">{m}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="badge" style={{ background: sc.bg, color: sc.color }}>{p.paid ? `✓ ${p.date}` : t.unpaid}</span>
              <button className="btn btn-o btn-sm" onClick={() => onToggle(tn.id, m)}>{p.paid ? t.profile.revert : t.profile.markPaid}</button>
            </div>
          </div>
        );
      })}
      <hr />
      <div className="serif" style={{ fontSize: 16, marginBottom: 12 }}>{t.profile.addCost}</div>
      <div className="gr2">
        <div className="fg"><label>{t.profile.concept}</label>
          <select value={costType} onChange={e => setCostType(e.target.value)}>
            {t.costTypes.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="fg"><label>{t.profile.amount}</label>
          <input type="number" value={costAmt} onChange={e => setCostAmt(e.target.value)} placeholder="0" />
        </div>
      </div>
      <div className="fg"><label>{t.profile.month}</label>
        <input value={costMonth} onChange={e => setCostMonth(e.target.value)} />
      </div>
      <button className="btn btn-p" onClick={handleAddCost}>{t.profile.save}</button>
    </div>
  );
}

function AddCostModal({ t, tenants, onSave, onClose }) {
  const [tid, setTid] = useState(tenants[0]?.id);
  const [costType, setCostType] = useState(t.costTypes[0]);
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState("Marzo 2025");
  const iconMap = {}; t.costTypes.forEach(ct => { iconMap[ct] = ct.split(" ")[0]; });

  const handle = () => {
    if (!amount) return;
    onSave(parseInt(tid), iconMap[costType] || "📋", costType.replace(/^\S+\s/, ""), month, parseFloat(amount));
    onClose();
  };

  return (
    <div className="modal">
      <div className="modal-hd"><h3>{t.addCostModal.title}</h3><button className="close-btn" onClick={onClose}>✕</button></div>
      <div className="fg"><label>{t.addCostModal.tenantLabel}</label>
        <select value={tid} onChange={e => setTid(e.target.value)}>
          {tenants.map(tn => <option key={tn.id} value={tn.id}>{tn.name} ({tn.unit})</option>)}
        </select>
      </div>
      <div className="gr2">
        <div className="fg"><label>{t.profile.concept}</label>
          <select value={costType} onChange={e => setCostType(e.target.value)}>
            {t.costTypes.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="fg"><label>{t.profile.amount}</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
        </div>
      </div>
      <div className="fg"><label>{t.profile.month}</label><input value={month} onChange={e => setMonth(e.target.value)} /></div>
      <button className="btn btn-p" onClick={handle}>{t.addCostModal.save}</button>
    </div>
  );
}

function Finances({ db, t, onToggle, onAddCost }) {
  const months = ["Enero 2025", "Febrero 2025", "Marzo 2025"];
  return (
    <div>
      <div className="page-hd"><div><h2>{t.finances.title}</h2><p>{t.finances.sub}</p></div></div>
      <div className="card">
        <div className="card-title">{t.finances.rentTable}</div>
        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>{t.finances.tenant}</th><th>{t.finances.unit}</th><th>{t.finances.rentCol}</th>
              {months.map(m => <th key={m}>{m}</th>)}
            </tr></thead>
            <tbody>
              {db.tenants.map(tn => (
                <tr key={tn.id}>
                  <td><strong>{tn.name}</strong></td><td>{tn.unit}</td><td>{tn.rent}€</td>
                  {months.map(m => {
                    const p = tn.payments[m];
                    if (!p) return <td key={m}><span className="badge" style={{ background: "#F0ECE8", color: "#8C7B6E" }}>—</span></td>;
                    const sc = statusColor(p.paid ? "Resuelto" : "Pendiente");
                    return <td key={m}><span className="badge" style={{ background: sc.bg, color: sc.color, cursor: "pointer" }} onClick={() => onToggle(tn.id, m)}>{p.paid ? `✓ ${p.date}` : t.pendingShort}</span></td>;
                  })}
                </tr>
              ))}
              <tr style={{ background: "var(--cream)" }}>
                <td colSpan="2"><strong>{t.finances.total}</strong></td>
                <td><strong>{db.tenants.reduce((s, tn) => s + tn.rent, 0)}€</strong></td>
                {months.map(m => <td key={m}><strong>{db.tenants.filter(tn => tn.payments[m]?.paid).reduce((s, tn) => s + tn.rent, 0)}€</strong></td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-title">{t.finances.costTable}</div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>{t.finances.tenant}</th><th>{t.profile.concept}</th><th>{t.profile.month}</th><th>{t.profile.amount}</th></tr></thead>
            <tbody>
              {db.tenants.flatMap(tn => tn.costs.map(c => (
                <tr key={c.id}><td>{tn.name}</td><td>{c.icon} {c.name}</td><td>{c.month}</td><td>{c.amount}€</td></tr>
              )))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 14 }}><button className="btn btn-p" onClick={onAddCost}>{t.finances.addCost}</button></div>
      </div>
    </div>
  );
}

function Maintenance({ db, t, onStatus }) {
  const all = db.tenants.flatMap(tn => tn.maintenance.map(m => ({ ...m, tenant: tn })));
  return (
    <div>
      <div className="page-hd"><div>
        <h2>{t.maint.title}</h2>
        <p>{all.filter(m => m.status === "Pendiente").length} {t.maint.pending} · {all.length} {t.maint.total}</p>
      </div></div>
      {all.length === 0
        ? <div className="card"><p style={{ color: "var(--warm)", textAlign: "center", padding: 20 }}>{t.maint.noIssues}</p></div>
        : all.map(m => {
          const sc = statusColor(m.status);
          return (
            <div key={m.id} className="mi">
              <div className="mi-icon">{maintIcon(m.type)}</div>
              <div className="mi-info">
                <strong>{m.type}</strong>
                <div className="meta">{m.tenant.name} · {m.tenant.unit} · {m.date}</div>
                <p>{m.desc}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <span className="badge" style={{ background: sc.bg, color: sc.color }}>{t.statuses[m.status]}</span>
                <select className="status-sel" value={m.status} onChange={e => onStatus(m.tenant.id, m.id, e.target.value)}>
                  {t.statusOptions.map(s => <option key={s} value={s}>{t.statuses[s]}</option>)}
                </select>
              </div>
            </div>
          );
        })}
    </div>
  );
}

// ─── TENANT PAGES ─────────────────────────────────────────────────────────────
function TenantHome({ tenant: tn, t }) {
  const months = Object.keys(tn.payments);
  const current = months[months.length - 1];
  const p = tn.payments[current];
  return (
    <div>
      <div className="page-hd"><div>
        <h2>{t.tHome.hello}, {tn.name.split(" ")[0]} 👋</h2>
        <p>{tn.unit} · {current}</p>
      </div></div>
      <div className="pay-status" style={p.paid
        ? { background: "linear-gradient(135deg,#E6F4ED,#D0EBDA)", border: "2px solid #4A9B6F" }
        : { background: "linear-gradient(135deg,#FDECEA,#FAD8D5)", border: "2px solid #D94F3D" }}>
        <div className="sico">{p.paid ? "✅" : "⚠️"}</div>
        <h3>{p.paid ? t.tHome.paid : t.tHome.unpaid}</h3>
        <div className="amount">{tn.rent}€</div>
        <p>{p.paid ? `${t.tHome.registeredOn} ${p.date}` : `${t.tHome.dueThis} · ${current}`}</p>
      </div>
      <div className="g2">
        <div className="card">
          <div className="card-title">{t.tHome.history}</div>
          {months.map(m => {
            const pm = tn.payments[m]; const sc = statusColor(pm.paid ? "Resuelto" : "Pendiente");
            return <div key={m} className="cr"><div className="cn">{m}</div><span className="badge" style={{ background: sc.bg, color: sc.color }}>{pm.paid ? `✓ ${pm.date}` : t.unpaid}</span></div>;
          })}
        </div>
        <div className="card">
          <div className="card-title">{t.tHome.info}</div>
          <div className="prof-grid">
            <div><div className="pf-lbl">{t.tHome.unitLabel}</div><div className="pf-val">{tn.unit}</div></div>
            <div><div className="pf-lbl">{t.tHome.rentLabel}</div><div className="pf-val">{tn.rent}€/mes</div></div>
            <div><div className="pf-lbl">{t.tHome.sinceLabel}</div><div className="pf-val">{tn.joined}</div></div>
            <div><div className="pf-lbl">{t.tHome.ownerLabel}</div><div className="pf-val">Carlos M.</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantCosts({ tenant: tn, t }) {
  const total = tn.costs.reduce((s, c) => s + c.amount, 0);
  return (
    <div>
      <div className="page-hd"><div><h2>{t.tCosts.title}</h2><p>{t.tCosts.sub}</p></div></div>
      <div className="stats">
        <div className="stat gl"><div className="lbl">{t.tCosts.totalCosts}</div><div className="val">{total}€</div></div>
        <div className="stat tl"><div className="lbl">{t.tCosts.fixedRent}</div><div className="val">{tn.rent}€</div></div>
      </div>
      <div className="card">
        <div className="card-title">{t.tCosts.breakdown}</div>
        {tn.costs.length === 0 ? <p style={{ color: "var(--warm)", fontSize: 14 }}>{t.tCosts.noCosts}</p>
          : tn.costs.map(c => (
            <div key={c.id} className="cr">
              <div className="cn"><span style={{ fontSize: 20 }}>{c.icon}</span><div><div>{c.name}</div><div style={{ fontSize: 12, color: "var(--warm)" }}>{c.month}</div></div></div>
              <div className="ca">{c.amount}€</div>
            </div>
          ))}
        <hr />
        <div className="cr"><div className="cn"><strong>{t.tCosts.totalLabel}</strong></div><div className="ca" style={{ fontSize: 18 }}>{total}€</div></div>
      </div>
    </div>
  );
}

function TenantMaintenance({ tenant: tn, t, onSend }) {
  const [type, setType] = useState(t.maintTypes[0]);
  const [desc, setDesc] = useState("");

  const handle = () => {
    if (!desc.trim()) return;
    onSend(tn.id, type, desc.trim());
    setDesc("");
  };

  return (
    <div>
      <div className="page-hd"><div><h2>{t.tMaint.title}</h2><p>{t.tMaint.sub}</p></div></div>
      <div className="card">
        <div className="card-title">{t.tMaint.newIssue}</div>
        <div className="fg"><label>{t.tMaint.typeLabel}</label>
          <select value={type} onChange={e => setType(e.target.value)}>
            {t.maintTypes.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="fg"><label>{t.tMaint.descLabel}</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder={t.tMaint.descPlaceholder} />
        </div>
        <button className="btn btn-s" onClick={handle}>{t.tMaint.send}</button>
      </div>
      <div className="card">
        <div className="card-title">{t.tMaint.history}</div>
        {tn.maintenance.length === 0 ? <p style={{ color: "var(--warm)", fontSize: 14 }}>{t.tMaint.noSent}</p>
          : tn.maintenance.map(m => {
            const sc = statusColor(m.status);
            return (
              <div key={m.id} className="mi">
                <div className="mi-icon">{maintIcon(m.type)}</div>
                <div className="mi-info"><strong>{m.type}</strong><div className="meta">{m.date}</div><p>{m.desc}</p></div>
                <span className="badge" style={{ background: sc.bg, color: sc.color }}>{t.statuses[m.status]}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
