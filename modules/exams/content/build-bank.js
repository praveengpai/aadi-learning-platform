'use strict';
// Builds content/questions.json — the AADI exam question bank.
// Authoring convention: the CORRECT option is always written FIRST; the builder shuffles
// options deterministically and records the answer index. Quant + series questions are
// generated arithmetically (correct by construction).
// Run: node modules/exams/content/build-bank.js
const fs = require('fs');
const path = require('path');

let seed = 7741;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
function shuffle(n) { const idx = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } return idx; }

const out = [];
const counters = {};
function Q(subject, topic, diff, q, q_ml, opts, opts_ml, x, x_ml) {
  const order = shuffle(opts.length);
  const prefix = subject.slice(0, 3).toUpperCase();
  counters[prefix] = (counters[prefix] || 0) + 1;
  out.push({
    id: `${prefix}-${String(counters[prefix]).padStart(3, '0')}`,
    subject, topic, difficulty: diff,
    q, q_ml: q_ml || null,
    options: order.map((i) => String(opts[i])),
    options_ml: opts_ml ? order.map((i) => String(opts_ml[i])) : null,
    answer: order.indexOf(0),
    x: x || null, x_ml: x_ml || null,
  });
}

// ------------------------------------------------------------------ KERALA
const K = (topic, d, q, qml, o, oml, x, xml) => Q('kerala', topic, d, q, qml, o, oml, x, xml);
K('state', 1, 'Kerala state was formed on', 'കേരള സംസ്ഥാനം രൂപീകരിച്ചത്', ['1 November 1956', '15 August 1947', '26 January 1950', '1 November 1949'], null, 'Kerala was formed on 1 November 1956 under the States Reorganisation Act. The day is celebrated as Kerala Piravi.', '1956 നവംബർ 1-ന്; ഈ ദിവസം കേരളപ്പിറവിയായി ആഘോഷിക്കുന്നു.');
K('state', 1, 'Capital of Kerala', 'കേരളത്തിന്റെ തലസ്ഥാനം', ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur'], ['തിരുവനന്തപുരം', 'കൊച്ചി', 'കോഴിക്കോട്', 'തൃശ്ശൂർ'], 'Thiruvananthapuram is the capital of Kerala.');
K('state', 1, 'How many districts are there in Kerala?', 'കേരളത്തിൽ എത്ര ജില്ലകളുണ്ട്?', ['14', '12', '13', '15'], null, 'Kerala has 14 districts.', 'കേരളത്തിൽ 14 ജില്ലകൾ.');
K('geography', 2, 'Largest district of Kerala by area', 'വിസ്തീർണ്ണത്തിൽ ഏറ്റവും വലിയ ജില്ല', ['Palakkad', 'Idukki', 'Wayanad', 'Malappuram'], ['പാലക്കാട്', 'ഇടുക്കി', 'വയനാട്', 'മലപ്പുറം'], 'Palakkad is the largest district by area; Idukki is second.');
K('geography', 2, 'Smallest district of Kerala by area', 'വിസ്തീർണ്ണത്തിൽ ഏറ്റവും ചെറിയ ജില്ല', ['Alappuzha', 'Kasaragod', 'Pathanamthitta', 'Kottayam'], ['ആലപ്പുഴ', 'കാസർഗോഡ്', 'പത്തനംതിട്ട', 'കോട്ടയം'], 'Alappuzha is the smallest district by area.');
K('geography', 1, 'Longest river in Kerala', 'കേരളത്തിലെ ഏറ്റവും നീളം കൂടിയ നദി', ['Periyar', 'Bharathapuzha', 'Pamba', 'Chaliyar'], ['പെരിയാർ', 'ഭാരതപ്പുഴ', 'പമ്പ', 'ചാലിയാർ'], 'Periyar (about 244 km) is the longest river of Kerala; Bharathapuzha is second.');
K('symbols', 1, 'State bird of Kerala', 'കേരളത്തിന്റെ സംസ്ഥാന പക്ഷി', ['Great Hornbill', 'Peacock', 'Kingfisher', 'Myna'], ['മലമുഴക്കി വേഴാമ്പൽ', 'മയിൽ', 'പൊന്മാൻ', 'മൈന'], 'The Great Hornbill (Malamuzhakki Vezhambal) is the state bird.');
K('symbols', 1, 'State animal of Kerala', 'കേരളത്തിന്റെ സംസ്ഥാന മൃഗം', ['Indian Elephant', 'Tiger', 'Nilgiri Tahr', 'Lion-tailed Macaque'], ['ആന', 'കടുവ', 'വരയാട്', 'സിംഹവാലൻ കുരങ്ങ്'], 'The Indian elephant is the state animal of Kerala.');
K('symbols', 1, 'State flower of Kerala', 'കേരളത്തിന്റെ സംസ്ഥാന പുഷ്പം', ['Kanikkonna (Golden Shower)', 'Lotus', 'Jasmine', 'Hibiscus'], ['കണിക്കൊന്ന', 'താമര', 'മുല്ല', 'ചെമ്പരത്തി'], 'Kanikkonna (Cassia fistula) is the state flower — it is used for Vishukkani.');
K('symbols', 1, 'State tree of Kerala', 'കേരളത്തിന്റെ സംസ്ഥാന വൃക്ഷം', ['Coconut tree', 'Teak', 'Jackfruit tree', 'Rosewood'], ['തെങ്ങ്', 'തേക്ക്', 'പ്ലാവ്', 'ഈട്ടി'], 'The coconut tree is the state tree of Kerala.');
K('symbols', 1, 'State fish of Kerala', 'കേരളത്തിന്റെ സംസ്ഥാന മത്സ്യം', ['Karimeen (Pearl spot)', 'Mathi (Sardine)', 'Ayala (Mackerel)', 'Rohu'], ['കരിമീൻ', 'മത്തി', 'അയല', 'രോഹു'], 'Karimeen (Green chromide / pearl spot) is the state fish.');
K('symbols', 1, 'State fruit of Kerala', 'കേരളത്തിന്റെ സംസ്ഥാന ഫലം', ['Jackfruit', 'Mango', 'Banana', 'Pineapple'], ['ചക്ക', 'മാങ്ങ', 'വാഴപ്പഴം', 'കൈതച്ചക്ക'], 'Jackfruit was declared the state fruit in 2018.');
K('geography', 1, 'Highest peak in Kerala', 'കേരളത്തിലെ ഏറ്റവും ഉയരം കൂടിയ കൊടുമുടി', ['Anamudi', 'Agasthyakoodam', 'Chembra', 'Ponmudi'], ['ആനമുടി', 'അഗസ്ത്യകൂടം', 'ചെമ്പ്ര', 'പൊന്മുടി'], 'Anamudi (2,695 m) in Idukki is the highest peak in Kerala and in South India.');
K('politics', 1, 'First Chief Minister of Kerala', 'കേരളത്തിലെ ആദ്യ മുഖ്യമന്ത്രി', ['E. M. S. Namboodiripad', 'Pattom A. Thanu Pillai', 'R. Sankar', 'C. Achutha Menon'], ['ഇ. എം. എസ്. നമ്പൂതിരിപ്പാട്', 'പട്ടം താണുപിള്ള', 'ആർ. ശങ്കർ', 'സി. അച്യുതമേനോൻ'], 'E. M. S. Namboodiripad became the first Chief Minister in 1957.');
K('politics', 2, 'First Governor of Kerala', 'കേരളത്തിലെ ആദ്യ ഗവർണർ', ['B. Ramakrishna Rao', 'V. V. Giri', 'P. S. Rao', 'Ajit Prasad Jain'], null, 'B. Ramakrishna Rao was the first Governor of Kerala (1956).');
K('environment', 1, 'Silent Valley National Park is in which district?', 'സൈലന്റ് വാലി ദേശീയോദ്യാനം ഏത് ജില്ലയിൽ?', ['Palakkad', 'Wayanad', 'Idukki', 'Kollam'], ['പാലക്കാട്', 'വയനാട്', 'ഇടുക്കി', 'കൊല്ലം'], 'Silent Valley is in the Mannarkkad area of Palakkad district.');
K('environment', 1, 'Eravikulam National Park is famous for', 'ഇരവികുളം ദേശീയോദ്യാനം പ്രസിദ്ധമായത്', ['Nilgiri Tahr', 'One-horned rhinoceros', 'Asiatic lion', 'Snow leopard'], ['വരയാട്', 'കാണ്ടാമൃഗം', 'സിംഹം', 'ഹിമപ്പുലി'], 'Eravikulam (Idukki) protects the endangered Nilgiri Tahr (Varayadu).');
K('politics', 1, 'Number of Lok Sabha seats from Kerala', 'കേരളത്തിലെ ലോക്സഭാ സീറ്റുകൾ', ['20', '18', '21', '9'], null, 'Kerala sends 20 members to the Lok Sabha.');
K('politics', 2, 'Number of Rajya Sabha seats from Kerala', 'കേരളത്തിലെ രാജ്യസഭാ സീറ്റുകൾ', ['9', '20', '7', '11'], null, 'Kerala has 9 Rajya Sabha seats.');
K('politics', 1, 'Number of elected seats in the Kerala Legislative Assembly', 'കേരള നിയമസഭയിലെ തിരഞ്ഞെടുക്കപ്പെടുന്ന സീറ്റുകൾ', ['140', '120', '150', '160'], null, 'The Kerala Legislative Assembly has 140 elected members.');
K('geography', 2, 'Largest freshwater lake in Kerala', 'കേരളത്തിലെ ഏറ്റവും വലിയ ശുദ്ധജല തടാകം', ['Sasthamkotta', 'Vembanad', 'Ashtamudi', 'Pookode'], ['ശാസ്താംകോട്ട', 'വേമ്പനാട്', 'അഷ്ടമുടി', 'പൂക്കോട്'], 'Sasthamkotta (Kollam) is the largest freshwater lake. Vembanad is the largest backwater lake.');
K('geography', 1, 'Largest lake (backwater) in Kerala', 'കേരളത്തിലെ ഏറ്റവും വലിയ കായൽ', ['Vembanad', 'Sasthamkotta', 'Ashtamudi', 'Veli'], ['വേമ്പനാട്', 'ശാസ്താംകോട്ട', 'അഷ്ടമുടി', 'വേളി'], 'Vembanad Kayal is the largest lake in Kerala.');
K('environment', 1, 'Periyar Tiger Reserve (Thekkady) is in which district?', 'പെരിയാർ കടുവ സങ്കേതം (തേക്കടി) ഏത് ജില്ലയിൽ?', ['Idukki', 'Pathanamthitta', 'Wayanad', 'Palakkad'], ['ഇടുക്കി', 'പത്തനംതിട്ട', 'വയനാട്', 'പാലക്കാട്'], 'Thekkady / Periyar Tiger Reserve is in Idukki district.');
K('renaissance', 1, 'Vaikom Satyagraha took place in', 'വൈക്കം സത്യാഗ്രഹം നടന്ന വർഷം', ['1924–25', '1931–32', '1936', '1947'], null, 'Vaikom Satyagraha (1924–25) demanded the right of all castes to use the roads around the Vaikom temple.');
K('renaissance', 1, '"One caste, one religion, one God for man" was the message of', '"ഒരു ജാതി, ഒരു മതം, ഒരു ദൈവം മനുഷ്യന്" — ആരുടെ സന്ദേശം?', ['Sree Narayana Guru', 'Chattampi Swamikal', 'Ayyankali', 'Vagbhatananda'], ['ശ്രീനാരായണ ഗുരു', 'ചട്ടമ്പിസ്വാമികൾ', 'അയ്യങ്കാളി', 'വാഗ്ഭടാനന്ദൻ'], 'This is the famous message of Sree Narayana Guru.');
K('renaissance', 2, 'Sadhu Jana Paripalana Sangham (1907) was founded by', 'സാധുജന പരിപാലന സംഘം സ്ഥാപിച്ചത്', ['Ayyankali', 'Sree Narayana Guru', 'Mannathu Padmanabhan', 'Pandit Karuppan'], ['അയ്യങ്കാളി', 'ശ്രീനാരായണ ഗുരു', 'മന്നത്ത് പത്മനാഭൻ', 'പണ്ഡിറ്റ് കറുപ്പൻ'], 'Ayyankali founded the Sadhu Jana Paripalana Sangham in 1907.');
K('renaissance', 1, 'Nair Service Society (NSS) was founded in 1914 by', 'എൻ.എസ്.എസ് (1914) സ്ഥാപിച്ചത്', ['Mannathu Padmanabhan', 'K. Kelappan', 'C. V. Kunhiraman', 'T. K. Madhavan'], ['മന്നത്ത് പത്മനാഭൻ', 'കെ. കേളപ്പൻ', 'സി. വി. കുഞ്ഞിരാമൻ', 'ടി. കെ. മാധവൻ'], 'Mannathu Padmanabhan founded the NSS in 1914.');
K('renaissance', 2, 'SNDP Yogam was founded in', 'എസ്.എൻ.ഡി.പി യോഗം സ്ഥാപിതമായ വർഷം', ['1903', '1914', '1888', '1924'], null, 'The SNDP Yogam was founded in 1903 with Sree Narayana Guru as its president.');
K('renaissance', 2, 'Temple Entry Proclamation of Travancore was issued in', 'ക്ഷേത്രപ്രവേശന വിളംബരം', ['1936', '1924', '1947', '1932'], null, 'Sree Chithira Thirunal issued the Temple Entry Proclamation on 12 November 1936.');
K('renaissance', 2, 'Guruvayur Satyagraha (1931–32) was led by', 'ഗുരുവായൂർ സത്യാഗ്രഹം നയിച്ചത്', ['K. Kelappan', 'A. K. Gopalan', 'Mannathu Padmanabhan', 'T. K. Madhavan'], ['കെ. കേളപ്പൻ', 'എ. കെ. ഗോപാലൻ', 'മന്നത്ത് പത്മനാഭൻ', 'ടി. കെ. മാധവൻ'], 'K. Kelappan (Kerala Gandhi) led the Guruvayur Satyagraha; A. K. Gopalan was the volunteer captain.');
K('geography', 2, 'How many rivers are there in Kerala?', 'കേരളത്തിൽ എത്ര നദികളുണ്ട്?', ['44', '41', '3', '48'], null, 'Kerala has 44 rivers: 41 flow west and 3 flow east.');
K('geography', 2, 'Which of these rivers flows east from Kerala?', 'കിഴക്കോട്ട് ഒഴുകുന്ന നദി ഏത്?', ['Kabani', 'Periyar', 'Chaliyar', 'Pamba'], ['കബനി', 'പെരിയാർ', 'ചാലിയാർ', 'പമ്പ'], 'Kabani, Bhavani and Pambar are the three east-flowing rivers.');
K('culture', 1, 'Kerala Kalamandalam was founded by', 'കേരള കലാമണ്ഡലം സ്ഥാപിച്ചത്', ['Vallathol Narayana Menon', 'Kumaran Asan', 'Ulloor', 'G. Sankara Kurup'], ['വള്ളത്തോൾ നാരായണമേനോൻ', 'കുമാരനാശാൻ', 'ഉള്ളൂർ', 'ജി. ശങ്കരക്കുറുപ്പ്'], 'Vallathol founded Kerala Kalamandalam in 1930; it is at Cheruthuruthy, Thrissur.');
K('culture', 2, 'Malayalam was given classical language status in', 'മലയാളത്തിന് ശ്രേഷ്ഠഭാഷാ പദവി ലഭിച്ച വർഷം', ['2013', '2004', '2008', '2016'], null, 'Malayalam became a classical language of India in 2013.');
K('culture', 1, 'The first Jnanpith Award (1965) was won by', 'ആദ്യ ജ്ഞാനപീഠ പുരസ്കാരം നേടിയത്', ['G. Sankara Kurup', 'S. K. Pottekkatt', 'Thakazhi', 'M. T. Vasudevan Nair'], ['ജി. ശങ്കരക്കുറുപ്പ്', 'എസ്. കെ. പൊറ്റെക്കാട്', 'തകഴി', 'എം. ടി. വാസുദേവൻ നായർ'], 'G. Sankara Kurup won the first Jnanpith Award for "Odakkuzhal".');
K('state', 1, 'Headquarters of the Kerala Public Service Commission', 'കേരള പി.എസ്.സി ആസ്ഥാനം', ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Kottayam'], ['തിരുവനന്തപുരം', 'കൊച്ചി', 'കോഴിക്കോട്', 'കോട്ടയം'], 'Kerala PSC is headquartered at Pattom, Thiruvananthapuram.');
K('tribal', 1, 'Attappadi tribal area is in which district?', 'അട്ടപ്പാടി ഏത് ജില്ലയിൽ?', ['Palakkad', 'Wayanad', 'Idukki', 'Malappuram'], ['പാലക്കാട്', 'വയനാട്', 'ഇടുക്കി', 'മലപ്പുറം'], 'Attappadi is a tribal block in Palakkad district, home to Irula, Muduga and Kurumba communities.');
K('tourism', 1, 'Edakkal Caves are in', 'എടക്കൽ ഗുഹ ഏത് ജില്ലയിൽ?', ['Wayanad', 'Idukki', 'Kannur', 'Kollam'], ['വയനാട്', 'ഇടുക്കി', 'കണ്ണൂർ', 'കൊല്ലം'], 'Edakkal Caves, with ancient rock engravings, are in Wayanad.');
K('tourism', 1, 'Kuruva Island (Kuruvadweep) is in', 'കുറുവ ദ്വീപ് ഏത് ജില്ലയിൽ?', ['Wayanad', 'Alappuzha', 'Ernakulam', 'Kasaragod'], ['വയനാട്', 'ആലപ്പുഴ', 'എറണാകുളം', 'കാസർഗോഡ്'], 'Kuruva Island is on the Kabani river in Wayanad.');
K('tourism', 1, 'Bekal Fort is in', 'ബേക്കൽ കോട്ട ഏത് ജില്ലയിൽ?', ['Kasaragod', 'Kannur', 'Kozhikode', 'Thrissur'], ['കാസർഗോഡ്', 'കണ്ണൂർ', 'കോഴിക്കോട്', 'തൃശ്ശൂർ'], 'Bekal Fort is in Kasaragod district.');
K('geography', 1, 'Northernmost district of Kerala', 'കേരളത്തിന്റെ ഏറ്റവും വടക്കേ ജില്ല', ['Kasaragod', 'Kannur', 'Wayanad', 'Thiruvananthapuram'], ['കാസർഗോഡ്', 'കണ്ണൂർ', 'വയനാട്', 'തിരുവനന്തപുരം'], 'Kasaragod is the northernmost district; Thiruvananthapuram is the southernmost.');
K('geography', 1, 'Which of these districts has no sea coast?', 'കടൽത്തീരമില്ലാത്ത ജില്ല ഏത്?', ['Idukki', 'Kollam', 'Alappuzha', 'Kannur'], ['ഇടുക്കി', 'കൊല്ലം', 'ആലപ്പുഴ', 'കണ്ണൂർ'], 'Idukki is landlocked (so are Wayanad, Palakkad, Pathanamthitta and Kottayam).');
K('state', 2, 'First town in India to achieve total literacy (1989)', 'സമ്പൂർണ സാക്ഷരത നേടിയ ആദ്യ പട്ടണം', ['Kottayam', 'Ernakulam', 'Thrissur', 'Kozhikode'], ['കോട്ടയം', 'എറണാകുളം', 'തൃശ്ശൂർ', 'കോഴിക്കോട്'], 'Kottayam town achieved total literacy in 1989; Ernakulam became the first fully literate district in 1990.');
K('culture', 1, 'Onam is celebrated in the Malayalam month of', 'ഓണം ഏത് മലയാള മാസത്തിൽ?', ['Chingam', 'Medam', 'Kanni', 'Karkidakam'], ['ചിങ്ങം', 'മേടം', 'കന്നി', 'കർക്കിടകം'], 'Onam falls in Chingam, the first month of the Malayalam calendar.');
K('culture', 2, 'The Kollavarsham (Malayalam Era) began in', 'കൊല്ലവർഷം ആരംഭിച്ചത്', ['825 CE', '1056 CE', '788 CE', '1498 CE'], null, 'The Kollam Era (Kollavarsham) began in 825 CE.');
K('culture', 1, 'Which is a classical dance form of Kerala?', 'കേരളത്തിന്റെ ശാസ്ത്രീയ നൃത്തരൂപം ഏത്?', ['Mohiniyattam', 'Kuchipudi', 'Bharatanatyam', 'Odissi'], ['മോഹിനിയാട്ടം', 'കുച്ചിപ്പുടി', 'ഭരതനാട്യം', 'ഒഡിസ്സി'], 'Mohiniyattam and Kathakali are classical dance forms of Kerala.');
K('history', 2, 'Before 1956, the Malabar region was part of', '1956-ന് മുമ്പ് മലബാർ ഏതിന്റെ ഭാഗമായിരുന്നു?', ['Madras Presidency', 'Travancore', 'Mysore State', 'Bombay Presidency'], ['മദ്രാസ് പ്രസിഡൻസി', 'തിരുവിതാംകൂർ', 'മൈസൂർ', 'ബോംബെ പ്രസിഡൻസി'], 'Malabar was a district of the Madras Presidency under British rule.');
K('literature', 1, 'Father of modern Malayalam literature', 'ആധുനിക മലയാള ഭാഷയുടെ പിതാവ്', ['Thunchath Ezhuthachan', 'Kunchan Nambiar', 'Cherusseri', 'Kumaran Asan'], ['തുഞ്ചത്ത് എഴുത്തച്ഛൻ', 'കുഞ്ചൻ നമ്പ്യാർ', 'ചെറുശ്ശേരി', 'കുമാരനാശാൻ'], 'Thunchath Ramanujan Ezhuthachan is called the father of the Malayalam language.');
K('literature', 1, '"Veena Poovu" was written by', '"വീണപൂവ്" രചിച്ചത്', ['Kumaran Asan', 'Vallathol', 'Ulloor', 'Changampuzha'], ['കുമാരനാശാൻ', 'വള്ളത്തോൾ', 'ഉള്ളൂർ', 'ചങ്ങമ്പുഴ'], 'Kumaran Asan wrote "Veena Poovu" (The Fallen Flower) in 1907.');
K('tribal', 2, 'Which district of Kerala has the largest Scheduled Tribe population?', 'ഏറ്റവും കൂടുതൽ പട്ടികവർഗക്കാരുള്ള ജില്ല', ['Wayanad', 'Idukki', 'Palakkad', 'Kasaragod'], ['വയനാട്', 'ഇടുക്കി', 'പാലക്കാട്', 'കാസർഗോഡ്'], 'Wayanad has the largest Scheduled Tribe population in Kerala (Census 2011).');
K('tribal', 2, 'The largest Scheduled Tribe community in Kerala', 'കേരളത്തിലെ ഏറ്റവും വലിയ ഗോത്രവിഭാഗം', ['Paniya', 'Irula', 'Muthuvan', 'Kani'], ['പണിയ', 'ഇരുള', 'മുതുവാൻ', 'കാണി'], 'The Paniya are the most populous Scheduled Tribe community in Kerala.');
K('history', 2, 'Kurichiya revolt against the British took place in Wayanad in', 'കുറിച്യ കലാപം നടന്ന വർഷം', ['1812', '1857', '1921', '1792'], null, 'The Kurichiya revolt of 1812 in Wayanad was a tribal uprising against British revenue policy.');
K('environment', 1, 'Neelakurinji, which blooms once in 12 years, is famous in', 'പന്ത്രണ്ട് വർഷത്തിലൊരിക്കൽ പൂക്കുന്ന നീലക്കുറിഞ്ഞി പ്രസിദ്ധമായ സ്ഥലം', ['Munnar', 'Kovalam', 'Kumarakom', 'Bekal'], ['മൂന്നാർ', 'കോവളം', 'കുമരകം', 'ബേക്കൽ'], 'Neelakurinji blooms across the Munnar hills (Idukki) once every 12 years.');
K('state', 1, 'The Kerala High Court is located at', 'കേരള ഹൈക്കോടതി സ്ഥിതി ചെയ്യുന്നത്', ['Kochi (Ernakulam)', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur'], ['കൊച്ചി (എറണാകുളം)', 'തിരുവനന്തപുരം', 'കോഴിക്കോട്', 'തൃശ്ശൂർ'], 'The High Court of Kerala is in Ernakulam, Kochi.');
K('economy', 2, 'First hydroelectric project of Kerala', 'കേരളത്തിലെ ആദ്യ ജലവൈദ്യുത പദ്ധതി', ['Pallivasal', 'Idukki', 'Sabarigiri', 'Kuttiyadi'], ['പള്ളിവാസൽ', 'ഇടുക്കി', 'ശബരിഗിരി', 'കുറ്റ്യാടി'], 'Pallivasal (Idukki) was commissioned in 1940.');
K('economy', 1, 'The world\'s first fully solar-powered airport is', 'ലോകത്തിലെ ആദ്യ സമ്പൂർണ സൗരോർജ വിമാനത്താവളം', ['Cochin International Airport', 'Thiruvananthapuram Airport', 'Kannur Airport', 'Calicut Airport'], ['കൊച്ചി അന്താരാഷ്ട്ര വിമാനത്താവളം', 'തിരുവനന്തപുരം', 'കണ്ണൂർ', 'കോഴിക്കോട്'], 'Cochin International Airport (CIAL) became fully solar powered in 2015.');
K('state', 2, 'How many Municipal Corporations are there in Kerala?', 'കേരളത്തിലെ കോർപ്പറേഷനുകളുടെ എണ്ണം', ['6', '5', '8', '14'], null, 'Thiruvananthapuram, Kollam, Kochi, Thrissur, Kozhikode and Kannur.');
K('economy', 1, 'Kudumbashree, Kerala\'s women self-help network, was launched in', 'കുടുംബശ്രീ ആരംഭിച്ച വർഷം', ['1998', '1991', '2005', '2010'], null, 'Kudumbashree, the State Poverty Eradication Mission, was launched in 1998.');
K('history', 1, 'Vasco da Gama landed at Kappad near Kozhikode in', 'വാസ്കോ ഡ ഗാമ കാപ്പാട് എത്തിയ വർഷം', ['1498', '1492', '1510', '1600'], null, 'Vasco da Gama reached Kappad, near Kozhikode, in May 1498.');
K('history', 2, 'Pazhassi Raja, the "Kerala Simham", fought the British mainly from', '"കേരളസിംഹം" പഴശ്ശിരാജ ബ്രിട്ടീഷുകാരോട് പോരാടിയത് പ്രധാനമായും', ['Wayanad forests', 'Alappuzha backwaters', 'Kochi port', 'Thiruvananthapuram'], ['വയനാടൻ കാടുകൾ', 'ആലപ്പുഴ', 'കൊച്ചി', 'തിരുവനന്തപുരം'], 'Pazhassi Raja led guerrilla resistance from the Wayanad forests, with Kurichiya and Kurumba fighters. He died in 1805.');
K('history', 2, 'Kundara Proclamation (1809) was made by', 'കുണ്ടറ വിളംബരം നടത്തിയത്', ['Velu Thampi Dalawa', 'Pazhassi Raja', 'Marthanda Varma', 'Paliath Achan'], ['വേലുത്തമ്പി ദളവ', 'പഴശ്ശിരാജ', 'മാർത്താണ്ഡവർമ്മ', 'പാലിയത്തച്ചൻ'], 'Velu Thampi Dalawa of Travancore issued the Kundara Proclamation against the British in 1809.');
K('history', 2, 'The Attingal revolt against the English East India Company took place in', 'ആറ്റിങ്ങൽ കലാപം', ['1721', '1757', '1809', '1857'], null, 'The Attingal revolt of 1721 is often cited as the first organised revolt against the British in India.');
K('history', 2, 'Salt Satyagraha in Kerala (1930) was held at', 'കേരളത്തിൽ ഉപ്പുസത്യാഗ്രഹം നടന്നത്', ['Payyannur', 'Vaikom', 'Guruvayur', 'Kozhikode beach only'], ['പയ്യന്നൂർ', 'വൈക്കം', 'ഗുരുവായൂർ', 'കോഴിക്കോട് മാത്രം'], 'K. Kelappan led the Salt Satyagraha march to Payyannur in 1930.');
K('economy', 1, 'Kerala is the largest producer of which crop in India?', 'ഇന്ത്യയിൽ ഏറ്റവും കൂടുതൽ ഉത്പാദിപ്പിക്കുന്ന സംസ്ഥാനം കേരളമായ വിള', ['Natural rubber', 'Tea', 'Wheat', 'Cotton'], ['റബ്ബർ', 'തേയില', 'ഗോതമ്പ്', 'പരുത്തി'], 'Kerala produces most of India\'s natural rubber.');
K('environment', 2, 'The Idukki arch dam is built across the river', 'ഇടുക്കി ആർച്ച് ഡാം ഏത് നദിയിൽ?', ['Periyar', 'Pamba', 'Bharathapuzha', 'Chalakudy'], ['പെരിയാർ', 'പമ്പ', 'ഭാരതപ്പുഴ', 'ചാലക്കുടി'], 'The Idukki arch dam is on the Periyar, between the Kuravanmala and Kurathimala hills.');

// ------------------------------------------------------------------ POLITY / CONSTITUTION
const P = (topic, d, q, qml, o, oml, x, xml) => Q('polity', topic, d, q, qml, o, oml, x, xml);
P('basics', 1, 'The Constitution of India came into force on', 'ഇന്ത്യൻ ഭരണഘടന നിലവിൽ വന്നത്', ['26 January 1950', '26 November 1949', '15 August 1947', '2 October 1950'], null, 'It was adopted on 26 November 1949 and came into force on 26 January 1950 (Republic Day).');
P('basics', 1, 'Constitution Day (Samvidhan Divas) is observed on', 'ഭരണഘടനാ ദിനം', ['26 November', '26 January', '15 August', '10 December'], null, 'The Constitution was adopted on 26 November 1949.');
P('basics', 1, 'Chairman of the Drafting Committee of the Constitution', 'ഭരണഘടനാ കരട് സമിതി അധ്യക്ഷൻ', ['Dr. B. R. Ambedkar', 'Dr. Rajendra Prasad', 'Jawaharlal Nehru', 'Sardar Patel'], ['ഡോ. ബി. ആർ. അംബേദ്കർ', 'ഡോ. രാജേന്ദ്ര പ്രസാദ്', 'ജവഹർലാൽ നെഹ്റു', 'സർദാർ പട്ടേൽ'], 'Dr. B. R. Ambedkar chaired the Drafting Committee.');
P('basics', 1, 'President of the Constituent Assembly', 'ഭരണഘടനാ നിർമ്മാണ സഭയുടെ അധ്യക്ഷൻ', ['Dr. Rajendra Prasad', 'Dr. B. R. Ambedkar', 'Sachchidananda Sinha', 'B. N. Rau'], ['ഡോ. രാജേന്ദ്ര പ്രസാദ്', 'ഡോ. ബി. ആർ. അംബേദ്കർ', 'സച്ചിദാനന്ദ സിൻഹ', 'ബി. എൻ. റാവു'], 'Dr. Rajendra Prasad was the permanent President of the Constituent Assembly.');
P('rights', 1, 'Fundamental Rights are in which Part of the Constitution?', 'മൗലികാവകാശങ്ങൾ ഭരണഘടനയുടെ ഏത് ഭാഗത്ത്?', ['Part III', 'Part IV', 'Part II', 'Part V'], null, 'Part III (Articles 12–35) contains Fundamental Rights.');
P('rights', 1, 'Directive Principles of State Policy are in', 'നിർദ്ദേശക തത്വങ്ങൾ ഏത് ഭാഗത്ത്?', ['Part IV', 'Part III', 'Part IVA', 'Part VI'], null, 'Part IV (Articles 36–51) contains the Directive Principles.');
P('rights', 2, 'Fundamental Duties were added by the', 'മൗലിക കടമകൾ കൂട്ടിച്ചേർത്ത ഭേദഗതി', ['42nd Amendment (1976)', '44th Amendment (1978)', '73rd Amendment (1992)', '86th Amendment (2002)'], null, 'The 42nd Amendment added Article 51A (Part IVA) on Fundamental Duties.');
P('rights', 2, 'Right to Education for children aged 6–14 is in Article', 'വിദ്യാഭ്യാസ അവകാശം ഏത് അനുച്ഛേദം?', ['21A', '45', '32', '19'], null, 'Article 21A was inserted by the 86th Amendment (2002).');
P('rights', 1, 'Article 17 of the Constitution deals with', 'അനുച്ഛേദം 17', ['Abolition of untouchability', 'Right to equality', 'Freedom of speech', 'Right to education'], ['തൊട്ടുകൂടായ്മ നിർമ്മാർജനം', 'സമത്വാവകാശം', 'അഭിപ്രായ സ്വാതന്ത്ര്യം', 'വിദ്യാഭ്യാസ അവകാശം'], 'Article 17 abolishes untouchability and forbids its practice in any form.');
P('rights', 1, 'Dr. Ambedkar called which Article the "heart and soul" of the Constitution?', 'ഭരണഘടനയുടെ "ഹൃദയവും ആത്മാവും" എന്ന് അംബേദ്കർ വിശേഷിപ്പിച്ചത്', ['Article 32', 'Article 21', 'Article 14', 'Article 370'], null, 'Article 32 — the Right to Constitutional Remedies.');
P('rights', 1, 'Article 14 guarantees', 'അനുച്ഛേദം 14 ഉറപ്പുനൽകുന്നത്', ['Equality before law', 'Freedom of religion', 'Right against exploitation', 'Protection of minorities'], ['നിയമത്തിനുമുന്നിൽ സമത്വം', 'മതസ്വാതന്ത്ര്യം', 'ചൂഷണത്തിനെതിരായ അവകാശം', 'ന്യൂനപക്ഷ സംരക്ഷണം'], 'Article 14: equality before law and equal protection of laws.');
P('rights', 1, 'Article 21 protects', 'അനുച്ഛേദം 21 സംരക്ഷിക്കുന്നത്', ['Life and personal liberty', 'Right to property', 'Right to vote', 'Freedom of trade'], ['ജീവനും വ്യക്തിസ്വാതന്ത്ര്യവും', 'സ്വത്തവകാശം', 'വോട്ടവകാശം', 'വ്യാപാര സ്വാതന്ത്ര്യം'], 'Article 21: no person shall be deprived of life or personal liberty except by procedure established by law.');
P('parliament', 1, 'Minimum age to become a Lok Sabha member', 'ലോക്സഭാംഗമാകാൻ കുറഞ്ഞ പ്രായം', ['25 years', '21 years', '30 years', '35 years'], null, 'Lok Sabha: 25 years; Rajya Sabha: 30 years.');
P('executive', 1, 'Minimum age to become President of India', 'രാഷ്ട്രപതിയാകാൻ കുറഞ്ഞ പ്രായം', ['35 years', '30 years', '25 years', '40 years'], null, 'A candidate for President must be at least 35 years old.');
P('parliament', 2, 'Maximum strength of the Rajya Sabha', 'രാജ്യസഭയുടെ പരമാവധി അംഗസംഖ്യ', ['250', '245', '552', '238'], null, 'Up to 250 members: 238 from States/UTs and 12 nominated by the President.');
P('elections', 1, 'Voting age was lowered from 21 to 18 by the', 'വോട്ടിംഗ് പ്രായം 18 ആക്കിയ ഭേദഗതി', ['61st Amendment', '42nd Amendment', '73rd Amendment', '52nd Amendment'], null, 'The 61st Amendment Act (1988) lowered the voting age to 18.');
P('local', 1, 'Constitutional status to Panchayati Raj was given by the', 'പഞ്ചായത്തീരാജിന് ഭരണഘടനാ പദവി നൽകിയ ഭേദഗതി', ['73rd Amendment', '74th Amendment', '42nd Amendment', '86th Amendment'], null, '73rd Amendment (1992) for Panchayats; 74th for Municipalities.');
P('rights', 1, 'How many Fundamental Duties are there now?', 'ഇപ്പോൾ എത്ര മൗലിക കടമകൾ?', ['11', '10', '6', '12'], null, 'Originally 10; the 86th Amendment added the 11th (parents to provide education to children 6–14).');
P('executive', 1, 'The Governor of a State is appointed by the', 'ഗവർണറെ നിയമിക്കുന്നത്', ['President', 'Prime Minister', 'Chief Minister', 'Chief Justice'], ['രാഷ്ട്രപതി', 'പ്രധാനമന്ത്രി', 'മുഖ്യമന്ത്രി', 'ചീഫ് ജസ്റ്റിസ്'], 'Article 155: the Governor is appointed by the President.');
P('basics', 1, 'The Eighth Schedule of the Constitution lists', 'എട്ടാം പട്ടികയിൽ ഉൾപ്പെടുന്നത്', ['Official languages (22)', 'Union and State lists', 'Oaths', 'Anti-defection rules'], ['22 ഭാഷകൾ', 'യൂണിയൻ/സംസ്ഥാന ലിസ്റ്റുകൾ', 'സത്യപ്രതിജ്ഞകൾ', 'കൂറുമാറ്റ നിരോധനം'], 'The Eighth Schedule recognises 22 languages, including Malayalam.');
P('tribal', 2, 'The Fifth Schedule deals with', 'അഞ്ചാം പട്ടിക', ['Administration of Scheduled Areas and Scheduled Tribes', 'Tribal areas of Assam, Meghalaya, Tripura, Mizoram', 'Official languages', 'Anti-defection'], ['പട്ടികവർഗ മേഖലകളുടെ ഭരണം', 'വടക്കുകിഴക്കൻ ഗോത്രമേഖലകൾ', 'ഭാഷകൾ', 'കൂറുമാറ്റം'], 'Fifth Schedule: Scheduled Areas and STs; Sixth Schedule: tribal areas of four north-eastern states.');
P('tribal', 2, 'Scheduled Tribes for each State are specified under Article', 'പട്ടികവർഗങ്ങളെ നിർണ്ണയിക്കുന്ന അനുച്ഛേദം', ['342', '341', '338', '356'], null, 'Article 342 (STs); Article 341 (SCs).');
P('tribal', 3, 'The National Commission for Scheduled Tribes was created under Article', 'ദേശീയ പട്ടികവർഗ കമ്മീഷൻ — അനുച്ഛേദം', ['338A', '338', '340', '350A'], null, 'The 89th Amendment (2003) inserted Article 338A creating a separate NCST.');
P('basics', 2, 'The words "Socialist" and "Secular" were added to the Preamble by the', '"സോഷ്യലിസ്റ്റ്", "സെക്കുലർ" എന്നിവ ആമുഖത്തിൽ ചേർത്തത്', ['42nd Amendment', '44th Amendment', '1st Amendment', '61st Amendment'], null, 'The 42nd Amendment (1976) added "Socialist", "Secular" and "Integrity".');
P('emergency', 2, 'National Emergency is declared under Article', 'ദേശീയ അടിയന്തരാവസ്ഥ — അനുച്ഛേദം', ['352', '356', '360', '365'], null, '352: National Emergency; 356: President\'s Rule; 360: Financial Emergency.');
P('emergency', 2, 'President\'s Rule in a State is imposed under Article', 'സംസ്ഥാനത്ത് രാഷ്ട്രപതി ഭരണം — അനുച്ഛേദം', ['356', '352', '360', '370'], null, 'Article 356 deals with failure of constitutional machinery in a State.');
P('parliament', 1, 'The ex-officio Chairman of the Rajya Sabha is the', 'രാജ്യസഭയുടെ എക്സ് ഒഫീഷ്യോ ചെയർമാൻ', ['Vice-President', 'President', 'Speaker', 'Prime Minister'], ['ഉപരാഷ്ട്രപതി', 'രാഷ്ട്രപതി', 'സ്പീക്കർ', 'പ്രധാനമന്ത്രി'], 'The Vice-President of India chairs the Rajya Sabha.');
P('elections', 2, 'The Election Commission of India is established under Article', 'തിരഞ്ഞെടുപ്പ് കമ്മീഷൻ — അനുച്ഛേദം', ['324', '280', '315', '148'], null, 'Article 324 vests superintendence of elections in the Election Commission.');
P('executive', 1, 'The Supreme Commander of India\'s armed forces is the', 'ഇന്ത്യൻ സായുധസേനകളുടെ പരമോന്നത മേധാവി', ['President', 'Prime Minister', 'Defence Minister', 'Chief of Defence Staff'], ['രാഷ്ട്രപതി', 'പ്രധാനമന്ത്രി', 'പ്രതിരോധ മന്ത്രി', 'സംയുക്ത സേനാ മേധാവി'], 'Article 53: supreme command of the Defence Forces is vested in the President.');
P('acts', 1, 'The Right to Information (RTI) Act was passed in', 'വിവരാവകാശ നിയമം', ['2005', '2002', '2009', '1996'], null, 'The RTI Act, 2005 lets any citizen request information from public authorities.');
P('acts', 2, 'The Forest Rights Act, recognising rights of Scheduled Tribes and other forest dwellers, was enacted in', 'വനാവകാശ നിയമം', ['2006', '1980', '1996', '2013'], null, 'The Scheduled Tribes and Other Traditional Forest Dwellers (Recognition of Forest Rights) Act, 2006.');
P('acts', 2, 'PESA, extending Panchayat provisions to Scheduled Areas, was enacted in', 'പെസ നിയമം', ['1996', '2006', '1992', '2005'], null, 'The Panchayats (Extension to Scheduled Areas) Act, 1996.');
P('acts', 2, 'The SC/ST (Prevention of Atrocities) Act was enacted in', 'പട്ടികജാതി/പട്ടികവർഗ (അതിക്രമം തടയൽ) നിയമം', ['1989', '1955', '1976', '2005'], null, 'The Scheduled Castes and Scheduled Tribes (Prevention of Atrocities) Act, 1989.');
P('rights', 1, 'Article 19 guarantees', 'അനുച്ഛേദം 19', ['Freedoms such as speech and expression', 'Abolition of titles', 'Right to constitutional remedies', 'Protection against arrest'], ['അഭിപ്രായ സ്വാതന്ത്ര്യം ഉൾപ്പെടെയുള്ള സ്വാതന്ത്ര്യങ്ങൾ', 'പദവികൾ നിർത്തലാക്കൽ', 'ഭരണഘടനാ പരിഹാരങ്ങൾ', 'അറസ്റ്റിനെതിരെ സംരക്ഷണം'], 'Article 19(1) lists six freedoms, including speech and expression.');
P('basics', 2, 'The idea of Directive Principles was borrowed from the Constitution of', 'നിർദ്ദേശക തത്വങ്ങൾ കടമെടുത്തത്', ['Ireland', 'USA', 'UK', 'Canada'], ['അയർലൻഡ്', 'അമേരിക്ക', 'ബ്രിട്ടൻ', 'കാനഡ'], 'Directive Principles came from the Irish Constitution; Fundamental Rights were inspired by the US Bill of Rights.');
P('basics', 2, 'The procedure for amending the Constitution is in Article', 'ഭരണഘടനാ ഭേദഗതി — അനുച്ഛേദം', ['368', '356', '370', '395'], null, 'Article 368 lays down the power and procedure of amendment.');
P('parliament', 1, 'Normal term of the Lok Sabha', 'ലോക്സഭയുടെ കാലാവധി', ['5 years', '6 years', '4 years', 'Permanent'], null, 'Lok Sabha: 5 years (unless dissolved earlier). The Rajya Sabha is a permanent house.');
P('basics', 1, '"Satyameva Jayate" is taken from the', '"സത്യമേവ ജയതേ" എടുത്തിരിക്കുന്നത്', ['Mundaka Upanishad', 'Rig Veda', 'Bhagavad Gita', 'Arthashastra'], ['മുണ്ഡകോപനിഷത്ത്', 'ഋഗ്വേദം', 'ഭഗവദ്ഗീത', 'അർത്ഥശാസ്ത്രം'], 'The national motto comes from the Mundaka Upanishad.');
P('parliament', 2, 'A Money Bill is defined in Article', 'മണി ബിൽ — അനുച്ഛേദം', ['110', '112', '117', '123'], null, 'Article 110 defines a Money Bill; it can be introduced only in the Lok Sabha.');

// ------------------------------------------------------------------ HISTORY
const H = (topic, d, q, qml, o, oml, x, xml) => Q('history', topic, d, q, qml, o, oml, x, xml);
H('freedom', 1, 'The First War of Indian Independence took place in', 'ഒന്നാം സ്വാതന്ത്ര്യസമരം', ['1857', '1885', '1905', '1919'], null, 'The revolt of 1857 is called the First War of Independence.');
H('freedom', 1, 'The Indian National Congress was founded in', 'ഇന്ത്യൻ നാഷണൽ കോൺഗ്രസ് രൂപീകരിച്ചത്', ['1885', '1857', '1905', '1920'], null, 'Founded in 1885 in Bombay; A. O. Hume was a founder and W. C. Bonnerjee the first president.');
H('freedom', 2, 'First President of the Indian National Congress', 'കോൺഗ്രസിന്റെ ആദ്യ പ്രസിഡന്റ്', ['W. C. Bonnerjee', 'Dadabhai Naoroji', 'A. O. Hume', 'Badruddin Tyabji'], null, 'W. C. Bonnerjee presided over the first session in 1885.');
H('freedom', 1, 'The Jallianwala Bagh massacre happened in', 'ജാലിയൻവാലാബാഗ് കൂട്ടക്കൊല', ['1919', '1921', '1930', '1942'], null, 'On 13 April 1919 in Amritsar, Punjab.');
H('freedom', 1, 'Gandhiji\'s Dandi March (Salt Satyagraha) was in', 'ദണ്ഡി യാത്ര', ['1930', '1920', '1942', '1919'], null, 'The Dandi March began on 12 March 1930.');
H('freedom', 1, 'The Quit India Movement began in', 'ക്വിറ്റ് ഇന്ത്യാ സമരം', ['1942', '1930', '1920', '1947'], null, 'Launched on 8 August 1942 with the call "Do or Die".');
H('freedom', 2, 'The Partition of Bengal (1905) was carried out by', 'ബംഗാൾ വിഭജനം നടത്തിയത്', ['Lord Curzon', 'Lord Dalhousie', 'Lord Mountbatten', 'Lord Ripon'], null, 'Viceroy Lord Curzon partitioned Bengal in 1905.');
H('medieval', 1, 'The Battle of Plassey was fought in', 'പ്ലാസി യുദ്ധം', ['1757', '1764', '1526', '1857'], null, 'In 1757 the East India Company under Robert Clive defeated Siraj-ud-Daulah.');
H('medieval', 1, 'The First Battle of Panipat (1526) was won by', 'ഒന്നാം പാനിപ്പത്ത് യുദ്ധം ജയിച്ചത്', ['Babur', 'Akbar', 'Ibrahim Lodi', 'Humayun'], ['ബാബർ', 'അക്ബർ', 'ഇബ്രാഹിം ലോദി', 'ഹുമയൂൺ'], 'Babur defeated Ibrahim Lodi and founded the Mughal Empire.');
H('freedom', 1, 'Gandhiji returned to India from South Africa in', 'ഗാന്ധിജി ദക്ഷിണാഫ്രിക്കയിൽ നിന്ന് മടങ്ങിയെത്തിയത്', ['1915', '1909', '1920', '1893'], null, 'He returned on 9 January 1915 — now observed as Pravasi Bharatiya Divas.');
H('freedom', 1, 'The Non-Cooperation Movement was launched in', 'നിസ്സഹകരണ പ്രസ്ഥാനം', ['1920', '1930', '1942', '1905'], null, 'Launched by Gandhiji in 1920.');
H('ancient', 1, 'Emperor Ashoka belonged to which dynasty?', 'അശോക ചക്രവർത്തിയുടെ രാജവംശം', ['Maurya', 'Gupta', 'Mughal', 'Chola'], ['മൗര്യ', 'ഗുപ്ത', 'മുഗൾ', 'ചോള'], 'Ashoka was a Maurya emperor; the Kalinga war changed him towards Buddhism.');
H('ancient', 1, 'Founder of the Maurya Empire', 'മൗര്യ സാമ്രാജ്യ സ്ഥാപകൻ', ['Chandragupta Maurya', 'Ashoka', 'Bindusara', 'Samudragupta'], null, 'Chandragupta Maurya, guided by Chanakya, founded the empire.');
H('medieval', 1, 'The Taj Mahal was built by', 'താജ്മഹൽ നിർമ്മിച്ചത്', ['Shah Jahan', 'Akbar', 'Aurangzeb', 'Jahangir'], ['ഷാജഹാൻ', 'അക്ബർ', 'ഔറംഗസേബ്', 'ജഹാംഗീർ'], 'Shah Jahan built it in memory of Mumtaz Mahal.');
H('ancient', 2, 'The Indus Valley site with a dockyard, in Gujarat', 'കപ്പൽത്തുറയുണ്ടായിരുന്ന സിന്ധുനദീതട കേന്ദ്രം', ['Lothal', 'Harappa', 'Mohenjo-daro', 'Kalibangan'], null, 'Lothal in Gujarat had a dockyard.');
H('ancient', 1, 'The Buddha gave his first sermon at', 'ബുദ്ധന്റെ ആദ്യ പ്രഭാഷണം', ['Sarnath', 'Bodh Gaya', 'Kushinagar', 'Lumbini'], ['സാരനാഥ്', 'ബോധ്ഗയ', 'കുശിനഗരം', 'ലുംബിനി'], 'Enlightenment at Bodh Gaya, first sermon at Sarnath.');
H('freedom', 1, '"Swaraj is my birthright and I shall have it" was said by', '"സ്വരാജ് എന്റെ ജന്മാവകാശമാണ്" — ആരുടെ വാക്കുകൾ?', ['Bal Gangadhar Tilak', 'Gandhiji', 'Subhas Chandra Bose', 'Lala Lajpat Rai'], ['ബാലഗംഗാധര തിലക്', 'ഗാന്ധിജി', 'സുഭാഷ് ചന്ദ്രബോസ്', 'ലാലാ ലജ്പത് റായ്'], 'Bal Gangadhar Tilak.');
H('freedom', 1, '"Give me blood and I will give you freedom" was said by', '"എനിക്ക് രക്തം തരൂ, ഞാൻ സ്വാതന്ത്ര്യം തരാം"', ['Subhas Chandra Bose', 'Bhagat Singh', 'Gandhiji', 'Tilak'], ['സുഭാഷ് ചന്ദ്രബോസ്', 'ഭഗത് സിംഗ്', 'ഗാന്ധിജി', 'തിലക്'], 'Netaji Subhas Chandra Bose, leader of the Indian National Army.');
H('modern', 1, 'First Prime Minister of India', 'ഇന്ത്യയുടെ ആദ്യ പ്രധാനമന്ത്രി', ['Jawaharlal Nehru', 'Sardar Patel', 'Lal Bahadur Shastri', 'Rajendra Prasad'], ['ജവഹർലാൽ നെഹ്റു', 'സർദാർ പട്ടേൽ', 'ലാൽ ബഹദൂർ ശാസ്ത്രി', 'രാജേന്ദ്ര പ്രസാദ്'], 'Jawaharlal Nehru (1947–1964).');
H('modern', 1, 'First President of India', 'ഇന്ത്യയുടെ ആദ്യ രാഷ്ട്രപതി', ['Dr. Rajendra Prasad', 'Dr. S. Radhakrishnan', 'Dr. Zakir Husain', 'V. V. Giri'], null, 'Dr. Rajendra Prasad (1950–1962).');
H('modern', 1, 'The "Iron Man of India"', '"ഇന്ത്യയുടെ ഉരുക്കുമനുഷ്യൻ"', ['Sardar Vallabhbhai Patel', 'Jawaharlal Nehru', 'Bhagat Singh', 'B. R. Ambedkar'], ['സർദാർ വല്ലഭായ് പട്ടേൽ', 'ജവഹർലാൽ നെഹ്റു', 'ഭഗത് സിംഗ്', 'ബി. ആർ. അംബേദ്കർ'], 'Sardar Patel integrated the princely states.');
H('modern', 2, 'First Indian Governor-General of independent India', 'സ്വതന്ത്ര ഇന്ത്യയുടെ ആദ്യ ഇന്ത്യക്കാരനായ ഗവർണർ ജനറൽ', ['C. Rajagopalachari', 'Lord Mountbatten', 'Rajendra Prasad', 'Sardar Patel'], null, 'Lord Mountbatten was the first Governor-General; C. Rajagopalachari was the first (and last) Indian Governor-General.');
H('medieval', 2, 'Raja Todar Mal was the finance minister of', 'രാജാ തോഡർമൽ ആരുടെ ധനമന്ത്രി?', ['Akbar', 'Shah Jahan', 'Babur', 'Sher Shah'], null, 'Todar Mal reformed land revenue under Akbar.');
H('freedom', 2, 'The Malabar Rebellion took place in', 'മലബാർ കലാപം', ['1921', '1857', '1930', '1946'], null, 'The Malabar Rebellion took place in 1921.');
H('freedom', 1, 'India became independent on', 'ഇന്ത്യക്ക് സ്വാതന്ത്ര്യം ലഭിച്ചത്', ['15 August 1947', '26 January 1950', '15 August 1950', '2 October 1947'], null, '15 August 1947.');
H('freedom', 2, 'The "Do or Die" call was given during the', '"പ്രവർത്തിക്കുക അല്ലെങ്കിൽ മരിക്കുക" ആഹ്വാനം', ['Quit India Movement', 'Non-Cooperation Movement', 'Salt Satyagraha', 'Khilafat Movement'], null, 'Gandhiji gave the call at the Quit India session in Bombay, August 1942.');

// ------------------------------------------------------------------ GEOGRAPHY
const G = (topic, d, q, qml, o, oml, x, xml) => Q('geography', topic, d, q, qml, o, oml, x, xml);
G('india', 1, 'Largest Indian state by area', 'വിസ്തീർണ്ണത്തിൽ ഏറ്റവും വലിയ സംസ്ഥാനം', ['Rajasthan', 'Madhya Pradesh', 'Maharashtra', 'Uttar Pradesh'], ['രാജസ്ഥാൻ', 'മധ്യപ്രദേശ്', 'മഹാരാഷ്ട്ര', 'ഉത്തർപ്രദേശ്'], 'Rajasthan is the largest state by area.');
G('india', 1, 'Longest river in India', 'ഇന്ത്യയിലെ ഏറ്റവും നീളം കൂടിയ നദി', ['Ganga', 'Godavari', 'Krishna', 'Narmada'], ['ഗംഗ', 'ഗോദാവരി', 'കൃഷ്ണ', 'നർമ്മദ'], 'The Ganga is the longest river within India.');
G('india', 2, 'The Tropic of Cancer passes through how many Indian states?', 'ഉത്തരായനരേഖ കടന്നുപോകുന്ന സംസ്ഥാനങ്ങൾ', ['8', '6', '7', '10'], null, 'Gujarat, Rajasthan, MP, Chhattisgarh, Jharkhand, West Bengal, Tripura, Mizoram.');
G('india', 1, 'The southern tip of mainland India', 'ഇന്ത്യൻ ഉപദ്വീപിന്റെ തെക്കേ അറ്റം', ['Kanyakumari', 'Rameswaram', 'Kovalam', 'Indira Point'], ['കന്യാകുമാരി', 'രാമേശ്വരം', 'കോവളം', 'ഇന്ദിരാ പോയിന്റ്'], 'Kanyakumari is the tip of the mainland; Indira Point (Great Nicobar) is the southernmost point of India.');
G('india', 1, 'The Western Ghats are also called', 'പശ്ചിമഘട്ടത്തിന്റെ മറ്റൊരു പേര്', ['Sahyadri', 'Aravalli', 'Vindhya', 'Satpura'], ['സഹ്യാദ്രി', 'ആരവല്ലി', 'വിന്ധ്യ', 'സത്പുര'], 'The Western Ghats are known as the Sahyadri.');
G('india', 2, 'The major gap in the Western Ghats connecting Kerala and Tamil Nadu', 'പശ്ചിമഘട്ടത്തിലെ പ്രധാന ചുരം', ['Palakkad Gap', 'Bhor Ghat', 'Thal Ghat', 'Shencottah Gap'], ['പാലക്കാട് ചുരം', 'ഭോർ ഘട്ട്', 'താൽ ഘട്ട്', 'ചെങ്കോട്ട ചുരം'], 'The Palakkad Gap (about 30–40 km wide) is the largest break in the Western Ghats.');
G('india', 2, 'Largest freshwater lake in India', 'ഇന്ത്യയിലെ ഏറ്റവും വലിയ ശുദ്ധജല തടാകം', ['Wular Lake', 'Chilika Lake', 'Dal Lake', 'Loktak Lake'], null, 'Wular Lake in Jammu & Kashmir.');
G('india', 2, 'Chilika, the largest coastal lagoon in India, is in', 'ചിൽക്ക തടാകം', ['Odisha', 'Andhra Pradesh', 'West Bengal', 'Tamil Nadu'], null, 'Chilika Lake is in Odisha.');
G('india', 2, 'Indian Standard Time is based on the longitude', 'ഇന്ത്യൻ സ്റ്റാൻഡേർഡ് സമയം കണക്കാക്കുന്ന രേഖാംശം', ['82.5° E', '80° E', '77.5° E', '90° E'], null, 'IST is based on 82°30′ E (near Mirzapur), 5:30 hours ahead of GMT.');
G('india', 1, 'Black soil is best suited for growing', 'കറുത്ത മണ്ണ് ഏറ്റവും അനുയോജ്യം', ['Cotton', 'Tea', 'Rice', 'Rubber'], ['പരുത്തി', 'തേയില', 'നെല്ല്', 'റബ്ബർ'], 'Black (regur) soil holds moisture and is ideal for cotton.');
G('india', 1, 'The south-west monsoon first reaches which state?', 'തെക്കുപടിഞ്ഞാറൻ മൺസൂൺ ആദ്യം എത്തുന്ന സംസ്ഥാനം', ['Kerala', 'Tamil Nadu', 'Goa', 'West Bengal'], ['കേരളം', 'തമിഴ്നാട്', 'ഗോവ', 'പശ്ചിമ ബംഗാൾ'], 'The monsoon usually sets in over Kerala around 1 June.');
G('world', 1, 'Largest ocean on Earth', 'ഏറ്റവും വലിയ സമുദ്രം', ['Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'], ['ശാന്തസമുദ്രം', 'അറ്റ്ലാന്റിക്', 'ഇന്ത്യൻ മഹാസമുദ്രം', 'ആർട്ടിക്'], 'The Pacific is the largest and deepest ocean.');
G('world', 1, 'Largest continent', 'ഏറ്റവും വലിയ ഭൂഖണ്ഡം', ['Asia', 'Africa', 'North America', 'Europe'], ['ഏഷ്യ', 'ആഫ്രിക്ക', 'വടക്കേ അമേരിക്ക', 'യൂറോപ്പ്'], 'Asia is the largest continent by area and population.');
G('india', 1, 'Sundarbans, the mangrove forest home to the Royal Bengal Tiger, is in', 'സുന്ദർബൻസ്', ['West Bengal', 'Assam', 'Odisha', 'Kerala'], null, 'The Sundarbans delta is in West Bengal (and Bangladesh).');
G('india', 1, 'Largest coffee producing state in India', 'ഏറ്റവും കൂടുതൽ കാപ്പി ഉത്പാദിപ്പിക്കുന്ന സംസ്ഥാനം', ['Karnataka', 'Kerala', 'Tamil Nadu', 'Assam'], ['കർണാടക', 'കേരളം', 'തമിഴ്നാട്', 'അസം'], 'Karnataka produces the most coffee; Kerala is second.');
G('india', 1, 'Largest tea producing state in India', 'ഏറ്റവും കൂടുതൽ തേയില ഉത്പാദിപ്പിക്കുന്ന സംസ്ഥാനം', ['Assam', 'Kerala', 'West Bengal', 'Karnataka'], ['അസം', 'കേരളം', 'പശ്ചിമ ബംഗാൾ', 'കർണാടക'], 'Assam is the largest tea producer.');
G('india', 1, 'Which state is known as the "Spice Garden of India"?', '"ഇന്ത്യയുടെ സുഗന്ധവ്യഞ്ജന തോട്ടം"', ['Kerala', 'Karnataka', 'Goa', 'Assam'], ['കേരളം', 'കർണാടക', 'ഗോവ', 'അസം'], 'Kerala is known as the Spice Garden of India.');
G('india', 1, 'Kaziranga National Park is famous for', 'കാസിരംഗ ദേശീയോദ്യാനം', ['One-horned rhinoceros', 'Asiatic lion', 'Nilgiri tahr', 'Snow leopard'], ['ഒറ്റക്കൊമ്പൻ കാണ്ടാമൃഗം', 'ഏഷ്യൻ സിംഹം', 'വരയാട്', 'ഹിമപ്പുലി'], 'Kaziranga in Assam protects the one-horned rhino.');
G('world', 1, 'The Earth rotates from', 'ഭൂമി കറങ്ങുന്ന ദിശ', ['West to east', 'East to west', 'North to south', 'South to north'], ['പടിഞ്ഞാറ് നിന്ന് കിഴക്കോട്ട്', 'കിഴക്ക് നിന്ന് പടിഞ്ഞാറോട്ട്', 'വടക്ക് നിന്ന് തെക്കോട്ട്', 'തെക്ക് നിന്ന് വടക്കോട്ട്'], 'That is why the Sun appears to rise in the east.');
G('india', 2, 'India shares its longest international border with', 'ഇന്ത്യ ഏറ്റവും നീളം കൂടിയ അതിർത്തി പങ്കിടുന്നത്', ['Bangladesh', 'China', 'Pakistan', 'Nepal'], ['ബംഗ്ലാദേശ്', 'ചൈന', 'പാകിസ്ഥാൻ', 'നേപ്പാൾ'], 'The India–Bangladesh border is about 4,096 km long.');
G('india', 1, 'The Gir Forest, home of the Asiatic lion, is in', 'ഗിർ വനം', ['Gujarat', 'Rajasthan', 'Madhya Pradesh', 'Karnataka'], null, 'Gir National Park is in Gujarat.');
G('world', 1, 'Which line divides the Earth into Northern and Southern hemispheres?', 'ഭൂമിയെ വടക്കും തെക്കും അർദ്ധഗോളങ്ങളായി തിരിക്കുന്ന രേഖ', ['Equator', 'Prime Meridian', 'Tropic of Cancer', 'International Date Line'], ['ഭൂമധ്യരേഖ', 'പ്രധാന രേഖാംശം', 'ഉത്തരായനരേഖ', 'അന്താരാഷ്ട്ര ദിനാങ്കരേഖ'], 'The Equator (0° latitude).');

// ------------------------------------------------------------------ SCIENCE
const S = (topic, d, q, qml, o, oml, x, xml) => Q('science', topic, d, q, qml, o, oml, x, xml);
S('chemistry', 1, 'Chemical formula of water', 'ജലത്തിന്റെ രാസസൂത്രം', ['H₂O', 'CO₂', 'NaCl', 'O₂'], null, 'Two hydrogen atoms and one oxygen atom.');
S('health', 1, 'Deficiency of Vitamin C causes', 'വിറ്റാമിൻ സി യുടെ കുറവ് മൂലമുള്ള രോഗം', ['Scurvy', 'Rickets', 'Night blindness', 'Beriberi'], ['സ്കർവി', 'റിക്കറ്റ്സ്', 'നിശാന്ധത', 'ബെറിബെറി'], 'Scurvy causes bleeding gums. Amla and citrus fruits are rich in Vitamin C.');
S('health', 1, 'Which vitamin does our skin make in sunlight?', 'സൂര്യപ്രകാശത്തിൽ ശരീരം ഉത്പാദിപ്പിക്കുന്ന വിറ്റാമിൻ', ['Vitamin D', 'Vitamin A', 'Vitamin C', 'Vitamin K'], null, 'Vitamin D; its deficiency causes rickets in children.');
S('health', 1, 'Deficiency of Vitamin A causes', 'വിറ്റാമിൻ എ യുടെ കുറവ്', ['Night blindness', 'Scurvy', 'Anaemia', 'Goitre'], ['നിശാന്ധത', 'സ്കർവി', 'വിളർച്ച', 'ഗോയിറ്റർ'], 'Night blindness. Green leafy vegetables, carrots and papaya give Vitamin A.');
S('biology', 1, 'Largest organ of the human body', 'മനുഷ്യശരീരത്തിലെ ഏറ്റവും വലിയ അവയവം', ['Skin', 'Liver', 'Brain', 'Lungs'], ['ത്വക്ക്', 'കരൾ', 'തലച്ചോറ്', 'ശ്വാസകോശം'], 'The skin is the largest organ; the liver is the largest internal organ.');
S('biology', 1, 'How many chambers does the human heart have?', 'മനുഷ്യഹൃദയത്തിന് എത്ര അറകൾ?', ['4', '2', '3', '5'], null, 'Two atria and two ventricles.');
S('biology', 1, 'Normal human body temperature is about', 'മനുഷ്യന്റെ സാധാരണ ശരീര താപനില', ['37 °C', '40 °C', '32 °C', '42 °C'], null, 'About 37 °C or 98.6 °F.');
S('biology', 1, 'Plants take in which gas for photosynthesis?', 'പ്രകാശസംശ്ലേഷണത്തിന് സസ്യങ്ങൾ സ്വീകരിക്കുന്ന വാതകം', ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen'], ['കാർബൺ ഡൈ ഓക്സൈഡ്', 'ഓക്സിജൻ', 'നൈട്രജൻ', 'ഹൈഡ്രജൻ'], 'Plants use CO₂, water and sunlight, and release oxygen.');
S('physics', 2, 'Speed of light in vacuum is about', 'ശൂന്യതയിൽ പ്രകാശത്തിന്റെ വേഗത', ['3 × 10⁸ m/s', '3 × 10⁶ m/s', '340 m/s', '3 × 10⁵ m/s'], null, 'About 3 lakh km per second. 340 m/s is roughly the speed of sound in air.');
S('physics', 1, 'SI unit of force', 'ബലത്തിന്റെ SI യൂണിറ്റ്', ['Newton', 'Joule', 'Watt', 'Pascal'], ['ന്യൂട്ടൺ', 'ജൂൾ', 'വാട്ട്', 'പാസ്കൽ'], 'Force is measured in newtons (N).');
S('physics', 1, 'SI unit of electric current', 'വൈദ്യുതപ്രവാഹത്തിന്റെ യൂണിറ്റ്', ['Ampere', 'Volt', 'Ohm', 'Watt'], ['ആമ്പിയർ', 'വോൾട്ട്', 'ഓം', 'വാട്ട്'], 'Current: ampere; voltage: volt; resistance: ohm.');
S('physics', 1, 'SI unit of electrical resistance', 'വൈദ്യുത പ്രതിരോധത്തിന്റെ യൂണിറ്റ്', ['Ohm', 'Ampere', 'Volt', 'Coulomb'], ['ഓം', 'ആമ്പിയർ', 'വോൾട്ട്', 'കൂളോം'], 'Resistance is measured in ohms (Ω).');
S('health', 1, 'Iron deficiency in the diet commonly causes', 'ഇരുമ്പിന്റെ കുറവ് മൂലമുള്ള രോഗം', ['Anaemia', 'Goitre', 'Scurvy', 'Rickets'], ['വിളർച്ച (അനീമിയ)', 'ഗോയിറ്റർ', 'സ്കർവി', 'റിക്കറ്റ്സ്'], 'Iron is needed for haemoglobin; lack of it causes anaemia. Iodine deficiency causes goitre.');
S('chemistry', 1, 'pH of pure water', 'ശുദ്ധജലത്തിന്റെ pH', ['7', '0', '14', '5'], null, 'Pure water is neutral (pH 7). Below 7 is acidic, above 7 is basic.');
S('chemistry', 1, 'Gas present in the largest amount in air', 'വായുവിൽ ഏറ്റവും കൂടുതലുള്ള വാതകം', ['Nitrogen', 'Oxygen', 'Carbon dioxide', 'Argon'], ['നൈട്രജൻ', 'ഓക്സിജൻ', 'കാർബൺ ഡൈ ഓക്സൈഡ്', 'ആർഗൺ'], 'Nitrogen ≈ 78%, oxygen ≈ 21%.');
S('biology', 1, 'Insulin is produced by the', 'ഇൻസുലിൻ ഉത്പാദിപ്പിക്കുന്ന അവയവം', ['Pancreas', 'Liver', 'Kidney', 'Thyroid'], ['പാൻക്രിയാസ് (ആഗ്നേയഗ്രന്ഥി)', 'കരൾ', 'വൃക്ക', 'തൈറോയ്ഡ്'], 'Insulin from the pancreas controls blood sugar; its lack causes diabetes.');
S('health', 1, 'Malaria is spread by the', 'മലേറിയ പരത്തുന്നത്', ['Female Anopheles mosquito', 'Housefly', 'Aedes mosquito only', 'Cockroach'], ['പെൺ അനോഫിലസ് കൊതുക്', 'ഈച്ച', 'ഈഡിസ് കൊതുക് മാത്രം', 'പാറ്റ'], 'Malaria is caused by Plasmodium and spread by female Anopheles mosquitoes.');
S('health', 1, 'Dengue fever is spread by the', 'ഡെങ്കിപ്പനി പരത്തുന്നത്', ['Aedes mosquito', 'Anopheles mosquito', 'Rat flea', 'Housefly'], ['ഈഡിസ് കൊതുക്', 'അനോഫിലസ് കൊതുക്', 'എലിച്ചെള്ള്', 'ഈച്ച'], 'Aedes mosquitoes breed in clean stagnant water — remove water from coconut shells, tyres and pots.');
S('biology', 1, 'Number of bones in an adult human body', 'മുതിർന്ന മനുഷ്യന്റെ ശരീരത്തിലെ അസ്ഥികൾ', ['206', '300', '201', '212'], null, 'An adult has 206 bones; a newborn has about 300 which fuse over time.');
S('biology', 2, 'The smallest bone in the human body', 'ഏറ്റവും ചെറിയ അസ്ഥി', ['Stapes (in the ear)', 'Femur', 'Patella', 'Radius'], ['സ്റ്റേപ്പിസ് (ചെവിയിൽ)', 'തുടയെല്ല്', 'മുട്ടുചിരട്ട', 'റേഡിയസ്'], 'The stapes in the middle ear; the femur (thigh bone) is the largest.');
S('space', 1, 'Which planet is called the Red Planet?', '"ചുവന്ന ഗ്രഹം"', ['Mars', 'Jupiter', 'Venus', 'Mercury'], ['ചൊവ്വ', 'വ്യാഴം', 'ശുക്രൻ', 'ബുധൻ'], 'Iron oxide on its surface makes Mars look red.');
S('space', 1, 'The planet nearest to the Sun', 'സൂര്യനോട് ഏറ്റവും അടുത്ത ഗ്രഹം', ['Mercury', 'Venus', 'Earth', 'Mars'], ['ബുധൻ', 'ശുക്രൻ', 'ഭൂമി', 'ചൊവ്വ'], 'Mercury is closest to the Sun.');
S('space', 1, 'Largest planet in the Solar System', 'സൗരയൂഥത്തിലെ ഏറ്റവും വലിയ ഗ്രഹം', ['Jupiter', 'Saturn', 'Earth', 'Neptune'], ['വ്യാഴം', 'ശനി', 'ഭൂമി', 'നെപ്റ്റ്യൂൺ'], 'Jupiter is the largest planet.');
S('health', 2, 'The universal blood donor group is', 'സാർവത്രിക ദാതാവ് (Universal donor)', ['O negative', 'AB positive', 'A positive', 'B negative'], null, 'O negative red cells can be given to anyone in an emergency; AB positive is the universal recipient.');
S('physics', 1, 'Sound cannot travel through', 'ശബ്ദത്തിന് സഞ്ചരിക്കാൻ കഴിയാത്തത്', ['Vacuum', 'Water', 'Air', 'Steel'], ['ശൂന്യത', 'ജലം', 'വായു', 'ഉരുക്ക്'], 'Sound needs a medium; it cannot travel in a vacuum.');
S('biology', 1, 'The main function of the kidneys is to', 'വൃക്കകളുടെ പ്രധാന ധർമ്മം', ['Filter blood and form urine', 'Pump blood', 'Digest food', 'Produce bile'], ['രക്തം അരിച്ച് മൂത്രം ഉണ്ടാക്കൽ', 'രക്തം പമ്പ് ചെയ്യൽ', 'ദഹനം', 'പിത്തരസം ഉത്പാദനം'], 'Kidneys remove waste from blood.');
S('chemistry', 1, 'Chemical name of common salt', 'കറിയുപ്പിന്റെ രാസനാമം', ['Sodium chloride', 'Sodium bicarbonate', 'Calcium carbonate', 'Potassium nitrate'], ['സോഡിയം ക്ലോറൈഡ്', 'സോഡിയം ബൈകാർബണേറ്റ്', 'കാൽസ്യം കാർബണേറ്റ്', 'പൊട്ടാസ്യം നൈട്രേറ്റ്'], 'NaCl.');
S('chemistry', 1, 'Chemical name of baking soda', 'അപ്പക്കാരത്തിന്റെ രാസനാമം', ['Sodium bicarbonate', 'Sodium chloride', 'Calcium oxide', 'Sodium hydroxide'], null, 'NaHCO₃ (sodium hydrogen carbonate).');
S('chemistry', 1, 'The hardest natural substance', 'ഏറ്റവും കാഠിന്യമുള്ള പ്രകൃതിദത്ത വസ്തു', ['Diamond', 'Iron', 'Granite', 'Quartz'], ['വജ്രം', 'ഇരുമ്പ്', 'ഗ്രാനൈറ്റ്', 'ക്വാർട്സ്'], 'Diamond is a form of carbon.');
S('health', 2, 'Sickle cell anaemia is a', 'സിക്കിൾ സെൽ അനീമിയ', ['Genetic disorder of red blood cells', 'Disease spread by mosquitoes', 'Vitamin deficiency', 'Infection of the lungs'], ['ചുവന്ന രക്താണുക്കളുടെ ജനിതക രോഗം', 'കൊതുക് പരത്തുന്ന രോഗം', 'വിറ്റാമിൻ കുറവ്', 'ശ്വാസകോശ അണുബാധ'], 'It is inherited, not infectious. Screening is important in some tribal areas such as Wayanad and Attappadi.');
S('health', 1, 'ORS (Oral Rehydration Solution) is mainly used to treat', 'ORS പ്രധാനമായും ഉപയോഗിക്കുന്നത്', ['Dehydration from diarrhoea', 'Fever', 'Cough', 'Skin rash'], ['വയറിളക്കം മൂലമുള്ള നിർജലീകരണം', 'പനി', 'ചുമ', 'ചൊറിച്ചിൽ'], 'ORS replaces lost water and salts.');
S('health', 1, 'The BCG vaccine protects against', 'ബി.സി.ജി വാക്സിൻ', ['Tuberculosis', 'Polio', 'Measles', 'Tetanus'], ['ക്ഷയം', 'പോളിയോ', 'അഞ്ചാംപനി', 'ടെറ്റനസ്'], 'BCG is given at birth against TB.');
S('physics', 1, 'The filament of an ordinary electric bulb is made of', 'ബൾബിലെ ഫിലമെന്റ്', ['Tungsten', 'Copper', 'Iron', 'Aluminium'], ['ടങ്സ്റ്റൺ', 'ചെമ്പ്', 'ഇരുമ്പ്', 'അലുമിനിയം'], 'Tungsten has a very high melting point.');
S('chemistry', 1, 'The lightest gas', 'ഏറ്റവും ഭാരം കുറഞ്ഞ വാതകം', ['Hydrogen', 'Helium', 'Oxygen', 'Nitrogen'], ['ഹൈഡ്രജൻ', 'ഹീലിയം', 'ഓക്സിജൻ', 'നൈട്രജൻ'], 'Hydrogen is the lightest element.');
S('physics', 1, 'Energy from the Sun captured by solar panels is converted into', 'സോളാർ പാനലുകൾ സൗരോർജത്തെ മാറ്റുന്നത്', ['Electrical energy', 'Sound energy', 'Nuclear energy', 'Chemical energy only'], ['വൈദ്യുതോർജം', 'ശബ്ദോർജം', 'ആണവോർജം', 'രാസോർജം മാത്രം'], 'Photovoltaic cells convert light into electricity.');

// ------------------------------------------------------------------ STATIC GK
const T = (topic, d, q, qml, o, oml, x, xml) => Q('static', topic, d, q, qml, o, oml, x, xml);
T('symbols', 1, 'National animal of India', 'ഇന്ത്യയുടെ ദേശീയ മൃഗം', ['Tiger', 'Lion', 'Elephant', 'Leopard'], ['കടുവ', 'സിംഹം', 'ആന', 'പുള്ളിപ്പുലി'], 'The Bengal tiger.');
T('symbols', 1, 'National bird of India', 'ഇന്ത്യയുടെ ദേശീയ പക്ഷി', ['Peacock', 'Great Hornbill', 'Parrot', 'Eagle'], ['മയിൽ', 'വേഴാമ്പൽ', 'തത്ത', 'കഴുകൻ'], 'The Indian peafowl.');
T('symbols', 1, 'The national song "Vande Mataram" was written by', 'ദേശീയ ഗീതം "വന്ദേമാതരം" രചിച്ചത്', ['Bankim Chandra Chatterjee', 'Rabindranath Tagore', 'Sarojini Naidu', 'Muhammad Iqbal'], null, 'It is from Bankim Chandra Chatterjee\'s novel "Anandamath".');
T('symbols', 1, 'The national anthem "Jana Gana Mana" was written by', 'ദേശീയ ഗാനം രചിച്ചത്', ['Rabindranath Tagore', 'Bankim Chandra Chatterjee', 'Subramania Bharati', 'Gandhiji'], ['രവീന്ദ്രനാഥ ടാഗോർ', 'ബങ്കിം ചന്ദ്ര ചാറ്റർജി', 'സുബ്രഹ്മണ്യ ഭാരതി', 'ഗാന്ധിജി'], 'Rabindranath Tagore.');
T('symbols', 2, 'Playing time of the full national anthem', 'ദേശീയ ഗാനം പാടാനുള്ള സമയം', ['52 seconds', '20 seconds', '65 seconds', '2 minutes'], null, 'About 52 seconds for the full version; the short version takes about 20 seconds.');
T('institutions', 1, 'Headquarters of the Reserve Bank of India', 'റിസർവ് ബാങ്ക് ആസ്ഥാനം', ['Mumbai', 'New Delhi', 'Kolkata', 'Chennai'], ['മുംബൈ', 'ന്യൂഡൽഹി', 'കൊൽക്കത്ത', 'ചെന്നൈ'], 'The RBI is headquartered in Mumbai.');
T('institutions', 1, 'Headquarters of ISRO', 'ഐ.എസ്.ആർ.ഒ ആസ്ഥാനം', ['Bengaluru', 'Thiruvananthapuram', 'Sriharikota', 'Hyderabad'], ['ബെംഗളൂരു', 'തിരുവനന്തപുരം', 'ശ്രീഹരിക്കോട്ട', 'ഹൈദരാബാദ്'], 'ISRO HQ is in Bengaluru; Thumba (Thiruvananthapuram) was India\'s first rocket launch station.');
T('symbols', 2, 'The rupee symbol ₹ was adopted in', '₹ ചിഹ്നം അംഗീകരിച്ച വർഷം', ['2010', '2005', '2014', '1999'], null, 'Designed by D. Udaya Kumar and adopted in 2010.');
T('days', 1, 'National Sports Day (birthday of Major Dhyan Chand) is', 'ദേശീയ കായിക ദിനം', ['29 August', '5 September', '14 November', '12 January'], null, '29 August.');
T('days', 1, 'Teachers\' Day in India is celebrated on', 'അധ്യാപക ദിനം', ['5 September', '14 November', '2 October', '15 August'], null, 'Birthday of Dr. S. Radhakrishnan.');
T('days', 1, 'World Environment Day', 'ലോക പരിസ്ഥിതി ദിനം', ['5 June', '22 April', '21 March', '16 September'], null, '5 June. Earth Day is 22 April.');
T('days', 1, 'International Women\'s Day', 'അന്താരാഷ്ട്ര വനിതാ ദിനം', ['8 March', '8 May', '1 May', '14 February'], null, '8 March.');
T('days', 1, 'Children\'s Day in India', 'ശിശുദിനം', ['14 November', '5 September', '26 January', '1 June'], null, 'Birthday of Jawaharlal Nehru.');
T('days', 1, 'National Youth Day (birthday of Swami Vivekananda)', 'ദേശീയ യുവജന ദിനം', ['12 January', '23 January', '30 January', '15 August'], null, '12 January.');
T('days', 2, 'National Voters\' Day', 'ദേശീയ സമ്മതിദായക ദിനം', ['25 January', '26 January', '2 October', '10 December'], null, 'Marks the founding of the Election Commission on 25 January 1950.');
T('days', 2, 'International Day of the World\'s Indigenous Peoples', 'ലോക ആദിവാസി ദിനം', ['9 August', '5 June', '10 December', '21 February'], null, 'Observed by the UN on 9 August.');
T('days', 1, 'Kerala Piravi (Kerala Formation Day) is celebrated on', 'കേരളപ്പിറവി ദിനം', ['1 November', '15 August', '26 January', '1 May'], null, '1 November.');
T('days', 2, 'International Mother Language Day', 'ലോക മാതൃഭാഷാ ദിനം', ['21 February', '14 September', '9 August', '8 September'], null, '21 February (UNESCO). Hindi Diwas is 14 September; International Literacy Day is 8 September.');
T('services', 1, 'An Aadhaar number has how many digits?', 'ആധാർ നമ്പറിൽ എത്ര അക്കങ്ങൾ?', ['12', '10', '16', '11'], null, 'Aadhaar is a 12-digit number issued by UIDAI.');
T('services', 2, 'A PAN (Permanent Account Number) has how many characters?', 'പാൻ നമ്പറിൽ എത്ര അക്ഷരങ്ങൾ/അക്കങ്ങൾ?', ['10', '12', '8', '11'], null, '10 alphanumeric characters (5 letters, 4 digits, 1 letter).');
T('services', 2, 'A bank IFSC code has how many characters?', 'ബാങ്ക് IFSC കോഡിന്റെ നീളം', ['11', '9', '10', '12'], null, '11 characters: 4 letters for the bank, a zero, then 6 for the branch.');
T('services', 1, 'UPI (Unified Payments Interface) was developed by', 'UPI വികസിപ്പിച്ചത്', ['NPCI', 'SBI', 'SEBI', 'NABARD'], null, 'The National Payments Corporation of India.');
T('services', 1, 'Single emergency helpline number in India (police, fire, ambulance)', 'ഏകീകൃത അടിയന്തര നമ്പർ', ['112', '100', '108', '1098'], null, '112 is the all-in-one emergency number. 108 is ambulance in many states.');
T('services', 1, 'CHILDLINE number for children in distress', 'കുട്ടികൾക്കായുള്ള ഹെൽപ്‌ലൈൻ', ['1098', '112', '181', '1930'], null, '1098 is the free 24-hour child helpline.');
T('services', 2, 'National cyber crime helpline number', 'സൈബർ കുറ്റകൃത്യ ഹെൽപ്‌ലൈൻ', ['1930', '1098', '100', '1800'], null, 'Call 1930 or use cybercrime.gov.in to report online fraud quickly.');
T('people', 1, 'Who is called the "Father of the Nation" in India?', '"രാഷ്ട്രപിതാവ്"', ['Mahatma Gandhi', 'Jawaharlal Nehru', 'B. R. Ambedkar', 'Subhas Chandra Bose'], ['മഹാത്മാ ഗാന്ധി', 'ജവഹർലാൽ നെഹ്റു', 'ബി. ആർ. അംബേദ്കർ', 'സുഭാഷ് ചന്ദ്രബോസ്'], 'Mahatma Gandhi.');
T('sports', 1, 'How many rings are there in the Olympic symbol?', 'ഒളിമ്പിക് ചിഹ്നത്തിൽ എത്ര വളയങ്ങൾ?', ['5', '4', '6', '7'], null, 'Five interlocking rings.');
T('sports', 1, 'How many players does a football team have on the field?', 'ഫുട്ബോൾ ടീമിൽ കളത്തിലുള്ള കളിക്കാർ', ['11', '9', '7', '15'], null, '11 players including the goalkeeper.');
T('sports', 1, 'P. T. Usha, the "Payyoli Express", is associated with', 'പി. ടി. ഉഷ', ['Athletics', 'Badminton', 'Cricket', 'Chess'], ['അത്‌ലറ്റിക്സ്', 'ബാഡ്മിന്റൺ', 'ക്രിക്കറ്റ്', 'ചെസ്സ്'], 'P. T. Usha is a legendary sprinter from Kerala.');
T('institutions', 1, 'The United Nations was founded in', 'ഐക്യരാഷ്ട്രസഭ സ്ഥാപിതമായത്', ['1945', '1919', '1950', '1939'], null, 'The UN was founded on 24 October 1945.');
T('days', 1, 'Human Rights Day', 'മനുഷ്യാവകാശ ദിനം', ['10 December', '1 December', '24 October', '2 October'], null, '10 December — the Universal Declaration of Human Rights was adopted in 1948.');
T('days', 1, 'International Literacy Day', 'ലോക സാക്ഷരതാ ദിനം', ['8 September', '5 September', '21 February', '14 November'], null, '8 September (UNESCO).');

// ------------------------------------------------------------------ ENGLISH
const E = (topic, d, q, o, x, q_ml, x_ml) => Q('english', topic, d, q, q_ml || null, o, null, x, x_ml);
E('vocabulary', 1, 'Choose the synonym of "brave".', ['Courageous', 'Fearful', 'Lazy', 'Weak'], '"Brave" and "courageous" both mean showing courage.', '"brave" എന്നതിന്റെ സമാനപദം');
E('vocabulary', 1, 'Choose the antonym of "ancient".', ['Modern', 'Old', 'Historic', 'Aged'], 'Ancient = very old; the opposite is modern.', '"ancient" എന്നതിന്റെ വിപരീതപദം');
E('grammar', 1, 'She ___ to school every day.', ['goes', 'go', 'going', 'gone'], 'Simple present with he/she/it takes -s/-es: she goes.');
E('grammar', 1, 'Plural of "child"', ['children', 'childs', 'childes', 'childrens'], 'Child → children (irregular plural).');
E('grammar', 1, 'Past tense of "go"', ['went', 'goed', 'gone', 'going'], 'go – went – gone.');
E('articles', 1, 'He is ___ honest man.', ['an', 'a', 'the', 'no article'], '"Honest" begins with a vowel sound (the h is silent), so we use "an".');
E('articles', 2, 'She studies at ___ university in Kochi.', ['a', 'an', 'the', 'no article'], '"University" begins with a "yoo" consonant sound, so we use "a".');
E('prepositions', 1, 'Ravi is good ___ mathematics.', ['at', 'in', 'on', 'with'], 'We say "good at" a subject or skill.');
E('spelling', 2, 'Choose the correctly spelt word.', ['Necessary', 'Neccessary', 'Necesary', 'Neccesary'], 'Necessary — one c, double s.');
E('one-word', 1, 'One who cannot read or write', ['Illiterate', 'Ignorant', 'Innocent', 'Illegal'], 'Illiterate.');
E('vocabulary', 1, 'Choose the antonym of "expand".', ['Contract', 'Extend', 'Enlarge', 'Spread'], 'Expand ↔ contract.');
E('vocabulary', 1, 'Choose the synonym of "rapid".', ['Fast', 'Slow', 'Late', 'Calm'], 'Rapid = fast.');
E('grammar', 2, 'Neither of the boys ___ present.', ['was', 'were', 'are', 'have'], '"Neither of" takes a singular verb: was.');
E('grammar', 2, 'If I ___ a bird, I would fly.', ['were', 'am', 'was being', 'be'], 'Imaginary conditions use "were" for all persons: If I were…');
E('voice', 2, 'Change to passive: "She writes a letter."', ['A letter is written by her.', 'A letter was written by her.', 'A letter is wrote by her.', 'A letter has written by her.'], 'Simple present passive: is/are + past participle.');
E('idioms', 1, 'The idiom "a piece of cake" means', ['Something very easy', 'A sweet dish', 'A small share', 'A difficult job'], '"The test was a piece of cake" = it was very easy.');
E('idioms', 2, 'The idiom "break the ice" means', ['Start a conversation in an awkward situation', 'Break something cold', 'Lose temper', 'End a friendship'], 'To make people feel relaxed by starting to talk.');
E('grammar', 1, 'Comparative form of "good"', ['better', 'gooder', 'best', 'more good'], 'good – better – best.');
E('grammar', 1, 'Superlative form of "bad"', ['worst', 'baddest', 'worse', 'most bad'], 'bad – worse – worst.');
E('grammar', 2, 'Choose the correct question tag: "You are coming, ___?"', ["aren't you", 'are you', "isn't it", "don't you"], 'A positive statement takes a negative tag with the same auxiliary: aren\'t you?');
E('one-word', 1, 'A person who offers to work without pay', ['Volunteer', 'Employee', 'Labourer', 'Contractor'], 'Volunteer.');
E('vocabulary', 1, 'A ___ of cattle', ['herd', 'flock', 'pack', 'swarm'], 'Herd of cattle; flock of sheep/birds; pack of wolves; swarm of bees.');
E('prepositions', 2, 'I have been living here ___ 2020.', ['since', 'for', 'from', 'by'], '"Since" with a point in time; "for" with a period of time.');
E('prepositions', 2, 'He has lived in Kochi ___ five years.', ['for', 'since', 'from', 'at'], '"For" with a period of time.');
E('vocabulary', 1, 'Choose the synonym of "assist".', ['Help', 'Stop', 'Ignore', 'Delay'], 'Assist = help.');
E('vocabulary', 1, 'Choose the antonym of "victory".', ['Defeat', 'Win', 'Success', 'Triumph'], 'Victory ↔ defeat.');
E('grammar', 1, 'Plural of "mouse"', ['mice', 'mouses', 'mices', 'mouse'], 'Mouse → mice.');
E('error', 2, 'Find the error: "He don\'t like tea."', ["don't → doesn't", 'He → Him', 'like → likes', 'No error'], 'With he/she/it use "does not" (doesn\'t): He doesn\'t like tea.');
E('speech', 2, 'Indirect speech: He said, "I am tired."', ['He said that he was tired.', 'He said that I am tired.', 'He said that he is tired.', 'He says he was tired.'], 'Reporting verb in past → present tense becomes past; "I" becomes "he".');
E('vocabulary', 1, 'The opposite of "honest" formed with a prefix', ['dishonest', 'unhonest', 'inhonest', 'nonhonest'], 'Dishonest.');
E('vocabulary', 2, 'Choose the word closest in meaning to "abundant".', ['Plentiful', 'Scarce', 'Tiny', 'Empty'], 'Abundant = existing in large quantities.');
E('one-word', 2, 'A place where books are kept for reading', ['Library', 'Laboratory', 'Museum', 'Archive of films'], 'Library.');
E('grammar', 2, 'The train ___ before we reached the station.', ['had left', 'has left', 'leaves', 'was leave'], 'Past perfect (had + past participle) for the earlier of two past actions.');
E('articles', 1, '___ sun rises in the east.', ['The', 'A', 'An', 'No article'], 'Use "the" for unique things: the sun, the moon.');

// ------------------------------------------------------------------ MALAYALAM
const M = (topic, d, q_ml, q_en, o, x_ml, x_en) => Q('malayalam', topic, d, q_en, q_ml, o, o, x_en, x_ml);
M('synonyms', 1, '"അമ്മ" എന്ന പദത്തിന്റെ പര്യായം', 'Synonym of "amma" (mother)', ['മാതാവ്', 'പിതാവ്', 'സഹോദരി', 'പുത്രി'], 'അമ്മ = മാതാവ്, ജനനി.', 'Amma = maathaavu, janani.');
M('synonyms', 1, '"സൂര്യൻ" എന്ന പദത്തിന്റെ പര്യായം', 'Synonym of "sooryan" (sun)', ['ആദിത്യൻ', 'ചന്ദ്രൻ', 'നക്ഷത്രം', 'ആകാശം'], 'സൂര്യൻ = ആദിത്യൻ, ദിനകരൻ, ഭാനു.', 'Sun = aadithyan, dinakaran, bhaanu.');
M('synonyms', 1, '"ജലം" എന്ന പദത്തിന്റെ പര്യായം', 'Synonym of "jalam" (water)', ['വെള്ളം', 'തീ', 'കാറ്റ്', 'മണ്ണ്'], 'ജലം = വെള്ളം, നീര്.', 'Water = vellam, neeru.');
M('synonyms', 1, '"കാട്" എന്ന പദത്തിന്റെ പര്യായം', 'Synonym of "kaadu" (forest)', ['വനം', 'വയൽ', 'മല', 'പുഴ'], 'കാട് = വനം, അടവി.', 'Forest = vanam, adavi.');
M('synonyms', 1, '"പുഴ" എന്ന പദത്തിന്റെ പര്യായം', 'Synonym of "puzha" (river)', ['നദി', 'കടൽ', 'കുളം', 'കിണർ'], 'പുഴ = നദി.', 'River = nadi.');
M('synonyms', 2, '"ഭൂമി" എന്ന പദത്തിന്റെ പര്യായം', 'Synonym of "bhoomi" (earth)', ['ധര', 'ആകാശം', 'സമുദ്രം', 'പർവ്വതം'], 'ഭൂമി = ധര, ഉർവി, ക്ഷിതി.', 'Earth = dhara, urvi, kshithi.');
M('antonyms', 1, '"ഉദയം" — വിപരീതപദം', 'Antonym of "udayam" (rise)', ['അസ്തമയം', 'പ്രഭാതം', 'ആരംഭം', 'വെളിച്ചം'], 'ഉദയം × അസ്തമയം.', 'Rise × set (asthamayam).');
M('antonyms', 1, '"സത്യം" — വിപരീതപദം', 'Antonym of "sathyam" (truth)', ['അസത്യം', 'നീതി', 'ധർമ്മം', 'വിശ്വാസം'], 'സത്യം × അസത്യം.', 'Truth × untruth.');
M('antonyms', 1, '"ധനികൻ" — വിപരീതപദം', 'Antonym of "dhanikan" (rich man)', ['ദരിദ്രൻ', 'പണക്കാരൻ', 'രാജാവ്', 'വ്യാപാരി'], 'ധനികൻ × ദരിദ്രൻ.', 'Rich × poor.');
M('antonyms', 1, '"ജയം" — വിപരീതപദം', 'Antonym of "jayam" (victory)', ['പരാജയം', 'വിജയം', 'സന്തോഷം', 'മത്സരം'], 'ജയം × പരാജയം.', 'Victory × defeat.');
M('antonyms', 2, '"ആദി" — വിപരീതപദം', 'Antonym of "aadi" (beginning)', ['അന്തം', 'ആരംഭം', 'ആദ്യം', 'നടുവ്'], 'ആദി × അന്തം. (ആദി = ആരംഭം)', 'Aadi (beginning) × antham (end).');
M('antonyms', 2, '"അറിവ്" — വിപരീതപദം', 'Antonym of "arivu" (knowledge)', ['അജ്ഞത', 'ജ്ഞാനം', 'വിദ്യ', 'ബുദ്ധി'], 'അറിവ് × അജ്ഞത (അറിവില്ലായ്മ).', 'Knowledge × ignorance.');
M('antonyms', 1, '"പകൽ" — വിപരീതപദം', 'Antonym of "pakal" (day)', ['രാത്രി', 'പ്രഭാതം', 'ഉച്ച', 'സന്ധ്യ'], 'പകൽ × രാത്രി.', 'Day × night.');
M('number', 1, '"മരം" — ബഹുവചനം', 'Plural of "maram" (tree)', ['മരങ്ങൾ', 'മരന്മാർ', 'മരത്തിൽ', 'മരത്തിന്റെ'], 'മരം → മരങ്ങൾ.', 'Maram → marangal.');
M('number', 1, '"കുട്ടി" — ബഹുവചനം', 'Plural of "kutti" (child)', ['കുട്ടികൾ', 'കുട്ടിമാർ', 'കുട്ടിയെ', 'കുട്ടിക്ക്'], 'കുട്ടി → കുട്ടികൾ.', 'Kutti → kuttikal.');
M('gender', 1, '"രാജാവ്" — സ്ത്രീലിംഗം', 'Feminine of "raajaavu" (king)', ['രാജ്ഞി', 'രാജകുമാരി', 'റാണിമാർ', 'രാജാത്തി'], 'രാജാവ് → രാജ്ഞി.', 'King → raajni (queen).');
M('gender', 1, '"ഗായകൻ" — സ്ത്രീലിംഗം', 'Feminine of "gaayakan" (singer)', ['ഗായിക', 'ഗായകി', 'ഗായത്രി', 'ഗാനം'], 'ഗായകൻ → ഗായിക.', 'Gaayakan → gaayika.');
M('gender', 1, '"അധ്യാപകൻ" — സ്ത്രീലിംഗം', 'Feminine of "adhyaapakan" (teacher)', ['അധ്യാപിക', 'അധ്യാപകി', 'അധ്യയനം', 'അധ്യാപനം'], 'അധ്യാപകൻ → അധ്യാപിക.', 'Adhyaapakan → adhyaapika.');
M('sandhi', 2, '"വിദ്യാലയം" — പിരിച്ചെഴുതുക', 'Split "vidyaalayam" into its parts', ['വിദ്യ + ആലയം', 'വിദ്യാ + ലയം', 'വിദ് + യാലയം', 'വിദ്യ + ലയം'], 'വിദ്യ + ആലയം = വിദ്യാലയം (സവർണ്ണദീർഘ സന്ധി).', 'Vidya + aalayam (house of learning).');
M('sandhi', 2, '"ഹിമാലയം" — പിരിച്ചെഴുതുക', 'Split "himaalayam" into its parts', ['ഹിമ + ആലയം', 'ഹിമാ + ലയം', 'ഹി + മാലയം', 'ഹിമം + ലയം'], 'ഹിമ + ആലയം = ഹിമാലയം (മഞ്ഞിന്റെ വീട്).', 'Hima (snow) + aalayam (abode).');
M('oneword', 2, 'എല്ലാം അറിയുന്നവൻ — ഒറ്റപ്പദം', 'One word for "one who knows everything"', ['സർവജ്ഞൻ', 'അജ്ഞൻ', 'പണ്ഡിതൻ', 'വിദ്യാർത്ഥി'], 'സർവജ്ഞൻ.', 'Sarvajnan (omniscient).');
M('literature', 1, '"കേരളപാണിനി" എന്നറിയപ്പെടുന്നത്', 'Who is known as "Kerala Panini"?', ['എ. ആർ. രാജരാജവർമ്മ', 'തുഞ്ചത്ത് എഴുത്തച്ഛൻ', 'കുഞ്ചൻ നമ്പ്യാർ', 'ഉള്ളൂർ'], 'എ. ആർ. രാജരാജവർമ്മ — "കേരളപാണിനീയം" എന്ന വ്യാകരണഗ്രന്ഥത്തിന്റെ കർത്താവ്.', 'A. R. Raja Raja Varma, author of the grammar "Kerala Paniniyam".');
M('literature', 1, '"കേരളപാണിനീയം" ഏത് വിഭാഗത്തിലുള്ള ഗ്രന്ഥം?', '"Kerala Paniniyam" is a book on', ['വ്യാകരണം', 'നോവൽ', 'കവിത', 'ചരിത്രം'], 'മലയാള വ്യാകരണ ഗ്രന്ഥം.', 'Malayalam grammar.');
M('literature', 2, 'ലക്ഷണമൊത്ത ആദ്യ മലയാള നോവൽ', 'The first complete (classic-form) Malayalam novel', ['ഇന്ദുലേഖ', 'കുന്ദലത', 'മാർത്താണ്ഡവർമ്മ', 'ചെമ്മീൻ'], 'ഒ. ചന്തുമേനോന്റെ "ഇന്ദുലേഖ" (1889).', 'O. Chandu Menon\'s "Indulekha" (1889).');
M('literature', 1, '"രമണൻ" രചിച്ചത്', '"Ramanan" was written by', ['ചങ്ങമ്പുഴ കൃഷ്ണപിള്ള', 'കുമാരനാശാൻ', 'വള്ളത്തോൾ', 'ഇടപ്പള്ളി രാഘവൻപിള്ള'], 'ചങ്ങമ്പുഴ കൃഷ്ണപിള്ള.', 'Changampuzha Krishna Pillai.');
M('literature', 1, '"ചെമ്മീൻ" രചിച്ചത്', '"Chemmeen" was written by', ['തകഴി ശിവശങ്കരപ്പിള്ള', 'എം. ടി. വാസുദേവൻ നായർ', 'ബഷീർ', 'എസ്. കെ. പൊറ്റെക്കാട്'], 'തകഴി ശിവശങ്കരപ്പിള്ള.', 'Thakazhi Sivasankara Pillai.');
M('literature', 1, '"രണ്ടാമൂഴം" രചിച്ചത്', '"Randamoozham" was written by', ['എം. ടി. വാസുദേവൻ നായർ', 'ഒ. വി. വിജയൻ', 'തകഴി', 'ബെന്യാമിൻ'], 'എം. ടി. വാസുദേവൻ നായർ.', 'M. T. Vasudevan Nair.');
M('literature', 1, '"ആടുജീവിതം" രചിച്ചത്', '"Aadujeevitham" (Goat Days) was written by', ['ബെന്യാമിൻ', 'കെ. ആർ. മീര', 'എം. മുകുന്ദൻ', 'സേതു'], 'ബെന്യാമിൻ.', 'Benyamin.');
M('literature', 1, '"ഖസാക്കിന്റെ ഇതിഹാസം" രചിച്ചത്', '"Khasakkinte Itihasam" was written by', ['ഒ. വി. വിജയൻ', 'എം. മുകുന്ദൻ', 'ബഷീർ', 'തകഴി'], 'ഒ. വി. വിജയൻ.', 'O. V. Vijayan.');
M('literature', 1, '"ബാല്യകാലസഖി" രചിച്ചത്', '"Balyakalasakhi" was written by', ['വൈക്കം മുഹമ്മദ് ബഷീർ', 'തകഴി', 'ഉറൂബ്', 'കേശവദേവ്'], 'വൈക്കം മുഹമ്മദ് ബഷീർ.', 'Vaikom Muhammad Basheer.');
M('literature', 2, 'കേരള സർക്കാരിന്റെ ഏറ്റവും ഉയർന്ന സാഹിത്യ പുരസ്കാരം', 'Highest literary award of the Government of Kerala', ['എഴുത്തച്ഛൻ പുരസ്കാരം', 'വയലാർ അവാർഡ്', 'ഓടക്കുഴൽ അവാർഡ്', 'ജ്ഞാനപീഠം'], 'എഴുത്തച്ഛൻ പുരസ്കാരം.', 'The Ezhuthachan Puraskaram.');
M('literature', 2, '"ഓട്ടൻതുള്ളൽ" എന്ന കലാരൂപത്തിന്റെ ഉപജ്ഞാതാവ്', 'Founder of the art form "Ottanthullal"', ['കുഞ്ചൻ നമ്പ്യാർ', 'തുഞ്ചത്ത് എഴുത്തച്ഛൻ', 'ചെറുശ്ശേരി', 'ഇരയിമ്മൻ തമ്പി'], 'കുഞ്ചൻ നമ്പ്യാർ.', 'Kunchan Nambiar.');

// ------------------------------------------------------------------ REASONING (hand-written)
const R = (topic, d, q, o, x, q_ml) => Q('reasoning', topic, d, q, q_ml || null, o, null, x, null);
R('odd-one-out', 1, 'Find the odd one out: Apple, Mango, Potato, Banana', ['Potato', 'Apple', 'Mango', 'Banana'], 'Potato is a vegetable (a tuber); the rest are fruits.', 'ഒറ്റയാനെ കണ്ടെത്തുക: ആപ്പിൾ, മാങ്ങ, ഉരുളക്കിഴങ്ങ്, വാഴപ്പഴം');
R('odd-one-out', 1, 'Find the odd one out: Dog, Cat, Cow, Sparrow', ['Sparrow', 'Dog', 'Cat', 'Cow'], 'Sparrow is a bird; the others are mammals.', 'ഒറ്റയാൻ: നായ, പൂച്ച, പശു, കുരുവി');
R('analogy', 1, 'Doctor : Hospital :: Teacher : ?', ['School', 'Book', 'Student', 'Chalk'], 'A doctor works in a hospital; a teacher works in a school.');
R('analogy', 1, 'Fish : Water :: Bird : ?', ['Air', 'Nest', 'Tree', 'Feather'], 'Fish move in water; birds fly in air.');
R('calendar', 1, 'If today is Monday, what day will it be after 10 days?', ['Thursday', 'Wednesday', 'Friday', 'Tuesday'], '10 = 7 + 3. Three days after Monday is Thursday.', 'ഇന്ന് തിങ്കളാഴ്ചയെങ്കിൽ 10 ദിവസം കഴിഞ്ഞ്?');
R('direction', 1, 'Anu walks 5 km north, then turns right and walks 3 km. Which direction is she facing now?', ['East', 'West', 'North', 'South'], 'Facing north, a right turn makes you face east.', 'അനു വടക്കോട്ട് 5 കി.മീ നടന്ന് വലത്തോട്ട് തിരിഞ്ഞു. ഇപ്പോൾ ഏത് ദിശ?');
R('blood-relation', 2, 'A is B\'s brother. B is C\'s mother. How is A related to C?', ['Uncle (mother\'s brother)', 'Father', 'Brother', 'Grandfather'], 'A is the brother of C\'s mother, so A is C\'s maternal uncle.');
R('clock', 1, 'What is the angle between the hands of a clock at 3:00?', ['90°', '180°', '60°', '45°'], 'Each hour mark is 30°; 3 × 30° = 90°.');
R('series', 1, 'Next letter: A, C, E, G, ?', ['I', 'H', 'J', 'K'], 'Skip one letter each time: A(b)C(d)E(f)G(h)I.');
R('calendar', 1, 'How many days are there in a leap year?', ['366', '365', '364', '360'], 'A leap year has 366 days (29 days in February).');
R('ranking', 2, 'Ravi is 7th from the top and 12th from the bottom in a class. How many students are in the class?', ['18', '19', '17', '20'], 'Total = 7 + 12 − 1 = 18.', 'രവി മുകളിൽ നിന്ന് 7-ാമനും താഴെ നിന്ന് 12-ാമനും. ആകെ കുട്ടികൾ?');
R('odd-one-out', 1, 'Find the odd number: 2, 3, 5, 9, 11', ['9', '2', '5', '11'], 'All others are prime numbers; 9 = 3 × 3.');
R('coding', 2, 'If CAT = 24 (C=3, A=1, T=20), then DOG = ?', ['26', '24', '27', '25'], 'D=4, O=15, G=7 → 4 + 15 + 7 = 26.');
R('analogy', 2, '2 : 8 :: 3 : ?', ['27', '9', '12', '18'], '2³ = 8, so 3³ = 27.');
R('blood-relation', 2, 'Pointing to a boy, Meena said, "His mother is the only daughter of my mother." How is Meena related to the boy?', ['Mother', 'Aunt', 'Sister', 'Grandmother'], 'The only daughter of Meena\'s mother is Meena herself — so she is his mother.');
R('direction', 2, 'Sunrise is in the east. In the morning, your shadow falls towards the', ['West', 'East', 'North', 'South'], 'The shadow falls opposite the Sun: Sun in east → shadow to the west.');
R('analogy', 1, 'Pen : Write :: Knife : ?', ['Cut', 'Cook', 'Sharp', 'Kitchen'], 'A pen is used to write; a knife is used to cut.');
R('odd-one-out', 1, 'Find the odd one out: Kerala, Tamil Nadu, Karnataka, Chennai', ['Chennai', 'Kerala', 'Tamil Nadu', 'Karnataka'], 'Chennai is a city; the others are states.');

// ------------------------------------------------------------------ GENERATED: QUANT (correct by construction)
const QA = (topic, d, q, ans, wrongs, x, q_ml) => {
  const seen = new Set([String(ans)]);
  const opts = [ans];
  for (const w of wrongs) { if (!seen.has(String(w)) && opts.length < 4) { seen.add(String(w)); opts.push(w); } }
  let k = 1;
  while (opts.length < 4) { const w = typeof ans === 'number' ? ans + k * (k % 2 ? 1 : -1) * Math.max(1, Math.round(Math.abs(ans) * 0.1)) : ans + k; if (!seen.has(String(w))) { seen.add(String(w)); opts.push(w); } k++; }
  Q('quant', topic, d, q, q_ml || null, opts, null, x, null);
};
const rupee = (n) => '₹' + n.toLocaleString('en-IN');
// percentages
for (let i = 0; i < 10; i++) {
  const p = [10, 20, 25, 5, 15, 40, 50, 12, 30, 75][i];
  const base = [200, 450, 800, 1200, 360, 250, 960, 500, 1500, 640][i];
  const ans = base * p / 100;
  QA('percentage', 1, `What is ${p}% of ${base}?`, ans, [ans + base / 10, ans * 2, base - ans, ans + p], `${p}% of ${base} = ${base} × ${p}/100 = ${ans}.`, `${base}-ന്റെ ${p}% എത്ര?`);
}
// simple interest
for (let i = 0; i < 8; i++) {
  const P = [1000, 2000, 5000, 1500, 4000, 2500, 6000, 3000][i];
  const r = [5, 10, 8, 6, 5, 4, 10, 12][i];
  const t = [2, 3, 2, 4, 3, 5, 2, 1][i];
  const si = P * r * t / 100;
  QA('interest', 2, `Simple interest on ${rupee(P)} at ${r}% per year for ${t} year${t === 1 ? '' : 's'} is`, rupee(si), [rupee(si + P * r / 100), rupee(si / 2), rupee(P + si), rupee(si - 50)], `SI = P × R × T / 100 = ${P} × ${r} × ${t} / 100 = ${si}.`, `${rupee(P)}-ന് ${r}% നിരക്കിൽ ${t} വർഷത്തെ സാധാരണ പലിശ`);
}
// averages
for (let i = 0; i < 8; i++) {
  const n = 4 + (i % 3);
  const nums = Array.from({ length: n }, (_, j) => 10 + ((i * 7 + j * 9) % 30));
  const sum = nums.reduce((a, b) => a + b, 0);
  const fix = sum % n; nums[0] += (n - fix) % n; // make divisible
  const s2 = nums.reduce((a, b) => a + b, 0);
  const avg = s2 / n;
  QA('average', 1, `Find the average of ${nums.join(', ')}.`, avg, [avg + 1, avg - 2, avg + 3, s2], `Sum = ${s2}; count = ${n}; average = ${s2} ÷ ${n} = ${avg}.`, `${nums.join(', ')} — ശരാശരി?`);
}
// profit & loss
for (let i = 0; i < 8; i++) {
  const cp = [400, 250, 800, 1200, 500, 150, 2000, 640][i];
  const pct = [25, 20, 10, 15, 30, 40, 5, 25][i];
  const loss = i % 3 === 2;
  const sp = loss ? cp - cp * pct / 100 : cp + cp * pct / 100;
  QA('profit-loss', 2, `A shopkeeper buys an item for ${rupee(cp)} and sells it at a ${loss ? 'loss' : 'profit'} of ${pct}%. What is the selling price?`, rupee(sp), [rupee(loss ? cp + cp * pct / 100 : cp - cp * pct / 100), rupee(cp + pct), rupee(cp * pct / 100), rupee(sp + 10)], `SP = CP ${loss ? '−' : '+'} ${pct}% of CP = ${cp} ${loss ? '−' : '+'} ${cp * pct / 100} = ${sp}.`);
}
// speed, distance, time
for (let i = 0; i < 8; i++) {
  const sp = [40, 60, 50, 45, 30, 72, 80, 36][i];
  const t = [3, 2, 4, 2, 5, 1.5, 2.5, 4][i];
  const d = sp * t;
  if (i % 2 === 0) QA('speed', 1, `A bus travels at ${sp} km/h. How far does it go in ${t} hours?`, `${d} km`, [`${d + sp} km`, `${d - 10} km`, `${sp + t} km`, `${d * 2} km`], `Distance = speed × time = ${sp} × ${t} = ${d} km.`, `ഒരു ബസ് മണിക്കൂറിൽ ${sp} കി.മീ വേഗതയിൽ ${t} മണിക്കൂർ സഞ്ചരിച്ചാൽ ദൂരം?`);
  else QA('speed', 2, `A jeep covers ${d} km in ${t} hours. What is its speed?`, `${sp} km/h`, [`${sp + 5} km/h`, `${sp - 10} km/h`, `${d / 2} km/h`, `${sp * 2} km/h`], `Speed = distance ÷ time = ${d} ÷ ${t} = ${sp} km/h.`);
}
// ratio
for (let i = 0; i < 6; i++) {
  const [a, b] = [[2, 3], [3, 5], [1, 4], [4, 5], [5, 7], [2, 7]][i];
  const total = (a + b) * [20, 15, 30, 12, 10, 25][i];
  const share = total * a / (a + b);
  QA('ratio', 2, `${rupee(total)} is divided between Ammu and Manu in the ratio ${a}:${b}. What is Ammu's share?`, rupee(share), [rupee(total * b / (a + b)), rupee(share + 10), rupee(total / 2), rupee(share - a * 5)], `Ammu gets ${a}/${a + b} of ${total} = ${share}.`);
}
// LCM / HCF
const gcd = (x, y) => (y ? gcd(y, x % y) : x);
for (let i = 0; i < 8; i++) {
  const [a, b] = [[12, 18], [8, 12], [15, 25], [24, 36], [9, 12], [16, 20], [14, 21], [10, 15]][i];
  const h = gcd(a, b); const l = a * b / h;
  if (i % 2 === 0) QA('lcm-hcf', 1, `HCF of ${a} and ${b} is`, h, [l, h * 2, a - b > 0 ? a - b : b - a, h + 1], `Largest number dividing both ${a} and ${b} is ${h}.`);
  else QA('lcm-hcf', 1, `LCM of ${a} and ${b} is`, l, [a * b, h, l + a, l / 2], `Smallest common multiple of ${a} and ${b} is ${l} (= ${a}×${b} ÷ HCF ${h}).`);
}
// time & work
for (let i = 0; i < 5; i++) {
  const [a, b] = [[10, 15], [12, 24], [6, 12], [20, 30], [8, 24]][i];
  const t = a * b / (a + b);
  QA('time-work', 3, `A can finish a job in ${a} days and B in ${b} days. Working together, they finish it in`, `${t} days`, [`${(a + b) / 2} days`, `${a + b} days`, `${t + 2} days`, `${Math.abs(b - a)} days`], `Together per day: 1/${a} + 1/${b} = ${a + b}/${a * b}; days = ${a * b}/${a + b} = ${t}.`);
}
// simplification / BODMAS
for (let i = 0; i < 8; i++) {
  const a = 6 + i * 3, b = 2 + (i % 4), c = 3 + (i % 5), d = 4 + i;
  const val = a + b * c - d;
  QA('simplification', 1, `Simplify: ${a} + ${b} × ${c} − ${d}`, val, [(a + b) * c - d, a + b * (c - d), val + b, val - c], `Multiply first (BODMAS): ${b} × ${c} = ${b * c}; then ${a} + ${b * c} − ${d} = ${val}.`, `ലഘൂകരിക്കുക: ${a} + ${b} × ${c} − ${d}`);
}
// square / square root
for (let i = 0; i < 6; i++) {
  const n = [12, 15, 21, 25, 18, 32][i];
  if (i % 2) QA('numbers', 1, `√${n * n} = ?`, n, [n + 1, n - 1, n * 2, n + 3], `${n} × ${n} = ${n * n}.`);
  else QA('numbers', 1, `${n}² = ?`, n * n, [n * 2, n * n + n, n * n - 1, (n + 1) * (n + 1)], `${n} × ${n} = ${n * n}.`);
}
// unit conversion / money
for (let i = 0; i < 5; i++) {
  const kg = [2.5, 1.25, 3.75, 0.5, 4.2][i];
  QA('units', 1, `${kg} kg = ? grams`, `${kg * 1000} g`, [`${kg * 100} g`, `${kg * 10} g`, `${kg * 10000} g`, `${kg * 1000 + 50} g`], `1 kg = 1000 g → ${kg} × 1000 = ${kg * 1000} g.`, `${kg} കിലോഗ്രാം = ? ഗ്രാം`);
}
// number series
const series = [
  [[2, 4, 6, 8, 10], 12, '+2 each time'], [[3, 6, 12, 24], 48, '×2 each time'], [[1, 4, 9, 16, 25], 36, 'squares: 1², 2², 3²…'], [[5, 10, 20, 40], 80, '×2 each time'],
  [[100, 90, 80, 70], 60, '−10 each time'], [[1, 1, 2, 3, 5, 8], 13, 'each term = sum of previous two'], [[2, 6, 12, 20, 30], 42, 'differences 4, 6, 8, 10, 12'], [[7, 14, 21, 28], 35, 'multiples of 7'],
  [[81, 27, 9, 3], 1, '÷3 each time'], [[1, 8, 27, 64], 125, 'cubes: 1³, 2³, 3³…'], [[11, 13, 17, 19], 23, 'prime numbers'], [[4, 7, 10, 13], 16, '+3 each time'],
  [[2, 3, 5, 8, 12], 17, 'differences 1, 2, 3, 4, 5'], [[1, 3, 9, 27], 81, '×3 each time'], [[50, 45, 40, 35], 30, '−5 each time'],
];
for (const [s, n, why] of series) {
  const alt = [n + 1, n - 1, n + 2, n * 2, n + 5].filter((v) => v !== n);
  Q('reasoning', 'series', 1, `What comes next? ${s.join(', ')}, ?`, `അടുത്ത സംഖ്യ ഏത്? ${s.join(', ')}, ?`, [n, ...alt.slice(0, 3)], null, `Rule: ${why} → ${n}.`, null);
}

// ------------------------------------------------------------------ GENERATED: REASONING (coding-decoding, alphabet)
const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const shiftW = (w, k) => w.split('').map((c) => AL[(AL.indexOf(c) + k + 26) % 26]).join('');
const words = [['CAT', 'DOG'], ['SUN', 'MAP'], ['BOOK', 'PEN'], ['TREE', 'LEAF'], ['RICE', 'MILK'], ['ROAD', 'BUS'], ['HILL', 'RAIN'], ['FISH', 'BOAT']];
words.forEach(([a, b], i) => {
  const k = [1, 2, 1, -1, 2, 1, 3, -1][i];
  const ans = shiftW(b, k);
  Q('reasoning', 'coding', 2, `If ${a} is written as ${shiftW(a, k)}, how is ${b} written?`, `${a} എന്നത് ${shiftW(a, k)} എന്ന് എഴുതിയാൽ ${b} എങ്ങനെ?`, [ans, shiftW(b, k + 1), shiftW(b, -k), b.split('').reverse().join('')], null, `Each letter is moved ${Math.abs(k)} place${Math.abs(k) > 1 ? 's' : ''} ${k > 0 ? 'forward' : 'backward'} in the alphabet: ${b} → ${ans}.`, null);
});
[5, 12, 19, 8, 23, 15].forEach((n, i) => {
  if (i % 2 === 0) Q('reasoning', 'alphabet', 1, `Which is the ${n}${n === 23 ? 'rd' : 'th'} letter of the English alphabet?`, null, [AL[n - 1], AL[n], AL[n - 2], AL[26 - n]], null, `Counting A = 1 … the ${n}${n === 23 ? "rd" : "th"} letter is ${AL[n - 1]}.`, null);
  else Q('reasoning', 'alphabet', 2, `Which letter is ${n}${n === 23 ? 'rd' : 'th'} from the END of the English alphabet?`, null, [AL[26 - n], AL[n - 1], AL[27 - n] || 'Z', AL[25 - n]], null, `${n}th from the end = (27 − ${n}) = ${27 - n}th from the start = ${AL[26 - n]}.`, null);
});
[[3, 'Wednesday'], [5, 'Friday'], [6, 'Saturday'], [4, 'Thursday']].forEach(([k, ans], i) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const n = 7 * (i + 2) + k; // starting Sunday
  Q('reasoning', 'calendar', 2, `If today is Sunday, what day will it be after ${n} days?`, `ഇന്ന് ഞായറാഴ്ചയെങ്കിൽ ${n} ദിവസം കഴിഞ്ഞ്?`, [ans, days[(k + 1) % 7], days[(k + 6) % 7], days[(k + 3) % 7]], null, `${n} = 7 × ${i + 2} + ${k}. ${k} days after Sunday is ${ans}.`, null);
});

// ------------------------------------------------------------------ write
const file = path.join(__dirname, 'questions.json');
fs.writeFileSync(file, JSON.stringify({ version: 1, generated: 'build-bank.js', note: 'Correct option authored first, shuffled deterministically. Facts chosen for stability; review periodically.', questions: out }, null, 0));
const by = {};
for (const q of out) by[q.subject] = (by[q.subject] || 0) + 1;
console.log('questions:', out.length, by);
