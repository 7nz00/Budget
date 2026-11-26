"use strict";
/* ===== objectifs ===== */
function goalName(g){return g.n||(acctLabel(g.c)+" à "+eur0(g.t))}
function goalEstimate(g,cur){
  if(cur>=g.t) return {done:true,t:"Objectif atteint",short:"atteint",st:"done"};
  var rate=monthlyRate(g.c), left=g.t-cur, skip=currentDepot()?0:1, out={st:""};
  if(rate<=0){out.t="Règle la jauge sur l'accueil pour estimer la date";out.short="pas de rythme défini"}
  else{
    var n=Math.ceil(left/rate), pre="À "+eur0(rate)+" par mois : ";
    if(n>240){out.t=pre+"plus de 20 ans";out.short="dans plus de 20 ans"}
    else{
      var d=new Date(); d.setDate(1); d.setMonth(d.getMonth()+n-skip);
      var when=d.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
      out.t=pre+when+" ("+n+" mois)"; out.short=when;
    }
  }
  if(g.by){
    var months=mDiff(monthKey(),g.by)+skip;
    if(months<=0){out.t2="Date limite dépassée";out.st="late"}
    else{
      var need=left/months;
      out.t2="Pour y arriver avant "+monthLong(g.by).toLowerCase()+" : "+eur0(need)+" par mois";
      out.st=rate>=need?"ok":"late";
    }
  }
  return out;
}
function renderGoals(){
  var box=$("goals"); box.textContent="";
  state.goals.forEach(function(g){
    var cur=balanceOf(g.c), pct=Math.min(100,cur/g.t*100), est=goalEstimate(g,cur);
    var w=el("button","goal"); w.type="button"; w.setAttribute("aria-label","Modifier l'objectif "+goalName(g));
    var rg=el("div","ring"); rg.innerHTML=miniRing(pct,acctColor(g.c)); rg.appendChild(el("span","num",fmt0.format(pct)+" %")); w.appendChild(rg);
    var body=el("div","gbody");
    body.appendChild(el("div","gt",goalName(g)));
    body.appendChild(el("div","gs num",eur0(cur)+" sur "+eur0(g.t)));
    if(!est.done) body.appendChild(el("div","gs num","Il reste "+eur0(g.t-cur)));
    body.appendChild(el("div","gchip"+(est.done?" done":""),est.t));
    if(est.t2){body.appendChild(document.createElement("br"));body.appendChild(el("div","gchip "+est.st,est.t2))}
    w.appendChild(body);
    w.addEventListener("click",function(){openGoalSheet(g)});
    box.appendChild(w);
  });
  if(!state.goals.length) box.appendChild(el("p","empty","Aucun objectif pour le moment. Fixe-toi un montant à atteindre sur le Livret A, le PEA ou l'ensemble."));
  var hb=$("hGoals"); hb.textContent="";
  state.goals.slice(0,2).forEach(function(g){
    var cur=balanceOf(g.c), pct=Math.min(100,cur/g.t*100);
    var w=el("div","hgoal"), h=el("div","head");
    h.appendChild(el("span","",goalName(g))); h.appendChild(el("span","num",fmt0.format(pct)+" %")); w.appendChild(h);
    var tr=el("div","track"), f=el("span","fill"); f.style.width=pct+"%"; f.style.background=acctColor(g.c); tr.appendChild(f); w.appendChild(tr);
    hb.appendChild(w);
  });
}
function openGoalSheet(g){
  openSheet(g?"Modifier l'objectif":"Nouvel objectif",function(body){
    var acct=el("select"); [["livret","Livret A"],["pea","PEA"],["cto","Compte-titres"],["total","Épargne totale"]].forEach(function(z){var o=el("option","",z[1]);o.value=z[0];if(g&&g.c===z[0])o.selected=true;acct.appendChild(o)});
    var amt=amountInput(g?g.t:0,"Montant de l'objectif en euros"); amt.placeholder="5 000";
    var name=el("input"); name.type="text"; name.maxLength=40; name.value=g?g.n:""; name.placeholder="Ex. : voyage, permis…"; name.setAttribute("aria-label","Nom de l'objectif");
    var by=el("input"); by.type="month"; by.value=g?g.by:""; by.setAttribute("aria-label","Date limite");
    body.appendChild(field("Compte concerné",acct)); body.appendChild(field("Montant à atteindre (€)",amt));
    body.appendChild(field("Nom (facultatif)",name)); body.appendChild(field("Avant le mois de (facultatif)",by));
    var err=el("p","err"); err.setAttribute("role","alert"); body.appendChild(err);
    var btns=el("div","btns"), ok=el("button","sav-btn",g?"Enregistrer":"Créer"); ok.type="button"; btns.appendChild(ok);
    if(g){var del=el("button","sav-btn danger","Supprimer");del.type="button";btns.appendChild(del);
      del.addEventListener("click",function(){closeSheet();withUndo("Objectif supprimé",function(){state.goals=state.goals.filter(function(z){return z.id!==g.id})})})}
    else btns.style.gridTemplateColumns="1fr";
    body.appendChild(btns);
    var cancel=el("button","link","Annuler"); cancel.type="button"; cancel.addEventListener("click",closeSheet); body.appendChild(cancel);
    ok.addEventListener("click",function(){
      var t=num(amt.value);
      if(!t){err.textContent="Indique le montant à atteindre.";return}
      if(!g&&state.goals.length>=20){err.textContent="20 objectifs au maximum.";return}
      var v={n:txt(name.value,40),c:acct.value,t:t,by:RE_M.test(by.value)?by.value:""};
      closeSheet();
      withUndo(g?"Objectif modifié":"Objectif créé",function(){
        if(g){var z=state.goals.filter(function(q){return q.id===g.id})[0];if(z){z.n=v.n;z.c=v.c;z.t=v.t;z.by=v.by}}
        else state.goals.push({id:uid(),n:v.n,c:v.c,t:v.t,by:v.by});
      });
    });
  });
}
$("newGoal").addEventListener("click",function(){openGoalSheet(null)});

/* ===== épargne ===== */
function setBalances(){
  $("balL").value=state.livret?fmt.format(state.livret):"";
  $("balP").value=state.pea?fmt.format(state.pea):"";
  $("balC").value=state.cto?fmt.format(state.cto):"";
}
function renderSavings(){
  var tot=balanceOf("total");
  $("patri").textContent=eur(tot); $("hSav").textContent=eur(tot);
  $("hL").textContent=eur0(state.livret); $("hP").textContent=eur0(peaTotal()); $("hC").textContent=eur0(ctoTotal());
  // PEA / compte-titres : total en grand, espèces modifiables + actions en dessous,
  // et le montant prévu par la jauge tant que le mois n'est pas ajouté au suivi.
  var dep=currentDepot();
  [["pea","P",planPea()],["cto","C",planCto()]].forEach(function(x){
    var t=titres(x[0]);
    $("tot"+x[1]).textContent=eur(balanceOf(x[0]));
    $("act"+x[1]).textContent=t?"+ "+eur(t)+" en actions":"";
    $("plan"+x[1]).textContent=!dep&&x[2]>0?"+"+eur0(x[2])+" prévus ce mois":"";
  });
  var pts=series(), sp=$("hSpark"); sp.textContent="";
  if(pts.length>=2) sp.innerHTML=areaChart(pts,true);
  var l=state.h1, p=planPea(), c=planCto(), e=currentDepot();
  $("preview").textContent="Ce mois : +"+eur(l)+" sur le Livret A, +"+eur(p)+" sur le PEA"+(c?", +"+eur(c)+" sur le compte-titres":"");
  var btn=$("addSav"), same=e&&e.l===l&&e.p===p&&e.t===c;
  btn.disabled=!!same;
  btn.textContent=same?"Ce mois est déjà ajouté":(e?"Mettre à jour ce mois":"Ajouter ce mois au suivi · +"+eur0(l+p+c));
  $("undoSav").hidden=!e;
  $("remind").hidden=!!e;
  var P=curP(); $("remindText").textContent="Pense à ajouter "+(isPay(P)?"ton mois du "+dShort(P):monthLong(P).toLowerCase())+" à ton épargne.";
  $("migrate").hidden=!(state.mig&&v1Raw);
  renderGoals(); renderChart(); renderProj();
}
function renderChart(){
  var box=$("chart"); box.textContent="";
  var pts=series();
  if(pts.length<2){box.appendChild(el("p","empty","La courbe apparaît dès que tu as au moins deux mois de suivi. Ajoute les mois passés dans les mouvements."));return}
  var wrap=el("div",""); wrap.innerHTML=areaChart(pts,false); box.appendChild(wrap);
  var a=pts[0], z=pts[pts.length-1], cap2=el("div","chart-cap");
  var s1=el("span","num"); s1.appendChild(document.createTextNode(monthShort(a.m)+" : ")); s1.appendChild(el("b","",eur0(a.l+a.p)));
  var s2=el("span","num"); s2.appendChild(document.createTextNode(monthShort(z.m)+" : ")); s2.appendChild(el("b","",eur0(z.l+z.p)));
  cap2.appendChild(s1); cap2.appendChild(s2); box.appendChild(cap2);
  var lg=el("div","lg");
  [["var(--livret)","Livret A"],["var(--pea)","PEA"],["var(--cto)","Compte-titres"],["var(--muted)","empilés, échelle zoomée"]].forEach(function(x){
    var s=el("span",""),i=el("i","dotc");i.style.background=x[0];s.appendChild(i);s.appendChild(document.createTextNode(x[1]));lg.appendChild(s);
  });
  box.appendChild(lg);
}
function renderProj(){
  var box=$("proj"); box.textContent="";
  var st=el("div","stats3");
  [6,12,24].forEach(function(n){
    var s=el("div","stat"+(n===12?" good":"")); s.appendChild(el("div","k","Dans "+n+" mois")); s.appendChild(el("div","v num",eur0(project(n).total))); st.appendChild(s);
  });
  box.appendChild(st);
  var p12=project(12), n=el("p","small-p");
  n.style.margin="12px 0 0";
  n.textContent="Si tu gardes ta répartition actuelle ("+eur0(state.h1)+" sur le Livret A, "+eur0(planPea())+" sur le PEA, "+eur0(planCto())+" sur le compte-titres par mois). Intérêts du Livret A à "+fmt.format(state.rate)+" % : environ "+eur0(p12.interest)+" sur 12 mois. Actions comptées sans hausse ni baisse.";
  box.appendChild(n);
}
$("balL").addEventListener("input",function(){state.livret=num(this.value);renderSavings();save()});
$("balP").addEventListener("input",function(){state.pea=num(this.value);renderSavings();renderBourse();save()});
$("balC").addEventListener("input",function(){state.cto=num(this.value);renderSavings();renderBourse();save()});
$("addSav").addEventListener("click",function(){
  var e=currentDepot(); if(e){applyOp(e,-1);state.ops=state.ops.filter(function(o){return o!==e})}
  var P=curP(), o={id:uid(),k:"depot",m:pStart(P).slice(0,7),l:state.h1,p:planPea(),t:planCto()};
  if(isPay(P)) o.pk=P;
  state.ops.push(o); applyOp(o,1); setBalances(); renderOps(); refresh(); save(); haptic();
});
$("undoSav").addEventListener("click",function(){
  var e=currentDepot(); if(!e)return;
  withUndo("Ajout du mois annulé",function(){applyOp(e,-1);state.ops=state.ops.filter(function(o){return o!==e})});
});
$("remindGo").addEventListener("click",function(){show("epargne");$("addSav").scrollIntoView({behavior:"smooth",block:"center"})});

document.querySelectorAll("#opKind button").forEach(function(b){
  b.addEventListener("click",function(){
    ui.opKind=b.dataset.k;
    document.querySelectorAll("#opKind button").forEach(function(x){x.setAttribute("aria-pressed",x===b?"true":"false")});
  });
});
$("opMonth").value=monthKey();
$("opForm").addEventListener("submit",function(e){
  e.preventDefault();
  var a=num($("opAmt").value), m=$("opMonth").value||monthKey(), err=$("opErr");
  if(!a){err.textContent="Indique un montant.";return}
  if(!RE_M.test(m)){err.textContent="Mois invalide.";return}
  err.textContent="";
  var o={id:uid(),k:ui.opKind,m:m,c:$("opAcct").value,a:a};
  if(m===monthKey()&&isPay(curP())) o.pk=curP();
  if(ui.opKind==="retrait"){var bal=cashOf(o.c);if(a>bal){err.textContent="Retrait supérieur aux espèces disponibles ("+eur(bal)+").";return}}
  state.ops.push(o); applyOp(o,1); $("opAmt").value=""; setBalances(); renderOps(); refresh(); save();
  haptic(); showToast(ui.opKind==="retrait"?"Retrait enregistré":"Versement enregistré",null);
});
function opInfo(o){
  if(o.k==="depot") return {t:"Versement du mois",s:"Livret A "+sg(o.l)+" · PEA "+sg(o.p)+(o.t?" · CTO "+sg(o.t):""),v:o.l+o.p+o.t};
  var nm=acctLabel(o.c);
  return o.k==="versement"?{t:"Versement",s:nm,v:o.a}:{t:"Retrait",s:nm,v:-o.a};
}
function renderOps(){
  var box=$("opsList"); box.textContent="";
  var list=state.ops.map(function(o,i){return {o:o,i:i}}).sort(function(a,b){return a.o.m<b.o.m?1:a.o.m>b.o.m?-1:b.i-a.i});
  var shown=ui.showAllOps?list:list.slice(0,6);
  shown.forEach(function(x){
    var o=x.o, inf=opInfo(o);
    var when=o.pk?dShort(o.pk):monthShort(o.m);
    var b=el("button","opr"); b.type="button"; b.setAttribute("aria-label","Modifier : "+inf.t+" "+when);
    b.appendChild(el("span","m",when));
    var mid=el("span",""); mid.appendChild(el("div","t",inf.t)); mid.appendChild(el("div","s num",inf.s)); b.appendChild(mid);
    b.appendChild(el("span","v num "+(inf.v>=0?"pos":"neg"),sg(inf.v)));
    b.addEventListener("click",function(){openOpSheet(o)});
    box.appendChild(b);
  });
  if(!list.length) box.appendChild(el("p","empty","Aucun mouvement pour le moment."));
  var more=$("opsMore"); more.hidden=list.length<=6; more.textContent=ui.showAllOps?"Voir moins":"Voir tout ("+list.length+")";
}
$("opsMore").addEventListener("click",function(){ui.showAllOps=!ui.showAllOps;renderOps()});
function openOpSheet(o){
  openSheet(opInfo(o).t,function(body){
    var month=el("input"); month.type="month"; month.value=o.m;
    body.appendChild(field("Mois",month));
    var l,p,t,a,c;
    if(o.k==="depot"){
      l=amountInput(o.l,"Montant Livret A"); p=amountInput(o.p,"Montant PEA"); t=amountInput(o.t,"Montant compte-titres");
      body.appendChild(field("Livret A (€)",l)); body.appendChild(field("PEA (€)",p)); body.appendChild(field("Compte-titres (€)",t));
    }else{
      c=el("select"); [["livret","Livret A"],["pea","PEA"],["cto","Compte-titres"]].forEach(function(z){var op=el("option","",z[1]);op.value=z[0];if(o.c===z[0])op.selected=true;c.appendChild(op)});
      a=amountInput(o.a,"Montant");
      body.appendChild(field("Compte",c)); body.appendChild(field("Montant (€)",a));
    }
    var err=el("p","err"); err.setAttribute("role","alert"); body.appendChild(err);
    var btns=el("div","btns"), save1=el("button","sav-btn","Enregistrer"), del=el("button","sav-btn danger","Supprimer");
    save1.type="button"; del.type="button"; btns.appendChild(save1); btns.appendChild(del); body.appendChild(btns);
    var cancel=el("button","link","Fermer"); cancel.type="button"; cancel.addEventListener("click",closeSheet); body.appendChild(cancel);
    save1.addEventListener("click",function(){
      if(!RE_M.test(month.value)){err.textContent="Mois invalide.";return}
      var n;
      if(o.k==="depot")n={id:o.id,k:"depot",m:month.value,l:num(l.value),p:num(p.value),t:num(t.value)};
      else{n={id:o.id,k:o.k,m:month.value,c:c.value,a:num(a.value)};if(!n.a){err.textContent="Indique un montant.";return}}
      if(o.pk&&month.value===o.m) n.pk=o.pk;
      if(o.k==="depot"&&state.ops.some(function(z){return z!==o&&z.k==="depot"&&opP(z)===opP(n)})){err.textContent="Un versement du mois existe déjà pour ce mois.";return}
      applyOp(o,-1); applyOp(n,1);
      state.ops[state.ops.indexOf(o)]=n;
      closeSheet(); setBalances(); renderOps(); refresh(); save();
    });
    del.addEventListener("click",function(){
      closeSheet();
      withUndo("Mouvement supprimé",function(){applyOp(o,-1);state.ops=state.ops.filter(function(z){return z!==o})});
    });
  });
}

/* simulateur PEA */
function simulate(init,monthly,years,rate){
  var months=years*12, r=Math.pow(1+rate,1/12)-1, bal=init, i;
  for(i=0;i<months;i++) bal=bal*(1+r)+monthly;
  var verse=init+monthly*months, gains=bal-verse;
  return {brut:bal,verse:verse,gains:gains,net:years>=5?bal-Math.max(0,gains)*PS:null};
}
function renderSim(){
  var init=num($("simInit").value), monthly=num($("simMonth").value), years=Math.min(40,Math.max(1,Math.round(num($("simYears").value))||0));
  var pct=Math.min(30,num($("simRate").value));
  var out=$("simOut"); out.textContent="";
  document.querySelectorAll("#simPresets .chip").forEach(function(b){b.setAttribute("aria-pressed",+b.dataset.r===pct?"true":"false")});
  var r=simulate(init,monthly,years,pct/100);
  var st=el("div","stat good");
  st.appendChild(el("div","k",fmt.format(pct)+" % par an · "+years+(years>1?" ans":" an")));
  st.appendChild(el("div","v num",eur(r.net!==null?r.net:r.brut)));
  st.appendChild(el("div","n num",(r.net!==null?"Net après prélèvements sociaux · ":"Brut · ")+"versé "+eur(r.verse)+" · gains "+eur(r.net!==null?r.net-r.verse:r.gains)));
  out.appendChild(st);
}
["simInit","simMonth","simYears"].forEach(function(id){$(id).addEventListener("input",renderSim)});
$("simRate").addEventListener("input",function(){state.simRate=Math.min(30,num(this.value));save();renderSim()});
[3,5,7,10].forEach(function(p){
  var b=el("button","chip",p+" %"); b.type="button"; b.dataset.r=p; b.setAttribute("aria-pressed","false");
  b.addEventListener("click",function(){$("simRate").value=fmt.format(p);state.simRate=p;save();renderSim()});
  $("simPresets").appendChild(b);
});

/* ===== réglages ===== */
function renderSettings(){
  document.querySelectorAll("#themeSeg button").forEach(function(b){b.setAttribute("aria-pressed",b.dataset.t===state.theme?"true":"false")});
  renderDesigns();
  var row=$("accentRow"); row.textContent="";
  var names={green:"Vert",blue:"Bleu",orange:"Orange",rose:"Rose",slate:"Ardoise"};
  ACCENTS.forEach(function(a){
    var b=el("button"); b.type="button"; b.style.background=ACCENT_HEX[a]; b.setAttribute("aria-label",names[a]); b.setAttribute("aria-pressed",a===state.accent?"true":"false");
    b.addEventListener("click",function(){state.accent=a;applyTheme();save();renderSettings();refresh()});
    row.appendChild(b);
  });
}
/* Version de l'appli : une carte par version de DESIGNS, avec un petit aperçu */
function renderDesigns(){
  var box=$("designList"); box.textContent="";
  DESIGNS.forEach(function(d){
    var on=d.id===state.design, b=el("button","dsg"); b.type="button";
    b.setAttribute("role","radio"); b.setAttribute("aria-checked",on?"true":"false"); b.setAttribute("aria-label","Version "+d.n+" : "+d.d);
    var pv=el("span","pv"); pv.style.background=d.bg;
    var l1=el("i","l1"); l1.style.background=d.fg; var l2=el("i","l2"); l2.style.background=d.fg; var l3=el("i","l3"); l3.style.background=d.ac;
    pv.appendChild(l1); pv.appendChild(l2); pv.appendChild(l3); b.appendChild(pv);
    var tx=el("span","tx"); tx.appendChild(el("b","",d.n)); tx.appendChild(el("span","",d.d)); b.appendChild(tx);
    b.appendChild(el("span","ck",on?"Active":"Choisir"));
    b.addEventListener("click",function(){
      if(state.design===d.id) return;
      state.design=d.id; applyTheme(); save(); renderSettings(); refresh(); haptic();
      showToast("Version « "+d.n+" » activée",null);
    });
    box.appendChild(b);
  });
}
document.querySelectorAll("#themeSeg button").forEach(function(b){
  b.addEventListener("click",function(){state.theme=b.dataset.t;applyTheme();save();renderSettings()});
});
$("theme").addEventListener("click",function(){state.theme=effTheme()==="dark"?"light":"dark";applyTheme();save();renderSettings()});
$("rateIn").addEventListener("input",function(){state.rate=Math.min(20,num(this.value));save();renderProj()});

function renderVcatEditor(){
  var box=$("vcatList"); box.textContent="";
  state.vcats.forEach(function(c){
    var d=el("div","vrow"), dot=el("i"); dot.style.background=vcol(c); d.appendChild(dot);
    var n=el("input"); n.value=c; n.maxLength=30; n.setAttribute("aria-label","Nom de la catégorie "+c);
    n.addEventListener("change",function(){renameV(c,n.value)});
    d.appendChild(n);
    if(state.vcats.length>1) d.appendChild(xbtn("Supprimer la catégorie "+c,function(){
      withUndo("Catégorie supprimée",function(){
        var to=state.vcats.filter(function(k){return k!==c});
        var dest=to.indexOf("Autre")>-1?"Autre":to[to.length-1];
        state.spends.forEach(function(p){if(p.c===c)p.c=dest});
        state.quick.forEach(function(q){if(q.c===c)q.c=dest});
        state.vcats=to;
      });
    })); else d.appendChild(el("span"));
    box.appendChild(d);
  });
  var qc=$("qCat"); qc.textContent="";
  state.vcats.forEach(function(c){var o=el("option","",c);o.value=c;qc.appendChild(o)});
}
function renameV(old,name){
  name=txt(name,30); var err=$("vcatErr");
  if(!name||name===old){renderVcatEditor();return}
  if(state.vcats.some(function(k){return k!==old&&k.toLowerCase()===name.toLowerCase()})){err.textContent="Cette catégorie existe déjà.";renderVcatEditor();return}
  err.textContent="";
  state.vcats[state.vcats.indexOf(old)]=name;
  state.spends.forEach(function(p){if(p.c===old)p.c=name});
  state.quick.forEach(function(q){if(q.c===old)q.c=name});
  if(ui.cat===old)ui.cat=name; if(ui.filter===old)ui.filter=name;
  renderAll();
}
$("vcatForm").addEventListener("submit",function(e){
  e.preventDefault();
  var name=txt($("vcatName").value,30), err=$("vcatErr");
  if(!name) return;
  if(state.vcats.some(function(k){return k.toLowerCase()===name.toLowerCase()})){err.textContent="Cette catégorie existe déjà.";return}
  if(state.vcats.length>=20){err.textContent="20 catégories au maximum.";return}
  err.textContent=""; state.vcats.push(name); $("vcatName").value=""; renderAll();
});
$("vcatName").addEventListener("input",function(){$("vcatErr").textContent=""});

function renderQuickEditor(){
  var box=$("quickList"); box.textContent="";
  state.quick.forEach(function(q,i){
    var d=el("div","qrow");
    var n=el("input"); n.value=q.n; n.maxLength=30; n.setAttribute("aria-label","Nom du raccourci "+(i+1));
    n.addEventListener("input",function(){q.n=txt(n.value,30);save();renderChips()});
    var a=amountInput(q.a,"Montant du raccourci "+(i+1));
    a.addEventListener("input",function(){q.a=num(a.value);save();renderChips()});
    d.appendChild(n); d.appendChild(a);
    d.appendChild(xbtn("Supprimer le raccourci",function(){withUndo("Raccourci supprimé",function(){state.quick.splice(i,1)})}));
    var c=el("select"); c.setAttribute("aria-label","Catégorie du raccourci "+(i+1));
    state.vcats.forEach(function(k){var o=el("option","",k);o.value=k;if(k===q.c)o.selected=true;c.appendChild(o)});
    c.addEventListener("change",function(){q.c=c.value;save()});
    d.appendChild(c);
    box.appendChild(d);
  });
}
$("quickForm").addEventListener("submit",function(e){
  e.preventDefault();
  var n=txt($("qName").value,30), a=num($("qAmt").value);
  if(!n||!a||state.quick.length>=12) return;
  state.quick.push({n:n,a:a,c:$("qCat").value||state.vcats[0]}); $("qName").value=""; $("qAmt").value="";
  renderQuickEditor(); renderChips(); save();
});

/* sauvegarde */
function exportText(){return JSON.stringify({app:"budget-mensuel",v:2,date:todayISO(),data:state},null,2)}
function backMsg(ok,m){$("backMsg").textContent=ok?m:"";$("backErr").textContent=ok?"":m}
$("expCopy").addEventListener("click",function(){
  var t=exportText(), box=$("expBox"); box.value=t; box.hidden=false;
  var done=function(){backMsg(true,"Données copiées. Colle-les dans une note ou un message à toi-même.")};
  var fail=function(){box.focus();box.select();backMsg(true,"Sélectionne le texte ci-dessous et copie-le.")};
  try{ if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(done,fail)} else fail() }catch(e){fail()}
});
$("expFile").addEventListener("click",function(){
  try{
    var blob=new Blob([exportText()],{type:"application/json"}), url=URL.createObjectURL(blob);
    var a=document.createElement("a"); a.href=url; a.download="budget-"+todayISO()+".json"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){URL.revokeObjectURL(url)},2000);
    backMsg(true,"Fichier créé.");
  }catch(e){backMsg(false,"Impossible de créer le fichier. Utilise « Copier ».")}
});
$("impFile").addEventListener("change",function(){
  var f=this.files&&this.files[0]; if(!f)return;
  var rd=new FileReader();
  rd.onload=function(){$("impBox").value=String(rd.result||"");backMsg(true,"Fichier chargé. Appuie sur « Importer ».")};
  rd.onerror=function(){backMsg(false,"Fichier illisible.")};
  rd.readAsText(f); this.value="";
});
$("impGo").addEventListener("click",function(){
  var ns;
  try{var p=JSON.parse($("impBox").value); ns=sanitize((p&&p.data)||p)}catch(e){backMsg(false,"Ces données sont illisibles ou incomplètes.");return}
  if(!confirm("Remplacer toutes tes données actuelles par celles-ci ?")) return;
  ns.mig=false; state=ns; renderAll(); $("impBox").value=""; backMsg(true,"Données importées.");
});
$("wipe").addEventListener("click",function(){
  if(!confirm("Tout effacer ? Cette action est définitive. Pense à exporter avant.")) return;
  try{localStorage.removeItem(KEY)}catch(e){}
  state=sanitize(makeDefault()); renderAll(); backMsg(true,"Données remises à zéro.");
});
$("migrateGo").addEventListener("click",function(){
  try{
    var ns=sanitize(JSON.parse(v1Raw)); ns.mig=false; ns.theme=state.theme; ns.accent=state.accent;
    state=ns; renderAll(); showToast("Données de la V1 reprises",null);
  }catch(e){showToast("Impossible de lire les données de la V1",null)}
});
(function(){
  var b=xbtn("Ignorer",function(){state.mig=false;save();$("migrate").hidden=true});
  b.style.color="var(--accent)"; $("migrate").appendChild(b);
})();

/* ===== import de relevé CSV ===== */
function parseCSV(t){
  t=t.replace(/^\uFEFF/,"").replace(/\r/g,"");
  var first=t.split("\n").slice(0,6).join("\n");
  var d=[";",",","\t"].map(function(c){return [c,first.split(c).length]}).sort(function(a,b){return b[1]-a[1]})[0][0];
  var rows=[],row=[],cur="",q=false,i,ch;
  for(i=0;i<t.length;i++){
    ch=t[i];
    if(q){if(ch==='"'){if(t[i+1]==='"'){cur+='"';i++}else q=false}else cur+=ch}
    else if(ch==='"') q=true;
    else if(ch===d){row.push(cur);cur=""}
    else if(ch==="\n"){row.push(cur);rows.push(row);row=[];cur=""}
    else cur+=ch;
  }
  if(cur||row.length){row.push(cur);rows.push(row)}
  return rows.filter(function(r){return r.some(function(c){return c.trim()})});
}
function parseAmt(s){
  s=String(s==null?"":s).replace(/[\s\u00a0€$]/g,"").replace(/\u2212/g,"-").replace(/^\+/,"");
  if(!/\d/.test(s)) return NaN;
  var lc=s.lastIndexOf(","), ld=s.lastIndexOf(".");
  if(lc>-1&&ld>-1) s=lc>ld?s.replace(/\./g,"").replace(",","."):s.replace(/,/g,"");
  else if(lc>-1) s=s.replace(",",".");
  return parseFloat(s);
}
function parseDt(s){
  s=String(s||"").trim(); var m;
  if((m=s.match(/(\d{4})-(\d{2})-(\d{2})/))) return m[1]+"-"+m[2]+"-"+m[3];
  if((m=s.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/))){
    var y=+m[3]; if(y<100)y+=2000;
    if(+m[2]<1||+m[2]>12||+m[1]<1||+m[1]>31) return null;
    return y+"-"+pad(+m[2])+"-"+pad(+m[1]);
  }
  return null;
}
var CAT_GUESS={
  "Courses":/carrefour|leclerc|auchan|lidl|aldi|intermarch|monoprix|franprix|casino|super ?u|picard|biocoop|grand frais|netto|market/i,
  "Restau":/mcdo|mcdonald|burger|kfc|restaurant|uber ?eats|deliveroo|boulang|pizza|sushi|caf[eé]|starbucks|subway|brasserie|kebab|tacos|paul /i,
  "Transport":/sncf|ratp|navigo|bolt|total ?energ|esso|shell|carburant|peage|autoroute|blablacar|velib|ter |uber(?! ?eats)|station|parking/i,
  "Loisirs":/netflix|spotify|disney|cin[eé]ma|steam|playstation|fnac|prime video|twitch|concert|ticket|cultura|decathlon|jeux/i,
  "Santé":/pharmac|docteur|m[eé]decin|dentiste|mutuelle|optic|doctolib|laboratoire/i
};
function guessCat(name){
  var k, last=state.vcats[state.vcats.length-1];
  for(k in CAT_GUESS) if(CAT_GUESS[k].test(name)&&state.vcats.indexOf(k)>-1) return k;
  return last;
}
function analyzeCSV(text){
  var rows=parseCSV(text); if(rows.length<2) throw new Error("vide");
  var hi=-1,i;
  for(i=0;i<Math.min(rows.length,12);i++) if(rows[i].some(function(c){return /date/i.test(c)})){hi=i;break}
  var head=hi>=0?rows[hi].map(function(c){return c.trim().toLowerCase()}):[];
  var data=rows.slice(hi+1);
  function find(re){for(var k=0;k<head.length;k++)if(re.test(head[k]))return k;return -1}
  var cd=find(/date/), cl=find(/libell|label|descr|d[ée]tail|intitul|objet|tiers|b[ée]n[ée]f|nom|motif/);
  var cDeb=find(/d[ée]bit|sortie/), cAm=find(/montant|amount|somme|valeur/);
  var s=data[0]||[], k2;
  if(cd<0){for(k2=0;k2<s.length;k2++)if(parseDt(s[k2])){cd=k2;break}}
  if(cDeb<0&&cAm<0){for(k2=s.length-1;k2>=0;k2--)if(k2!==cd&&!isNaN(parseAmt(s[k2]))&&/\d/.test(s[k2])){cAm=k2;break}}
  if(cl<0){var best=-1,bl=0;for(k2=0;k2<s.length;k2++)if(k2!==cd&&k2!==cAm&&k2!==cDeb&&String(s[k2]).trim().length>bl&&isNaN(parseAmt(s[k2]))){best=k2;bl=String(s[k2]).trim().length}cl=best}
  if(cd<0||(cDeb<0&&cAm<0)) throw new Error("colonnes");
  var anyNeg=cDeb<0&&data.some(function(r){return parseAmt(r[cAm])<0});
  var items=[], today=todayISO();
  data.forEach(function(r){
    var d=parseDt(r[cd]); if(!d||d>today) return;
    var a=0;
    if(cDeb>=0){var v=parseAmt(r[cDeb]); if(isFinite(v)&&v!==0)a=Math.abs(v)}
    else{var w=parseAmt(r[cAm]); if(isFinite(w)){if(w<0)a=-w; else if(!anyNeg&&w>0)a=w}}
    if(!(a>0)) return;
    var n=txt(cl>=0?r[cl]:"",40).replace(/\s+/g," ");
    items.push({d:d,n:n,a:r2(a),c:guessCat(n)});
  });
  return {items:items,noNeg:cDeb<0&&!anyNeg};
}
function runCSV(text){
  var msg=$("csvMsg"), err=$("csvErr"); msg.textContent=""; err.textContent="";
  var res;
  try{res=analyzeCSV(text)}catch(e){err.textContent="Je n'ai pas reconnu ce fichier. Il faut au moins une colonne de dates et une colonne de montants.";return}
  var exist={}; state.spends.forEach(function(p){exist[p.d+"|"+p.a+"|"+p.n.toLowerCase()]=1});
  var fresh=res.items.filter(function(x){return !exist[x.d+"|"+x.a+"|"+x.n.toLowerCase()]});
  var dup=res.items.length-fresh.length;
  if(!fresh.length){err.textContent=res.items.length?"Tout est déjà dans tes dépenses.":"Aucune dépense trouvée dans ce fichier.";return}
  fresh.sort(function(a,b){return a.d<b.d?-1:1});
  var total=fresh.reduce(function(s,x){return s+x.a},0);
  openSheet("Relevé analysé",function(body){
    var p=el("p","small-p"); p.textContent=fresh.length+" dépenses du "+pISO(fresh[0].d).toLocaleDateString("fr-FR")+" au "+pISO(fresh[fresh.length-1].d).toLocaleDateString("fr-FR")+", pour un total de "+eur(total)+".";
    body.appendChild(p);
    var lst=el("div","prev-list");
    fresh.slice(-30).reverse().forEach(function(x){
      var r=el("div","pl"); r.appendChild(el("span","",x.n||x.c)); r.appendChild(el("span","num",eur(x.a))); lst.appendChild(r);
    });
    body.appendChild(lst);
    if(dup) body.appendChild(el("p","hint",dup+" déjà présente"+(dup>1?"s":"")+", ignorée"+(dup>1?"s":"")+"."));
    if(res.noNeg) body.appendChild(el("p","hint","Aucun montant négatif : tout a été compté comme dépense."));
    body.appendChild(el("p","hint","Les catégories sont devinées d'après le libellé. Tu pourras les corriger une par une."));
    var btns=el("div","btns"), ok=el("button","sav-btn","Importer"), no=el("button","sav-btn ghost","Annuler");
    ok.type="button"; no.type="button"; btns.appendChild(ok); btns.appendChild(no); body.appendChild(btns);
    no.addEventListener("click",closeSheet);
    ok.addEventListener("click",function(){
      closeSheet();
      withUndo(fresh.length+" dépenses importées",function(){
        fresh.forEach(function(x){state.spends.push({id:uid(),d:x.d,n:x.n,a:x.a,c:x.c})});
        if(state.spends.length>4000)state.spends=state.spends.slice(-4000);
        ui.vm=pKey(fresh[fresh.length-1].d);
      });
      $("csvBox").value=""; haptic();
    });
  });
}
$("csvGo").addEventListener("click",function(){
  var t=$("csvBox").value.trim();
  if(!t){$("csvErr").textContent="Colle le contenu du fichier ou choisis un fichier.";$("csvMsg").textContent="";return}
  runCSV(t);
});
$("csvFile").addEventListener("change",function(){
  var f=this.files&&this.files[0]; if(!f)return;
  var rd=new FileReader();
  rd.onload=function(){$("csvBox").value=String(rd.result||"");runCSV($("csvBox").value)};
  rd.onerror=function(){$("csvErr").textContent="Fichier illisible."};
  rd.readAsText(f); this.value="";
});

/* ===== catégories fixes ===== */
$("newCat").addEventListener("submit",function(e){
  e.preventDefault();
  var name=$("catName").value.trim().slice(0,30), err=$("catErr");
  if(!name) return;
  if(state.cats.some(function(k){return k.toLowerCase()===name.toLowerCase()})){err.textContent="Cette catégorie existe déjà.";return}
  if(state.cats.length>=20){err.textContent="20 catégories au maximum.";return}
  err.textContent=""; state.cats.push(name); $("catName").value="";
  renderRows(); updateTotals();
  var g=$("groups").querySelector('[data-cat="'+name.replace(/(["\\])/g,"\\$1")+'"]');
  if(g){g.scrollIntoView({block:"center",behavior:"smooth"});var b=g.querySelector(".add");if(b)b.focus({preventScroll:true})}
});
$("catName").addEventListener("input",function(){$("catErr").textContent=""});

/* ===== navigation ===== */
var VIEWS={home:"vHome",fixes:"vFixes",mois:"vMois",epargne:"vEpargne",bourse:"vBourse",reglages:"vReglages"};
function show(v){
  if(!VIEWS[v])v="home";
  Object.keys(VIEWS).forEach(function(k){
    var n=$(VIEWS[k]), on=k===v;
    if(on&&n.hidden){n.hidden=false;n.style.animation="none";void n.offsetWidth;n.style.animation=""}
    else n.hidden=!on;
  });
  document.querySelectorAll(".tabs button").forEach(function(b){b.setAttribute("aria-current",b.dataset.view===v?"page":"false")});
  try{history.replaceState(null,"",v==="home"?location.pathname+location.search:"#"+v)}catch(e){}
  window.scrollTo(0,0);
}
document.querySelectorAll(".tabs button").forEach(function(b){b.addEventListener("click",function(){show(b.dataset.view)})});
$("goExp").addEventListener("click",function(){show("fixes")});
$("goSav").addEventListener("click",function(){show("epargne")});
$("hmGo").addEventListener("click",function(){show("mois");setTimeout(function(){$("spAmt").focus()},50)});
$("extrasBtn").addEventListener("click",openExtrasSheet);

/* ===== mois : formulaire et navigation ===== */
$("mPrev").addEventListener("click",function(){ui.vm=pAdd(ui.vm,-1);$("spDate").value=defaultDate();renderMois()});
$("mNext").addEventListener("click",function(){if(ui.vm!==curP()){ui.vm=pAdd(ui.vm,1);$("spDate").value=defaultDate();renderMois()}});
$("payBtn").addEventListener("click",function(){openPaySheet(null)});
$("payDueGo").addEventListener("click",function(){openPaySheet(null)});
$("spFilter").addEventListener("change",function(){ui.filter=this.value;renderSpendList()});
$("spForm").addEventListener("submit",function(e){
  e.preventDefault();
  var a=num($("spAmt").value); if(!a){$("spAmt").focus();return}
  var n=$("spName").value, d=RE_D.test($("spDate").value)?$("spDate").value:todayISO();
  $("spName").value=""; $("spAmt").value="";
  addSpend(n,a,ui.cat,d,"Dépense ajoutée");
});

/* ===== salaire ===== */
var sal=$("salary");
function fit(){sal.style.width=Math.max(2,sal.value.replace(/\s/g,"").length*0.92+0.6)+"ch"}
sal.addEventListener("input",function(){state.salary=num(sal.value);fit();updateTotals()});

/* ===== rendu global ===== */
function renderAll(){
  applyTheme();
  sal.value=state.salary?fmt.format(state.salary):""; fit();
  $("rateIn").value=fmt.format(state.rate);
  renderRows(); renderChips(); renderCatChips(); renderFilter(); renderOps(); renderQuickEditor(); renderVcatEditor(); renderSettings(); setBalances();
  $("spDate").value=defaultDate(); $("spDate").max=todayISO();
  updateTotals(); renderSim();
}

/* ===== démarrage ===== */
drag($("dot1"),1); drag($("dot2"),2); drag($("dot3"),3);
document.addEventListener("visibilitychange",function(){
  if(document.hidden) return;
  // un nouveau mois a pu commencer pendant que l'appli était en arrière-plan
  var c=curP(); if(ui.vm===ui.cur) ui.vm=c; ui.cur=c;
  $("spDate").max=todayISO(); refresh();
});
$("simInit").value=fmt.format(r2(peaTotal()));
$("simMonth").value=fmt.format(Math.max(0,planPea())); $("simYears").value="10"; $("simRate").value=fmt.format(state.simRate);
renderAll();
show(location.hash.slice(1));
setTimeout(function(){var s=$("splash");if(s)s.remove()},2300);
if("serviceWorker" in navigator && location.protocol.indexOf("http")===0){
  navigator.serviceWorker.register("sw.js").catch(function(){});
}
