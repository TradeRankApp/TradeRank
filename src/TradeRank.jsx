import { useState, useRef, useEffect } from "react";
import { supabase, signUp as sbSignUp, signIn as sbSignIn, signOut as sbSignOut, getProfile, getAllProfiles, getPosts, createPost, getStrategies, getUserPurchases, getUserFollowing, followTrader, unfollowTrader, updateProfile } from "./supabase";

const fl=document.createElement("link");fl.rel="stylesheet";fl.href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap";document.head.appendChild(fl);
const css=document.createElement("style");css.textContent=`
*{box-sizing:border-box;margin:0;padding:0;}body{background:#fff;overscroll-behavior:none;}::-webkit-scrollbar{width:0;}input,textarea,button{font-family:'Figtree',sans-serif;}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes slideUp{from{opacity:0;transform:translateY(100%);}to{opacity:1;transform:translateY(0);}}
@keyframes popIn{0%{transform:scale(0.85);opacity:0;}60%{transform:scale(1.08);}100%{transform:scale(1);opacity:1;}}
@keyframes heartPop{0%{transform:scale(1);}25%{transform:scale(1.4);}50%{transform:scale(0.9);}75%{transform:scale(1.15);}100%{transform:scale(1);}}
@keyframes bounceIn{0%{transform:scale(0.3);opacity:0;}50%{transform:scale(1.1);}70%{transform:scale(0.95);}100%{transform:scale(1);opacity:1;}}
.fade-up{animation:fadeUp 0.3s cubic-bezier(.2,.8,.4,1) forwards;}
.fade-in{animation:fadeIn 0.22s ease forwards;}
.slide-up{animation:slideUp 0.32s cubic-bezier(.2,.8,.4,1) forwards;}
.bounce-in{animation:bounceIn 0.5s cubic-bezier(.2,.8,.4,1) forwards;}
.heart-pop{animation:heartPop 0.4s cubic-bezier(.2,.8,.4,1) forwards;}
.press{transition:transform 0.12s ease;}.press:active{transform:scale(0.94);}
.hov{transition:background 0.15s ease;}.hov:hover{background:#f5f5f5;}
.btn-press{transition:transform 0.1s ease,filter 0.1s ease;}.btn-press:active{transform:scale(0.96);filter:brightness(0.95);}
`;document.head.appendChild(css);

const G={green:"#00E676",greenDark:"#00C853",greenLight:"#E8FFF3",greenMid:"#00E67615",black:"#0A0A0A",g900:"#111",g700:"#2C2C2C",g600:"#404040",g500:"#666",g400:"#888",g300:"#B0B0B0",g200:"#E0E0E0",g100:"#F5F5F5",g50:"#FAFAFA",white:"#FFFFFF",red:"#FF3B30",blue:"#007AFF",orange:"#FF9500",profit:"#00C853",loss:"#FF3B30",gold:"#FFD700"};

const timeAgo=ts=>{const s=Math.floor((Date.now()-ts)/1000);if(s<60)return`${s}s`;if(s<3600)return`${Math.floor(s/60)}m`;if(s<86400)return`${Math.floor(s/3600)}h`;return`${Math.floor(s/86400)}d`;};
const getTier=s=>{if(s>=85)return{name:"Apex",color:"#FF9500",bg:"#FF950015"};if(s>=70)return{name:"Elite",color:"#007AFF",bg:"#007AFF15"};if(s>=50)return{name:"Ranked",color:G.green,bg:G.greenMid};return{name:"Bronze",color:G.g400,bg:"#88888815"};};
const parseCSV=text=>{const lines=text.trim().split("\n").filter(Boolean);if(lines.length<2)return[];const headers=lines[0].split(",").map(h=>h.trim().toLowerCase().replace(/[^a-z0-9]/g,""));return lines.slice(1).map(line=>{const vals=line.split(",").map(v=>v.trim());const obj={};headers.forEach((h,i)=>{obj[h]=vals[i]||"";});return obj;});};
const calcMetrics=trades=>{if(!trades.length)return null;const pnls=trades.map(t=>parseFloat(t.pnl||t.profit||t.return||t.pl||0));const net=pnls.reduce((a,b)=>a+b,0);const wins=pnls.filter(p=>p>0),losses=pnls.filter(p=>p<0);const winRate=(wins.length/pnls.length)*100;const gp=wins.reduce((a,b)=>a+b,0),gl=Math.abs(losses.reduce((a,b)=>a+b,0));const pf=gl>0?gp/gl:gp>0?99:0;let peak=0,eq=0,maxDD=0;const curve=[];for(const p of pnls){eq+=p;curve.push(+eq.toFixed(2));if(eq>peak)peak=eq;const dd=peak>0?(peak-eq)/peak:0;if(dd>maxDD)maxDD=dd;}const mean=net/pnls.length,std=Math.sqrt(pnls.reduce((s,v)=>s+(v-mean)**2,0)/pnls.length);const cv=mean!==0?Math.abs(std/mean):1;const consistency=Math.max(0,Math.min(100,(1-Math.min(cv,1))*100));const longevity=Math.min(100,(trades.length/100)*100);const ra=Math.max(0,Math.min(100,(net/(maxDD*100+1))*10));const score=Math.min(100,Math.max(0,Math.round(ra*0.4+Math.max(0,(1-maxDD)*100)*0.3+consistency*0.2+longevity*0.1)));return{traderScore:score,equityCurve:curve,netReturn:net.toFixed(2),maxDrawdown:(maxDD*100).toFixed(1),winRate:winRate.toFixed(1),profitFactor:pf>=99?"∞":pf.toFixed(2),tradeCount:trades.length};};
const BADGE_DEFS=[{id:"first_trade",icon:"⚡",label:"First Trade"},{id:"streak_3",icon:"🔥",label:"On Fire"},{id:"top10",icon:"🏆",label:"Top 10"},{id:"apex_tier",icon:"👑",label:"Apex"},{id:"verified",icon:"✓",label:"Verified"},{id:"supporter",icon:"✓",label:"Supporter"},{id:"loss_post",icon:"🪖",label:"Accountable"},{id:"100_trades",icon:"📊",label:"Centurion"}];
const calcBadges=(trader,posts,traders)=>{const earned=[];const tp=posts.filter(p=>p.traderId===trader.id);const rank=[...traders].sort((a,b)=>b.traderScore-a.traderScore).findIndex(t=>t.id===trader.id)+1;if(tp.length>0)earned.push("first_trade");if(tp.length>=3)earned.push("streak_3");if(rank>0&&rank<=10)earned.push("top10");if(trader.traderScore>=85)earned.push("apex_tier");if(trader.verified)earned.push("verified");if(trader.supporter)earned.push("supporter");if(tp.some(p=>p.pnl<0))earned.push("loss_post");if(trader.tradeCount>=100)earned.push("100_trades");return earned;};

// ── Seed data ─────────────────────────────────────────────────────────────────
const SEED_TRADERS=[
  {id:1,name:"VOID_X",email:"void_x",category:"Futures",verified:true,supporter:true,traderScore:91,netReturn:"284.50",maxDrawdown:"4.2",winRate:"68.3",profitFactor:"3.21",tradeCount:312,equityCurve:Array.from({length:30},(_,i)=>i*9.5+Math.sin(i)*8),followers:1240,following:88,bio:"ES & NQ futures. VWAP trader. Consistency over home runs."},
  {id:2,name:"APEX_ZERO",email:"apex_zero",category:"Prop",verified:true,supporter:false,traderScore:87,netReturn:"192.10",maxDrawdown:"5.8",winRate:"61.2",profitFactor:"2.74",tradeCount:254,equityCurve:Array.from({length:30},(_,i)=>i*6.4+Math.cos(i*0.7)*5),followers:874,following:42,bio:"Prop firm funded. Every trade posted, wins and losses."},
  {id:3,name:"SOVEREIGN",email:"sovereign",category:"Crypto",verified:true,supporter:true,traderScore:83,netReturn:"156.80",maxDrawdown:"7.1",winRate:"57.9",profitFactor:"2.31",tradeCount:198,equityCurve:Array.from({length:30},(_,i)=>i*5.2+Math.sin(i*1.2)*10),followers:612,following:117,bio:"BTC/ETH macro trader. Long term thinker."},
  {id:4,name:"NIGHTFALL",email:"nightfall",category:"Forex",verified:false,supporter:false,traderScore:76,netReturn:"98.40",maxDrawdown:"9.3",winRate:"54.1",profitFactor:"1.89",tradeCount:167,equityCurve:Array.from({length:30},(_,i)=>i*3.3+Math.sin(i*0.9)*7),followers:331,following:205,bio:"London session forex. EUR/USD specialist."},
  {id:5,name:"DARK_EDGE",email:"dark_edge",category:"Stocks",verified:false,supporter:true,traderScore:71,netReturn:"74.20",maxDrawdown:"11.4",winRate:"52.3",profitFactor:"1.67",tradeCount:143,equityCurve:Array.from({length:30},(_,i)=>i*2.5+Math.cos(i*1.1)*9),followers:228,following:160,bio:"Swing trader. Earnings plays and momentum."},
  {id:6,name:"CIRCUIT",email:"circuit",category:"Futures",verified:true,supporter:false,traderScore:65,netReturn:"51.90",maxDrawdown:"13.8",winRate:"49.8",profitFactor:"1.44",tradeCount:121,equityCurve:Array.from({length:30},(_,i)=>i*1.7+Math.sin(i*1.3)*11),followers:189,following:73,bio:"Learning in public. Every trade documented."},
];
const SEED_POSTS=[
  {id:1,traderId:1,type:"trade",ts:Date.now()-3600000,symbol:"ES",direction:"LONG",entry:"5284.50",exit:"5301.25",pnl:840,notes:"Clean breakout off VWAP. Market structure was clear.",likes:112,comments:[{id:1,author:"NIGHTFALL",text:"Clean execution.",ts:Date.now()-3200000}],shares:28,liked:false,shared:false},
  {id:2,traderId:3,type:"thought",ts:Date.now()-5400000,text:"BTC compressing hard at 67k. Range has to resolve soon. Watching for 67.5 break or flush to 65.8. Not chasing.",likes:89,comments:[{id:1,author:"VOID_X",text:"Same read. Range is too tight.",ts:Date.now()-5000000}],shares:21,liked:false,shared:false},
  {id:3,traderId:2,type:"trade",ts:Date.now()-18000000,symbol:"NQ",direction:"LONG",entry:"19240.00",exit:"19185.00",pnl:-275,notes:"Stopped out. Misread the morning range. Lesson logged.",likes:203,comments:[{id:1,author:"VOID_X",text:"Respect for posting the L. That honesty is rare.",ts:Date.now()-17000000}],shares:54,liked:false,shared:false},
  {id:4,traderId:1,type:"thought",ts:Date.now()-28800000,text:"People sleep on how important doing nothing is. I passed on 6 setups today. The edge is in patience.",likes:178,comments:[],shares:61,liked:false,shared:false},
  {id:5,traderId:3,type:"trade",ts:Date.now()-43200000,symbol:"BTC",direction:"LONG",entry:"66800",exit:"67420",pnl:620,notes:"Reclaimed the range mid, tight stop.",likes:74,comments:[],shares:16,liked:false,shared:false},
  {id:6,traderId:4,type:"trade",ts:Date.now()-57600000,symbol:"EUR/USD",direction:"LONG",entry:"1.0842",exit:"1.0871",pnl:290,notes:"London session breakout. Textbook setup.",likes:41,comments:[],shares:8,liked:false,shared:false},
];
const SEED_NOTIFS=[
  {id:1,type:"like",from:"VOID_X",text:"liked your trade on ES",ts:Date.now()-1800000,read:false},
  {id:2,type:"follow",from:"APEX_ZERO",text:"started following you",ts:Date.now()-3600000,read:false},
  {id:3,type:"strategy_follow",from:"CIRCUIT",text:"is following your VWAP Mastery strategy",ts:Date.now()-7200000,read:false},
  {id:4,type:"purchase",from:"NIGHTFALL",text:"purchased your VWAP Mastery strategy 💰",ts:Date.now()-14400000,read:false},
  {id:5,type:"review",from:"DARK_EDGE",text:"left a 5★ review on your strategy",ts:Date.now()-28800000,read:true},
  {id:6,type:"rank",from:"System",text:"You moved up 2 spots this week 🚀",ts:Date.now()-86400000,read:true},
];
const SEED_DMS=[
  {id:1,withId:1,withName:"VOID_X",lastMsg:"What broker you using?",lastTs:Date.now()-3600000,unread:2,messages:[{id:1,from:"VOID_X",text:"Yo nice trade on ES today",ts:Date.now()-7200000},{id:2,from:"ME",text:"Thanks man, been working on that setup for weeks",ts:Date.now()-7000000},{id:3,from:"VOID_X",text:"What broker you using?",ts:Date.now()-3600000}]},
  {id:2,withId:3,withName:"SOVEREIGN",lastMsg:"We should collaborate",lastTs:Date.now()-86400000,unread:0,messages:[{id:1,from:"SOVEREIGN",text:"Your crypto analysis is solid",ts:Date.now()-90000000},{id:2,from:"ME",text:"Appreciate it",ts:Date.now()-89000000},{id:3,from:"SOVEREIGN",text:"We should collaborate",ts:Date.now()-86400000}]},
];

const SEED_STRATEGIES=[
  {id:1,sellerId:1,featured:true,title:"VWAP Reclaim — ES Morning Setup",tagline:"The exact entry model behind 68% of my profitable ES trades.",market:"Futures",timeframe:"5m / 15m",price:49,preview:{title:"What you'll learn",points:["Why VWAP reclaims at open are the highest-probability futures setup","The filter that cuts 80% of false entries","How to size stops so one bad trade doesn't ruin your day"],teaser:"The full playbook covers 7 setup variations, 15 annotated charts, and the exact risk framework used across 180+ trades. Including the specific VWAP levels that matter and when they stop mattering..."},includes:["Full written playbook (PDF)","Entry & exit rules with chart examples","Risk management framework","15 annotated screenshots","Lifetime updates"],description:"This is the core setup I've traded for 3 years on ES. Built around VWAP reclaims at key session levels — open, prior close, and overnight range boundaries. The system defines exactly when to enter, where your stop goes, and when to take profit. Win rate on this specific setup is 71.2% over 180+ verified trades.",reviews:[{id:1,author:"CIRCUIT",rating:5,text:"This is the real deal. Took the first setup the next morning and it worked. Clear rules, nothing vague.",ts:Date.now()-172800000},{id:2,author:"NIGHTFALL",rating:5,text:"Bought skeptically. The annotated charts alone are worth the price.",ts:Date.now()-86400000}],sales:47,rating:4.9,tags:["VWAP","Futures","ES","Morning session"],followers:134},
  {id:2,sellerId:2,featured:true,title:"Prop Firm Pass System — Full Protocol",tagline:"The exact risk management system I used to pass 3 prop firm evaluations.",market:"Prop",timeframe:"Any",price:79,preview:{title:"What you'll learn",points:["The daily loss limit formula that keeps evals alive on bad days","Why most traders fail evals in the first week — and how to avoid it","The mindset shift from trading for profit to trading for consistency"],teaser:"The full system includes a position sizing spreadsheet, a psychology checklist, and a 45-minute video walkthrough covering every phase from challenge day 1 to funded..."},includes:["Daily/weekly loss limit calculator","Position sizing spreadsheet","Eval vs funded phase rules","Psychology checklist","45-min video walkthrough"],description:"After failing 4 prop firm evaluations I rebuilt my entire approach around what the firms actually want to see: consistent small wins with controlled drawdown. This gives you the exact rules, position sizing formula, and mental framework I used.",reviews:[{id:1,author:"DARK_EDGE",rating:5,text:"Failed 3 evals before this. Passed FTMO first attempt. Worth every penny.",ts:Date.now()-259200000},{id:2,author:"CIRCUIT",rating:4,text:"The position sizing spreadsheet alone saved my account.",ts:Date.now()-172800000}],sales:83,rating:4.8,tags:["Prop firm","Risk management","FTMO","Evaluation"],followers:198},
  {id:3,sellerId:3,featured:false,title:"BTC Structure Trading — Macro Framework",tagline:"How I identify high-probability BTC entries reading market structure on HTF.",market:"Crypto",timeframe:"4h / Daily",price:39,preview:{title:"What you'll learn",points:["How to read real market structure vs noise on the 4h chart","The 3 range types that produce the cleanest entries","When NOT to trade — the most underrated skill in crypto"],teaser:"The full guide includes 3 complete trade breakdowns from my verified history, showing entry logic, stop placement, and management in real time with annotated charts..."},includes:["Market structure guide","Entry criteria checklist","Range identification method","Stop placement rules","3 full trade breakdowns"],description:"I trade pure price structure on 4h and daily — ranges, fair value gaps, order blocks. This walks through my exact thought process from identifying a setup to pulling the trigger.",reviews:[{id:1,author:"VOID_X",rating:5,text:"Finally a crypto guide that isn't buzzwords. The range identification method is simple and works.",ts:Date.now()-345600000}],sales:31,rating:4.9,tags:["BTC","Structure","Crypto","Price action"],followers:87},
  {id:4,sellerId:4,featured:false,title:"London Session EUR/USD Playbook",tagline:"A focused guide to the London open breakout — my bread and butter.",market:"Forex",timeframe:"1m / 5m",price:29,preview:{title:"What you'll learn",points:["The 3 London open setups and exactly when each one triggers","How to trade around news without getting stopped out","The false break fade — the most reliable of the three setups"],teaser:"The full playbook covers all entry rules, news avoidance protocol, a journal template, and 30 days of email Q&A support..."},includes:["3 setup types with full entry rules","London session timing guide","News avoidance protocol","Journal template","30-day email Q&A support"],description:"The London open is the most predictable 2 hours in forex. I trade 3 setups every morning: range break, false break fade, and continuation. This guide covers all three with clear rules.",reviews:[{id:1,author:"APEX_ZERO",rating:4,text:"Solid guide. The false break fade alone changed how I approach the morning session.",ts:Date.now()-432000000}],sales:19,rating:4.7,tags:["Forex","EUR/USD","London open","Breakout"],followers:56},
];
const SEED_BUNDLES=[{id:"void_bundle",sellerId:1,title:"VOID_X Complete Futures Package",description:"VWAP Reclaim + Range Day Playbook + Overnight Levels system — all 3 strategies at one price.",strategyIds:[1],price:119,originalPrice:147,savings:28,sales:18}];
const genJournal=()=>{const data={};const now=new Date();for(let i=34;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i);const ds=d.toISOString().split("T")[0];if(d.getDay()===0||d.getDay()===6||Math.random()<0.2)continue;const pnl=Math.round((Math.random()*1400-380)*10)/10;const trades=Math.floor(Math.random()*7)+1;const mood=pnl>400?"great":pnl>100?"good":pnl>-100?"neutral":"bad";const notes=["Followed the plan. Patient with entries.","Choppy session. Should have sat on my hands.","Hit my daily target by 10am.","Overtraded afternoon. Morning was clean.","Great macro read. Let winners run.","News spike stopped me out. Move on."];data[ds]={pnl,trades,note:notes[Math.floor(Math.random()*notes.length)],mood};}return data;};

// ── Primitives ─────────────────────────────────────────────────────────────────
function Avatar({name="?",size=40,verified=false,supporter=false,pulse=false}){
  const palette=["#00E676","#007AFF","#FF9500","#FF2D55","#AF52DE","#5AC8FA","#FF6B35","#00C7BE"];
  const c=palette[name.charCodeAt(0)%palette.length];const bc=supporter?G.blue:verified?G.green:null;
  return(<div style={{position:"relative",flexShrink:0}}><div style={{width:size,height:size,borderRadius:"50%",background:`linear-gradient(135deg,${c},${c}bb)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.4,fontWeight:700,color:"#fff",boxShadow:pulse?`0 0 0 3px ${G.green}40`:"none"}}>{name[0].toUpperCase()}</div>{bc&&<div style={{position:"absolute",bottom:-1,right:-1,width:size*0.33,height:size*0.33,borderRadius:"50%",background:bc,border:"2px solid #fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.15,color:"#fff",fontWeight:900}}>✓</div>}</div>);
}
function CheckBadge({color=G.green,size=14}){return <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:size,height:size,borderRadius:"50%",background:color,fontSize:size*0.58,color:"#fff",fontWeight:900,flexShrink:0}}>✓</span>;}
function ScorePill({score}){const t=getTier(score);return(<span style={{display:"inline-flex",alignItems:"center",gap:3,background:t.bg,borderRadius:20,padding:"3px 9px",border:`1px solid ${t.color}22`}}><span style={{fontSize:12,fontWeight:700,color:t.color}}>{score}</span><span style={{fontSize:10,fontWeight:500,color:t.color,opacity:.85}}>{t.name}</span></span>);}
function StarRating({rating,size=14,interactive=false,onRate=null}){return(<div style={{display:"flex",gap:2}}>{[1,2,3,4,5].map(i=><span key={i} onClick={()=>interactive&&onRate&&onRate(i)} style={{fontSize:size,color:i<=Math.round(rating)?"#FF9500":"#E0E0E0",cursor:interactive?"pointer":"default",transition:"transform 0.1s"}} onMouseEnter={e=>{if(interactive)e.target.style.transform="scale(1.2)";}} onMouseLeave={e=>{if(interactive)e.target.style.transform="scale(1)";}}>★</span>)}</div>);}
function MiniChart({data,color=G.green,height=36}){if(!data||data.length<2)return null;const d=data.slice(-14),mn=Math.min(...d),mx=Math.max(...d),rng=mx-mn||1,w=64;const pts=d.map((v,i)=>`${(i/(d.length-1))*w},${height-((v-mn)/rng)*height}`).join(" ");return <svg viewBox={`0 0 ${w} ${height}`} style={{width:w,height}}><polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/></svg>;}
function EquityCurve({data,color=G.green,height=72}){
  const [vis,setVis]=useState(false);const ref=useRef();
  useEffect(()=>{const obs=new IntersectionObserver(([e])=>{if(e.isIntersecting){setVis(true);obs.disconnect();}},{threshold:0.2});if(ref.current)obs.observe(ref.current);return()=>obs.disconnect();},[]);
  if(!data||data.length<2)return null;const mn=Math.min(...data),mx=Math.max(...data),rng=mx-mn||1,w=400,h=height;const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-mn)/rng)*h}`).join(" ");
  return(<div ref={ref} style={{opacity:vis?1:0,transition:"opacity 0.5s ease",borderRadius:8,overflow:"hidden"}}><svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{width:"100%",height:h,display:"block"}}><defs><linearGradient id={`g${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".2"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs><polygon points={`${pts} ${w},${h} 0,${h}`} fill={`url(#g${color.replace("#","")})`}/><polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round"/></svg></div>);
}
function Btn({children,onClick,disabled=false,variant="green",size="md",full=false,icon=null}){
  const pad=size==="lg"?"15px 28px":size==="sm"?"7px 16px":size==="xs"?"5px 11px":"11px 22px";const fs=size==="lg"?16:size==="sm"?13:size==="xs"?11:14;
  const S={green:{bg:G.green,color:G.black,shadow:`0 4px 12px ${G.green}40`},outline:{bg:"transparent",color:G.green,border:`1.5px solid ${G.green}`},ghost:{bg:G.g100,color:G.g700},dark:{bg:G.black,color:G.white,shadow:"0 4px 12px #0003"},blue:{bg:G.blue,color:G.white,shadow:`0 4px 12px ${G.blue}40`},red:{bg:G.red,color:G.white}};
  const v=S[variant]||S.green;
  return(<button onClick={onClick} disabled={disabled} className="btn-press" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:pad,background:disabled?"#E8E8E8":v.bg,color:disabled?G.g400:v.color,border:v.border||"none",borderRadius:100,fontSize:fs,fontWeight:700,cursor:disabled?"not-allowed":"pointer",width:full?"100%":"auto",boxShadow:disabled?"none":v.shadow||"none"}}>{icon&&<span style={{fontSize:fs+2}}>{icon}</span>}{children}</button>);
}
function Input({label,type="text",value,onChange,placeholder,maxLength,multiline=false,rows=3,hint=null}){
  const [foc,setFoc]=useState(false);const s={width:"100%",padding:"13px 15px",border:`1.5px solid ${foc?G.green:G.g200}`,borderRadius:13,fontSize:14,color:G.black,background:foc?"#FAFFFE":G.white,outline:"none",transition:"all 0.2s",boxSizing:"border-box",resize:"none",lineHeight:1.5};
  return(<div style={{marginBottom:14}}>{label&&<div style={{fontSize:12,fontWeight:700,color:G.g600,marginBottom:5}}>{label}</div>}{multiline?<textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)} style={s}/>:<input type={type} value={value} onChange={onChange} placeholder={placeholder} maxLength={maxLength} onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)} style={s}/>}{hint&&<div style={{fontSize:11,color:G.g400,marginTop:4}}>{hint}</div>}</div>);
}
function TrustRow({items}){return(<div style={{display:"flex",flexDirection:"column",gap:6,margin:"12px 0"}}>{items.map((t,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:7,background:G.g50,borderRadius:9,padding:"7px 11px"}}><span style={{fontSize:13}}>🔒</span><span style={{fontSize:11,fontWeight:500,color:G.g500,lineHeight:1.4}}>{t}</span></div>))}</div>);}
function EmptyState({emoji,title,subtitle,action,actionLabel}){return(<div className="fade-up" style={{padding:"50px 32px",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center"}}><div style={{fontSize:50,marginBottom:14}}>{emoji}</div><div style={{fontSize:18,fontWeight:800,color:G.black,letterSpacing:"-0.02em",marginBottom:8,lineHeight:1.2}}>{title}</div><p style={{fontSize:13,color:G.g500,lineHeight:1.65,maxWidth:260,marginBottom:action?20:0}}>{subtitle}</p>{action&&<Btn onClick={action}>{actionLabel}</Btn>}</div>);}
function VerifyBanner({onVerify}){const [v,setV]=useState(true);if(!v)return null;return(<div className="fade-up" style={{margin:"12px 16px",borderRadius:16,background:`linear-gradient(135deg,${G.green}15,${G.green}05)`,border:`1.5px solid ${G.green}40`,padding:"14px 16px",position:"relative"}}><button onClick={()=>setV(false)} style={{position:"absolute",top:10,right:10,background:"none",border:"none",fontSize:16,color:G.g400,cursor:"pointer"}}>×</button><div style={{display:"flex",gap:12,alignItems:"center"}}><div style={{width:44,height:44,borderRadius:"50%",background:G.green,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,boxShadow:`0 4px 12px ${G.green}50`}}>✓</div><div style={{flex:1,paddingRight:16}}><div style={{fontSize:14,fontWeight:800,color:G.black,marginBottom:3}}>Get your green checkmark</div><div style={{fontSize:12,color:G.g600,lineHeight:1.5,marginBottom:10}}>Upload your trade history — earn a verified score and unlock strategy sales.</div><Btn size="sm" onClick={onVerify}>Verify my trades</Btn></div></div></div>);}

// ── Trending strip ─────────────────────────────────────────────────────────────
function TrendingStrip({posts,traders,onTraderClick}){
  const trending=[...posts].sort((a,b)=>(b.likes+b.shares*2)-(a.likes+a.shares*2)).slice(0,4);
  if(!trending.length)return null;
  return(<div style={{borderBottom:`1px solid ${G.g100}`,paddingBottom:14}}>
    <div style={{padding:"12px 16px 8px",display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:14}}>🔥</span><span style={{fontSize:12,fontWeight:800,color:G.black,letterSpacing:"0.03em"}}>TRENDING THIS WEEK</span></div>
    <div style={{display:"flex",gap:10,overflowX:"auto",padding:"0 16px"}}>
      {trending.map(p=>{const trader=traders.find(t=>t.id===p.traderId);if(!trader)return null;const isTrade=p.type==="trade";const green=isTrade&&p.pnl>=0;
        return(<div key={p.id} onClick={()=>onTraderClick(trader)} className="press" style={{flexShrink:0,width:155,background:G.g50,borderRadius:14,padding:12,cursor:"pointer",border:`1px solid ${G.g100}`}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><Avatar name={trader.name} size={24} verified={trader.verified}/><span style={{fontSize:11,fontWeight:700,color:G.black,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{trader.name.toLowerCase()}</span></div>
          {isTrade?<div><div style={{fontSize:18,fontWeight:900,color:green?G.profit:G.loss,letterSpacing:"-0.03em"}}>{green?"+":"-"}${Math.abs(p.pnl).toLocaleString()}</div><div style={{fontSize:11,color:G.g500,marginTop:1}}>{p.symbol} · {p.direction}</div></div>
          :<p style={{fontSize:12,color:G.black,lineHeight:1.5,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical"}}>{p.text}</p>}
          <div style={{display:"flex",gap:8,marginTop:8}}><span style={{fontSize:11,color:G.red}}>♥ {p.likes}</span><span style={{fontSize:11,color:G.g400}}>⟳ {p.shares}</span></div>
        </div>);
      })}
    </div>
  </div>);
}

// ── Leave Review Modal ─────────────────────────────────────────────────────────
function LeaveReviewModal({strategy,onClose,onSubmit}){
  const [rating,setRating]=useState(0);const [text,setText]=useState("");
  return(<div style={{position:"fixed",inset:0,background:"#00000080",zIndex:1002,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
    <div className="slide-up" style={{background:G.white,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:480,margin:"0 auto",padding:"0 20px 36px"}} onClick={e=>e.stopPropagation()}>
      <div style={{width:36,height:4,background:G.g200,borderRadius:2,margin:"14px auto 18px"}}/>
      <div style={{fontSize:18,fontWeight:900,color:G.black,marginBottom:4}}>Leave a review</div>
      <div style={{fontSize:13,color:G.g500,marginBottom:20}}>{strategy.title}</div>
      <div style={{marginBottom:20}}><div style={{fontSize:12,fontWeight:700,color:G.g600,marginBottom:10}}>Your rating</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}><StarRating rating={rating} size={36} interactive onRate={setRating}/>{rating>0&&<span style={{fontSize:13,fontWeight:700,color:G.g600}}>{["","Poor","Fair","Good","Great","Excellent"][rating]}</span>}</div>
      </div>
      <Input label="Your review" value={text} onChange={e=>setText(e.target.value)} placeholder="What did you think? What worked? What would you add?" multiline rows={4} hint="Your review will be shown publicly on the listing."/>
      <Btn full size="lg" disabled={rating===0||!text.trim()} onClick={()=>{onSubmit({rating,text});onClose();}}>Submit review</Btn>
    </div>
  </div>);
}

// ── Strategy detail modal ─────────────────────────────────────────────────────
function StrategyDetail({strategy,seller,onClose,onBuy,owned,onFollowStrategy,followedStrategies,onOpenDMs}){
  const [tab,setTab]=useState("overview");const [buyStep,setBuyStep]=useState(null);
  const [cardNum,setCardNum]=useState(""),[ expiry,setExpiry]=useState(""),[ cvv,setCvv]=useState(""),[ name,setName]=useState("");
  const [showReview,setShowReview]=useState(false);const [reviews,setReviews]=useState(strategy.reviews||[]);
  const cardValid=cardNum.length>=16&&expiry.length>=4&&cvv.length>=3&&name.trim().length>1;
  const isFollowing=followedStrategies.has(strategy.id);
  const avgRating=reviews.length?reviews.reduce((s,r)=>s+r.rating,0)/reviews.length:strategy.rating;

  if(showReview)return <LeaveReviewModal strategy={strategy} onClose={()=>setShowReview(false)} onSubmit={r=>setReviews(p=>[{id:Date.now(),author:"YOU",rating:r.rating,text:r.text,ts:Date.now()},...p])}/>;

  if(buyStep==="success")return(
    <div style={{position:"fixed",inset:0,background:"#00000080",zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={onClose}>
      <div className="bounce-in" style={{background:G.white,borderRadius:22,padding:36,width:"100%",maxWidth:340,textAlign:"center"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:56,marginBottom:14}}>🎉</div>
        <div style={{fontSize:22,fontWeight:900,color:G.black,letterSpacing:"-0.03em",marginBottom:8}}>Strategy Unlocked!</div>
        <p style={{fontSize:14,color:G.g500,lineHeight:1.65,marginBottom:20}}>You now have full access to <strong>{strategy.title}</strong>.</p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <Btn full onClick={()=>{onBuy(strategy.id);setBuyStep(null);}}>View full strategy</Btn>
          <Btn full variant="ghost" icon="💬" onClick={()=>{onBuy(strategy.id);onOpenDMs(seller);onClose();}}>Message {seller?.name?.toLowerCase()}</Btn>
        </div>
      </div>
    </div>
  );

  if(buyStep==="payment")return(
    <div style={{position:"fixed",inset:0,background:"#00000080",zIndex:1001,display:"flex",alignItems:"flex-end"}} onClick={()=>setBuyStep(null)}>
      <div className="slide-up" style={{background:G.white,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:480,margin:"0 auto",padding:"0 20px 36px",maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,background:G.g200,borderRadius:2,margin:"14px auto 18px"}}/>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
          <button onClick={()=>setBuyStep(null)} style={{background:G.g100,border:"none",borderRadius:"50%",width:32,height:32,cursor:"pointer",fontSize:15,color:G.g600,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
          <div><div style={{fontSize:15,fontWeight:800,color:G.black}}>Complete purchase</div><div style={{fontSize:11,color:G.g500}}>{strategy.title} · ${strategy.price}</div></div>
        </div>
        <div style={{background:G.g50,borderRadius:14,padding:14,marginBottom:18,border:`1px solid ${G.g100}`}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:13,color:G.g600}}>{strategy.title}</span><span style={{fontFamily:"'DM Mono'",fontSize:14,fontWeight:600}}>${strategy.price}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,borderTop:`1px solid ${G.g200}`}}><span style={{fontSize:13,fontWeight:700}}>Total</span><span style={{fontFamily:"'DM Mono'",fontSize:16,fontWeight:700}}>${strategy.price}</span></div>
        </div>
        <Input label="Name on card" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/>
        <div style={{marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:G.g600,marginBottom:5}}>Card number</div><input value={cardNum} onChange={e=>setCardNum(e.target.value.replace(/\D/g,"").slice(0,16))} placeholder="1234 5678 9012 3456" style={{width:"100%",padding:"13px 15px",border:`1.5px solid ${G.g200}`,borderRadius:13,fontFamily:"'DM Mono'",fontSize:14,color:G.black,outline:"none",boxSizing:"border-box"}}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
          <div><div style={{fontSize:12,fontWeight:700,color:G.g600,marginBottom:5}}>Expiry (MMYY)</div><input value={expiry} onChange={e=>setExpiry(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="0126" style={{width:"100%",padding:"13px 15px",border:`1.5px solid ${G.g200}`,borderRadius:13,fontFamily:"'DM Mono'",fontSize:14,color:G.black,outline:"none",boxSizing:"border-box"}}/></div>
          <div><div style={{fontSize:12,fontWeight:700,color:G.g600,marginBottom:5}}>CVV</div><input value={cvv} onChange={e=>setCvv(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="123" style={{width:"100%",padding:"13px 15px",border:`1.5px solid ${G.g200}`,borderRadius:13,fontFamily:"'DM Mono'",fontSize:14,color:G.black,outline:"none",boxSizing:"border-box"}}/></div>
        </div>
        <Btn full size="lg" disabled={!cardValid} onClick={()=>setBuyStep("success")}>Pay ${strategy.price} →</Btn>
        <TrustRow items={["One-time payment — no subscriptions","Instant access after purchase","256-bit SSL encryption"]}/>
      </div>
    </div>
  );

  return(<div style={{position:"fixed",inset:0,background:"#00000080",zIndex:1000,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
    <div className="slide-up" style={{background:G.white,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:480,margin:"0 auto",maxHeight:"93vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
      <div style={{width:36,height:4,background:G.g200,borderRadius:2,margin:"14px auto 0"}}/>
      {/* Header */}
      <div style={{background:G.black,margin:"14px 16px 0",borderRadius:16,padding:"16px 18px"}}>
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          {strategy.featured&&<span style={{fontSize:11,fontWeight:700,color:G.gold,background:"#FFD70020",borderRadius:20,padding:"2px 9px",border:`1px solid ${G.gold}50`}}>⭐ Featured</span>}
          <span style={{fontSize:11,fontWeight:700,color:G.green,background:"#00E67618",borderRadius:20,padding:"2px 9px"}}>{strategy.market}</span>
          <span style={{fontSize:11,fontWeight:600,color:G.g300,background:"#ffffff12",borderRadius:20,padding:"2px 9px"}}>{strategy.timeframe}</span>
        </div>
        <div style={{fontSize:19,fontWeight:900,color:G.white,letterSpacing:"-0.03em",lineHeight:1.2,marginBottom:6}}>{strategy.title}</div>
        <div style={{fontSize:13,color:"#aaa",lineHeight:1.5,marginBottom:12}}>{strategy.tagline}</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",gap:12}}><span style={{fontSize:12,color:G.g400}}>👥 {strategy.followers+(isFollowing?1:0)}</span><span style={{fontSize:12,color:G.g400}}>🛒 {strategy.sales} sold</span></div>
          <button onClick={()=>onFollowStrategy(strategy.id)} className="btn-press" style={{display:"flex",alignItems:"center",gap:5,background:isFollowing?"#ffffff20":"#ffffff12",border:`1px solid ${isFollowing?G.green:"#ffffff25"}`,borderRadius:20,padding:"5px 13px",cursor:"pointer",fontSize:12,fontWeight:700,color:isFollowing?G.green:G.white,transition:"all 0.2s"}}>{isFollowing?"✓ Following":"+ Follow"}</button>
        </div>
      </div>
      {/* Seller */}
      <div style={{margin:"12px 16px",background:G.g50,borderRadius:14,padding:"12px 16px",border:`1px solid ${G.g100}`,display:"flex",alignItems:"center",gap:12}}>
        <Avatar name={seller?.name||"?"} size={42} verified={seller?.verified} supporter={seller?.supporter}/>
        <div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}><span style={{fontSize:14,fontWeight:800,color:G.black}}>{seller?.name?.toLowerCase()}</span>{seller?.supporter&&<CheckBadge color={G.blue} size={12}/>}{seller?.verified&&!seller?.supporter&&<CheckBadge color={G.green} size={12}/>}</div><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><ScorePill score={seller?.traderScore||0}/><span style={{fontSize:11,color:G.g500}}>{seller?.winRate}% win · {seller?.tradeCount} trades</span></div></div>
        <div style={{textAlign:"right"}}><div style={{fontSize:10,fontWeight:700,color:G.g400,marginBottom:3}}>VERIFIED</div><div style={{display:"flex",alignItems:"center",gap:3}}><StarRating rating={avgRating} size={12}/><span style={{fontSize:12,fontWeight:700}}>{avgRating.toFixed(1)}</span></div></div>
      </div>
      {/* Tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${G.g100}`}}>
        {[["overview","Overview"],["preview","Preview 👀"],["includes","Includes"],["reviews",`Reviews (${reviews.length})`]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"10px 0",background:"none",border:"none",borderBottom:`2.5px solid ${tab===t?G.green:"transparent"}`,fontSize:11,fontWeight:tab===t?800:500,color:tab===t?G.black:G.g400,cursor:"pointer"}}>{l}</button>
        ))}
      </div>
      <div style={{padding:"16px 18px"}}>
        {tab==="overview"&&(<><p style={{fontSize:14,color:G.g700,lineHeight:1.75,marginBottom:14}}>{strategy.description}</p><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{strategy.tags.map(tag=>(<span key={tag} style={{fontSize:12,fontWeight:600,color:G.g600,background:G.g100,borderRadius:20,padding:"4px 11px"}}>{tag}</span>))}</div></>)}
        {tab==="preview"&&(
          <div>
            <div style={{fontSize:13,fontWeight:800,color:G.black,marginBottom:12}}>{strategy.preview.title}</div>
            {strategy.preview.points.map((pt,i)=>(<div key={i} style={{display:"flex",gap:10,marginBottom:10,padding:"10px 13px",background:G.g50,borderRadius:12,border:`1px solid ${G.g100}`}}><div style={{width:20,height:20,borderRadius:"50%",background:G.green,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:10,fontWeight:900,color:G.black,marginTop:1}}>✓</div><span style={{fontSize:13,color:G.black,lineHeight:1.5}}>{pt}</span></div>))}
            <div style={{position:"relative",marginTop:8,borderRadius:14,overflow:"hidden"}}>
              <p style={{fontSize:13,color:G.g700,lineHeight:1.75,padding:"13px 15px",background:G.g50,borderRadius:14,filter:owned?"none":"blur(4px)",userSelect:owned?"auto":"none"}}>{strategy.preview.teaser}</p>
              {!owned&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#ffffffcc",borderRadius:14,textAlign:"center",padding:20}}><div style={{fontSize:22,marginBottom:8}}>🔒</div><div style={{fontSize:14,fontWeight:800,color:G.black,marginBottom:4}}>Purchase to read more</div><div style={{fontSize:12,color:G.g500,marginBottom:12}}>Full strategy reveals all variations, charts, and rules.</div><Btn size="sm" onClick={()=>setBuyStep("payment")}>Buy for ${strategy.price}</Btn></div>}
            </div>
          </div>
        )}
        {tab==="includes"&&(<div><div style={{fontSize:12,fontWeight:700,color:G.g500,marginBottom:12,letterSpacing:"0.04em"}}>WHAT YOU GET</div>{strategy.includes.map((item,i)=>(<div key={i} style={{display:"flex",alignItems:"flex-start",gap:11,marginBottom:10,padding:"10px 13px",background:G.g50,borderRadius:12,border:`1px solid ${G.g100}`}}><div style={{width:22,height:22,borderRadius:"50%",background:G.green,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:11,color:G.black,fontWeight:900}}>✓</div><span style={{fontSize:14,color:G.black,lineHeight:1.5}}>{item}</span></div>))}</div>)}
        {tab==="reviews"&&(
          <div>
            <div style={{background:G.g50,borderRadius:14,padding:14,marginBottom:14,display:"flex",gap:14,alignItems:"center",border:`1px solid ${G.g100}`}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:36,fontWeight:900,color:G.black,letterSpacing:"-0.04em",lineHeight:1}}>{avgRating.toFixed(1)}</div><StarRating rating={avgRating} size={15}/><div style={{fontSize:11,color:G.g400,marginTop:3}}>{reviews.length} reviews</div></div>
              <div style={{flex:1}}>{[5,4,3,2,1].map(star=>{const pct=reviews.length?reviews.filter(r=>r.rating===star).length/reviews.length:0;return(<div key={star} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><span style={{fontSize:10,color:G.g400,width:8}}>{star}</span><div style={{flex:1,height:5,borderRadius:3,background:G.g200,overflow:"hidden"}}><div style={{height:"100%",width:`${pct*100}%`,background:G.orange,borderRadius:3}}/></div></div>);})}</div>
            </div>
            {owned&&<div style={{marginBottom:14}}><Btn full variant="ghost" icon="✏️" onClick={()=>setShowReview(true)}>Leave a review</Btn></div>}
            {reviews.map(r=>(<div key={r.id} style={{marginBottom:12,padding:"12px 14px",background:G.g50,borderRadius:14,border:`1px solid ${G.g100}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{display:"flex",alignItems:"center",gap:8}}><Avatar name={r.author} size={26}/><span style={{fontSize:13,fontWeight:700,color:G.black}}>{r.author.toLowerCase()}</span></div><div style={{display:"flex",alignItems:"center",gap:6}}><StarRating rating={r.rating} size={12}/><span style={{fontSize:11,color:G.g400}}>{timeAgo(r.ts)}</span></div></div><p style={{fontSize:13,color:G.g700,lineHeight:1.6}}>{r.text}</p></div>))}
            {reviews.length===0&&<EmptyState emoji="📝" title="No reviews yet" subtitle="Be the first to purchase and leave a review."/>}
          </div>
        )}
        {/* CTA */}
        <div style={{marginTop:8,paddingTop:14,borderTop:`1px solid ${G.g100}`}}>
          {owned?(<div><div style={{background:G.greenLight,borderRadius:13,padding:"12px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:10,border:`1px solid ${G.green}30`}}><span style={{fontSize:20}}>✅</span><div><div style={{fontSize:14,fontWeight:700,color:G.black}}>You own this strategy</div><div style={{fontSize:12,color:G.g500}}>Full access unlocked.</div></div></div><Btn full variant="ghost" icon="💬" onClick={()=>onOpenDMs(seller)}>Message {seller?.name?.toLowerCase()}</Btn></div>)
          :(<><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}><div><div style={{fontSize:10,fontWeight:700,color:G.g400}}>ONE-TIME PURCHASE</div><div style={{fontFamily:"'DM Mono'",fontSize:28,fontWeight:700,color:G.black}}>${strategy.price}</div></div><Btn size="lg" icon="💳" onClick={()=>setBuyStep("payment")}>Buy now</Btn></div><TrustRow items={["Instant access · No subscriptions","Results backed by verified trade data"]}/></>)}
        </div>
      </div>
    </div>
  </div>);
}

// ── Bundle card ────────────────────────────────────────────────────────────────
function BundleCard({bundle,seller,onBuy,owned}){
  const [buyStep,setBuyStep]=useState(null);const [cardNum,setCardNum]=useState(""),[ expiry,setExpiry]=useState(""),[ cvv,setCvv]=useState(""),[ name,setName]=useState("");const cardValid=cardNum.length>=16&&expiry.length>=4&&cvv.length>=3&&name.trim().length>1;
  if(buyStep==="success")return(<div style={{position:"fixed",inset:0,background:"#00000080",zIndex:1002,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>setBuyStep(null)}><div className="bounce-in" style={{background:G.white,borderRadius:22,padding:36,width:"100%",maxWidth:320,textAlign:"center"}} onClick={e=>e.stopPropagation()}><div style={{fontSize:48,marginBottom:14}}>🎁</div><div style={{fontSize:20,fontWeight:900,color:G.black,marginBottom:8}}>Bundle Unlocked!</div><p style={{fontSize:13,color:G.g500,lineHeight:1.65,marginBottom:20}}>All strategies in this bundle are now yours forever.</p><Btn full onClick={()=>{onBuy(bundle.id);setBuyStep(null);}}>View strategies</Btn></div></div>);
  if(buyStep==="payment")return(<div style={{position:"fixed",inset:0,background:"#00000080",zIndex:1002,display:"flex",alignItems:"flex-end"}} onClick={()=>setBuyStep(null)}><div className="slide-up" style={{background:G.white,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:480,margin:"0 auto",padding:"0 20px 36px"}} onClick={e=>e.stopPropagation()}>
    <div style={{width:36,height:4,background:G.g200,borderRadius:2,margin:"14px auto 18px"}}/>
    <div style={{fontSize:16,fontWeight:900,color:G.black,marginBottom:14}}>{bundle.title}</div>
    <div style={{background:G.greenLight,borderRadius:12,padding:"12px 16px",marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center",border:`1px solid ${G.green}30`}}><div><div style={{fontSize:12,color:G.g500,textDecoration:"line-through"}}>${bundle.originalPrice} separately</div><div style={{fontSize:22,fontWeight:900,color:G.black}}>${bundle.price} <span style={{fontSize:13,fontWeight:700,color:G.profit}}>Save ${bundle.savings}</span></div></div><span style={{fontSize:28}}>🎁</span></div>
    <Input label="Name on card" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/>
    <div style={{marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:G.g600,marginBottom:5}}>Card number</div><input value={cardNum} onChange={e=>setCardNum(e.target.value.replace(/\D/g,"").slice(0,16))} placeholder="1234 5678 9012 3456" style={{width:"100%",padding:"12px 14px",border:`1.5px solid ${G.g200}`,borderRadius:13,fontFamily:"'DM Mono'",fontSize:14,color:G.black,outline:"none",boxSizing:"border-box"}}/></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
      <div><div style={{fontSize:12,fontWeight:700,color:G.g600,marginBottom:5}}>Expiry</div><input value={expiry} onChange={e=>setExpiry(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="0126" style={{width:"100%",padding:"12px 14px",border:`1.5px solid ${G.g200}`,borderRadius:13,fontFamily:"'DM Mono'",fontSize:14,color:G.black,outline:"none",boxSizing:"border-box"}}/></div>
      <div><div style={{fontSize:12,fontWeight:700,color:G.g600,marginBottom:5}}>CVV</div><input value={cvv} onChange={e=>setCvv(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="123" style={{width:"100%",padding:"12px 14px",border:`1.5px solid ${G.g200}`,borderRadius:13,fontFamily:"'DM Mono'",fontSize:14,color:G.black,outline:"none",boxSizing:"border-box"}}/></div>
    </div>
    <Btn full size="lg" disabled={!cardValid} onClick={()=>setBuyStep("success")}>Buy bundle ${bundle.price} →</Btn>
    <TrustRow items={["Instant access to all strategies","One-time payment — no subscriptions"]}/>
  </div></div>);
  return(<div style={{margin:"0 16px 14px",borderRadius:16,overflow:"hidden",border:`1px solid ${G.green}40`,boxShadow:`0 4px 20px ${G.green}15`}}>
    <div style={{background:`linear-gradient(135deg,${G.black},#1a1a1a)`,padding:"14px 18px"}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{fontSize:14}}>🎁</span><span style={{fontSize:11,fontWeight:800,color:G.green,letterSpacing:"0.04em"}}>BUNDLE DEAL</span></div><div style={{fontSize:16,fontWeight:900,color:G.white,marginBottom:4,letterSpacing:"-0.02em"}}>{bundle.title}</div><p style={{fontSize:12,color:"#aaa",lineHeight:1.5}}>{bundle.description}</p></div>
    <div style={{background:G.greenLight,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",border:`1px solid ${G.green}30`}}><div><div style={{fontSize:11,color:G.g500,textDecoration:"line-through"}}>${bundle.originalPrice} separately</div><div style={{display:"flex",alignItems:"baseline",gap:8}}><span style={{fontSize:24,fontWeight:900,color:G.black}}>${bundle.price}</span><span style={{fontSize:12,fontWeight:800,color:G.profit,background:`${G.profit}15`,padding:"2px 8px",borderRadius:20}}>Save ${bundle.savings}</span></div><div style={{fontSize:11,color:G.g500,marginTop:2}}>{bundle.sales} bundles sold</div></div>{owned?<div style={{background:G.green,borderRadius:20,padding:"7px 14px",fontSize:12,fontWeight:700,color:G.black}}>✓ Owned</div>:<Btn size="sm" onClick={()=>setBuyStep("payment")}>Get bundle →</Btn>}</div>
  </div>);
}

// ── Strategy card ─────────────────────────────────────────────────────────────
function StrategyCard({strategy,seller,onView,animDelay=0}){
  return(<div className="fade-up hov" onClick={()=>onView(strategy)} style={{margin:"0 16px 12px",borderRadius:16,border:`1px solid ${strategy.featured?G.gold+"55":G.g100}`,background:G.white,cursor:"pointer",overflow:"hidden",boxShadow:strategy.featured?`0 4px 20px ${G.gold}18`:"0 2px 10px #0000000a",animationDelay:`${animDelay}ms`,transition:"box-shadow 0.2s,transform 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";}} onMouseLeave={e=>{e.currentTarget.style.transform="none";}}>
    <div style={{background:G.black,padding:"8px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",gap:5}}>{strategy.featured&&<span style={{fontSize:11,fontWeight:700,color:G.gold,background:"#FFD70018",borderRadius:20,padding:"2px 9px",border:`1px solid ${G.gold}35`}}>⭐ Featured</span>}<span style={{fontSize:11,fontWeight:700,color:G.green,background:"#00E67618",borderRadius:20,padding:"2px 9px"}}>{strategy.market}</span><span style={{fontSize:11,fontWeight:600,color:G.g300,background:"#ffffff10",borderRadius:20,padding:"2px 9px"}}>{strategy.timeframe}</span></div>
      <div style={{fontFamily:"'DM Mono'",fontSize:15,fontWeight:700,color:G.green}}>${strategy.price}</div>
    </div>
    <div style={{padding:"13px 16px"}}>
      <div style={{fontSize:14,fontWeight:800,color:G.black,letterSpacing:"-0.02em",marginBottom:3,lineHeight:1.3}}>{strategy.title}</div>
      <div style={{fontSize:12,color:G.g500,lineHeight:1.55,marginBottom:11}}>{strategy.tagline}</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><Avatar name={seller?.name||"?"} size={26} verified={seller?.verified} supporter={seller?.supporter}/><div><div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:11,fontWeight:700,color:G.black}}>{seller?.name?.toLowerCase()}</span>{seller?.verified&&<CheckBadge color={G.green} size={10}/>}</div><ScorePill score={seller?.traderScore||0}/></div></div>
        <div style={{textAlign:"right"}}><div style={{display:"flex",alignItems:"center",gap:3,justifyContent:"flex-end",marginBottom:2}}><StarRating rating={strategy.rating} size={11}/><span style={{fontSize:11,fontWeight:700,color:G.g600}}>{strategy.rating}</span></div><div style={{fontSize:10,color:G.g400}}>{strategy.sales} sold · 👥 {strategy.followers}</div></div>
      </div>
    </div>
  </div>);
}

// ── Create strategy ───────────────────────────────────────────────────────────
function CreateStrategyModal({onClose,onSubmit}){
  const [title,setTitle]=useState(""),[ tagline,setTagline]=useState(""),[ description,setDescription]=useState("");const [market,setMarket]=useState("Futures"),[ timeframe,setTimeframe]=useState(""),[ price,setPrice]=useState("");const [includes,setIncludes]=useState(["","",""]);const [step,setStep]=useState(1);
  const valid1=title.trim()&&tagline.trim()&&market&&timeframe;const valid2=description.trim().length>50&&price&&parseFloat(price)>=1;const valid3=includes.filter(i=>i.trim()).length>=2;
  function updateInclude(idx,val){setIncludes(p=>{const n=[...p];n[idx]=val;return n;});}
  return(<div style={{position:"fixed",inset:0,background:"#00000080",zIndex:1000,display:"flex",alignItems:"flex-end"}} onClick={onClose}><div className="slide-up" style={{background:G.white,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:480,margin:"0 auto",padding:"0 0 36px",maxHeight:"92vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
    <div style={{width:36,height:4,background:G.g200,borderRadius:2,margin:"14px auto 0"}}/>
    <div style={{padding:"14px 20px 0"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><div style={{fontSize:16,fontWeight:900,color:G.black}}>List a strategy</div><div style={{fontSize:12,color:G.g400}}>Step {step} of 3</div></div><div style={{height:4,borderRadius:2,background:G.g100,overflow:"hidden",marginBottom:16}}><div style={{height:"100%",width:`${(step/3)*100}%`,background:G.green,borderRadius:2,transition:"width 0.3s"}}/></div></div>
    <div style={{padding:"0 20px"}}>
      {step===1&&(<><div style={{fontSize:13,color:G.g500,marginBottom:14}}>Tell buyers what you're selling and what market it targets.</div><Input label="Strategy title" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. VWAP Reclaim — ES Morning Setup" maxLength={70}/><Input label="Tagline" value={tagline} onChange={e=>setTagline(e.target.value)} placeholder="What result does this give the buyer?" maxLength={100}/><div style={{marginBottom:14}}><div style={{fontSize:12,fontWeight:700,color:G.g600,marginBottom:7}}>Market</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{["Futures","Prop","Forex","Crypto","Stocks","Options"].map(m=>(<button key={m} onClick={()=>setMarket(m)} style={{padding:"6px 12px",borderRadius:20,border:`1.5px solid ${market===m?G.green:G.g200}`,background:market===m?G.greenLight:G.white,fontSize:12,fontWeight:600,color:market===m?G.greenDark:G.g600,cursor:"pointer"}}>{m}</button>))}</div></div><Input label="Timeframe" value={timeframe} onChange={e=>setTimeframe(e.target.value)} placeholder="e.g. 5m / 15m, Daily, Any"/><Btn full size="lg" disabled={!valid1} onClick={()=>setStep(2)}>Next →</Btn></>)}
      {step===2&&(<><div style={{fontSize:13,color:G.g500,marginBottom:14}}>Describe the strategy. Be specific — buyers want real info, not hype.</div><Input label="Full description" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe your setup, the edge, and what results you've seen." multiline rows={6} hint={`${description.length} chars — min 50`}/><Input label="Price (USD)" type="number" value={price} onChange={e=>setPrice(e.target.value)} placeholder="e.g. 49" hint="You keep 85% — TradeRank takes 15%"/>{price&&parseFloat(price)>=1&&<div style={{background:"#FF950010",borderRadius:12,padding:"10px 14px",marginBottom:12,border:`1px solid ${G.orange}25`}}><div style={{fontSize:12,fontWeight:700,color:G.orange,marginBottom:2}}>Your earnings per sale</div><div style={{fontSize:13,color:G.g700}}>You keep <strong>${((parseFloat(price)||0)*0.85).toFixed(2)}</strong> after the 15% fee.</div></div>}<div style={{display:"flex",gap:8}}><Btn variant="ghost" onClick={()=>setStep(1)}>← Back</Btn><Btn full size="lg" disabled={!valid2} onClick={()=>setStep(3)}>Next →</Btn></div></>)}
      {step===3&&(<><div style={{fontSize:13,color:G.g500,marginBottom:14}}>List what buyers receive — shown on the listing.</div><div style={{fontSize:12,fontWeight:700,color:G.g600,marginBottom:8}}>What's included (min. 2 items)</div>{includes.map((item,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><div style={{width:24,height:24,borderRadius:"50%",background:item.trim()?G.green:G.g100,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:item.trim()?G.black:G.g400,fontWeight:900,flexShrink:0,transition:"background 0.2s"}}>{item.trim()?"✓":i+1}</div><input value={item} onChange={e=>updateInclude(i,e.target.value)} placeholder={`Item ${i+1}`} style={{flex:1,padding:"10px 13px",border:`1.5px solid ${item.trim()?G.green:G.g200}`,borderRadius:12,fontSize:13,outline:"none",color:G.black}}/></div>))}<button onClick={()=>setIncludes(p=>[...p,""])} style={{background:"none",border:"none",color:G.green,cursor:"pointer",fontSize:13,fontWeight:700,marginBottom:18,padding:0}}>+ Add item</button><div style={{background:G.greenLight,borderRadius:14,padding:13,marginBottom:14,border:`1px solid ${G.green}30`}}><div style={{fontSize:12,fontWeight:700,color:G.greenDark,marginBottom:3}}>✓ Your verified stats will appear on the listing</div><div style={{fontSize:12,color:G.g600,lineHeight:1.5}}>Buyers see your TraderScore, win rate, and trade count — your edge over unverified sellers.</div></div><div style={{display:"flex",gap:8}}><Btn variant="ghost" onClick={()=>setStep(2)}>← Back</Btn><Btn full size="lg" variant="dark" disabled={!valid3} onClick={()=>{onSubmit();onClose();}}>Publish listing</Btn></div></>)}
    </div>
  </div></div>);
}

// ── Strategies view ────────────────────────────────────────────────────────────
function StrategiesView({traders,currentUser,onShowCreate,onOpenDMs}){
  const [strategies]=useState(SEED_STRATEGIES);const [selectedStrategy,setSelectedStrategy]=useState(null);const [filterMarket,setFilterMarket]=useState("All");const [filterSort,setFilterSort]=useState("featured");const [purchased,setPurchased]=useState(new Set());const [purchasedBundles,setPurchasedBundles]=useState(new Set());const [followedStrategies,setFollowedStrategies]=useState(new Set());const [myTab,setMyTab]=useState(false);
  const CATS=["All","Futures","Prop","Forex","Crypto","Stocks"];
  const myListings=strategies.filter(s=>s.sellerId===currentUser?.id);
  const totalEarned=myListings.reduce((sum,s)=>sum+(s.sales*(s.price*0.85)),0);
  let displayed=strategies.filter(s=>filterMarket==="All"||s.market===filterMarket);
  if(myTab)displayed=displayed.filter(s=>s.sellerId===currentUser?.id||purchased.has(s.id));
  if(filterSort==="featured")displayed=[...displayed].sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||b.sales-a.sales);
  else if(filterSort==="popular")displayed=[...displayed].sort((a,b)=>b.sales-a.sales);
  else if(filterSort==="rating")displayed=[...displayed].sort((a,b)=>b.rating-a.rating);
  else if(filterSort==="newest")displayed=[...displayed].sort((a,b)=>b.id-a.id);
  else if(filterSort==="price_lo")displayed=[...displayed].sort((a,b)=>a.price-b.price);
  const showBundle=!myTab&&(filterMarket==="All"||filterMarket==="Futures");
  return(<div>
    {selectedStrategy&&<StrategyDetail strategy={selectedStrategy} seller={traders.find(t=>t.id===selectedStrategy.sellerId)} onClose={()=>setSelectedStrategy(null)} onBuy={id=>setPurchased(p=>new Set([...p,id]))} owned={purchased.has(selectedStrategy.id)||selectedStrategy.sellerId===currentUser?.id} onFollowStrategy={id=>setFollowedStrategies(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;})} followedStrategies={followedStrategies} onOpenDMs={onOpenDMs}/>}
    <div style={{padding:"14px 16px 0"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}><h1 style={{fontSize:22,fontWeight:900,color:G.black,letterSpacing:"-0.03em"}}>Strategies</h1>{currentUser?.verified&&<Btn size="sm" variant="dark" onClick={onShowCreate} icon="📋">Sell yours</Btn>}</div>
      <p style={{fontSize:12,color:G.g500,marginBottom:12}}>Verified results only — no fake screenshots</p>
      {myListings.length>0&&<div className="fade-up" style={{background:G.black,borderRadius:16,padding:"13px 18px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontSize:10,fontWeight:700,color:G.g400,marginBottom:2,letterSpacing:"0.05em"}}>YOUR EARNINGS</div><div style={{fontFamily:"'DM Mono'",fontSize:26,fontWeight:700,color:G.green}}>${totalEarned.toLocaleString(undefined,{maximumFractionDigits:0})}</div><div style={{fontSize:11,color:G.g500,marginTop:1}}>{myListings.reduce((s,x)=>s+x.sales,0)} sales · {myListings.length} listing{myListings.length!==1?"s":""}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:10,fontWeight:700,color:G.g400,marginBottom:2}}>PAYOUT</div><div style={{fontSize:22,fontWeight:900,color:G.white}}>85%</div></div></div>}
      {(myListings.length>0||purchased.size>0)&&<div style={{display:"flex",background:G.g100,borderRadius:12,padding:3,marginBottom:12}}>{[["All strategies",false],["My strategies",true]].map(([label,val])=>(<button key={label} onClick={()=>setMyTab(val)} style={{flex:1,padding:"8px 0",borderRadius:10,border:"none",fontSize:13,fontWeight:myTab===val?700:500,cursor:"pointer",background:myTab===val?G.white:"transparent",color:myTab===val?G.black:G.g400,boxShadow:myTab===val?"0 1px 4px #0000001a":"none",transition:"all 0.15s"}}>{label}</button>))}</div>}
      <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:5,marginBottom:6}}>{CATS.map(c=>(<button key={c} onClick={()=>setFilterMarket(c)} style={{flexShrink:0,padding:"5px 13px",borderRadius:20,border:`1.5px solid ${filterMarket===c?G.green:G.g200}`,background:filterMarket===c?G.green:G.white,fontSize:11,fontWeight:600,color:filterMarket===c?G.white:G.g600,cursor:"pointer",whiteSpace:"nowrap",boxShadow:filterMarket===c?`0 3px 8px ${G.green}40`:"none"}}>{c}</button>))}</div>
      <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:8}}>{[["featured","⭐ Featured"],["popular","🔥 Popular"],["rating","★ Top rated"],["newest","🆕 Newest"],["price_lo","$ Low first"]].map(([val,label])=>(<button key={val} onClick={()=>setFilterSort(val)} style={{flexShrink:0,padding:"4px 11px",borderRadius:20,border:`1.5px solid ${filterSort===val?G.black:G.g200}`,background:filterSort===val?G.black:G.white,fontSize:11,fontWeight:600,color:filterSort===val?G.white:G.g600,cursor:"pointer",whiteSpace:"nowrap"}}>{label}</button>))}</div>
    </div>
    {!currentUser?.verified&&!currentUser?.isGuest&&<div style={{margin:"0 16px 14px",background:G.greenLight,borderRadius:14,padding:"12px 16px",border:`1px solid ${G.green}30`,display:"flex",gap:10,alignItems:"center"}}><span style={{fontSize:22}}>📈</span><div><div style={{fontSize:13,fontWeight:800,color:G.black,marginBottom:2}}>Want to sell your strategy?</div><div style={{fontSize:11,color:G.g600}}>Verify your trades first — buyers trust verified sellers.</div></div></div>}
    {showBundle&&SEED_BUNDLES.map(b=><BundleCard key={b.id} bundle={b} seller={traders.find(t=>t.id===b.sellerId)} onBuy={id=>setPurchasedBundles(p=>new Set([...p,id]))} owned={purchasedBundles.has(b.id)}/>)}
    <div style={{paddingTop:4}}>{displayed.length===0?<EmptyState emoji="📋" title="No strategies here" subtitle={myTab?"You haven't listed or purchased any strategies.":"No strategies match this filter."} action={currentUser?.verified?onShowCreate:null} actionLabel="List your first strategy"/>:displayed.map((s,i)=><StrategyCard key={s.id} strategy={s} seller={traders.find(t=>t.id===s.sellerId)} onView={setSelectedStrategy} animDelay={i*40}/>)}</div>
  </div>);
}

// ── Post card ─────────────────────────────────────────────────────────────────
function PostCard({post,trader,onLike,onShare,onComment,onTraderClick,animDelay=0}){
  const [showC,setShowC]=useState(false);const [txt,setTxt]=useState("");const [likeAnim,setLikeAnim]=useState(false);
  const isTrade=post.type==="trade";const green=isTrade&&post.pnl>=0;
  function doLike(){onLike(post.id);if(!post.liked){setLikeAnim(true);setTimeout(()=>setLikeAnim(false),400);}}
  return(<div className="fade-up" style={{background:G.white,borderBottom:`1px solid ${G.g100}`,paddingTop:13,animationDelay:`${animDelay}ms`}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingLeft:16,paddingRight:16,paddingBottom:9}}>
      <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>onTraderClick(trader)}>
        <Avatar name={trader.name} size={38} verified={trader.verified} supporter={trader.supporter}/>
        <div><div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:14,fontWeight:700,color:G.black}}>{trader.name.toLowerCase()}</span>{trader.supporter&&<CheckBadge color={G.blue} size={13}/>}{trader.verified&&!trader.supporter&&<CheckBadge color={G.green} size={13}/>}</div><div style={{fontSize:11,color:G.g400,marginTop:1}}>{trader.category} · {timeAgo(post.ts)}</div></div>
      </div>
      <div style={{display:"flex",gap:5}}>
        {isTrade&&<span style={{padding:"3px 8px",borderRadius:20,background:green?"#E8FFF3":"#FFF0EF",fontSize:11,fontWeight:700,color:green?G.profit:G.loss}}>{post.direction}</span>}
        <span style={{padding:"3px 8px",borderRadius:20,background:isTrade?G.g50:"#EEF5FF",fontSize:11,fontWeight:600,color:isTrade?G.g500:G.blue}}>{isTrade?"Trade":"Thought"}</span>
      </div>
    </div>
    <div style={{paddingLeft:16,paddingRight:16,paddingBottom:9}}>
      {isTrade?(<div><div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:8}}><div><div style={{fontSize:24,fontWeight:900,color:G.black,letterSpacing:"-0.04em",lineHeight:1}}>{post.symbol}</div><div style={{display:"flex",gap:14,marginTop:4}}>{[["Entry",post.entry],["Exit",post.exit]].map(([k,v])=>(<div key={k}><div style={{fontSize:10,fontWeight:600,color:G.g400}}>{k}</div><div style={{fontFamily:"'DM Mono'",fontSize:11,color:G.g600}}>{v}</div></div>))}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:26,fontWeight:900,color:green?G.profit:G.loss,letterSpacing:"-0.04em",lineHeight:1}}>{green?"+":"-"}${Math.abs(post.pnl).toLocaleString()}</div><MiniChart data={trader.equityCurve} color={green?G.profit:G.loss}/></div></div>{post.notes&&<p style={{fontSize:13,color:G.g600,lineHeight:1.65,background:G.g50,borderRadius:10,padding:"8px 11px"}}>{post.notes}</p>}</div>)
      :(<p style={{fontSize:15,color:G.black,lineHeight:1.7}}>{post.text}</p>)}
    </div>
    <div style={{paddingLeft:6,display:"flex",gap:2,paddingBottom:4}}>
      <button onClick={doLike} style={{display:"flex",alignItems:"center",gap:4,padding:"8px 10px",borderRadius:10,background:"transparent",border:"none",cursor:"pointer",fontSize:13,fontWeight:500,color:post.liked?G.red:G.g400}}><span className={likeAnim?"heart-pop":""} style={{fontSize:16,display:"inline-block"}}>{post.liked?"♥":"♡"}</span>{post.likes+(post.liked?1:0)}</button>
      <button onClick={()=>setShowC(!showC)} style={{display:"flex",alignItems:"center",gap:4,padding:"8px 10px",borderRadius:10,background:"transparent",border:"none",cursor:"pointer",fontSize:13,fontWeight:500,color:showC?G.blue:G.g400}}><span style={{fontSize:16}}>◇</span>{post.comments.length}</button>
      <button onClick={()=>onShare(post.id)} style={{display:"flex",alignItems:"center",gap:4,padding:"8px 10px",borderRadius:10,background:"transparent",border:"none",cursor:"pointer",fontSize:13,fontWeight:500,color:post.shared?G.green:G.g400}}><span style={{fontSize:16}}>⟳</span>{post.shares+(post.shared?1:0)}</button>
    </div>
    {showC&&(<div className="fade-in" style={{paddingLeft:16,paddingRight:16,paddingTop:9,paddingBottom:4,borderTop:`1px solid ${G.g100}`}}>
      {post.comments.map(c=>(<div key={c.id} style={{display:"flex",gap:7,marginBottom:7}}><Avatar name={c.author} size={24}/><div style={{flex:1,background:G.g50,borderRadius:12,padding:"7px 11px"}}><span style={{fontSize:12,fontWeight:700,color:G.black}}>{c.author.toLowerCase()} </span><span style={{fontSize:12,color:G.g700}}>{c.text}</span></div></div>))}
      <div style={{display:"flex",gap:7,marginTop:4,paddingBottom:9}}><input value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Add a comment..." onKeyDown={e=>{if(e.key==="Enter"&&txt.trim()){onComment(post.id,txt);setTxt("");}}} style={{flex:1,background:G.g50,border:"none",borderRadius:20,padding:"8px 14px",fontSize:13,outline:"none",color:G.black}}/>{txt.trim()&&<Btn size="xs" onClick={()=>{onComment(post.id,txt);setTxt("");}}>Post</Btn>}</div>
    </div>)}
  </div>);
}

// ── Post composer ─────────────────────────────────────────────────────────────
function PostComposer({onClose,onSubmit,isGuest,currentUser}){
  const [tab,setTab]=useState("trade");const [symbol,setSymbol]=useState(""),[ dir,setDir]=useState("LONG");const [entry,setEntry]=useState(""),[ exit,setExit]=useState("");const [pnl,setPnl]=useState(""),[ notes,setNotes]=useState("");const [thought,setThought]=useState("");const tradeValid=symbol&&entry&&exit&&pnl;
  if(isGuest)return(<div style={{position:"fixed",inset:0,background:"#00000070",zIndex:1000,display:"flex",alignItems:"flex-end"}} onClick={onClose}><div className="slide-up" style={{background:G.white,borderRadius:"22px 22px 0 0",padding:"28px 24px 36px",width:"100%",textAlign:"center"}} onClick={e=>e.stopPropagation()}><div style={{fontSize:40,marginBottom:12}}>🔒</div><div style={{fontSize:20,fontWeight:800,color:G.black,marginBottom:16}}>Sign in to post</div><Btn full onClick={onClose}>Got it</Btn></div></div>);
  return(<div style={{position:"fixed",inset:0,background:"#00000070",zIndex:1000,display:"flex",alignItems:"flex-end"}} onClick={onClose}><div className="slide-up" style={{background:G.white,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:480,margin:"0 auto",padding:"0 0 32px",maxHeight:"92vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
    <div style={{width:36,height:4,background:G.g200,borderRadius:2,margin:"14px auto 0"}}/>
    <div style={{display:"flex",borderBottom:`1px solid ${G.g100}`,margin:"14px 0 0"}}>{[["trade","📈 Trade"],["thought","💭 Thought"]].map(([t,l])=>(<button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"12px 0",background:"none",border:"none",borderBottom:`2.5px solid ${tab===t?G.green:"transparent"}`,fontSize:14,fontWeight:tab===t?800:500,color:tab===t?G.black:G.g400,cursor:"pointer"}}>{l}</button>))}</div>
    <div style={{padding:"14px 20px 0"}}>
      {tab==="trade"?(<><div style={{display:"flex",background:G.g100,borderRadius:13,padding:3,marginBottom:12}}>{["LONG","SHORT"].map(d=>(<button key={d} onClick={()=>setDir(d)} style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",fontSize:14,fontWeight:700,cursor:"pointer",background:dir===d?G.white:"transparent",color:dir===d?(d==="LONG"?G.profit:G.loss):G.g400,boxShadow:dir===d?"0 2px 6px #0000001a":"none",transition:"all 0.15s"}}>{d}</button>))}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Input label="Symbol" value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())} placeholder="ES, BTC..."/><Input label="PnL ($)" value={pnl} onChange={e=>setPnl(e.target.value)} placeholder="840"/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Input label="Entry" value={entry} onChange={e=>setEntry(e.target.value)} placeholder="0.00"/><Input label="Exit" value={exit} onChange={e=>setExit(e.target.value)} placeholder="0.00"/></div>
      <Input label="Notes" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="What was your thesis?" multiline rows={3}/>
      <Btn full size="lg" disabled={!tradeValid} onClick={()=>{if(tradeValid)onSubmit({type:"trade",symbol,direction:dir,entry,exit,pnl:parseFloat(pnl),notes});}}>Post trade</Btn></>)
      :(<><div style={{display:"flex",gap:10,marginBottom:12}}><Avatar name={currentUser?.name||"Y"} size={38} verified={currentUser?.verified} supporter={currentUser?.supporter}/><textarea value={thought} onChange={e=>setThought(e.target.value.slice(0,500))} placeholder="Share a market take, lesson, or observation..." rows={5} style={{flex:1,border:"none",fontSize:15,color:G.black,outline:"none",resize:"none",lineHeight:1.65,background:"transparent",padding:0}}/></div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:`1px solid ${G.g100}`,paddingTop:10,marginBottom:4}}><span style={{fontSize:12,color:G.g400}}>{thought.length}/500</span><Btn disabled={!thought.trim()} onClick={()=>{if(thought.trim())onSubmit({type:"thought",text:thought});}}>Post thought</Btn></div></>)}
    </div>
  </div></div>);
}

// ── DM Screen ─────────────────────────────────────────────────────────────────
function DMScreen({traders,onBack,openWithTrader}){
  const [dms,setDms]=useState(()=>{const base=SEED_DMS;if(openWithTrader&&!base.find(d=>d.withId===openWithTrader.id)){return[{id:Date.now(),withId:openWithTrader.id,withName:openWithTrader.name,lastMsg:"",lastTs:Date.now(),unread:0,messages:[]},...base];}return base;});
  const [active,setActive]=useState(()=>openWithTrader?dms.find(d=>d.withId===openWithTrader.id)||null:null);
  const [msg,setMsg]=useState("");const msgEnd=useRef();
  useEffect(()=>{if(active&&msgEnd.current)msgEnd.current.scrollIntoView({behavior:"smooth"});},[active,dms]);
  function send(){if(!msg.trim()||!active)return;setDms(p=>p.map(d=>d.id===active.id?{...d,messages:[...d.messages,{id:Date.now(),from:"ME",text:msg,ts:Date.now()}],lastMsg:msg,lastTs:Date.now()}:d));setMsg("");}
  const conv=active?dms.find(d=>d.id===active.id):null;const ct=conv?traders.find(t=>t.id===conv.withId):null;
  if(conv&&ct)return(<div style={{display:"flex",flexDirection:"column",height:"100vh"}}>
    <div style={{display:"flex",alignItems:"center",gap:11,padding:"11px 16px",borderBottom:`1px solid ${G.g100}`,background:G.white,flexShrink:0}}>
      <button onClick={()=>setActive(null)} style={{background:G.g100,border:"none",borderRadius:"50%",width:32,height:32,cursor:"pointer",fontSize:16,color:G.g600,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
      <Avatar name={ct.name} size={34} verified={ct.verified} supporter={ct.supporter}/>
      <div style={{flex:1}}><div style={{fontSize:14,fontWeight:800,color:G.black}}>{ct.name.toLowerCase()}</div><div style={{fontSize:11,color:G.g400}}>{ct.category}</div></div>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:"14px",background:G.g50,display:"flex",flexDirection:"column",gap:8}}>
      {conv.messages.length===0&&<div style={{textAlign:"center",padding:"32px 0",color:G.g400,fontSize:13}}>Say something to {ct.name.toLowerCase()} 👋</div>}
      {conv.messages.map(m=>{const isMe=m.from==="ME";return(<div key={m.id} style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start",gap:7,alignItems:"flex-end"}}>
        {!isMe&&<Avatar name={ct.name} size={24}/>}
        <div style={{maxWidth:"74%"}}><div style={{background:isMe?G.green:G.white,borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"10px 13px",boxShadow:"0 1px 4px #00000010"}}><span style={{fontSize:14,color:G.black,lineHeight:1.55}}>{m.text}</span></div><div style={{fontSize:9,color:G.g400,marginTop:2,textAlign:isMe?"right":"left"}}>{timeAgo(m.ts)}</div></div>
      </div>);})}
      <div ref={msgEnd}/>
    </div>
    <div style={{padding:"10px 12px",borderTop:`1px solid ${G.g100}`,background:G.white,display:"flex",gap:7,alignItems:"center",flexShrink:0}}>
      <input value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Message..." onKeyDown={e=>{if(e.key==="Enter")send();}} style={{flex:1,background:G.g100,border:"none",borderRadius:22,padding:"11px 16px",fontSize:14,outline:"none",color:G.black}}/>
      <button onClick={send} disabled={!msg.trim()} style={{width:38,height:38,borderRadius:"50%",background:msg.trim()?G.green:G.g200,border:"none",cursor:msg.trim()?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:G.black,flexShrink:0,boxShadow:msg.trim()?`0 3px 10px ${G.green}50`:"none"}}>↑</button>
    </div>
  </div>);
  return(<div>
    <div style={{padding:"13px 16px",borderBottom:`1px solid ${G.g100}`,display:"flex",alignItems:"center",gap:10}}>
      <button onClick={onBack} style={{background:"none",border:"none",fontSize:14,cursor:"pointer",color:G.g600,fontWeight:600,padding:0}}>← Back</button>
      <h1 style={{fontSize:20,fontWeight:900,color:G.black,letterSpacing:"-0.03em"}}>Messages</h1>
    </div>
    {dms.length===0&&<EmptyState emoji="💬" title="No messages yet" subtitle="Start a conversation by messaging a trader from their profile."/>}
    {dms.map(d=>{const t=traders.find(x=>x.id===d.withId);if(!t)return null;return(<div key={d.id} onClick={()=>setActive(d)} className="hov" style={{display:"flex",alignItems:"center",gap:11,padding:"12px 16px",cursor:"pointer",borderBottom:`1px solid ${G.g50}`}}>
      <div style={{position:"relative"}}><Avatar name={t.name} size={46} verified={t.verified} supporter={t.supporter}/>{d.unread>0&&<div style={{position:"absolute",top:-2,right:-2,width:17,height:17,borderRadius:"50%",background:G.green,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:G.black,border:`2px solid ${G.white}`}}>{d.unread}</div>}</div>
      <div style={{flex:1,minWidth:0}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:14,fontWeight:700,color:G.black}}>{t.name.toLowerCase()}</span><span style={{fontSize:11,color:G.g400}}>{timeAgo(d.lastTs)}</span></div><div style={{fontSize:13,color:d.unread>0?G.black:G.g400,fontWeight:d.unread>0?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.lastMsg||"Say hello!"}</div></div>
    </div>);})}
  </div>);
}

// ── Donation modal ─────────────────────────────────────────────────────────────
function DonationModal({onClose,onSuccess}){
  const [amount,setAmount]=useState(""),[ custom,setCustom]=useState(false),[ step,setStep]=useState("choose");
  const [cardNum,setCardNum]=useState(""),[ expiry,setExpiry]=useState(""),[ cvv,setCvv]=useState(""),[ name,setName]=useState("");
  const chosen=parseFloat(amount);const cardValid=cardNum.length>=16&&expiry.length>=4&&cvv.length>=3&&name.trim().length>1;
  if(step==="success")return(<div style={{position:"fixed",inset:0,background:"#00000070",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={onClose}><div className="bounce-in" style={{background:G.white,borderRadius:22,padding:36,width:"100%",maxWidth:340,textAlign:"center"}} onClick={e=>e.stopPropagation()}><div style={{width:68,height:68,borderRadius:"50%",background:G.blue,margin:"0 auto 14px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,boxShadow:`0 8px 28px ${G.blue}50`}}>✓</div><div style={{fontSize:22,fontWeight:900,color:G.black,marginBottom:8}}>You're a Supporter!</div><p style={{fontSize:13,color:G.g500,lineHeight:1.65,marginBottom:24}}>Your blue checkmark is live. Thank you for supporting TradeRank. 🙏</p><Btn full variant="dark" onClick={()=>{onSuccess();onClose();}}>Awesome!</Btn></div></div>);
  return(<div style={{position:"fixed",inset:0,background:"#00000070",zIndex:1000,display:"flex",alignItems:"flex-end"}} onClick={onClose}><div className="slide-up" style={{background:G.white,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:480,margin:"0 auto",padding:"0 20px 36px",maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
    <div style={{width:36,height:4,background:G.g200,borderRadius:2,margin:"14px auto 18px"}}/>
    {step==="choose"&&(<><div style={{textAlign:"center",marginBottom:22}}><div style={{width:58,height:58,borderRadius:"50%",background:`linear-gradient(135deg,${G.blue},#5AC8FA)`,margin:"0 auto 12px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,boxShadow:`0 6px 20px ${G.blue}50`}}>✓</div><h2 style={{fontSize:22,fontWeight:900,color:G.black,marginBottom:6}}>Support TradeRank</h2><p style={{fontSize:13,color:G.g500,lineHeight:1.65,maxWidth:260,margin:"0 auto"}}>Any donation gets you a permanent blue checkmark. No subscription.</p></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>{[5,10,25,50].map(p=>(<button key={p} onClick={()=>{setAmount(String(p));setCustom(false);}} style={{padding:"13px",borderRadius:13,border:`1.5px solid ${amount===String(p)&&!custom?G.blue:G.g200}`,background:amount===String(p)&&!custom?"#EEF5FF":G.white,fontSize:19,fontWeight:900,color:amount===String(p)&&!custom?G.blue:G.black,cursor:"pointer"}}>${p}</button>))}</div>
    <button onClick={()=>setCustom(!custom)} style={{width:"100%",padding:"11px",borderRadius:13,border:`1.5px solid ${custom?G.blue:G.g200}`,background:custom?"#EEF5FF":G.white,fontSize:14,fontWeight:600,color:custom?G.blue:G.g500,cursor:"pointer",marginBottom:custom?8:18}}>Custom amount</button>
    {custom&&<input value={amount} onChange={e=>setAmount(e.target.value.replace(/[^0-9.]/g,""))} placeholder="Enter amount..." style={{width:"100%",padding:"11px 14px",border:`1.5px solid ${G.blue}`,borderRadius:13,fontSize:16,fontWeight:700,color:G.black,outline:"none",boxSizing:"border-box",marginBottom:18,textAlign:"center"}}/>}
    <Btn full size="lg" variant="blue" disabled={!chosen||chosen<1} onClick={()=>setStep("payment")}>Continue → ${chosen||"0"}</Btn>
    <div style={{display:"flex",flexDirection:"column",gap:5,margin:"12px 0"}}>{["Permanent badge — not a subscription","Your data is never sold or shared"].map((t,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:7,background:G.g50,borderRadius:9,padding:"7px 11px"}}><span style={{fontSize:13}}>🔒</span><span style={{fontSize:11,fontWeight:500,color:G.g500}}>{t}</span></div>))}</div></>)}
    {step==="payment"&&(<><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}><button onClick={()=>setStep("choose")} style={{background:G.g100,border:"none",borderRadius:"50%",width:30,height:30,cursor:"pointer",fontSize:14,color:G.g600,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button><div><div style={{fontSize:15,fontWeight:800,color:G.black}}>Payment</div><div style={{fontSize:11,color:G.g500}}>Donating ${chosen}</div></div></div>
    <Input label="Name on card" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/>
    <div style={{marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:G.g600,marginBottom:5}}>Card number</div><input value={cardNum} onChange={e=>setCardNum(e.target.value.replace(/\D/g,"").slice(0,16))} placeholder="1234 5678 9012 3456" style={{width:"100%",padding:"12px 14px",border:`1.5px solid ${G.g200}`,borderRadius:13,fontFamily:"'DM Mono'",fontSize:14,color:G.black,outline:"none",boxSizing:"border-box"}}/></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
      <div><div style={{fontSize:12,fontWeight:700,color:G.g600,marginBottom:5}}>Expiry</div><input value={expiry} onChange={e=>setExpiry(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="0126" style={{width:"100%",padding:"12px 14px",border:`1.5px solid ${G.g200}`,borderRadius:13,fontFamily:"'DM Mono'",fontSize:14,color:G.black,outline:"none",boxSizing:"border-box"}}/></div>
      <div><div style={{fontSize:12,fontWeight:700,color:G.g600,marginBottom:5}}>CVV</div><input value={cvv} onChange={e=>setCvv(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="123" style={{width:"100%",padding:"12px 14px",border:`1.5px solid ${G.g200}`,borderRadius:13,fontFamily:"'DM Mono'",fontSize:14,color:G.black,outline:"none",boxSizing:"border-box"}}/></div>
    </div>
    <Btn full size="lg" variant="blue" disabled={!cardValid} onClick={()=>setStep("success")}>Donate ${chosen} →</Btn></>)}
  </div></div>);
}

// ── Notif panel ───────────────────────────────────────────────────────────────
function NotifPanel({notifs,onClose,onMarkAll}){
  const icons={like:"♥",follow:"👤",comment:"◇",rank:"📈",badge:"🏅",dm:"💬",purchase:"💰",strategy_follow:"👥",review:"⭐"};
  return(<div style={{position:"fixed",inset:0,zIndex:500}} onClick={onClose}><div className="fade-in" style={{position:"absolute",top:58,right:8,width:295,background:G.white,borderRadius:16,boxShadow:"0 8px 40px #00000020",border:`1px solid ${G.g100}`,overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
    <div style={{padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${G.g100}`}}><span style={{fontSize:15,fontWeight:800,color:G.black}}>Notifications</span><button onClick={onMarkAll} style={{background:"none",border:"none",color:G.green,cursor:"pointer",fontSize:12,fontWeight:700}}>Mark all read</button></div>
    <div style={{maxHeight:350,overflowY:"auto"}}>
      {notifs.map(n=>(<div key={n.id} style={{padding:"10px 14px",borderBottom:`1px solid ${G.g50}`,display:"flex",gap:9,background:n.read?G.white:G.greenLight}}>
        <div style={{width:32,height:32,borderRadius:"50%",background:n.read?G.g100:"#00E67618",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{icons[n.type]||"•"}</div>
        <div style={{flex:1}}><div style={{fontSize:12,color:G.g700,lineHeight:1.5}}><span style={{fontWeight:700}}>{n.from.toLowerCase()}</span> {n.text}</div><div style={{fontSize:10,color:G.g400,marginTop:2}}>{timeAgo(n.ts)}</div></div>
        {!n.read&&<div style={{width:7,height:7,borderRadius:"50%",background:G.green,flexShrink:0,marginTop:5}}/>}
      </div>))}
    </div>
  </div></div>);
}

// ── Journal ────────────────────────────────────────────────────────────────────
function JournalView(){
  const [journal,setJournal]=useState(()=>genJournal());const [calMonth,setCalMonth]=useState(new Date());const [selectedDay,setSelectedDay]=useState(null);const [editMode,setEditMode]=useState(false);const [draftNote,setDraftNote]=useState(""),[ draftPnl,setDraftPnl]=useState(""),[ draftTrades,setDraftTrades]=useState(""),[ draftMood,setDraftMood]=useState("good");const [logTab,setLogTab]=useState("calendar");
  const today=new Date().toISOString().split("T")[0];const year=calMonth.getFullYear(),month=calMonth.getMonth();const firstDay=new Date(year,month,1).getDay();const daysInMonth=new Date(year,month+1,0).getDate();const monthName=calMonth.toLocaleString("default",{month:"long",year:"numeric"});
  const last7=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d.toISOString().split("T")[0];});const weeklyData=last7.map(date=>({date,pnl:journal[date]?.pnl??null,label:new Date(date+"T12:00:00").toLocaleDateString("default",{weekday:"short"})}));const weeklyMax=Math.max(...weeklyData.map(d=>Math.abs(d.pnl||0)),1);
  const allEntries=Object.entries(journal);const tradingDays=allEntries.filter(([,v])=>v.pnl!==undefined);const profitDays=tradingDays.filter(([,v])=>v.pnl>0);const lossDays=tradingDays.filter(([,v])=>v.pnl<0);const totalPnl=tradingDays.reduce((s,[,v])=>s+v.pnl,0);
  const bestDay=tradingDays.reduce((b,[d,v])=>(!b||v.pnl>b.pnl)?{date:d,pnl:v.pnl}:b,null);const worstDay=tradingDays.reduce((b,[d,v])=>(!b||v.pnl<b.pnl)?{date:d,pnl:v.pnl}:b,null);
  const dayColor=pnl=>{if(pnl===null||pnl===undefined)return"transparent";if(pnl>500)return"#00C853";if(pnl>150)return"#00E676";if(pnl>0)return"#69F0AE";if(pnl>-100)return"#FF8A80";if(pnl>-300)return"#FF5252";return"#D50000";};
  const dayTxt=pnl=>pnl>=0?"#004d1a":"#7f0000";const moodEmoji={great:"😄",good:"🙂",neutral:"😐",bad:"😞"};
  function openDay(ds){setSelectedDay(ds);const e=journal[ds];setDraftNote(e?.note||"");setDraftPnl(e?.pnl!==undefined?String(e.pnl):"");setDraftTrades(e?.trades!==undefined?String(e.trades):"");setDraftMood(e?.mood||"good");setEditMode(!e);}
  function saveDay(){if(!selectedDay)return;setJournal(p=>({...p,[selectedDay]:{pnl:parseFloat(draftPnl)||0,trades:parseInt(draftTrades)||0,note:draftNote,mood:draftMood}}));setEditMode(false);}
  function deleteDay(){setJournal(p=>{const n={...p};delete n[selectedDay];return n;});setSelectedDay(null);}
  if(selectedDay){
    const entry=journal[selectedDay];const isToday=selectedDay===today;const displayDate=new Date(selectedDay+"T12:00:00").toLocaleDateString("default",{weekday:"long",month:"long",day:"numeric"});
    return(<div className="fade-up"><div style={{padding:"12px 16px",borderBottom:`1px solid ${G.g100}`,display:"flex",alignItems:"center",gap:10}}><button onClick={()=>{setSelectedDay(null);setEditMode(false);}} style={{background:G.g100,border:"none",borderRadius:"50%",width:32,height:32,cursor:"pointer",fontSize:16,color:G.g600,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button><div style={{flex:1}}><div style={{fontSize:15,fontWeight:800,color:G.black}}>{displayDate}</div>{isToday&&<div style={{fontSize:11,color:G.green,fontWeight:700}}>Today</div>}</div>{entry&&!editMode&&<button onClick={()=>setEditMode(true)} style={{background:"none",border:"none",color:G.green,cursor:"pointer",fontSize:13,fontWeight:700}}>Edit</button>}</div>
    <div style={{padding:"16px 18px"}}>
      {editMode?(<><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Input label="Day PnL ($)" value={draftPnl} onChange={e=>setDraftPnl(e.target.value)} placeholder="+240 or -150"/><Input label="# Trades" value={draftTrades} onChange={e=>setDraftTrades(e.target.value)} placeholder="3"/></div>
        <div style={{marginBottom:14}}><div style={{fontSize:12,fontWeight:700,color:G.g600,marginBottom:8}}>How did it feel?</div><div style={{display:"flex",gap:6}}>{Object.entries(moodEmoji).map(([m,e])=>(<button key={m} onClick={()=>setDraftMood(m)} style={{flex:1,padding:"9px 4px",borderRadius:12,border:`1.5px solid ${draftMood===m?G.green:G.g200}`,background:draftMood===m?G.greenLight:G.white,cursor:"pointer",textAlign:"center"}}><div style={{fontSize:20}}>{e}</div><div style={{fontSize:10,fontWeight:600,color:draftMood===m?G.greenDark:G.g500,marginTop:2}}>{m}</div></button>))}</div></div>
        <Input label="Journal entry" value={draftNote} onChange={e=>setDraftNote(e.target.value)} placeholder="What happened? What will you do differently?" multiline rows={5} hint="Private — only you can see this"/>
        <Btn full size="lg" onClick={saveDay}>Save entry</Btn>
        {entry&&<button onClick={deleteDay} style={{width:"100%",marginTop:10,background:"none",border:"none",color:G.red,cursor:"pointer",fontSize:13,fontWeight:600,padding:"8px 0"}}>Delete entry</button>}</>)
      :entry?(<><div style={{background:entry.pnl>=0?G.greenLight:"#FFF0EF",borderRadius:16,padding:18,marginBottom:14,border:`1px solid ${entry.pnl>=0?G.green+"30":G.red+"20"}`}}><div style={{display:"flex",justifyContent:"space-between"}}><div><div style={{fontSize:10,fontWeight:700,color:G.g400,marginBottom:3}}>NET PnL</div><div style={{fontSize:34,fontWeight:900,color:entry.pnl>=0?G.profit:G.loss,letterSpacing:"-0.04em"}}>{entry.pnl>=0?"+":"-"}${Math.abs(entry.pnl).toLocaleString()}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:28}}>{moodEmoji[entry.mood]}</div><div style={{fontSize:11,color:G.g400,marginTop:2}}>{entry.trades||0} trades</div></div></div></div>
        {entry.note&&<div style={{background:G.g50,borderRadius:14,padding:"13px 15px",marginBottom:14}}><div style={{fontSize:10,fontWeight:700,color:G.g400,marginBottom:7,letterSpacing:"0.05em"}}>JOURNAL</div><p style={{fontSize:14,color:G.black,lineHeight:1.75}}>{entry.note}</p></div>}
        <Btn variant="ghost" full onClick={()=>setEditMode(true)}>Edit entry</Btn></>)
      :(<EmptyState emoji="📝" title="No entry" subtitle="Log your PnL and write a reflection." action={()=>setEditMode(true)} actionLabel="Add entry"/>)}
    </div></div>);
  }
  return(<div>
    <div style={{padding:"16px 16px 0"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}><h1 style={{fontSize:22,fontWeight:900,color:G.black,letterSpacing:"-0.03em"}}>Journal</h1><button onClick={()=>openDay(today)} style={{background:G.green,border:"none",borderRadius:20,padding:"8px 16px",fontSize:13,fontWeight:700,color:G.black,cursor:"pointer",boxShadow:`0 4px 12px ${G.green}50`}}>+ Log today</button></div>
      <p style={{fontSize:12,color:G.g400,marginBottom:12}}>🔒 Private — only visible to you</p>
      <div style={{display:"flex",borderBottom:`1px solid ${G.g100}`,marginBottom:16}}>{[["calendar","📅 Calendar"],["weekly","📊 Weekly"],["stats","⚡ Stats"]].map(([t,l])=>(<button key={t} onClick={()=>setLogTab(t)} style={{padding:"10px 12px",background:"none",border:"none",borderBottom:`2.5px solid ${logTab===t?G.green:"transparent"}`,fontSize:13,fontWeight:logTab===t?800:500,color:logTab===t?G.black:G.g400,cursor:"pointer",whiteSpace:"nowrap"}}>{l}</button>))}</div>
    </div>
    {logTab==="calendar"&&(<div style={{padding:"0 16px 24px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}><button onClick={()=>{const d=new Date(calMonth);d.setMonth(d.getMonth()-1);setCalMonth(d);}} style={{background:G.g100,border:"none",borderRadius:"50%",width:32,height:32,cursor:"pointer",fontSize:17,color:G.g600,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button><span style={{fontSize:15,fontWeight:800,color:G.black}}>{monthName}</span><button onClick={()=>{const d=new Date(calMonth);d.setMonth(d.getMonth()+1);setCalMonth(d);}} style={{background:G.g100,border:"none",borderRadius:"50%",width:32,height:32,cursor:"pointer",fontSize:17,color:G.g600,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:2}}>{["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=>(<div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:G.g400,padding:"3px 0"}}>{d}</div>))}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
        {Array.from({length:daysInMonth}).map((_,i)=>{const day=i+1;const ds=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;const entry=journal[ds];const isToday=ds===today;const isFuture=ds>today;const hasEntry=!!entry;
          return(<button key={day} onClick={()=>!isFuture&&openDay(ds)} style={{aspectRatio:"1",borderRadius:9,border:isToday?`2px solid ${G.green}`:"2px solid transparent",background:hasEntry?dayColor(entry?.pnl):G.g50,cursor:isFuture?"default":"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:2,opacity:isFuture?0.25:1,transition:"transform 0.12s"}} onMouseEnter={e=>{if(!isFuture)e.currentTarget.style.transform="scale(1.08)";}} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
            <span style={{fontSize:11,fontWeight:isToday?900:600,color:hasEntry?dayTxt(entry?.pnl):isToday?G.green:G.g500}}>{day}</span>
            {hasEntry&&<span style={{fontFamily:"'DM Mono'",fontSize:8,color:dayTxt(entry.pnl),lineHeight:1,marginTop:1}}>{Math.abs(entry.pnl)>=1000?(entry.pnl/1000).toFixed(1)+"k":entry.pnl>0?"+"+entry.pnl:entry.pnl}</span>}
          </button>);})}
      </div>
      <div style={{display:"flex",gap:8,marginTop:12,justifyContent:"center"}}>{[["Win","#69F0AE"],["Big win","#00C853"],["Loss","#FF8A80"],["Big loss","#D50000"]].map(([l,c])=>(<div key={l} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:11,height:11,borderRadius:3,background:c}}/><span style={{fontSize:10,color:G.g500}}>{l}</span></div>))}</div>
    </div>)}
    {logTab==="weekly"&&(<div style={{padding:"0 16px 24px"}}>
      {(()=>{const wTotal=weeklyData.reduce((s,d)=>s+(d.pnl||0),0);const wG=wTotal>=0;return(<div style={{background:wG?G.greenLight:"#FFF0EF",borderRadius:16,padding:"14px 18px",marginBottom:16,border:`1px solid ${wG?G.green+"30":G.red+"20"}`}}><div style={{fontSize:10,fontWeight:700,color:G.g400,marginBottom:4}}>THIS WEEK</div><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}><div style={{fontSize:30,fontWeight:900,color:wG?G.profit:G.loss,letterSpacing:"-0.04em"}}>{wG?"+":"-"}${Math.abs(wTotal).toLocaleString(undefined,{maximumFractionDigits:0})}</div><div style={{textAlign:"right"}}><div style={{fontSize:11,color:G.g500}}>days traded</div><div style={{fontSize:20,fontWeight:900,color:G.black}}>{weeklyData.filter(d=>d.pnl!==null).length}</div></div></div></div>);})()}
      <div style={{display:"flex",alignItems:"flex-end",gap:8,height:120,paddingBottom:4,marginBottom:14}}>{weeklyData.map(d=>{const hasData=d.pnl!==null;const isPos=(d.pnl||0)>=0;const pct=hasData?Math.abs(d.pnl)/weeklyMax:0;const barH=Math.max(hasData?pct*100:0,hasData?5:3);return(<div key={d.date} onClick={()=>openDay(d.date)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",cursor:"pointer",gap:3}}>{hasData&&<div style={{fontFamily:"'DM Mono'",fontSize:9,color:isPos?G.profit:G.loss,fontWeight:600,whiteSpace:"nowrap"}}>{isPos?"+":""}{Math.abs(d.pnl)>=1000?(d.pnl/1000).toFixed(1)+"k":d.pnl}</div>}<div style={{width:"100%",height:barH,background:!hasData?G.g100:isPos?G.green:G.loss,borderRadius:"5px 5px 0 0",minHeight:3,opacity:hasData?1:0.4}}/><div style={{fontSize:11,fontWeight:600,color:G.g500}}>{d.label}</div></div>);})}</div>
      {weeklyData.filter(d=>d.pnl!==null).slice().reverse().map(d=>{const entry=journal[d.date];const isPos=(d.pnl||0)>=0;const dispDate=new Date(d.date+"T12:00:00").toLocaleDateString("default",{weekday:"long",month:"short",day:"numeric"});return(<div key={d.date} onClick={()=>openDay(d.date)} className="hov" style={{display:"flex",alignItems:"center",gap:11,padding:"11px 2px",borderBottom:`1px solid ${G.g50}`,cursor:"pointer",borderRadius:10}}><div style={{width:42,height:42,borderRadius:12,background:isPos?G.greenLight:"#FFF0EF",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:16,fontWeight:900,color:isPos?G.profit:G.loss}}>{isPos?"↑":"↓"}</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700,color:G.black,marginBottom:1}}>{dispDate}</div>{entry?.note&&<div style={{fontSize:11,color:G.g500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{entry.note}</div>}</div><div style={{textAlign:"right",flexShrink:0}}><div style={{fontFamily:"'DM Mono'",fontSize:14,fontWeight:600,color:isPos?G.profit:G.loss}}>{isPos?"+":"-"}${Math.abs(d.pnl).toLocaleString()}</div><div style={{fontSize:10,color:G.g400}}>{entry?.trades||0} trades</div></div></div>);})}
    </div>)}
    {logTab==="stats"&&(<div style={{padding:"0 16px 24px"}}>
      <div style={{background:totalPnl>=0?G.greenLight:"#FFF0EF",borderRadius:16,padding:18,marginBottom:12,border:`1px solid ${totalPnl>=0?G.green+"30":G.red+"20"}`}}><div style={{fontSize:10,fontWeight:700,color:G.g400,marginBottom:4}}>ALL-TIME LOGGED PnL</div><div style={{fontSize:36,fontWeight:900,color:totalPnl>=0?G.profit:G.loss,letterSpacing:"-0.04em"}}>{totalPnl>=0?"+":"-"}${Math.abs(totalPnl).toLocaleString(undefined,{maximumFractionDigits:0})}</div><div style={{fontSize:12,color:G.g500,marginTop:4}}>{tradingDays.length} days logged · {tradingDays.reduce((s,[,v])=>s+(v.trades||0),0)} total trades</div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>{[["📈","Win days",profitDays.length],["📉","Loss days",lossDays.length],["📊","Avg/day",tradingDays.length?"$"+Math.abs(totalPnl/tradingDays.length).toFixed(0):"-"]].map(([icon,label,val])=>(<div key={label} style={{background:G.g50,borderRadius:14,padding:14,border:`1px solid ${G.g100}`}}><div style={{fontSize:22,marginBottom:6}}>{icon}</div><div style={{fontSize:10,fontWeight:700,color:G.g400,marginBottom:2}}>{label.toUpperCase()}</div><div style={{fontSize:22,fontWeight:900,color:G.black}}>{val}</div></div>))}</div>
      {bestDay&&worstDay&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>{[{label:"BEST DAY",day:bestDay,color:G.profit,bg:G.greenLight},{label:"WORST DAY",day:worstDay,color:G.loss,bg:"#FFF0EF"}].map(({label,day,color,bg})=>(<div key={label} onClick={()=>openDay(day.date)} style={{background:bg,borderRadius:14,padding:14,cursor:"pointer",border:`1px solid ${color}20`}}><div style={{fontSize:10,fontWeight:700,color:G.g400,marginBottom:4}}>{label}</div><div style={{fontSize:20,fontWeight:900,color,letterSpacing:"-0.03em",marginBottom:2}}>{day.pnl>=0?"+":"-"}${Math.abs(day.pnl).toLocaleString()}</div><div style={{fontSize:11,color:G.g500}}>{new Date(day.date+"T12:00:00").toLocaleDateString("default",{month:"short",day:"numeric"})}</div></div>))}</div>}
      {tradingDays.length>0&&<div style={{background:G.g50,borderRadius:14,padding:14,border:`1px solid ${G.g100}`}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:13,fontWeight:700,color:G.black}}>Day win rate</span><span style={{fontSize:13,fontWeight:800,color:G.green}}>{Math.round((profitDays.length/tradingDays.length)*100)}%</span></div><div style={{height:8,borderRadius:4,background:G.g200,overflow:"hidden"}}><div style={{height:"100%",width:`${(profitDays.length/tradingDays.length)*100}%`,background:G.green,borderRadius:4}}/></div><div style={{display:"flex",justifyContent:"space-between",marginTop:5}}><span style={{fontSize:11,color:G.profit,fontWeight:600}}>{profitDays.length} green</span><span style={{fontSize:11,color:G.loss,fontWeight:600}}>{lossDays.length} red</span></div></div>}
    </div>)}
  </div>);
}

// ── Auth ───────────────────────────────────────────────────────────────────────
function AuthScreen({onAuth}){
  const [mode,setMode]=useState("landing");const [form,setForm]=useState({handle:"",email:"",password:"",confirm:"",category:"Futures"});const [error,setError]=useState(""),[ loading,setLoading]=useState(false);
  const f=(k,v)=>{setForm(p=>({...p,[k]:v}));setError("");};
  async function signup(){if(!form.handle.trim())return setError("Handle is required.");if(form.handle.length<3)return setError("At least 3 characters.");if(!/^[A-Z0-9_]+$/i.test(form.handle))return setError("Letters, numbers, underscores only.");if(!form.email.includes("@"))return setError("Enter a valid email.");if(form.password.length<6)return setError("Password must be 6+ characters.");if(form.password!==form.confirm)return setError("Passwords don't match.");setLoading(true);try{const data=await sbSignUp(form.email,form.password,form.handle.toUpperCase(),form.category);if(data.user){const profile=await getProfile(data.user.id);const u={id:data.user.id,name:form.handle.toUpperCase(),email:form.email,category:form.category,verified:false,supporter:false,traderScore:0,netReturn:"0.00",maxDrawdown:"0.0",winRate:"0.0",profitFactor:"—",tradeCount:0,equityCurve:[],followers:0,following:0,bio:"",isMe:true,isNew:true};onAuth(u);}else{setError("Check your email to confirm your account.");}}catch(e){setError(e.message||"Signup failed. Try again.");}setLoading(false);}
  async function login(){if(!form.email||!form.password)return setError("Fill in all fields.");setLoading(true);try{const data=await sbSignIn(form.email,form.password);if(data.user){const profile=await getProfile(data.user.id);if(profile){const u={id:data.user.id,name:profile.handle,email:profile.email,category:profile.category,verified:profile.verified,supporter:profile.supporter,traderScore:profile.trader_score,netReturn:String(profile.net_return),maxDrawdown:String(profile.max_drawdown),winRate:String(profile.win_rate),profitFactor:"—",tradeCount:profile.trade_count,equityCurve:[],followers:profile.followers,following:profile.following,bio:profile.bio||"",isMe:true};onAuth(u);}else{setError("Profile not found.");}}}catch(e){setError(e.message||"Login failed. Check your email and password.");}setLoading(false);}
  if(mode==="landing")return(<div style={{minHeight:"100vh",background:G.white,display:"flex",flexDirection:"column"}}>
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 24px",textAlign:"center"}}>
      <div className="fade-up" style={{marginBottom:32}}><div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:70,height:70,background:G.green,borderRadius:22,marginBottom:14,boxShadow:`0 12px 28px ${G.green}60`}}><span style={{fontSize:28,fontWeight:900,color:G.white,letterSpacing:"-0.04em"}}>tr</span></div><div style={{fontSize:26,fontWeight:900,color:G.black,letterSpacing:"-0.04em"}}>traderank</div></div>
      <h1 className="fade-up" style={{animationDelay:"80ms",fontSize:"clamp(28px,7vw,48px)",fontWeight:900,color:G.black,letterSpacing:"-0.04em",lineHeight:1.05,marginBottom:12,maxWidth:380}}>Your performance,<br/><span style={{color:G.green}}>verified.</span></h1>
      <p className="fade-up" style={{animationDelay:"160ms",fontSize:15,color:G.g500,lineHeight:1.65,marginBottom:32,maxWidth:290}}>Verified rankings. Real trade data. Buy and sell proven strategies.</p>
      <div className="fade-up" style={{animationDelay:"240ms",display:"flex",flexDirection:"column",gap:10,width:"100%",maxWidth:290}}>
        <Btn full size="lg" onClick={()=>setMode("signup")}>Create account — it's free</Btn>
        <button onClick={()=>setMode("login")} style={{width:"100%",padding:"14px",background:G.white,border:`1.5px solid ${G.g200}`,borderRadius:100,fontSize:15,fontWeight:700,color:G.black,cursor:"pointer"}}>Log in</button>
      </div>
      <button className="fade-up" style={{animationDelay:"320ms",marginTop:14,background:"none",border:"none",color:G.g400,cursor:"pointer",fontSize:13}} onClick={()=>onAuth({id:0,name:"GUEST",email:"",category:"Futures",verified:false,supporter:false,traderScore:0,netReturn:"0.00",maxDrawdown:"0.0",winRate:"0.0",profitFactor:"—",tradeCount:0,equityCurve:[],followers:0,following:0,bio:"",isGuest:true})}>Browse as guest</button>
    </div>
    <div style={{background:G.g50,borderTop:`1px solid ${G.g100}`,display:"flex",padding:"16px 0"}}>{[["1,200+","Traders"],["47K+","Trades"],["$12K+","Strategy sales"]].map(([n,l],i)=>(<div key={l} style={{flex:1,textAlign:"center",borderRight:i<2?`1px solid ${G.g200}`:"none"}}><div style={{fontSize:19,fontWeight:900,color:G.black,letterSpacing:"-0.03em"}}>{n}</div><div style={{fontSize:11,fontWeight:500,color:G.g400,marginTop:1}}>{l}</div></div>))}</div>
  </div>);
  const isSignup=mode==="signup";
  return(<div style={{minHeight:"100vh",background:G.white,maxWidth:400,margin:"0 auto",padding:"24px 20px"}}>
    <button onClick={()=>setMode("landing")} style={{background:"none",border:"none",color:G.g600,cursor:"pointer",fontSize:14,fontWeight:600,marginBottom:26,padding:0}}>← Back</button>
    <div style={{marginBottom:22}}><div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:40,height:40,background:G.green,borderRadius:12,marginBottom:11,boxShadow:`0 6px 16px ${G.green}50`}}><span style={{fontSize:16,fontWeight:900,color:G.white,letterSpacing:"-0.04em"}}>tr</span></div><h1 style={{fontSize:24,fontWeight:900,color:G.black,letterSpacing:"-0.03em"}}>{isSignup?"Create your account":"Welcome back"}</h1>{isSignup&&<p style={{fontSize:12,color:G.g500,marginTop:3}}>Free forever. No credit card needed.</p>}</div>
    {isSignup&&<Input label="Trader handle" value={form.handle} onChange={e=>f("handle",e.target.value)} placeholder="e.g. VOID_X" maxLength={20} hint="Your public identity on TradeRank"/>}
    <Input label={isSignup?"Email":"Email or trader handle"} type={isSignup?"email":"text"} value={form.email} onChange={e=>f("email",e.target.value)} placeholder={isSignup?"you@email.com":"your email or handle"}/>
    <Input label="Password" type="password" value={form.password} onChange={e=>f("password",e.target.value)} placeholder={isSignup?"Min. 6 characters":"••••••••"}/>
    {isSignup&&<Input label="Confirm password" type="password" value={form.confirm} onChange={e=>f("confirm",e.target.value)} placeholder="Repeat password"/>}
    {isSignup&&(<div style={{marginBottom:14}}><div style={{fontSize:12,fontWeight:700,color:G.g600,marginBottom:7}}>Primary market</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{["Futures","Prop","Forex","Crypto","Stocks"].map(c=>(<button key={c} onClick={()=>f("category",c)} style={{padding:"7px 13px",borderRadius:20,border:`1.5px solid ${form.category===c?G.green:G.g200}`,fontSize:12,fontWeight:600,cursor:"pointer",background:form.category===c?G.greenLight:G.white,color:form.category===c?G.greenDark:G.g600}}>{c}</button>))}</div></div>)}
    {error&&<div style={{background:"#FFF0EF",borderRadius:12,padding:"11px 14px",fontSize:13,fontWeight:500,color:G.red,marginBottom:14}}>{error}</div>}
    <Btn full size="lg" disabled={loading} onClick={isSignup?signup:login}>{loading?"Just a sec…":isSignup?"Create account":"Log in"}</Btn>
    <div style={{textAlign:"center",marginTop:16,fontSize:13,color:G.g500}}>{isSignup?"Already have an account? ":"Don't have an account? "}<button onClick={()=>{setMode(isSignup?"login":"signup");setError("");}} style={{background:"none",border:"none",color:G.green,cursor:"pointer",fontSize:13,fontWeight:700,padding:0}}>{isSignup?"Log in":"Sign up free"}</button></div>
  </div>);
}


// ── Prop firm parsers ──────────────────────────────────────────────────────────
const PROP_FIRMS={
  ftmo:{name:"FTMO",color:"#1A1A2E",accent:"#E94560",logo:"🏆",hint:"FTMO Dashboard → My Account → Trading History → Export CSV",detect:row=>row.ticket&&row["open time"]&&row.profit!==undefined},
  apex:{name:"Apex Trader Funding",color:"#0D0D0D",accent:"#FF6B00",logo:"⚡",hint:"Tradovate → Activity → Performance → Export. Or your Apex dashboard under Trade History.",detect:row=>row.tradedate&&(row.realizedpl!==undefined||row.realizedpnl!==undefined)},
  topstep:{name:"Topstep",color:"#003087",accent:"#00A3E0",logo:"📈",hint:"TopstepX → History → Trade History → Download CSV",detect:row=>row.contracts&&row.entry&&(row.pnl!==undefined||row.pl!==undefined)},
  mff:{name:"MyFundedFutures",color:"#1B1B2F",accent:"#7B2FBE",logo:"🚀",hint:"Dashboard → Trading History → Export to CSV",detect:row=>row.instrument&&row.direction&&(row["profit/loss"]!==undefined||row.pnl!==undefined)},
  tradovate:{name:"Tradovate",color:"#1C1C28",accent:"#4A90D9",logo:"🔷",hint:"Activity → Performance → All Trades → Export CSV",detect:row=>(row["buy/sell"]||row.buysell)&&row.symbol&&(row.pnl!==undefined||row["realized p&l"]!==undefined)},
  tradestation:{name:"TradeStation",color:"#00205B",accent:"#0072CE",logo:"📊",hint:"Reports → Trade Activity → Export",detect:row=>row["entry date"]&&row["entry price"]&&row["exit price"]},
  csv:{name:"Generic CSV",color:"#1C1C1C",accent:"#00E676",logo:"📁",hint:"Any CSV with a date, symbol, and pnl/profit/pl column.",detect:()=>true},
};
const detectFirm=rows=>{if(!rows.length)return"csv";for(const[key,firm]of Object.entries(PROP_FIRMS)){if(key!=="csv"&&firm.detect(rows[0]))return key;}return"csv";};
const parsePropFirmCSV=(text)=>{const rows=parseCSV(text);if(!rows.length)return null;const pnlKey=["pnl","profit","pl","realizedpl","realizedpnl","profit/loss","realized p&l"].find(k=>rows[0][k]!==undefined);if(!pnlKey)return null;return rows.map(r=>({...r,pnl:parseFloat(r[pnlKey])||0})).filter(r=>!isNaN(r.pnl));};

// ── PropVerifyView ─────────────────────────────────────────────────────────────
function PropVerifyView({currentUser,uploadState,setUploadState,myMetrics,setMyMetrics,myCategory,setMyCategory,submitVerification,onDonate,isGuest,onSignup}){
  const [step,setStep]=useState("choose");
  const [selectedFirm,setSelectedFirm]=useState(null);
  const [detectedFirm,setDetectedFirm]=useState(null);
  const [parsedRows,setParsedRows]=useState([]);
  const [dragOver,setDragOver]=useState(false);
  const [errMsg,setErrMsg]=useState("");
  const localRef=useRef();

  const FIRM_LIST=Object.entries(PROP_FIRMS).map(([k,v])=>({key:k,...v}));

  function processFile(file){
    if(!file)return;
    setStep("uploading");setUploadState("parsing");setErrMsg("");
    const r=new FileReader();
    r.onload=e=>{
      try{
        const rows=parseCSV(e.target.result);
        if(!rows.length)throw new Error("empty");
        const firm=detectFirm(rows);
        setDetectedFirm(firm);
        const trades=parsePropFirmCSV(e.target.result);
        if(!trades||!trades.length)throw new Error("nopnl");
        setParsedRows(trades);
        const m=calcMetrics(trades);
        if(!m)throw new Error("metrics");
        setMyMetrics(m);
        setUploadState("done");
        setStep("result");
      }catch(err){
        setUploadState("error");
        setErrMsg("Couldn't read this file. Make sure you exported from the correct place.");
        setStep(selectedFirm?"instructions":"choose");
      }
    };
    r.readAsText(file);
  }

  if(isGuest)return(<div style={{padding:20}}><EmptyState emoji="🔒" title="Create an account first" subtitle="Verification ties your score to your identity." action={onSignup} actionLabel="Sign up free"/></div>);

  // Result screen
  if(step==="result"&&myMetrics){
    const firm=PROP_FIRMS[detectedFirm||"csv"];const tier=getTier(myMetrics.traderScore);
    return(<div className="fade-up" style={{padding:18}}>
      <div style={{background:firm.color,borderRadius:16,padding:"14px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:11}}>
        <div style={{width:44,height:44,borderRadius:13,background:firm.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{firm.logo}</div>
        <div style={{flex:1}}><div style={{fontSize:10,fontWeight:700,color:"#ffffff70",marginBottom:1}}>STATEMENT DETECTED</div><div style={{fontSize:15,fontWeight:800,color:"#fff"}}>{firm.name}</div><div style={{fontSize:11,color:"#ffffff60"}}>{parsedRows.length} trades analyzed</div></div>
        <div style={{background:"#00E67625",borderRadius:20,padding:"4px 12px"}}><span style={{fontSize:11,fontWeight:700,color:G.green}}>✓ Verified</span></div>
      </div>
      <div style={{background:"linear-gradient(135deg,#0A0A0A,#1a1a1a)",borderRadius:20,padding:20,marginBottom:14}}>
        <div style={{fontSize:10,fontWeight:700,color:G.g400,marginBottom:12,letterSpacing:"0.06em"}}>YOUR TRADERSCORE</div>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
          <div style={{width:72,height:72,borderRadius:"50%",background:`conic-gradient(${tier.color} ${myMetrics.traderScore*3.6}deg,#2a2a2a 0deg)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:`0 0 0 4px #0A0A0A,0 0 0 6px ${tier.color}40`}}>
            <div style={{width:56,height:56,borderRadius:"50%",background:"#0A0A0A",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:20,fontWeight:900,color:tier.color,lineHeight:1}}>{myMetrics.traderScore}</span><span style={{fontSize:9,fontWeight:700,color:tier.color,opacity:.8}}>{tier.name}</span></div>
          </div>
          <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
            {[["WIN RATE",myMetrics.winRate+"%",parseFloat(myMetrics.winRate)>50?G.profit:G.loss],["MAX DD",myMetrics.maxDrawdown+"%",parseFloat(myMetrics.maxDrawdown)<10?G.profit:G.loss],["PROF. FACTOR",myMetrics.profitFactor,G.white],["TRADES",myMetrics.tradeCount,G.white]].map(([k,v,c])=>(
              <div key={k} style={{background:"#ffffff08",borderRadius:10,padding:"8px 10px"}}><div style={{fontSize:8,fontWeight:700,color:G.g400,marginBottom:2}}>{k}</div><div style={{fontFamily:"'DM Mono'",fontSize:13,fontWeight:600,color:c}}>{v}</div></div>
            ))}
          </div>
        </div>
        {myMetrics.equityCurve?.length>2&&(()=>{
          const d=myMetrics.equityCurve;const mn=Math.min(...d),mx=Math.max(...d),rng=mx-mn||1,w=400,h=44;
          const pts=d.map((v,i)=>`${(i/(d.length-1))*w},${h-((v-mn)/rng)*h}`).join(" ");
          const isGreen=d[d.length-1]>=d[0];
          return(<div style={{borderRadius:10,overflow:"hidden",background:"#ffffff06",padding:"10px 0 0"}}><div style={{fontSize:9,fontWeight:700,color:G.g400,paddingLeft:12,marginBottom:4,letterSpacing:"0.05em"}}>EQUITY CURVE</div><svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{width:"100%",height:h,display:"block"}}><polyline points={pts} fill="none" stroke={isGreen?G.green:G.red} strokeWidth="2.5" strokeLinejoin="round"/></svg></div>);
        })()}
        <div style={{marginTop:12,padding:"9px 12px",background:"#00E67610",borderRadius:11,border:`1px solid ${G.green}25`}}><div style={{fontSize:11,color:G.green,fontWeight:600,lineHeight:1.5}}>✓ Results from {firm.name} — cannot be manually edited or faked</div></div>
      </div>
      <div style={{marginBottom:16}}><div style={{fontSize:12,fontWeight:700,color:G.g600,marginBottom:8}}>What do you primarily trade?</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{["Futures","Prop","Forex","Crypto","Stocks"].map(c=>(<button key={c} onClick={()=>setMyCategory(c)} style={{padding:"7px 14px",borderRadius:20,border:`1.5px solid ${myCategory===c?G.green:G.g200}`,background:myCategory===c?G.greenLight:G.white,fontSize:12,fontWeight:600,color:myCategory===c?G.greenDark:G.g600,cursor:"pointer"}}>{c}</button>))}</div></div>
      <Btn full size="lg" onClick={submitVerification} icon="✓">Claim my verified profile</Btn>
      <div style={{marginTop:10,textAlign:"center"}}><button onClick={()=>{setStep("choose");setUploadState("idle");setMyMetrics(null);}} style={{background:"none",border:"none",color:G.g400,cursor:"pointer",fontSize:12}}>Upload a different statement</button></div>
    </div>);
  }

  // Uploading / parsing
  if(step==="uploading"){
    return(<div style={{padding:"60px 32px",textAlign:"center"}}>
      <div style={{fontSize:52,marginBottom:16}}>{selectedFirm?PROP_FIRMS[selectedFirm]?.logo:"📊"}</div>
      <div style={{fontSize:16,fontWeight:800,color:G.black,marginBottom:8}}>Analyzing your statement…</div>
      <div style={{fontSize:13,color:G.g500,marginBottom:24}}>Reading trades, calculating metrics</div>
      <div style={{width:200,height:4,borderRadius:2,background:G.g100,margin:"0 auto 20px",overflow:"hidden"}}><div style={{height:"100%",background:G.green,borderRadius:2,width:"60%",transition:"width 1s ease"}}/></div>
      {uploadState==="error"&&<><div style={{background:"#FFF0EF",borderRadius:12,padding:"12px 16px",color:G.red,fontSize:13,marginBottom:14}}>{errMsg||"Error reading file. Try exporting again."}</div><Btn variant="ghost" onClick={()=>setStep(selectedFirm?"instructions":"choose")}>← Try again</Btn></>}
    </div>);
  }

  // Instructions for selected firm
  if(step==="instructions"&&selectedFirm){
    const firm=PROP_FIRMS[selectedFirm];
    const steps={
      ftmo:["Log in to your FTMO dashboard","Go to My Account → Trading History","Click 'Export CSV' top right","Upload that file below"],
      apex:["Open Tradovate (Apex trades live here)","Go to Activity → Performance tab","Select All Time date range","Click Export → upload here"],
      topstep:["Log in to TopstepX","Go to History → Trade History","Click Download CSV","Upload that file below"],
      mff:["Log in to MyFundedFutures","Go to Trading History","Click Export to CSV","Upload below"],
      tradovate:["Open Tradovate","Activity → Performance","All Trades → Export CSV","Upload below"],
      tradestation:["Open TradeStation","Reports → Trade Activity","Export CSV","Upload below"],
      csv:["Open your broker or platform","Find Trade History or Performance","Export or Download as CSV","Upload below — needs date, symbol, pnl columns"],
    };
    return(<div className="fade-up" style={{padding:18}}>
      <button onClick={()=>setStep("choose")} style={{background:"none",border:"none",color:G.g600,cursor:"pointer",fontSize:13,fontWeight:600,marginBottom:16,padding:0}}>← Back</button>
      <div style={{background:firm.color,borderRadius:18,padding:"18px 20px",marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:12}}>
          <div style={{width:48,height:48,borderRadius:14,background:firm.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{firm.logo}</div>
          <div><div style={{fontSize:18,fontWeight:900,color:"#fff",letterSpacing:"-0.02em"}}>{firm.name}</div><div style={{fontSize:12,color:"#ffffff55"}}>Statement verification</div></div>
        </div>
        <div style={{background:"#ffffff10",borderRadius:12,padding:"11px 14px"}}>
          <div style={{fontSize:10,fontWeight:700,color:"#ffffff60",marginBottom:5,letterSpacing:"0.05em"}}>EXPORT GUIDE</div>
          <div style={{fontSize:13,color:"#ffffffcc",lineHeight:1.65}}>{firm.hint}</div>
        </div>
      </div>
      <div style={{marginBottom:18}}><div style={{fontSize:12,fontWeight:700,color:G.g600,marginBottom:10,letterSpacing:"0.03em"}}>STEPS</div>
        {(steps[selectedFirm]||steps.csv).map((s,i)=>(
          <div key={i} style={{display:"flex",gap:11,marginBottom:10,alignItems:"flex-start"}}>
            <div style={{width:24,height:24,borderRadius:"50%",background:firm.accent,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:11,fontWeight:900,color:"#fff",marginTop:1}}>{i+1}</div>
            <div style={{fontSize:13,color:G.black,lineHeight:1.55,flex:1,paddingTop:3}}>{s}</div>
          </div>
        ))}
      </div>
      {errMsg&&<div style={{background:"#FFF0EF",borderRadius:12,padding:"10px 14px",color:G.red,fontSize:13,marginBottom:12}}>{errMsg}</div>}
      <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={e=>{e.preventDefault();setDragOver(false);processFile(e.dataTransfer.files[0]);}} onClick={()=>localRef.current?.click()} style={{border:`2px dashed ${dragOver?firm.accent:G.g200}`,borderRadius:16,padding:"28px 20px",textAlign:"center",cursor:"pointer",background:dragOver?"#00E67608":G.g50,marginBottom:14,transition:"all 0.2s"}}>
        <div style={{fontSize:32,marginBottom:8}}>📂</div>
        <div style={{fontSize:14,fontWeight:800,color:G.black,marginBottom:3}}>Drop your CSV here</div>
        <div style={{fontSize:12,color:G.g400}}>or tap to browse</div>
        <input ref={localRef} type="file" accept=".csv,.xlsx" style={{display:"none"}} onChange={e=>processFile(e.target.files[0])}/>
      </div>
      {["Your statement is private — only your score is shown publicly","We read trade data to calculate metrics — nothing stored raw","Official statements cannot be faked or edited"].map((t,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:7,background:G.g50,borderRadius:9,padding:"7px 11px",marginBottom:5}}><span style={{fontSize:13}}>🔒</span><span style={{fontSize:11,fontWeight:500,color:G.g500}}>{t}</span></div>))}
    </div>);
  }

  // Choose firm
  return(<div className="fade-up">
    <div style={{background:G.black,padding:"22px 20px 18px"}}>
      <div style={{fontSize:11,fontWeight:700,color:G.green,letterSpacing:"0.06em",marginBottom:6}}>VERIFICATION</div>
      <div style={{fontSize:22,fontWeight:900,color:G.white,letterSpacing:"-0.03em",lineHeight:1.2,marginBottom:6}}>Where do you trade?</div>
      <p style={{fontSize:13,color:"#aaa",lineHeight:1.55}}>Select your prop firm or broker — we'll walk you through exactly how to export your statement.</p>
    </div>
    <div style={{background:G.greenLight,padding:"10px 20px",borderBottom:`1px solid ${G.green}20`,display:"flex",gap:10,alignItems:"center"}}>
      <span>🔒</span><span style={{fontSize:12,color:G.greenDark,fontWeight:600}}>Statements are verified — results cannot be edited or faked</span>
    </div>
    <div style={{padding:"16px 16px 32px"}}>
      <div style={{fontSize:11,fontWeight:700,color:G.g400,marginBottom:10,letterSpacing:"0.05em"}}>PROP FIRMS</div>
      {FIRM_LIST.filter(f=>["ftmo","apex","topstep","mff"].includes(f.key)).map(firm=>(
        <button key={firm.key} onClick={()=>{setSelectedFirm(firm.key);setStep("instructions");}} style={{width:"100%",display:"flex",alignItems:"center",gap:13,padding:"14px 16px",marginBottom:9,borderRadius:16,border:`1.5px solid ${G.g100}`,background:G.white,cursor:"pointer",textAlign:"left",transition:"all 0.15s",boxShadow:"0 2px 8px #0000000a"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=firm.accent;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=G.g100;}}>
          <div style={{width:46,height:46,borderRadius:13,background:firm.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{firm.logo}</div>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:800,color:G.black,marginBottom:2}}>{firm.name}</div><div style={{fontSize:11,color:G.g500}}>Statement export supported ✓</div></div>
          <div style={{fontSize:20,color:G.g300}}>›</div>
        </button>
      ))}
      <div style={{fontSize:11,fontWeight:700,color:G.g400,marginBottom:10,marginTop:18,letterSpacing:"0.05em"}}>FUTURES BROKERS</div>
      {FIRM_LIST.filter(f=>["tradovate","tradestation"].includes(f.key)).map(firm=>(
        <button key={firm.key} onClick={()=>{setSelectedFirm(firm.key);setStep("instructions");}} style={{width:"100%",display:"flex",alignItems:"center",gap:13,padding:"14px 16px",marginBottom:9,borderRadius:16,border:`1.5px solid ${G.g100}`,background:G.white,cursor:"pointer",textAlign:"left",transition:"all 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=firm.accent;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=G.g100;}}>
          <div style={{width:46,height:46,borderRadius:13,background:firm.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{firm.logo}</div>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:800,color:G.black,marginBottom:2}}>{firm.name}</div><div style={{fontSize:11,color:G.g500}}>CSV export supported ✓</div></div>
          <div style={{fontSize:20,color:G.g300}}>›</div>
        </button>
      ))}
      <div style={{fontSize:11,fontWeight:700,color:G.g400,marginBottom:10,marginTop:18,letterSpacing:"0.05em"}}>COMING SOON</div>
      {[{name:"Rithmic",logo:"⚙️",note:"Powers Apex, Topstep backend"},{name:"NinjaTrader",logo:"🥷",note:"Direct integration in progress"},{name:"Interactive Brokers",logo:"🏛️",note:"API connection coming"}].map(f=>(
        <div key={f.name} style={{display:"flex",alignItems:"center",gap:13,padding:"12px 16px",marginBottom:8,borderRadius:14,border:`1.5px solid ${G.g100}`,background:G.g50,opacity:0.6}}>
          <div style={{width:40,height:40,borderRadius:11,background:G.g200,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{f.logo}</div>
          <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:G.g600}}>{f.name}</div><div style={{fontSize:11,color:G.g400}}>{f.note}</div></div>
          <span style={{fontSize:11,fontWeight:700,color:G.g400,background:G.g200,borderRadius:20,padding:"3px 9px"}}>Soon</span>
        </div>
      ))}
      <div style={{marginTop:18,borderTop:`1px solid ${G.g100}`,paddingTop:16}}>
        <div style={{fontSize:12,color:G.g500,textAlign:"center",marginBottom:10}}>Don't see your broker?</div>
        <button onClick={()=>{setSelectedFirm("csv");setStep("instructions");}} style={{width:"100%",display:"flex",alignItems:"center",gap:13,padding:"13px 16px",borderRadius:14,border:`1.5px dashed ${G.g200}`,background:G.white,cursor:"pointer",textAlign:"left"}}>
          <div style={{width:40,height:40,borderRadius:11,background:G.g100,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📁</div>
          <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:G.black}}>Upload any CSV</div><div style={{fontSize:11,color:G.g500}}>Needs date, symbol, and pnl columns</div></div>
          <div style={{fontSize:20,color:G.g300}}>›</div>
        </button>
      </div>
    </div>
  </div>);
}

// ── Main app ───────────────────────────────────────────────────────────────────
export default function TradeRank(){
  const [loggedIn,setLoggedIn]=useState(false);const [currentUser,setCurrentUser]=useState(null);const [view,setView]=useState("feed");const [prevView,setPrevView]=useState("feed");const [traders,setTraders]=useState(SEED_TRADERS);const [posts,setPosts]=useState(SEED_POSTS);const [selectedTrader,setSelectedTrader]=useState(null);const [showPost,setShowPost]=useState(false);const [showDonate,setShowDonate]=useState(false);const [showDMs,setShowDMs]=useState(false);const [dmOpenWith,setDmOpenWith]=useState(null);const [showCreateStrategy,setShowCreateStrategy]=useState(false);const [category,setCategory]=useState("All");const [following,setFollowing]=useState(new Set([1,3]));const [uploadState,setUploadState]=useState("idle");const [myMetrics,setMyMetrics]=useState(null);const [myCategory,setMyCategory]=useState("Futures");const [notifs,setNotifs]=useState(SEED_NOTIFS);const [showNotifs,setShowNotifs]=useState(false);const [feedTab,setFeedTab]=useState("all");const [searchQuery,setSearchQuery]=useState("");const [searchFocus,setSearchFocus]=useState(false);const fileRef=useRef();

  async function doAuth(u){
    setCurrentUser(u);setLoggedIn(true);
    if(!u.isGuest){
      // Load real traders from Supabase
      try{
        const profiles=await getAllProfiles();
        if(profiles.length>0){
          const mapped=profiles.map(p=>({id:p.id,name:p.handle,email:p.email,category:p.category,verified:p.verified,supporter:p.supporter,traderScore:p.trader_score,netReturn:String(p.net_return),maxDrawdown:String(p.max_drawdown),winRate:String(p.win_rate),profitFactor:"—",tradeCount:p.trade_count,equityCurve:[],followers:p.followers,following:p.following,bio:p.bio||""}));
          setTraders(mapped);
        }
        // Load real posts
        const realPosts=await getPosts();
        if(realPosts.length>0)setPosts(realPosts.map(p=>({...p,traderId:p.trader_id,liked:false,shared:false,comments:[]})));
        // Load following
        const followingIds=await getUserFollowing(u.id);
        if(followingIds.length>0)setFollowing(new Set(followingIds));
        // Load purchases
        const purchaseIds=await getUserPurchases(u.id);
        // Load strategies
        const realStrategies=await getStrategies();
        if(realStrategies.length>0)console.log("Loaded",realStrategies.length,"strategies");
      }catch(e){console.log("Using seed data",e);}
    }
    setView("feed");
  }
  function goProfile(t){if(!t)return;setPrevView(view);setSelectedTrader(t);setShowDMs(false);setView("profile");}
  function openDMs(trader){setDmOpenWith(trader||null);setShowDMs(true);}
  function markAllRead(){setNotifs(p=>p.map(n=>({...n,read:true})));}
  function handleLike(id){setPosts(p=>p.map(x=>x.id===id?{...x,liked:!x.liked}:x));}
  function handleShare(id){setPosts(p=>p.map(x=>x.id===id?{...x,shared:!x.shared}:x));}
  function handleComment(id,txt){setPosts(p=>p.map(x=>x.id===id?{...x,comments:[...x.comments,{id:Date.now(),author:currentUser?.name||"YOU",text:txt,ts:Date.now()}]}:x));}
  async function handlePost(data){
    const newPost={id:Date.now(),traderId:currentUser.id,ts:Date.now(),...data,likes:0,comments:[],shares:0,liked:false,shared:false};
    setPosts(p=>[newPost,...p]);
    setShowPost(false);
    // Save to Supabase
    try{
      await createPost({trader_id:currentUser.id,type:data.type,symbol:data.symbol||null,direction:data.direction||null,entry:data.entry||null,exit:data.exit||null,pnl:data.pnl||null,notes:data.notes||null,text:data.text||null,likes:0,shares:0});
    }catch(e){console.log("Post save error",e);}
  }
  async function handleFollow(tid){
    setFollowing(p=>{const n=new Set(p);n.has(tid)?n.delete(tid):n.add(tid);return n;});
    try{
      const isNowFollowing=!following.has(tid);
      if(isNowFollowing){await followTrader(currentUser.id,tid);}
      else{await unfollowTrader(currentUser.id,tid);}
    }catch(e){console.log("Follow error",e);}
  }
  function handleDonationSuccess(){setCurrentUser(p=>({...p,supporter:true}));setTraders(p=>p.map(t=>t.id===currentUser.id?{...t,supporter:true}:t));}
  function handleCSV(file){if(!file)return;setUploadState("parsing");const r=new FileReader();r.onload=e=>{try{const rows=parseCSV(e.target.result);if(!rows.length)throw 0;const m=calcMetrics(rows);if(!m)throw 0;setMyMetrics(m);setUploadState("done");}catch{setUploadState("error");}};r.readAsText(file);}
  function submitVerification(){if(!myMetrics||!currentUser)return;const updated={...currentUser,...myMetrics,verified:true,category:myCategory,isMe:true};setCurrentUser(updated);setTraders(p=>{const ex=p.find(t=>t.id===currentUser.id);return ex?p.map(t=>t.id===currentUser.id?updated:t):[...p,updated];});setSelectedTrader(updated);setView("profile");}

  if(!loggedIn)return <AuthScreen onAuth={doAuth}/>;
  if(showDMs)return(<div style={{minHeight:"100vh",background:G.white,maxWidth:480,margin:"0 auto"}}><DMScreen traders={traders} onBack={()=>{setShowDMs(false);setDmOpenWith(null);}} openWithTrader={dmOpenWith}/></div>);

  const CATS=["All","Futures","Prop","Forex","Crypto","Stocks"];const sorted=[...traders].sort((a,b)=>b.traderScore-a.traderScore);const filtered=sorted.filter(t=>category==="All"||t.category===category);const unread=notifs.filter(n=>!n.read).length;const searchResults=searchQuery.trim().length>1?traders.filter(t=>t.name.toLowerCase().includes(searchQuery.toLowerCase())):[];const allFeedPosts=posts.map(p=>({...p,trader:traders.find(t=>t.id===p.traderId)||currentUser})).filter(p=>p.trader);const feedPosts=feedTab==="following"?allFeedPosts.filter(p=>following.has(p.traderId)):allFeedPosts;const isNewUser=currentUser?.isNew&&!currentUser?.verified&&!currentUser?.isGuest;

  const NAV=[{v:"feed",icon:"🏠",l:"Home"},{v:"leaderboard",icon:"📊",l:"Ranks"},{v:"POST",icon:"+",l:"",isPost:true},{v:"strategies",icon:"💡",l:"Strategy"},{v:"journal",icon:"📓",l:"Journal"},{v:"discover",icon:"🔍",l:"Discover"}];

  return(<div style={{minHeight:"100vh",background:G.white,maxWidth:480,margin:"0 auto",position:"relative",fontSize:14}}>
    {showPost&&<PostComposer onClose={()=>setShowPost(false)} onSubmit={handlePost} isGuest={currentUser?.isGuest} currentUser={currentUser}/>}
    {showDonate&&<DonationModal onClose={()=>setShowDonate(false)} onSuccess={handleDonationSuccess}/>}
    {showNotifs&&<NotifPanel notifs={notifs} onClose={()=>setShowNotifs(false)} onMarkAll={markAllRead}/>}
    {showCreateStrategy&&<CreateStrategyModal onClose={()=>setShowCreateStrategy(false)} onSubmit={()=>{}}/>}

    {/* Header */}
    <header style={{position:"sticky",top:0,zIndex:200,background:"rgba(255,255,255,0.96)",backdropFilter:"blur(10px)",borderBottom:`1px solid ${G.g100}`,padding:"0 16px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      {view==="profile"?<button onClick={()=>setView(prevView)} style={{background:"none",border:"none",cursor:"pointer",fontWeight:700,fontSize:14,color:G.g700,padding:0}}>← Back</button>:<div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:26,height:26,background:G.green,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 3px 8px ${G.green}50`}}><span style={{fontSize:10,fontWeight:900,color:G.white,letterSpacing:"-0.04em"}}>tr</span></div><span style={{fontSize:17,fontWeight:900,color:G.black,letterSpacing:"-0.04em"}}>traderank</span></div>}
      <div style={{display:"flex",alignItems:"center",gap:5}}>
        {view!=="profile"&&<>
          <button onClick={()=>setShowNotifs(!showNotifs)} style={{position:"relative",background:"none",border:"none",cursor:"pointer",padding:6,borderRadius:8}}><span style={{fontSize:18}}>🔔</span>{unread>0&&<div style={{position:"absolute",top:2,right:2,width:14,height:14,borderRadius:"50%",background:G.red,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:"#fff",border:`2px solid ${G.white}`}}>{unread}</div>}</button>
          <button onClick={()=>openDMs(null)} style={{background:"none",border:"none",cursor:"pointer",padding:6,fontSize:18,borderRadius:8}}>💬</button>
        </>}
        <div onClick={()=>goProfile(currentUser)} style={{cursor:"pointer",marginLeft:2}}><Avatar name={currentUser?.name||"G"} size={30} verified={currentUser?.verified} supporter={currentUser?.supporter}/></div>
      </div>
    </header>

    {view==="discover"&&(<div style={{padding:"9px 16px",borderBottom:`1px solid ${G.g100}`,position:"relative"}}>
      <div style={{position:"relative"}}><span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:G.g400}}>⌕</span><input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} onFocus={()=>setSearchFocus(true)} onBlur={()=>setTimeout(()=>setSearchFocus(false),150)} placeholder="Search traders..." style={{width:"100%",padding:"9px 14px 9px 33px",background:G.g100,border:"none",borderRadius:12,fontSize:13,outline:"none",color:G.black,boxSizing:"border-box"}}/></div>
      {searchFocus&&searchQuery.trim().length>1&&(<div className="fade-in" style={{position:"absolute",left:16,right:16,top:"calc(100% + 4px)",background:G.white,borderRadius:14,boxShadow:"0 8px 28px #00000018",border:`1px solid ${G.g100}`,zIndex:300,overflow:"hidden"}}>
        {searchResults.length===0?<div style={{padding:"16px",fontSize:13,color:G.g400,textAlign:"center"}}>No traders found</div>
          :searchResults.slice(0,5).map(t=>(<div key={t.id} onClick={()=>{goProfile(t);setSearchQuery("");}} className="hov" style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${G.g50}`}}><Avatar name={t.name} size={32} verified={t.verified} supporter={t.supporter}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:G.black}}>{t.name.toLowerCase()}</div><div style={{fontSize:11,color:G.g400}}>{t.category}</div></div><ScorePill score={t.traderScore}/></div>))}
      </div>)}
    </div>)}

    <div style={{paddingBottom:80}}>
      {/* FEED */}
      {view==="feed"&&(<>
        {isNewUser&&<VerifyBanner onVerify={()=>setView("verify")}/>}
        <div style={{display:"flex",borderBottom:`1px solid ${G.g100}`}}>{[["all","For you"],["following","Following"]].map(([tab,label])=>(<button key={tab} onClick={()=>setFeedTab(tab)} style={{flex:1,padding:"12px 0",background:"none",border:"none",borderBottom:`2.5px solid ${feedTab===tab?G.green:"transparent"}`,fontSize:14,fontWeight:feedTab===tab?800:500,color:feedTab===tab?G.black:G.g400,cursor:"pointer"}}>{label}</button>))}</div>
        {feedTab==="all"&&<TrendingStrip posts={posts} traders={traders} onTraderClick={goProfile}/>}
        {feedTab==="following"&&following.size===0&&<EmptyState emoji="👥" title="Find traders to follow" subtitle="Follow verified traders to see their trades here." action={()=>setView("discover")} actionLabel="Discover traders"/>}
        {feedPosts.map((p,i)=><PostCard key={p.id} post={p} trader={p.trader} onLike={handleLike} onShare={handleShare} onComment={handleComment} onTraderClick={goProfile} animDelay={i*40}/>)}
      </>)}

      {/* LEADERBOARD */}
      {view==="leaderboard"&&(<div className="fade-up">
        <div style={{padding:"14px 16px 10px"}}><h1 style={{fontSize:22,fontWeight:900,color:G.black,letterSpacing:"-0.03em",marginBottom:10}}>Rankings</h1><div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>{CATS.map(c=>(<button key={c} onClick={()=>setCategory(c)} style={{flexShrink:0,padding:"5px 13px",borderRadius:20,border:`1.5px solid ${category===c?G.green:G.g200}`,background:category===c?G.green:G.white,fontSize:12,fontWeight:600,color:category===c?G.white:G.g600,cursor:"pointer",whiteSpace:"nowrap",boxShadow:category===c?`0 3px 8px ${G.green}40`:"none"}}>{c}</button>))}</div></div>
        {filtered.length>=3&&(()=>{const top=filtered.slice(0,3);const order=[top[1],top[0],top[2]];const heights=[84,116,68];const medals=["🥈","🥇","🥉"];return(<div style={{background:"linear-gradient(180deg,#F0FFF8,#fff)",padding:"22px 16px 8px",marginBottom:4}}><div style={{display:"flex",alignItems:"flex-end",gap:8}}>{order.map((t,i)=>{const isFirst=i===1;return(<div key={t.id} onClick={()=>goProfile(t)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer"}} className="press"><div style={{marginBottom:7,textAlign:"center",position:"relative"}}>{isFirst&&<div style={{position:"absolute",top:-15,left:"50%",transform:"translateX(-50%)",fontSize:17}}>👑</div>}<Avatar name={t.name} size={isFirst?54:42} verified={t.verified} supporter={t.supporter} pulse={isFirst}/><div style={{fontSize:isFirst?12:10,fontWeight:800,color:G.black,marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:80}}>{t.name.toLowerCase()}</div><div style={{marginTop:2}}><ScorePill score={t.traderScore}/></div></div><div style={{width:"100%",height:heights[i],background:isFirst?G.green:G.g100,borderRadius:"8px 8px 0 0",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",paddingTop:10,border:isFirst?`2px solid ${G.greenDark}`:`2px solid ${G.g200}`,borderBottom:"none",boxShadow:isFirst?`0 -4px 16px ${G.green}40`:"none"}}><span style={{fontSize:isFirst?20:16}}>{medals[i]}</span><span style={{fontSize:isFirst?13:10,fontWeight:900,color:isFirst?G.black:G.g500,marginTop:1}}>{["2nd","1st","3rd"][i]}</span></div></div>);})}
        </div></div>);})()}
        {filtered.slice(3).map((t,i)=>(<div key={t.id} onClick={()=>goProfile(t)} className="hov" style={{display:"flex",alignItems:"center",gap:11,padding:"11px 16px",borderBottom:`1px solid ${G.g50}`,cursor:"pointer"}}><div style={{width:24,textAlign:"center",fontSize:13,fontWeight:700,color:G.g400}}>{i+4}</div><Avatar name={t.name} size={38} verified={t.verified} supporter={t.supporter}/><div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:5,marginBottom:1}}><span style={{fontSize:13,fontWeight:700,color:G.black,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name.toLowerCase()}</span>{t.supporter&&<CheckBadge color={G.blue} size={11}/>}{t.verified&&!t.supporter&&<CheckBadge color={G.green} size={11}/>}{t.id===currentUser?.id&&<span style={{fontSize:9,fontWeight:700,color:G.green,background:G.greenLight,padding:"1px 6px",borderRadius:10}}>you</span>}</div><div style={{fontSize:10,color:G.g400}}>{t.category} · {t.winRate}% win</div></div><div style={{textAlign:"right"}}><ScorePill score={t.traderScore}/><div style={{fontFamily:"'DM Mono'",fontSize:10,color:parseFloat(t.netReturn)>=0?G.profit:G.loss,marginTop:2}}>{parseFloat(t.netReturn)>=0?"+":""}{parseFloat(t.netReturn).toFixed(0)}</div></div></div>))}
      </div>)}

      {/* STRATEGIES */}
      {view==="strategies"&&<StrategiesView traders={traders} currentUser={currentUser} onShowCreate={()=>setShowCreateStrategy(true)} onOpenDMs={openDMs}/>}

      {/* JOURNAL */}
      {view==="journal"&&<JournalView/>}

      {/* DISCOVER */}
      {view==="discover"&&(<div className="fade-up">
        <div style={{padding:"12px 16px 7px"}}><h1 style={{fontSize:20,fontWeight:900,color:G.black,letterSpacing:"-0.03em",marginBottom:2}}>Discover</h1><p style={{fontSize:11,color:G.g500}}>Find and follow verified traders</p></div>
        <div style={{display:"flex",gap:5,padding:"0 16px 9px",overflowX:"auto"}}>{CATS.map(c=>(<button key={c} onClick={()=>setCategory(c)} style={{flexShrink:0,padding:"5px 12px",borderRadius:20,border:`1.5px solid ${category===c?G.green:G.g200}`,background:category===c?G.green:G.white,fontSize:11,fontWeight:600,color:category===c?G.white:G.g600,cursor:"pointer",whiteSpace:"nowrap"}}>{c}</button>))}</div>
        {filtered.map((t,i)=>{const isF=following.has(t.id);const isMe=t.id===currentUser?.id;const badges=calcBadges(t,posts,traders);return(<div key={t.id} className="fade-up" style={{padding:"11px 16px",borderBottom:`1px solid ${G.g50}`,display:"flex",gap:10,animationDelay:`${i*30}ms`}}><div onClick={()=>goProfile(t)} style={{cursor:"pointer"}}><Avatar name={t.name} size={44} verified={t.verified} supporter={t.supporter}/></div><div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3}}><div onClick={()=>goProfile(t)} style={{cursor:"pointer"}}><div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:13,fontWeight:700,color:G.black}}>{t.name.toLowerCase()}</span>{t.supporter&&<CheckBadge color={G.blue} size={12}/>}{t.verified&&!t.supporter&&<CheckBadge color={G.green} size={12}/>}</div><div style={{fontSize:10,color:G.g400}}>{t.category} · {t.tradeCount} trades</div></div>{!isMe&&<button onClick={()=>handleFollow(t.id)} className="btn-press" style={{padding:"5px 13px",borderRadius:20,border:`1.5px solid ${isF?G.g200:G.green}`,background:isF?G.white:G.green,fontSize:12,fontWeight:700,color:isF?G.g600:G.black,cursor:"pointer",flexShrink:0,boxShadow:isF?"none":`0 3px 8px ${G.green}40`}}>{isF?"Following":"Follow"}</button>}</div><div style={{display:"flex",gap:6,marginBottom:4}}><ScorePill score={t.traderScore}/><span style={{fontFamily:"'DM Mono'",fontSize:10,color:parseFloat(t.netReturn)>=0?G.profit:G.loss}}>{parseFloat(t.netReturn)>=0?"+":""}{parseFloat(t.netReturn)} PnL</span></div>{badges.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{badges.slice(0,3).map(bid=>{const def=BADGE_DEFS.find(b=>b.id===bid);return def?<span key={bid} style={{display:"inline-flex",alignItems:"center",gap:3,background:G.g50,border:`1px solid ${G.g100}`,borderRadius:20,padding:"2px 7px",fontSize:9,fontWeight:600,color:G.g600}}>{def.icon} {def.label}</span>:null;})}</div>}</div></div>);})}
      </div>)}

      {/* VERIFY */}
      {view==="verify"&&<PropVerifyView currentUser={currentUser} uploadState={uploadState} setUploadState={setUploadState} myMetrics={myMetrics} setMyMetrics={setMyMetrics} myCategory={myCategory} setMyCategory={setMyCategory} fileRef={fileRef} handleCSV={handleCSV} submitVerification={submitVerification} onDonate={()=>setShowDonate(true)} isGuest={currentUser?.isGuest} onSignup={()=>{setLoggedIn(false);setCurrentUser(null);}}/>}

      {/* PROFILE */}
      {view==="profile"&&selectedTrader&&(()=>{
        const t=selectedTrader;const tier=getTier(t.traderScore);const rank=sorted.findIndex(x=>x.id===t.id)+1;const isF=following.has(t.id);const isMe=t.id===currentUser?.id;const tp=posts.filter(p=>p.traderId===t.id).map(p=>({...p,trader:t}));const badges=calcBadges(t,posts,traders);const green=parseFloat(t.netReturn)>=0;const sellerStrategies=SEED_STRATEGIES.filter(s=>s.sellerId===t.id);
        return(<div className="fade-up">
          <div style={{padding:"18px 16px 0"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}><Avatar name={t.name} size={68} verified={t.verified} supporter={t.supporter}/>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end",marginTop:4}}>
                {!isMe&&<button onClick={()=>handleFollow(t.id)} className="btn-press" style={{padding:"8px 18px",borderRadius:20,border:`1.5px solid ${isF?G.g200:G.green}`,background:isF?G.white:G.green,fontSize:13,fontWeight:700,color:isF?G.g700:G.black,cursor:"pointer",boxShadow:isF?"none":`0 4px 12px ${G.green}40`}}>{isF?"Following":"Follow"}</button>}
                {!isMe&&<button onClick={()=>openDMs(t)} className="btn-press" style={{padding:"8px 18px",borderRadius:20,border:`1.5px solid ${G.g200}`,background:G.white,fontSize:13,fontWeight:700,color:G.g700,cursor:"pointer"}}>Message</button>}
                {isMe&&!t.verified&&<Btn variant="outline" size="sm" onClick={()=>setView("verify")}>Get verified</Btn>}
                {isMe&&!t.supporter&&<Btn variant="blue" size="sm" onClick={()=>setShowDonate(true)}>Support ✓</Btn>}
              </div>
            </div>
            <div style={{marginBottom:12}}><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}><span style={{fontSize:19,fontWeight:900,color:G.black,letterSpacing:"-0.03em"}}>{t.name.toLowerCase()}</span>{t.supporter&&<CheckBadge color={G.blue} size={16}/>}{t.verified&&!t.supporter&&<CheckBadge color={G.green} size={16}/>}</div>{t.bio&&<p style={{fontSize:13,color:G.g600,lineHeight:1.6,marginBottom:4}}>{t.bio}</p>}<div style={{fontSize:12,color:G.g400}}>{t.category}{t.traderScore>0?` · Rank #${rank}`:""}</div></div>
            <div style={{display:"flex",borderTop:`1px solid ${G.g100}`,borderBottom:`1px solid ${G.g100}`,padding:"10px 0",marginBottom:14}}>{[["Posts",tp.length],["Followers",(t.followers||0).toLocaleString()],["Following",(t.following||0).toLocaleString()]].map(([k,v],i)=>(<div key={k} style={{flex:1,textAlign:"center",borderRight:i<2?`1px solid ${G.g100}`:"none"}}><div style={{fontSize:16,fontWeight:800,color:G.black}}>{v}</div><div style={{fontSize:10,color:G.g400,marginTop:1}}>{k}</div></div>))}</div>
            {t.traderScore>0?(<div style={{background:G.g50,borderRadius:16,padding:15,marginBottom:14,border:`1px solid ${G.g100}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:11}}><div><div style={{fontSize:9,fontWeight:700,color:G.g400,marginBottom:3,letterSpacing:"0.05em"}}>TRADERSCORE</div><div style={{display:"flex",alignItems:"baseline",gap:6}}><span style={{fontSize:32,fontWeight:900,color:tier.color,letterSpacing:"-0.04em"}}>{t.traderScore}</span><span style={{fontSize:13,fontWeight:700,color:tier.color}}>{tier.name}</span></div></div><div style={{textAlign:"right"}}><div style={{fontSize:9,fontWeight:700,color:G.g400,marginBottom:3,letterSpacing:"0.05em"}}>NET PnL</div><div style={{fontFamily:"'DM Mono'",fontSize:19,fontWeight:500,color:green?G.profit:G.loss}}>{green?"+":""}{parseFloat(t.netReturn).toFixed(0)}</div></div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:11}}>{[["WIN RATE",t.winRate+"%"],["MAX DD",t.maxDrawdown+"%"],["PROF. FACTOR",t.profitFactor]].map(([k,v])=>(<div key={k} style={{background:G.white,borderRadius:10,padding:"8px 10px",border:`1px solid ${G.g100}`}}><div style={{fontSize:8,fontWeight:700,color:G.g400,marginBottom:2}}>{k}</div><div style={{fontFamily:"'DM Mono'",fontSize:13,color:G.black}}>{v}</div></div>))}</div>{t.equityCurve?.length>1&&<EquityCurve data={t.equityCurve} color={green?G.profit:G.loss} height={66}/>}</div>)
            :(isMe&&<div style={{background:G.greenLight,border:`1.5px solid ${G.green}30`,borderRadius:16,padding:18,marginBottom:14,textAlign:"center"}}><div style={{fontSize:26,marginBottom:8}}>📊</div><div style={{fontSize:15,fontWeight:800,color:G.black,marginBottom:6}}>No score yet</div><p style={{fontSize:12,color:G.g600,lineHeight:1.6,marginBottom:14}}>Upload your trade history to get a TraderScore and unlock strategy sales.</p><Btn size="sm" onClick={()=>setView("verify")}>Verify my trades</Btn></div>)}
            {badges.length>0&&(<div style={{marginBottom:14}}><div style={{fontSize:10,fontWeight:700,color:G.g400,marginBottom:7,letterSpacing:"0.05em"}}>BADGES</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{badges.map(bid=>{const def=BADGE_DEFS.find(b=>b.id===bid);return def?<span key={bid} style={{display:"inline-flex",alignItems:"center",gap:3,background:G.g50,border:`1px solid ${G.g100}`,borderRadius:20,padding:"4px 10px",fontSize:11,fontWeight:600,color:G.g700}}>{def.icon} {def.label}</span>:null;})}</div></div>)}
            {sellerStrategies.length>0&&(<div style={{marginBottom:14}}><div style={{fontSize:10,fontWeight:700,color:G.g400,marginBottom:10,letterSpacing:"0.05em"}}>STRATEGIES FOR SALE</div>{sellerStrategies.map(s=>(<div key={s.id} onClick={()=>setView("strategies")} className="hov" style={{display:"flex",alignItems:"center",gap:11,padding:"10px 13px",borderRadius:13,background:G.g50,border:`1px solid ${G.g100}`,marginBottom:8,cursor:"pointer"}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700,color:G.black,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.title}</div><div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:11,fontWeight:600,color:G.g500}}>{s.market}</span><StarRating rating={s.rating} size={11}/><span style={{fontSize:11,color:G.g400}}>{s.sales} sold</span></div></div><div style={{fontFamily:"'DM Mono'",fontSize:16,fontWeight:700,color:G.green,flexShrink:0}}>${s.price}</div></div>))}{isMe&&<Btn size="sm" variant="ghost" onClick={()=>setShowCreateStrategy(true)} icon="＋">Add strategy</Btn>}</div>)}
          </div>
          <div style={{height:5,background:G.g50,borderTop:`1px solid ${G.g100}`,borderBottom:`1px solid ${G.g100}`}}/>
          <div style={{padding:"13px 16px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{fontSize:11,fontWeight:700,color:G.g400,letterSpacing:"0.04em"}}>TRADES & THOUGHTS</div>{tp.length>0&&<div style={{fontSize:11,color:G.g400}}>{tp.length} post{tp.length!==1?"s":""}</div>}</div>
          {tp.length>0?tp.map((p,i)=><PostCard key={p.id} post={p} trader={t} onLike={handleLike} onShare={handleShare} onComment={handleComment} onTraderClick={()=>{}} animDelay={i*40}/>):<EmptyState emoji="📝" title="No posts yet" subtitle={isMe?"Share your first trade or market thought.":"This trader hasn't posted yet."} action={isMe?()=>setShowPost(true):null} actionLabel="Post your first trade"/>}
        </div>);
      })()}
    </div>

    {/* Bottom nav */}
    <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"rgba(255,255,255,0.97)",backdropFilter:"blur(10px)",borderTop:`1px solid ${G.g100}`,display:"flex",alignItems:"center",zIndex:100,height:62}}>
      {NAV.map(({v,icon,l,isPost})=>(isPost
        ?<button key="post" onClick={()=>setShowPost(true)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"none",border:"none",cursor:"pointer",padding:0}}><div className="btn-press" style={{width:46,height:46,borderRadius:"50%",background:G.green,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 18px ${G.green}70`}}><span style={{fontSize:22,fontWeight:900,color:G.black,lineHeight:1,marginTop:-1}}>+</span></div></button>
        :<button key={v} onClick={()=>setView(v)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:1,padding:"8px 0 5px",background:"none",border:"none",cursor:"pointer"}}><span style={{fontSize:17,opacity:view===v?1:0.3,transition:"all 0.2s"}}>{icon}</span><span style={{fontSize:8,fontWeight:view===v?800:500,color:view===v?G.black:G.g400,transition:"all 0.2s"}}>{l}</span>{view===v&&<div style={{width:4,height:4,borderRadius:"50%",background:G.green}}/>}</button>
      ))}
    </nav>
    <button onClick={()=>{setLoggedIn(false);setCurrentUser(null);}} style={{position:"fixed",top:14,left:4,background:"none",border:"none",color:"#DDD",cursor:"pointer",fontSize:8,zIndex:300}}>out</button>
  </div>);
}
