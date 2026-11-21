"use strict";
/* ===== état d'interface (non sauvegardé) ===== */
var ui={vm:monthKey(),cat:null,filter:"",showAllOps:false,opKind:"versement"};

function rich(parent,parts){
  parts.forEach(function(p){
    if(typeof p==="string") parent.appendChild(document.createTextNode(p));
    else parent.appendChild(el("b","",p.b));
  });
  return parent;
}

/* ===== accueil : enveloppe du mois ===== */
function renderEnv(){
  var cur=monthKey(), e=env(), spent=spentOf(cur), rest=e-spent, over=rest<0;
  var dim=daysIn(cur), day=new Date().getDate(), prog=day/dim;
  var frac=e?spent/e:(spent?1:0);
  var color=over?"var(--danger)":(e&&frac>prog+0.08?"var(--warn)":"var(--good)");
  var box=$("envRing"); box.textContent="";
  var ring=ringEl(frac,e?prog:null,color,216,16);
  var c=el("div","ringc");
  c.appendChild(el("span","",over?"Dépassement de":"Il te reste"));
  c.appendChild(el("b","num"+(over?" neg":""),eur0(Math.abs(rest))));
  c.appendChild(el("span","num",e?"sur "+eur0(e)+" d'enveloppe":"Aucune enveloppe"));
  ring.appendChild(c); box.appendChild(ring);
  var pace=$("pace"); pace.className="pace";
  if(!e){pace.textContent="Règle la jauge pour définir ton enveloppe"}
  else if(over){pace.textContent="Enveloppe dépassée de "+eur0(-rest);pace.classList.add("bad")}
  else{
    var diff=spent-e*prog;
    if(diff>e*0.05){pace.textContent=eur0(diff)+" au-dessus du rythme";pace.classList.add("warn")}
    else if(diff<-e*0.05){pace.textContent=eur0(-diff)+" de marge sur le rythme"}
    else pace.textContent="Dans le rythme du mois";
  }
  var can=$("todayCan"); can.textContent="";
  if(rest>0) rich(can,["Tu peux dépenser ",{b:eur(rest/daysLeft())}," par jour jusqu'à la fin du mois."]);
  var bars=$("envBars"); bars.textContent=""; bars.appendChild(dayBars(cur,true));
}

/* ===== accueil : jauge ===== */
function renderGauge(){
  var t=T(), h1=state.h1, h2=state.h2, h3=state.h3;
  var p1=t?h1/t*100:0, p2=t?h2/t*100:0, p3=t?h3/t*100:0;
  $("sl").style.width=p1+"%"; $("sp").style.width=(p2-p1)+"%"; $("sc").style.width=(p3-p2)+"%"; $("sd").style.width=(t?100-p3:0)+"%";
  $("dot1").style.left=p1+"%"; $("dot2").style.left=p2+"%"; $("dot3").style.left=p3+"%";
  var d1=$("dot1"),d2=$("dot2"),d3=$("dot3");
  d1.setAttribute("aria-valuemax",h2); d1.setAttribute("aria-valuenow",h1); d1.setAttribute("aria-valuetext",eur(h1));
  d2.setAttribute("aria-valuemin",h1); d2.setAttribute("aria-valuemax",h3); d2.setAttribute("aria-valuenow",h2); d2.setAttribute("aria-valuetext",eur(h2));
  d3.setAttribute("aria-valuemin",h2); d3.setAttribute("aria-valuemax",t); d3.setAttribute("aria-valuenow",h3); d3.setAttribute("aria-valuetext",eur(h3));
  var pea=h2-h1, cto=h3-h2, dep=t-h3;
  $("vl").textContent=eur(h1); $("vp").textContent=eur(pea); $("vc").textContent=eur(cto); $("vd").textContent=eur(dep);
  var pc=function(v){return t?fmt0.format(v/t*100)+"\u00a0%":"0\u00a0%"};
  $("pl").textContent=pc(h1); $("pp").textContent=pc(pea); $("pc").textContent=pc(cto); $("pd").textContent=pc(dep);
  $("wk").textContent=eur(dep/4.33)+" par semaine";
  var al=$("alert");
  if(income()-fixed()<=0){al.textContent="Tes dépenses fixes atteignent ou dépassent tes revenus"+(fixed()>income()?" de "+eur(fixed()-income()):"")+". Rien à répartir.";al.classList.add("on")}
  else al.classList.remove("on");
  var sr=$("saveRate"); sr.textContent="";
  if(income()>0&&h3>0) rich(sr,["Tu mets de côté ",{b:eur0(h3)+" par mois"},", soit ",{b:fmt0.format(h3/income()*100)+" %"}," de tes revenus."]);
}
function drag(dot,which){
  var gauge=$("gauge");
  function set(v,k){
    k=k||which;
    var t=T(); v=Math.min(Math.max(snap(v),0),t);
    var key="h"+k, before=state[key];
    // chaque point reste entre son voisin de gauche et celui de droite
    var lo=k===1?0:state["h"+(k-1)], hi=k===3?t:state["h"+(k+1)];
    state[key]=Math.min(Math.max(v,lo),hi);
    if(state[key]!==before) haptic();
    refresh(); save();
  }
  function fromX(x){var r=gauge.getBoundingClientRect();return (x-r.left)/r.width*T()}
  function px(k){var r=gauge.getBoundingClientRect(),t=T();return t?state["h"+k]/t*r.width:0}
  dot.addEventListener("pointerdown",function(e){
    e.preventDefault(); dot.setPointerCapture(e.pointerId); dot.focus();
    // Points qui se chevauchent : le sens du premier glissement choisit lequel bouge
    // (vers la droite le plus à droite, vers la gauche le plus à gauche), sinon ils resteraient bloqués.
    var group=[1,2,3].filter(function(k){return Math.abs(px(k)-px(which))<28}), x0=e.clientX, active=group.length>1?0:which;
    function mv(ev){
      if(!active){var dx=ev.clientX-x0;if(Math.abs(dx)<3)return;active=dx>0?Math.max.apply(null,group):Math.min.apply(null,group)}
      set(fromX(ev.clientX),active);
    }
    function up(){dot.removeEventListener("pointermove",mv);dot.removeEventListener("pointerup",up);dot.removeEventListener("pointercancel",up)}
    dot.addEventListener("pointermove",mv);dot.addEventListener("pointerup",up);dot.addEventListener("pointercancel",up);
  });
  dot.addEventListener("keydown",function(e){
    var cur=state["h"+which], k=e.key, nv=null;
    if(k==="ArrowLeft"||k==="ArrowDown")nv=cur-STEP;
    else if(k==="ArrowRight"||k==="ArrowUp")nv=cur+STEP;
    else if(k==="Home")nv=0; else if(k==="End")nv=T();
    if(nv!==null){e.preventDefault();set(nv)}
  });
}

/* ===== accueil : à savoir ===== */
function renderInsights(){
  var box=$("insights"); box.textContent="";
  var cur=monthKey(), inc=income(), f=fixed(), sp=spendsOf(cur), spent=spentOf(cur), e=env();
  var day=new Date().getDate(), dim=daysIn(cur), list=[];
  if(inc>0&&f>0) list.push(["%",["Tes dépenses fixes pèsent ",{b:fmt0.format(f/inc*100)+" %"}," de tes revenus."]]);
  if(sp.length){
    var by={}; sp.forEach(function(p){by[p.c]=(by[p.c]||0)+p.a});
    var top=Object.keys(by).sort(function(a,b){return by[b]-by[a]})[0];
    list.push(["★",["Ton plus gros poste ce mois-ci : ",{b:top},", ",{b:eur0(by[top])}," (",fmt0.format(by[top]/spent*100)+" % de tes dépenses du mois)."]]);
  }
  var last=mAdd(cur,-1), lastTo=state.spends.filter(function(p){return p.d.slice(0,7)===last&&+p.d.slice(8)<=day}).reduce(function(s,p){return s+p.a},0);
  if(lastTo>0&&spent>0){
    var df=(spent-lastTo)/lastTo*100;
    if(Math.abs(df)<5) list.push(["≈",["À la même date, tu dépenses autant qu'en ",monthWord(last),"."]]);
    else list.push([df<0?"↓":"↑",["À la même date, tu dépenses ",{b:fmt0.format(Math.abs(df))+" % de "+(df<0?"moins":"plus")}," qu'en "+monthWord(last)+"."]]);
  }
  if(e>0&&day>=5&&spent>0){
    var pj=spent/day*dim;
    list.push(["→",["À ce rythme, tu finis le mois à ",{b:eur0(pj)}," sur ",eur0(e)," d'enveloppe."+(pj>e?" Il faudra ralentir.":"")]]);
  }
  var free=0, i, has={};
  sp.forEach(function(p){has[+p.d.slice(8)]=1});
  for(i=1;i<=day;i++) if(!has[i]) free++;
  if(day>=7&&free>0) list.push(["○",["Tu as passé ",{b:free+(free>1?" jours":" jour")}," sans dépense ce mois-ci."]]);
  if(state.goals.length){
    var g=state.goals[0], est=goalEstimate(g,balanceOf(g.c));
    list.push(["◎",[goalName(g)+" : ",{b:est.done?"atteint":est.short}]]);
  }
  list.slice(0,5).forEach(function(x){
    var r=el("div","in"); r.appendChild(el("i","",x[0]));
    r.appendChild(rich(el("div",""),x[1])); box.appendChild(r);
  });
  if(!list.length) box.appendChild(el("p","empty","Ajoute des dépenses pour voir des conseils."));
}

/* ===== fixes ===== */
var subs={};
function renderRows(){
  var box=$("groups"); box.textContent=""; subs={};
  state.cats.forEach(function(cat){
    var g=el("section","group card"); g.dataset.cat=cat;
    var h=el("div","ghead"), gl=el("div","gl"), dot=el("i","catdot"); dot.style.background=fcol(cat);
    var t=el("h3",""); t.appendChild(dot); t.appendChild(document.createTextNode(cat)); gl.appendChild(t);
    var pen=el("button","icon-btn"); pen.type="button"; pen.setAttribute("aria-label","Renommer la catégorie "+cat);
    pen.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
    pen.addEventListener("click",function(){openRenameSheet(cat)});
    gl.appendChild(pen); h.appendChild(gl);
    var s=el("span","num"); subs[cat]=s; h.appendChild(s); g.appendChild(h);
    var has=false;
    state.rows.forEach(function(r,i){
      if(r.c!==cat) return; has=true;
      var d=el("div","row");
      var n=el("input","n"); n.value=r.n; n.placeholder="Nom"; n.setAttribute("aria-label","Nom de la dépense "+(i+1));
      n.addEventListener("input",function(){r.n=n.value;updateTotals()});
      var a=el("input","a num"); a.value=r.a?fmt.format(r.a):""; a.placeholder="0"; a.inputMode="decimal"; a.setAttribute("aria-label","Montant en euros de "+(r.n||"la dépense "+(i+1)));
      a.addEventListener("input",function(){r.a=num(a.value);updateTotals()});
      var c=el("select","c"); c.setAttribute("aria-label","Changer de catégorie");
      state.cats.forEach(function(k){var o=el("option","",k);o.value=k;if(k===r.c)o.selected=true;c.appendChild(o)});
      c.addEventListener("change",function(){r.c=c.value;renderRows();updateTotals()});
      var x=xbtn("Supprimer "+(r.n||"cette dépense"),function(){withUndo("Dépense supprimée",function(){state.rows.splice(state.rows.indexOf(r),1)})});
      d.appendChild(n);d.appendChild(a);d.appendChild(x);d.appendChild(c);
      g.appendChild(d);
    });
    if(!has){
      g.appendChild(el("p","empty","Rien dans cette catégorie."));
      if(state.cats.length>1){
        var del=el("button","link","Supprimer cette catégorie"); del.type="button";
        del.addEventListener("click",function(){withUndo("Catégorie supprimée",function(){state.cats.splice(state.cats.indexOf(cat),1)})});
        g.appendChild(del);
      }
    }
    var add=el("button","add","Ajouter une dépense"); add.type="button"; add.setAttribute("aria-label","Ajouter une dépense en "+cat);
    add.addEventListener("click",function(){
      state.rows.push({id:uid(),n:"",a:0,c:cat}); renderRows(); updateTotals();
      var ins=$("groups").querySelectorAll('[data-cat="'+cat.replace(/(["\\])/g,"\\$1")+'"] .n'); if(ins.length)ins[ins.length-1].focus();
    });
    g.appendChild(add);
    box.appendChild(g);
  });
}
function openRenameSheet(cat){
  openSheet("Renommer la catégorie",function(body){
    var inp=el("input"); inp.type="text"; inp.maxLength=30; inp.value=cat; inp.setAttribute("aria-label","Nouveau nom");
    body.appendChild(field("Nom",inp));
    var err=el("p","err"); err.setAttribute("role","alert"); body.appendChild(err);
    var ok=el("button","sav-btn","Enregistrer"); ok.type="button"; ok.style.marginTop="16px"; body.appendChild(ok);
    var cancel=el("button","link","Annuler"); cancel.type="button"; cancel.addEventListener("click",closeSheet); body.appendChild(cancel);
    function go(){
      var name=txt(inp.value,30);
      if(!name){err.textContent="Indique un nom.";return}
      if(state.cats.some(function(k){return k!==cat&&k.toLowerCase()===name.toLowerCase()})){err.textContent="Cette catégorie existe déjà.";return}
      state.cats[state.cats.indexOf(cat)]=name;
      state.rows.forEach(function(r){if(r.c===cat)r.c=name});
      closeSheet(); renderRows(); updateTotals();
    }
    ok.addEventListener("click",go);
    inp.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();go()}});
    inp.select();
  });
}
function openExtrasSheet(){
  openSheet("Autres revenus",function(body){
    body.appendChild(el("p","small-p","Prime, petit boulot, aide… ce que tu touches en plus du salaire. Mets les montants à jour chaque mois."));
    var list=el("div","list"); body.appendChild(list);
    function draw(){
      list.textContent="";
      state.extras.forEach(function(e,i){
        var d=el("div","xrow");
        var n=el("input","n"); n.value=e.n; n.placeholder="Ex. : prime"; n.setAttribute("aria-label","Nom du revenu "+(i+1));
        n.addEventListener("input",function(){e.n=txt(n.value,40);save()});
        var a=el("input","a num"); a.value=e.a?fmt.format(e.a):""; a.placeholder="0"; a.inputMode="decimal"; a.setAttribute("aria-label","Montant du revenu "+(i+1));
        a.addEventListener("input",function(){e.a=num(a.value);updateTotals()});
        d.appendChild(n); d.appendChild(a);
        d.appendChild(xbtn("Supprimer ce revenu",function(){state.extras.splice(i,1);draw();updateTotals()}));
        list.appendChild(d);
      });
      if(!state.extras.length) list.appendChild(el("p","empty","Aucun autre revenu pour le moment."));
    }
    draw();
    var add=el("button","add","Ajouter un revenu"); add.type="button";
    add.addEventListener("click",function(){
      state.extras.push({n:"",a:0}); draw(); updateTotals();
      var ins=list.querySelectorAll(".n"); if(ins.length)ins[ins.length-1].focus();
    });
    body.appendChild(add);
    var done=el("button","sav-btn","Terminer"); done.type="button"; done.style.marginTop="14px";
    done.addEventListener("click",function(){state.extras=state.extras.filter(function(e){return e.a>0||e.n});closeSheet();updateTotals()});
    body.appendChild(done);
  });
}

/* ===== totaux ===== */
function updateTotals(){
  clamp();
  var f=fixed(), inc=income();
  state.cats.forEach(function(c){
    var sum=state.rows.reduce(function(t,r){return r.c===c?t+r.a:t},0);
    if(subs[c]) subs[c].textContent=eur(sum);
  });
  $("expTotal").textContent=eur(f);
  $("expPct").textContent=inc?fmt0.format(f/inc*100)+" % de tes revenus":"";
  $("expRest").textContent=eur(T());
  $("eqFixed").textContent=eur(f);
  $("reste").textContent=eur(T());
  $("reste2").textContent=eur(T());
  var xs=inc-state.salary;
  $("extrasBtn").textContent=xs>0?"+ "+eur(xs)+" d'autres revenus · total "+eur(inc):"+ Ajouter un autre revenu";
  var pf=inc?Math.min(100,f/inc*100):0;
  $("splitF").style.width=pf+"%"; $("splitR").style.width=(inc?100-pf:0)+"%";
  var items=[]; state.cats.forEach(function(c){
    var v=state.rows.reduce(function(t,r){return r.c===c?t+r.a:t},0); if(v>0)items.push({n:c,v:v,color:fcol(c)});
  });
  breakdown($("cats"),items,{label:"par mois",empty:"Aucune dépense fixe pour le moment.",size:124});
  breakdown($("fixDonut"),items,{label:"par mois",empty:"Aucune dépense fixe pour le moment.",size:132});
  refresh(); save();
}
function refresh(){
  renderGauge(); renderEnv(); renderSavings(); renderMois(); renderInsights(); renderBourse();
}

/* ===== mois ===== */
function monthEnd(m){return m+"-"+pad(daysIn(m))}
function defaultDate(){return ui.vm===monthKey()?todayISO():monthEnd(ui.vm)}
function renderMois(){
  var cur=monthKey(), vm=ui.vm, isCur=vm===cur, spent=spentOf(vm), list=spendsOf(vm);
  $("mTitle").textContent=monthLong(vm);
  $("mNext").disabled=isCur; $("mPrev").disabled=vm<=mAdd(cur,-36);
  var e=env(), big=$("mRest");
  if(isCur){
    var rest=e-spent, over=rest<0, used=e?Math.min(100,spent/e*100):(spent?100:0);
    $("mLabel").textContent="Reste sur l'enveloppe du mois";
    big.textContent=over?"\u2212"+eur(-rest):eur(rest); big.classList.toggle("neg",over);
    $("mSub").textContent=e?(over?"Enveloppe dépassée · ":"")+eur(spent)+" dépensés sur "+eur(e):"Aucune enveloppe : règle la jauge sur l'accueil.";
    $("mBar").style.width=used+"%"; $("mBar").classList.toggle("over",over); $("mBar2").style.width=(100-used)+"%";
    var perDay=rest>0?rest/daysLeft():0;
    $("mK1").textContent="Par jour"; $("mK2").textContent="Par semaine";
    $("mDay").textContent=eur(perDay); $("mWeek").textContent=eur(perDay*7);
  }else{
    $("mLabel").textContent="Dépensé ce mois-là";
    big.textContent=eur(spent); big.classList.remove("neg");
    $("mSub").textContent=list.length+(list.length>1?" dépenses":" dépense")+(e?" · enveloppe actuelle "+eur0(e):"");
    var u=e?Math.min(100,spent/e*100):(spent?100:0);
    $("mBar").style.width=u+"%"; $("mBar").classList.toggle("over",e&&spent>e); $("mBar2").style.width=(100-u)+"%";
    $("mK1").textContent="Moyenne par jour"; $("mK2").textContent="Dépense moyenne";
    $("mDay").textContent=eur(spent/daysIn(vm)); $("mWeek").textContent=eur(list.length?spent/list.length:0);
  }
  renderAnalysis(); $("spDays").textContent=""; $("spDays").appendChild(dayBars(vm,false));
  renderSpendList(); renderHist();
}
function renderAnalysis(){
  var vm=ui.vm, list=spendsOf(vm), by={};
  list.forEach(function(p){by[p.c]=(by[p.c]||0)+p.a});
  var items=Object.keys(by).map(function(c){return {n:c,v:by[c],color:vcol(c)}});
  breakdown($("spDonut"),items,{label:"dépensés",empty:"Aucune dépense ce mois-là.",size:132});
  var st=$("spStats"); st.textContent="";
  var spent=list.reduce(function(s,p){return s+p.a},0), days=vm===monthKey()?new Date().getDate():daysIn(vm);
  var big=list.reduce(function(m,p){return Math.max(m,p.a)},0);
  [["Moyenne/jour",eur0(spent/days)],["Plus grosse",eur0(big)],["Dépenses",String(list.length)]].forEach(function(x){
    var s=el("div","stat"); s.appendChild(el("div","k",x[0])); s.appendChild(el("div","v num",x[1])); st.appendChild(s);
  });
}
function renderFilter(){
  var sel=$("spFilter"); sel.textContent="";
  var o=el("option","","Toutes les catégories"); o.value=""; sel.appendChild(o);
  state.vcats.forEach(function(c){var x=el("option","",c);x.value=c;sel.appendChild(x)});
  if(state.vcats.indexOf(ui.filter)<0)ui.filter="";
  sel.value=ui.filter;
}
function renderSpendList(){
  var box=$("spList"); box.textContent="";
  var all=spendsOf(ui.vm).map(function(p,i){return {p:p,i:i}})
    .filter(function(o){return !ui.filter||o.p.c===ui.filter})
    .sort(function(a,b){return a.p.d<b.p.d?1:a.p.d>b.p.d?-1:b.i-a.i});
  var total=0, last=null, dayTot={};
  all.forEach(function(o){total+=o.p.a;dayTot[o.p.d]=(dayTot[o.p.d]||0)+o.p.a});
  all.forEach(function(o){
    var p=o.p;
    if(p.d!==last){
      var h=el("div","dayh"); h.appendChild(el("span","",dayLabel(p.d))); h.appendChild(el("span","num",eur(dayTot[p.d]))); box.appendChild(h); last=p.d;
    }
    var b=el("button","sp"); b.type="button"; b.setAttribute("aria-label","Modifier : "+(p.n||p.c)+" "+eur(p.a));
    var dot=el("i"); dot.style.background=vcol(p.c); b.appendChild(dot);
    var mid=el("span",""); mid.appendChild(el("div","t",p.n||p.c)); if(p.n)mid.appendChild(el("div","s",p.c)); b.appendChild(mid);
    b.appendChild(el("span","a num",eur(p.a)));
    b.addEventListener("click",function(){openSpendSheet(p)});
    box.appendChild(b);
  });
  if(!all.length) box.appendChild(el("p","empty",ui.filter?"Rien dans cette catégorie.":"Aucune dépense ce mois-là."));
  $("spTotal").textContent=eur(total);
}
function renderHist(){
  var cur=monthKey(), months=[], i;
  for(i=5;i>=0;i--){var m=mAdd(cur,-i);months.push({m:m,v:spentOf(m)})}
  var hc=$("histChart"); hc.textContent="";
  hc.appendChild(monthBars(months,ui.vm,function(m){ui.vm=m;$("spDate").value=defaultDate();renderMois();window.scrollTo({top:0,behavior:"smooth"})}));
  var box=$("histList"); box.textContent="";
  var first=cur; state.spends.forEach(function(p){if(p.d.slice(0,7)<first)first=p.d.slice(0,7)});
  state.ops.forEach(function(o){if(o.m<first)first=o.m});
  var rows=[], m2;
  for(m2=mAdd(cur,-1);m2>=first&&rows.length<24;m2=mAdd(m2,-1)){
    var sp=spentOf(m2), sv=netSaved(m2);
    if(sp>0||sv!==0) rows.push({m:m2,sp:sp,sv:sv});
  }
  var mx=rows.reduce(function(x,r){return Math.max(x,r.sp)},0);
  rows.forEach(function(r){
    var d=el("button","hist"); d.type="button";
    var h=el("div","hh"); h.appendChild(el("span","",monthLong(r.m))); h.appendChild(el("span","num",eur(r.sp))); d.appendChild(h);
    var t=el("div","track"), f=el("span","fill"); f.style.width=(mx?r.sp/mx*100:0)+"%"; t.appendChild(f); d.appendChild(t);
    var s=el("div","hs"); s.appendChild(el("span","","Voir le détail"));
    var b=el("b","num",(r.sv>=0?"Épargné ":"Retiré ")+eur(Math.abs(r.sv))); if(r.sv<0)b.style.color="var(--danger)";
    s.appendChild(b); d.appendChild(s);
    d.addEventListener("click",function(){ui.vm=r.m;$("spDate").value=defaultDate();renderMois();window.scrollTo({top:0,behavior:"smooth"})});
    box.appendChild(d);
  });
  if(!rows.length) box.appendChild(el("p","empty","Les mois passés apparaîtront ici."));
}
function renderChips(){
  var box=$("chips"); box.textContent="";
  state.quick.forEach(function(q){
    var b=el("button","chip",q.n); b.type="button"; b.appendChild(el("small","num",eur(q.a)));
    b.addEventListener("click",function(){addSpend(q.n,q.a,q.c,todayISO(),"«"+q.n+"» ajouté")});
    box.appendChild(b);
  });
  if(!state.quick.length) box.appendChild(el("p","empty","Ajoute des raccourcis dans les réglages."));
}
function renderCatChips(){
  var box=$("spCats"); box.textContent="";
  if(state.vcats.indexOf(ui.cat)<0) ui.cat=state.vcats[0];
  state.vcats.forEach(function(c){
    var b=el("button","cc"); b.type="button"; b.setAttribute("aria-pressed",c===ui.cat?"true":"false");
    var d=el("i"); d.style.background=vcol(c); b.appendChild(d); b.appendChild(document.createTextNode(c));
    b.addEventListener("click",function(){
      ui.cat=c; box.querySelectorAll(".cc").forEach(function(x){x.setAttribute("aria-pressed",x===b?"true":"false")});
    });
    box.appendChild(b);
  });
}
function addSpend(n,a,c,d,msg){
  haptic();
  var day=d||todayISO();
  withUndo(msg||"Dépense ajoutée",function(){
    state.spends.push({id:uid(),d:day,n:txt(n,40),a:a,c:state.vcats.indexOf(c)>-1?c:state.vcats[state.vcats.length-1]});
    if(state.spends.length>4000)state.spends=state.spends.slice(-4000);
    ui.vm=day.slice(0,7);
  });
  $("spDate").value=defaultDate();
}
function openSpendSheet(p){
  openSheet("Modifier la dépense",function(body){
    var name=el("input"); name.type="text"; name.maxLength=40; name.value=p.n; name.placeholder="Nom (facultatif)";
    var amt=amountInput(p.a,"Montant"); amt.classList.add("amt-in");
    var date=el("input"); date.type="date"; date.value=p.d; date.max=todayISO();
    var cat=el("select"); state.vcats.forEach(function(c){var o=el("option","",c);o.value=c;if(c===p.c)o.selected=true;cat.appendChild(o)});
    body.appendChild(field("Montant (€)",amt)); body.appendChild(field("Nom",name)); body.appendChild(field("Catégorie",cat)); body.appendChild(field("Date",date));
    var err=el("p","err"); err.setAttribute("role","alert"); body.appendChild(err);
    var btns=el("div","btns"), ok=el("button","sav-btn","Enregistrer"), del=el("button","sav-btn danger","Supprimer");
    ok.type="button"; del.type="button"; btns.appendChild(ok); btns.appendChild(del); body.appendChild(btns);
    var cancel=el("button","link","Fermer"); cancel.type="button"; cancel.addEventListener("click",closeSheet); body.appendChild(cancel);
    ok.addEventListener("click",function(){
      var a=num(amt.value); if(!a){err.textContent="Indique un montant.";return}
      if(!RE_D.test(date.value)){err.textContent="Date invalide.";return}
      closeSheet();
      withUndo("Dépense modifiée",function(){p.a=a;p.n=txt(name.value,40);p.c=cat.value;p.d=date.value;ui.vm=p.d.slice(0,7)});
    });
    del.addEventListener("click",function(){
      closeSheet();
      withUndo("Dépense supprimée",function(){state.spends=state.spends.filter(function(z){return z.id!==p.id})});
    });
  });
}
