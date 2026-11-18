"use strict";
/* ===== graphiques (SVG / div, sans bibliothèque) ===== */

function donut(segs,size,th){
  var r=(size-th)/2, c=2*Math.PI*r, total=segs.reduce(function(s,x){return s+x.v},0)||1, off=0;
  var svg='<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" aria-hidden="true"><g transform="rotate(-90 '+size/2+' '+size/2+')">'
    +'<circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="var(--track)" stroke-width="'+th+'"/>';
  segs.forEach(function(s){
    var len=s.v/total*c, gap=segs.length>1?Math.min(3,len*0.3):0;
    svg+='<circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="'+s.color+'" stroke-width="'+th+'" stroke-dasharray="'+Math.max(0,len-gap).toFixed(2)+' '+(c-Math.max(0,len-gap)).toFixed(2)+'" stroke-dashoffset="'+(-off).toFixed(2)+'"/>';
    off+=len;
  });
  svg+="</g></svg>";
  var d=el("div","donut"); d.style.width=d.style.height=size+"px"; d.innerHTML=svg; return d;
}

/* donut + légende. items: [{n,v,color}] */
function breakdown(box,items,o){
  box.textContent="";
  var total=items.reduce(function(s,i){return s+i.v},0);
  if(!total){box.appendChild(el("p","empty",o.empty));return}
  items=items.slice().sort(function(a,b){return b.v-a.v});
  var w=el("div","bk"), d=donut(items.map(function(i){return {v:i.v,color:i.color}}),o.size||128,o.th||16);
  var c=el("div","dc"); c.appendChild(el("b","num",eur0(total))); c.appendChild(el("span","",o.label||"")); d.appendChild(c); w.appendChild(d);
  var lg=el("div","lgd");
  items.slice(0,7).forEach(function(i){
    var r=el("div","lr"), dot=el("i"); dot.style.background=i.color; r.appendChild(dot);
    r.appendChild(el("span","nm",i.n));
    var v=el("span","vv num",eur0(i.v)); v.appendChild(el("small","",fmt0.format(i.v/total*100)+"%")); r.appendChild(v);
    lg.appendChild(r);
  });
  w.appendChild(lg); box.appendChild(w);
}

/* anneau de l'enveloppe: frac = part dépensée, mark = avancement du mois */
function ringEl(frac,mark,color,size,th){
  var r=(size-th)/2, c=2*Math.PI*r, cx=size/2;
  var f=Math.min(1,Math.max(0,frac)), off=c*(1-f);
  var svg='<svg viewBox="0 0 '+size+' '+size+'" aria-hidden="true"><g transform="rotate(-90 '+cx+' '+cx+')">'
    +'<circle cx="'+cx+'" cy="'+cx+'" r="'+r+'" fill="none" stroke="var(--track)" stroke-width="'+th+'"/>'
    +'<circle class="arc" cx="'+cx+'" cy="'+cx+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+th+'" stroke-linecap="round" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'"/>';
  if(mark!==null&&mark>0&&mark<1){
    var a=mark*2*Math.PI, x1=cx+(r-th/2-4)*Math.cos(a), y1=cx+(r-th/2-4)*Math.sin(a), x2=cx+(r+th/2+4)*Math.cos(a), y2=cx+(r+th/2+4)*Math.sin(a);
    svg+='<line x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>';
  }
  svg+="</g></svg>";
  var w=el("div","ringw"); w.style.width=w.style.height=size+"px"; w.innerHTML=svg; return w;
}

/* petit anneau d'objectif */
function miniRing(pct,color){
  var c=2*Math.PI*26, off=c*(1-pct/100);
  return '<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="none" stroke="var(--track)" stroke-width="7"/><circle cx="32" cy="32" r="26" fill="none" stroke="'+color+'" stroke-width="7" stroke-linecap="round" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'" transform="rotate(-90 32 32)"/></svg>';
}

/* barres jour par jour d'un mois */
function dayBars(m,small){
  var n=daysIn(m), vals=[], i;
  for(i=0;i<n;i++)vals.push(0);
  spendsOf(m).forEach(function(p){vals[+p.d.slice(8)-1]+=p.a});
  var mx=Math.max.apply(null,vals)||1, today=m===monthKey()?new Date().getDate()-1:-1;
  var w=el("div","bars"+(small?" sm":""));
  w.setAttribute("role","img"); w.setAttribute("aria-label","Dépenses jour par jour");
  vals.forEach(function(v,k){
    var c=el("div","col"+(k===today?" now":"")+(today>=0&&k>today?" fut":"")), b=el("i");
    if(v){b.style.height=Math.max(8,v/mx*100)+"%"}else{b.className="z";b.style.height="3px"}
    c.appendChild(b); w.appendChild(c);
  });
  var wrap=el("div",""); wrap.appendChild(w);
  if(!small){
    var ax=el("div","axis"); ax.appendChild(el("span","","1")); ax.appendChild(el("span","",String(Math.round(n/2)))); ax.appendChild(el("span","",String(n)));
    wrap.appendChild(ax);
  }
  return wrap;
}

/* barres des derniers mois (cliquables). months: [{m,v}] */
function monthBars(months,selected,onPick){
  var mx=Math.max.apply(null,months.map(function(x){return x.v}))||1;
  var w=el("div","bars mon");
  months.forEach(function(x){
    var c=el("button","col"+(x.m===selected?" sel":"")); c.type="button";
    c.setAttribute("aria-label",monthLong(x.m)+" : "+eur(x.v));
    var bw=el("div","bw"), b=el("i"); b.style.height=Math.max(x.v?8:3,x.v/mx*100)+"%"; bw.appendChild(b); c.appendChild(bw);
    c.appendChild(el("span","",cap(monthWord(x.m)).slice(0,4)));
    c.addEventListener("click",function(){onPick(x.m)});
    w.appendChild(c);
  });
  return w;
}

/* courbe d'épargne empilée Livret A / PEA */
function areaChart(pts,small){
  var tots=pts.map(function(q){return q.l+q.p}), W=300, H=small?60:140;
  var max=Math.max.apply(null,tots)||1, mn=Math.min.apply(null,tots);
  var lo=Math.max(0,mn-(max-mn)*0.8-max*0.02); if(max-lo<1)lo=0;
  var X=function(i){return i/(pts.length-1)*W}, Y=function(v){return H-3-Math.max(0,v-lo)/(max-lo)*(H-9)};
  var line=function(f){return pts.map(function(q,i){return (i?"L":"M")+X(i).toFixed(1)+" "+Y(f(q)).toFixed(1)}).join(" ")};
  var close=" L"+W+" "+H+" L0 "+H+" Z";
  return '<svg class="chart'+(small?" sp":"")+'" viewBox="0 0 '+W+" "+H+'" preserveAspectRatio="none" role="img" aria-label="Évolution de ton épargne">'
    +'<path d="'+line(function(q){return q.l+q.p})+close+'" fill="var(--pea)" opacity=".26"/>'
    +'<path d="'+line(function(q){return q.l})+close+'" fill="var(--livret)" opacity=".34"/>'
    +'<path d="'+line(function(q){return q.l+q.p})+'" fill="none" stroke="var(--pea)" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>'
    +'<path d="'+line(function(q){return q.l})+'" fill="none" stroke="var(--livret)" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>'
    +"</svg>";
}
