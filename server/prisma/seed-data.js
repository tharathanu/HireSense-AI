// Starter content for the aptitude question bank and GD topics.
// Admins can add, edit or deactivate these from the admin panel.

const q = (category, difficulty, question, options, correctIndex, explanation) => ({
  category, difficulty, question, options, correctIndex, explanation,
});

const QUESTIONS = [
  // ---------- Quantitative ----------
  q('QUANTITATIVE', 'EASY', 'What is 15% of 240?', ['32', '36', '40', '48'], 1, '0.15 × 240 = 36.'),
  q('QUANTITATIVE', 'EASY', 'A train travels 300 km in 5 hours. What is its average speed?', ['50 km/h', '55 km/h', '60 km/h', '65 km/h'], 2, '300 ÷ 5 = 60 km/h.'),
  q('QUANTITATIVE', 'EASY', 'The ratio of boys to girls in a class of 40 is 3 : 2. How many girls are there?', ['12', '16', '20', '24'], 1, '2/5 × 40 = 16.'),
  q('QUANTITATIVE', 'EASY', 'What is the simple interest on ₹5,000 at 8% per annum for 2 years?', ['₹400', '₹800', '₹1,000', '₹1,600'], 1, '5000 × 8 × 2 ÷ 100 = 800.'),
  q('QUANTITATIVE', 'MEDIUM', 'A can finish a job in 12 days and B in 18 days. How long will they take working together?', ['6 days', '7.2 days', '7.5 days', '8 days'], 1, '1/12 + 1/18 = 5/36, so 36/5 = 7.2 days.'),
  q('QUANTITATIVE', 'MEDIUM', 'An item bought for ₹800 is sold for ₹920. What is the profit percentage?', ['12%', '15%', '18%', '20%'], 1, 'Profit 120 ÷ 800 = 15%.'),
  q('QUANTITATIVE', 'MEDIUM', 'The average of five numbers is 24. When one number is removed, the average becomes 22. Which number was removed?', ['28', '30', '32', '34'], 2, '120 − (4 × 22) = 32.'),
  q('QUANTITATIVE', 'MEDIUM', 'What is the compound interest on ₹10,000 at 10% per annum for 2 years, compounded yearly?', ['₹2,000', '₹2,100', '₹2,200', '₹2,310'], 1, '10000 × 1.1² − 10000 = 2100.'),
  q('QUANTITATIVE', 'HARD', 'Two pipes fill a tank in 20 and 30 minutes. An outlet empties it in 15 minutes. With all three open, how long does it take to fill the empty tank?', ['45 minutes', '60 minutes', '75 minutes', '90 minutes'], 1, '1/20 + 1/30 − 1/15 = 1/60, so 60 minutes.'),
  q('QUANTITATIVE', 'HARD', 'The price of sugar rises by 25%. By what percentage must a family reduce consumption to keep spending the same?', ['20%', '25%', '15%', '22.5%'], 0, '25 ÷ 125 × 100 = 20%.'),
  q('QUANTITATIVE', 'HARD', 'A boat moves at 15 km/h in still water and the stream flows at 3 km/h. How long does it take to go 36 km downstream and return?', ['4 hours', '4.5 hours', '5 hours', '6 hours'], 2, '36 ÷ 18 = 2 h down, 36 ÷ 12 = 3 h up; total 5 hours.'),
  q('QUANTITATIVE', 'HARD', 'In how many distinct ways can the letters of the word LEVEL be arranged?', ['30', '60', '120', '20'], 0, '5! ÷ (2! × 2!) = 30.'),

  // ---------- Logical ----------
  q('LOGICAL', 'EASY', 'What comes next in the series 2, 6, 12, 20, 30, ?', ['40', '42', '44', '48'], 1, 'Differences increase by 2: 4, 6, 8, 10, 12.'),
  q('LOGICAL', 'EASY', 'If CAT is written as DBU, how is DOG written?', ['EPH', 'DPH', 'EOH', 'FQI'], 0, 'Each letter moves one step forward.'),
  q('LOGICAL', 'EASY', 'All pens are tools. All tools are useful. Which conclusion definitely follows?', ['All pens are useful', 'All useful things are pens', 'Some tools are not pens', 'No pen is useful'], 0, 'Pens ⊂ tools ⊂ useful things.'),
  q('LOGICAL', 'EASY', 'Which one is the odd one out?', ['Apple', 'Mango', 'Carrot', 'Banana'], 2, 'Carrot is a vegetable; the rest are fruits.'),
  q('LOGICAL', 'MEDIUM', 'A is B’s brother. C is A’s mother. D is C’s father. How is B related to D?', ['Son', 'Grandchild', 'Nephew', 'Brother'], 1, 'B is C’s child, and C is D’s child.'),
  q('LOGICAL', 'MEDIUM', 'What comes next in the series 5, 11, 23, 47, ?', ['94', '95', '96', '97'], 1, 'Each term is double the previous plus 1.'),
  q('LOGICAL', 'MEDIUM', 'What is the angle between the hour and minute hands of a clock at 3:30?', ['60°', '75°', '90°', '105°'], 1, 'Hour hand at 105°, minute hand at 180°; difference 75°.'),
  q('LOGICAL', 'MEDIUM', 'If MONDAY is coded as 123456 and DAY as 456, what is the code for MAY?', ['156', '154', '146', '165'], 0, 'M = 1, A = 5, Y = 6.'),
  q('LOGICAL', 'HARD', 'Pointing to a photo, Ravi says, “She is the daughter of my grandfather’s only son.” How is the girl related to Ravi?', ['Cousin', 'Sister', 'Niece', 'Aunt'], 1, 'The grandfather’s only son is Ravi’s father, so the girl is Ravi’s sister.'),
  q('LOGICAL', 'HARD', 'What comes next in the series 2, 3, 5, 9, 17, ?', ['31', '32', '33', '34'], 2, 'Differences double: 1, 2, 4, 8, 16.'),
  q('LOGICAL', 'HARD', 'Some doctors are teachers. All teachers are writers. Conclusions: I. Some doctors are writers. II. All writers are doctors. Which follows?', ['Only I follows', 'Only II follows', 'Both follow', 'Neither follows'], 0, 'Doctors who are teachers are also writers; II cannot be concluded.'),
  q('LOGICAL', 'HARD', 'If 1 January 2023 was a Sunday, what day was 1 January 2024?', ['Sunday', 'Monday', 'Tuesday', 'Saturday'], 1, '2023 has 365 days, which shifts the day by one.'),

  // ---------- Verbal ----------
  q('VERBAL', 'EASY', 'Choose the word closest in meaning to “abundant”.', ['Scarce', 'Plentiful', 'Tiny', 'Rare'], 1, 'Abundant means existing in large quantities.'),
  q('VERBAL', 'EASY', 'Choose the word opposite in meaning to “expand”.', ['Enlarge', 'Contract', 'Extend', 'Increase'], 1, 'Contract means to become smaller.'),
  q('VERBAL', 'EASY', 'Fill in the blank: “She ___ to the office every day.”', ['go', 'goes', 'going', 'gone'], 1, 'Singular subject in the simple present takes “goes”.'),
  q('VERBAL', 'EASY', 'Which word is spelled correctly?', ['Accomodate', 'Acommodate', 'Accommodate', 'Acomodate'], 2, 'Accommodate has double c and double m.'),
  q('VERBAL', 'MEDIUM', 'Choose the word closest in meaning to “meticulous”.', ['Careless', 'Thorough', 'Quick', 'Lazy'], 1, 'Meticulous means showing great attention to detail.'),
  q('VERBAL', 'MEDIUM', 'Which sentence is grammatically correct?', ['Neither the manager nor the employees was present.', 'Neither the manager nor the employees were present.', 'Neither the manager or the employees were present.', 'Neither the manager nor the employees is present.'], 1, 'With neither/nor, the verb agrees with the nearer subject (employees).'),
  q('VERBAL', 'MEDIUM', 'One word for “a person who speaks many languages”:', ['Linguist', 'Polyglot', 'Bilingual', 'Translator'], 1, 'A polyglot knows and uses several languages.'),
  q('VERBAL', 'MEDIUM', 'What does the idiom “break the ice” mean?', ['To damage something fragile', 'To start a conversation in an awkward situation', 'To end a friendship', 'To win a competition'], 1, 'It means easing tension to start talking.'),
  q('VERBAL', 'HARD', 'Choose the word opposite in meaning to “ephemeral”.', ['Fleeting', 'Permanent', 'Brief', 'Momentary'], 1, 'Ephemeral means lasting a very short time.'),
  q('VERBAL', 'HARD', 'Fill in the blank: “The committee’s decision was ___; no one could find any fault with it.”', ['ambiguous', 'unimpeachable', 'arbitrary', 'tentative'], 1, 'Unimpeachable means beyond doubt or criticism.'),
  q('VERBAL', 'HARD', 'Pen is to Writer as Scalpel is to ___.', ['Butcher', 'Surgeon', 'Painter', 'Tailor'], 1, 'A scalpel is the tool of a surgeon.'),
  q('VERBAL', 'HARD', 'Which sentence is punctuated correctly?', ['Its a good day, isnt it?', 'It’s a good day, isn’t it?', 'Its’ a good day, isn’t it?', 'It’s a good day isnt’ it?'], 1, '“It’s” = it is; “isn’t” = is not.'),

  // ---------- Technical ----------
  q('TECHNICAL', 'EASY', 'What does HTML stand for?', ['HyperText Markup Language', 'HighText Machine Language', 'HyperTool Multi Language', 'Home Tool Markup Language'], 0, 'HTML is HyperText Markup Language.'),
  q('TECHNICAL', 'EASY', 'Which data structure follows First In, First Out (FIFO)?', ['Stack', 'Queue', 'Tree', 'Graph'], 1, 'A queue removes items in the order they were added.'),
  q('TECHNICAL', 'EASY', 'Which SQL command is used to read data from a table?', ['GET', 'SELECT', 'READ', 'FETCH'], 1, 'SELECT retrieves rows.'),
  q('TECHNICAL', 'EASY', 'In JavaScript, which keyword declares a block-scoped variable that cannot be reassigned?', ['var', 'let', 'const', 'static'], 2, 'const cannot be reassigned.'),
  q('TECHNICAL', 'MEDIUM', 'What is the time complexity of binary search on a sorted array of n elements?', ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], 1, 'The search space halves each step.'),
  q('TECHNICAL', 'MEDIUM', 'Which HTTP method is normally used to partially update a resource?', ['GET', 'POST', 'PATCH', 'DELETE'], 2, 'PATCH applies a partial update.'),
  q('TECHNICAL', 'MEDIUM', 'What does typeof null return in JavaScript?', ['"null"', '"undefined"', '"object"', '"number"'], 2, 'A long-standing JavaScript quirk returns "object".'),
  q('TECHNICAL', 'MEDIUM', 'Which SQL clause filters groups after aggregation?', ['WHERE', 'HAVING', 'ORDER BY', 'LIMIT'], 1, 'HAVING filters grouped results.'),
  q('TECHNICAL', 'HARD', 'Which combination gives an LRU cache with O(1) get and put?', ['Array and binary search', 'Hash map and doubly linked list', 'Stack and queue', 'Binary search tree only'], 1, 'The map finds nodes; the list keeps usage order.'),
  q('TECHNICAL', 'HARD', 'What is the worst-case time complexity of quicksort?', ['O(n log n)', 'O(n)', 'O(n²)', 'O(log n)'], 2, 'Poor pivot choices make it quadratic.'),
  q('TECHNICAL', 'HARD', 'A transaction reads data changed by another transaction that has not yet committed. What is this called?', ['Phantom read', 'Dirty read', 'Lost update', 'Deadlock'], 1, 'Reading uncommitted changes is a dirty read.'),
  q('TECHNICAL', 'HARD', 'What does console.log([1, 2, 3] + [4]) print in JavaScript?', ['1,2,34', '[1,2,3,4]', '10', '1,2,3,4'], 0, 'Both arrays become strings: "1,2,3" + "4".'),
];

const TOPICS = [
  { title: 'Should coding be a compulsory subject in schools?', category: 'Education', description: 'Discuss the benefits, costs and practical challenges of making programming mandatory from middle school.' },
  { title: 'Remote work vs office work: which is better for freshers?', category: 'Workplace', description: 'Consider learning, mentorship, productivity, work-life balance and career growth for early-career professionals.' },
  { title: 'Will artificial intelligence create more jobs than it replaces?', category: 'Technology', description: 'Look at automation, new roles, reskilling and how different industries may be affected.' },
  { title: 'Is a college degree still necessary to get a good tech job?', category: 'Careers', description: 'Compare degrees, certifications, projects and skills-based hiring.' },
  { title: 'Should social media platforms verify the age of every user?', category: 'Society', description: 'Weigh child safety against privacy, cost and freedom of access.' },
  { title: 'Electric vehicles: are they ready for mass adoption in India?', category: 'Environment', description: 'Discuss charging infrastructure, cost, batteries, power sources and government policy.' },
  { title: 'Startups or established companies: where should freshers begin their careers?', category: 'Careers', description: 'Compare learning speed, stability, pay, responsibility and long-term growth.' },
  { title: 'Should online gaming be regulated by the government?', category: 'Society', description: 'Discuss addiction, the gaming economy, real-money games and personal freedom.' },
];

module.exports = { QUESTIONS, TOPICS };
