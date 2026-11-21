"use strict";
/* ===== Bourse : PEA et compte-titres =====
   Chaque compte = espèces (state.pea / state.cto) + actions.
   Un achat sort des espèces, une vente ou un dividende y rentre.
   Prix de revient : prix moyen pondéré, frais compris (méthode utilisée par le fisc français). */
var fmtQ=new Intl.NumberFormat("fr-FR",{maximumFractionDigits:6});
var TX_LABEL={achat:"Achat",vente:"Vente",div:"Dividende"};

function pfLine(id){return state.pf.lines.filter(function(l){return l.id===id})[0]}
function txSorted(){
  return state.pf.tx.map(function(t,i){return {t:t,i:i}})
    .sort(function(a,b){return a.t.d<b.t.d?-1:a.t.d>b.t.d?1:a.i-b.i}).map(function(x){return x.t});
}
/* Pour chaque action : quantité, prix de revient, valeur, plus-values. */
function holdings(){
  var h={}, y=String(new Date().getFullYear());
  state.pf.lines.forEach(function(l){h[l.id]={q:0,cost:0,real:0,realY:0,div:0,last:0}});
  txSorted().forEach(function(t){
    var x=h[t.l]; if(!x) return;
    if(t.k==="achat"){x.q+=t.q;x.cost+=t.q*t.p+t.f;x.last=t.p}
    else if(t.k==="vente"){
      var s=Math.min(t.q,x.q), pru=x.q?x.cost/x.q:0, g=s*t.p-t.f-s*pru;
      x.real+=g; if(t.d.slice(0,4)===y)x.realY+=g;
      x.cost-=s*pru; x.q-=s; x.last=t.p;
      if(x.q<1e-9){x.q=0;x.cost=0}
    }
    else x.div+=t.a;
  });
  state.pf.lines.forEach(function(l){
    var x=h[l.id];
    x.px=l.px||x.last||(x.q?x.cost/x.q:0);
    x.val=x.q*x.px; x.pru=x.q?x.cost/x.q:0; x.gain=x.val-x.cost;
  });
  return h;
}
function titres(c){
  var h=holdings(), s=0;
  state.pf.lines.forEach(function(l){if(!c||l.c===c)s+=h[l.id].val});
  return s;
}
function peaTotal(){return state.pea+titres("pea")}
function ctoTotal(){return state.cto+titres("cto")}
function txCash(t){return t.k==="achat"?-(t.q*t.p+t.f):t.k==="vente"?t.q*t.p-t.f:t.a}
function applyTx(t,sign){
  var d=sign*txCash(t);
  if(t.c==="pea") state.pea=Math.max(0,r2(state.pea+d)); else state.cto=Math.max(0,r2(state.cto+d));
}
/* Garde un point par mois (valeur et montant investi) pour la courbe d'évolution. */
function recordSnap(){
  var h=holdings(), v=0, c=0, m=monthKey();
  state.pf.lines.forEach(function(l){v+=h[l.id].val;c+=h[l.id].cost});
  var cur=state.pf.snaps.filter(function(x){return x.m===m})[0];
  if(!cur){if(!v&&!c&&!state.pf.snaps.length)return;cur={m:m};state.pf.snaps.push(cur)}
  cur.v=r2(v); cur.c=r2(c);
  state.pf.snaps.sort(function(a,b){return a.m<b.m?-1:1});
  if(state.pf.snaps.length>120) state.pf.snaps=state.pf.snaps.slice(-120);
}
function pct(a,b){return b?(a>=0?"+":"−")+fmt.format(Math.abs(a/b*100))+" %":""}
function gainEl(tag,cls,v,base){
  return el(tag,cls+" "+(v>=0?"up":"down"),sg(v)+(base?" · "+pct(v,base):""));
}
function shortDate(iso){return pISO(iso).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}

/* ===== rendu ===== */
function renderBourse(){
  var h=holdings(), tp=titres("pea"), tc=titres("cto"), cash=state.pea+state.cto;
  var cost=0; state.pf.lines.forEach(function(l){cost+=h[l.id].cost});
  var val=tp+tc, gain=val-cost;
  $("bxTot").textContent=eur(val+cash);
  var sub=$("bxSub"); sub.textContent="";
  sub.appendChild(document.createTextNode(eur(val)+" en actions · "+eur(cash)+" d'espèces"));
  var st=$("bxStats"); st.textContent="";
  [["PEA",eur0(peaTotal()),""],["Compte-titres",eur0(ctoTotal()),""],["Plus-value",(gain>=0?"+":"−")+eur0(Math.abs(gain)),gain>=0?"up":"down"]].forEach(function(x){
    var s=el("div","stat"); s.appendChild(el("div","k",x[0])); s.appendChild(el("div","v num "+x[2],x[1])); st.appendChild(s);
  });
  renderPfMonth(); renderPositions(h); renderPfDonut(h); renderPfChart(); renderTax(h); renderTxList();
  $("bxPeaOpen").value=state.pf.peaOpen;
}
function investedIn(m,c){
  return state.pf.tx.reduce(function(s,t){return t.k==="achat"&&t.c===c&&t.d.slice(0,7)===m?s+t.q*t.p+t.f:s},0);
}
function renderPfMonth(){
  var box=$("bxMonth"); box.textContent="";
  var m=monthKey(), rows=[["pea","PEA",planPea(),"p"],["cto","Compte-titres",planCto(),"c"]];
  if(!planPea()&&!planCto()&&!investedIn(m,"pea")&&!investedIn(m,"cto")){
    box.appendChild(el("p","empty","Règle la jauge sur l'accueil pour prévoir combien investir chaque mois."));
  }
  rows.forEach(function(r){
    var inv=investedIn(m,r[0]); if(!r[2]&&!inv) return;
    var w=el("div","mrow"), hd=el("div","head");
    hd.appendChild(el("span","",r[1]));
    hd.appendChild(el("span","num",eur0(inv)+" investis"+(r[2]?" sur "+eur0(r[2])+" prévus":"")));
    w.appendChild(hd);
    var tr=el("div","track"), f=el("span","fill "+r[3]); f.style.width=(r[2]?Math.min(100,inv/r[2]*100):100)+"%"; tr.appendChild(f); w.appendChild(tr);
    box.appendChild(w);
  });
  var p=el("p","hint num"); p.style.margin="12px 0 0";
  p.textContent="Espèces disponibles : "+eur(state.pea)+" sur le PEA, "+eur(state.cto)+" sur le compte-titres.";
  box.appendChild(p);
}
function renderPositions(h){
  var box=$("bxPos"); box.textContent="";
  var list=state.pf.lines.filter(function(l){return h[l.id].q>0}).sort(function(a,b){return h[b.id].val-h[a.id].val});
  var old=dISO(new Date(Date.now()-7*864e5));
  list.forEach(function(l){
    var x=h[l.id], b=el("button","pos"); b.type="button"; b.setAttribute("aria-label","Détail de "+l.n);
    var t=el("span","t",l.n); t.appendChild(el("span","tag "+l.c,l.c==="pea"?"PEA":"CTO")); b.appendChild(t);
    b.appendChild(el("span","v num",eur(x.val)));
    var s=el("span","s num",fmtQ.format(x.q)+" × "+eur(x.px)+" · revient "+eur(x.pru));
    b.appendChild(s);
    b.appendChild(gainEl("span","g num",x.gain,x.cost));
    if(!l.pxd||l.pxd<old){var o=el("span","s old",l.pxd?"Cours du "+shortDate(l.pxd)+" · à mettre à jour":"Cours à mettre à jour");o.style.gridColumn="1/3";b.appendChild(o)}
    b.addEventListener("click",function(){openLineSheet(l)});
    box.appendChild(b);
  });
  if(!list.length) box.appendChild(el("p","empty","Aucune action pour le moment. Touche « Nouvelle opération » pour noter ton premier achat."));
}
function renderPfDonut(h){
  var items=[];
  state.pf.lines.forEach(function(l,i){var v=h[l.id].val;if(v>0)items.push({n:l.n,v:v,color:PALETTE[i%PALETTE.length]})});
  breakdown($("bxDonut"),items,{label:"en actions",empty:"La répartition apparaît dès ta première action.",size:132});
}
function renderPfChart(){
  var box=$("bxChart"); box.textContent="";
  var pts=state.pf.snaps;
  if(pts.length<2){box.appendChild(el("p","empty","La courbe apparaît après deux mois de suivi. Elle se met à jour quand tu notes une opération ou un nouveau cours."));return}
  var w=el("div",""); w.innerHTML=pfChart(pts); box.appendChild(w);
  var lg=el("div","lg");
  [["var(--cto)","Valeur"],["var(--muted)","Investi (pointillés)"]].forEach(function(x){
    var s=el("span",""),i=el("i","dotc");i.style.background=x[0];s.appendChild(i);s.appendChild(document.createTextNode(x[1]));lg.appendChild(s);
  });
  box.appendChild(lg);
}
function peaVersements(){
  return state.ops.reduce(function(s,o){
    if(o.k==="depot") return s+o.p;
    if(o.c!=="pea") return s;
    return s+(o.k==="versement"?o.a:-o.a);
  },0);
}
function renderTax(h){
  var box=$("bxTax"); box.textContent="";
  function block(title,lines){
    var b=el("div","taxb"); b.appendChild(el("h3","",title));
    lines.forEach(function(parts){b.appendChild(rich(el("p","num"),parts))});
    box.appendChild(b);
  }
  function sum(c,k){var s=0;state.pf.lines.forEach(function(l){if(l.c===c)s+=h[l.id][k]});return s}
  // Compte-titres
  var gC=sum("cto","gain"), rY=sum("cto","realY"), year=new Date().getFullYear();
  var linesC=[["Plus-value latente : ",{b:sg(gC)}]];
  if(gC>0) linesC.push(["Si tu vendais tout aujourd'hui : environ ",{b:eur0(gC*(PS+IR))}," d'impôts (31,4 %)."]);
  if(rY) linesC.push(["Plus-values réalisées en "+year+" : ",{b:sg(rY)},rY>0?" → environ "+eur0(rY*(PS+IR))+" à déclarer en "+(year+1)+".":" (moins-value reportable)."]);
  block("Compte-titres",linesC);
  // PEA
  var gP=sum("pea","gain"), linesP=[["Plus-value latente : ",{b:sg(gP)}]], open=state.pf.peaOpen, age=open?mDiff(open,monthKey()):-1;
  if(open&&age>=60) linesP.push(["Ton PEA a plus de 5 ans : seuls 18,6 % de prélèvements sociaux s'appliquent aux gains retirés."+(gP>0?" Soit environ "+eur0(gP*PS)+" si tu retirais tout.":"")]);
  else if(open) linesP.push(["5 ans atteints en ",{b:monthLong(mAdd(open,60)).toLowerCase()},". Avant, un retrait ferme le PEA et les gains sont taxés à 31,4 %."]);
  else linesP.push(["Indique la date d'ouverture de ton PEA ci-dessous pour savoir quand passent les 5 ans."]);
  linesP.push(["Pas d'impôt tant que l'argent reste dans le PEA, même quand tu vends."]);
  linesP.push(["Versements suivis : ",{b:eur0(peaVersements())}," sur "+eur0(PEA_CAP)+" de plafond."]);
  block("PEA",linesP);
}
function renderTxList(){
  var box=$("bxTx"); box.textContent="";
  var all=state.pf.tx.map(function(t,i){return {t:t,i:i}}).sort(function(a,b){return a.t.d<b.t.d?1:a.t.d>b.t.d?-1:b.i-a.i});
  (ui.showAllTx?all:all.slice(0,8)).forEach(function(x){
    var t=x.t, l=pfLine(t.l), b=el("button","opr"); b.type="button";
    b.appendChild(el("span","m",shortDate(t.d)));
    var mid=el("span",""); mid.appendChild(el("div","t",TX_LABEL[t.k]+" · "+(l?l.n:"?")));
    mid.appendChild(el("div","s num",t.k==="div"?(t.c==="pea"?"PEA":"Compte-titres"):fmtQ.format(t.q)+" × "+eur(t.p)+(t.f?" · frais "+eur(t.f):"")));
    b.appendChild(mid);
    var v=txCash(t); b.appendChild(el("span","v num "+(v>=0?"pos":"neg"),sg(v)));
    b.setAttribute("aria-label",TX_LABEL[t.k]+" "+(l?l.n:"")+" du "+shortDate(t.d));
    b.addEventListener("click",function(){openTxDetail(t)});
    box.appendChild(b);
  });
  if(!all.length) box.appendChild(el("p","empty","Aucune opération pour le moment."));
  var more=$("bxTxMore"); more.hidden=all.length<=8; more.textContent=ui.showAllTx?"Voir moins":"Voir tout ("+all.length+")";
}

/* ===== feuilles ===== */
function segPick(opts,cur,onPick){
  var w=el("div","seg2"+(opts.length===3?" t3":"")); w.setAttribute("role","group");
  opts.forEach(function(o){
    var b=el("button","",o[1]); b.type="button"; b.dataset.k=o[0]; b.setAttribute("aria-pressed",o[0]===cur?"true":"false");
    b.addEventListener("click",function(){w.querySelectorAll("button").forEach(function(x){x.setAttribute("aria-pressed",x===b?"true":"false")});onPick(o[0])});
    w.appendChild(b);
  });
  return w;
}
function textInput(v,ph,aria,max){var i=el("input");i.type="text";i.value=v||"";i.placeholder=ph||"";i.maxLength=max||40;i.setAttribute("aria-label",aria);return i}

function openTxSheet(kind,lineId){
  var h=holdings();
  openSheet("Nouvelle opération",function(body){
    var k=kind||"achat", acct="cto";
    body.appendChild(segPick([["achat","Achat"],["vente","Vente"],["div","Dividende"]],k,function(v){k=v;fillLines();sync()}));
    var sel=el("select"); sel.setAttribute("aria-label","Action");
    var selF=field("Action",sel); body.appendChild(selF);
    var nb=el("div",""), name=textInput("","Ex. : Nvidia","Nom de l'action"), tk=textInput("","Ex. : NVDA","Code de l'action (facultatif)",12);
    nb.appendChild(field("Nom",name)); nb.appendChild(field("Code (facultatif)",tk));
    nb.appendChild(el("label","label field-l","Compte"));
    nb.appendChild(segPick([["cto","Compte-titres"],["pea","PEA"]],acct,function(v){acct=v;sync()}));
    var peaHint=el("p","hint","Seules les actions européennes (et certains ETF) vont sur un PEA. Nvidia, Apple, Tesla… vont sur le compte-titres.");
    peaHint.style.margin="0"; nb.appendChild(peaHint);
    body.appendChild(nb);
    var date=el("input"); date.type="date"; date.value=todayISO(); date.max=todayISO(); date.setAttribute("aria-label","Date");
    body.appendChild(field("Date",date));
    var g=el("div","grid2"), q=amountInput(0,"Quantité"), p=amountInput(0,"Prix unitaire en euros");
    q.placeholder="Ex. : 2"; p.placeholder="Ex. : 120";
    var qF=field("Quantité",q), pF=field("Prix unitaire (€)",p); g.appendChild(qF); g.appendChild(pF); body.appendChild(g);
    var f=amountInput(0,"Frais en euros"); f.placeholder="0"; var fF=field("Frais (€)",f); body.appendChild(fF);
    var a=amountInput(0,"Montant du dividende en euros"); var aF=field("Montant reçu (€)",a); body.appendChild(aF);
    var tot=el("p","small-p num"); tot.style.margin="10px 0 0"; body.appendChild(tot);
    var err=el("p","err"); err.setAttribute("role","alert"); body.appendChild(err);
    var ok=el("button","sav-btn","Enregistrer"); ok.type="button"; ok.style.marginTop="14px"; body.appendChild(ok);
    var cancel=el("button","link","Annuler"); cancel.type="button"; cancel.addEventListener("click",closeSheet); body.appendChild(cancel);

    function fillLines(){
      var keep=sel.value||lineId||""; sel.textContent="";
      var ls=state.pf.lines.filter(function(l){return k==="achat"||h[l.id].q>0||(k==="div"&&state.pf.tx.some(function(t){return t.l===l.id}))});
      ls.forEach(function(l){var o=el("option","",l.n+" · "+(l.c==="pea"?"PEA":"CTO")+(h[l.id].q?" · "+fmtQ.format(h[l.id].q)+" détenue"+(h[l.id].q>1?"s":""):""));o.value=l.id;sel.appendChild(o)});
      if(k==="achat"){var n=el("option","","+ Nouvelle action");n.value="__new";sel.appendChild(n)}
      if([].some.call(sel.options,function(o){return o.value===keep}))sel.value=keep;
      else sel.value=k==="achat"&&!ls.length?"__new":(sel.options[0]?sel.options[0].value:"");
    }
    function sync(){
      var isNew=sel.value==="__new", isDiv=k==="div";
      nb.hidden=!isNew; peaHint.hidden=acct!=="pea";
      selF.hidden=!sel.options.length;
      qF.hidden=pF.hidden=fF.hidden=isDiv; aF.hidden=!isDiv;
      var cq=num(q.value), cp=num(p.value), cf=num(f.value);
      tot.textContent=isDiv?"":(cq&&cp?(k==="achat"?"Total payé : "+eur(cq*cp+cf):"Total reçu : "+eur(cq*cp-cf)):"");
      ok.textContent=k==="achat"?"Enregistrer l'achat":k==="vente"?"Enregistrer la vente":"Enregistrer le dividende";
      err.textContent="";
      if(!sel.options.length) err.textContent=k==="vente"?"Tu n'as aucune action à vendre.":"Aucune action ne peut recevoir de dividende pour l'instant.";
    }
    sel.addEventListener("change",sync); [q,p,f].forEach(function(i){i.addEventListener("input",sync)});
    fillLines(); sync();

    ok.addEventListener("click",function(){
      if(!sel.options.length) return;
      if(!RE_D.test(date.value)||date.value>todayISO()){err.textContent="Date invalide.";return}
      var isNew=sel.value==="__new", line=isNew?null:pfLine(sel.value);
      if(isNew&&!txt(name.value,40)){err.textContent="Indique le nom de l'action.";return}
      if(isNew&&state.pf.lines.length>=100){err.textContent="100 actions au maximum.";return}
      var t={id:uid(),d:date.value,k:k,l:"",c:line?line.c:acct,q:0,p:0,f:0,a:0};
      if(k==="div"){t.a=num(a.value);if(!t.a){err.textContent="Indique le montant reçu.";return}}
      else{
        t.q=num(q.value); t.p=num(p.value); t.f=num(f.value);
        if(!t.q){err.textContent="Indique la quantité.";return}
        if(!t.p){err.textContent="Indique le prix unitaire.";return}
        if(k==="vente"&&t.q>h[line.id].q+1e-9){err.textContent="Tu n'en as que "+fmtQ.format(h[line.id].q)+".";return}
      }
      var need=k==="achat"?r2(t.q*t.p+t.f-cashOf(t.c)):0;
      closeSheet();
      var msg=k==="achat"?"Achat enregistré":k==="vente"?"Vente enregistrée":"Dividende enregistré";
      if(need>0) msg+=" · versement de "+eur(need)+" ajouté";
      withUndo(msg,function(){
        if(isNew){line={id:uid(),n:txt(name.value,40),tk:txt(tk.value,12).toUpperCase(),c:acct,px:t.p,pxd:t.d};state.pf.lines.push(line)}
        t.l=line.id;
        // Pas assez d'espèces : on considère que l'argent manquant a été versé sur le compte ce mois-là.
        if(need>0){var o={id:uid(),k:"versement",m:t.d.slice(0,7),c:t.c,a:need};state.ops.push(o);applyOp(o,1)}
        state.pf.tx.push(t); applyTx(t,1);
        if(k!=="div"&&(!line.pxd||t.d>=line.pxd)){line.px=t.p;line.pxd=t.d}
        recordSnap();
      });
      setBalances(); renderOps(); haptic();
    });
  });
}
function openTxDetail(t){
  var l=pfLine(t.l);
  openSheet(TX_LABEL[t.k]+" · "+(l?l.n:""),function(body){
    var lst=el("div","prev-list");
    var rows=[["Date",pISO(t.d).toLocaleDateString("fr-FR")],["Compte",t.c==="pea"?"PEA":"Compte-titres"]];
    if(t.k==="div") rows.push(["Montant",eur(t.a)]);
    else rows.push(["Quantité",fmtQ.format(t.q)],["Prix unitaire",eur(t.p)],["Frais",eur(t.f)]);
    rows.push([t.k==="achat"?"Total payé":"Total reçu",eur(Math.abs(txCash(t)))]);
    rows.forEach(function(r){var d=el("div","pl");d.appendChild(el("span","",r[0]));d.appendChild(el("span","num",r[1]));lst.appendChild(d)});
    body.appendChild(lst);
    body.appendChild(el("p","hint","Pour corriger une opération, supprime-la puis enregistre-la à nouveau."));
    var btns=el("div","btns"), del=el("button","sav-btn danger","Supprimer"), close=el("button","sav-btn ghost","Fermer");
    del.type="button"; close.type="button"; btns.appendChild(del); btns.appendChild(close); body.appendChild(btns);
    close.addEventListener("click",closeSheet);
    del.addEventListener("click",function(){
      closeSheet();
      withUndo("Opération supprimée",function(){applyTx(t,-1);state.pf.tx=state.pf.tx.filter(function(z){return z.id!==t.id});recordSnap()});
      setBalances(); renderOps();
    });
  });
}
function openLineSheet(l){
  var x=holdings()[l.id];
  openSheet(l.n,function(body){
    var lst=el("div","prev-list");
    [["Compte",l.c==="pea"?"PEA":"Compte-titres"],["Quantité",fmtQ.format(x.q)],["Prix de revient moyen",eur(x.pru)],["Valeur",eur(x.val)],
     ["Plus-value",sg(x.gain)+(x.cost?" ("+pct(x.gain,x.cost)+")":"")],["Dividendes reçus",eur(x.div)],["Gains déjà encaissés",sg(x.real)]].forEach(function(r){
      var d=el("div","pl");d.appendChild(el("span","",r[0]));d.appendChild(el("span","num",r[1]));lst.appendChild(d);
    });
    body.appendChild(lst);
    var name=textInput(l.n,"Nom","Nom de l'action"), tk=textInput(l.tk,"Ex. : NVDA","Code de l'action",12);
    var px=amountInput(x.px,"Cours actuel en euros");
    body.appendChild(field("Cours actuel (€)"+(l.pxd?" · noté le "+shortDate(l.pxd):""),px));
    var g=el("div","grid2"); g.appendChild(field("Nom",name)); g.appendChild(field("Code",tk)); body.appendChild(g);
    var err=el("p","err"); err.setAttribute("role","alert"); body.appendChild(err);
    var save1=el("button","sav-btn","Enregistrer"); save1.type="button"; body.appendChild(save1);
    var btns=el("div","btns"), buy=el("button","sav-btn ghost","Acheter"), sell=el("button","sav-btn ghost","Vendre");
    buy.type="button"; sell.type="button"; btns.style.marginTop="10px"; btns.appendChild(buy); btns.appendChild(sell); body.appendChild(btns);
    var del=el("button","link","Supprimer cette action et ses opérations"); del.type="button"; body.appendChild(del);
    save1.addEventListener("click",function(){
      var n=txt(name.value,40), p=num(px.value);
      if(!n){err.textContent="Indique un nom.";return}
      if(!p){err.textContent="Indique le cours.";return}
      closeSheet();
      withUndo("Action mise à jour",function(){
        var z=pfLine(l.id); if(!z) return;
        z.n=n; z.tk=txt(tk.value,12).toUpperCase();
        if(r2(p)!==r2(x.px)||!z.pxd){z.px=p;z.pxd=todayISO()}
        recordSnap();
      });
    });
    buy.addEventListener("click",function(){openTxSheet("achat",l.id)});
    sell.addEventListener("click",function(){openTxSheet("vente",l.id)});
    del.addEventListener("click",function(){
      closeSheet();
      withUndo(l.n+" supprimée",function(){
        state.pf.tx.filter(function(t){return t.l===l.id}).forEach(function(t){applyTx(t,-1)});
        state.pf.tx=state.pf.tx.filter(function(t){return t.l!==l.id});
        state.pf.lines=state.pf.lines.filter(function(z){return z.id!==l.id});
        recordSnap();
      });
      setBalances(); renderOps();
    });
  });
}
function openPxSheet(){
  var h=holdings(), ls=state.pf.lines.filter(function(l){return h[l.id].q>0});
  if(!ls.length){showToast("Note d'abord un achat avec « Nouvelle opération ».",null);return}
  openSheet("Mettre à jour les cours",function(body){
    body.appendChild(el("p","small-p","Recopie le cours affiché par ton appli de banque ou de courtier."));
    var inputs=[];
    ls.forEach(function(l){
      var r=el("div","pxrow"), left=el("div","");
      left.appendChild(el("div","t",l.n)); left.appendChild(el("div","s",(l.tk?l.tk+" · ":"")+(l.pxd?"noté le "+shortDate(l.pxd):"jamais noté")));
      var i=amountInput(h[l.id].px,"Cours de "+l.n+" en euros");
      r.appendChild(left); r.appendChild(i); body.appendChild(r); inputs.push([l,i]);
    });
    var ok=el("button","sav-btn","Enregistrer"); ok.type="button"; ok.style.marginTop="14px"; body.appendChild(ok);
    var cancel=el("button","link","Annuler"); cancel.type="button"; cancel.addEventListener("click",closeSheet); body.appendChild(cancel);
    ok.addEventListener("click",function(){
      closeSheet();
      withUndo("Cours mis à jour",function(){
        var today=todayISO();
        inputs.forEach(function(x){var p=num(x[1].value),z=pfLine(x[0].id);if(z&&p){z.px=p;z.pxd=today}});
        recordSnap();
      });
      haptic();
    });
  });
}

$("bxAdd").addEventListener("click",function(){openTxSheet("achat",null)});
$("bxPx").addEventListener("click",openPxSheet);
$("bxTxMore").addEventListener("click",function(){ui.showAllTx=!ui.showAllTx;renderTxList()});
$("bxPeaOpen").addEventListener("change",function(){state.pf.peaOpen=RE_M.test(this.value)?this.value:"";save();renderBourse()});
