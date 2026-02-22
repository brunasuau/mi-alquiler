import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, collection, query, where,
  onSnapshot, addDoc, orderBy, serverTimestamp, updateDoc
} from "firebase/firestore";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

const OWNER_EMAIL = "bertasuau@gmail.com";

function generateReceipt({ tenantName, unit, month, date }) {
  const d = new jsPDF({ format:"a4", unit:"mm" });
  const m=25; let y=30; const lh=8;
  d.setFont("helvetica","bold"); d.setFontSize(11);
  d.text("JOANA SOLÉ SANTACANA",m,y); d.setFont("helvetica","normal");
  d.text(" VIUDA DE JOAN SUAU OLIVELLA",m+58,y); y+=lh;
  d.text("PASSEIG MARÍTIM SANT JOAN DE DÉU, 90, 5º 2ª",m,y); y+=lh;
  d.text("43820 CALAFELL",m,y); y+=lh;
  d.text("DNI: 39618190T",m,y); y+=lh;
  d.text("Bertasuau@gmail.com | 630879206",m,y); y+=lh*2;
  d.setDrawColor(180,180,180); d.line(m,y,210-m,y); y+=lh*1.5;
  d.setFont("helvetica","bold"); d.setFontSize(14);
  d.text("REBUT DE LLOGUER",m,y); y+=lh*2; d.setFontSize(11);
  const segs=[
    {text:"Jo, Berta Suau, he rebut del/la senyor/a ",bold:false,c:[0,0,0]},
    {text:tenantName,bold:true,c:[188,0,38]},
    {text:", en concepte de ",bold:false,c:[0,0,0]},
    {text:"ALQUILER",bold:true,c:[0,0,0]},
    {text:" del mes de ",bold:false,c:[0,0,0]},
    {text:month,bold:true,c:[188,0,38]},
    {text:" de l'immoble ",bold:false,c:[0,0,0]},
    {text:unit,bold:true,c:[188,0,38]},
    {text:", en nom de la Senyora Joana Solé Santacana, Titular de la nau.",bold:false,c:[0,0,0]},
  ];
  let x=m;
  for(const s of segs){
    d.setFont("helvetica",s.bold?"bold":"normal"); d.setTextColor(s.c[0],s.c[1],s.c[2]);
    const words=s.text.split(" ");
    for(let i=0;i<words.length;i++){
      const w=words[i]+(i<words.length-1?" ":""); const ww=d.getTextWidth(w);
      if(x+ww>m+(210-m*2)&&x>m){x=m;y+=lh;} d.text(w,x,y); x+=ww;
    }
  }
  y+=lh*2.5; d.setTextColor(0,0,0); d.setFont("helvetica","bold"); d.setFontSize(11);
  d.text("Data del rebut:",m,y); d.setFont("helvetica","normal"); d.setTextColor(188,0,38);
  d.text(" "+date,m+d.getTextWidth("Data del rebut:"),y); y+=lh*2.5;
  d.setTextColor(0,0,0); d.setFont("helvetica","bold");
  d.text("Firma:",m,y); d.setFont("helvetica","bolditalic");
  d.text(" Berta Suau",m+d.getTextWidth("Firma:"),y);
  d.setDrawColor(180,180,180); d.line(m,270,210-m,270);
  d.save(`Rebut_${tenantName.replace(/ /g,"_")}_${month.replace(/ /g,"_")}.pdf`);
}

function generateAnnualExcel(tenants, year) {
  const monthNames=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const months=monthNames.map(m=>`${m} ${year}`);
  const wb=XLSX.utils.book_new();

  // ── SHEET 1: RESUMEN ANUAL ──
  const resumen=[["RESUMEN ANUAL "+year,"","",""],["","","",""],
    ["Mes","Ingresos (€)","Gastos (€)","Inversiones (€)","Profit (€)"]];
  let totI=0,totG=0,totInv=0;
  months.forEach(m=>{
    const ing=tenants.filter(t=>(t.payments||{})[m]?.paid).reduce((s,t)=>s+(t.rent||0),0);
    const gas=tenants.reduce((s,t)=>s+(t.costs||[]).filter(c=>c.month===m&&c.tipo!=="inversion").reduce((ss,c)=>ss+(c.amount||0),0),0);
    const inv=tenants.reduce((s,t)=>s+(t.costs||[]).filter(c=>c.month===m&&c.tipo==="inversion").reduce((ss,c)=>ss+(c.amount||0),0),0);
    totI+=ing;totG+=gas;totInv+=inv;
    resumen.push([m,ing,gas,inv,ing-gas-inv]);
  });
  resumen.push(["","","","",""]);
  resumen.push(["TOTAL",totI,totG,totInv,totI-totG-totInv]);
  const ws1=XLSX.utils.aoa_to_sheet(resumen);
  ws1["!cols"]=[{wch:20},{wch:15},{wch:15},{wch:16},{wch:12}];
  XLSX.utils.book_append_sheet(wb,ws1,"Resumen");

  // ── SHEET 2: PAGOS ──
  const pagosData=[["PAGOS INQUILINOS "+year],["Inquilino","Piso","Alquiler/mes",...months]];
  tenants.forEach(ten=>{
    const row=[ten.name,ten.unit,ten.rent+"€"];
    months.forEach(m=>{const p=(ten.payments||{})[m];row.push(p?.paid?"✓ "+p.date:"✗ Pendiente");});
    pagosData.push(row);
  });
  const ws2=XLSX.utils.aoa_to_sheet(pagosData);
  ws2["!cols"]=[{wch:20},{wch:15},{wch:14},...months.map(()=>({wch:14}))];
  XLSX.utils.book_append_sheet(wb,ws2,"Pagos");

  // ── SHEET 3: GASTOS E INVERSIONES ──
  const gastosData=[["GASTOS E INVERSIONES "+year],["Inquilino","Concepto","Tipo","Mes","Importe (€)","Nota"]];
  tenants.forEach(ten=>{
    (ten.costs||[]).filter(c=>c.month?.includes(String(year))).forEach(c=>{
      gastosData.push([ten.name,c.icon+" "+c.name,c.tipo==="inversion"?"🏗️ Inversión":"💸 Gasto",c.month,c.amount,c.nota||""]);
    });
  });
  const ws3=XLSX.utils.aoa_to_sheet(gastosData);
  ws3["!cols"]=[{wch:20},{wch:20},{wch:14},{wch:16},{wch:12},{wch:30}];
  XLSX.utils.book_append_sheet(wb,ws3,"Gastos");

  // ── SHEET 4: INQUILINOS ──
  const tenantsData=[["INQUILINOS "+year],["Nombre","Piso","Teléfono","Email","Alquiler","Inicio contrato","Fin contrato"]];
  tenants.forEach(ten=>{
    tenantsData.push([ten.name,ten.unit,ten.phone||"",ten.email||"",ten.rent+"€",ten.contractStart||"",ten.contractEnd||""]);
  });
  const ws4=XLSX.utils.aoa_to_sheet(tenantsData);
  ws4["!cols"]=[{wch:22},{wch:15},{wch:14},{wch:26},{wch:12},{wch:16},{wch:16}];
  XLSX.utils.book_append_sheet(wb,ws4,"Inquilinos");

  XLSX.writeFile(wb,`MiAlquiler_Resumen_${year}.xlsx`);
  return {year, filename:`MiAlquiler_Resumen_${year}.xlsx`, date:new Date().toLocaleDateString("es-ES"), totI, totG, totInv, profit:totI-totG-totInv};
}

function generateContractDocx(data) {
  const { unit, tenantName, tenantDni, tenantAddress, signDay, signMonth, signYear,
          startDay, startMonth, startYear, endDay, endMonth, endYear, rent } = data;
  const d = new jsPDF({ format:"a4", unit:"mm" });
  const lm=20, rm=190, maxW=rm-lm;
  let y=20;
  const lh=6;

  function addText(segments, lineW=maxW) {
    // segments: [{text, bold}]
    let x=lm;
    // Build lines by wrapping words
    let lines=[[]]; // array of segments per line
    segments.forEach(seg=>{
      const words=seg.text.split(" ");
      words.forEach((word,wi)=>{
        const w=word+(wi<words.length-1?" ":"");
        d.setFont("helvetica", seg.bold?"bold":"normal");
        const ww=d.getTextWidth(w);
        const lineW2=d.getTextWidth(lines[lines.length-1].map(s=>s.text).join(""));
        if(lineW2+ww>lineW && lines[lines.length-1].length>0){
          lines.push([{text:w,bold:seg.bold}]);
        } else {
          const last=lines[lines.length-1];
          if(last.length>0&&last[last.length-1].bold===seg.bold){
            last[last.length-1].text+=w;
          } else {
            last.push({text:w,bold:seg.bold});
          }
        }
      });
    });
    lines.forEach(line=>{
      if(y>280){d.addPage();y=20;}
      let cx=lm;
      line.forEach(seg=>{
        d.setFont("helvetica",seg.bold?"bold":"normal");
        d.setFontSize(10);
        d.text(seg.text,cx,y);
        cx+=d.getTextWidth(seg.text);
      });
      y+=lh;
    });
    y+=2;
  }

  function title(text){
    if(y>270){d.addPage();y=20;}
    d.setFont("helvetica","bold"); d.setFontSize(13);
    d.text(text, 105, y, {align:"center"}); y+=8;
    d.setFontSize(10);
  }
  function heading(text){
    if(y>270){d.addPage();y=20;}
    d.setFont("helvetica","bold"); d.setFontSize(10);
    d.text(text,lm,y); y+=lh+1;
  }
  function space(){y+=3;}

  title(`CONTRATO DE ARRENDAMIENTO DE ${unit.toUpperCase()}`);
  space();
  addText([{text:`En Calafell, a ${signDay} de ${signMonth} de ${signYear}.`}]);
  space();
  heading("REUNIDOS");
  addText([{text:"De una parte, D./Dña. "},{text:"JOANA SOLÉ SANTACANA",bold:true},{text:", mayor de edad, con DNI nº "},{text:"39618190T",bold:true},{text:", domicilio en "},{text:"PASSEIG MARÍTIM SANT JOAN DE DÉU, 90, 5º 2ª",bold:true},{text:", en adelante "},{text:"EL ARRENDADOR",bold:true},{text:"."}]);
  addText([{text:"Y de otra parte, D./Dña. "},{text:tenantName,bold:true},{text:", DNI nº "},{text:tenantDni,bold:true},{text:", domicilio en "},{text:tenantAddress,bold:true},{text:", en adelante "},{text:"EL ARRENDATARIO",bold:true},{text:"."}]);
  addText([{text:"Ambas partes se reconocen capacidad legal suficiente para formalizar el presente contrato."}]);
  space();
  heading("EXPONEN");
  addText([{text:"1. El ARRENDADOR es propietario del local en "},{text:"Carrer Montserrat, nº 14, Calafell (Tarragona)",bold:true},{text:"."}]);
  addText([{text:"2. Ambas partes desean renovar el arrendamiento bajo las siguientes condiciones."}]);
  space();
  heading("CLÁUSULAS");
  heading("Primera. Objeto");
  addText([{text:"El ARRENDADOR renueva el arrendamiento sobre el local en "},{text:"Carrer Montserrat, nº 14, Calafell",bold:true},{text:", uso comercial."}]);
  heading("Segunda. Duración");
  addText([{text:"Duración dos (2) años: del "},{text:`${startDay} de ${startMonth} de ${startYear}`,bold:true},{text:" al "},{text:`${endDay} de ${endMonth} de ${endYear}`,bold:true},{text:"."}]);
  heading("Tercera. Renta");
  addText([{text:"Renta mensual: "},{text:`${rent} €`,bold:true},{text:", abonada los cinco primeros días del mes por transferencia bancaria."}]);
  heading("Cuarta. Actualización de la renta");
  addText([{text:"Actualización anual según IPC + 1,5% adicional. Primera actualización a los 12 meses de la firma."}]);
  heading("Quinta. Gastos y suministros");
  addText([{text:"Electricidad, agua y basuras son a cargo exclusivo del ARRENDATARIO."}]);
  heading("Sexta. Fianza");
  addText([{text:"Al ser renovación, no se constituye fianza adicional."}]);
  heading("Séptima. Conservación");
  addText([{text:"El ARRENDATARIO mantendrá el local en perfecto estado. Reparaciones menores a su cargo."}]);
  heading("Octava. Cesión y subarriendo");
  addText([{text:"Prohibida la cesión y el subarriendo sin consentimiento escrito del ARRENDADOR."}]);
  heading("Novena. Legislación");
  addText([{text:"Se rige por el Código Civil y la Ley de Arrendamientos Urbanos vigente."}]);
  space();
  addText([{text:"Y en prueba de conformidad, firman el presente contrato por duplicado en el lugar y fecha indicados."}]);
  y+=10;
  if(y>250){d.addPage();y=20;}
  d.setFont("helvetica","bold"); d.setFontSize(10);
  d.text("EL ARRENDADOR",lm,y);
  d.text("EL ARRENDATARIO",115,y);
  y+=20;
  d.setFont("helvetica","normal");
  d.text("Firma: _______________________",lm,y);
  d.text("Firma: _______________________",115,y);
  y+=8;
  d.setFont("helvetica","bolditalic");
  d.text("Berta Suau",lm,y);
  d.text(tenantName,115,y);
  const filename=`Contrato_${unit.replace(/ /g,"_")}_${tenantName.replace(/ /g,"_")}_${signYear}.pdf`;
  d.save(filename);
  return filename;
}

function checkIPC(tenants) {
  const now=new Date(); const alerts=[];
  tenants.forEach(ten=>{
    if(!ten.contractStart)return;
    const start=new Date(ten.contractStart);
    if(start.getDate()===now.getDate()&&start.getMonth()===now.getMonth()){
      const years=now.getFullYear()-start.getFullYear();
      if(years>0)alerts.push({tenant:ten,years,type:"ipc"});
      if(years===0)alerts.push({tenant:ten,years:0,type:"signed_today"});
    }
    if(ten.contractEnd){
      const end=new Date(ten.contractEnd);
      const daysLeft=Math.ceil((end-now)/(1000*60*60*24));
      if(daysLeft>=0&&daysLeft<=30)alerts.push({tenant:ten,daysLeft,type:"expiring"});
    }
  });
  return alerts;
}

const T={
  es:{
    appName:"MiAlquiler",loginTitle:"Bienvenido",email:"Correo electrónico",password:"Contraseña",
    login:"Entrar",logout:"Salir",owner:"Propietario",tenant:"Inquilino",dashboard:"Resumen",
    tenants:"Inquilinos",finances:"Finanzas",maintenance:"Mantenimiento",calendar:"Calendario",
    myHome:"Mi Piso",myCosts:"Mis Costes",incidents:"Incidencias",messages:"Mensajes",
    paid:"Pagado",pending:"Pendiente",markPaid:"Marcar pagado",revert:"Revertir",
    addCost:"Añadir coste",save:"Guardar",newTenant:"Nuevo inquilino",name:"Nombre completo",
    unit:"Piso / Habitación",phone:"Teléfono",rent:"Alquiler mensual (€)",createAccess:"Crear acceso",
    concept:"Concepto",amount:"Importe (€)",month:"Mes",typeMsg:"Escribe un mensaje...",
    sendIncident:"Enviar al propietario",incidentType:"Tipo de problema",description:"Descripción",
    noTenants:"No hay inquilinos todavía",noMessages:"No hay mensajes aún",
    noIncidents:"No hay incidencias",noCosts:"Sin costes registrados",
    costBreakdown:"Desglose de costes",paymentHistory:"Historial de pagos",
    registered:"Registrado el",dueThisMonth:"Vence este mes",inReview:"En revisión",
    resolved:"Resuelto",wrongCredentials:"Email o contraseña incorrectos",saving:"Guardando...",
    joinedSince:"Inquilino desde",totalCosts:"Total costes",monthlyRent:"Alquiler fijo",
    incomeMonth:"Ingreso mensual",paidCount:"Pagos recibidos",activeTenants:"Inquilinos activos",
    pendingMaint:"Mantenimiento pendiente",recentIncidents:"Incidencias recientes",hello:"Hola",
    documents:"Documentos",generateExcel:"Generar Excel anual",downloadDoc:"Descargar",noDocuments:"No hay documentos todavía",docGenerated:"Documento generado",
    contracts:"Contratos",newContract:"Nuevo contrato",contractGenerated:"Contrato generado",noContracts:"No hay contratos",tenantCreated:"Inquilino y contrato creados",
    tenantSignature:"Firma del inquilino",tenantConfirm:"He leído y acepto el contrato de arrendamiento",contractDetails:"Datos del contrato",
    signDate:"Fecha de firma",startDate:"Inicio del contrato",endDate:"Fin del contrato",dni:"DNI",address:"Domicilio actual",accessPassword:"Contraseña de acceso",
    contractStart:"Inicio contrato",contractEnd:"Fin contrato",editTenant:"Editar inquilino",
    contractAnniversary:"Subida de IPC",notifications:"Notificaciones",
    noNotifications:"Sin notificaciones",contractSigned:"Contrato firmado el",
    yearsAgo:"año(s)",contractExpires:"Contrato expira el",editData:"Editar datos",
  },
  en:{
    appName:"MyRental",loginTitle:"Welcome",email:"Email address",password:"Password",
    login:"Sign in",logout:"Sign out",owner:"Owner",tenant:"Tenant",dashboard:"Overview",
    tenants:"Tenants",finances:"Finances",maintenance:"Maintenance",calendar:"Calendar",
    myHome:"My Flat",myCosts:"My Costs",incidents:"Issues",messages:"Messages",
    paid:"Paid",pending:"Pending",markPaid:"Mark as paid",revert:"Revert",
    addCost:"Add cost",save:"Save",newTenant:"New tenant",name:"Full name",
    unit:"Flat / Room",phone:"Phone",rent:"Monthly rent (€)",createAccess:"Create access",
    concept:"Concept",amount:"Amount (€)",month:"Month",typeMsg:"Type a message...",
    sendIncident:"Send to owner",incidentType:"Problem type",description:"Description",
    noTenants:"No tenants yet",noMessages:"No messages yet",noIncidents:"No issues reported",
    noCosts:"No costs registered",costBreakdown:"Cost breakdown",paymentHistory:"Payment history",
    registered:"Registered on",dueThisMonth:"Due this month",inReview:"In review",
    resolved:"Resolved",wrongCredentials:"Wrong email or password",saving:"Saving...",
    joinedSince:"Tenant since",totalCosts:"Total costs",monthlyRent:"Fixed rent",
    incomeMonth:"Monthly income",paidCount:"Payments received",activeTenants:"Active tenants",
    pendingMaint:"Pending maintenance",recentIncidents:"Recent issues",hello:"Hello",
    documents:"Documents",generateExcel:"Generate annual Excel",downloadDoc:"Download",noDocuments:"No documents yet",docGenerated:"Document generated",
    contracts:"Contracts",newContract:"New contract",contractGenerated:"Contract generated",noContracts:"No contracts yet",tenantCreated:"Tenant and contract created",
    tenantSignature:"Tenant signature",tenantConfirm:"I have read and accept the rental agreement",contractDetails:"Contract details",
    signDate:"Signing date",startDate:"Contract start",endDate:"Contract end",dni:"ID number",address:"Current address",accessPassword:"Access password",
    contractStart:"Contract start",contractEnd:"Contract end",editTenant:"Edit tenant",
    contractAnniversary:"IPC Rent Increase",notifications:"Notifications",
    noNotifications:"No notifications",contractSigned:"Contract signed on",
    yearsAgo:"year(s)",contractExpires:"Contract expires on",editData:"Edit data",
  },
  ar:{
    appName:"إيجاري",loginTitle:"مرحباً",email:"البريد الإلكتروني",password:"كلمة المرور",
    login:"دخول",logout:"خروج",owner:"المالك",tenant:"المستأجر",dashboard:"ملخص",
    tenants:"المستأجرون",finances:"الماليات",maintenance:"الصيانة",calendar:"التقويم",
    myHome:"شقتي",myCosts:"تكاليفي",incidents:"البلاغات",messages:"الرسائل",
    paid:"مدفوع",pending:"معلق",markPaid:"تأكيد الدفع",revert:"تراجع",
    addCost:"إضافة تكلفة",save:"حفظ",newTenant:"مستأجر جديد",name:"الاسم الكامل",
    unit:"الشقة / الغرفة",phone:"الهاتف",rent:"الإيجار الشهري (€)",createAccess:"إنشاء حساب",
    concept:"البند",amount:"المبلغ (€)",month:"الشهر",typeMsg:"اكتب رسالة...",
    sendIncident:"إرسال للمالك",incidentType:"نوع المشكلة",description:"الوصف",
    noTenants:"لا يوجد مستأجرون",noMessages:"لا توجد رسائل",noIncidents:"لا توجد بلاغات",
    noCosts:"لا توجد تكاليف",costBreakdown:"تفاصيل التكاليف",paymentHistory:"سجل المدفوعات",
    registered:"تم التسجيل في",dueThisMonth:"مستحق هذا الشهر",inReview:"قيد المراجعة",
    resolved:"تم الحل",wrongCredentials:"بريد إلكتروني أو كلمة مرور خاطئة",saving:"جاري الحفظ...",
    joinedSince:"مستأجر منذ",totalCosts:"إجمالي التكاليف",monthlyRent:"الإيجار الثابت",
    incomeMonth:"الدخل الشهري",paidCount:"المدفوعات المستلمة",activeTenants:"المستأجرون النشطون",
    pendingMaint:"صيانة معلقة",recentIncidents:"البلاغات الأخيرة",hello:"مرحباً",
    documents:"المستندات",generateExcel:"إنشاء Excel سنوي",downloadDoc:"تحميل",noDocuments:"لا توجد مستندات",docGenerated:"تم إنشاء المستند",
    contracts:"العقود",newContract:"عقد جديد",contractGenerated:"تم إنشاء العقد",noContracts:"لا توجد عقود",tenantCreated:"تم إنشاء المستأجر والعقد",
    tenantSignature:"توقيع المستأجر",tenantConfirm:"لقد قرأت وأوافق على عقد الإيجار",contractDetails:"بيانات العقد",
    signDate:"تاريخ التوقيع",startDate:"بداية العقد",endDate:"نهاية العقد",dni:"رقم الهوية",address:"العنوان الحالي",accessPassword:"كلمة المرور",
    contractStart:"بداية العقد",contractEnd:"نهاية العقد",editTenant:"تعديل المستأجر",
    contractAnniversary:"زيادة IPC",notifications:"الإشعارات",
    noNotifications:"لا توجد إشعارات",contractSigned:"تم توقيع العقد في",
    yearsAgo:"سنة",contractExpires:"ينتهي العقد في",editData:"تعديل البيانات",
  }
};

const avatarColors=["#C4622D","#7A9E7E","#D4A853","#6B8CBA","#9B6BB5","#C4844A"];
const getColor=(str)=>avatarColors[str?.charCodeAt(0)%avatarColors.length]||"#C4622D";
const initials=(name)=>name?.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2)||"?";
const today=()=>new Date().toLocaleDateString("es-ES");
const maintIcons={"Fontanería":"🚿","Electricidad":"⚡","Calefacción":"🌡️","Ventanas":"🪟","Electrodomésticos":"🔌","Otros":"🔧"};

const css=`
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--cream:#F7F3EE;--dark:#1A1612;--terra:#C4622D;--terra-l:#E8845A;--sage:#7A9E7E;--sage-l:#A8C5AB;--gold:#D4A853;--warm:#8C7B6E;--bg:#FFFCF9;--border:#E8DDD4;--red:#D94F3D;--green:#4A9B6F;}
body{font-family:'DM Sans',sans-serif;background:var(--cream);color:var(--dark);font-size:15px}
.serif{font-family:'DM Serif Display',serif}
.lang-screen{min-height:100vh;background:var(--dark);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px;padding:20px}
.lang-title{font-family:'DM Serif Display',serif;font-size:52px;color:var(--cream);letter-spacing:-1px;text-align:center}
.lang-title em{color:var(--terra-l);font-style:italic}
.lang-cards{display:flex;gap:16px;flex-wrap:wrap;justify-content:center}
.lang-card{background:#2A2420;border:2px solid #3A3028;border-radius:16px;padding:24px 32px;cursor:pointer;text-align:center;transition:all .2s;color:var(--cream)}
.lang-card:hover{border-color:var(--terra);background:#332A25}
.lang-card .flag{font-size:36px;margin-bottom:8px}
.lang-card p{font-size:15px;font-weight:500}
.login-wrap{min-height:100vh;background:var(--dark);display:flex;align-items:center;justify-content:center;padding:20px}
.login-box{background:#2A2420;border:1px solid #3A3028;border-radius:24px;padding:40px 36px;width:100%;max-width:380px}
.login-box h2{font-family:'DM Serif Display',serif;font-size:28px;color:var(--cream);margin-bottom:6px}
.login-box p{color:var(--warm);font-size:13px;margin-bottom:28px}
.login-err{background:#3D1A18;border:1px solid var(--red);color:#F5A49A;padding:10px 14px;border-radius:10px;font-size:13px;margin-bottom:16px}
.app{display:flex;min-height:100vh}
.sidebar{width:220px;background:var(--dark);display:flex;flex-direction:column;padding:28px 16px;position:fixed;top:0;left:0;bottom:0;z-index:50}
@media(max-width:600px){
  .sidebar{top:0;bottom:0;left:0;flex-direction:column;padding:20px 10px;z-index:55}
  .sidebar.collapsed{width:0!important;min-width:0!important;padding:0!important}
  .gr2{grid-template-columns:1fr!important}
  .g2{grid-template-columns:1fr!important}
  .stats{grid-template-columns:1fr 1fr!important}
  .chat-wrap{height:calc(100vh - 160px)}
  table{font-size:12px}
  th,td{padding:8px 6px}
  .page-hd h2{font-size:22px}
  .btn{padding:8px 14px;font-size:13px}
  .toast{bottom:20px;right:12px;left:12px;text-align:center}
  .modal{padding:20px 16px;max-height:92vh;border-radius:20px 20px 0 0;align-self:flex-end}
  .overlay{align-items:flex-end;padding:0}
  .pay-box{padding:20px}
  .pay-box .amount{font-size:32px}
  .nav-item{padding:10px 10px;font-size:13px}
  .nav-item span{font-size:18px}
}
.s-logo{font-family:'DM Serif Display',serif;font-size:22px;color:var(--cream);padding:0 10px}
.s-logo em{color:var(--terra-l);font-style:italic}
.s-role{font-size:11px;color:var(--warm);text-transform:uppercase;letter-spacing:1px;padding:0 10px;margin:4px 0 24px}
.s-nav{flex:1;display:flex;flex-direction:column;gap:3px}
.nav-item{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:10px;cursor:pointer;color:var(--warm);font-size:14px;font-weight:500;transition:all .2s;border:none;background:none;width:100%;text-align:left;font-family:'DM Sans',sans-serif}
.nav-item:hover{background:#2A2420;color:var(--cream)}
.nav-item.active-o{background:var(--terra);color:#fff}
.nav-item.active-t{background:var(--sage);color:#fff}
.s-footer{border-top:1px solid #2A2420;padding-top:14px;margin-top:auto;display:flex;align-items:center;gap:8px}
.s-user-info{flex:1;min-width:0}
.s-user-info strong{font-size:13px;color:var(--cream);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.s-user-info span{font-size:11px;color:var(--warm)}
.logout-btn{background:none;border:none;color:var(--warm);cursor:pointer;font-size:16px;padding:4px;transition:color .2s}
.logout-btn:hover{color:var(--cream)}
.notif-wrap{position:relative}
.notif-btn{background:none;border:none;color:var(--warm);cursor:pointer;font-size:18px;padding:4px;position:relative}
.notif-dot{position:absolute;top:2px;right:2px;width:8px;height:8px;background:var(--red);border-radius:50%}
.notif-panel{position:absolute;bottom:40px;right:0;background:var(--bg);border:1px solid var(--border);border-radius:16px;padding:16px;width:280px;box-shadow:0 8px 32px rgba(0,0,0,.15);z-index:100}
.notif-panel-title{font-size:12px;font-weight:600;color:var(--warm);text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px}
.notif-item{padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;line-height:1.5}
.notif-item:last-child{border-bottom:none}
.content{margin-left:220px;padding:40px;flex:1;min-height:100vh}
@media(max-width:800px){.sidebar{width:180px}.content{margin-left:180px;padding:24px 16px}}
.av{border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;color:#fff;flex-shrink:0}
.av-sm{width:34px;height:34px;font-size:13px}
.av-md{width:48px;height:48px;font-size:18px;font-family:'DM Serif Display',serif}
.av-lg{width:72px;height:72px;font-size:26px;font-family:'DM Serif Display',serif}
.page-hd{margin-bottom:32px}
.page-hd h2{font-family:'DM Serif Display',serif;font-size:32px;letter-spacing:-.5px}
.page-hd p{color:var(--warm);font-size:14px;margin-top:4px}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.fade{animation:fadeIn .3s ease}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:28px}
.stat{background:var(--bg);border:1px solid var(--border);border-radius:16px;padding:22px 20px}
.stat .lbl{font-size:11px;color:var(--warm);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px}
.stat .val{font-family:'DM Serif Display',serif;font-size:30px;line-height:1}
.stat.tl{border-left:4px solid var(--terra)}
.stat.sl{border-left:4px solid var(--sage)}
.stat.gl{border-left:4px solid var(--gold)}
.stat.rl{border-left:4px solid var(--red)}
.card{background:var(--bg);border:1px solid var(--border);border-radius:16px;padding:24px;margin-bottom:20px}
.card-title{font-family:'DM Serif Display',serif;font-size:18px;margin-bottom:18px;display:flex;align-items:center;gap:8px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media(max-width:900px){.g2{grid-template-columns:1fr}}
.t-row{display:flex;align-items:center;gap:14px;padding:16px;border-radius:12px;border:1px solid var(--border);background:#fff;cursor:pointer;transition:box-shadow .2s;margin-bottom:10px}
.t-row:hover{box-shadow:0 4px 16px rgba(0,0,0,.07)}
.t-info{flex:1}
.t-info strong{font-size:15px;display:block}
.t-info span{font-size:13px;color:var(--warm)}
.badge{font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
.mi{display:flex;align-items:flex-start;gap:14px;padding:16px;border-radius:12px;border:1px solid var(--border);background:#fff;margin-bottom:10px}
.mi-icon{width:40px;height:40px;border-radius:10px;background:#FDF3EE;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.mi-info{flex:1}
.mi-info strong{font-size:14px;display:block}
.mi-info .meta{font-size:12px;color:var(--warm);margin-top:3px}
.mi-info p{font-size:13px;color:#555;margin-top:6px;line-height:1.5}
.tbl-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--warm);padding:0 14px 12px;border-bottom:1px solid var(--border);font-weight:600;white-space:nowrap}
td{padding:13px 14px;border-bottom:1px solid var(--border);font-size:14px}
tr:last-child td{border-bottom:none}
tbody tr:hover td{background:var(--cream)}
.btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;transition:all .2s;font-family:'DM Sans',sans-serif}
.btn-p{background:var(--terra);color:#fff}.btn-p:hover{background:var(--terra-l)}
.btn-s{background:var(--sage);color:#fff}.btn-s:hover{background:var(--sage-l)}
.btn-o{background:transparent;border:1.5px solid var(--border);color:var(--dark)}.btn-o:hover{border-color:var(--terra);color:var(--terra)}
.btn-sm{padding:5px 10px;font-size:12px}
.btn-full{width:100%;justify-content:center}
.fg{margin-bottom:16px}
.fg label{font-size:12px;font-weight:600;color:var(--warm);text-transform:uppercase;letter-spacing:.7px;display:block;margin-bottom:6px}
.fg input,.fg select,.fg textarea{width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;background:#fff;color:var(--dark);transition:border-color .2s;outline:none}
.fg input:focus,.fg select:focus,.fg textarea:focus{border-color:var(--terra)}
.fg textarea{resize:vertical;min-height:80px}
.gr2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.pay-box{border-radius:20px;padding:28px;text-align:center;margin-bottom:20px}
.pay-box h3{font-family:'DM Serif Display',serif;font-size:24px;margin-bottom:4px}
.pay-box .amount{font-family:'DM Serif Display',serif;font-size:40px;margin:14px 0;color:var(--dark)}
.pay-box p{font-size:14px;color:var(--warm)}
.pay-box .sico{font-size:48px;margin-bottom:10px}
.cr{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid var(--border)}
.cr:last-child{border-bottom:none}
.cr .cn{font-size:14px;display:flex;align-items:center;gap:8px}
.cr .ca{font-weight:600;font-size:15px}
.overlay{position:fixed;inset:0;background:rgba(20,15,10,.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px}
.modal{background:var(--bg);border-radius:20px;padding:32px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto}
.modal-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
.modal-hd h3{font-family:'DM Serif Display',serif;font-size:22px}
.close-btn{background:none;border:none;font-size:20px;cursor:pointer;color:var(--warm);padding:4px}
.close-btn:hover{color:var(--dark)}
.prof-hd{display:flex;align-items:center;gap:18px;margin-bottom:24px}
.prof-hd-info h3{font-family:'DM Serif Display',serif;font-size:22px}
.prof-hd-info p{color:var(--warm);font-size:14px}
.prof-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pf-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--warm);font-weight:600;margin-bottom:3px}
.pf-val{font-size:15px;font-weight:500}
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
.toast{position:fixed;bottom:30px;right:30px;background:var(--dark);color:var(--cream);padding:14px 20px;border-radius:12px;font-size:14px;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.2);max-width:320px}
@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
.toast{animation:slideUp .3s ease}
.alert-banner{background:linear-gradient(135deg,#FDF6E3,#FAF0D0);border:1.5px solid var(--gold);border-radius:14px;padding:16px 20px;margin-bottom:16px;display:flex;align-items:flex-start;gap:12px}
.alert-banner .al-icon{font-size:24px;flex-shrink:0}
.alert-banner .al-title{font-weight:600;font-size:14px;margin-bottom:2px}
.alert-banner .al-sub{font-size:13px;color:var(--warm)}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:16px}
.cal-day-name{text-align:center;font-size:11px;color:var(--warm);font-weight:600;padding:4px 0;text-transform:uppercase}
.cal-day{aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:10px;font-size:13px;cursor:default;position:relative}
.cal-day.empty{background:transparent}
.cal-day.normal{background:#fff;border:1px solid var(--border)}
.cal-day.today-day{background:var(--terra);color:#fff;font-weight:700}
.cal-day.has-event{border:2px solid var(--gold);cursor:pointer}
.cal-day.has-expiry{border:2px solid var(--red);cursor:pointer}
.cal-event-dot{width:6px;height:6px;border-radius:50%;background:var(--gold);margin-top:2px}
.hamburger-btn{display:none}
@media(max-width:600px){
  .hamburger-btn{display:flex;position:fixed;top:10px;left:10px;z-index:60;background:var(--dark);border:none;color:var(--cream);font-size:18px;width:36px;height:36px;border-radius:10px;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)}
  .hamburger-btn.open{display:none}
}
.cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.cal-nav button{background:none;border:none;font-size:20px;cursor:pointer;color:var(--warm);padding:4px 8px}
.cal-nav button:hover{color:var(--dark)}
.cal-legend{display:flex;gap:16px;margin-top:12px;flex-wrap:wrap}
.cal-legend-item{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--warm)}
.cal-legend-dot{width:10px;height:10px;border-radius:50%}
.contract-card{background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:10px}
.contract-dates{display:flex;gap:16px;flex-wrap:wrap;margin-top:6px}
.contract-date-item{font-size:13px;color:var(--warm)}
.contract-date-item span{color:var(--dark);font-weight:500}
`;

export default function App() {
  const [lang,setLang]=useState(null);
  const [user,setUser]=useState(undefined);
  const [profile,setProfile]=useState(null);
  const [page,setPage]=useState("dashboard");
  const [modal,setModal]=useState(null);
  const [toast,setToast]=useState(null);
  const [saving,setSaving]=useState(false);
  const [tenants,setTenants]=useState([]);
  const [showNotif,setShowNotif]=useState(false);
  const [sidebarOpen,setSidebarOpen]=useState(true);
  const [documents,setDocuments]=useState([]);
  const [contracts,setContracts]=useState([]);

  const t=T[lang||"es"];
  const isOwner=profile?.role==="owner";
  const anniversaries=isOwner?checkIPC(tenants):[];

  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,async(u)=>{
      setUser(u);
      if(u){const snap=await getDoc(doc(db,"users",u.uid));if(snap.exists()){setProfile(snap.data());setLang(snap.data().lang||"es");}}
      else setProfile(null);
    });
    return unsub;
  },[]);

  useEffect(()=>{
    if(!isOwner)return;
    const q=query(collection(db,"users"),where("role","==","tenant"));
    const unsub=onSnapshot(q,snap=>setTenants(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return unsub;
  },[isOwner]);

  useEffect(()=>{
    if(!isOwner||!user)return;
    const q=query(collection(db,"documents",user.uid,"files"),orderBy("createdAt","desc"));
    const unsub=onSnapshot(q,snap=>setDocuments(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return unsub;
  },[isOwner,user]);

  async function saveDocument(docInfo){
    await addDoc(collection(db,"documents",user.uid,"files"),{...docInfo,createdAt:serverTimestamp()});
  }

  useEffect(()=>{
    if(!isOwner||!user)return;
    const q=query(collection(db,"contracts",user.uid,"files"),orderBy("createdAt","desc"));
    const unsub=onSnapshot(q,snap=>setContracts(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return unsub;
  },[isOwner,user]);

  async function saveContract(contractInfo){
    await addDoc(collection(db,"contracts",user.uid,"files"),{...contractInfo,createdAt:serverTimestamp()});
  }

  const showToast=(msg)=>{setToast(msg);setTimeout(()=>setToast(null),3000);};
  const persist=async(ref,data)=>{setSaving(true);await updateDoc(ref,data);setSaving(false);};

  if(user===undefined)return(<><style>{css}</style><div style={{minHeight:"100vh",background:"#1A1612",display:"flex",alignItems:"center",justifyContent:"center"}}><p style={{color:"#8C7B6E",fontFamily:"'DM Sans',sans-serif"}}>Cargando...</p></div></>);
  if(!lang&&!user)return(<><style>{css}</style><LangSelect onSelect={setLang}/></>);
  if(!user)return(<><style>{css}</style><LoginScreen t={t} onLogin={(u,p)=>{setUser(u);setProfile(p);setPage(p.role==="owner"?"dashboard":"t-home");}}/></>);

  const ownerNav=[
    {id:"dashboard",icon:"📊",label:t.dashboard},
    {id:"tenants",icon:"👥",label:t.tenants},
    {id:"finances",icon:"💰",label:t.finances},
    {id:"maintenance",icon:"🔧",label:t.maintenance},
    {id:"calendar",icon:"📅",label:t.calendar},
    {id:"messages",icon:"💬",label:t.messages},
    {id:"documentos",icon:"📁",label:t.documents},
    {id:"contratos",icon:"📝",label:t.contracts},
  ];
  const tenantNav=[
    {id:"t-home",icon:"🏠",label:t.myHome},
    {id:"t-costs",icon:"⚡",label:t.myCosts},
    {id:"t-maint",icon:"🔧",label:t.incidents},
    {id:"t-messages",icon:"💬",label:t.messages},
  ];
  const nav=isOwner?ownerNav:tenantNav;

  async function togglePayment(tenantId,month){
    const t2=tenants.find(x=>x.id===tenantId);if(!t2)return;
    const payments={...(t2.payments||{})};const cur=payments[month]||{paid:false};
    payments[month]={paid:!cur.paid,date:!cur.paid?today():null};
    await persist(doc(db,"users",tenantId),{payments});
    if(payments[month].paid)generateReceipt({tenantName:t2.name,unit:t2.unit,month,date:today()});
    showToast(payments[month].paid?"✅ Pago registrado · PDF descargado":"❌ Pago revertido");
  }

  async function changeStatus(tenantId,maintId,status){
    const t2=tenants.find(x=>x.id===tenantId);
    const maintenance=(t2.maintenance||[]).map(m=>m.id===maintId?{...m,status}:m);
    await persist(doc(db,"users",tenantId),{maintenance});
    showToast("✅ Estado actualizado");
  }

  async function sendMaintenance(type,desc){
    const maintenance=[...(profile.maintenance||[]),{id:Date.now(),type,date:today(),status:"Pendiente",desc}];
    await persist(doc(db,"users",user.uid),{maintenance});
    setProfile(p=>({...p,maintenance}));
    showToast("✅ Incidencia enviada");
  }

  async function addCost(tenantId,cost){
    const ten=tenants.find(x=>x.id===tenantId);
    const costs=[...(ten.costs||[]),{id:Date.now(),...cost}];
    await persist(doc(db,"users",tenantId),{costs});
    setModal(null);showToast("✅ Coste añadido");
  }

  async function deleteCost(tenantId,costId){
    const ten=tenants.find(x=>x.id===tenantId);
    const costs=(ten.costs||[]).filter(c=>c.id!==costId);
    await persist(doc(db,"users",tenantId),{costs});
    showToast("🗑️ Coste eliminado");
  }

  async function createTenant({name,unit,phone,rent,email,contractStart,contractEnd}){
    try{
      const tenantRef=doc(collection(db,"users"));
      await setDoc(tenantRef,{
        name,unit,phone:phone||"",rent:parseFloat(rent),email:email||"",role:"tenant",
        joined:today(),contractStart:contractStart||"",contractEnd:contractEnd||"",
        payments:{},costs:[],maintenance:[],lang:"es"
      });
      setModal(null);showToast("✅ Inquilino creado");
    }catch(e){showToast("❌ Error: "+e.message);}
  }

  async function editTenant(tenantId,data){
    await persist(doc(db,"users",tenantId),data);
    setModal(null);showToast("✅ Datos actualizados");
  }

  const renderPage=()=>{
    if(isOwner){
      if(page==="dashboard")return<Dashboard t={t} tenants={tenants} onSelect={id=>setModal({type:"profile",id})}/>;
      if(page==="tenants")return<Tenants t={t} tenants={tenants} onSelect={id=>setModal({type:"profile",id})} onNew={()=>setModal({type:"new-tenant"})} onEdit={id=>setModal({type:"edit-tenant",id})}/>;
      if(page==="finances")return<Finances t={t} tenants={tenants} onToggle={togglePayment} onAddCost={()=>setModal({type:"add-cost"})} onDeleteCost={deleteCost}/>;
      if(page==="maintenance")return<Maintenance t={t} tenants={tenants} onStatus={changeStatus}/>;
      if(page==="calendar")return<CalendarPage t={t} tenants={tenants}/>;
      if(page==="messages")return<OwnerMessages t={t} tenants={tenants} ownerId={user.uid}/>;
      if(page==="documentos")return<DocumentsPage t={t} tenants={tenants} documents={documents} onGenerate={async(year)=>{const info=generateAnnualExcel(tenants,year);await saveDocument(info);showToast("✅ "+t.docGenerated+" "+year);}}/>;
      if(page==="contratos")return<ContractsPage t={t} contracts={contracts} onNew={()=>setModal({type:"new-contract"})} onDownload={(c)=>generateContractDocx(c)}/>;
    }else{
      if(page==="t-home")return<TenantHome t={t} profile={profile}/>;
      if(page==="t-costs")return<TenantCosts t={t} profile={profile}/>;
      if(page==="t-maint")return<TenantMaintenance t={t} profile={profile} onSend={sendMaintenance}/>;
      if(page==="t-messages")return<TenantMessages t={t} tenantId={user.uid}/>;
    }
  };

  const renderModal=()=>{
    if(!modal)return null;
    if(modal.type==="profile"){const ten=tenants.find(x=>x.id===modal.id);return<TenantProfileModal t={t} tenant={ten} onToggle={togglePayment} onAddCost={addCost} onDeleteCost={deleteCost} onClose={()=>setModal(null)} onEdit={()=>setModal({type:"edit-tenant",id:modal.id})}/>;}
    if(modal.type==="new-tenant")return<NewTenantModal t={t} onClose={()=>setModal(null)} onSave={createTenant}/>;
    if(modal.type==="edit-tenant"){const ten=tenants.find(x=>x.id===modal.id);return<EditTenantModal t={t} tenant={ten} onClose={()=>setModal(null)} onSave={editTenant}/>;}
    if(modal.type==="add-cost")return<AddCostModal t={t} tenants={tenants} onSave={addCost} onClose={()=>setModal(null)}/>;
    if(modal.type==="new-contract")return<NewContractModal t={t} onClose={()=>setModal(null)} onSave={async(data)=>{
      const year=data.signYear;
      try{
        // Guardar inquilino directamente en Firestore (sin crear cuenta de acceso)
        const tenantRef=doc(collection(db,"users"));
        await setDoc(tenantRef,{
          name:data.tenantName, unit:data.unit, phone:data.phone||"",
          rent:parseFloat(data.rent), email:data.email||"", role:"tenant",
          joined:today(), contractStart:data.contractStartISO||"",
          contractEnd:data.contractEndISO||"",
          payments:{}, costs:[], maintenance:[], lang:"es"
        });
        // Guardar contrato
        await saveContract({...data, year, date:today(), tenantUid:tenantRef.id});
        showToast("✅ Inquilino y contrato guardados");
      }catch(e){
        showToast("⚠️ Error: "+e.message);
      }
    }}/>;
    return null;
  };

  const activeClass=(id)=>id===page?(isOwner?"nav-item active-o":"nav-item active-t"):"nav-item";

  return(
    <><style>{css}</style>
      <div className="app">
        <aside className={`sidebar${sidebarOpen?"":" collapsed"}`} style={{width:sidebarOpen?"220px":"64px",transition:"width .25s",overflow:"hidden",minWidth:sidebarOpen?"220px":"64px"}}> 
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 6px 0 10px",marginBottom:4}}>
            {sidebarOpen&&<div className="s-logo">Mi<em>Alquiler</em></div>}
            <button onClick={()=>setSidebarOpen(v=>!v)} style={{background:"none",border:"none",color:"var(--warm)",cursor:"pointer",fontSize:18,padding:"4px 6px",marginLeft:"auto"}}>{sidebarOpen?"◀":"▶"}</button>
          </div>
          {sidebarOpen&&<div className="s-role">{isOwner?t.owner:t.tenant}</div>}
          <nav className="s-nav">
            {nav.map(item=>(
              <button key={item.id} className={activeClass(item.id)} onClick={()=>setPage(item.id)} title={item.label}>
                <span>{item.icon}</span>{sidebarOpen&&" "+item.label}
              </button>
            ))}
          </nav>
          <div className="s-footer">
            <div className="av av-sm" style={{background:getColor(profile?.name||"")}}>{initials(profile?.name||"?")}</div>
            {sidebarOpen&&<div className="s-user-info">
              <strong>{profile?.name||user.email}</strong>
              <span>{isOwner?t.owner:profile?.unit}</span>
            </div>}
            {isOwner&&(
              <div className="notif-wrap">
                <button className="notif-btn" onClick={e=>{e.stopPropagation();setShowNotif(v=>!v);}}>
                  🔔{anniversaries.length>0&&<span className="notif-dot"/>}
                </button>
                {showNotif&&(
                  <div className="notif-panel" onClick={e=>e.stopPropagation()}>
                    <div className="notif-panel-title">{t.notifications}</div>
                    {anniversaries.length===0
                      ?<div style={{fontSize:13,color:"var(--warm)"}}>{t.noNotifications}</div>
                      :anniversaries.map((a,i)=>(
                        <div key={i} className="notif-item">
                          {a.type==="ipc"&&`📈 ${a.tenant.name} · Subida IPC (${a.years} año/s) · desde ${a.tenant.contractStart}`}
                          {a.type==="signed_today"&&`📝 ${a.tenant.name} · ${t.contractSigned} ${a.tenant.contractStart}`}
                          {a.type==="expiring"&&`⚠️ ${a.tenant.name} · ${t.contractExpires} ${a.tenant.contractEnd} (${a.daysLeft} días)`}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
            <button className="logout-btn" onClick={()=>signOut(auth)} title={t.logout}>↩</button>
          </div>
        </aside>
        <main className="content fade" key={page} style={{marginLeft:sidebarOpen?"220px":"64px",transition:"margin-left .25s",minWidth:0,width:"100%"}} onClick={()=>setShowNotif(false)}>
          {!sidebarOpen&&<button className="hamburger-btn" onClick={e=>{e.stopPropagation();setSidebarOpen(true);}}>☰</button>}
          {saving&&<div className="saving">{t.saving}</div>}
          {isOwner&&anniversaries.length>0&&page==="dashboard"&&anniversaries.map((a,i)=>(
            <div key={i} className="alert-banner">
              <div className="al-icon">{a.type==="expiring"?"⚠️":"🎂"}</div>
              <div>
                <div className="al-title">
                  {a.type==="ipc"&&`${t.contractAnniversary} · ${a.tenant.name}`}
                  {a.type==="signed_today"&&`📝 ${a.tenant.name}`}
                  {a.type==="expiring"&&`${t.contractExpires} · ${a.tenant.name}`}
                </div>
                <div className="al-sub">
                  {a.type==="ipc"&&`Lleva ${a.years} año/s · Revisa el IPC · Contrato desde ${a.tenant.contractStart}`}
                  {a.type==="signed_today"&&`${t.contractSigned} ${a.tenant.contractStart}`}
                  {a.type==="expiring"&&`${a.tenant.contractEnd} · ${a.daysLeft} días restantes`}
                </div>
              </div>
            </div>
          ))}
          {renderPage()}
        </main>
      </div>
      {modal&&<div className="overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>{renderModal()}</div>}
      {toast&&<div className="toast">{toast}</div>}
    </>
  );
}

function LangSelect({onSelect}){
  return(
    <div className="lang-screen">
      <h1 className="lang-title">Mi<em>Alquiler</em></h1>
      <div className="lang-cards">
        {[{code:"es",flag:"🇪🇸",label:"Español"},{code:"en",flag:"🇬🇧",label:"English"},{code:"ar",flag:"🇸🇦",label:"العربية"}].map(l=>(
          <div key={l.code} className="lang-card" onClick={()=>onSelect(l.code)}>
            <div className="flag">{l.flag}</div><p>{l.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoginScreen({t,onLogin}){
  const [email,setEmail]=useState("");const [pass,setPass]=useState("");
  const [err,setErr]=useState("");const [loading,setLoading]=useState(false);
  const handle=async()=>{
    setErr("");setLoading(true);
    try{
      const cred=await signInWithEmailAndPassword(auth,email,pass);
      window._ownerPass=pass;
      const snap=await getDoc(doc(db,"users",cred.user.uid));
      if(snap.exists())onLogin(cred.user,snap.data());
    }catch{setErr(t.wrongCredentials);}
    setLoading(false);
  };
  return(
    <div className="login-wrap"><div className="login-box">
      <h2>{t.loginTitle}</h2><p>MiAlquiler · {t.owner} / {t.tenant}</p>
      {err&&<div className="login-err">{err}</div>}
      <div className="fg"><label>{t.email}</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()}/></div>
      <div className="fg"><label>{t.password}</label><input type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()}/></div>
      <button className="btn btn-p btn-full" onClick={handle} disabled={loading}>{loading?"...":t.login}</button>
    </div></div>
  );
}

function Dashboard({t,tenants,onSelect}){
  const totalRent=tenants.reduce((s,t2)=>s+(t2.rent||0),0);
  const currentMonth=new Date().toLocaleString("es-ES",{month:"long",year:"numeric"});
  const paidCount=tenants.filter(t2=>Object.values(t2.payments||{}).some(p=>p.paid)).length;
  const pendingMaint=tenants.reduce((s,t2)=>s+(t2.maintenance||[]).filter(m=>m.status==="Pendiente").length,0);
  const allMaint=tenants.flatMap(t2=>(t2.maintenance||[]).map(m=>({...m,tenant:t2}))).slice(0,4);
  return(
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
          {tenants.length===0?<p style={{color:"var(--warm)",fontSize:14}}>{t.noTenants}</p>:
            tenants.slice(0,4).map(ten=>(
              <div key={ten.id} className="t-row" onClick={()=>onSelect(ten.id)}>
                <div className="av av-md" style={{background:getColor(ten.name)}}>{initials(ten.name)}</div>
                <div className="t-info"><strong>{ten.name}</strong><span>{ten.unit}</span></div>
                <span style={{color:"var(--warm)",fontSize:18}}>›</span>
              </div>
            ))}
        </div>
        <div className="card">
          <div className="card-title">🔧 {t.recentIncidents}</div>
          {allMaint.length===0?<p style={{color:"var(--warm)",fontSize:14}}>🎉 Sin incidencias</p>:
            allMaint.map(m=>(
              <div key={m.id} className="mi">
                <div className="mi-icon">{maintIcons[m.type]||"🔧"}</div>
                <div className="mi-info"><strong>{m.type}</strong><div className="meta">{m.tenant.name} · {m.date}</div><p>{m.desc}</p></div>
                <StatusBadge status={m.status} t={t}/>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function Tenants({t,tenants,onSelect,onNew,onEdit}){
  return(
    <div>
      <div className="page-hd" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div><h2>{t.tenants}</h2><p>{tenants.length} {t.activeTenants.toLowerCase()}</p></div>
        <button className="btn btn-p" onClick={onNew}>➕ {t.newTenant}</button>
      </div>
      {tenants.length===0?<div className="card"><p style={{color:"var(--warm)",fontSize:14,textAlign:"center",padding:20}}>{t.noTenants}</p></div>:
        tenants.map(ten=>(
          <div key={ten.id} className="t-row">
            <div className="av av-md" style={{background:getColor(ten.name)}} onClick={()=>onSelect(ten.id)}>{initials(ten.name)}</div>
            <div className="t-info" style={{flex:1}} onClick={()=>onSelect(ten.id)}>
              <strong>{ten.name}</strong>
              <span>{ten.unit} · {ten.contractStart||"—"} → {ten.contractEnd||"—"}</span>
            </div>
            <div style={{textAlign:"right",marginRight:8}}>
              <div style={{fontWeight:600,fontSize:16}}>{ten.rent}€<span style={{fontSize:12,fontWeight:400,color:"var(--warm)"}}>/mes</span></div>
            </div>
            <button className="btn btn-o btn-sm" onClick={()=>onEdit(ten.id)}>✏️</button>
          </div>
        ))}
    </div>
  );
}

function Finances({t,tenants,onToggle,onAddCost,onDeleteCost}){
  const now=new Date();
  const startYear=2024; const endYear=startYear+15;
  const monthNames=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const allMonths=[];
  for(let y=startYear;y<endYear;y++) monthNames.forEach(m=>allMonths.push(`${m} ${y}`));

  const [selYear,setSelYear]=useState(now.getFullYear());
  const [tab,setTab]=useState("pagos"); // pagos | gastos | graficos
  const years=Array.from({length:15},(_,i)=>startYear+i);
  const monthsOfYear=monthNames.map(m=>`${m} ${selYear}`);

  // Chart data for selected year
  const chartData=monthsOfYear.map(m=>{
    const ingresos=tenants.filter(ten=>(ten.payments||{})[m]?.paid).reduce((s,ten)=>s+(ten.rent||0),0);
    const gastos=tenants.reduce((s,ten)=>s+(ten.costs||[]).filter(c=>c.month===m&&c.tipo!=="inversion").reduce((ss,c)=>ss+(c.amount||0),0),0);
    const inversion=tenants.reduce((s,ten)=>s+(ten.costs||[]).filter(c=>c.month===m&&c.tipo==="inversion").reduce((ss,c)=>ss+(c.amount||0),0),0);
    const profit=ingresos-gastos-inversion;
    return{name:m.split(" ")[0].slice(0,3),Ingresos:ingresos,Gastos:gastos,Inversión:inversion,Profit:profit};
  });

  // Yearly totals
  const totalIngresos=chartData.reduce((s,d)=>s+d.Ingresos,0);
  const totalGastos=chartData.reduce((s,d)=>s+d.Gastos,0);
  const totalInversion=chartData.reduce((s,d)=>s+d.Inversión,0);
  const totalProfit=totalIngresos-totalGastos-totalInversion;

  return(
    <div>
      <div className="page-hd" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
        <h2>{t.finances}</h2>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <select className="status-sel" style={{padding:"8px 12px",fontSize:14}} value={selYear} onChange={e=>setSelYear(parseInt(e.target.value))}>
            {years.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {["pagos","gastos","graficos"].map(tb=>(
          <button key={tb} className={`chat-tab${tab===tb?" active":""}`} onClick={()=>setTab(tb)}>
            {tb==="pagos"?"💶 Pagos":tb==="gastos"?"⚡ Gastos":"📊 Gráficos"}
          </button>
        ))}
      </div>

      {/* RESUMEN ANUAL */}
      <div className="stats" style={{marginBottom:20}}>
        <div className="stat sl"><div className="lbl">Ingresos {selYear}</div><div className="val">{totalIngresos}€</div></div>
        <div className="stat rl"><div className="lbl">Gastos {selYear}</div><div className="val">{totalGastos}€</div></div>
        <div className="stat gl"><div className="lbl">Inversión {selYear}</div><div className="val">{totalInversion}€</div></div>
        <div className="stat tl"><div className="lbl">Profit {selYear}</div><div className="val" style={{color:totalProfit>=0?"var(--green)":"var(--red)"}}>{totalProfit}€</div></div>
      </div>

      {/* TAB PAGOS */}
      {tab==="pagos"&&(
        <div className="card">
          <div className="card-title">💶 {t.paymentHistory} · {selYear}</div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>{t.name}</th><th>{t.unit}</th><th>{t.rent}</th>{monthsOfYear.map(m=><th key={m}>{m.split(" ")[0].slice(0,3)}</th>)}</tr></thead>
              <tbody>
                {tenants.map(ten=>(
                  <tr key={ten.id}>
                    <td><strong>{ten.name}</strong></td><td>{ten.unit}</td><td>{ten.rent}€</td>
                    {monthsOfYear.map(m=>{
                      const p=(ten.payments||{})[m];
                      return(<td key={m}><span className="badge" style={p?.paid?{background:"#E6F4ED",color:"#4A9B6F",cursor:"pointer"}:{background:"#FDECEA",color:"#D94F3D",cursor:"pointer"}} onClick={()=>onToggle(ten.id,m)}>{p?.paid?"✓":"✗"}</span></td>);
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB GASTOS */}
      {tab==="gastos"&&(
        <div className="card">
          <div className="card-title">⚡ {t.costBreakdown} · {selYear}</div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>{t.name}</th><th>{t.concept}</th><th>Tipo</th><th>{t.month}</th><th>{t.amount}</th><th></th></tr></thead>
              <tbody>
                {tenants.flatMap(ten=>(ten.costs||[]).filter(c=>c.month?.includes(String(selYear))).map(c=>(
                  <tr key={c.id}>
                    <td>{ten.name}</td>
                    <td>
                      <div>{c.icon} {c.name}</div>
                      {c.nota&&<div style={{fontSize:11,color:"var(--warm)",marginTop:2}}>📝 {c.nota}</div>}
                    </td>
                    <td><span className="badge" style={c.tipo==="inversion"?{background:"#EEF2FF",color:"#4F46E5"}:{background:"#FDF6E3",color:"#D4A853"}}>
                      {c.tipo==="inversion"?"🏗️ Inversión":"💸 Gasto"}
                    </span></td>
                    <td>{c.month}</td>
                    <td>{c.amount}€</td>
                    <td><button className="btn btn-o btn-sm" style={{color:"var(--red)",borderColor:"var(--red)"}} onClick={()=>onDeleteCost(ten.id,c.id)}>🗑️</button></td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
          <div style={{marginTop:14}}><button className="btn btn-p" onClick={onAddCost}>➕ {t.addCost}</button></div>
        </div>
      )}

      {/* TAB GRAFICOS */}
      {tab==="graficos"&&(
        <div className="card">
          <div className="card-title">📊 Gráfico anual · {selYear}</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{top:8,right:8,left:0,bottom:0}}>
              <XAxis dataKey="name" tick={{fontSize:11}}/>
              <YAxis tick={{fontSize:11}} unit="€"/>
              <Tooltip formatter={v=>v+"€"}/>
              <Legend/>
              <Bar dataKey="Ingresos" fill="#7A9E7E" radius={[4,4,0,0]}/>
              <Bar dataKey="Gastos" fill="#D94F3D" radius={[4,4,0,0]}/>
              <Bar dataKey="Inversión" fill="#4F46E5" radius={[4,4,0,0]}/>
              <Bar dataKey="Profit" fill="#C4622D" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
          <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:8}}>
            {chartData.filter(d=>d.Ingresos>0||d.Gastos>0||d.Inversión>0).map(d=>(
              <div key={d.name} style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",background:"var(--cream)",borderRadius:10,fontSize:13}}>
                <span style={{fontWeight:600,width:40}}>{d.name}</span>
                <span style={{color:"var(--green)"}}>🟢 {d.Ingresos}€</span>
                <span style={{color:"var(--red)"}}>🔴 {d.Gastos}€</span>
                <span style={{color:"#4F46E5"}}>🏗️ {d.Inversión}€</span>
                <span style={{fontWeight:600,color:d.Profit>=0?"var(--green)":"var(--red)"}}>{d.Profit>=0?"✅":"⚠️"} {d.Profit}€</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Maintenance({t,tenants,onStatus}){
  const all=tenants.flatMap(ten=>(ten.maintenance||[]).map(m=>({...m,tenant:ten})));
  return(
    <div>
      <div className="page-hd"><h2>{t.maintenance}</h2></div>
      {all.length===0?<div className="card"><p style={{color:"var(--warm)",textAlign:"center",padding:20}}>🎉 {t.noIncidents}</p></div>:
        all.map(m=>(
          <div key={m.id} className="mi">
            <div className="mi-icon">{maintIcons[m.type]||"🔧"}</div>
            <div className="mi-info"><strong>{m.type}</strong><div className="meta">{m.tenant.name} · {m.tenant.unit} · {m.date}</div><p>{m.desc}</p></div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
              <StatusBadge status={m.status} t={t}/>
              <select className="status-sel" value={m.status} onChange={e=>onStatus(m.tenant.id,m.id,e.target.value)}>
                <option>Pendiente</option><option>En revisión</option><option>Resuelto</option>
              </select>
            </div>
          </div>
        ))}
    </div>
  );
}

function CalendarPage({t,tenants}){
  const now=new Date();
  const [year,setYear]=useState(now.getFullYear());
  const [month,setMonth]=useState(now.getMonth());
  const [selected,setSelected]=useState(null);
  const daysInMonth=new Date(year,month+1,0).getDate();
  const firstDay=new Date(year,month,1).getDay();
  const isCurrentMonth=now.getMonth()===month&&now.getFullYear()===year;
  const monthName=new Date(year,month,1).toLocaleString("es-ES",{month:"long",year:"numeric"});
  const events={};
  tenants.forEach(ten=>{
    if(ten.contractStart){
      const d=new Date(ten.contractStart);
      if(d.getMonth()===month){
        const day=d.getDate();
        if(!events[day])events[day]=[];
        events[day].push({name:ten.name,type:d.getFullYear()===year?"start":"anniversary"});
      }
    }
    if(ten.contractEnd){
      const d=new Date(ten.contractEnd);
      if(d.getMonth()===month&&d.getFullYear()===year){
        const day=d.getDate();
        if(!events[day])events[day]=[];
        events[day].push({name:ten.name,type:"end"});
      }
    }
  });
  const dayNames=["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
  const prevMonth=()=>{if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1);setSelected(null);};
  const nextMonth=()=>{if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1);setSelected(null);};
  const offset=firstDay===0?6:firstDay-1;
  return(
    <div>
      <div className="page-hd"><h2>📅 {t.calendar}</h2></div>
      <div className="card">
        <div className="cal-nav">
          <button onClick={prevMonth}>‹</button>
          <strong style={{fontFamily:"'DM Serif Display',serif",fontSize:18,textTransform:"capitalize"}}>{monthName}</strong>
          <button onClick={nextMonth}>›</button>
        </div>
        <div className="cal-grid">
          {dayNames.map(d=><div key={d} className="cal-day-name">{d}</div>)}
          {Array(offset).fill(null).map((_,i)=><div key={"e"+i} className="cal-day empty"/>)}
          {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
            const ev=events[day];
            const hasEnd=ev?.some(e=>e.type==="end");
            const isToday=isCurrentMonth&&day===now.getDate();
            return(
              <div key={day}
                className={`cal-day ${isToday?"today-day":hasEnd?"has-expiry":ev?"has-event":"normal"}`}
                onClick={()=>setSelected(ev?day:null)}>
                {day}
                {ev&&!isToday&&<div className="cal-event-dot" style={{background:hasEnd?"var(--red)":"var(--gold)"}}/>}
              </div>
            );
          })}
        </div>
        <div className="cal-legend">
          <div className="cal-legend-item"><div className="cal-legend-dot" style={{background:"var(--terra)"}}/> Hoy</div>
          <div className="cal-legend-item"><div className="cal-legend-dot" style={{background:"var(--gold)"}}/> Inicio/Aniversario</div>
          <div className="cal-legend-item"><div className="cal-legend-dot" style={{background:"var(--red)"}}/> Fin contrato</div>
        </div>
        {selected&&events[selected]&&(
          <div style={{marginTop:16,padding:16,background:"var(--cream)",borderRadius:12}}>
            <div style={{fontWeight:600,marginBottom:8}}>📅 {selected} de {new Date(year,month,1).toLocaleString("es-ES",{month:"long"})}</div>
            {events[selected].map((e,i)=>(
              <div key={i} style={{fontSize:14,marginBottom:4}}>
                {e.type==="start"&&`🟢 ${e.name} — Inicio de contrato`}
                {e.type==="anniversary"&&`📈 ${e.name} — Subida IPC`}
                {e.type==="end"&&`🔴 ${e.name} — Fin de contrato`}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card">
        <div className="card-title">📋 Contratos</div>
        {tenants.length===0?<p style={{color:"var(--warm)",fontSize:14}}>{t.noTenants}</p>:
          tenants.map(ten=>(
            <div key={ten.id} className="contract-card">
              <strong>{ten.name} · {ten.unit}</strong>
              <div className="contract-dates">
                <div className="contract-date-item">{t.contractStart}: <span>{ten.contractStart||"—"}</span></div>
                <div className="contract-date-item">{t.contractEnd}: <span>{ten.contractEnd||"—"}</span></div>
                <div className="contract-date-item">{t.rent}: <span>{ten.rent}€/mes</span></div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function OwnerMessages({t,tenants,ownerId}){
  const [activeTenant,setActiveTenant]=useState(tenants[0]?.id||null);
  useEffect(()=>{if(!activeTenant&&tenants.length>0)setActiveTenant(tenants[0].id);},[tenants]);
  if(tenants.length===0)return<div className="page-hd"><h2>{t.messages}</h2><p style={{color:"var(--warm)"}}>{t.noTenants}</p></div>;
  return(
    <div>
      <div className="page-hd"><h2>{t.messages}</h2></div>
      <div className="chat-tabs">
        {tenants.map(ten=>(<button key={ten.id} className={`chat-tab ${activeTenant===ten.id?"active":""}`} onClick={()=>setActiveTenant(ten.id)}>{ten.name.split(" ")[0]}</button>))}
      </div>
      {activeTenant&&<ChatWindow roomId={[ownerId,activeTenant].sort().join("_")} senderId={ownerId} t={t}/>}
    </div>
  );
}

function TenantMessages({t,tenantId}){
  const [ownerId,setOwnerId]=useState(null);
  useEffect(()=>{const q=query(collection(db,"users"),where("role","==","owner"));onSnapshot(q,snap=>{if(!snap.empty)setOwnerId(snap.docs[0].id);});},[]);
  if(!ownerId)return<div className="page-hd"><h2>{t.messages}</h2></div>;
  return(<div><div className="page-hd"><h2>{t.messages}</h2></div><ChatWindow roomId={[ownerId,tenantId].sort().join("_")} senderId={tenantId} t={t}/></div>);
}

function ChatWindow({roomId,senderId,t}){
  const [messages,setMessages]=useState([]);const [text,setText]=useState("");const bottomRef=useRef(null);
  useEffect(()=>{const q=query(collection(db,"chats",roomId,"messages"),orderBy("createdAt"));const unsub=onSnapshot(q,snap=>{setMessages(snap.docs.map(d=>({id:d.id,...d.data()})));});return unsub;},[roomId]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  const sendMsg=async()=>{if(!text.trim())return;await addDoc(collection(db,"chats",roomId,"messages"),{text:text.trim(),senderId,createdAt:serverTimestamp()});setText("");};
  return(
    <div className="chat-wrap">
      <div className="chat-messages">
        {messages.length===0&&<p style={{color:"var(--warm)",fontSize:14,textAlign:"center",margin:"auto"}}>{t.noMessages}</p>}
        {messages.map(m=>(<div key={m.id} className={`msg ${m.senderId===senderId?"mine":"theirs"}`}>{m.text}<div className="msg-meta">{m.createdAt?.toDate?.()?.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}</div></div>))}
        <div ref={bottomRef}/>
      </div>
      <div className="chat-input">
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()} placeholder={t.typeMsg}/>
        <button className="btn btn-p" onClick={sendMsg}>↑</button>
      </div>
    </div>
  );
}

function TenantHome({t,profile}){
  if(!profile)return null;
  const months=Object.keys(profile.payments||{});
  const current=months[months.length-1]||"";
  const p=(profile.payments||{})[current]||{paid:false};
  return(
    <div>
      <div className="page-hd"><h2>{t.hello}, {profile.name?.split(" ")[0]} 👋</h2><p>{profile.unit}</p></div>
      <div className="pay-box" style={p.paid?{background:"linear-gradient(135deg,#E6F4ED,#D0EBDA)",border:"2px solid #4A9B6F"}:{background:"linear-gradient(135deg,#FDECEA,#FAD8D5)",border:"2px solid #D94F3D"}}>
        <div className="sico">{p.paid?"✅":"⚠️"}</div>
        <h3>{p.paid?`${t.paid} ✓`:t.pending}</h3>
        <div className="amount">{profile.rent}€</div>
        <p>{p.paid?`${t.registered} ${p.date}`:`${t.dueThisMonth} · ${current}`}</p>
      </div>
      <div className="card">
        <div className="card-title">📋 {t.paymentHistory}</div>
        {months.length===0?<p style={{color:"var(--warm)",fontSize:14}}>{t.pending}</p>:
          months.map(m=>{const pm=(profile.payments||{})[m];return(<div key={m} className="cr"><div className="cn">{m}</div><span className="badge" style={pm.paid?{background:"#E6F4ED",color:"#4A9B6F"}:{background:"#FDECEA",color:"#D94F3D"}}>{pm.paid?`✓ ${pm.date}`:"✗ Pendiente"}</span></div>);})}
      </div>
    </div>
  );
}

function TenantCosts({t,profile}){
  const costs=profile?.costs||[];
  const total=costs.reduce((s,c)=>s+(c.amount||0),0);
  return(
    <div>
      <div className="page-hd"><h2>{t.myCosts}</h2></div>
      <div className="stats">
        <div className="stat gl"><div className="lbl">{t.totalCosts}</div><div className="val">{total}€</div></div>
        <div className="stat tl"><div className="lbl">{t.monthlyRent}</div><div className="val">{profile?.rent}€</div></div>
      </div>
      <div className="card">
        <div className="card-title">⚡ {t.costBreakdown}</div>
        {costs.length===0?<p style={{color:"var(--warm)",fontSize:14}}>{t.noCosts}</p>:
          costs.map(c=>(<div key={c.id} className="cr"><div className="cn"><span style={{fontSize:20}}>{c.icon}</span><div><div>{c.name}</div><div style={{fontSize:12,color:"var(--warm)"}}>{c.month}</div></div></div><div className="ca">{c.amount}€</div></div>))}
        {costs.length>0&&<><hr/><div className="cr"><div className="cn"><strong>Total</strong></div><div className="ca" style={{fontSize:18}}>{total}€</div></div></>}
      </div>
    </div>
  );
}

function TenantMaintenance({t,profile,onSend}){
  const [type,setType]=useState("Fontanería");const [desc,setDesc]=useState("");
  const types=["Fontanería","Electricidad","Calefacción","Ventanas","Electrodomésticos","Otros"];
  const handle=()=>{if(!desc.trim())return;onSend(type,desc.trim());setDesc("");};
  return(
    <div>
      <div className="page-hd"><h2>{t.incidents}</h2></div>
      <div className="card">
        <div className="card-title">➕ {t.sendIncident}</div>
        <div className="fg"><label>{t.incidentType}</label><select value={type} onChange={e=>setType(e.target.value)}>{types.map(o=><option key={o}>{o}</option>)}</select></div>
        <div className="fg"><label>{t.description}</label><textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="..."/></div>
        <button className="btn btn-s" onClick={handle}>📤 {t.sendIncident}</button>
      </div>
      <div className="card">
        <div className="card-title">🕐 {t.incidents}</div>
        {(profile?.maintenance||[]).length===0?<p style={{color:"var(--warm)",fontSize:14}}>{t.noIncidents}</p>:
          (profile.maintenance||[]).map(m=>(<div key={m.id} className="mi"><div className="mi-icon">{maintIcons[m.type]||"🔧"}</div><div className="mi-info"><strong>{m.type}</strong><div className="meta">{m.date}</div><p>{m.desc}</p></div><StatusBadge status={m.status} t={t}/></div>))}
      </div>
    </div>
  );
}

function TenantProfileModal({t,tenant,onToggle,onAddCost,onDeleteCost,onClose,onEdit}){
  const now=new Date();
  const monthNames=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const startYear=2024;
  const allMonths=[];
  for(let y=startYear;y<startYear+15;y++) monthNames.forEach(m=>allMonths.push(`${m} ${y}`));
  const currentMonth=`${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  const [costType,setCostType]=useState("💡 Electricidad");
  const [costTipo,setCostTipo]=useState("gasto");
  const [costAmt,setCostAmt]=useState("");
  const [costMonth,setCostMonth]=useState(currentMonth);
  const [costNota,setCostNota]=useState("");
  const months=Object.keys(tenant?.payments||{});
  const icons={"💡 Electricidad":"💡","💧 Agua":"💧","🌡️ Calefacción":"🌡️","🗑️ Basuras":"🗑️","🏗️ Inversión":"🏗️","Otro":"📋"};
  if(!tenant)return null;
  const handleAddCost=()=>{
    if(!costAmt||!costMonth)return;
    const icon=icons[costType]||"📋";const name=costType.replace(/^[^\s]+\s/,"");
    onAddCost(tenant.id,{icon,name,month:costMonth,amount:parseFloat(costAmt),tipo:costTipo,nota:costNota});setCostAmt("");setCostNota("");
  };
  return(
    <div className="modal">
      <div className="modal-hd">
        <h3>{tenant.name}</h3>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-o btn-sm" onClick={onEdit}>✏️ {t.editData}</button>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
      </div>
      <div className="prof-hd">
        <div className="av av-lg" style={{background:getColor(tenant.name)}}>{initials(tenant.name)}</div>
        <div className="prof-hd-info"><h3>{tenant.name}</h3><p>{tenant.unit} · {t.joinedSince} {tenant.joined}</p></div>
      </div>
      <div className="prof-grid">
        <div><div className="pf-lbl">{t.phone}</div><div className="pf-val">{tenant.phone}</div></div>
        <div><div className="pf-lbl">{t.email}</div><div className="pf-val" style={{fontSize:12}}>{tenant.email}</div></div>
        <div><div className="pf-lbl">{t.rent}</div><div className="pf-val">{tenant.rent}€/mes</div></div>
        <div><div className="pf-lbl">{t.contractStart}</div><div className="pf-val">{tenant.contractStart||"—"}</div></div>
        <div><div className="pf-lbl">{t.contractEnd}</div><div className="pf-val">{tenant.contractEnd||"—"}</div></div>
      </div>
      <hr/>
      <div className="serif" style={{fontSize:16,marginBottom:12}}>{t.paymentHistory}</div>
      {months.map(m=>{const p=(tenant.payments||{})[m];return(<div key={m} className="cr"><div className="cn">{m}</div><div style={{display:"flex",alignItems:"center",gap:8}}><span className="badge" style={p.paid?{background:"#E6F4ED",color:"#4A9B6F"}:{background:"#FDECEA",color:"#D94F3D"}}>{p.paid?`✓ ${p.date}`:"✗ Pendiente"}</span><button className="btn btn-o btn-sm" onClick={()=>onToggle(tenant.id,m)}>{p.paid?t.revert:t.markPaid}</button></div></div>);})}
      <hr/>
      <div className="serif" style={{fontSize:16,marginBottom:12}}>⚡ Costes registrados</div>
      {(tenant.costs||[]).length===0
        ?<p style={{fontSize:13,color:"var(--warm)",marginBottom:12}}>{t.noCosts}</p>
        :(tenant.costs||[]).map(c=>(
          <div key={c.id} style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid var(--border)"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:14}}>{c.icon} {c.name} · <strong>{c.amount}€</strong></div>
              <div style={{fontSize:12,color:"var(--warm)"}}>{c.month} · {c.tipo==="inversion"?"🏗️ Inversión (tuya)":"💸 Gasto"}</div>
              {c.nota&&<div style={{fontSize:12,color:"#555",marginTop:2}}>📝 {c.nota}</div>}
            </div>
            <button className="btn btn-o btn-sm" style={{color:"var(--red)",borderColor:"var(--red)",marginLeft:8,flexShrink:0}} onClick={()=>onDeleteCost(tenant.id,c.id)}>🗑️</button>
          </div>
        ))}
      <div style={{marginBottom:16}}/>
      <div className="serif" style={{fontSize:16,marginBottom:12}}>➕ {t.addCost}</div>
      <div className="fg">
        <label>Tipo</label>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <button className={`btn btn-sm ${costTipo==="gasto"?"btn-p":"btn-o"}`} onClick={()=>setCostTipo("gasto")}>💸 Gasto</button>
          <button className={`btn btn-sm ${costTipo==="inversion"?"btn-s":"btn-o"}`} onClick={()=>setCostTipo("inversion")}>🏗️ Inversión (mía)</button>
        </div>
      </div>
      <div className="gr2">
        <div className="fg"><label>{t.concept}</label><select value={costType} onChange={e=>setCostType(e.target.value)}>{["💡 Electricidad","💧 Agua","🌡️ Calefacción","🗑️ Basuras","🏗️ Inversión","Otro"].map(o=><option key={o}>{o}</option>)}</select></div>
        <div className="fg"><label>{t.amount}</label><input type="number" value={costAmt} onChange={e=>setCostAmt(e.target.value)} placeholder="0"/></div>
      </div>
      <div className="fg"><label>{t.month}</label>
        <select value={costMonth} onChange={e=>setCostMonth(e.target.value)}>
          {allMonths.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className="fg"><label>📝 Nota (opcional)</label><textarea value={costNota} onChange={e=>setCostNota(e.target.value)} placeholder="Ej: Cambio de caldera..."/></div>
      <button className="btn btn-p" onClick={handleAddCost}>➕ {t.addCost}</button>
    </div>
  );
}

function EditTenantModal({t,tenant,onClose,onSave}){
  const [form,setForm]=useState({
    name:tenant?.name||"",unit:tenant?.unit||"",phone:tenant?.phone||"",
    rent:tenant?.rent||"",email:tenant?.email||"",
    contractStart:tenant?.contractStart||"",contractEnd:tenant?.contractEnd||""
  });
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  if(!tenant)return null;
  return(
    <div className="modal">
      <div className="modal-hd"><h3>✏️ {t.editTenant}</h3><button className="close-btn" onClick={onClose}>✕</button></div>
      <div className="fg"><label>{t.name}</label><input value={form.name} onChange={e=>set("name",e.target.value)}/></div>
      <div className="gr2">
        <div className="fg"><label>{t.unit}</label><input value={form.unit} onChange={e=>set("unit",e.target.value)}/></div>
        <div className="fg"><label>{t.phone}</label><input value={form.phone} onChange={e=>set("phone",e.target.value)}/></div>
      </div>
      <div className="gr2">
        <div className="fg"><label>{t.rent}</label><input type="number" value={form.rent} onChange={e=>set("rent",parseFloat(e.target.value))}/></div>
        <div className="fg"><label>{t.email}</label><input type="email" value={form.email} onChange={e=>set("email",e.target.value)}/></div>
      </div>
      <hr/>
      <div className="gr2">
        <div className="fg"><label>{t.contractStart}</label><input type="date" value={form.contractStart} onChange={e=>set("contractStart",e.target.value)}/></div>
        <div className="fg"><label>{t.contractEnd}</label><input type="date" value={form.contractEnd} onChange={e=>set("contractEnd",e.target.value)}/></div>
      </div>
      <button className="btn btn-p btn-full" onClick={()=>onSave(tenant.id,form)}>💾 {t.save}</button>
    </div>
  );
}

function NewTenantModal({t,onClose,onSave}){
  const [form,setForm]=useState({name:"",unit:"",phone:"",rent:"",email:"",password:"",contractStart:"",contractEnd:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  return(
    <div className="modal">
      <div className="modal-hd"><h3>➕ {t.newTenant}</h3><button className="close-btn" onClick={onClose}>✕</button></div>
      <div className="fg"><label>{t.name}</label><input value={form.name} onChange={e=>set("name",e.target.value)}/></div>
      <div className="gr2">
        <div className="fg"><label>{t.unit}</label><input value={form.unit} onChange={e=>set("unit",e.target.value)}/></div>
        <div className="fg"><label>{t.phone}</label><input value={form.phone} onChange={e=>set("phone",e.target.value)}/></div>
      </div>
      <div className="fg"><label>{t.rent}</label><input type="number" value={form.rent} onChange={e=>set("rent",e.target.value)}/></div>
      <div className="gr2">
        <div className="fg"><label>{t.contractStart}</label><input type="date" value={form.contractStart} onChange={e=>set("contractStart",e.target.value)}/></div>
        <div className="fg"><label>{t.contractEnd}</label><input type="date" value={form.contractEnd} onChange={e=>set("contractEnd",e.target.value)}/></div>
      </div>
      <hr/>
      <div className="fg"><label>{t.email} (acceso)</label><input type="email" value={form.email} onChange={e=>set("email",e.target.value)}/></div>
      <div className="fg"><label>{t.password}</label><input type="password" value={form.password} onChange={e=>set("password",e.target.value)}/></div>
      <button className="btn btn-p btn-full" onClick={()=>onSave(form)}>{t.createAccess}</button>
    </div>
  );
}

function AddCostModal({t,tenants,onSave,onClose}){
  const now=new Date();
  const monthNames=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const startYear=2024; const endYear=startYear+15;
  const allMonths=[];
  for(let y=startYear;y<endYear;y++) monthNames.forEach(m=>allMonths.push(`${m} ${y}`));
  const currentMonth=`${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  const [tid,setTid]=useState(tenants[0]?.id||"");
  const [costType,setCostType]=useState("💡 Electricidad");
  const [tipo,setTipo]=useState("gasto"); // gasto | inversion
  const [amount,setAmount]=useState("");
  const [month,setMonth]=useState(currentMonth);
  const [nota,setNota]=useState("");
  const icons={"💡 Electricidad":"💡","💧 Agua":"💧","🌡️ Calefacción":"🌡️","🗑️ Basuras":"🗑️","🏗️ Inversión":"🏗️","Otro":"📋"};
  const handle=()=>{
    if(!amount)return;
    const icon=icons[costType]||"📋";
    const name=costType.replace(/^\S+\s/,"");
    onSave(tid,{icon,name,month,amount:parseFloat(amount),tipo,nota});
  };
  return(
    <div className="modal">
      <div className="modal-hd"><h3>➕ {t.addCost}</h3><button className="close-btn" onClick={onClose}>✕</button></div>
      <div className="fg"><label>{t.tenant}</label><select value={tid} onChange={e=>setTid(e.target.value)}>{tenants.map(ten=><option key={ten.id} value={ten.id}>{ten.name} ({ten.unit})</option>)}</select></div>
      <div className="fg">
        <label>Tipo</label>
        <div style={{display:"flex",gap:10,marginTop:4}}>
          <button className={`btn btn-sm ${tipo==="gasto"?"btn-p":"btn-o"}`} onClick={()=>setTipo("gasto")}>💸 Gasto</button>
          <button className={`btn btn-sm ${tipo==="inversion"?"btn-s":"btn-o"}`} onClick={()=>setTipo("inversion")}>🏗️ Inversión (mía)</button>
        </div>
        {tipo==="inversion"&&<p style={{fontSize:12,color:"var(--warm)",marginTop:6}}>Esta inversión la asumes tú, no se carga al inquilino</p>}
      </div>
      <div className="gr2">
        <div className="fg"><label>{t.concept}</label><select value={costType} onChange={e=>setCostType(e.target.value)}>{["💡 Electricidad","💧 Agua","🌡️ Calefacción","🗑️ Basuras","🏗️ Inversión","Otro"].map(o=><option key={o}>{o}</option>)}</select></div>
        <div className="fg"><label>{t.amount}</label><input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"/></div>
      </div>
      <div className="fg"><label>{t.month}</label>
        <select value={month} onChange={e=>setMonth(e.target.value)}>
          {allMonths.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className="fg"><label>📝 Nota (opcional)</label><textarea value={nota} onChange={e=>setNota(e.target.value)} placeholder="Ej: Cambio de caldera, pintura piso..."/></div>
      <button className="btn btn-p btn-full" onClick={handle}>{t.save}</button>
    </div>
  );
}

function DocumentsPage({t,tenants,documents,onGenerate}){
  const startYear=2024; const endYear=startYear+15;
  const years=Array.from({length:15},(_,i)=>startYear+i);
  const now=new Date();
  const [selYear,setSelYear]=useState(now.getFullYear());
  const [generating,setGenerating]=useState(false);

  const handle=async()=>{
    setGenerating(true);
    await onGenerate(selYear);
    setGenerating(false);
  };

  // Summary for selected year
  const monthNames=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const months=monthNames.map(m=>`${m} ${selYear}`);
  const totI=months.reduce((s,m)=>s+tenants.filter(t=>(t.payments||{})[m]?.paid).reduce((ss,t)=>ss+(t.rent||0),0),0);
  const totG=months.reduce((s,m)=>s+tenants.reduce((ss,t)=>ss+(t.costs||[]).filter(c=>c.month===m&&c.tipo!=="inversion").reduce((sss,c)=>sss+(c.amount||0),0),0),0);
  const totInv=months.reduce((s,m)=>s+tenants.reduce((ss,t)=>ss+(t.costs||[]).filter(c=>c.month===m&&c.tipo==="inversion").reduce((sss,c)=>sss+(c.amount||0),0),0),0);
  const profit=totI-totG-totInv;

  return(
    <div>
      <div className="page-hd"><h2>📁 {t.documents}</h2><p>Resúmenes anuales en Excel</p></div>

      <div className="card">
        <div className="card-title">📊 {t.generateExcel}</div>
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:20}}>
          <select className="status-sel" style={{padding:"10px 14px",fontSize:14}} value={selYear} onChange={e=>setSelYear(parseInt(e.target.value))}>
            {years.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-p" onClick={handle} disabled={generating}>
            {generating?"⏳ Generando...":"📥 Generar Excel "+selYear}
          </button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:8}}>
          <div style={{background:"#E6F4ED",borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:11,color:"var(--warm)",marginBottom:4}}>INGRESOS {selYear}</div>
            <div style={{fontFamily:"'DM Serif Display',serif",fontSize:24,color:"var(--green)"}}>{totI}€</div>
          </div>
          <div style={{background:"#FDECEA",borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:11,color:"var(--warm)",marginBottom:4}}>GASTOS {selYear}</div>
            <div style={{fontFamily:"'DM Serif Display',serif",fontSize:24,color:"var(--red)"}}>{totG}€</div>
          </div>
          <div style={{background:"#EEF2FF",borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:11,color:"var(--warm)",marginBottom:4}}>INVERSIÓN {selYear}</div>
            <div style={{fontFamily:"'DM Serif Display',serif",fontSize:24,color:"#4F46E5"}}>{totInv}€</div>
          </div>
          <div style={{background:profit>=0?"#E6F4ED":"#FDECEA",borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:11,color:"var(--warm)",marginBottom:4}}>PROFIT {selYear}</div>
            <div style={{fontFamily:"'DM Serif Display',serif",fontSize:24,color:profit>=0?"var(--green)":"var(--red)"}}>{profit}€</div>
          </div>
        </div>
        <p style={{fontSize:12,color:"var(--warm)",marginTop:8}}>El Excel incluye 4 hojas: Resumen, Pagos, Gastos e Inquilinos</p>
      </div>

      <div className="card">
        <div className="card-title">🗂️ Documentos generados</div>
        {documents.length===0
          ?<p style={{color:"var(--warm)",fontSize:14}}>{t.noDocuments}</p>
          :documents.map(doc=>(
            <div key={doc.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0",borderBottom:"1px solid var(--border)"}}>
              <div>
                <div style={{fontWeight:600,fontSize:15}}>📊 MiAlquiler_Resumen_{doc.year}.xlsx</div>
                <div style={{fontSize:12,color:"var(--warm)",marginTop:3}}>
                  Generado el {doc.date} · Ingresos: {doc.totI}€ · Gastos: {doc.totG}€ · Profit: <span style={{color:doc.profit>=0?"var(--green)":"var(--red)",fontWeight:600}}>{doc.profit}€</span>
                </div>
              </div>
              <button className="btn btn-o btn-sm" onClick={()=>generateAnnualExcel(tenants,doc.year)}>
                📥 {t.downloadDoc}
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

function ContractsPage({t,contracts,onNew,onDownload}){
  const byYear={};
  contracts.forEach(c=>{
    const y=c.year||c.signYear||"Sin año";
    if(!byYear[y])byYear[y]=[];
    byYear[y].push(c);
  });
  const years=Object.keys(byYear).sort((a,b)=>b-a);
  return(
    <div>
      <div className="page-hd" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div><h2>📝 {t.contracts}</h2><p>{contracts.length} contratos</p></div>
        <button className="btn btn-p" onClick={onNew}>➕ {t.newContract}</button>
      </div>
      {contracts.length===0
        ?<div className="card"><p style={{color:"var(--warm)",textAlign:"center",padding:20}}>📂 {t.noContracts}</p></div>
        :years.map(year=>(
          <div key={year} className="card">
            <div className="card-title">📁 {year}</div>
            {byYear[year].map(c=>(
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 0",borderBottom:"1px solid var(--border)"}}>
                <div style={{fontSize:28}}>📄</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:15}}>📄 {c.unit} — {c.tenantName}</div>
                  <div style={{fontSize:12,color:"var(--warm)",marginTop:2}}>
                    Firmado el {c.signDay}/{c.signMonth}/{c.signYear} · {c.startDay}/{c.startMonth}/{c.startYear} → {c.endDay}/{c.endMonth}/{c.endYear} · {c.rent}€/mes
                  </div>
                </div>
                <button className="btn btn-o btn-sm" onClick={()=>onDownload(c)}>📥 {t.downloadDoc}</button>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

function NewContractModal({t,onClose,onSave}){
  const now=new Date();
  const monthNames=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const [step,setStep]=useState(1);
  const [tenantSigned,setTenantSigned]=useState(false);
  const [saving,setSaving]=useState(false);
  const [savedData,setSavedData]=useState(null);
  const [form,setForm]=useState({
    unit:"",tenantName:"",tenantDni:"",tenantAddress:"",phone:"",email:"",password:"",rent:"",
    signDay:String(now.getDate()),signMonth:monthNames[now.getMonth()],signYear:String(now.getFullYear()),
    startDay:"1",startMonth:monthNames[now.getMonth()],startYear:String(now.getFullYear()),
    endDay:"28",endMonth:monthNames[now.getMonth()],endYear:String(now.getFullYear()+2),
  });
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const toISO=(day,month,year)=>{const idx=monthNames.indexOf(month.toLowerCase());if(idx<0)return"";return`${year}-${String(idx+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;};

  const handleSign=async()=>{
    if(!tenantSigned)return;
    setSaving(true);
    const data={...form,contractStartISO:toISO(form.startDay,form.startMonth,form.startYear),contractEndISO:toISO(form.endDay,form.endMonth,form.endYear)};
    await onSave(data);
    setSavedData(data);
    setSaving(false);
    setStep(3);
  };

  const bar=(active,total)=>(
    <div style={{display:"flex",gap:6,marginBottom:18}}>
      {Array.from({length:total},(_,i)=>(
        <div key={i} style={{flex:1,height:4,borderRadius:4,background:i<active?"var(--terra)":"var(--border)"}}/>
      ))}
    </div>
  );

  return(
    <div className="modal" style={{maxWidth:560}}>
      {step===1&&<>
        <div className="modal-hd"><h3>📋 {t.contractDetails}</h3><button className="close-btn" onClick={onClose}>✕</button></div>
        {bar(1,3)}
        <div className="fg"><label>Piso / Habitación / Trastero</label><input value={form.unit} onChange={e=>set("unit",e.target.value)} placeholder="Ej: Piso 1, Trastero 3..."/></div>
        <div className="gr2">
          <div className="fg"><label>{t.name}</label><input value={form.tenantName} onChange={e=>set("tenantName",e.target.value)}/></div>
          <div className="fg"><label>{t.dni}</label><input value={form.tenantDni} onChange={e=>set("tenantDni",e.target.value)} placeholder="12345678A"/></div>
        </div>
        <div className="fg"><label>{t.address}</label><input value={form.tenantAddress} onChange={e=>set("tenantAddress",e.target.value)} placeholder="Calle, nº, ciudad"/></div>
        <div className="gr2">
          <div className="fg"><label>{t.phone}</label><input value={form.phone} onChange={e=>set("phone",e.target.value)}/></div>
          <div className="fg"><label>{t.rent} €/mes</label><input type="number" value={form.rent} onChange={e=>set("rent",e.target.value)}/></div>
        </div>
        <hr/>
        <div style={{fontWeight:600,fontSize:12,marginBottom:10,color:"var(--warm)",textTransform:"uppercase",letterSpacing:".7px"}}>Fechas</div>
        <div className="gr2">
          <div className="fg"><label>{t.signDate}</label>
            <div style={{display:"flex",gap:4}}>
              <input style={{width:44}} value={form.signDay} onChange={e=>set("signDay",e.target.value)} placeholder="día"/>
              <input value={form.signMonth} onChange={e=>set("signMonth",e.target.value)} placeholder="mes"/>
              <input style={{width:52}} value={form.signYear} onChange={e=>set("signYear",e.target.value)}/>
            </div>
          </div>
          <div className="fg"><label>{t.startDate}</label>
            <div style={{display:"flex",gap:4}}>
              <input style={{width:44}} value={form.startDay} onChange={e=>set("startDay",e.target.value)}/>
              <input value={form.startMonth} onChange={e=>set("startMonth",e.target.value)}/>
              <input style={{width:52}} value={form.startYear} onChange={e=>set("startYear",e.target.value)}/>
            </div>
          </div>
        </div>
        <div className="fg"><label>{t.endDate}</label>
          <div style={{display:"flex",gap:4}}>
            <input style={{width:44}} value={form.endDay} onChange={e=>set("endDay",e.target.value)}/>
            <input value={form.endMonth} onChange={e=>set("endMonth",e.target.value)}/>
            <input style={{width:52}} value={form.endYear} onChange={e=>set("endYear",e.target.value)}/>
          </div>
        </div>
        <button className="btn btn-p btn-full" onClick={()=>setStep(2)} disabled={!form.unit||!form.tenantName||!form.rent}>
          Siguiente → Firma ›
        </button>
      </>}

      {step===2&&<>
        <div className="modal-hd"><h3>✍️ {t.tenantSignature}</h3><button className="close-btn" onClick={onClose}>✕</button></div>
        {bar(2,3)}
        <div style={{background:"var(--cream)",borderRadius:12,padding:16,marginBottom:16,fontSize:13,lineHeight:1.8,maxHeight:240,overflowY:"auto"}}>
          <p style={{fontWeight:700,textAlign:"center",marginBottom:10,fontSize:14}}>CONTRATO DE ARRENDAMIENTO — {form.unit.toUpperCase()}</p>
          <p>📍 Calafell, <strong>{form.signDay} de {form.signMonth} de {form.signYear}</strong></p>
          <p>👤 <strong>Arrendador:</strong> Joana Solé Santacana · DNI 39618190T</p>
          <p>👤 <strong>Arrendatario:</strong> {form.tenantName} · DNI {form.tenantDni}</p>
          <p>📅 <strong>Periodo:</strong> {form.startDay}/{form.startMonth}/{form.startYear} → {form.endDay}/{form.endMonth}/{form.endYear}</p>
          <p>💶 <strong>Renta:</strong> {form.rent} €/mes · IPC + 1,5% anual</p>
          <p style={{fontSize:11,color:"var(--warm)",marginTop:6}}>Suministros a cargo del arrendatario. Prohibido subarrendar sin consentimiento escrito.</p>
        </div>
        <div style={{background:tenantSigned?"#E6F4ED":"var(--cream)",border:`2px solid ${tenantSigned?"#4A9B6F":"var(--border)"}`,borderRadius:14,padding:16,marginBottom:16,cursor:"pointer",transition:"all .2s"}} onClick={()=>setTenantSigned(v=>!v)}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:26,height:26,borderRadius:7,border:`2px solid ${tenantSigned?"#4A9B6F":"var(--warm)"}`,background:tenantSigned?"#4A9B6F":"white",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:700,fontSize:16,flexShrink:0}}>
              {tenantSigned?"✓":""}
            </div>
            <div>
              <div style={{fontWeight:600,fontSize:13}}>✍️ {form.tenantName}</div>
              <div style={{fontSize:12,color:"var(--warm)"}}>{t.tenantConfirm}</div>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-o" onClick={()=>setStep(1)}>‹ Volver</button>
          <button className="btn btn-p" style={{flex:1}} onClick={handleSign} disabled={!tenantSigned||saving}>
            {saving?"⏳ Guardando...":"✅ Firmar y guardar"}
          </button>
        </div>
      </>}

      {step===3&&<>
        <div className="modal-hd"><h3>✅ Contrato guardado</h3><button className="close-btn" onClick={onClose}>✕</button></div>
        {bar(3,3)}
        <div style={{textAlign:"center",padding:"16px 0"}}>
          <div style={{fontSize:56,marginBottom:12}}>🎉</div>
          <h3 style={{fontFamily:"'DM Serif Display',serif",fontSize:22,marginBottom:6}}>¡Contrato firmado!</h3>
          <p style={{color:"var(--warm)",fontSize:13,marginBottom:18}}>Guardado en <strong>Contratos</strong>. El inquilino ya tiene acceso a la app.</p>
          <div style={{background:"var(--cream)",borderRadius:12,padding:14,marginBottom:18,textAlign:"left",fontSize:13}}>
            <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid var(--border)"}}><span style={{color:"var(--warm)"}}>Piso</span><strong>{form.unit}</strong></div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid var(--border)"}}><span style={{color:"var(--warm)"}}>Inquilino</span><strong>{form.tenantName}</strong></div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid var(--border)"}}><span style={{color:"var(--warm)"}}>Periodo</span><strong>{form.startDay}/{form.startMonth}/{form.startYear} → {form.endDay}/{form.endMonth}/{form.endYear}</strong></div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0"}}><span style={{color:"var(--warm)"}}>Renta</span><strong>{form.rent} €/mes</strong></div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"center"}}>
            <button className="btn btn-p" onClick={()=>generateContractDocx(savedData||form)}>📥 Descargar PDF</button>
            <button className="btn btn-o" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </>}
    </div>
  );
}
function StatusBadge({status,t}){
  const map={"Pendiente":{bg:"#FDECEA",color:"#D94F3D",label:t?.pending||"Pendiente"},"En revisión":{bg:"#FDF6E3",color:"#D4A853",label:t?.inReview||"En revisión"},"Resuelto":{bg:"#E6F4ED",color:"#4A9B6F",label:t?.resolved||"Resuelto"}};
  const s=map[status]||{bg:"#F0ECE8",color:"#8C7B6E",label:status};
  return<span className="badge" style={{background:s.bg,color:s.color}}>{s.label}</span>;
}
