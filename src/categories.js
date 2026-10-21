// Song categories and the filename rules used to assign them.
// Rules are checked in order and the first match wins; anything unmatched is Romance.

// `art` is the gradient used for the category's cover tiles
export const CATEGORIES = {
  devotional: { label: 'Devotional', emoji: '🪔', accent: '#ffb347', art: 'linear-gradient(135deg, #ffb347, #a0300a)', tagline: 'Bhajans, aartis and kirtans to start the day' },
  sufi: { label: 'Sufi', emoji: '🌙', accent: '#e8c872', art: 'linear-gradient(135deg, #e8c872, #3b2466)', tagline: 'Qawwali-soaked soul for late nights' },
  rock: { label: 'Rock', emoji: '🎸', accent: '#ff4d4d', art: 'linear-gradient(135deg, #ff4d4d, #2a0000)', tagline: 'Loud guitars, big choruses, no skips' },
  party: { label: 'Party', emoji: '🪩', accent: '#ff4fd8', art: 'linear-gradient(135deg, #ff4fd8, #4f3bff)', tagline: 'Turn it up and hit the floor' },
  romance: { label: 'Romance', emoji: '💖', accent: '#ff7aa2', art: 'linear-gradient(135deg, #ff9ab8, #8e2a52)', tagline: 'Love songs, old and new' },
  retro: { label: 'Retro', emoji: '📻', accent: '#e0a96d', art: 'linear-gradient(135deg, #e0a96d, #4a2f17)', tagline: 'Golden-era classics on vinyl' },
  rainy: { label: 'Rainy Mood', emoji: '🌧️', accent: '#8ec5e8', art: 'linear-gradient(135deg, #8ec5e8, #1c2833)', tagline: 'For grey skies and quiet thoughts' },
  dreamy: { label: 'Dreamy', emoji: '🌌', accent: '#7ee8c7', art: 'linear-gradient(135deg, #7ee8c7, #2b2f8f)', tagline: 'Starry, floaty, headphones-on music' },
};

const RULES = [
  ['devotional', /bhaja|bhajj|ganesh|ganpati|ganapati|vakratunda|krishna|gopal|govind|girdhar|giridhar|\bhari\b|hari om|\bram\b|ramchandra|prabhu|sai naath|kirtan|shlok|mangal bhavan|satyam shivam|itni shakti|radha|meera|deenen|laaj rakho|prem sagar|nirgun|duniya ke rakhwale|maha mantra|bhagwan|kripa|naam ka deep|ghunghat ke pat|sain teri|preet tihari|vinay meri|na yeh tera/i],
  ['sufi', /kun faya|kabira|subhan ?allah|ilahi|rahat fateh|sayyoni|luttna|jugni|tere dar per|mitti di khushboo|tere bin nahi lagda|awaarapan|meherbaan/i],
  ['rock', /linkin|nirvana|green day|pink floyd|eluveitie|imagine dragons|rock on|saadda haq|dichotomy|lose yourself|not afraid|the local train|the train -|sinbad|zinda\b|phir se ud|in the end/i],
  ['party', /pappu cant dance|badtameez|daaru|twist|dhunki|choomantar|entriyaan|saadi galli|enrique|pitbull|flo rida|saxobeat|icona pop|guetta|lovers on the sun|don't stop the music|moves like jagger|applause|all rise|madari|delhibelly|delhi 6|ajj din chadheya|madhubala|whistle|burn|counting stars|i knew you were trouble|taylor swift - 22|princess of china/i],
  ['retro', /kishore|rafi|lata mangeshkar|chitchor|abhimaan|pathar ke sanam|saudagar|noorie|kaajal|jewel thief|mere apne|chashme buddoor|safar -|choudvein|khoya khoya|musafir hoon|zindagi ka saath|gum hai kisi|aap ki aak|lambi judai|ankhiyon ke jhar|surmayee|naam goom|likhe jo khat|taarif|teri aankhon ke siva|na koi umang|such keh raha|aane wala pal|chala jata|ajnabi haseena|zaroorat hai|kehna hai tumse|jeevan se bhari|sama hai suhana|purani rahon|chalte chalte|chor de sari|duniya kare sawal|nainon mein badra|tere bina zindagi|yeh haseen vadiyan|dono ne kiya|koi aanay wala|o duniya|kabhi bandhan|sau bar janam|sau baar janam|tere piyari|tere bindiyan|madhuban|chale the saath|dil ka rishta/i],
  ['rainy', /fix you|scientist|summertime sadness|september ends|everybody hurts|wish you were here|shikayatein|tanha dil|ghum shum|hardest part|born to die|misery|nadaan parinde|barso re|mausam|naina lagiyan|rain over me|leave out all the rest|duur|show me the meaning|zaroorat\.mp3|zindagi kaisi hai|dunia na bhaaye|kahin to hogi/i],
  ['dreamy', /coldplay|atlas|game of thrones|instrumental|string quartet|ellie goulding|i see fire|lenka|visual communication|right here waiting|when you say nothing|rolling in the deep|socha hai|yu hi chala|pichhle saat|sparks fly|everything has changed|stay stay stay|red - lyrics|guzarish|behka/i],
];

export const categorize = (title) => {
  const rule = RULES.find(([, pattern]) => pattern.test(title));
  return rule ? rule[0] : 'romance';
};
