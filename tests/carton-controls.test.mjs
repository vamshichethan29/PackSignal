import test from 'node:test';
import assert from 'node:assert/strict';
import { mountArtworkControls } from '../public/artwork-ui.js';

// This harness executes the real controller against EventTargets. It does not
// emulate layout or pretend to verify the rendered 3D appearance.
class Element extends EventTarget {
  constructor() {
    super();
    this.dataset={};this.style={setProperty(name,value){this[name]=value;}};
    this.attributes=new Map();this.queries=new Map();this.lists=new Map();
    this.classes=new Set();this.isConnected=true;this.clientWidth=500;this.clientHeight=430;
    this.classList={add:name=>this.classes.add(name),remove:name=>this.classes.delete(name),toggle:(name,force)=>force?this.classes.add(name):this.classes.delete(name)};
  }
  querySelector(selector){return this.queries.get(selector)||null;}
  querySelectorAll(selector){return this.lists.get(selector)||[];}
  closest(selector){return this.closestMatches?.get(selector)||null;}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  getAttribute(name){return this.attributes.get(name)||null;}
  setPointerCapture(id){this.capture=id;}
  hasPointerCapture(id){return this.capture===id;}
  releasePointerCapture(){this.capture=null;}
  focus(){this.focused=true;}
}
function fire(node,type,values={}){
  const event=new Event(type,{bubbles:true,cancelable:true});
  for(const [key,value]of Object.entries(values))Object.defineProperty(event,key,{value});
  node.dispatchEvent(event);return event;
}
function setup(t,{angle=42,tilt=-13,reducedMotion=false}={}){
  const saved=new Map();
  const install=(key,value)=>{saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});};
  const win=new EventTarget(),doc=new EventTarget(),motion=new EventTarget(),callbacks=new Map();let nextFrame=0;
  doc.hidden=false;doc.getElementById=()=>null;motion.matches=reducedMotion;
  install('window',win);install('document',doc);install('matchMedia',()=>motion);install('ResizeObserver',undefined);
  install('requestAnimationFrame',callback=>{callbacks.set(++nextFrame,callback);return nextFrame;});
  install('cancelAnimationFrame',id=>callbacks.delete(id));
  const container=new Element(),scene=new Element(),stage=new Element(),model=new Element(),slider=new Element(),output=new Element(),play=new Element(),reset=new Element(),icon=new Element(),playLabel=new Element(),sliderLabel=new Element();
  const faces=Object.fromEntries(['front','right','back','left'].map(name=>{const button=new Element();button.dataset.cartonView=name;return[name,button];}));
  Object.assign(scene.dataset,{angle:String(angle),tilt:String(tilt),cartonWidth:'214',cartonHeight:'282',cartonDepth:'64'});
  container.queries.set('[data-carton-scene]',scene);scene.queries.set('[data-carton-model]',model);
  scene.closestMatches=new Map([['.carton-stage',stage]]);
  stage.queries.set('[data-carton-rotation]',slider);stage.queries.set('[data-carton-play]',play);stage.queries.set('[data-carton-reset]',reset);
  stage.lists.set('[data-carton-view]',Object.values(faces));
  slider.parentElement=sliderLabel;sliderLabel.queries.set('output',output);
  play.queries.set('[data-carton-play-icon]',icon);play.queries.set('[data-carton-play-label]',playLabel);
  const rotations=[];mountArtworkControls(container,{review:{},onRotation:(a,b)=>rotations.push([a,b])});
  t.after(()=>{
    mountArtworkControls(new Element(),{review:{}});
    for(const[key,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
  });
  return {scene,stage,model,slider,output,play,faces,reset,motion,win,doc,rotations,callbacks,
    frame(time){const batch=[...callbacks.values()];callbacks.clear();for(const callback of batch)callback(time);},
    drag(from,to){fire(scene,'pointerdown',{button:0,pointerId:1,clientX:from[0],clientY:from[1]});fire(scene,'pointermove',{pointerId:1,clientX:to[0],clientY:to[1]});fire(scene,'pointerup',{pointerId:1});},
  };
}

test('carton drag continues from the supplied pose and then from a slider adjustment',t=>{
  const h=setup(t,{angle:74,tilt:-13});
  h.drag([100,100],[100,100]);
  assert.deepEqual(h.rotations.at(-1),[74,-13]);
  h.slider.value='130';fire(h.slider,'input');
  h.drag([50,50],[70,50]);
  assert.deepEqual(h.rotations.at(-1),[140,-13]);
  assert.equal(h.output.textContent,'140°');
  assert.equal(h.scene.capture,null);
});

test('a completed face shortcut and subsequent drag share the same pose without jumping to the default',t=>{
  const h=setup(t);
  fire(h.faces.right,'click');
  h.frame(100);h.frame(340);
  assert.deepEqual(h.rotations.at(-1),[-90,-8]);
  assert.equal(h.faces.right.getAttribute('aria-pressed'),'true');
  h.drag([100,100],[140,100]);
  assert.deepEqual(h.rotations.at(-1),[-70,-8]);
  assert.equal(h.faces.right.getAttribute('aria-pressed'),'false');
});

test('turntable only runs after play and stops immediately when the user adjusts the carton',t=>{
  const h=setup(t);
  assert.equal(h.callbacks.size,0);
  fire(h.play,'click');
  assert.equal(h.play.getAttribute('aria-pressed'),'true');
  h.frame(100);h.frame(150);
  assert.ok(h.rotations.at(-1)[0]>42);
  h.slider.value='75';fire(h.slider,'input');
  assert.equal(h.callbacks.size,0);
  assert.equal(h.play.getAttribute('aria-pressed'),'false');
  assert.deepEqual(h.rotations.at(-1),[75,-13]);
  fire(h.play,'click');
  h.drag([0,0],[0,0]);
  assert.equal(h.callbacks.size,0);
  assert.equal(h.play.getAttribute('aria-pressed'),'false');
});

test('reduced motion disables the turntable but keeps direct keyboard and drag inspection',t=>{
  const h=setup(t,{reducedMotion:true});
  assert.equal(h.play.disabled,true);
  fire(h.play,'click');
  assert.equal(h.callbacks.size,0);
  const key=fire(h.scene,'keydown',{key:'ArrowRight',shiftKey:false});
  assert.equal(key.defaultPrevented,true);
  assert.deepEqual(h.rotations.at(-1),[52,-13]);
  h.drag([0,0],[20,0]);
  assert.deepEqual(h.rotations.at(-1),[62,-13]);
  assert.equal(h.model.style.transition,'none');
  h.motion.matches=false;fire(h.motion,'change');fire(h.play,'click');
  assert.equal(h.callbacks.size,1);
  h.motion.matches=true;fire(h.motion,'change');
  assert.equal(h.callbacks.size,0);
  assert.equal(h.play.disabled,true);
});

test('a hidden document or detached viewer stops the animation loop',t=>{
  const h=setup(t);
  fire(h.play,'click');h.doc.hidden=true;fire(h.doc,'visibilitychange');
  assert.equal(h.callbacks.size,0);
  h.doc.hidden=false;fire(h.play,'click');h.scene.isConnected=false;h.frame(100);
  assert.equal(h.callbacks.size,0);
});

test('carton sizing responds to the available scene and leaves room for tilted faces',t=>{
  const h=setup(t);
  h.scene.clientWidth=300;h.scene.clientHeight=340;fire(h.win,'resize');
  const narrow=Number(h.scene.style['--carton-fit']);
  assert.ok(narrow>0&&narrow<1);
  assert.ok(narrow*Math.hypot(214,282,64)<340-75);
  h.scene.clientWidth=800;h.scene.clientHeight=450;fire(h.win,'resize');
  assert.ok(Number(h.scene.style['--carton-fit'])>narrow);
});
