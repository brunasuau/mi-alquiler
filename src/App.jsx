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
  let y=25;
  const lh=5.8;

  function checkPage(n=12){ if(y+n>282){d.addPage();y=20;} }
  function sp(n=4){y+=n;}

  // Render mixed bold/normal paragraph with word-wrap
  function para(segs, extraAfter=3){
    d.setFontSize(10);
    // flatten to word tokens
    let tokens=[];
    segs.forEach(s=>{
      const words=s.text.split(/( )/);
      words.forEach(w=>{ if(w!=="")tokens.push({w,bold:!!s.bold}); });
    });
    let lines=[[]]; let lw=0;
    tokens.forEach(tok=>{
      d.setFont("helvetica",tok.bold?"bold":"normal");
      const tw=d.getTextWidth(tok.w);
      if(lw+tw>maxW && lines[lines.length-1].length>0){lines.push([]);lw=0;}
      lines[lines.length-1].push(tok); lw+=tw;
    });
    lines.forEach(line=>{
      checkPage();
      let cx=lm;
      line.forEach(tok=>{
        d.setFont("helvetica",tok.bold?"bold":"normal");
        d.text(tok.w,cx,y); cx+=d.getTextWidth(tok.w);
      });
      y+=lh;
    });
    y+=extraAfter;
  }

  function t(txt,bold=false){ return {text:txt,bold}; }

  function title(txt){
    checkPage(10);
    d.setFont("helvetica","bold"); d.setFontSize(13);
    d.text(txt,105,y,{align:"center"}); y+=9; d.setFontSize(10);
  }
  function clausula(label){
    checkPage(8); sp(1);
    d.setFont("helvetica","bold"); d.setFontSize(10);
    d.text(label,lm,y); y+=lh+1;
  }
  function seccion(label){
    checkPage(8); sp(2);
    d.setFont("helvetica","bold"); d.setFontSize(10);
    d.text(label,lm,y); y+=lh+1;
  }

  // ─── CABECERA ───────────────────────────────────────────
  title("CONTRATO DE ALQUILER PARA USO DISTINTO A VIVIENDA");
  sp(2);
  para([t("En Calafell, a "),t(signDay+" de "+signMonth+" de "+signYear,true)]);
  sp(2);

  // ─── REUNIDOS ───────────────────────────────────────────
  seccion("R E U N I D O S:");
  para([t("De una parte, "),t("Joana Solé Santacana",true),t(", mayor de edad, con domicilio a estos efectos en el Passeig Marítim Sant Joan de Déu núm. 90, Esc. B, 5º 2ª de Calafell, provista de DNI número "),t("36618190T",true),t(".")]);
  para([t("De otra, Sr/a. "),t(tenantName,true),t(", mayor de edad, con domicilio a estos efectos en "),t(tenantAddress,true),t(", provista de DNI número "),t(tenantDni,true),t(".")]);
  para([t("Después de reconocerse mutua y recíprocamente la legal y precisa capacidad legal para obligar y obligarse cuanto en derecho fuera menester, haciéndolo libre y voluntariamente,")]);

  // ─── MANIFIESTAN ────────────────────────────────────────
  seccion("M A N I F I E S T A N:");
  para([t("I.- Que Joana Solé Santacana por sus justos y legítimos títulos resulta ser titular del trastero número "),t(unit,true),t(" situado en la Nave Industrial "),t(building||"",true),t(" sita en C/ Pou, 61 Calafell (Tarragona).")]);
  para([t("II.- Que, la arrendataria está interesada en el arrendamiento de dicho Trastero para almacenar en el mismo existencias y/o utensilios propios de su objeto social.")]);
  para([t("Que, en virtud de lo referido, acuerdan formalizar el presente contrato por el que pactan las siguientes,")]);

  // ─── CLÁUSULAS ──────────────────────────────────────────
  seccion("C L Á U S U L A S:");

  clausula("PRIMERA.-");
  para([t("Joana Solé Santacana, en adelante, arrendadora, cede en arrendamiento a "),t(tenantName,true),t(", en adelante, la arrendataria, quien acepta, “EL TRASTERO”, sito en la calle Pou núm. 61 de Calafell, (Trastero núm. "),t(unit,true),t(" "),t(building||"",true),t("), cuya ubicación, lindes, características, estado de conservación, elementos y servicios comunes y privativos, manifiestan las partes conocer.")]);

  clausula("SEGUNDA.-");
  para([t("Las partes convienen en establecer la duración de este contrato de "),t(durationText,true),t(", en las condiciones que en el presente se estipulan. Finalizado el plazo establecido de duración del contrato la parte arrendataria deberá dejar libre y vacua la nave objeto de alquiler, sin necesidad de que la misma efectúe requerimiento ni notificación previa alguna; ello sin perjuicio de que las partes puedan con carácter previo, formalizar nuevo contrato de alquiler o prórroga expresa del presente.")]);
  para([t("La parte arrendataria podrá renunciar libremente al contrato de alquiler, siempre que la renuncia se comunique de forma fehaciente por cualquier medio, con una antelación mínima de tres meses. El incumplimiento en el plazo de preaviso estipulado comportará el devengo de una indemnización a favor de la arrendadora equivalente al importe de la renta de alquiler por el plazo transcurrido entre el día en que se efectúa el preaviso y los citados tres meses.")]);
  para([t("Con independencia de lo anterior, la rescisión unilateral anticipada por parte de la sociedad arrendataria comportará la pérdida de la fianza estipulada en el pacto quinto.")]);

  clausula("TERCERA.-");
  para([t("Con expresa renuncia por los contratantes a lo establecido en el artículo 34 de la L.A.U., se acuerda que la extinción del contrato por el transcurso del término convenido no dará derecho a la arrendataria a indemnización alguna a cargo de la arrendadora.")]);

  clausula("CUARTA.-");
  para([t("Las partes establecen una renta de alquiler de "),t(rent+" €",true),t(" mensuales. La renta se abonará de forma anticipada durante los cinco primeros días de cada una de las mensualidades en la cuenta núm. "),t("ES26 2100 0366 8502 0071 2257",true),t(", titular de la Sra. Joana Solé, de la parte arrendadora, o en la que la misma designe. Sin perjuicio de ello, de desear la arrendadora domiciliar los recibos, la parte arrendataria firmará la correspondiente autorización para el adeudo domiciliado B2B.")]);
  para([t("La renta de alquiler será objeto de actualización anual según el Índice General de Precios al Consumo. La primera actualización se efectuará en "),t(signMonth,true),t(", conforme el IPC interanual al mes de diciembre, si bien podrá aplicarse provisionalmente el último índice publicado. La renta no será objeto de modificación en el supuesto de que dicho índice resultare negativo. La renta actualizada conforme se ha indicado, será exigible a partir del mes siguiente a aquel en que la parte arrendadora lo notifique a la arrendataria por escrito, expresando el porcentaje de alteración aplicado. En ningún caso la demora en aplicar la revisión supondrá renuncia o caducidad a la misma.")]);
  para([t("Adicionalmente a la renta de alquiler pactada, y en tanto que no existen contadores de consumo individualizados, la parte arrendataria participará en los gastos de luz y agua de la nave en la que se encuentra el trastero objeto de arrendamiento, en la cantidad de "),t("2,5€",true),t(" mensuales.")]);

  clausula("QUINTA.-");
  para([t("No se establece ningún tipo de fianza.")]);

  clausula("SEXTA.-");
  para([t("Si finalizado el término de duración del presente contrato, o finado el mismo por cualquier causa, la parte arrendataria no deja libre el trastero a disposición de la propiedad, indemnizará a la arrendadora en la cantidad de "),t("10,00 €",true),t(" diarios; si el retraso en el desalojo fuere de dos meses o superior, la indemnización se fijará en "),t("20,00 €",true),t(" diarios. Dicha cantidad se considerará de carácter indemnizatorio y se adicionará a la renta del periodo de permanencia. Sin perjuicio de la posible reclamación por otros conceptos estipulados en el presente contrato y de mayor cuantía por daños y perjuicios derivados de la falta de desalojo, si fueren los mismos de superior cuantía.")]);
  para([t("Al finalizar el contrato por cualquier causa, incluida la renuncia unilateral, la parte arrendataria deberá dejar el trastero libre y vacuo de elementos de su propiedad, a disposición de la parte arrendadora, entendiéndose que, de no hacerlo, se considerarán cedidos de forma gratuita a favor de la ahora arrendadora, quien por tanto podrá hacer uso libre de los mismos, incluso destruirlos.")]);

  clausula("SÉPTIMA.-");
  para([t("Serán a cuenta de la arrendataria todo tipo de impuestos, gravámenes y demás cargas fiscales, laborales, etc., que resultaren necesarios para la gestión y uso del trastero que se arrienda.")]);
  para([t("De resultar preciso, será por cuenta y cargo de la arrendataria los trámites y tasas que devenguen por la legalización del trastero-almacén, licencias y demás autorizaciones administrativas, quedando indemne la propiedad de la total tramitación del expediente. A estos efectos se deja constancia de que en la fijación del precio pactado se ha tenido en cuenta el actual estado del inmueble.")]);

  clausula("OCTAVA.-");
  para([t("La arrendataria se hace directa y exclusivamente responsable, eximiendo de cualquier responsabilidad a la propiedad, de los daños que puedan ocasionarse a personas o cosas en el trastero arrendado, o que sean consecuencia de la actividad realizada en el mismo. Se compromete a contratar un Seguro que cubra durante la vigencia del contrato los riesgos básicos, daños materiales en contenido, robo y expoliación del contenido y responsabilidad civil.")]);

  clausula("NOVENA.-");
  para([t("Será de cuenta y cargo de la parte arrendadora el IBI y tasa de recogida de basuras; respecto a los suministros, de no proceder la parte arrendataria a efectuar y contratar instalación individualizada de los mismos, se estará a lo convenido en el pacto cuarto de este contrato.")]);

  clausula("DÉCIMA.-");
  para([t("Con expresa renuncia al art. 32 de la L.A.U., la arrendataria no podrá subarrendar, ni ceder, el local objeto del presente contrato, ni total, ni parcialmente, si no es con el consentimiento previo y por escrito de la arrendadora. Se considerará cesión no consentida cualquier transmisión de títulos que comporte la pérdida de titularidad real por parte de la arrendataria, ello salvo autorización expresa de la parte arrendadora.")]);

  clausula("DÉCIMO-PRIMERA.-");
  para([t("El trastero se arrienda en las condiciones en las que actualmente se encuentra y de las que resulta plenamente conocedora la parte arrendataria.")]);
  para([t("La parte arrendataria no podrá efectuar obra alguna sin el consentimiento expreso escrito de la parte arrendadora, salvo aquellas propias del mantenimiento y reparación de las instalaciones o las que fueren exigidas por las autoridades para el desarrollo de la actividad, cuyo coste será, en todo caso, a cargo de la parte arrendataria.")]);
  para([t("En el supuesto de que la parte arrendataria fuera requerida por administración pública a efectuar obras de adaptación del trastero, las mismas se llevarían a cabo de conformidad con la legislación vigente, siendo requisito la presentación del proyecto a la arrendadora a fin de que la misma autorice los aspectos de carácter estético inherentes a la obra.")]);
  para([t("Resultaría asimismo necesaria la contratación de seguro a cargo de la arrendataria que cubriera cualquier riesgo inherente a las mismas. Finalizado el contrato por cualquier motivo, cualquier obra efectuada por la arrendataria en el local quedará en beneficio de la arrendadora de forma gratuita.")]);

  clausula("DÉCIMO-SEGUNDA.-");
  para([t("La arrendataria, por su propio interés, se compromete a conservar y cuidar el objeto arrendado con la diligencia de un ordenado comerciante, debiendo realizar por su cuenta y cargo las obras necesarias de conservación, reparación y reposición de todos los elementos arrendados, a fin de que se encuentren, al finalizar el presente contrato, en el mismo estado en que actualmente se hallan. Renuncia a los efectos indicados al art. 21 en relación con el 30 de la L.A.U.")]);

  clausula("DÉCIMO-TERCERA.-");
  para([t("La arrendataria se obliga a permitir el acceso al trastero arrendado a la arrendadora o a la persona u operarios que esta delegue, durante la vigencia del presente.")]);

  clausula("DÉCIMO-CUARTA.-");
  para([t("El trastero arrendado no puede, bajo ningún concepto, ser destinado a vivienda propia o de terceras personas, sean o no familiares o dependientes de la arrendataria, ya sea parcial o totalmente, ni a ningún otro uso que el especificado anteriormente, salvo autorización expresa por escrito de los propietarios.")]);

  clausula("DÉCIMO-QUINTA.-");
  para([t("Queda expresamente prohibido el almacenaje en el trastero de materias peligrosas o insalubres, así como realizar actividades ilegales, incluso el almacenaje de productos ilícitos, sea por resultar su tenencia prohibida, o su origen; todo ello será causa de rescisión automática del presente contrato; bastando para ello la apertura de juicio oral, o el procesamiento por cualquier autoridad judicial, ya sea contra la arrendataria, su administrador y/o contra la avaladora.")]);

  clausula("DÉCIMO-SEXTA.-");
  para([t("La arrendataria renuncia de forma expresa a la aplicación del art. 25, en relación al art. 31 de la L.A.U., renunciando a sus derechos a adquisición preferente, tanteo y retracto sobre el local arrendado.")]);

  clausula("DÉCIMO-SÉPTIMA.-");
  para([t("La arrendataria responde, conjunta y solidariamente, con renuncia al derecho de excusión, división y orden; respecto de todos y cada uno de los compromisos asumidos en el presente contrato y en especial del pago de la renta de alquiler.")]);

  clausula("DÉCIMO-OCTAVA.-");
  para([t("Para cualquier clase de duda respecto a la interpretación o cumplimiento del presente contrato, ambas partes, con renuncia expresa al fuero de su domicilio o cualquier otro si lo tuvieran, se someten expresamente a la jurisdicción y competencia de los Juzgados y Tribunales de El Vendrell.")]);

  sp(4);
  para([t("Y en prueba de conformidad, las partes afirmándose y ratificándose en el contenido de este contrato, lo firman por duplicado, con promesa de cumplirlo bien y fielmente, en el lugar y fecha indicados en el encabezamiento.")]);

  // ─── FIRMAS ─────────────────────────────────────────────
  checkPage(55); sp(8);
  d.setFont("helvetica","bold"); d.setFontSize(10);
  d.text("EL ARRENDADOR",lm,y);
  d.text("LA ARRENDATARIA",115,y);
  y+=7;
  d.setFont("helvetica","normal"); d.setFontSize(9);
  d.text("Fdo.: Joana Solé Santacana",lm,y);
  d.text("Fdo.: "+tenantName,115,y);
  y+=5;

  if(ownerSignature){ try{ d.addImage(ownerSignature,"PNG",lm,y,65,22); }catch(e){} }
  else { d.setDrawColor(150); d.line(lm,y+20,lm+65,y+20); }

  if(tenantSignature){ try{ d.addImage(tenantSignature,"PNG",115,y,65,22); }catch(e){} }
  else { d.setDrawColor(150); d.line(115,y+20,180,y+20); }

  const fn="Contrato_"+((unit||"").replace(/ /g,"_"))+"_"+((tenantName||"").replace(/ /g,"_"))+"_"+signYear+".pdf";
  d.save(fn);
  return fn;
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
        <p style={{fontSize:12,color:"var(--warm)",marginBottom:12}}>Rellena los campos que aparecen en la plantilla del contrato.</p>

        <div style={{fontSize:11,fontWeight:700,color:"var(--warm)",textTransform:"uppercase",letterSpacing:".6px",marginBottom:8}}>📦 Trastero</div>
        <div className="gr2">
          <div className="fg"><label>Número de trastero *</label><input value={form.unit} onChange={e=>set("unit",e.target.value)} placeholder="Ej: 7"/></div>
          <div className="fg"><label>Nave *</label><input value={form.building} onChange={e=>set("building",e.target.value)} placeholder="Ej: Nave Industrial A"/></div>
        </div>

        <div style={{fontSize:11,fontWeight:700,color:"var(--warm)",textTransform:"uppercase",letterSpacing:".6px",marginBottom:8,marginTop:4}}>👤 Inquilino (arrendatario)</div>
        <div className="gr2">
          <div className="fg"><label>Nombre completo *</label><input value={form.tenantName} onChange={e=>set("tenantName",e.target.value)} placeholder="Nombre y apellidos / Razón social"/></div>
          <div className="fg"><label>DNI / NIF *</label><input value={form.tenantDni} onChange={e=>set("tenantDni",e.target.value)} placeholder="12345678A"/></div>
        </div>
        <div className="fg"><label>Domicilio del inquilino *</label><input value={form.tenantAddress} onChange={e=>set("tenantAddress",e.target.value)} placeholder="Calle, nº, piso, ciudad"/></div>

        <div style={{fontSize:11,fontWeight:700,color:"var(--warm)",textTransform:"uppercase",letterSpacing:".6px",marginBottom:8,marginTop:4}}>💶 Alquiler</div>
        <div className="fg"><label>Renta mensual (€) *</label><input type="number" value={form.rent} onChange={e=>set("rent",e.target.value)} placeholder="Ej: 250"/></div>

        <div style={{fontSize:11,fontWeight:700,color:"var(--warm)",textTransform:"uppercase",letterSpacing:".6px",marginBottom:8,marginTop:4}}>⏱️ Duración</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
          {DURATION_PRESETS.map(p=>(
            <button key={p.months} className={`btn btn-sm ${form.durationMonths===String(p.months)?"btn-p":"btn-o"}`}
              onClick={()=>{set("durationMonths",String(p.months));set("durationText",p.text);}}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12}}>
          <input type="number" min="1" value={form.durationMonths} onChange={e=>{
            const m=e.target.value;
            const preset=DURATION_PRESETS.find(p=>String(p.months)===m);
            set("durationMonths",m);
            set("durationText",preset?preset.text:m+(parseInt(m)===1?" MES":" MESES"));
          }} style={{width:80}}/>
          <span style={{fontSize:13,color:"var(--warm)"}}>meses (personalizado)</span>
        </div>

        <div style={{fontSize:11,fontWeight:700,color:"var(--warm)",textTransform:"uppercase",letterSpacing:".6px",marginBottom:8}}>📅 Fechas</div>
        <div className="gr2">
          <div className="fg"><label>Fecha inicio contrato</label><input type="date" value={form.startISO} onChange={e=>set("startISO",e.target.value)}/></div>
          <div className="fg"><label>Fecha firma del contrato</label>
            <div style={{display:"flex",gap:4}}>
              <input style={{width:44}} value={form.signDay} onChange={e=>set("signDay",e.target.value)} placeholder="día"/>
              <select value={form.signMonth} onChange={e=>set("signMonth",e.target.value)} style={{flex:1}}>
                {monthNames.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
              <input style={{width:54}} value={form.signYear} onChange={e=>set("signYear",e.target.value)}/>
            </div>
          </div>
        </div>

        {form.startISO&&<div style={{background:"#E6F4ED",border:"1px solid #4A9B6F",borderRadius:10,padding:10,fontSize:13,marginBottom:12}}>
          📅 <strong>{startFmt.day} de {startFmt.month} de {startFmt.year}</strong> → <strong>{endFmt.day} de {endFmt.month} de {endFmt.year}</strong> &nbsp;·&nbsp; <strong>{form.durationText}</strong>
        </div>}

        <button className="btn btn-p btn-full" onClick={()=>setStep(2)} disabled={!form.unit||!form.tenantName||!form.tenantDni||!form.tenantAddress||!form.rent}>
          Siguiente → Firma del inquilino ›
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

export default function App() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Mi Alquiler</h1>
    </div>
  );
}
