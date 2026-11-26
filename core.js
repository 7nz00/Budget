"use strict";
/* ===== constantes ===== */
var KEY="budget-mensuel-v2", OLD_KEY="budget-mensuel-v1", STEP=5, PS=0.186;
var DEF_FCATS=["Crédit","Abonnement","Transport","Business","Autre"];
var DEF_VCATS=["Courses","Restau","Transport","Loisirs","Santé","Autre"];
var PALETTE=["#2f6fed","#e0961a","#0f9d6b","#d6336c","#7c4dff","#0ea5b7","#c2410c","#8a94a6"];
var ACCENTS=["green","blue","orange","rose","slate"];
var ACCENT_HEX={green:"#0f9d6b",blue:"#2f6fed",orange:"#d9660f",rose:"#cf2e66",slate:"#3f4a5c"};
var fmt=new Intl.NumberFormat("fr-FR",{maximumFractionDigits:2});
var fmt0=new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0});
var RE_M=/^\d{4}-\d{2}$/, RE_D=/^\d{4}-\d{2}-\d{2}$/;
var ACCTS=["livret","pea","cto"];
/* Versions de l'appli (Réglages → Version). bg/fg/ac = couleurs de l'aperçu. */
var DESIGNS=[
  {id:"verre",n:"Verre",d:"Couleurs, transparence et reflets",bg:"linear-gradient(150deg,#3b3f9e,#0f6f6a 55%,#0b1020)",fg:"#eef2ff",ac:"#5eead4"},
  {id:"mono",n:"Minimal",d:"Noir et blanc, épuré, chiffres en avant",bg:"#000",fg:"#fff",ac:"#30d158"}
];
function designIds(){return DESIGNS.map(function(x){return x.id})}
// Fiscalité 2026 : prélèvements sociaux 18,6 % (PS ci-dessus) + impôt 12,8 % = flat tax 31,4 %.
var IR=0.128, PEA_CAP=150000;

/* ===== outils ===== */
function $(id){return document.getElementById(id)}
function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function num(v){var x=parseFloat(String(v).replace(/\s/g,"").replace(",","."));return isFinite(x)&&x>0?x:0}
function r2(x){return Math.round(x*100)/100}
function clone(o){return JSON.parse(JSON.stringify(o))}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function txt(v,n){return String(v==null?"":v).trim().slice(0,n)}
function pad(n){return (n<10?"0":"")+n}
function eur(v){return fmt.format(v)+" €"}
function eur0(v){return fmt0.format(v)+" €"}
function sg(v){return (v>=0?"+":"−")+eur(Math.abs(v))}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1)}
function dISO(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function pISO(s){var p=s.split("-");return new Date(+p[0],+p[1]-1,+p[2])}
function todayISO(){return dISO(new Date())}
function monthKey(d){d=d||new Date();return d.getFullYear()+"-"+pad(d.getMonth()+1)}
function mAdd(k,n){var p=k.split("-");return monthKey(new Date(+p[0],+p[1]-1+n,1))}
function mDiff(a,b){var x=a.split("-"),y=b.split("-");return (+y[0]-+x[0])*12+(+y[1]-+x[1])}
function daysIn(k){var p=k.split("-");return new Date(+p[0],+p[1],0).getDate()}
function monthLong(k){var p=k.split("-");return cap(new Date(+p[0],+p[1]-1,1).toLocaleDateString("fr-FR",{month:"long",year:"numeric"}))}
function monthShort(k){var p=k.split("-");return cap(new Date(+p[0],+p[1]-1,1).toLocaleDateString("fr-FR",{month:"short",year:"2-digit"}))}
function monthWord(k){var p=k.split("-");return new Date(+p[0],+p[1]-1,1).toLocaleDateString("fr-FR",{month:"long"})}
function dayLabel(iso){
  var t=todayISO(), y=dISO(new Date(Date.now()-864e5));
  if(iso===t)return "Aujourd'hui"; if(iso===y)return "Hier";
  return cap(pISO(iso).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}));
}
function dAdd(iso,n){var d=pISO(iso);d.setDate(d.getDate()+n);return dISO(d)}
function dDiff(a,b){return Math.round((pISO(b)-pISO(a))/864e5)}
function dShort(iso){return pISO(iso).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}
/* date en fin de phrase : « 20 nov. » garde son point, « 20 juin » en reçoit un */
function dEnd(iso){var s=dShort(iso);return /\.$/.test(s)?s:s+"."}
/* même jour le mois suivant (31 janv. -> 28 févr.) */
function nextMonthSameDay(iso){var p=iso.split("-"),y=+p[0],m=+p[1],d=+p[2];return dISO(new Date(y,m,Math.min(d,new Date(y,m+1,0).getDate())))}

/* ===== périodes ("mois" de l'appli) =====
   Tant qu'aucune paie n'est enregistrée : mois du calendrier, clé "AAAA-MM".
   Dès la 1re paie : un mois va du jour de la paie à la veille de la suivante, clé "AAAA-MM-JJ" (jour de la paie).
   Les jours avant la 1re paie restent rangés dans leur mois du calendrier. */
function isPay(P){return P.length===10}
function pKey(iso){var ds=state.pays,i,k="";for(i=0;i<ds.length&&ds[i].d<=iso;i++)k=ds[i].d;return k||iso.slice(0,7)}
function curP(){return pKey(todayISO())}
function pStart(P){return isPay(P)?P:P+"-01"}
function nextPayAfter(iso){var i;for(i=0;i<state.pays.length;i++)if(state.pays[i].d>iso)return state.pays[i].d;return ""}
/* date attendue de la prochaine paie (période en cours) */
function payDue(P){return nextMonthSameDay(P)}
/* paie en retard : la date attendue est passée et le nouveau salaire n'est pas encore enregistré */
function payLate(){var P=curP();return isPay(P)&&!nextPayAfter(P)&&todayISO()>=payDue(P)}
/* dernier jour inclus ; période en cours : fin estimée, prolongée tant que la paie n'arrive pas */
function pEnd(P){
  var n=nextPayAfter(pStart(P));
  if(isPay(P)){if(n)return dAdd(n,-1);var e=dAdd(payDue(P),-1),t=todayISO();return t>e?t:e}
  var me=P+"-"+pad(daysIn(P)); return n&&n<=me?dAdd(n,-1):me;
}
function pLen(P){return Math.max(1,dDiff(pStart(P),pEnd(P))+1)}
function pDay(P){return Math.min(pLen(P),Math.max(1,dDiff(pStart(P),todayISO())+1))}
function pLabel(P){return isPay(P)?dShort(P)+" → "+dShort(pEnd(P)):monthLong(P)}
function pShort(P){return isPay(P)?+P.slice(8)+"/"+P.slice(5,7):cap(monthWord(P)).slice(0,4)}
/* toutes les périodes, de la plus ancienne (données ou 12 mois en arrière) à celle en cours */
function allPeriods(){
  var cur=curP(), first=mAdd(monthKey(),-12)+"-01", out=[], k, n=0;
  state.spends.forEach(function(p){if(p.d<first)first=p.d});
  state.ops.forEach(function(o){if(o.m+"-01"<first)first=o.m+"-01"});
  for(k=pKey(first);n<600;n++){out.push(k);if(k>=cur)break;k=pKey(dAdd(pEnd(k),1))}
  return out.slice(-72);
}
function pAdd(P,n){var a=allPeriods(),i=a.indexOf(P);if(i<0)return curP();return a[Math.min(a.length-1,Math.max(0,i+n))]}
function daysLeft(){var P=curP();return Math.max(1,dDiff(todayISO(),pEnd(P))+1)}

/* ===== données ===== */
function makeDefault(){
  return {theme:"auto",accent:"green",rate:1.5,mig:false,cats:DEF_FCATS.slice(),vcats:DEF_VCATS.slice(),
    livret:0,pea:0,cto:0,ops:[],goals:[],extras:[],spends:[],
    quick:[{n:"Repas du midi",a:8,c:"Restau"},{n:"Café",a:3,c:"Restau"},{n:"Plaisir",a:15,c:"Loisirs"}],
    salary:0,pays:[],rows:[],h1:0,h2:0,h3:0,pf:{lines:[],tx:[],snaps:[],peaOpen:""}};
}
function cleanList(arr,def,max,len){
  var out=[];
  (Array.isArray(arr)?arr:def).forEach(function(k){k=txt(k,len);if(k&&out.indexOf(k)<0&&out.length<max)out.push(k)});
  return out.length?out:def.slice();
}
function sanitize(s){
  if(!s||typeof s!=="object"||!Array.isArray(s.rows)) throw new Error("invalide");
  var cats=cleanList(s.cats,DEF_FCATS,20,30), vcats=cleanList(s.vcats,DEF_VCATS,20,30);
  var vlast=vcats[vcats.length-1];
  var oldOps=Array.isArray(s.ops)?s.ops:(Array.isArray(s.hist)?s.hist:[]);
  var ops=oldOps.map(function(h){
    if(!h||!RE_M.test(h.m)) return null;
    if(h.k==="retrait"||h.k==="versement") return {id:txt(h.id,20)||uid(),k:h.k,m:h.m,c:ACCTS.indexOf(h.c)>-1?h.c:"livret",a:num(h.a)};
    return {id:txt(h.id,20)||uid(),k:"depot",m:h.m,l:num(h.l),p:num(h.p),t:num(h.t)};
  }).filter(Boolean).slice(-400);
  // pk = mois de paie auquel le mouvement est rattaché (facultatif)
  ops.forEach(function(o){var h=oldOps.filter(function(x){return x&&x.id===o.id})[0];if(h&&RE_D.test(h.pk))o.pk=h.pk});
  var pays=[], seen={};
  (Array.isArray(s.pays)?s.pays:[]).forEach(function(x){if(x&&RE_D.test(x.d)&&!seen[x.d]){seen[x.d]=1;pays.push({d:x.d,a:num(x.a)})}});
  pays.sort(function(a,b){return a.d<b.d?-1:1}); pays=pays.slice(-240);
  var goals=(Array.isArray(s.goals)?s.goals:[]).map(function(g){
    if(!g||!(num(g.t)>0)) return null;
    return {id:txt(g.id,20)||uid(),n:txt(g.n,40),c:ACCTS.indexOf(g.c)>-1?g.c:"total",t:num(g.t),by:RE_M.test(g.by)?g.by:""};
  }).filter(Boolean).slice(0,20);
  var extras=(Array.isArray(s.extras)?s.extras:[]).map(function(e){return {n:txt(e&&e.n,40),a:num(e&&e.a)}}).slice(0,20);
  var spends=(Array.isArray(s.spends)?s.spends:[]).map(function(p){
    if(!p||!RE_D.test(p.d)||!(num(p.a)>0)) return null;
    return {id:txt(p.id,20)||uid(),d:p.d,n:txt(p.n,40),a:num(p.a),c:vcats.indexOf(p.c)>-1?p.c:vlast};
  }).filter(Boolean).slice(-4000);
  var quick=(Array.isArray(s.quick)?s.quick:makeDefault().quick).map(function(q){
    return {n:txt(q&&q.n,30),a:num(q&&q.a),c:vcats.indexOf(q&&q.c)>-1?q.c:vlast};
  }).filter(function(q){return q.n&&q.a>0}).slice(0,12);
  var rate=s.rate===undefined?1.5:Math.min(20,num(s.rate));
  var pf0=s.pf&&typeof s.pf==="object"?s.pf:{};
  var lines=(Array.isArray(pf0.lines)?pf0.lines:[]).map(function(l){
    if(!l||!txt(l.n,40)) return null;
    return {id:txt(l.id,20)||uid(),n:txt(l.n,40),tk:txt(l.tk,16).toUpperCase(),mic:txt(l.mic,8).toUpperCase(),c:l.c==="pea"?"pea":"cto",px:num(l.px),pxd:RE_D.test(l.pxd)?l.pxd:"",pxe:txt(l.pxe,80)};
  }).filter(Boolean).slice(0,100);
  var lineIds=lines.map(function(l){return l.id});
  var tx=(Array.isArray(pf0.tx)?pf0.tx:[]).map(function(t){
    if(!t||!RE_D.test(t.d)||lineIds.indexOf(t.l)<0||["achat","vente","div"].indexOf(t.k)<0) return null;
    var o={id:txt(t.id,20)||uid(),d:t.d,k:t.k,l:t.l,c:t.c==="pea"?"pea":"cto",q:num(t.q),p:num(t.p),f:num(t.f),a:num(t.a)};
    if(o.k==="div"?!(o.a>0):!(o.q>0&&o.p>0)) return null;
    return o;
  }).filter(Boolean).slice(-2000);
  var snaps=(Array.isArray(pf0.snaps)?pf0.snaps:[]).filter(function(x){return x&&RE_M.test(x.m)})
    .map(function(x){return {m:x.m,v:num(x.v),c:num(x.c)}}).slice(-120);
  return {
    theme:s.theme==="dark"||s.theme==="light"?s.theme:"auto",
    design:designIds().indexOf(s.design)>-1?s.design:"verre",
    accent:ACCENTS.indexOf(s.accent)>-1?s.accent:"green",
    rate:rate, mig:!!s.mig,
    simRate:s.simRate===undefined?7:Math.min(30,num(s.simRate)),
    cats:cats, vcats:vcats,
    livret:num(s.livret),
    pea:num(s.pea),
    cto:num(s.cto),
    pf:{lines:lines,tx:tx,snaps:snaps,peaOpen:RE_M.test(pf0.peaOpen)?pf0.peaOpen:"",auto:typeof pf0.auto==="number"&&isFinite(pf0.auto)?pf0.auto:0},
    ops:ops, goals:goals, extras:extras, spends:spends, quick:quick,
    salary:num(s.salary), pays:pays,
    rows:s.rows.slice(0,200).map(function(r){return {id:txt(r&&r.id,20)||uid(),n:txt(r&&r.n,60),a:num(r&&r.a),c:cats.indexOf(r&&r.c)>-1?r.c:cats[cats.length-1]}}),
    // h3 = fin de la part compte-titres ; les anciennes données n'en ont pas : part CTO à 0.
    h1:num(s.h1),h2:num(s.h2),h3:s.h3===undefined?num(s.h2):num(s.h3)
  };
}
var state, v1Raw=null;
function load(){
  try{var raw=localStorage.getItem(KEY); if(raw) return sanitize(JSON.parse(raw))}catch(e){}
  var st=sanitize(makeDefault());
  try{v1Raw=localStorage.getItem(OLD_KEY); if(v1Raw){JSON.parse(v1Raw);st.mig=true}}catch(e){v1Raw=null}
  return st;
}
state=load();
var saveFailed=false;
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(state));saveFailed=false}
  catch(e){
    // On prévient une seule fois tant que l'enregistrement reste en échec, pour ne pas spammer à chaque frappe.
    if(!saveFailed){saveFailed=true;try{showToast("Impossible d'enregistrer sur cet appareil. Exporte tes données dans Réglages.",null)}catch(e2){}}
  }
}
// Demande au navigateur de ne pas effacer les données de l'appli quand l'espace manque.
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(function(){})}catch(e){}

/* ===== calculs ===== */
function income(){return state.salary+state.extras.reduce(function(s,e){return s+e.a},0)}
function fixed(){return state.rows.reduce(function(s,r){return s+r.a},0)}
function T(){return Math.max(0,income()-fixed())}
/* Jauge : h1 = Livret A, h2 = Livret A + PEA, h3 = Livret A + PEA + compte-titres, le reste = dépenses. */
function env(){return Math.max(0,T()-state.h3)}
function snap(v){return Math.round(v/STEP)*STEP}
function clamp(){
  var t=T();
  state.h3=Math.min(Math.max(state.h3,0),t);
  state.h2=Math.min(Math.max(state.h2,0),state.h3);
  state.h1=Math.min(Math.max(state.h1,0),state.h2);
}
function planPea(){return state.h2-state.h1}
function planCto(){return state.h3-state.h2}
function spendsOf(P){return state.spends.filter(function(p){return pKey(p.d)===P})}
function spentOf(m){return spendsOf(m).reduce(function(s,p){return s+p.a},0)}
/* période d'un mouvement d'épargne : son mois de paie s'il en a un, sinon son mois */
function opP(o){return o.pk||pKey(o.m+"-01")}
function netSaved(P){
  return state.ops.reduce(function(s,o){
    if(opP(o)!==P) return s;
    return s+(o.k==="depot"?o.l+o.p+o.t:o.k==="versement"?o.a:-o.a);
  },0);
}
function vcol(c){var i=state.vcats.indexOf(c);return PALETTE[(i<0?PALETTE.length-1:i)%PALETTE.length]}
function fcol(c){var i=state.cats.indexOf(c);return PALETTE[(i<0?PALETTE.length-1:i)%PALETTE.length]}
function currentDepot(){var P=curP();return state.ops.filter(function(o){return o.k==="depot"&&opP(o)===P})[0]}
/* Mouvement d'épargne -> variation [Livret A, espèces PEA, espèces compte-titres] */
function opDelta(o){
  if(o.k==="depot") return [o.l,o.p,o.t];
  var d=o.k==="versement"?o.a:-o.a;
  return o.c==="pea"?[0,d,0]:o.c==="cto"?[0,0,d]:[d,0,0];
}
function applyOp(o,sign){
  var d=opDelta(o);
  state.livret=Math.max(0,r2(state.livret+sign*d[0]));
  state.pea=Math.max(0,r2(state.pea+sign*d[1]));
  state.cto=Math.max(0,r2(state.cto+sign*d[2]));
}
/* PEA et compte-titres = espèces + valeur des actions (voir bourse.js) */
function balanceOf(c){return c==="pea"?peaTotal():c==="cto"?ctoTotal():c==="livret"?state.livret:state.livret+peaTotal()+ctoTotal()}
function cashOf(c){return c==="pea"?state.pea:c==="cto"?state.cto:state.livret}
function monthlyRate(c){return c==="livret"?state.h1:c==="pea"?planPea():c==="cto"?planCto():state.h3}
function acctLabel(c){return c==="pea"?"PEA":c==="cto"?"Compte-titres":c==="livret"?"Livret A":"Épargne totale"}
function acctColor(c){return c==="pea"?"var(--pea)":c==="cto"?"var(--cto)":c==="livret"?"var(--livret)":"var(--accent)"}
function series(){
  var cur=monthKey(), first=cur, m, out=[];
  state.ops.forEach(function(o){if(o.m<first)first=o.m});
  for(m=first;m<=cur;m=mAdd(m,1)) out.push(m);
  out=out.slice(-24);
  var L=state.livret, P=peaTotal(), C=ctoTotal();
  return out.map(function(k){
    var l=L,p=P,c=C;
    state.ops.forEach(function(o){if(o.m>k){var d=opDelta(o);l-=d[0];p-=d[1];c-=d[2]}});
    return {m:k,l:Math.max(0,l),p:Math.max(0,p),c:Math.max(0,c)};
  });
}
function project(months){
  var l=state.livret,p=peaTotal(),c=ctoTotal(),r=state.rate/100/12,i,interest=0;
  for(i=0;i<months;i++){var g=l*r;interest+=g;l=l+g+state.h1;p+=planPea();c+=planCto()}
  return {l:l,p:p,c:c,total:l+p+c,interest:interest};
}

/* ===== haptique ===== */
var hapEl=null;
function haptic(){
  try{
    if(navigator.vibrate){navigator.vibrate(8);return}
    if(!hapEl){
      var l=document.createElement("label"); l.setAttribute("aria-hidden","true");
      l.style.cssText="position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
      var i=document.createElement("input"); i.type="checkbox"; i.setAttribute("switch",""); i.tabIndex=-1;
      l.appendChild(i); document.body.appendChild(l); hapEl=l;
    }
    hapEl.click();
  }catch(e){}
}

/* ===== thème ===== */
var mq=window.matchMedia?matchMedia("(prefers-color-scheme: dark)"):null;
function effTheme(){return state.theme==="auto"?(mq&&mq.matches?"dark":"light"):state.theme}
function applyTheme(){
  var r=document.documentElement, t=effTheme();
  r.dataset.theme=t; r.dataset.accent=state.accent; r.dataset.design=state.design;
  $("themeColor").setAttribute("content",state.design==="mono"?"#000000":"#0b1020");
}
if(mq&&mq.addEventListener) mq.addEventListener("change",function(){if(state.theme==="auto")applyTheme()});

/* ===== annuler / toast ===== */
var toastTimer=null, toastFn=null;
function showToast(msg,undo){
  $("toastMsg").textContent=msg; toastFn=undo; $("toastUndo").hidden=!undo; $("toast").hidden=false;
  clearTimeout(toastTimer); toastTimer=setTimeout(function(){$("toast").hidden=true;toastFn=null},6000);
}
$("toastUndo").addEventListener("click",function(){
  var f=toastFn; $("toast").hidden=true; toastFn=null; clearTimeout(toastTimer); if(f)f();
});
function withUndo(msg,fn){
  var snapshot=JSON.stringify(state);
  fn(); renderAll();
  showToast(msg,function(){state=sanitize(JSON.parse(snapshot));renderAll()});
}

/* ===== feuille ===== */
function openSheet(title,build){
  $("sheetTitle").textContent=title; var b=$("sheetBody"); b.textContent=""; build(b); $("sheet").hidden=false;
  var f=b.querySelector("input,select"); if(f&&f.type!=="date"&&f.type!=="month")f.focus();
}
function closeSheet(){$("sheet").hidden=true}
$("sheet").addEventListener("click",function(e){if(e.target===$("sheet"))closeSheet()});
document.addEventListener("keydown",function(e){if(e.key==="Escape")closeSheet()});
function field(label,input){var w=el("div","");w.appendChild(el("label","label field-l",label));w.appendChild(input);return w}
function amountInput(v,aria){var i=el("input","num");i.type="text";i.inputMode="decimal";i.value=v?fmt.format(v):"";i.setAttribute("aria-label",aria);i.style.textAlign="right";return i}
var ICON_X='<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l10 10M14 4L4 14"/></svg>';
function xbtn(label,fn){var x=el("button","icon-btn x");x.type="button";x.innerHTML=ICON_X;x.setAttribute("aria-label",label);x.addEventListener("click",fn);return x}
