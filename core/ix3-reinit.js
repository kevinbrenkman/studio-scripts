/*! ix3-reinit.js 1.0.0 (kevinbrenkman/studio-scripts/core)
 * Native Webflow interactions (IX3) keep working after a Swup swap. Load after core.js. Docs: docs/core.md */
(()=>{
// IX3Reinit 1.0.0
const W=window.Webflow;if(!W||!W.require)return;
const ix=W.require('ix3');if(!ix||!ix.getInstance)return;
let saved=null;const get=ix.getInstance.bind(ix);
ix.getInstance=()=>{const i=get();if(i&&!i._wrap){const r=i.register.bind(i);i.register=(...a)=>{if(!saved)saved=a;return r(...a)};i._wrap=1}return i};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const reinit=async()=>{
if(!saved)return;
try{ix.destroy()}catch(e){}
await ix.ready();let i=get();
for(let n=0;!i&&n<40;n++){await wait(50);i=get()}
if(!i)return;
i.setFeatures&&i.setFeatures({timelineGroups:false});
i.register(...saved);i._wrap=1;
window.ScrollTrigger&&ScrollTrigger.refresh();
};
const hook=()=>{if(!window.swup||window.swup._ix3)return;window.swup._ix3=1;swup.hooks.on('content:scroll',()=>{reinit()})};
hook();document.addEventListener('DOMContentLoaded',hook);
})();
