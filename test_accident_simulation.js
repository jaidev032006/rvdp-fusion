// Comprehensive simulation test for Accident & Multi-Ambulance Rescue System

const fs = require('fs');
const html = fs.readFileSync('public/rvdp_fusion_bus_simulator.html', 'utf8');
const scriptMatch = [...html.matchAll(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi)][1][1];

const domMap = {};
function getEl(id) {
  if (!domMap[id]) {
    domMap[id] = {
      id: id,
      style: {},
      classList: { add: ()=>{}, remove: ()=>{}, toggle: ()=>{} },
      addEventListener: ()=>{},
      appendChild: ()=>{},
      getContext: () => ({ fillRect: ()=>{}, clearRect: ()=>{}, beginPath: ()=>{}, arc: ()=>{}, fill: ()=>{}, stroke: ()=>{}, moveTo: ()=>{}, lineTo: ()=>{}, measureText: ()=>({width:10}), strokeText: ()=>{}, fillText: ()=>{} }),
      innerHTML: '',
      textContent: '',
      value: '',
      clientWidth: 800,
      clientHeight: 600,
      children: []
    };
  }
  return domMap[id];
}

global.window = global;
global.addEventListener = ()=>{};
global.removeEventListener = ()=>{};
global.innerWidth = 1024;
global.innerHeight = 768;
global.devicePixelRatio = 1;
global.localStorage = { getItem: ()=>'', setItem: ()=>{} };
global.location = { search: '', protocol: 'http:', host: 'localhost:3000' };
global.matchMedia = () => ({ matches: false, addEventListener: ()=>{} });
global.document = {
  getElementById: getEl,
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: (tag) => getEl(tag),
  createTextNode: (t) => ({ textContent: t }),
  head: { appendChild: ()=>{} },
  documentElement: { style: {} },
  body: { style: {}, appendChild: ()=>{}, insertAdjacentHTML: ()=>{} }
};
global.navigator = { userAgent: 'node' };
global.requestAnimationFrame = () => {};
global.Audio = function(){ this.play=()=>{}; this.pause=()=>{}; };
const fetchedCalls = [];
global.fetch = (url, opts) => {
  fetchedCalls.push({ url, body: opts && opts.body ? JSON.parse(opts.body) : null });
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, status: 'calling', sid: 'CA123' }) });
};

function GeomMock() {
  this.translate = ()=>{};
  this.rotateX = ()=>{};
  this.rotateY = ()=>{};
  this.rotateZ = ()=>{};
  this.setFromPoints = ()=>{};
  this.setAttribute = ()=>{};
  this.attributes = { position: { setXYZ: ()=>{}, needsUpdate: false } };
}

global.THREE = {
  Fog: function(){ this.color = { set: ()=>{}, setHex: ()=>{} }; },
  Scene: function(){ this.add=()=>{}; this.fog=new global.THREE.Fog(); this.background = { set: ()=>{}, setHex: ()=>{} }; },
  PerspectiveCamera: function(){ this.position={set:()=>{},copy:()=>{},clone:()=>({x:0,y:0,z:0})}; this.lookAt=()=>{}; this.aspect=1; this.updateProjectionMatrix=()=>{}; },
  WebGLRenderer: function(){ this.setSize=()=>{}; this.setPixelRatio=()=>{}; this.render=()=>{}; this.domElement={ addEventListener:()=>{} }; this.shadowMap={}; },
  Color: function(){ this.set=()=>{}; this.setHex=()=>{}; },
  Vector2: function(x=0,y=0){ this.x=x; this.y=y; },
  Vector3: function(x=0,y=0,z=0){
    this.x=x;this.y=y;this.z=z;
    this.set=(x,y,z)=>{this.x=x;this.y=y;this.z=z;return this;};
    this.copy=(v)=>{this.x=v.x;this.y=v.y;this.z=v.z;return this;};
    this.clone=()=>new global.THREE.Vector3(this.x,this.y,this.z);
    this.lerp=(v,a)=>{this.x+=(v.x-this.x)*a;this.y+=(v.y-this.y)*a;this.z+=(v.z-this.z)*a;return this;};
    this.lerpVectors=(v1,v2,a)=>{this.x=v1.x+(v2.x-v1.x)*a;this.y=v1.y+(v2.y-v1.y)*a;this.z=v1.z+(v2.z-v1.z)*a;return this;};
    this.sub=(v)=>{this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;};
    this.subVectors=(a,b)=>{this.x=a.x-b.x;this.y=a.y-b.y;this.z=a.z-b.z;return this;};
    this.add=(v)=>{this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;};
    this.multiplyScalar=(s)=>{this.x*=s;this.y*=s;this.z*=s;return this;};
    this.length=()=>Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z);
    this.distanceTo=(v)=>Math.sqrt((this.x-v.x)**2+(this.y-v.y)**2+(this.z-v.z)**2);
    this.normalize=()=>{const l=this.length()||1;this.x/=l;this.y/=l;this.z/=l;return this;};
    this.project=()=>this;
  },
  Raycaster: function(){ this.setFromCamera=()=>{}; this.intersectObjects=()=>[]; },
  Group: function(){
    this.add=function(c){if(c){if(c.parent&&c.parent.remove)c.parent.remove(c);c.parent=this;this.children.push(c);}};
    this.remove=function(c){const i=this.children.indexOf(c);if(i>=0)this.children.splice(i,1);if(c)c.parent=null;};
    this.position=new global.THREE.Vector3();
    this.rotation={set:()=>{},y:0,x:0,z:0};
    this.scale={x:1,y:1,z:1,set:function(x,y,z){this.x=x;this.y=y;this.z=z;},setScalar:function(s){this.x=s;this.y=s;this.z=s;return this;}};
    this.children=[];
    this.traverse=()=>{};
    this.userData={};
    this.localToWorld = function(v) {
      let cur = this;
      while (cur) {
        if (cur.position) {
          v.x += cur.position.x || 0;
          v.y += cur.position.y || 0;
          v.z += cur.position.z || 0;
        }
        cur = cur.parent;
      }
      return v;
    };
    this.getWorldPosition = function(target) {
      let cur = this;
      let wx = 0, wy = 0, wz = 0;
      while (cur) {
        if (cur.position) {
          wx += cur.position.x || 0;
          wy += cur.position.y || 0;
          wz += cur.position.z || 0;
        }
        cur = cur.parent;
      }
      if (target) { target.set(wx, wy, wz); return target; }
      return new global.THREE.Vector3(wx, wy, wz);
    };
  },
  BufferGeometry: GeomMock,
  BufferAttribute: function(){},
  BoxGeometry: GeomMock,
  CylinderGeometry: GeomMock,
  SphereGeometry: GeomMock,
  PlaneGeometry: GeomMock,
  ConeGeometry: GeomMock,
  TorusGeometry: GeomMock,
  EdgesGeometry: GeomMock,
  LineBasicMaterial: function(){ this.opacity=1; },
  Line: function(geo, mat){ this.geometry=geo||new GeomMock(); this.material=mat||{opacity:1}; this.position=new global.THREE.Vector3(); this.rotation={set:()=>{},y:0,x:0,z:0}; this.userData={}; },
  LineSegments: function(geo, mat){ this.geometry=geo||new GeomMock(); this.material=mat||{opacity:1}; this.position=new global.THREE.Vector3(); this.rotation={set:()=>{},y:0,x:0,z:0}; this.userData={}; },
  GridHelper: function(){ this.position=new global.THREE.Vector3(); this.rotation={set:()=>{},y:0,x:0,z:0}; this.userData={}; },
  MeshStandardMaterial: function(){ this.color=new global.THREE.Color(); this.emissive=new global.THREE.Color(); },
  MeshBasicMaterial: function(){ this.color=new global.THREE.Color(); },
  Mesh: function(geo, mat){
    this.geometry = geo||new GeomMock();
    this.material = mat||{opacity:1};
    this.add=function(c){if(c){if(c.parent&&c.parent.remove)c.parent.remove(c);c.parent=this;this.children.push(c);}};
    this.remove=function(c){const i=this.children.indexOf(c);if(i>=0)this.children.splice(i,1);if(c)c.parent=null;};
    this.position=new global.THREE.Vector3();
    this.rotation={set:()=>{},y:0,x:0,z:0};
    this.scale={x:1,y:1,z:1,set:function(x,y,z){this.x=x;this.y=y;this.z=z;},setScalar:function(s){this.x=s;this.y=s;this.z=s;return this;}};
    this.quaternion={setFromUnitVectors:()=>{}};
    this.children=[];
    this.traverse=()=>{};
    this.lookAt=()=>{};
    this.userData={};
    this.localToWorld = function(v) {
      let cur = this;
      while (cur) {
        if (cur.position) {
          v.x += cur.position.x || 0;
          v.y += cur.position.y || 0;
          v.z += cur.position.z || 0;
        }
        cur = cur.parent;
      }
      return v;
    };
    this.getWorldPosition = function(target) {
      let cur = this;
      let wx = 0, wy = 0, wz = 0;
      while (cur) {
        if (cur.position) {
          wx += cur.position.x || 0;
          wy += cur.position.y || 0;
          wz += cur.position.z || 0;
        }
        cur = cur.parent;
      }
      if (target) { target.set(wx, wy, wz); return target; }
      return new global.THREE.Vector3(wx, wy, wz);
    };
  },
  AmbientLight: function(){ this.color=new global.THREE.Color(); },
  DirectionalLight: function(){ this.color=new global.THREE.Color(); this.position={set:()=>{}}; this.castShadow=false; },
  HemisphereLight: function(){ this.color=new global.THREE.Color(); this.groundColor=new global.THREE.Color(); },
  PointLight: function(){ this.color=new global.THREE.Color(); this.position={set:()=>{}}; },
  CanvasTexture: function(){},
  DoubleSide: 2
};

const simTestCode = `
console.log('Testing Accident Scenario with Car, Truck, and Another Bus...');

['Car', 'Truck', 'Another Bus'].forEach(vType => {
  console.log('\\n======================================================');
  console.log('TESTING ACCIDENT SCENARIO WITH VEHICLE: ' + vType);
  console.log('======================================================');
  
  accident.vehUserChoice = vType;
  loadScenario('accident');
  
  console.log('1. Scenario activated: accident.active = ' + accident.active + ', stage = ' + accident.stage);
  console.log('2. Vehicle chosen: ' + accident.vehType + ', mesh exists: ' + !!accident.vehGroup);
  console.log('3. Census: Bus Occupants = ' + 8 + ', Vehicle 2 Occupants = ' + accident.vehOccupants.length + ', Total = ' + (8 + accident.vehOccupants.length));
  console.log('4. Triage: Critical=' + accident.triage.critical + ', Serious=' + accident.triage.serious + ', Minor=' + accident.triage.minor + ', Safe=' + accident.triage.safe);
  console.log('5. Total Injured requiring transport: ' + accident.totalInjured);
  console.log('6. Ambulances Needed: ' + accident.ambNeeded);
  console.log('   Reason: ' + accident.ambReason);
  console.log('7. Dispatched Fleet size: ' + accident.ambFleet.length);
  accident.ambFleet.forEach(a => {
    console.log('   - Unit ' + a.id + ' (' + a.callsign + '): Patients=[' + a.assignedPatients.map(p=>p.id).join(', ') + ']');
  });
  
  // Advance through collision (0 to 3s)
  for(let i=0; i<30; i++) {
    updateAccidentLoop(0.1, i*0.1);
  }
  console.log('8. After 3.0s: stage = ' + accident.stage + ' (Collision occurred, debris=' + accDebris.length + ', smoke=' + accSmoke.length + ')');
  console.log('   Automatic Ambulance Call triggered: ' + accident.callTriggered);
  const makeCallEntries = fetchedCalls.filter(c => c.url.includes('/api/make-call'));
  const sendAlertEntries = fetchedCalls.filter(c => c.url.includes('/api/send-alert'));
  console.log('   - /api/make-call dispatches: ' + makeCallEntries.length + ' (Target: ' + (makeCallEntries[0] ? makeCallEntries[0].body.to : 'none') + ', Reason: ' + (makeCallEntries[0] ? makeCallEntries[0].body.reason : '') + ')');
  console.log('   - /api/send-alert dispatches: ' + sendAlertEntries.length + ' (Target: ' + (sendAlertEntries[0] ? sendAlertEntries[0].body.to : 'none') + ')');
  if (!accident.callTriggered || makeCallEntries.length === 0 || makeCallEntries[0].body.to !== '+917603854975') {
    console.error('ERROR: Automatic ambulance call to +917603854975 was NOT dispatched!');
    process.exit(1);
  }
  
  // Advance through triage and ambulance dispatch (3s to 12s)
  for(let i=30; i<120; i++) {
    updateAccidentLoop(0.1, i*0.1);
  }
  console.log('9. After 12.0s: stage = ' + accident.stage + ' (Ambulances dispatched and driving)');
  
  // Advance to arrival (12s to 24s)
  for(let i=120; i<240; i++) {
    updateAccidentLoop(0.1, i*0.1);
  }
  console.log('10. After 24.0s: stage = ' + accident.stage + ' (Ambulances arrived, doors opened, stretchers deployed)');
  
  // Verify all injured patients start in WAITING_FOR_RESCUE
  const preRescueInjured = accident.allOccupants.filter(p => p.triage !== 'SAFE');
  preRescueInjured.forEach(p => {
    if (p.state !== 'WAITING_FOR_RESCUE') {
      console.error('ERROR: Patient ' + p.id + ' should be WAITING_FOR_RESCUE at start of rescue, but got ' + p.state);
      process.exit(1);
    }
    if (p.mesh && p.mesh.parent !== p.originalParent) {
      console.error('ERROR: Patient ' + p.id + ' mesh should be inside original parent vehicle before rescue!');
      process.exit(1);
    }
  });
  console.log('    Verified: All ' + preRescueInjured.length + ' injured patients seated in vehicles and WAITING_FOR_RESCUE.');

  // Advance through patient rescue and loading (24s to 45s)
  for(let i=240; i<450; i++) {
    updateAccidentLoop(0.1, i*0.1);
  }
  console.log('11. After 45.0s: stage = ' + accident.stage + ' (Patients loaded, ambulances departing to hospital)');
  
  // Verify all patients have been physically reparented into stretchers and inside ambulances
  preRescueInjured.forEach(p => {
    if (p.state === 'WAITING_FOR_RESCUE') {
      console.error('ERROR: Patient ' + p.id + ' was left behind in WAITING_FOR_RESCUE state!');
      process.exit(1);
    }
    if (!p.stretcher) {
      console.error('ERROR: Patient ' + p.id + ' does not have a stretcher!');
      process.exit(1);
    }
    if (p.mesh && p.mesh.parent !== p.stretcher) {
      console.error('ERROR: Patient ' + p.id + ' mesh is not attached to stretcher!');
      process.exit(1);
    }
    if (p.assignedAmbUnit && p.stretcher.parent !== p.assignedAmbUnit.g) {
      console.error('ERROR: Patient ' + p.id + ' stretcher is not attached to ambulance interior!');
      process.exit(1);
    }
  });
  console.log('    Verified: All ' + preRescueInjured.length + ' injured patients physically transferred onto stretchers and attached inside ambulance interiors.');

  // Advance to hospital arrival (45s to 60s)
  for(let i=450; i<600; i++) {
    updateAccidentLoop(0.1, i*0.1);
  }
  console.log('12. After 60.0s: stage = ' + accident.stage + ' (Rescue completed, completed=' + accident.completed + ')');
  
  preRescueInjured.forEach(p => {
    if (p.state !== 'ARRIVED_AT_HOSPITAL') {
      console.error('ERROR: Patient ' + p.id + ' state is ' + p.state + ', expected ARRIVED_AT_HOSPITAL!');
      process.exit(1);
    }
  });
  console.log('    Verified: All ' + preRescueInjured.length + ' injured patients marked ARRIVED_AT_HOSPITAL.');

  // Verify UI output
  updateAccidentUI();
  const dspHtml = domMap['acc_dispatch_card'].innerHTML;
  if (!dspHtml.includes('Live Patient Rescue &amp; Transport Tracking') && !dspHtml.includes('Live Patient Rescue & Transport Tracking')) {
    console.error('ERROR: Live Patient Rescue Tracking table missing from UI!');
    process.exit(1);
  }
  console.log('    Verified: Live Patient Rescue Tracking Table successfully rendered in dashboard UI.');
  
  if (accident.stage !== 12 || !accident.completed) {
    console.error('ERROR: Simulation did not reach stage 12!');
    process.exit(1);
  }
  
  // Test reset
  resetAccident();
  console.log('13. Reset: accident.active = ' + accident.active + ', vehGroup = ' + accident.vehGroup + ', debris = ' + accDebris.length);
  if (accident.active !== false || accident.vehGroup !== null || accDebris.length !== 0) {
    console.error('ERROR: resetAccident failed to clean up!');
    process.exit(1);
  }
});

console.log('\\n======================================================');
console.log('TESTING ACCIDENT AUTOMATIC CALL TO CUSTOM SAVED AMBULANCE NUMBER');
console.log('======================================================');
const customSavedNumber = '+919876543210';
updateSavedAmbulanceNumber(customSavedNumber);
console.log('Saved Ambulance Number set to:', TW.to);
if (TW.to !== customSavedNumber) {
  console.error('ERROR: Failed to save ambulance number to TW.to');
  process.exit(1);
}

// Clear fetch records
fetchedCalls.length = 0;

// Start accident scenario
loadScenario('accident');

// Advance through collision (0 to 3s)
for(let i=0; i<30; i++) {
  updateAccidentLoop(0.1, i*0.1);
}

const customMakeCallEntries = fetchedCalls.filter(c => c.url.includes('/api/make-call'));
console.log('Automatic call made entries:', customMakeCallEntries.length);
if (customMakeCallEntries.length === 0 || customMakeCallEntries[0].body.to !== customSavedNumber) {
  console.error('ERROR: Automatic accident call did not dial the saved ambulance number ' + customSavedNumber);
  process.exit(1);
}
console.log('SUCCESS: Automatic call to saved ambulance number verified -> ' + customMakeCallEntries[0].body.to);
resetAccident();

console.log('\\n>>> ALL ACCIDENT SCENARIO SIMULATION TESTS PASSED 100%! <<<');

const unitTestRes = runTests();
const passedCount = unitTestRes.filter(r => r.ok).length;
console.log('\\n>>> UNIT TEST SUITE: ' + passedCount + ' / ' + unitTestRes.length + ' PASSED <<<');
if (passedCount !== unitTestRes.length) {
  console.error('ERROR: Some unit tests failed!');
  process.exit(1);
}
`;

eval(scriptMatch + '\n' + simTestCode);

