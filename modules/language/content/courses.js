'use strict';
// AADI · language — course content. Courses → units → activities.
// Activity kinds:
//   vocab   { cards: [{ w, ml, say?, note? }] }          flashcards (w = target-language word)
//   listen  { lines: [{ t, ml, say? }] }                 listen-and-repeat (k.speak, then record)
//   convo   { situation, roles:[a,b], lines:[{ r, t, ml }] }  role-play script
//   quiz    { items: [{ q, options, answer, ml? }] }     quick check (answer = index of correct option)
//   speak   { prompt, prompt_ml, model }                 free speaking task (recorded, rated)
// `tts` on the course = BCP-47 for k.speak. All Hindi/German content is basic, standard A1 material.

const V = (w, ml, extra = {}) => ({ w, ml, ...extra });
const Ln = (t, ml, extra = {}) => ({ t, ml, ...extra });
const C = (r, t, ml) => ({ r, t, ml });

const COURSES = [
  // ===================================================================== SPOKEN ENGLISH
  {
    id: 'eng-spoken', lang: 'en', tts: 'en-IN', icon: '🗣️', comp: 'english',
    title: 'Spoken English for city life', title_ml: 'നഗരജീവിതത്തിന് സംസാര ഇംഗ്ലീഷ്',
    about: 'From greetings to job interviews — practise real situations at the bus stand, hospital, bank and hotel.', about_ml: 'അഭിവാദ്യം മുതൽ ഇന്റർവ്യൂ വരെ — ബസ് സ്റ്റാൻഡ്, ആശുപത്രി, ബാങ്ക്, ഹോട്ടൽ.',
    units: [
      { id: 'greet', level: 'Pre-A1', title: 'Hello! Greetings & introducing yourself', title_ml: 'ഹലോ! അഭിവാദ്യവും സ്വയം പരിചയപ്പെടുത്തലും', activities: [
        { id: 'v1', kind: 'vocab', title: 'Greeting words', title_ml: 'അഭിവാദ്യ വാക്കുകൾ', cards: [V('Hello', 'ഹലോ / നമസ്കാരം'), V('Good morning', 'സുപ്രഭാതം'), V('Good evening', 'ശുഭസന്ധ്യ'), V('Thank you', 'നന്ദി'), V('Please', 'ദയവായി'), V('Sorry', 'ക്ഷമിക്കണം'), V('Excuse me', 'ഒന്ന് ശ്രദ്ധിക്കാമോ / ക്ഷമിക്കണം'), V('Goodbye', 'വിട / പോയി വരാം'), V('Yes', 'അതെ'), V('No', 'ഇല്ല')] },
        { id: 'l1', kind: 'listen', title: 'Say it after me', title_ml: 'കേട്ട് ആവർത്തിക്കുക', lines: [Ln('My name is Anu.', 'എന്റെ പേര് അനു.'), Ln('I am from Wayanad.', 'ഞാൻ വയനാട്ടിൽ നിന്നാണ്.'), Ln('I am twenty years old.', 'എനിക്ക് ഇരുപത് വയസ്സ്.'), Ln('Nice to meet you.', 'കണ്ടതിൽ സന്തോഷം.'), Ln('How are you?', 'സുഖമാണോ?'), Ln('I am fine, thank you.', 'സുഖം, നന്ദി.')] },
        { id: 'c1', kind: 'convo', title: 'Meeting someone new', title_ml: 'പുതിയ ഒരാളെ പരിചയപ്പെടുന്നു', situation: 'At a training centre, first day', situation_ml: 'പരിശീലന കേന്ദ്രം, ആദ്യ ദിവസം', roles: ['Ravi', 'Meera'], lines: [C(0, 'Hello! My name is Ravi. What is your name?', 'ഹലോ! എന്റെ പേര് രവി. നിങ്ങളുടെ പേരെന്താണ്?'), C(1, 'Hi Ravi. I am Meera.', 'ഹായ് രവി. ഞാൻ മീര.'), C(0, 'Where are you from, Meera?', 'മീര എവിടെ നിന്നാണ്?'), C(1, 'I am from Attappadi. And you?', 'ഞാൻ അട്ടപ്പാടിയിൽ നിന്നാണ്. നിങ്ങളോ?'), C(0, 'I am from Idukki. Nice to meet you.', 'ഞാൻ ഇടുക്കിയിൽ നിന്നാണ്. കണ്ടതിൽ സന്തോഷം.'), C(1, 'Nice to meet you too.', 'എനിക്കും സന്തോഷം.')] },
        { id: 's1', kind: 'speak', title: 'Introduce yourself (30 seconds)', title_ml: 'സ്വയം പരിചയപ്പെടുത്തുക (30 സെക്കൻഡ്)', prompt: 'Say your name, where you are from, your age and one thing you like.', prompt_ml: 'പേര്, സ്ഥലം, പ്രായം, ഇഷ്ടമുള്ള ഒരു കാര്യം പറയുക.', model: 'Hello. My name is Anu. I am from Pachakkudi in Idukki. I am nineteen years old. I like playing football.' },
      ] },
      { id: 'numbers', level: 'Pre-A1', title: 'Numbers, time and money', title_ml: 'അക്കങ്ങൾ, സമയം, പണം', activities: [
        { id: 'v1', kind: 'vocab', title: 'Numbers & money', title_ml: 'അക്കങ്ങളും പണവും', cards: [V('one, two, three', 'ഒന്ന്, രണ്ട്, മൂന്ന്'), V('ten', 'പത്ത്'), V('twenty', 'ഇരുപത്'), V('fifty', 'അമ്പത്'), V('hundred', 'നൂറ്'), V('rupees', 'രൂപ'), V('How much?', 'എത്ര രൂപ?'), V('change', 'ചില്ലറ / ബാക്കി'), V('o\'clock', 'മണി'), V('half past', 'അര')] },
        { id: 'l1', kind: 'listen', title: 'Asking the time and price', title_ml: 'സമയവും വിലയും ചോദിക്കുക', lines: [Ln('What time is it?', 'സമയം എത്രയായി?'), Ln('It is ten o\'clock.', 'പത്ത് മണി.'), Ln('How much is this?', 'ഇതിന് എത്ര രൂപ?'), Ln('It is fifty rupees.', 'അമ്പത് രൂപ.'), Ln('Do you have change for one hundred?', 'നൂറിന് ചില്ലറയുണ്ടോ?')] },
        { id: 'q1', kind: 'quiz', title: 'Quick check', title_ml: 'ചെറിയ പരീക്ഷ', items: [{ q: '"How much is this?" means…', options: ['ഇതിന് എത്ര രൂപ?', 'ഇത് എന്താണ്?', 'സമയം എത്ര?', 'ഇത് എവിടെ?'], answer: 0 }, { q: 'Fifty = ?', options: ['50', '15', '500', '5'], answer: 0 }, { q: 'Which is a polite word?', options: ['Please', 'Go', 'Give', 'Now'], answer: 0 }] },
      ] },
      { id: 'busstand', level: 'A1', title: 'At the bus stand', title_ml: 'ബസ് സ്റ്റാൻഡിൽ', activities: [
        { id: 'v1', kind: 'vocab', title: 'Travel words', title_ml: 'യാത്രാ വാക്കുകൾ', cards: [V('bus stand', 'ബസ് സ്റ്റാൻഡ്'), V('ticket', 'ടിക്കറ്റ്'), V('platform / bay', 'പ്ലാറ്റ്ഫോം'), V('conductor', 'കണ്ടക്ടർ'), V('fare', 'യാത്രാക്കൂലി'), V('next bus', 'അടുത്ത ബസ്'), V('stop', 'സ്റ്റോപ്പ്'), V('left / right', 'ഇടത് / വലത്'), V('straight', 'നേരെ'), V('return ticket', 'മടക്ക ടിക്കറ്റ്')] },
        { id: 'c1', kind: 'convo', title: 'Which bus goes to Kozhikode?', title_ml: 'കോഴിക്കോട്ടേക്ക് ഏത് ബസ്?', situation: 'KSRTC bus stand enquiry counter', situation_ml: 'KSRTC ബസ് സ്റ്റാൻഡ് അന്വേഷണ കൗണ്ടർ', roles: ['Traveller', 'Enquiry officer'], lines: [C(0, 'Excuse me. Which bus goes to Kozhikode?', 'ക്ഷമിക്കണം. കോഴിക്കോട്ടേക്ക് ഏത് ബസാണ്?'), C(1, 'The next bus is at 2:30, from bay number four.', 'അടുത്ത ബസ് 2:30-ന്, നാലാം നമ്പർ ബേയിൽ നിന്ന്.'), C(0, 'How long does it take?', 'എത്ര സമയം എടുക്കും?'), C(1, 'About three hours.', 'ഏകദേശം മൂന്ന് മണിക്കൂർ.'), C(0, 'How much is the ticket?', 'ടിക്കറ്റിന് എത്ര രൂപ?'), C(1, 'You can buy it from the conductor on the bus.', 'ബസിൽ കണ്ടക്ടറിൽ നിന്ന് വാങ്ങാം.'), C(0, 'Thank you very much.', 'വളരെ നന്ദി.')] },
        { id: 'l1', kind: 'listen', title: 'Asking for directions', title_ml: 'വഴി ചോദിക്കൽ', lines: [Ln('Where is the railway station?', 'റെയിൽവേ സ്റ്റേഷൻ എവിടെയാണ്?'), Ln('Go straight and turn left.', 'നേരെ പോയി ഇടത്തോട്ട് തിരിയുക.'), Ln('Is it far from here?', 'ഇവിടെ നിന്ന് ദൂരമുണ്ടോ?'), Ln('Please tell me when we reach the stop.', 'സ്റ്റോപ്പ് എത്തുമ്പോൾ ദയവായി പറയണേ.')] },
        { id: 's1', kind: 'speak', title: 'Ask for your bus', title_ml: 'നിങ്ങളുടെ ബസ് ചോദിക്കുക', prompt: 'Ask which bus goes to your town, the time, and the platform.', prompt_ml: 'നിങ്ങളുടെ നാട്ടിലേക്കുള്ള ബസ്, സമയം, പ്ലാറ്റ്ഫോം എന്നിവ ചോദിക്കുക.', model: 'Excuse me. Which bus goes to Mananthavady? What time does it leave? Which platform is it?' },
      ] },
      { id: 'hospital', level: 'A1', title: 'At the hospital', title_ml: 'ആശുപത്രിയിൽ', activities: [
        { id: 'v1', kind: 'vocab', title: 'Health words', title_ml: 'ആരോഗ്യ വാക്കുകൾ', cards: [V('fever', 'പനി'), V('headache', 'തലവേദന'), V('stomach pain', 'വയറുവേദന'), V('cough', 'ചുമ'), V('medicine', 'മരുന്ന്'), V('doctor', 'ഡോക്ടർ'), V('nurse', 'നഴ്സ്'), V('OP ticket', 'ഒ.പി. ടിക്കറ്റ്'), V('pharmacy', 'ഫാർമസി'), V('twice a day', 'ദിവസം രണ്ടു നേരം')] },
        { id: 'c1', kind: 'convo', title: 'Seeing the doctor', title_ml: 'ഡോക്ടറെ കാണുന്നു', situation: 'Taluk hospital OP', situation_ml: 'താലൂക്ക് ആശുപത്രി ഒ.പി.', roles: ['Patient', 'Doctor'], lines: [C(1, 'Good morning. What is the problem?', 'സുപ്രഭാതം. എന്താണ് പ്രശ്നം?'), C(0, 'I have had a fever for two days.', 'രണ്ട് ദിവസമായി പനിയുണ്ട്.'), C(1, 'Do you have a cough or headache?', 'ചുമയോ തലവേദനയോ ഉണ്ടോ?'), C(0, 'Yes, I have a headache.', 'ഉണ്ട്, തലവേദനയുണ്ട്.'), C(1, 'Take this medicine twice a day after food.', 'ഈ മരുന്ന് ഭക്ഷണശേഷം ദിവസം രണ്ടു നേരം കഴിക്കുക.'), C(0, 'Thank you, doctor. Where is the pharmacy?', 'നന്ദി ഡോക്ടർ. ഫാർമസി എവിടെയാണ്?')] },
        { id: 'q1', kind: 'quiz', title: 'Quick check', title_ml: 'ചെറിയ പരീക്ഷ', items: [{ q: '"after food" means…', options: ['ഭക്ഷണശേഷം', 'ഭക്ഷണത്തിനുമുമ്പ്', 'രാത്രി', 'വെറുംവയറ്റിൽ'], answer: 0 }, { q: 'Where do you buy medicine?', options: ['Pharmacy', 'Bus stand', 'Bank', 'Post office'], answer: 0 }] },
        { id: 's1', kind: 'speak', title: 'Tell the doctor your problem', title_ml: 'ഡോക്ടറോട് പ്രശ്നം പറയുക', prompt: 'Say what is wrong, since when, and ask how to take the medicine.', prompt_ml: 'എന്താണ് പ്രശ്നം, എന്നു മുതൽ, മരുന്ന് എങ്ങനെ കഴിക്കണം എന്ന് ചോദിക്കുക.', model: 'Doctor, I have stomach pain since yesterday. How should I take this medicine?' },
      ] },
      { id: 'bank', level: 'A1', title: 'At the bank', title_ml: 'ബാങ്കിൽ', activities: [
        { id: 'v1', kind: 'vocab', title: 'Bank words', title_ml: 'ബാങ്ക് വാക്കുകൾ', cards: [V('account', 'അക്കൗണ്ട്'), V('deposit', 'പണം നിക്ഷേപിക്കുക'), V('withdraw', 'പണം പിൻവലിക്കുക'), V('passbook', 'പാസ്ബുക്ക്'), V('form', 'ഫോം'), V('signature', 'ഒപ്പ്'), V('ID proof', 'തിരിച്ചറിയൽ രേഖ'), V('counter', 'കൗണ്ടർ'), V('balance', 'ബാക്കി തുക'), V('ATM card', 'എ.ടി.എം. കാർഡ്')] },
        { id: 'c1', kind: 'convo', title: 'Opening an account', title_ml: 'അക്കൗണ്ട് തുറക്കുന്നു', situation: 'Public sector bank branch', situation_ml: 'ബാങ്ക് ശാഖ', roles: ['Customer', 'Bank staff'], lines: [C(0, 'Good morning. I want to open a savings account.', 'സുപ്രഭാതം. എനിക്ക് ഒരു സേവിംഗ്സ് അക്കൗണ്ട് തുറക്കണം.'), C(1, 'Please fill this form. Do you have Aadhaar and a photo?', 'ഈ ഫോം പൂരിപ്പിക്കൂ. ആധാറും ഫോട്ടോയും ഉണ്ടോ?'), C(0, 'Yes, I have them here.', 'ഉണ്ട്, ഇതാ.'), C(1, 'Sign here, please.', 'ഇവിടെ ഒപ്പിടൂ.'), C(0, 'When will I get the passbook?', 'പാസ്ബുക്ക് എപ്പോൾ കിട്ടും?'), C(1, 'You will get it today. Your ATM card will come by post.', 'ഇന്ന് തന്നെ കിട്ടും. എ.ടി.എം. കാർഡ് തപാലിൽ വരും.')] },
        { id: 'l1', kind: 'listen', title: 'Staying safe with money', title_ml: 'പണം സുരക്ഷിതം', lines: [Ln('I never share my PIN or OTP.', 'ഞാൻ ഒരിക്കലും PIN-ഓ OTP-യോ പങ്കിടില്ല.'), Ln('Please update my passbook.', 'ദയവായി പാസ്ബുക്ക് പുതുക്കി തരൂ.'), Ln('I want to deposit two thousand rupees.', 'എനിക്ക് രണ്ടായിരം രൂപ നിക്ഷേപിക്കണം.')] },
      ] },
      { id: 'phone', level: 'A1', title: 'On the phone', title_ml: 'ഫോണിൽ', activities: [
        { id: 'c1', kind: 'convo', title: 'Calling an office', title_ml: 'ഓഫീസിലേക്ക് വിളിക്കുന്നു', situation: 'Calling a training institute', situation_ml: 'പരിശീലന സ്ഥാപനത്തിലേക്ക് ഫോൺ', roles: ['Caller', 'Receptionist'], lines: [C(1, 'Hello, good afternoon. How can I help you?', 'ഹലോ, ഗുഡ് ആഫ്റ്റർനൂൺ. എന്ത് സഹായമാണ് വേണ്ടത്?'), C(0, 'Hello. I am calling about the hotel management course.', 'ഹലോ. ഹോട്ടൽ മാനേജ്മെന്റ് കോഴ്സിനെക്കുറിച്ച് ചോദിക്കാനാണ്.'), C(1, 'The next batch starts on the first of June.', 'അടുത്ത ബാച്ച് ജൂൺ ഒന്നിന് തുടങ്ങും.'), C(0, 'Sorry, could you repeat that, please?', 'ക്ഷമിക്കണം, ഒന്നുകൂടി പറയാമോ?'), C(1, 'The first of June.', 'ജൂൺ ഒന്ന്.'), C(0, 'Thank you. Can I come and meet you tomorrow?', 'നന്ദി. നാളെ നേരിട്ട് വരാമോ?'), C(1, 'Yes, any time between ten and four.', 'ഉവ്വ്, പത്തിനും നാലിനും ഇടയിൽ.')] },
        { id: 'l1', kind: 'listen', title: 'Useful phone phrases', title_ml: 'ഫോണിൽ ഉപയോഗിക്കാവുന്നവ', lines: [Ln('Can I speak to the manager, please?', 'മാനേജരോട് സംസാരിക്കാമോ?'), Ln('Could you speak slowly, please?', 'ദയവായി പതുക്കെ പറയാമോ?'), Ln('I will call you back.', 'ഞാൻ തിരിച്ചു വിളിക്കാം.'), Ln('The line is not clear.', 'ലൈൻ വ്യക്തമല്ല.')] },
        { id: 's1', kind: 'speak', title: 'Leave a voice message', title_ml: 'വോയ്‌സ് മെസ്സേജ് ഇടുക', prompt: 'Say who you are, why you called, and your phone number.', prompt_ml: 'നിങ്ങൾ ആരാണ്, എന്തിന് വിളിച്ചു, ഫോൺ നമ്പർ.', model: 'Hello, this is Manu from Thenmala. I am calling about the driver job. Please call me back on nine eight four…' },
      ] },
      { id: 'hotel', level: 'A2', title: 'Hotel reception', title_ml: 'ഹോട്ടൽ റിസപ്ഷൻ', activities: [
        { id: 'v1', kind: 'vocab', title: 'Hotel words', title_ml: 'ഹോട്ടൽ വാക്കുകൾ', cards: [V('reservation / booking', 'ബുക്കിംഗ്'), V('check-in', 'ചെക്ക്-ഇൻ'), V('check-out', 'ചെക്ക്-ഔട്ട്'), V('single room', 'സിംഗിൾ റൂം'), V('guest', 'അതിഥി'), V('key card', 'കീ കാർഡ്'), V('breakfast is included', 'പ്രഭാതഭക്ഷണം ഉൾപ്പെടെ'), V('housekeeping', 'ഹൗസ്‌കീപ്പിംഗ്')] },
        { id: 'c1', kind: 'convo', title: 'Welcoming a guest', title_ml: 'അതിഥിയെ സ്വീകരിക്കുന്നു', situation: 'You work at the front desk of a resort', situation_ml: 'റിസോർട്ടിലെ ഫ്രണ്ട് ഡെസ്കിൽ നിങ്ങൾ', roles: ['Receptionist', 'Guest'], lines: [C(0, 'Good evening, welcome to Green Valley Resort. Do you have a reservation?', 'ഗുഡ് ഈവനിംഗ്, ഗ്രീൻ വാലി റിസോർട്ടിലേക്ക് സ്വാഗതം. ബുക്കിംഗ് ഉണ്ടോ?'), C(1, 'Yes, it is under the name Sharma.', 'ഉണ്ട്, ശർമ എന്ന പേരിൽ.'), C(0, 'Thank you, Mr Sharma. May I see your ID, please?', 'നന്ദി, മിസ്റ്റർ ശർമ. ഐ.ഡി. കാണിക്കാമോ?'), C(1, 'Here you are. What time is breakfast?', 'ഇതാ. പ്രഭാതഭക്ഷണം എപ്പോഴാണ്?'), C(0, 'Breakfast is from seven to ten in the restaurant. Here is your key card. Room 204 is on the second floor.', 'ഏഴ് മുതൽ പത്ത് വരെ റെസ്റ്റോറന്റിൽ. ഇതാ കീ കാർഡ്. 204-ാം മുറി രണ്ടാം നിലയിൽ.'), C(1, 'Thank you.', 'നന്ദി.'), C(0, 'You are welcome. Please call 9 if you need anything.', 'സ്വാഗതം. എന്തെങ്കിലും വേണമെങ്കിൽ 9 ഡയൽ ചെയ്യൂ.')] },
        { id: 's1', kind: 'speak', title: 'Check a guest in', title_ml: 'അതിഥിയെ ചെക്ക്-ഇൻ ചെയ്യുക', prompt: 'Greet the guest, ask for the booking and ID, explain breakfast and the room.', prompt_ml: 'അഭിവാദ്യം, ബുക്കിംഗ്, ഐ.ഡി., പ്രഭാതഭക്ഷണം, മുറി.', model: 'Good afternoon and welcome. May I have your booking name and ID, please? Breakfast is from seven to ten. Your room is 105.' },
      ] },
      { id: 'interview', level: 'A2', title: 'Job interview', title_ml: 'ജോലി ഇന്റർവ്യൂ', activities: [
        { id: 'l1', kind: 'listen', title: 'Strong answers', title_ml: 'നല്ല ഉത്തരങ്ങൾ', lines: [Ln('I have completed my Plus Two.', 'ഞാൻ പ്ലസ് ടു പൂർത്തിയാക്കി.'), Ln('I am hard-working and I learn quickly.', 'ഞാൻ കഠിനാധ്വാനിയാണ്, വേഗം പഠിക്കും.'), Ln('I can speak Malayalam, English and my mother tongue.', 'എനിക്ക് മലയാളവും ഇംഗ്ലീഷും എന്റെ മാതൃഭാഷയും സംസാരിക്കാം.'), Ln('I am ready to work in shifts.', 'ഷിഫ്റ്റിൽ ജോലി ചെയ്യാൻ തയ്യാറാണ്.'), Ln('Thank you for this opportunity.', 'ഈ അവസരത്തിന് നന്ദി.')] },
        { id: 'c1', kind: 'convo', title: 'Interview for a hotel job', title_ml: 'ഹോട്ടൽ ജോലി ഇന്റർവ്യൂ', situation: 'HR office of a hotel in Kochi', situation_ml: 'കൊച്ചിയിലെ ഹോട്ടലിന്റെ എച്ച്.ആർ. ഓഫീസ്', roles: ['Interviewer', 'Candidate'], lines: [C(0, 'Please sit down. Tell me about yourself.', 'ഇരിക്കൂ. നിങ്ങളെക്കുറിച്ച് പറയൂ.'), C(1, 'Thank you, sir. My name is Akhil. I am from Wayanad. I completed a hospitality course last year.', 'നന്ദി സർ. എന്റെ പേര് അഖിൽ. വയനാട്ടിൽ നിന്ന്. കഴിഞ്ഞ വർഷം ഹോസ്പിറ്റാലിറ്റി കോഴ്സ് പൂർത്തിയാക്കി.'), C(0, 'Why do you want this job?', 'എന്തുകൊണ്ട് ഈ ജോലി വേണം?'), C(1, 'I like meeting people and I want to grow in the hotel industry.', 'ആളുകളെ കാണാൻ ഇഷ്ടമാണ്, ഹോട്ടൽ മേഖലയിൽ വളരണം.'), C(0, 'What is your strength?', 'നിങ്ങളുടെ ശക്തി എന്താണ്?'), C(1, 'I am punctual and I work well in a team.', 'കൃത്യനിഷ്ഠയുണ്ട്, ടീമിൽ നന്നായി ജോലി ചെയ്യും.'), C(0, 'Do you have any questions for us?', 'ഞങ്ങളോട് എന്തെങ്കിലും ചോദിക്കാനുണ്ടോ?'), C(1, 'Yes. Is there training for new staff?', 'ഉണ്ട്. പുതിയ ജീവനക്കാർക്ക് പരിശീലനമുണ്ടോ?')] },
        { id: 's1', kind: 'speak', title: '"Tell me about yourself" (60 seconds)', title_ml: '"നിങ്ങളെക്കുറിച്ച് പറയൂ" (60 സെക്കൻഡ്)', prompt: 'Name, place, education, one strength, and why you want the job.', prompt_ml: 'പേര്, സ്ഥലം, വിദ്യാഭ്യാസം, ഒരു ശക്തി, ജോലി എന്തിന്.', model: 'Good morning. My name is Sreeja. I am from Attappadi. I have completed my Plus Two and a computer course. I am patient and I learn quickly. I want this job because I want to help my family and build a career.' },
      ] },
    ],
  },

  // ===================================================================== WRITTEN ENGLISH
  {
    id: 'eng-written', lang: 'en', tts: 'en-IN', icon: '✍️', comp: 'english',
    title: 'Written English: forms, messages & letters', title_ml: 'എഴുത്ത് ഇംഗ്ലീഷ്: ഫോമുകൾ, മെസ്സേജുകൾ, കത്തുകൾ',
    about: 'Fill forms, write clear WhatsApp messages and a simple leave letter.', about_ml: 'ഫോമുകൾ പൂരിപ്പിക്കാനും വ്യക്തമായ മെസ്സേജുകളും ലീവ് ലെറ്ററും എഴുതാനും.',
    units: [
      { id: 'forms', level: 'Pre-A1', title: 'Filling a form', title_ml: 'ഫോം പൂരിപ്പിക്കൽ', activities: [
        { id: 'v1', kind: 'vocab', title: 'Form words', title_ml: 'ഫോമിലെ വാക്കുകൾ', cards: [V('Name', 'പേര്'), V('Date of birth', 'ജനനത്തീയതി'), V('Address', 'വിലാസം'), V('Father\'s / Mother\'s name', 'അച്ഛന്റെ / അമ്മയുടെ പേര്'), V('Gender', 'ലിംഗം'), V('Mobile number', 'മൊബൈൽ നമ്പർ'), V('Signature', 'ഒപ്പ്'), V('Qualification', 'യോഗ്യത'), V('Nationality', 'പൗരത്വം'), V('Block letters (CAPITALS)', 'വലിയ അക്ഷരങ്ങളിൽ')] },
        { id: 'q1', kind: 'quiz', title: 'Which box?', title_ml: 'ഏത് കോളം?', items: [{ q: 'Where do you write 12/05/2005?', options: ['Date of birth', 'Address', 'Signature', 'Gender'], answer: 0 }, { q: '"Write in BLOCK LETTERS" means…', options: ['Use capital letters', 'Use a pencil', 'Write in Malayalam', 'Sign your name'], answer: 0 }, { q: 'SSLC / Plus Two goes under…', options: ['Qualification', 'Nationality', 'Address', 'Gender'], answer: 0 }] },
      ] },
      { id: 'messages', level: 'A1', title: 'Clear messages', title_ml: 'വ്യക്തമായ മെസ്സേജുകൾ', activities: [
        { id: 'l1', kind: 'listen', title: 'Message patterns', title_ml: 'മെസ്സേജ് മാതൃകകൾ', lines: [Ln('Good morning sir, I will be 10 minutes late today.', 'സർ, ഇന്ന് 10 മിനിറ്റ് വൈകും.'), Ln('Thank you for the information.', 'വിവരത്തിന് നന്ദി.'), Ln('Could you please send me the address?', 'വിലാസം അയച്ചു തരാമോ?'), Ln('I have attached my certificate.', 'സർട്ടിഫിക്കറ്റ് അയച്ചിട്ടുണ്ട്.')] },
        { id: 'q1', kind: 'quiz', title: 'Choose the polite message', title_ml: 'മര്യാദയുള്ള മെസ്സേജ്', items: [{ q: 'Asking your manager for leave:', options: ['Sir, may I take leave tomorrow? My mother is unwell.', 'Tomorrow leave.', 'I am not coming.', 'Give leave.'], answer: 0 }, { q: 'Replying to an interview call:', options: ['Thank you, madam. I will come at 10 am on Monday.', 'ok', 'Fine come', 'Yes yes'], answer: 0 }] },
      ] },
      { id: 'letter', level: 'A2', title: 'A simple leave letter', title_ml: 'ലളിതമായ ലീവ് ലെറ്റർ', activities: [
        { id: 'l1', kind: 'listen', title: 'Letter parts', title_ml: 'കത്തിന്റെ ഭാഗങ്ങൾ', lines: [Ln('To, The Manager,', 'ബഹുമാനപ്പെട്ട മാനേജർക്ക്,'), Ln('Subject: Request for two days\' leave', 'വിഷയം: രണ്ട് ദിവസത്തെ അവധി'), Ln('Respected Sir,', 'ബഹുമാനപ്പെട്ട സർ,'), Ln('I request leave on 10th and 11th June as I have to attend a family function.', 'കുടുംബ ചടങ്ങിൽ പങ്കെടുക്കാൻ ജൂൺ 10, 11 തീയതികളിൽ അവധി അനുവദിക്കണമെന്ന് അഭ്യർത്ഥിക്കുന്നു.'), Ln('Yours faithfully,', 'വിശ്വസ്തതയോടെ,')] },
        { id: 's1', kind: 'speak', title: 'Read your letter aloud', title_ml: 'നിങ്ങളുടെ കത്ത് വായിക്കുക', prompt: 'Write a two-line leave request in your notebook, then read it aloud.', prompt_ml: 'രണ്ടുവരി അവധി അപേക്ഷ എഴുതി ഉറക്കെ വായിക്കുക.', model: 'Respected Madam, I request leave on Monday as I have a hospital appointment. Yours faithfully, Lakshmi.' },
      ] },
    ],
  },

  // ===================================================================== HINDI
  {
    id: 'hindi', lang: 'hi', tts: 'hi-IN', icon: '🇮🇳', comp: 'hindi',
    title: 'Hindi for travel and work', title_ml: 'യാത്രയ്ക്കും ജോലിക്കും ഹിന്ദി',
    about: 'Everyday Hindi for trains, workplaces and talking with colleagues from other states.', about_ml: 'ട്രെയിനിലും ജോലിസ്ഥലത്തും ഇതര സംസ്ഥാന സഹപ്രവർത്തകരോടും സംസാരിക്കാൻ.',
    units: [
      { id: 'basics', level: 'Pre-A1', title: 'Namaste! Basics', title_ml: 'നമസ്തേ! അടിസ്ഥാനം', activities: [
        { id: 'v1', kind: 'vocab', title: 'First words', title_ml: 'ആദ്യ വാക്കുകൾ', cards: [V('नमस्ते (namaste)', 'നമസ്കാരം', { say: 'नमस्ते' }), V('धन्यवाद (dhanyavaad)', 'നന്ദി', { say: 'धन्यवाद' }), V('हाँ (haan)', 'അതെ', { say: 'हाँ' }), V('नहीं (nahin)', 'ഇല്ല', { say: 'नहीं' }), V('पानी (paani)', 'വെള്ളം', { say: 'पानी' }), V('खाना (khaana)', 'ഭക്ഷണം', { say: 'खाना' }), V('कितना? (kitna?)', 'എത്ര?', { say: 'कितना?' }), V('कहाँ? (kahaan?)', 'എവിടെ?', { say: 'कहाँ?' }), V('ठीक है (theek hai)', 'ശരി', { say: 'ठीक है' }), V('माफ़ कीजिए (maaf keejiye)', 'ക്ഷമിക്കണം', { say: 'माफ़ कीजिए' })] },
        { id: 'l1', kind: 'listen', title: 'Introduce yourself', title_ml: 'സ്വയം പരിചയപ്പെടുത്തുക', lines: [Ln('मेरा नाम अनु है। (Mera naam Anu hai.)', 'എന്റെ പേര് അനു.', { say: 'मेरा नाम अनु है।' }), Ln('मैं केरल से हूँ। (Main Kerala se hoon.)', 'ഞാൻ കേരളത്തിൽ നിന്നാണ്.', { say: 'मैं केरल से हूँ।' }), Ln('आप कैसे हैं? (Aap kaise hain?)', 'സുഖമാണോ?', { say: 'आप कैसे हैं?' }), Ln('मैं ठीक हूँ। (Main theek hoon.)', 'എനിക്ക് സുഖം.', { say: 'मैं ठीक हूँ।' })] },
        { id: 'q1', kind: 'quiz', title: 'Quick check', title_ml: 'ചെറിയ പരീക്ഷ', items: [{ q: 'धन्यवाद means…', options: ['നന്ദി', 'വെള്ളം', 'ഇല്ല', 'എവിടെ'], answer: 0 }, { q: '"Where?" in Hindi', options: ['कहाँ?', 'कितना?', 'क्या?', 'कौन?'], answer: 0 }] },
      ] },
      { id: 'travel', level: 'A1', title: 'On the train', title_ml: 'ട്രെയിനിൽ', activities: [
        { id: 'c1', kind: 'convo', title: 'Finding your seat', title_ml: 'സീറ്റ് കണ്ടെത്തൽ', situation: 'Train to Bengaluru', situation_ml: 'ബെംഗളൂരുവിലേക്കുള്ള ട്രെയിൻ', roles: ['You', 'Passenger'], lines: [C(0, 'माफ़ कीजिए, यह सीट नंबर बीस है? (Maaf keejiye, yah seat number bees hai?)', 'ക്ഷമിക്കണം, ഇത് ഇരുപതാം നമ്പർ സീറ്റാണോ?'), C(1, 'हाँ, यही है। (Haan, yahi hai.)', 'അതെ, ഇതുതന്നെ.'), C(0, 'धन्यवाद। बेंगलुरु कब पहुँचेंगे? (Dhanyavaad. Bengaluru kab pahunchenge?)', 'നന്ദി. ബെംഗളൂരു എപ്പോൾ എത്തും?'), C(1, 'सुबह छह बजे। (Subah chhah baje.)', 'രാവിലെ ആറ് മണിക്ക്.')] },
        { id: 'l1', kind: 'listen', title: 'Useful questions', title_ml: 'ഉപകാരപ്രദമായ ചോദ്യങ്ങൾ', lines: [Ln('यह कितने का है? (Yah kitne ka hai?)', 'ഇതിന് എത്ര വില?', { say: 'यह कितने का है?' }), Ln('स्टेशन कहाँ है? (Station kahaan hai?)', 'സ്റ്റേഷൻ എവിടെയാണ്?', { say: 'स्टेशन कहाँ है?' }), Ln('धीरे बोलिए। (Dheere boliye.)', 'പതുക്കെ പറയൂ.', { say: 'धीरे बोलिए।' })] },
      ] },
    ],
  },

  // ===================================================================== GERMAN A1
  {
    id: 'german', lang: 'de', tts: 'de-DE', icon: '🇩🇪', comp: 'german',
    title: 'German A1 basics', title_ml: 'ജർമ്മൻ A1 അടിസ്ഥാനം',
    about: 'A first step for nursing and skilled-work pathways abroad: greetings, numbers and simple sentences.', about_ml: 'വിദേശത്ത് നഴ്സിംഗ്, തൊഴിൽ അവസരങ്ങൾക്കുള്ള ആദ്യ പടി.',
    units: [
      { id: 'hallo', level: 'Pre-A1', title: 'Hallo! Greetings', title_ml: 'ഹലോ! അഭിവാദ്യം', activities: [
        { id: 'v1', kind: 'vocab', title: 'Greetings', title_ml: 'അഭിവാദ്യങ്ങൾ', cards: [V('Hallo', 'ഹലോ'), V('Guten Morgen', 'സുപ്രഭാതം'), V('Guten Tag', 'നമസ്കാരം (പകൽ)'), V('Guten Abend', 'ശുഭസന്ധ്യ'), V('Tschüss', 'ബൈ'), V('Auf Wiedersehen', 'വീണ്ടും കാണാം'), V('Danke', 'നന്ദി'), V('Bitte', 'ദയവായി / സ്വാഗതം'), V('Ja / Nein', 'അതെ / ഇല്ല'), V('Entschuldigung', 'ക്ഷമിക്കണം')] },
        { id: 'l1', kind: 'listen', title: 'Introduce yourself', title_ml: 'സ്വയം പരിചയപ്പെടുത്തൽ', lines: [Ln('Ich heiße Anu.', 'എന്റെ പേര് അനു.'), Ln('Ich komme aus Indien.', 'ഞാൻ ഇന്ത്യയിൽ നിന്നാണ്.'), Ln('Wie geht es Ihnen?', 'സുഖമാണോ? (ഔപചാരികം)'), Ln('Mir geht es gut, danke.', 'എനിക്ക് സുഖം, നന്ദി.'), Ln('Ich spreche ein bisschen Deutsch.', 'എനിക്ക് അല്പം ജർമ്മൻ അറിയാം.')] },
        { id: 'c1', kind: 'convo', title: 'First meeting', title_ml: 'ആദ്യ കൂടിക്കാഴ്ച', situation: 'Language class, first day', situation_ml: 'ഭാഷാ ക്ലാസ്, ആദ്യ ദിവസം', roles: ['Lehrerin (teacher)', 'Student'], lines: [C(0, 'Guten Morgen! Wie heißen Sie?', 'സുപ്രഭാതം! നിങ്ങളുടെ പേരെന്താണ്?'), C(1, 'Guten Morgen. Ich heiße Meera.', 'സുപ്രഭാതം. എന്റെ പേര് മീര.'), C(0, 'Woher kommen Sie?', 'എവിടെ നിന്നാണ്?'), C(1, 'Ich komme aus Kerala, Indien.', 'ഞാൻ കേരളത്തിൽ നിന്നാണ്, ഇന്ത്യ.'), C(0, 'Schön, Sie kennenzulernen.', 'പരിചയപ്പെട്ടതിൽ സന്തോഷം.')] },
      ] },
      { id: 'zahlen', level: 'A1', title: 'Zahlen — numbers 1–10', title_ml: 'അക്കങ്ങൾ 1–10', activities: [
        { id: 'v1', kind: 'vocab', title: 'Numbers', title_ml: 'അക്കങ്ങൾ', cards: [V('eins', '1'), V('zwei', '2'), V('drei', '3'), V('vier', '4'), V('fünf', '5'), V('sechs', '6'), V('sieben', '7'), V('acht', '8'), V('neun', '9'), V('zehn', '10')] },
        { id: 'q1', kind: 'quiz', title: 'Quick check', title_ml: 'ചെറിയ പരീക്ഷ', items: [{ q: 'drei = ?', options: ['3', '2', '8', '10'], answer: 0 }, { q: '"Thank you" in German', options: ['Danke', 'Bitte', 'Tschüss', 'Hallo'], answer: 0 }, { q: 'Ich heiße Anu means…', options: ['എന്റെ പേര് അനു', 'ഞാൻ അനുവിനെ കാണുന്നു', 'അനു എവിടെ?', 'അനുവിന് സുഖം'], answer: 0 }] },
        { id: 's1', kind: 'speak', title: 'Say it in German', title_ml: 'ജർമ്മനിൽ പറയുക', prompt: 'Greet, say your name and where you come from in German.', prompt_ml: 'ജർമ്മനിൽ അഭിവാദ്യം ചെയ്ത് പേരും നാടും പറയുക.', model: 'Guten Tag. Ich heiße Manu. Ich komme aus Indien.' },
      ] },
    ],
  },

  // ===================================================================== MALAYALAM LITERACY
  {
    id: 'ml-literacy', lang: 'ml', tts: 'ml-IN', icon: 'അ', comp: 'literacy',
    title: 'Malayalam reading & writing', title_ml: 'മലയാളം വായനയും എഴുത്തും',
    about: 'Letters, words and short sentences — for learners whose home language is a tribal language.', about_ml: 'അക്ഷരങ്ങൾ, വാക്കുകൾ, ചെറിയ വാക്യങ്ങൾ.',
    units: [
      { id: 'swaram', level: 'Pre-A1', title: 'Vowels (സ്വരങ്ങൾ)', title_ml: 'സ്വരാക്ഷരങ്ങൾ', activities: [
        { id: 'v1', kind: 'vocab', title: 'Vowels', title_ml: 'സ്വരങ്ങൾ', cards: [V('അ', 'a — അമ്മ'), V('ആ', 'aa — ആന'), V('ഇ', 'i — ഇല'), V('ഈ', 'ee — ഈച്ച'), V('ഉ', 'u — ഉറുമ്പ്'), V('ഊ', 'oo — ഊഞ്ഞാൽ'), V('എ', 'e — എലി'), V('ഏ', 'ae — ഏണി'), V('ഒ', 'o — ഒട്ടകം'), V('ഓ', 'oa — ഓടം')] },
        { id: 'q1', kind: 'quiz', title: 'Find the letter', title_ml: 'അക്ഷരം കണ്ടെത്തുക', items: [{ q: 'ആന starts with…', options: ['ആ', 'അ', 'ഇ', 'ഒ'], answer: 0 }, { q: 'ഇല starts with…', options: ['ഇ', 'ഈ', 'എ', 'ഉ'], answer: 0 }, { q: 'എലി starts with…', options: ['എ', 'ഏ', 'ഇ', 'അ'], answer: 0 }] },
      ] },
      { id: 'words', level: 'A1', title: 'Everyday words', title_ml: 'നിത്യജീവിത വാക്കുകൾ', activities: [
        { id: 'v1', kind: 'vocab', title: 'Words around us', title_ml: 'ചുറ്റുമുള്ള വാക്കുകൾ', cards: [V('വീട്', 'house'), V('മരം', 'tree'), V('വെള്ളം', 'water'), V('പുഴ', 'river'), V('കാട്', 'forest'), V('സ്കൂൾ', 'school'), V('ബസ്', 'bus'), V('ആശുപത്രി', 'hospital'), V('റേഷൻ കട', 'ration shop'), V('പഞ്ചായത്ത്', 'panchayat')] },
        { id: 'l1', kind: 'listen', title: 'Read signboards', title_ml: 'ബോർഡുകൾ വായിക്കുക', lines: [Ln('ബസ് സ്റ്റോപ്പ്', 'Bus stop'), Ln('ആശുപത്രി', 'Hospital'), Ln('പ്രവേശനം', 'Entrance'), Ln('പുറത്തേക്ക്', 'Exit'), Ln('അപകടം', 'Danger')] },
      ] },
      { id: 'sentences', level: 'A2', title: 'Short sentences', title_ml: 'ചെറിയ വാക്യങ്ങൾ', activities: [
        { id: 'l1', kind: 'listen', title: 'Read aloud', title_ml: 'ഉറക്കെ വായിക്കുക', lines: [Ln('ഞാൻ സ്കൂളിൽ പോകുന്നു.', 'I go to school.'), Ln('അമ്മ ചോറ് വെക്കുന്നു.', 'Mother is cooking rice.'), Ln('മഴ പെയ്യുന്നു.', 'It is raining.'), Ln('ബസ് രാവിലെ എട്ടിന് വരും.', 'The bus comes at eight in the morning.')] },
        { id: 's1', kind: 'speak', title: 'Read a sentence', title_ml: 'ഒരു വാക്യം വായിക്കുക', prompt: 'Read aloud: "എന്റെ ഊരിന്റെ പേര് … ആണ്."', prompt_ml: '"എന്റെ ഊരിന്റെ പേര് … ആണ്." ഉറക്കെ വായിക്കുക.', model: 'എന്റെ ഊരിന്റെ പേര് തേന്മല ആണ്.' },
      ] },
    ],
  },
];

// Mother-tongue bridge: the CONCEPTS are curated; tribal-language words come from the
// community (see language_words table) and are always shown as "community draft".
const BRIDGE_CONCEPTS = [
  ['water', 'വെള്ളം', 'nature'], ['forest', 'കാട്', 'nature'], ['river', 'പുഴ', 'nature'], ['rain', 'മഴ', 'nature'], ['tree', 'മരം', 'nature'], ['elephant', 'ആന', 'animals'], ['honey', 'തേൻ', 'food'],
  ['rice', 'അരി', 'food'], ['food', 'ഭക്ഷണം', 'food'], ['house', 'വീട്', 'home'], ['mother', 'അമ്മ', 'family'], ['father', 'അച്ഛൻ', 'family'], ['child', 'കുട്ടി', 'family'], ['grandmother', 'അമ്മൂമ്മ', 'family'],
  ['come', 'വരൂ', 'verbs'], ['go', 'പോകൂ', 'verbs'], ['eat', 'കഴിക്കൂ', 'verbs'], ['sleep', 'ഉറങ്ങൂ', 'verbs'], ['school', 'സ്കൂൾ', 'places'], ['hospital', 'ആശുപത്രി', 'places'],
  ['one', 'ഒന്ന്', 'numbers'], ['two', 'രണ്ട്', 'numbers'], ['three', 'മൂന്ന്', 'numbers'], ['good', 'നല്ലത്', 'words'], ['yes', 'അതെ', 'words'], ['no', 'ഇല്ല', 'words'],
];
const BRIDGE_LANGS = ['Muthuvan', 'Paniya', 'Irula', 'Kurichiya', 'Kanikkar', 'Mannan', 'Cholanaikkan'];

const LEVELS = ['Pre-A1', 'A1', 'A2'];
const LEVEL_INFO = {
  'Pre-A1': { en: 'First words — can greet and use single words', ml: 'ആദ്യ വാക്കുകൾ', passport: 'ENG.1' },
  A1: { en: 'Can handle simple everyday situations', ml: 'ലളിതമായ നിത്യ സാഹചര്യങ്ങൾ', passport: 'ENG.2' },
  A2: { en: 'Can talk about work and handle an interview', ml: 'ജോലി, ഇന്റർവ്യൂ സംഭാഷണം', passport: 'ENG.3' },
};

const ROLEPLAYS = [
  { id: 'bus', title: 'At the bus stand', title_ml: 'ബസ് സ്റ്റാൻഡിൽ', prompt: 'One person is a traveller who is lost; the other works at the enquiry counter. Find the right bus, time and fare.', prompt_ml: 'ഒരാൾ വഴിതെറ്റിയ യാത്രക്കാരൻ; മറ്റേയാൾ അന്വേഷണ കൗണ്ടറിൽ. ശരിയായ ബസ്, സമയം, കൂലി കണ്ടെത്തുക.' },
  { id: 'doctor', title: 'Doctor and patient', title_ml: 'ഡോക്ടറും രോഗിയും', prompt: 'Patient explains three symptoms. Doctor asks two questions and explains how to take medicine.', prompt_ml: 'രോഗി മൂന്ന് ലക്ഷണങ്ങൾ പറയുന്നു; ഡോക്ടർ രണ്ട് ചോദ്യം ചോദിച്ച് മരുന്ന് വിശദീകരിക്കുന്നു.' },
  { id: 'bank', title: 'Opening a bank account', title_ml: 'ബാങ്ക് അക്കൗണ്ട് തുറക്കൽ', prompt: 'Customer asks what documents are needed; staff explains the form and signature.', prompt_ml: 'ഉപഭോക്താവ് രേഖകൾ ചോദിക്കുന്നു; ജീവനക്കാരൻ ഫോമും ഒപ്പും വിശദീകരിക്കുന്നു.' },
  { id: 'interview', title: 'Mock job interview', title_ml: 'മോക്ക് ഇന്റർവ്യൂ', prompt: 'Interviewer asks: tell me about yourself, your strength, why this job. Swap roles after 3 minutes.', prompt_ml: 'നിങ്ങളെക്കുറിച്ച്, ശക്തി, ജോലി എന്തിന് — 3 മിനിറ്റിന് ശേഷം റോൾ മാറുക.' },
  { id: 'phone', title: 'Phone call to an office', title_ml: 'ഓഫീസിലേക്ക് ഫോൺ', prompt: 'Caller asks about a course; receptionist gives date and time. Practise "Could you repeat that, please?"', prompt_ml: 'കോഴ്സിനെക്കുറിച്ച് ചോദിക്കുക. "Could you repeat that, please?" പരിശീലിക്കുക.' },
  { id: 'hotel', title: 'Hotel check-in', title_ml: 'ഹോട്ടൽ ചെക്ക്-ഇൻ', prompt: 'Receptionist welcomes a guest, asks for ID, explains breakfast and Wi-Fi.', prompt_ml: 'റിസപ്ഷനിസ്റ്റ് അതിഥിയെ സ്വീകരിച്ച് ഐ.ഡി. ചോദിച്ച് സൗകര്യങ്ങൾ വിശദീകരിക്കുന്നു.' },
  { id: 'shop', title: 'Buying at a shop', title_ml: 'കടയിൽ നിന്ന് വാങ്ങൽ', prompt: 'Ask the price of three things, bargain politely and ask for a bill.', prompt_ml: 'മൂന്ന് സാധനങ്ങളുടെ വില ചോദിക്കുക, മര്യാദയോടെ വിലപേശുക, ബിൽ ചോദിക്കുക.' },
  { id: 'mt', title: 'Teach a word from home', title_ml: 'വീട്ടിലെ ഒരു വാക്ക് പഠിപ്പിക്കുക', prompt: 'Each person teaches the group one word from their mother tongue, with the Malayalam and English meaning.', prompt_ml: 'ഓരോരുത്തരും മാതൃഭാഷയിലെ ഒരു വാക്ക് മലയാളം, ഇംഗ്ലീഷ് അർത്ഥത്തോടെ പഠിപ്പിക്കുന്നു.' },
];

module.exports = { COURSES, BRIDGE_CONCEPTS, BRIDGE_LANGS, LEVELS, LEVEL_INFO, ROLEPLAYS };
