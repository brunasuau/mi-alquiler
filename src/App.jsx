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

function generateContractPDF(data) {
  const { unit, building, tenantName, tenantDni, tenantAddress,
          signDay, signMonth, signYear,
          startDay, startMonth, startYear,
          endDay, endMonth, endYear,
          rent, durationText,
          tenantSignature, ownerSignature } = data;

  const d = new jsPDF({ format:"a4", unit:"mm" });
  const lm=20, rm=190, maxW=rm-lm;
  let y=20;
  const lh=5.5;

  function checkPage(needed=10){ if(y+needed>280){d.addPage();y=20;} }
  function space(n=3){y+=n;}

  function addPara(segments, indent=0){
    d.setFontSize(10);
    let words=[];
    segments.forEach(seg=>{
      seg.text.split(" ").forEach(w=>{ if(w) words.push({w,bold:seg.bold}); });
    });
    let lines=[[]]; let lineW=0; const avail=maxW-indent;
    words.forEach(({w,bold})=>{
      d.setFont("helvetica",bold?"bold":"normal");
      const ww=d.getTextWidth(w+" ");
      if(lineW+ww>avail && lines[lines.length-1].length>0){ lines.push([]); lineW=0; }
      lines[lines.length-1].push({w,bold}); lineW+=ww;
    });
    lines.forEach(line=>{
      checkPage();
      let cx=lm+indent;
      line.forEach(({w,bold})=>{
        d.setFont("helvetica",bold?"bold":"normal");
        d.text(w+" ",cx,y); cx+=d.getTextWidth(w+" ");
      });
      y+=lh;
    });
    y+=1.5;
  }

  function heading(text){
    checkPage(8);
    d.setFont("helvetica","bold"); d.setFontSize(10);
    d.text(text,lm,y); y+=lh+1;
  }
  function centered(text,size=13,bold=true){
    checkPage(8);
    d.setFont("helvetica",bold?"bold":"normal"); d.setFontSize(size);
    d.text(text,105,y,{align:"center"}); y+=size*0.4+2;
    d.setFontSize(10);
  }

  // ── HEADER ──
  centered("CONTRATO DE ALQUILER PARA USO DISTINTO A VIVIENDA",12);
  space(2);
  addPara([{text:`En Calafell, a ${signDay} de ${signMonth} de ${signYear}`}]);
  space();

  // ── REUNIDOS ──
  heading("R E U N I D O S:");
  addPara([
    {text:"De una parte, "},{text:"Joana Solé Santacana",bold:true},
    {text:", mayor de edad, con domicilio a estos efectos en el Passeig Marítim Sant Joan de Déu núm. 90, Esc. B, 5º 2ª de Calafell, provista de DNI número "},{text:"36618190T",bold:true},{text:"."}
  ]);
  addPara([
    {text:"De otra, Sr/a. "},{text:tenantName,bold:true},
    {text:", mayor de edad, con domicilio a estos efectos en "},{text:tenantAddress,bold:true},
    {text:", provista/o de DNI número "},{text:tenantDni,bold:true},{text:"."}
  ]);
  addPara([{text:"Después de reconocerse mutua y recíprocamente la legal y precisa capacidad legal para obligar y obligarse, haciéndolo libre y voluntariamente,"}]);
  space();

  // ── MANIFIESTAN ──
  heading("M A N I F I E S T A N:");
  addPara([
    {text:"I.- Que Joana Solé Santacana por sus justos y legítimos títulos resulta ser titular del trastero número "},{text:unit,bold:true},
    {text:" situado en la "},{text:building||"Nave Industrial",bold:true},
    {text:" sita en C/ Pou, 61 Calafell (Tarragona)."}
  ]);
  addPara([{text:"II.- Que la arrendataria está interesada en el arrendamiento de dicho Trastero para almacenar en el mismo existencias y/o utensilios propios de su objeto social."}]);
  addPara([{text:"Que en virtud de lo referido, acuerdan formalizar el presente contrato por el que pactan las siguientes,"}]);
  space();

  // ── CLÁUSULAS ──
  heading("C L Á U S U L A S:");
  heading("PRIMERA.-");
  addPara([
    {text:"Joana Solé Santacana, en adelante, arrendadora, cede en arrendamiento a "},{text:tenantName,bold:true},
    {text:", en adelante, la arrendataria, quien acepta, "EL TRASTERO", sito en la calle Pou núm. 61 de Calafell, (Trastero núm. "},{text:unit,bold:true},
    {text:" "},{text:building||"",bold:true},{text:"), cuya ubicación, lindes, características, estado de conservación, elementos y servicios comunes y privativos, manifiestan las partes conocer."}
  ]);

  heading("SEGUNDA.-");
  // Dynamic duration clause
  addPara([
    {text:"Las partes convienen en establecer la duración de este contrato de "},{text:durationText.toUpperCase(),bold:true},
    {text:", en las condiciones que en el presente se estipulan, con inicio el día "},{text:`${startDay} de ${startMonth} de ${startYear}`,bold:true},
    {text:" y finalización el día "},{text:`${endDay} de ${endMonth} de ${endYear}`,bold:true},
    {text:". Finalizado el plazo establecido la parte arrendataria deberá dejar libre y vacua la nave objeto de alquiler, sin necesidad de requerimiento ni notificación previa alguna; ello sin perjuicio de que las partes puedan formalizar nuevo contrato de alquiler o prórroga expresa del presente."}
  ]);
  addPara([{text:"La parte arrendataria podrá renunciar libremente al contrato de alquiler, siempre que la renuncia se comunique de forma fehaciente por cualquier medio, con una antelación mínima de tres meses. El incumplimiento en el plazo de preaviso estipulado comportará el devengo de una indemnización equivalente al importe de la renta por el plazo transcurrido entre el día en que se efectúa el preaviso y los citados tres meses."}]);

  heading("TERCERA.-");
  addPara([{text:"Con expresa renuncia por los contratantes a lo establecido en el artículo 34 de la L.A.U., se acuerda que la extinción del contrato por el transcurso del término convenido no dará derecho a la arrendataria a indemnización alguna a cargo de la arrendadora."}]);

  heading("CUARTA.-");
  addPara([
    {text:"Las partes establecen una renta de alquiler de "},{text:`${rent} €`,bold:true},
    {text:" mensuales. La renta se abonará de forma anticipada durante los cinco primeros días de cada una de las mensualidades en la cuenta núm. "},
    {text:"ES26 2100 0366 8502 0071 2257",bold:true},{text:", titular de la Sra. Joana Solé, o en la que la misma designe."}
  ]);
  addPara([{text:"La renta de alquiler será objeto de actualización anual según el Índice General de Precios al Consumo. La primera actualización se efectuará en "+signMonth+", conforme el IPC interanual al mes de diciembre. La renta no será objeto de modificación en el supuesto de que dicho índice resultare negativo."}]);
  addPara([{text:"Adicionalmente, la parte arrendataria participará en los gastos de luz y agua de la nave en la cantidad de 2,5 € mensuales."}]);

  heading("QUINTA.-");
  addPara([{text:"No se establece ningún tipo de fianza."}]);

  heading("SEXTA.-");
  addPara([{text:"Si finalizado el término del presente contrato la parte arrendataria no deja libre el trastero, indemnizará a la arrendadora en la cantidad de 10,00 € diarios; si el retraso fuere de dos meses o superior, la indemnización se fijará en 20,00 € diarios."}]);

  heading("SÉPTIMA.-");
  addPara([{text:"Serán a cuenta de la arrendataria todo tipo de impuestos, gravámenes y demás cargas fiscales, laborales, etc., que resultaren necesarios para la gestión y uso del trastero que se arrienda."}]);

  heading("OCTAVA.-");
  addPara([{text:"La arrendataria se hace directa y exclusivamente responsable de los daños que puedan ocasionarse a personas o cosas en el trastero arrendado. Se compromete a contratar un Seguro que cubra los riesgos básicos, daños materiales, robo y responsabilidad civil."}]);

  heading("NOVENA.-");
  addPara([{text:"Será de cuenta y cargo de la parte arrendadora el IBI y tasa de recogida de basuras."}]);

  heading("DÉCIMA.-");
  addPara([{text:"Con expresa renuncia al art. 32 de la L.A.U., la arrendataria no podrá subarrendar, ni ceder, el local objeto del presente contrato, ni total, ni parcialmente, sin el consentimiento previo y por escrito de la arrendadora."}]);

  heading("UNDÉCIMA.-");
  addPara([{text:"El trastero se arrienda en las condiciones en las que actualmente se encuentra. La parte arrendataria no podrá efectuar obra alguna sin el consentimiento expreso escrito de la parte arrendadora."}]);

  heading("DUODÉCIMA.-");
  addPara([{text:"La arrendataria se compromete a conservar y cuidar el objeto arrendado con la diligencia de un ordenado comerciante, debiendo realizar por su cuenta y cargo las obras necesarias de conservación y reparación."}]);

  heading("DECIMOTERCERA.-");
  addPara([{text:"La arrendataria se obliga a permitir el acceso al trastero arrendado a la arrendadora o a la persona u operarios que esta delegue."}]);

  heading("DECIMOCUARTA.-");
  addPara([{text:"El trastero arrendado no puede, bajo ningún concepto, ser destinado a vivienda propia o de terceras personas, ni a ningún otro uso que el especificado anteriormente."}]);

  heading("DECIMOQUINTA.-");
  addPara([{text:"Queda expresamente prohibido el almacenaje de materias peligrosas o insalubres, así como realizar actividades ilegales. Ello será causa de rescisión automática del presente contrato."}]);

  heading("DECIMOSEXTA.-");
  addPara([{text:"La arrendataria renuncia de forma expresa a la aplicación del art. 25, en relación al art. 31 de la L.A.U., renunciando a sus derechos a adquisición preferente, tanteo y retracto."}]);

  heading("DECIMOSÉPTIMA.-");
  addPara([{text:"Para cualquier clase de duda respecto a la interpretación o cumplimiento del presente contrato, ambas partes se someten expresamente a la jurisdicción y competencia de los Juzgados y Tribunales de El Vendrell."}]);

  space(4);
  addPara([{text:"Y en prueba de conformidad, las partes afirmándose y ratificándose en el contenido de este contrato, lo firman por duplicado, con promesa de cumplirlo bien y fielmente, en el lugar y fecha indicados en el encabezamiento."}]);

  // ── SIGNATURES ──
  checkPage(50);
  space(6);
  d.setFont("helvetica","bold"); d.setFontSize(10);
  d.text("EL ARRENDADOR",lm,y);
  d.text("LA ARRENDATARIA",115,y);
  y+=6;
  d.setFont("helvetica","normal"); d.setFontSize(9);
  d.text("Fdo.: Joana Solé Santacana",lm,y);
  d.text("Fdo.: "+tenantName,115,y);
  y+=4;

  // Owner signature
  if(ownerSignature){
    try{ d.addImage(ownerSignature,"PNG",lm,y,60,18); }catch(e){}
  } else {
    d.text("_______________________",lm,y+14);
  }
  // Tenant signature
  if(tenantSignature){
    try{ d.addImage(tenantSignature,"PNG",115,y,60,18); }catch(e){}
  } else {
    d.text("_______________________",115,y+14);
  }

  const filename=`Contrato_${(unit||"").replace(/ /g,"_")}_${(tenantName||"").replace(/ /g,"_")}_${signYear}.pdf`;
  d.save(filename);
  return filename;
}


function SignaturePad({name,onSign}){
  const canvasRef=useRef(null);
  const drawing=useRef(false);
  const [hasSignature,setHasSignature]=useState(false);

  const getPos=(e,canvas)=>{
    const rect=canvas.getBoundingClientRect();
    const scaleX=canvas.width/rect.width;
    const scaleY=canvas.height/rect.height;
    const src=e.touches?e.touches[0]:e;
    return{x:(src.clientX-rect.left)*scaleX,y:(src.clientY-rect.top)*scaleY};
  };

  const startDraw=(e)=>{
    e.preventDefault();
    const canvas=canvasRef.current;
    const ctx=canvas.getContext("2d");
    const pos=getPos(e,canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x,pos.y);
    drawing.current=true;
  };

  const draw=(e)=>{
    e.preventDefault();
    if(!drawing.current)return;
    const canvas=canvasRef.current;
    const ctx=canvas.getContext("2d");
    ctx.lineWidth=2.5;
    ctx.lineCap="round";
    ctx.lineJoin="round";
    ctx.strokeStyle="#1A1612";
    const pos=getPos(e,canvas);
    ctx.lineTo(pos.x,pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x,pos.y);
  };

  const endDraw=(e)=>{
    e.preventDefault();
    if(!drawing.current)return;
    drawing.current=false;
    const canvas=canvasRef.current;
    const dataUrl=canvas.toDataURL("image/png");
    setHasSignature(true);
    onSign(dataUrl);
  };

  const clear=()=>{
    const canvas=canvasRef.current;
    const ctx=canvas.getContext("2d");
    ctx.clearRect(0,0,canvas.width,canvas.height);
    setHasSignature(false);
    onSign(null);
  };

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <div style={{fontSize:13,fontWeight:600}}>✍️ Firma de {name}</div>
        {hasSignature&&<button className="btn btn-o btn-sm" onClick={clear}>🗑️ Borrar</button>}
      </div>
      <div style={{border:"2px solid var(--border)",borderRadius:12,overflow:"hidden",background:"white",touchAction:"none"}}>
        <canvas
          ref={canvasRef}
          width={520} height={160}
          style={{width:"100%",height:160,display:"block",cursor:"crosshair"}}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
        />
      </div>
      {!hasSignature&&<p style={{fontSize:11,color:"var(--warm)",marginTop:4,textAlign:"center"}}>Firma con el dedo o Apple Pencil</p>}
      {hasSignature&&<p style={{fontSize:11,color:"#4A9B6F",marginTop:4,textAlign:"center",fontWeight:600}}>✅ Firma registrada</p>}
    </div>
  );
}

function NewContractModal({t,onClose,onSave}){
  const now=new Date();
  const monthNames=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const [step,setStep]=useState(1);
  const [saving,setSaving]=useState(false);
  const [savedData,setSavedData]=useState(null);

  // Duration helpers
  const calcEndDate=(startISO, months)=>{
    const d=new Date(startISO);
    d.setMonth(d.getMonth()+months);
    return d;
  };
  const formatDateSpanish=(d)=>({
    day:String(d.getDate()),
    month:monthNames[d.getMonth()],
    year:String(d.getFullYear())
  });

  const [form,setForm]=useState({
    unit:"", building:"", tenantName:"", tenantDni:"", tenantAddress:"",
    phone:"", email:"", rent:"",
    durationMonths:"12", durationText:"UN AÑO",
    signDay:String(now.getDate()), signMonth:monthNames[now.getMonth()], signYear:String(now.getFullYear()),
    startISO:new Date().toISOString().split("T")[0],
    tenantSignature:null, ownerSignature:null,
  });
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  // Compute end date from start + duration
  const startDate=new Date(form.startISO||new Date());
  const endDate=calcEndDate(form.startISO||new Date().toISOString().split("T")[0], parseInt(form.durationMonths)||12);
  const startFmt=formatDateSpanish(startDate);
  const endFmt=formatDateSpanish(endDate);

  const DURATION_PRESETS=[
    {label:"1 mes",months:1,text:"UN MES"},
    {label:"2 meses",months:2,text:"DOS MESES"},
    {label:"3 meses",months:3,text:"TRES MESES"},
    {label:"6 meses",months:6,text:"SEIS MESES"},
    {label:"11 meses",months:11,text:"ONCE MESES"},
    {label:"1 año",months:12,text:"UN AÑO"},
    {label:"2 años",months:24,text:"DOS AÑOS"},
    {label:"3 años",months:36,text:"TRES AÑOS"},
  ];

  const handleSave=async()=>{
    setSaving(true);
    const contractData={
      ...form,
      signDay:form.signDay, signMonth:form.signMonth, signYear:form.signYear,
      startDay:startFmt.day, startMonth:startFmt.month, startYear:startFmt.year,
      endDay:endFmt.day, endMonth:endFmt.month, endYear:endFmt.year,
      contractStartISO:form.startISO,
      contractEndISO:endDate.toISOString().split("T")[0],
    };
    await onSave(contractData);
    setSavedData(contractData);
    setSaving(false);
    setStep(4);
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

      {/* ── STEP 1: DATOS ── */}
      {step===1&&<>
        <div className="modal-hd"><h3>📋 Datos del contrato</h3><button className="close-btn" onClick={onClose}>✕</button></div>
        {bar(1,4)}
        <div className="gr2">
          <div className="fg"><label>Nº Trastero *</label><input value={form.unit} onChange={e=>set("unit",e.target.value)} placeholder="Ej: Trastero 7"/></div>
          <div className="fg"><label>Nave *</label><input value={form.building} onChange={e=>set("building",e.target.value)} placeholder="Ej: Nau A"/></div>
        </div>
        <div className="gr2">
          <div className="fg"><label>Nombre inquilino *</label><input value={form.tenantName} onChange={e=>set("tenantName",e.target.value)}/></div>
          <div className="fg"><label>DNI inquilino *</label><input value={form.tenantDni} onChange={e=>set("tenantDni",e.target.value)} placeholder="12345678A"/></div>
        </div>
        <div className="fg"><label>Domicilio del inquilino *</label><input value={form.tenantAddress} onChange={e=>set("tenantAddress",e.target.value)} placeholder="Calle, nº, ciudad"/></div>
        <div className="gr2">
          <div className="fg"><label>Teléfono</label><input value={form.phone} onChange={e=>set("phone",e.target.value)}/></div>
          <div className="fg"><label>Alquiler €/mes *</label><input type="number" value={form.rent} onChange={e=>set("rent",e.target.value)}/></div>
        </div>
        <hr/>
        <div className="fg">
          <label>⏱️ Duración del contrato</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:8,marginBottom:10}}>
            {DURATION_PRESETS.map(p=>(
              <button key={p.months} className={`btn btn-sm ${form.durationMonths===String(p.months)?"btn-p":"btn-o"}`}
                onClick={()=>{set("durationMonths",String(p.months));set("durationText",p.text);}}>
                {p.label}
              </button>
            ))}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input type="number" min="1" value={form.durationMonths} onChange={e=>{
              const m=e.target.value;
              const preset=DURATION_PRESETS.find(p=>String(p.months)===m);
              set("durationMonths",m);
              set("durationText",preset?preset.text:m+" MES"+(parseInt(m)===1?"":"ES"));
            }} style={{width:80}} placeholder="meses"/>
            <span style={{fontSize:13,color:"var(--warm)"}}>meses personalizados</span>
          </div>
        </div>
        <div className="gr2">
          <div className="fg"><label>📅 Fecha inicio</label><input type="date" value={form.startISO} onChange={e=>set("startISO",e.target.value)}/></div>
          <div className="fg"><label>📅 Fecha firma</label>
            <div style={{display:"flex",gap:4}}>
              <input style={{width:44}} value={form.signDay} onChange={e=>set("signDay",e.target.value)}/>
              <select value={form.signMonth} onChange={e=>set("signMonth",e.target.value)}>
                {monthNames.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
              <input style={{width:52}} value={form.signYear} onChange={e=>set("signYear",e.target.value)}/>
            </div>
          </div>
        </div>
        {form.startISO&&<div style={{background:"var(--cream)",borderRadius:10,padding:10,fontSize:13,marginBottom:12}}>
          📅 Del <strong>{startFmt.day} de {startFmt.month} de {startFmt.year}</strong> al <strong>{endFmt.day} de {endFmt.month} de {endFmt.year}</strong> · <strong>{form.durationText}</strong>
        </div>}
        <button className="btn btn-p btn-full" onClick={()=>setStep(2)} disabled={!form.unit||!form.tenantName||!form.tenantDni||!form.tenantAddress||!form.rent}>
          Siguiente → Firma inquilino
        </button>
      </>}

      {/* ── STEP 2: FIRMA INQUILINO ── */}
      {step===2&&<>
        <div className="modal-hd"><h3>✍️ Firma del inquilino</h3><button className="close-btn" onClick={onClose}>✕</button></div>
        {bar(2,4)}
        <div style={{background:"var(--cream)",borderRadius:12,padding:14,marginBottom:16,fontSize:12,lineHeight:1.7}}>
          <p style={{fontWeight:700,marginBottom:6}}>CONTRATO · {form.unit} · {form.building}</p>
          <p>👤 Arrendatario: <strong>{form.tenantName}</strong> · DNI {form.tenantDni}</p>
          <p>📍 {form.tenantAddress}</p>
          <p>📅 {startFmt.day}/{startFmt.month}/{startFmt.year} → {endFmt.day}/{endFmt.month}/{endFmt.year} · <strong>{form.durationText}</strong></p>
          <p>💶 Renta: <strong>{form.rent} €/mes</strong></p>
          <p style={{fontSize:11,color:"var(--warm)",marginTop:4}}>Al firmar, el arrendatario acepta todas las cláusulas del contrato de arrendamiento.</p>
        </div>
        <SignaturePad name={form.tenantName} onSign={(sig)=>set("tenantSignature",sig)}/>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button className="btn btn-o" onClick={()=>setStep(1)}>‹ Volver</button>
          <button className="btn btn-p" style={{flex:1}} onClick={()=>setStep(3)} disabled={!form.tenantSignature}>
            Siguiente → Tu firma ›
          </button>
        </div>
      </>}

      {/* ── STEP 3: FIRMA ARRENDADOR ── */}
      {step===3&&<>
        <div className="modal-hd"><h3>✍️ Tu firma (arrendador)</h3><button className="close-btn" onClick={onClose}>✕</button></div>
        {bar(3,4)}
        <p style={{fontSize:13,color:"var(--warm)",marginBottom:12}}>Firma como arrendadora para validar el contrato.</p>
        <SignaturePad name="Joana Solé Santacana" onSign={(sig)=>set("ownerSignature",sig)}/>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button className="btn btn-o" onClick={()=>setStep(2)}>‹ Volver</button>
          <button className="btn btn-p" style={{flex:1}} onClick={handleSave} disabled={!form.ownerSignature||saving}>
            {saving?"⏳ Guardando...":"✅ Guardar y generar PDF"}
          </button>
        </div>
      </>}

      {/* ── STEP 4: CONFIRMACIÓN ── */}
      {step===4&&<>
        <div className="modal-hd"><h3>✅ Contrato firmado</h3><button className="close-btn" onClick={onClose}>✕</button></div>
        {bar(4,4)}
        <div style={{textAlign:"center",padding:"16px 0"}}>
          <div style={{fontSize:52,marginBottom:10}}>🎉</div>
          <h3 style={{fontFamily:"'DM Serif Display',serif",fontSize:22,marginBottom:6}}>¡Contrato firmado!</h3>
          <p style={{color:"var(--warm)",fontSize:13,marginBottom:18}}>Guardado en Contratos con ambas firmas.</p>
          <div style={{background:"var(--cream)",borderRadius:12,padding:14,marginBottom:18,textAlign:"left",fontSize:13}}>
            <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid var(--border)"}}><span style={{color:"var(--warm)"}}>Trastero</span><strong>{form.unit} · {form.building}</strong></div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid var(--border)"}}><span style={{color:"var(--warm)"}}>Inquilino</span><strong>{form.tenantName}</strong></div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid var(--border)"}}><span style={{color:"var(--warm)"}}>Duración</span><strong>{form.durationText}</strong></div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid var(--border)"}}><span style={{color:"var(--warm)"}}>Periodo</span><strong>{startFmt.day}/{startFmt.month}/{startFmt.year} → {endFmt.day}/{endFmt.month}/{endFmt.year}</strong></div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0"}}><span style={{color:"var(--warm)"}}>Renta</span><strong>{form.rent} €/mes</strong></div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"center"}}>
            <button className="btn btn-p" onClick={()=>generateContractPDF(savedData||form)}>📥 Descargar PDF</button>
            <button className="btn btn-o" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </>}
    </div>
  );
}

function AssignTenantModal({unit,buildings,onClose,onSave}){
  const [step,setStep]=useState(1); // 1=tenant data, 2=contract, 3=confirm
  const [saving,setSaving]=useState(false);
  const monthNames=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const now=new Date();
  const today=`${now.getDate().toString().padStart(2,"0")}/${(now.getMonth()+1).toString().padStart(2,"0")}/${now.getFullYear()}`;

  const [tenant,setTenant]=useState({
    name:"",phone:"",email:"",rent:"",docType:"recibo",payFreq:"mensual",
    ipcEnabled:"si",fianza:"no",fianzaAmount:"",notes:"",
    contractStart:now.toISOString().split("T")[0],
    contractEnd:"",rentRecibo:"",rentFactura:""
  });
  const [contract,setContract]=useState({
    addContract:true,
    durationMonths:"12", durationText:"UN AÑO",
  });
  const setT=(k,v)=>setTenant(t=>({...t,[k]:v}));
  const setC=(k,v)=>setContract(c=>({...c,[k]:v}));

  const handleSave=async()=>{
    setSaving(true);
    const startD=new Date(tenant.contractStart||new Date());
    const endD=new Date(startD);
    endD.setMonth(endD.getMonth()+(parseInt(contract.durationMonths)||12));
    const mNames=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    const contractData=contract.addContract?{
      unit:unit.name, building:unit.building,
      tenantName:tenant.name, tenantDni:tenant.dni||"", tenantAddress:tenant.address||"",
      rent:tenant.rent,
      signDay:String(new Date().getDate()), signMonth:mNames[new Date().getMonth()], signYear:String(new Date().getFullYear()),
      startDay:String(startD.getDate()), startMonth:mNames[startD.getMonth()], startYear:String(startD.getFullYear()),
      endDay:String(endD.getDate()), endMonth:mNames[endD.getMonth()], endYear:String(endD.getFullYear()),
      durationText:contract.durationText||"UN AÑO",
      contractStartISO:startD.toISOString().split("T")[0],
      contractEndISO:endD.toISOString().split("T")[0],
    }:null;
    await onSave({...tenant,building:unit.building},contractData);
    setSaving(false);
  };

  return(
    <div className="modal" style={{maxWidth:500}}>
      <div className="modal-hd">
        <h3>➕ Asignar inquilino · {unit.name}</h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      {/* Progress */}
      <div style={{display:"flex",gap:4,marginBottom:16}}>
        {[1,2,3].map(s=>(
          <div key={s} style={{flex:1,height:4,borderRadius:4,background:step>=s?"var(--terra)":"var(--border)"}}/>
        ))}
      </div>

      {step===1&&<>
        <div style={{fontSize:12,color:"var(--warm)",marginBottom:12,fontWeight:600,textTransform:"uppercase"}}>Datos del inquilino</div>
        <div className="fg"><label>Nombre *</label><input value={tenant.name} onChange={e=>setT("name",e.target.value)}/></div>
        <div className="gr2">
          <div className="fg"><label>Teléfono</label><input value={tenant.phone} onChange={e=>setT("phone",e.target.value)}/></div>
          <div className="fg"><label>Email</label><input value={tenant.email} onChange={e=>setT("email",e.target.value)}/></div>
        </div>
        <div className="fg"><label>Alquiler €/mes *</label><input type="number" value={tenant.rent} onChange={e=>setT("rent",e.target.value)}/></div>
        <div className="fg">
          <label>🧾 Tipo documento</label>
          <div style={{display:"flex",gap:8,marginTop:6}}>
            {["recibo","factura","ambos"].map(d=><button key={d} className={`btn btn-sm ${tenant.docType===d?"btn-p":"btn-o"}`} onClick={()=>setT("docType",d)}>{d.charAt(0).toUpperCase()+d.slice(1)}</button>)}
          </div>
        </div>
        {tenant.docType==="ambos"&&<div className="gr2">
          <div className="fg"><label>Importe Recibo €</label><input type="number" value={tenant.rentRecibo} onChange={e=>setT("rentRecibo",e.target.value)}/></div>
          <div className="fg"><label>Importe Factura €</label><input type="number" value={tenant.rentFactura} onChange={e=>setT("rentFactura",e.target.value)}/></div>
        </div>}
        <div className="fg">
          <label>📅 Frecuencia pago</label>
          <select value={tenant.payFreq} onChange={e=>setT("payFreq",e.target.value)}>
            {["mensual","2meses","3meses","4meses","6meses"].map(f=><option key={f} value={f}>{f==="mensual"?"Mensual":"Cada "+f.replace("meses"," meses")}</option>)}
          </select>
        </div>
        <div className="gr2">
          <div className="fg"><label>Inicio contrato</label><input type="date" value={tenant.contractStart} onChange={e=>setT("contractStart",e.target.value)}/></div>
          <div className="fg"><label>Fin contrato</label><input type="date" value={tenant.contractEnd} onChange={e=>setT("contractEnd",e.target.value)}/></div>
        </div>
        <div className="fg">
          <label>📈 IPC anual</label>
          <div style={{display:"flex",gap:8,marginTop:6}}>
            <button className={`btn btn-sm ${tenant.ipcEnabled==="si"?"btn-p":"btn-o"}`} onClick={()=>setT("ipcEnabled","si")}>✅ Sí</button>
            <button className={`btn btn-sm ${tenant.ipcEnabled==="no"?"btn-o btn-active":"btn-o"}`} onClick={()=>setT("ipcEnabled","no")}>❌ No</button>
          </div>
        </div>
        <div className="fg">
          <label>🔒 Fianza</label>
          <div style={{display:"flex",gap:8,marginTop:6}}>
            <button className={`btn btn-sm ${tenant.fianza==="si"?"btn-p":"btn-o"}`} onClick={()=>setT("fianza","si")}>✅ Sí</button>
            <button className={`btn btn-sm ${tenant.fianza==="no"?"btn-o":"btn-o"}`} onClick={()=>setT("fianza","no")}>❌ No</button>
          </div>
          {tenant.fianza==="si"&&<input style={{marginTop:8}} type="number" placeholder="Importe €" value={tenant.fianzaAmount} onChange={e=>setT("fianzaAmount",e.target.value)}/>}
        </div>
        <div className="fg"><label>📝 Notas</label><textarea value={tenant.notes} onChange={e=>setT("notes",e.target.value)} rows={2} style={{width:"100%",padding:"8px 12px",border:"1px solid var(--border)",borderRadius:10,fontFamily:"inherit",fontSize:13,resize:"vertical"}}/></div>
        <button className="btn btn-p btn-full" onClick={()=>setStep(2)} disabled={!tenant.name||!tenant.rent}>Siguiente →</button>
      </>}

      {step===2&&<>
        <div style={{fontSize:12,color:"var(--warm)",marginBottom:12,fontWeight:600,textTransform:"uppercase"}}>¿Crear contrato?</div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <button className={`btn btn-sm ${contract.addContract?"btn-p":"btn-o"}`} onClick={()=>setC("addContract",true)}>📝 Sí, crear contrato</button>
          <button className={`btn btn-sm ${!contract.addContract?"btn-s":"btn-o"}`} onClick={()=>setC("addContract",false)}>Sin contrato por ahora</button>
        </div>
        {contract.addContract&&<>
          <div className="fg">
            <label>⏱️ Duración</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:8}}>
              {[{l:"1 mes",m:1,t:"UN MES"},{l:"3 meses",m:3,t:"TRES MESES"},{l:"6 meses",m:6,t:"SEIS MESES"},{l:"11 meses",m:11,t:"ONCE MESES"},{l:"1 año",m:12,t:"UN AÑO"},{l:"2 años",m:24,t:"DOS AÑOS"},{l:"3 años",m:36,t:"TRES AÑOS"}].map(p=>(
                <button key={p.m} className={`btn btn-sm ${contract.durationMonths===String(p.m)?"btn-p":"btn-o"}`}
                  onClick={()=>{setC("durationMonths",String(p.m));setC("durationText",p.t);}}>
                  {p.l}
                </button>
              ))}
            </div>
            <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center"}}>
              <input type="number" min="1" value={contract.durationMonths} onChange={e=>{setC("durationMonths",e.target.value);setC("durationText",e.target.value+" MES"+(parseInt(e.target.value)===1?"":"ES"));}} style={{width:70}}/>
              <span style={{fontSize:12,color:"var(--warm)"}}>meses personalizados</span>
            </div>
          </div>
        </>}
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <button className="btn btn-o" onClick={()=>setStep(1)}>← Atrás</button>
          <button className="btn btn-p btn-full" onClick={()=>setStep(3)}>Siguiente →</button>
        </div>
      </>}

      {step===3&&<>
        <div style={{fontSize:12,color:"var(--warm)",marginBottom:12,fontWeight:600,textTransform:"uppercase"}}>Confirmar</div>
        <div style={{background:"var(--cream)",borderRadius:12,padding:14,marginBottom:16,fontSize:13}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:8}}>{tenant.name}</div>
          <div style={{color:"var(--warm)"}}>📦 {unit.name} · {unit.building}</div>
          <div style={{color:"var(--warm)"}}>💶 {tenant.rent}€/mes · {tenant.docType} · {tenant.payFreq}</div>
          {tenant.ipcEnabled==="si"&&<div style={{color:"var(--warm)"}}>📈 IPC activado</div>}
          {tenant.fianza==="si"&&<div style={{color:"var(--warm)"}}>🔒 Fianza: {tenant.fianzaAmount}€</div>}
          {contract.addContract&&<div style={{color:"var(--warm)",marginTop:4}}>📝 Contrato: {contract.startDay}/{contract.startMonth}/{contract.startYear||now.getFullYear()} → {contract.endDay}/{contract.endMonth}/{contract.endYear}</div>}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-o" onClick={()=>setStep(2)}>← Atrás</button>
          <button className="btn btn-p btn-full" onClick={handleSave} disabled={saving}>{saving?"Guardando...":"✅ Confirmar y asignar"}</button>
        </div>
      </>}
    </div>
  );
}

function ManageBuildingsModal({prop,onClose,onSave}){
  const [buildings,setBuildings]=useState([...(prop?.buildings||[])]);
  const [newBuilding,setNewBuilding]=useState("");

  const add=()=>{
    if(!newBuilding.trim())return;
    setBuildings(b=>[...b,newBuilding.trim()]);
    setNewBuilding("");
  };
  const remove=(i)=>setBuildings(b=>b.filter((_,j)=>j!==i));

  return(
    <div className="modal" style={{maxWidth:440}}>
      <div className="modal-hd">
        <h3>⚙️ Gestionar naves · {prop?.name}</h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>
      <div style={{marginBottom:12}}>
        {buildings.map((b,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
            <span style={{flex:1,fontSize:14}}>🏢 {b}</span>
            <button className="btn btn-o btn-sm" style={{color:"var(--red)",borderColor:"var(--red)"}} onClick={()=>remove(i)}>🗑️</button>
          </div>
        ))}
        {buildings.length===0&&<p style={{fontSize:13,color:"var(--warm)"}}>No hay naves definidas</p>}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <input
          value={newBuilding}
          onChange={e=>setNewBuilding(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&add()}
          placeholder="Nombre nave / edificio..."
          style={{flex:1}}
        />
        <button className="btn btn-p" onClick={add} disabled={!newBuilding.trim()}>➕</button>
      </div>
      <button className="btn btn-p btn-full" onClick={()=>onSave(buildings)}>💾 Guardar cambios</button>
    </div>
  );
}

function TrasterosPage({tenants,units,buildings,propId,onSaveUnit,onDeleteUnit,onAssignTenant}){
  const [adding,setAdding]=useState(false);
  const [newUnit,setNewUnit]=useState({name:"",building:buildings[0]||""});
  const getBuildingColor=(b,i)=>["#7A9E7E","#C4622D","#4F46E5","#D4A853","#D94F3D","#4A9B6F","#8C7B6E"][i%7];

  // Group units by building
  const allBuildings=[...new Set([...buildings,...units.map(u=>u.building)].filter(Boolean))];
  const getOccupant=(unit)=>tenants.find(t=>t.unit===unit.name&&t.building===unit.building);

  const totalFree=units.filter(u=>!getOccupant(u)).length;
  const totalOccupied=units.filter(u=>!!getOccupant(u)).length;

  const handleAdd=async()=>{
    if(!newUnit.name.trim())return;
    await onSaveUnit({...newUnit,propId,name:newUnit.name.trim()});
    setNewUnit({name:"",building:buildings[0]||""});
    setAdding(false);
  };

  return(
    <div>
      <div className="page-hd" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <h2>📦 Trasteros</h2>
          <p>{units.length} unidades · <span style={{color:"#4A9B6F",fontWeight:600}}>{totalOccupied} ocupadas</span> · <span style={{color:"#D94F3D",fontWeight:600}}>{totalFree} libres</span></p>
        </div>
        <button className="btn btn-p" onClick={()=>setAdding(v=>!v)}>➕ Añadir unidad</button>
      </div>

      {adding&&(
        <div className="card" style={{marginBottom:16}}>
          <div className="card-title">Nueva unidad</div>
          <div className="gr2">
            <div className="fg"><label>Nombre / Código</label>
              <input value={newUnit.name} onChange={e=>setNewUnit(u=>({...u,name:e.target.value}))} placeholder="Ej: Trastero 7, Local 2..."/>
            </div>
            <div className="fg"><label>Nave</label>
              <select value={newUnit.building} onChange={e=>setNewUnit(u=>({...u,building:e.target.value}))}>
                {buildings.filter(b=>b).map(b=><option key={b} value={b}>{b}</option>)}
                <option value="">Sin nave</option>
              </select>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-o" onClick={()=>setAdding(false)}>Cancelar</button>
            <button className="btn btn-p" onClick={handleAdd} disabled={!newUnit.name.trim()}>✅ Guardar</button>
          </div>
        </div>
      )}

      {allBuildings.length===0&&units.length===0&&(
        <div className="card"><p style={{textAlign:"center",color:"var(--warm)",padding:20}}>No hay unidades definidas. Añade la primera.</p></div>
      )}

      {allBuildings.map((building,bi)=>{
        const buildingUnits=units.filter(u=>u.building===building);
        if(buildingUnits.length===0)return null;
        const free=buildingUnits.filter(u=>!getOccupant(u)).length;
        return(
          <div key={building} style={{marginBottom:16,borderRadius:14,overflow:"hidden",border:"1px solid var(--border)"}}>
            <div style={{background:getBuildingColor(building,bi),color:"white",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:16}}>🏢 {building}</div>
              <div style={{fontSize:12,opacity:.85}}>{buildingUnits.length} unidades · {free} libre{free!==1?"s":""}</div>
            </div>
            <div style={{background:"white"}}>
              {buildingUnits.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})).map(unit=>{
                const occupant=getOccupant(unit);
                return(
                  <div key={unit.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:occupant?"#D94F3D":"#4A9B6F",flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:14}}>{unit.name}</div>
                      {occupant
                        ?<div style={{fontSize:12,color:"var(--warm)",marginTop:2}}>
                          👤 {occupant.name} · {occupant.rent}€/mes · hasta {occupant.contractEnd||"—"}
                        </div>
                        :<div style={{fontSize:12,color:"#4A9B6F",fontWeight:600,marginTop:2}}>🟢 Libre</div>
                      }
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      {!occupant&&<span className="badge" style={{background:"#E6F4ED",color:"#4A9B6F",fontSize:11}}>LIBRE</span>}
                      {occupant&&<span className="badge" style={{background:"#FDECEA",color:"#D94F3D",fontSize:11}}>OCUPADO</span>}
                      {!occupant&&<button className="btn btn-p btn-sm" onClick={()=>onAssignTenant(unit)}>➕ Asignar</button>}
                      <button className="btn btn-o btn-sm" style={{color:"var(--red)",borderColor:"var(--red)"}} onClick={()=>{if(confirm("¿Eliminar esta unidad?"))onDeleteUnit(unit.id);}}>🗑️</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Units without building */}
      {units.filter(u=>!u.building).length>0&&(
        <div style={{marginBottom:16,borderRadius:14,overflow:"hidden",border:"1px solid var(--border)"}}>
          <div style={{background:"#8C7B6E",color:"white",padding:"12px 16px",fontFamily:"'DM Serif Display',serif",fontSize:16}}>Sin nave asignada</div>
          <div style={{background:"white"}}>
            {units.filter(u=>!u.building).map(unit=>{
              const occupant=getOccupant(unit);
              return(
                <div key={unit.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:occupant?"#D94F3D":"#4A9B6F",flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14}}>{unit.name}</div>
                    {occupant?<div style={{fontSize:12,color:"var(--warm)",marginTop:2}}>👤 {occupant.name} · {occupant.rent}€/mes</div>:<div style={{fontSize:12,color:"#4A9B6F",fontWeight:600}}>🟢 Libre</div>}
                  </div>
                  <button className="btn btn-o btn-sm" style={{color:"var(--red)",borderColor:"var(--red)"}} onClick={()=>{if(confirm("¿Eliminar?"))onDeleteUnit(unit.id);}}>🗑️</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RenewContractModal({tenant,onClose,onRenew}){
  const [months,setMonths]=useState("12");
  const [preview,setPreview]=useState(null);

  const calcPreview=(m)=>{
    const currentEnd=tenant?.contractEnd?new Date(tenant.contractEnd):new Date();
    const newEnd=new Date(currentEnd);
    newEnd.setMonth(newEnd.getMonth()+parseInt(m));
    return newEnd.toISOString().split("T")[0];
  };

  const options=[
    {value:"3",label:"3 meses"},
    {value:"6",label:"6 meses"},
    {value:"11",label:"11 meses"},
    {value:"12",label:"1 año"},
    {value:"24",label:"2 años"},
    {value:"36",label:"3 años"},
    {value:"48",label:"4 años"},
    {value:"60",label:"5 años"},
  ];

  const newRent=tenant?.ipcEnabled==="si"?Math.round((tenant?.rent||0)*1.015*100)/100:tenant?.rent;
  const newEnd=calcPreview(months);

  return(
    <div className="modal" style={{maxWidth:420}}>
      <div className="modal-hd"><h3>🔄 Renovar contrato</h3><button className="close-btn" onClick={onClose}>✕</button></div>
      <div style={{background:"var(--cream)",borderRadius:10,padding:12,marginBottom:16,fontSize:13}}>
        <div style={{fontWeight:600,marginBottom:4}}>{tenant?.name} · {tenant?.unit}</div>
        <div style={{color:"var(--warm)"}}>Contrato actual hasta: <strong>{tenant?.contractEnd||"—"}</strong></div>
      </div>
      <div className="fg">
        <label>⏱️ Renovar por</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:8}}>
          {options.map(o=>(
            <button key={o.value} className={`btn btn-sm ${months===o.value?"btn-p":"btn-o"}`} onClick={()=>setMonths(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{background:"var(--cream)",borderRadius:10,padding:14,marginTop:12}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:13}}>
          <span style={{color:"var(--warm)"}}>Nueva fecha fin</span>
          <strong>{newEnd}</strong>
        </div>
        {tenant?.ipcEnabled==="si"&&(
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}>
            <span style={{color:"var(--warm)"}}>Nuevo alquiler (+IPC 1,5%)</span>
            <strong style={{color:"var(--sage)"}}>{newRent}€/mes</strong>
          </div>
        )}
        {tenant?.ipcEnabled!=="si"&&(
          <div style={{fontSize:12,color:"var(--warm)"}}>Sin subida de IPC</div>
        )}
      </div>
      <button className="btn btn-p btn-full" style={{marginTop:16}} onClick={()=>onRenew(months)}>
        ✅ Confirmar renovación
      </button>
    </div>
  );
}

function StatusBadge({status,t}){
  const map={"Pendiente":{bg:"#FDECEA",color:"#D94F3D",label:t?.pending||"Pendiente"},"En revisión":{bg:"#FDF6E3",color:"#D4A853",label:t?.inReview||"En revisión"},"Resuelto":{bg:"#E6F4ED",color:"#4A9B6F",label:t?.resolved||"Resuelto"}};
  const s=map[status]||{bg:"#F0ECE8",color:"#8C7B6E",label:status};
  return<span className="badge" style={{background:s.bg,color:s.color}}>{s.label}</span>;
}
