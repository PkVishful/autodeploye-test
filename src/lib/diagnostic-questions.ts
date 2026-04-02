/**
 * Hardcoded diagnostic questions mapped by issue type and sub-type.
 * Questions are designed for technicians/employees — simple language, max 5 per ticket.
 * To add new issue types/sub-types, just add entries to the map below.
 */

export interface DiagnosticQuestion {
  id: string;
  question: string;
  options: { value: string; label: string }[];
}

type QuestionMap = Record<string, DiagnosticQuestion[]>;

const questionMap: QuestionMap = {
  // ============ AC Issues ============
  'ac issues > ac not cooling': [
    { id: 'ac1', question: 'Is the AC turning on when you press the power button?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'partially', label: 'Partially / Flickers' }] },
    { id: 'ac2', question: 'Is air coming out from the AC vents?', options: [{ value: 'yes_warm', label: 'Yes, but warm air' }, { value: 'yes_weak', label: 'Yes, but very weak' }, { value: 'no', label: 'No air at all' }] },
    { id: 'ac3', question: 'When was the AC filter last cleaned?', options: [{ value: 'recent', label: 'Within last month' }, { value: 'long', label: 'More than a month ago' }, { value: 'never', label: 'Never / Not sure' }] },
    { id: 'ac4', question: 'Is there any water leaking from the AC?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    { id: 'ac5', question: 'Is the remote control working properly?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No / Batteries dead' }, { value: 'na', label: 'Using wall switch' }] },
  ],
  'ac issues > ac leaking water': [
    { id: 'acl1', question: 'Where is the water leaking from?', options: [{ value: 'front', label: 'Front of the AC' }, { value: 'back', label: 'Back / Wall side' }, { value: 'bottom', label: 'Bottom drip' }] },
    { id: 'acl2', question: 'How much water is leaking?', options: [{ value: 'few_drops', label: 'A few drops' }, { value: 'steady', label: 'Steady dripping' }, { value: 'heavy', label: 'Heavy flow' }] },
    { id: 'acl3', question: 'Is the AC still cooling properly?', options: [{ value: 'yes', label: 'Yes, cooling fine' }, { value: 'no', label: 'Not cooling well' }] },
    { id: 'acl4', question: 'Is the drain pipe visible and clear?', options: [{ value: 'yes', label: 'Yes, looks clear' }, { value: 'blocked', label: 'Looks blocked / dirty' }, { value: 'cant_see', label: 'Can\'t see it' }] },
  ],
  'ac issues > ac making noise': [
    { id: 'acn1', question: 'What kind of noise is the AC making?', options: [{ value: 'rattling', label: 'Rattling / Vibrating' }, { value: 'buzzing', label: 'Buzzing / Humming' }, { value: 'clicking', label: 'Clicking' }, { value: 'squealing', label: 'Squealing / Screeching' }] },
    { id: 'acn2', question: 'When does the noise happen?', options: [{ value: 'startup', label: 'When AC starts' }, { value: 'running', label: 'While running' }, { value: 'always', label: 'All the time' }] },
    { id: 'acn3', question: 'Is the noise coming from indoor or outdoor unit?', options: [{ value: 'indoor', label: 'Indoor unit' }, { value: 'outdoor', label: 'Outdoor unit' }, { value: 'both', label: 'Both' }] },
    { id: 'acn4', question: 'Is the AC still cooling?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
  ],
  'ac issues > ac not turning on': [
    { id: 'acoff1', question: 'Is there power supply in the room?', options: [{ value: 'yes', label: 'Yes, other things work' }, { value: 'no', label: 'No power at all' }, { value: 'partial', label: 'Some things work, some don\'t' }] },
    { id: 'acoff2', question: 'Is the AC MCB/switch turned on?', options: [{ value: 'yes', label: 'Yes, it\'s on' }, { value: 'no', label: 'No / Tripped' }, { value: 'unsure', label: 'Not sure where it is' }] },
    { id: 'acoff3', question: 'Does any light appear on the AC when you try?', options: [{ value: 'yes', label: 'Yes, display lights up' }, { value: 'no', label: 'No lights at all' }, { value: 'blinks', label: 'Lights blink then go off' }] },
    { id: 'acoff4', question: 'Was the AC working before this issue?', options: [{ value: 'yesterday', label: 'Yes, was working yesterday' }, { value: 'days', label: 'Stopped working a few days ago' }, { value: 'long', label: 'Has not worked for a while' }] },
  ],
  'ac issues > ac remote not working': [
    { id: 'acr1', question: 'Have you tried replacing the remote batteries?', options: [{ value: 'yes', label: 'Yes, still not working' }, { value: 'no', label: 'No, haven\'t tried' }] },
    { id: 'acr2', question: 'Does the remote show any display when you press buttons?', options: [{ value: 'yes', label: 'Yes, display works' }, { value: 'no', label: 'No display at all' }] },
    { id: 'acr3', question: 'Can you turn the AC on using the power button on the unit?', options: [{ value: 'yes', label: 'Yes, it works manually' }, { value: 'no', label: 'No, that doesn\'t work either' }] },
  ],

  // ============ Electrical Issues ============
  'electrical issues > power outage': [
    { id: 'el1', question: 'Is the power out in the entire room or just some outlets?', options: [{ value: 'entire', label: 'Entire room' }, { value: 'some', label: 'Some outlets / areas' }, { value: 'one', label: 'Just one outlet' }] },
    { id: 'el2', question: 'Have you checked the MCB / circuit breaker?', options: [{ value: 'tripped', label: 'Yes, it has tripped' }, { value: 'on', label: 'Yes, it\'s on' }, { value: 'unsure', label: 'Don\'t know where it is' }] },
    { id: 'el3', question: 'Is there power in the common areas or other rooms?', options: [{ value: 'yes', label: 'Yes, others have power' }, { value: 'no', label: 'No, entire floor/building is out' }] },
    { id: 'el4', question: 'Did this happen suddenly or after plugging something in?', options: [{ value: 'sudden', label: 'Happened suddenly' }, { value: 'after_plugin', label: 'After plugging in an appliance' }, { value: 'gradual', label: 'Was flickering before going out' }] },
  ],
  'electrical issues > switch not working': [
    { id: 'sw1', question: 'Which switch is not working?', options: [{ value: 'light', label: 'Light switch' }, { value: 'fan', label: 'Fan switch / regulator' }, { value: 'socket', label: 'Power socket' }, { value: 'other', label: 'Other switch' }] },
    { id: 'sw2', question: 'Is the switch physically broken or just not responding?', options: [{ value: 'broken', label: 'Physically damaged / loose' }, { value: 'not_responding', label: 'Looks fine but doesn\'t work' }] },
    { id: 'sw3', question: 'Are other switches in the same board working?', options: [{ value: 'yes', label: 'Yes, others work' }, { value: 'no', label: 'No, none work' }] },
  ],
  'electrical issues > fan not working': [
    { id: 'fn1', question: 'Is the fan not spinning at all or spinning slowly?', options: [{ value: 'not_spinning', label: 'Not spinning at all' }, { value: 'slow', label: 'Spinning very slowly' }, { value: 'noise', label: 'Spinning but making noise' }] },
    { id: 'fn2', question: 'Does the fan regulator work?', options: [{ value: 'yes', label: 'Yes, changing speed works' }, { value: 'no', label: 'No effect on speed' }, { value: 'no_regulator', label: 'No regulator' }] },
    { id: 'fn3', question: 'Is the fan wobbling or shaking?', options: [{ value: 'yes', label: 'Yes, it wobbles' }, { value: 'no', label: 'No, it\'s stable' }] },
  ],
  'electrical issues > light not working': [
    { id: 'lt1', question: 'Is it a single light or multiple lights not working?', options: [{ value: 'single', label: 'Just one light' }, { value: 'multiple', label: 'Multiple lights' }, { value: 'all', label: 'All lights in room' }] },
    { id: 'lt2', question: 'What type of light is it?', options: [{ value: 'tube', label: 'Tube light' }, { value: 'bulb', label: 'Bulb / CFL' }, { value: 'led', label: 'LED panel' }, { value: 'unsure', label: 'Not sure' }] },
    { id: 'lt3', question: 'Does the light flicker or is it completely dead?', options: [{ value: 'flicker', label: 'Flickering' }, { value: 'dead', label: 'Completely off' }, { value: 'dim', label: 'Very dim' }] },
  ],
  'electrical issues > sparking': [
    { id: 'sp1', question: 'Where is the sparking happening?', options: [{ value: 'switch', label: 'At a switch' }, { value: 'socket', label: 'At a power socket' }, { value: 'wire', label: 'At an exposed wire' }, { value: 'appliance', label: 'At an appliance' }] },
    { id: 'sp2', question: 'Is there a burning smell?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    { id: 'sp3', question: 'Have you turned off the power to that area?', options: [{ value: 'yes', label: 'Yes, turned it off' }, { value: 'no', label: 'No, still on' }] },
  ],

  // ============ Plumbing Issues ============
  'plumbing issues > water leakage': [
    { id: 'pl1', question: 'Where is the water leaking?', options: [{ value: 'tap', label: 'From a tap' }, { value: 'pipe', label: 'From a pipe / wall' }, { value: 'toilet', label: 'From toilet / flush' }, { value: 'ceiling', label: 'From ceiling / above' }] },
    { id: 'pl2', question: 'How bad is the leak?', options: [{ value: 'drip', label: 'Slow drip' }, { value: 'steady', label: 'Steady flow' }, { value: 'heavy', label: 'Heavy / flooding' }] },
    { id: 'pl3', question: 'Is the main water valve accessible?', options: [{ value: 'yes', label: 'Yes, I can shut it' }, { value: 'no', label: 'No / Don\'t know where' }] },
    { id: 'pl4', question: 'Has this happened before in the same spot?', options: [{ value: 'yes', label: 'Yes, recurring issue' }, { value: 'no', label: 'First time' }] },
  ],
  'plumbing issues > blocked drain': [
    { id: 'bd1', question: 'Which drain is blocked?', options: [{ value: 'bathroom', label: 'Bathroom floor drain' }, { value: 'kitchen', label: 'Kitchen sink' }, { value: 'toilet', label: 'Toilet / commode' }, { value: 'washbasin', label: 'Wash basin' }] },
    { id: 'bd2', question: 'Is the water draining slowly or not at all?', options: [{ value: 'slow', label: 'Draining slowly' }, { value: 'not_at_all', label: 'Not draining at all' }, { value: 'overflow', label: 'Overflowing' }] },
    { id: 'bd3', question: 'Is there a bad smell coming from the drain?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
  ],
  'plumbing issues > no water supply': [
    { id: 'nw1', question: 'Is there no water in the entire room or just one tap?', options: [{ value: 'entire', label: 'No water anywhere' }, { value: 'one_tap', label: 'Only one tap has no water' }, { value: 'hot_only', label: 'No hot water only' }] },
    { id: 'nw2', question: 'Do other rooms/tenants have water?', options: [{ value: 'yes', label: 'Yes, others have water' }, { value: 'no', label: 'No one has water' }, { value: 'unsure', label: 'Not sure' }] },
    { id: 'nw3', question: 'Is the water tank/sump visible and does it have water?', options: [{ value: 'yes_water', label: 'Tank has water' }, { value: 'empty', label: 'Tank is empty' }, { value: 'cant_check', label: 'Can\'t check' }] },
  ],
  'plumbing issues > toilet issue': [
    { id: 'ti1', question: 'What is the toilet issue?', options: [{ value: 'not_flushing', label: 'Not flushing properly' }, { value: 'leaking', label: 'Leaking / running water' }, { value: 'clogged', label: 'Clogged / blocked' }, { value: 'seat_broken', label: 'Seat broken / loose' }] },
    { id: 'ti2', question: 'Is water still running continuously in the toilet?', options: [{ value: 'yes', label: 'Yes, constantly running' }, { value: 'no', label: 'No' }] },
    { id: 'ti3', question: 'Is there a bad smell?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
  ],

  // ============ Cleaning Issues ============
  'cleaning issues > room not cleaned': [
    { id: 'cl1', question: 'What needs cleaning?', options: [{ value: 'floor', label: 'Floor / sweeping' }, { value: 'bathroom', label: 'Bathroom' }, { value: 'dusty', label: 'Dusty surfaces / furniture' }, { value: 'full', label: 'Full room cleaning' }] },
    { id: 'cl2', question: 'When was the last cleaning done?', options: [{ value: 'today', label: 'Today but not proper' }, { value: 'yesterday', label: 'Yesterday' }, { value: 'days', label: 'Several days ago' }] },
    { id: 'cl3', question: 'Is this a one-time request or recurring issue?', options: [{ value: 'one_time', label: 'One-time' }, { value: 'recurring', label: 'Happens regularly' }] },
  ],
  'cleaning issues > pest control': [
    { id: 'pc1', question: 'What type of pest did you notice?', options: [{ value: 'cockroach', label: 'Cockroaches' }, { value: 'ant', label: 'Ants' }, { value: 'mosquito', label: 'Mosquitoes' }, { value: 'rat', label: 'Rats / mice' }] },
    { id: 'pc2', question: 'Where are the pests mostly seen?', options: [{ value: 'kitchen', label: 'Kitchen area' }, { value: 'bathroom', label: 'Bathroom' }, { value: 'bed_area', label: 'Near bed / cupboard' }, { value: 'everywhere', label: 'Everywhere' }] },
    { id: 'pc3', question: 'When was the last pest control treatment?', options: [{ value: 'recent', label: 'Within last month' }, { value: 'long', label: 'More than a month ago' }, { value: 'never', label: 'Never done / Not sure' }] },
  ],
  'cleaning issues > garbage not collected': [
    { id: 'gc1', question: 'Where is the garbage issue?', options: [{ value: 'room', label: 'Inside room bin' }, { value: 'corridor', label: 'Corridor / common area' }, { value: 'outside', label: 'Building outside / dumpster' }] },
    { id: 'gc2', question: 'Is the bin overflowing?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No, just not collected today' }] },
  ],

  // ============ Internet / WiFi Issues ============
  'internet issues > no internet': [
    { id: 'in1', question: 'Is the WiFi signal showing on your device?', options: [{ value: 'yes_connected', label: 'Yes, connected but no internet' }, { value: 'no_signal', label: 'No WiFi signal at all' }, { value: 'keeps_dropping', label: 'Keeps connecting and disconnecting' }] },
    { id: 'in2', question: 'Are other people in the same area also affected?', options: [{ value: 'yes', label: 'Yes, others are also affected' }, { value: 'no', label: 'No, only me' }, { value: 'unsure', label: 'Not sure' }] },
    { id: 'in3', question: 'Is the router light on?', options: [{ value: 'all_green', label: 'All lights are green' }, { value: 'some_off', label: 'Some lights are off / red' }, { value: 'off', label: 'Router is completely off' }, { value: 'cant_see', label: 'Can\'t see the router' }] },
    { id: 'in4', question: 'Have you tried restarting your device?', options: [{ value: 'yes', label: 'Yes, still not working' }, { value: 'no', label: 'No, haven\'t tried' }] },
  ],
  'internet issues > slow internet': [
    { id: 'is1', question: 'When did the speed become slow?', options: [{ value: 'today', label: 'Just today' }, { value: 'few_days', label: 'Past few days' }, { value: 'always', label: 'Always been slow' }] },
    { id: 'is2', question: 'Is the slow speed on WiFi only or wired (LAN) also?', options: [{ value: 'wifi', label: 'WiFi only' }, { value: 'both', label: 'Both WiFi and LAN' }, { value: 'no_lan', label: 'No LAN available' }] },
    { id: 'is3', question: 'How many devices are connected?', options: [{ value: '1-2', label: '1-2 devices' }, { value: '3-5', label: '3-5 devices' }, { value: 'many', label: 'More than 5' }] },
  ],

  // ============ Furniture Issues ============
  'furniture issues > bed issue': [
    { id: 'fb1', question: 'What is the issue with the bed?', options: [{ value: 'broken', label: 'Broken / damaged frame' }, { value: 'squeaky', label: 'Squeaky / makes noise' }, { value: 'mattress', label: 'Mattress problem' }, { value: 'loose', label: 'Loose / wobbly' }] },
    { id: 'fb2', question: 'Can you still use the bed safely?', options: [{ value: 'yes', label: 'Yes, but uncomfortable' }, { value: 'no', label: 'No, unsafe to use' }] },
    { id: 'fb3', question: 'Is this a bunk bed or single bed?', options: [{ value: 'bunk', label: 'Bunk bed' }, { value: 'single', label: 'Single bed' }, { value: 'double', label: 'Double bed' }] },
  ],
  'furniture issues > cupboard issue': [
    { id: 'fc1', question: 'What is wrong with the cupboard?', options: [{ value: 'door', label: 'Door broken / won\'t close' }, { value: 'lock', label: 'Lock not working' }, { value: 'shelf', label: 'Shelf broken / loose' }, { value: 'hinge', label: 'Hinge broken' }] },
    { id: 'fc2', question: 'Can you still secure your belongings?', options: [{ value: 'yes', label: 'Yes, partially usable' }, { value: 'no', label: 'No, can\'t lock it' }] },
  ],
  'furniture issues > chair / table issue': [
    { id: 'fct1', question: 'Which furniture has the issue?', options: [{ value: 'chair', label: 'Chair' }, { value: 'table', label: 'Table / desk' }, { value: 'both', label: 'Both' }] },
    { id: 'fct2', question: 'What is the issue?', options: [{ value: 'broken', label: 'Broken / cracked' }, { value: 'wobbly', label: 'Wobbly / unstable' }, { value: 'missing', label: 'Missing entirely' }] },
  ],

  // ============ Fridge Issues ============
  'fridge issues > fridge not cooling': [
    { id: 'fr1', question: 'Is the fridge running (can you hear the motor)?', options: [{ value: 'yes', label: 'Yes, motor is running' }, { value: 'no', label: 'No sound at all' }, { value: 'intermittent', label: 'Runs and stops frequently' }] },
    { id: 'fr2', question: 'Is the fridge light turning on when you open the door?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    { id: 'fr3', question: 'Is there ice buildup inside the freezer?', options: [{ value: 'yes', label: 'Yes, heavy ice' }, { value: 'no', label: 'No ice at all' }, { value: 'normal', label: 'Normal amount' }] },
    { id: 'fr4', question: 'Is the fridge door closing properly?', options: [{ value: 'yes', label: 'Yes, seals well' }, { value: 'no', label: 'No, doesn\'t close fully' }] },
  ],
  'fridge issues > fridge making noise': [
    { id: 'frn1', question: 'What kind of noise?', options: [{ value: 'buzzing', label: 'Buzzing / humming loudly' }, { value: 'rattling', label: 'Rattling / vibrating' }, { value: 'clicking', label: 'Clicking' }] },
    { id: 'frn2', question: 'Is the noise constant or comes and goes?', options: [{ value: 'constant', label: 'Constant' }, { value: 'intermittent', label: 'Comes and goes' }] },
    { id: 'frn3', question: 'Is the fridge still cooling?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
  ],

  // ============ Water Heater / Geyser Issues ============
  'heater issues > geyser not heating': [
    { id: 'gh1', question: 'Is the geyser power light on?', options: [{ value: 'yes', label: 'Yes, light is on' }, { value: 'no', label: 'No light' }] },
    { id: 'gh2', question: 'How long have you waited after turning it on?', options: [{ value: 'less_10', label: 'Less than 10 minutes' }, { value: '10_30', label: '10-30 minutes' }, { value: 'more_30', label: 'More than 30 minutes' }] },
    { id: 'gh3', question: 'Is there any water leaking from the geyser?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    { id: 'gh4', question: 'Is the geyser MCB turned on?', options: [{ value: 'yes', label: 'Yes' }, { value: 'tripped', label: 'No / Tripped' }, { value: 'unsure', label: 'Not sure' }] },
  ],
  'heater issues > geyser leaking': [
    { id: 'gl1', question: 'Where is the geyser leaking?', options: [{ value: 'bottom', label: 'From the bottom' }, { value: 'pipe', label: 'From inlet/outlet pipes' }, { value: 'valve', label: 'From safety valve' }] },
    { id: 'gl2', question: 'Is the water hot or cold?', options: [{ value: 'hot', label: 'Hot water' }, { value: 'cold', label: 'Cold water' }] },
    { id: 'gl3', question: 'How much is leaking?', options: [{ value: 'drip', label: 'Slow drip' }, { value: 'steady', label: 'Steady leak' }, { value: 'heavy', label: 'Heavy leak' }] },
  ],

  // ============ Washing Machine Issues ============
  'washing machine issues > machine not starting': [
    { id: 'wm1', question: 'Is the power supply to the machine working?', options: [{ value: 'yes', label: 'Yes, power is on' }, { value: 'no', label: 'No power' }, { value: 'unsure', label: 'Not sure' }] },
    { id: 'wm2', question: 'Is the door / lid fully closed?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'Won\'t close properly' }] },
    { id: 'wm3', question: 'Does the display / indicator light up?', options: [{ value: 'yes', label: 'Yes, shows display' }, { value: 'no', label: 'No display / lights' }, { value: 'error', label: 'Shows error code' }] },
  ],
  'washing machine issues > machine leaking': [
    { id: 'wml1', question: 'When does the leak happen?', options: [{ value: 'filling', label: 'During water filling' }, { value: 'washing', label: 'During wash cycle' }, { value: 'draining', label: 'During draining' }, { value: 'always', label: 'All the time' }] },
    { id: 'wml2', question: 'Where is the leak coming from?', options: [{ value: 'door', label: 'Door / lid area' }, { value: 'bottom', label: 'Bottom of machine' }, { value: 'hose', label: 'Hose / pipe' }] },
  ],
  'washing machine issues > machine making noise': [
    { id: 'wmn1', question: 'When does the noise occur?', options: [{ value: 'spin', label: 'During spin cycle' }, { value: 'wash', label: 'During washing' }, { value: 'always', label: 'Throughout the cycle' }] },
    { id: 'wmn2', question: 'What type of noise?', options: [{ value: 'banging', label: 'Banging / thumping' }, { value: 'grinding', label: 'Grinding' }, { value: 'squealing', label: 'Squealing' }] },
    { id: 'wmn3', question: 'Is the machine vibrating or moving from its position?', options: [{ value: 'yes', label: 'Yes, moves around' }, { value: 'no', label: 'Stays in place' }] },
  ],

  // ============ Security Issues ============
  'security issues > door lock issue': [
    { id: 'dl1', question: 'What is wrong with the door lock?', options: [{ value: 'wont_lock', label: 'Won\'t lock' }, { value: 'key_stuck', label: 'Key is stuck' }, { value: 'broken', label: 'Lock is broken' }, { value: 'lost_key', label: 'Key lost' }] },
    { id: 'dl2', question: 'Can you currently secure your room?', options: [{ value: 'yes', label: 'Yes, partially' }, { value: 'no', label: 'No, door is open' }] },
    { id: 'dl3', question: 'Is this the main door or bathroom door?', options: [{ value: 'main', label: 'Main door' }, { value: 'bathroom', label: 'Bathroom door' }, { value: 'other', label: 'Other' }] },
  ],
  'security issues > window issue': [
    { id: 'wi1', question: 'What is the window problem?', options: [{ value: 'wont_close', label: 'Won\'t close' }, { value: 'broken_glass', label: 'Glass broken' }, { value: 'latch', label: 'Latch / lock broken' }, { value: 'stuck', label: 'Stuck / won\'t open' }] },
    { id: 'wi2', question: 'Is this a safety concern?', options: [{ value: 'yes', label: 'Yes, can\'t secure the room' }, { value: 'no', label: 'No, minor issue' }] },
  ],

  // ============ Room Issues ============
  'room issues > wall damage': [
    { id: 'wd1', question: 'What type of wall damage?', options: [{ value: 'crack', label: 'Cracks' }, { value: 'peeling', label: 'Paint peeling' }, { value: 'dampness', label: 'Dampness / moisture' }, { value: 'hole', label: 'Hole / breakage' }] },
    { id: 'wd2', question: 'How big is the affected area?', options: [{ value: 'small', label: 'Small patch' }, { value: 'medium', label: 'Medium area' }, { value: 'large', label: 'Large / entire wall' }] },
    { id: 'wd3', question: 'Is there any water seepage through the wall?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
  ],
  'room issues > ceiling damage': [
    { id: 'cd1', question: 'What is the ceiling issue?', options: [{ value: 'leak', label: 'Water leaking through' }, { value: 'crack', label: 'Cracks' }, { value: 'peeling', label: 'Paint / plaster falling' }, { value: 'sagging', label: 'Sagging / bulging' }] },
    { id: 'cd2', question: 'Is there a room above this ceiling?', options: [{ value: 'yes', label: 'Yes, another room' }, { value: 'no', label: 'No, it\'s the top floor' }, { value: 'unsure', label: 'Not sure' }] },
  ],
  'room issues > door issue': [
    { id: 'di1', question: 'What is the door issue?', options: [{ value: 'wont_close', label: 'Won\'t close properly' }, { value: 'squeaky', label: 'Squeaky / noisy hinge' }, { value: 'damaged', label: 'Damaged / broken' }, { value: 'gap', label: 'Gap under / around door' }] },
    { id: 'di2', question: 'Is it the main door or internal door?', options: [{ value: 'main', label: 'Main entry door' }, { value: 'bathroom', label: 'Bathroom door' }, { value: 'balcony', label: 'Balcony door' }] },
  ],

  // ============ Billing Issues ============
  'billing issues > incorrect bill': [
    { id: 'bi1', question: 'Which part of the bill seems incorrect?', options: [{ value: 'rent', label: 'Rent amount' }, { value: 'electricity', label: 'Electricity charges' }, { value: 'other', label: 'Other charges' }, { value: 'total', label: 'Total amount' }] },
    { id: 'bi2', question: 'Do you have the previous month\'s bill for comparison?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    { id: 'bi3', question: 'How much difference do you notice?', options: [{ value: 'small', label: 'Small (under ₹500)' }, { value: 'medium', label: 'Medium (₹500-2000)' }, { value: 'large', label: 'Large (over ₹2000)' }] },
  ],
  'billing issues > payment not reflected': [
    { id: 'bp1', question: 'How did you make the payment?', options: [{ value: 'upi', label: 'UPI / Google Pay' }, { value: 'bank', label: 'Bank transfer' }, { value: 'cash', label: 'Cash' }, { value: 'other', label: 'Other method' }] },
    { id: 'bp2', question: 'Do you have a payment receipt or transaction ID?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    { id: 'bp3', question: 'When was the payment made?', options: [{ value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' }, { value: 'days_ago', label: 'A few days ago' }, { value: 'week', label: 'More than a week ago' }] },
  ],
};

const defaultQuestions: DiagnosticQuestion[] = [
  { id: 'gen1', question: 'When did you first notice this issue?', options: [{ value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' }, { value: 'few_days', label: 'A few days ago' }, { value: 'week', label: 'More than a week' }] },
  { id: 'gen2', question: 'How severe is the issue?', options: [{ value: 'minor', label: 'Minor — can manage' }, { value: 'moderate', label: 'Moderate — inconvenient' }, { value: 'severe', label: 'Severe — can\'t use' }] },
  { id: 'gen3', question: 'Has this issue happened before?', options: [{ value: 'first', label: 'First time' }, { value: 'occasional', label: 'Happens sometimes' }, { value: 'frequent', label: 'Happens frequently' }] },
  { id: 'gen4', question: 'Did anything specific trigger this issue?', options: [{ value: 'nothing', label: 'Nothing, happened on its own' }, { value: 'after_use', label: 'After using something' }, { value: 'weather', label: 'After rain / weather change' }, { value: 'unsure', label: 'Not sure' }] },
  { id: 'gen5', question: 'Is the issue affecting other rooms or just yours?', options: [{ value: 'only_mine', label: 'Only my room' }, { value: 'others_too', label: 'Others affected too' }, { value: 'unsure', label: 'Not sure' }] },
];

/**
 * Get diagnostic questions for a given issue type and sub-type.
 * Falls back to default generic questions if no specific mapping exists.
 */
export function getDiagnosticQuestions(issueType: string, issueSubType?: string): DiagnosticQuestion[] {
  // Try exact match: "issue type > sub type"
  if (issueSubType) {
    const key = `${issueType} > ${issueSubType}`.toLowerCase();
    if (questionMap[key]) return questionMap[key];
  }

  // Try matching just the issue type (first match)
  const typePrefix = issueType.toLowerCase();
  for (const key of Object.keys(questionMap)) {
    if (key.startsWith(typePrefix + ' >')) {
      return questionMap[key];
    }
  }

  // Fallback to default questions
  return defaultQuestions;
}
