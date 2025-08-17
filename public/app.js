document.addEventListener('DOMContentLoaded', () => {
  const termSelect = document.getElementById('term-select');
  const subjectSelect = document.getElementById('subject-select');
  const coursesContainer = document.getElementById('courses-container');
  const loadingMessage = document.getElementById('loading-message');
  const modal = document.getElementById('details-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const darkToggle = document.getElementById('dark-toggle');
  const root = document.documentElement;

  // --- New Menu Elements ---
  const menuToggleBtn = document.getElementById('menu-toggle-btn');
  const menuDropdown = document.getElementById('menu-dropdown');
  const menuOptionsBtn = document.getElementById('menu-options-btn');
  const menuScheduleBtn = document.getElementById('menu-schedule-btn');

  // --- Dark mode persistence ---
  if (localStorage.getItem('theme') === 'dark') {
    root.classList.add('dark');
    darkToggle.textContent = "☀️";
  } else darkToggle.textContent = "🌙";

  darkToggle.addEventListener('click', () => {
    root.classList.toggle('dark');
    localStorage.setItem('theme', root.classList.contains('dark') ? 'dark' : 'light');
    darkToggle.textContent = root.classList.contains('dark') ? "☀️" : "🌙";
  });

  // --- New Menu Logic ---
  menuToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent the click from immediately closing the menu
    menuDropdown.classList.toggle('hidden');
  });

  // --- Options Panel (now a slide-out panel, not fixed button) ---
  const optionsPanel = document.createElement('div');
  optionsPanel.id = 'options-panel';
  optionsPanel.className = 'fixed top-0 left-0 z-50 h-full w-72 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-4 shadow-lg transform -translate-x-full transition-transform duration-300';
  optionsPanel.innerHTML = `
    <h3 class="text-xl font-bold mb-2">📚 Your Courses</h3>
    <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
      View your bookmarked and watched courses here. You can remove courses or view details directly.
    </p>
    <div class="flex gap-2 mb-4">
      <button id="show-bookmarks-tab" class="flex-1 px-3 py-1 rounded-lg bg-yellow-400 dark:bg-yellow-600 hover:brightness-105 transition">Bookmarks</button>
      <button id="show-watched-tab" class="flex-1 px-3 py-1 rounded-lg bg-blue-400 dark:bg-blue-600 hover:brightness-105 transition">Watched</button>
    </div>
    <ul id="options-list" class="space-y-2 max-h-[70vh] overflow-auto"></ul>
    <button id="close-options" class="mt-4 w-full px-3 py-1 rounded-lg bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 transition">Close</button>
  `;
  document.body.appendChild(optionsPanel);

  const optionsList = optionsPanel.querySelector('#options-list');
  const closeOptionsBtn = optionsPanel.querySelector('#close-options');
  const showBookmarksTab = optionsPanel.querySelector('#show-bookmarks-tab');
  const showWatchedTab = optionsPanel.querySelector('#show-watched-tab');

  // Event listener for the new menu item to open the options panel
  menuOptionsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    optionsPanel.classList.remove('-translate-x-full');
    menuDropdown.classList.add('hidden'); // Close dropdown after clicking
  });
  closeOptionsBtn.addEventListener('click', () => optionsPanel.classList.add('-translate-x-full'));

  // --- Close panels when clicking outside ---
  document.addEventListener('click', (e) => {
    // Close options panel
    const isClickInsideOptions = optionsPanel.contains(e.target) || menuOptionsBtn.contains(e.target);
    if (!isClickInsideOptions) {
      optionsPanel.classList.add('-translate-x-full');
    }

    // Close menu dropdown
    if (!menuToggleBtn.contains(e.target)) {
      menuDropdown.classList.add('hidden');
    }
  });


  // --- Data ---
  let termsData = [];
  let allCourses = [];
  let bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
  let watchedCourses = JSON.parse(localStorage.getItem('watchedCourses') || '[]');

  const subjectMap = {
    ANT: 'Anthropology',
    ARC: 'Architectural Technology',
    ART: 'Art History',
    AIM: 'Artificial Intelligence Mgmt',
    AET: 'Automotive Technology',
    AVN: 'Aviation',
    BIO: 'Biology',
    BUS: 'Business',
    CHM: 'Chemistry',
    CHI: 'Chinese',
    CIV: 'Civil Engineering Technology',
    CSC: 'Computer Science',
    CPS: 'Computer Security Technology',
    BCS: 'Computer Systems',
    CON: 'Construction Management',
    CRJ: 'Criminal Justice',
    DEN: 'Dental Hygiene',
    ECO: 'Economics',
    EET: 'Electrical Engineering Tech',
    ETM: 'Engineering Technology Mngmnt',
    EGL: 'English',
    ENV: 'Environmental Studies',
    FYE: 'First Year Experience',
    FRE: 'French',
    FRX: 'Freshman Experience',
    GIS: 'Geographic Information Systems',
    GEO: 'Geography',
    GER: 'German',
    GRO: 'Gerontology',
    HPW: 'Health Promotion and Wellness',
    HIS: 'History',
    HON: 'Honors Program',
    HOR: 'Horticulture',
    HUM: 'Humanities',
    IND: 'Industrial Technology',
    IXD: 'Interaction Design',
    ITA: 'Italian',
    MTH: 'Mathematics',
    MET: 'Mechanical Engineering Tech',
    MLS: 'Medical Laboratory Science',
    MLG: 'Modern Languages',
    NUR: 'Nursing',
    NTR: 'Nutrition Science',
    PHI: 'Philosophy',
    PED: 'Physical Education',
    PHY: 'Physics and Physical Science',
    POL: 'Politics',
    PCM: 'Professional Communications',
    PSY: 'Psychology',
    RAM: 'Research Aligned Mentorship',
    RUS: 'Russian',
    STS: 'Science, Tech and Society',
    SST: 'Security Systems Technology',
    SOC: 'Sociology',
    SPA: 'Spanish',
    SPE: 'Speech',
    SMT: 'Sport Management',
    THE: 'Theatre',
    VIS: 'Visual Communications'
  };
  const subjectColorMap = {
    ANT: 'bg-red-400',
    ARC: 'bg-green-400',
    ART: 'bg-blue-400',
    AIM: 'bg-yellow-400',
    AET: 'bg-lime-500',
    AVN: 'bg-purple-400',
    BIO: 'bg-pink-400',
    BUS: 'bg-indigo-400',
    CHM: 'bg-teal-400',
    CHI: 'bg-red-500',
    CIV: 'bg-gray-500',
    CSC: 'bg-orange-400',
    CPS: 'bg-sky-500',
    BCS: 'bg-cyan-400',
    CON: 'bg-amber-500',
    CRJ: 'bg-rose-500',
    DEN: 'bg-teal-300',
    ECO: 'bg-green-500',
    EET: 'bg-blue-500',
    ETM: 'bg-violet-400',
    EGL: 'bg-rose-400',
    ENV: 'bg-emerald-400',
    FYE: 'bg-gray-400',
    FRE: 'bg-blue-300',
    FRX: 'bg-indigo-300',
    GIS: 'bg-emerald-600',
    GEO: 'bg-lime-600',
    GER: 'bg-amber-400',
    GRO: 'bg-fuchsia-400',
    HPW: 'bg-green-300',
    HIS: 'bg-orange-500',
    HON: 'bg-yellow-300',
    HOR: 'bg-lime-400',
    HUM: 'bg-pink-300',
    IND: 'bg-cyan-500',
    IXD: 'bg-sky-400',
    ITA: 'bg-green-600',
    MTH: 'bg-indigo-500',
    MET: 'bg-gray-600',
    MLS: 'bg-teal-500',
    MLG: 'bg-red-300',
    NUR: 'bg-rose-300',
    NTR: 'bg-lime-300',
    PHI: 'bg-purple-300',
    PED: 'bg-sky-300',
    PHY: 'bg-orange-300',
    POL: 'bg-indigo-600',
    PCM: 'bg-fuchsia-500',
    PSY: 'bg-violet-500',
    RAM: 'bg-yellow-500',
    RUS: 'bg-red-600',
    STS: 'bg-gray-500',
    SST: 'bg-sky-600',
    SOC: 'bg-pink-500',
    SPA: 'bg-orange-600',
    SPE: 'bg-fuchsia-300',
    SMT: 'bg-blue-600',
    THE: 'bg-purple-500',
    VIS: 'bg-amber-300'
};

  // --- Schedule config ---
  const SCHEDULE_START_HOUR = 7; // 7 AM
  const SCHEDULE_END_HOUR = 22;  // 10 PM
  const SLOT_MINUTES = 15;       // 15-minute slots
  const SLOTS_PER_DAY = ((SCHEDULE_END_HOUR - SCHEDULE_START_HOUR) * 60) / SLOT_MINUTES;

  const scheduleContainer = document.createElement('div');
  scheduleContainer.id = 'schedule-container';
  scheduleContainer.className = 'hidden p-4';
  document.body.appendChild(scheduleContainer);

  // --- Fetch terms ---
  fetch('/terms')
    .then(res => res.json())
    .then(data => {
      termsData = data;
      populateTerms(data);
      termSelect.disabled = false;
    })
    .catch(() => termSelect.innerHTML = '<option>Error loading terms</option>');

  termSelect.addEventListener('change', () => {
    const selectedTerm = termsData.find(t => t.termCode === termSelect.value);
    if (selectedTerm) populateSubjects(selectedTerm.subjects);
    subjectSelect.disabled = !selectedTerm;
    coursesContainer.innerHTML = '';
  });

  subjectSelect.addEventListener('change', () => {
    if(termSelect.value && subjectSelect.value) fetchCourses(termSelect.value, subjectSelect.value);
  });

  function populateTerms(terms) {
    termSelect.innerHTML = '<option value="">Select a Term</option>';
    terms.forEach(term => {
      const option = document.createElement('option');
      option.value = term.termCode;
      option.textContent = term.termName;
      termSelect.appendChild(option);
    });
  }

  function populateSubjects(subjects) {
    subjectSelect.innerHTML = '<option value="">Select a Subject</option>';
    subjects.forEach(code => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = `${code} – ${subjectMap[code] || code}`;
      subjectSelect.appendChild(option);
    });
  }

  // --- Fetch & display courses ---
  function fetchCourses(term, subject) {
    loadingMessage.classList.remove('hidden');
    coursesContainer.innerHTML = '';
    fetch(`/courses/${term}/${subject}`)
      .then(res => res.json())
      .then(data => {
        loadingMessage.classList.add('hidden');
        allCourses = data.courses || [];
        displayCourses(allCourses);
      })
      .catch(() => {
        loadingMessage.classList.add('hidden');
        coursesContainer.innerHTML = `<p class="text-red-600">Error loading courses.</p>`;
      });
  }

  function displayCourses(courses) {
    coursesContainer.innerHTML = '';
    if (!courses.length) {
      coursesContainer.innerHTML = `<p class="text-gray-600 dark:text-gray-400">No courses found.</p>`;
      return;
    }

    courses.forEach(course => {
      const courseNumberMatch = course.courseName.match(/\d{3}/);
      const courseNumber = courseNumberMatch ? courseNumberMatch[0] : '';
      const scheduleInfo = course.schedule?.map(s => {
        const locationEmoji = s.where.toUpperCase().includes('ONLINE') ? '💻 Online' : '🏫 In-person';
        return `<p class="text-sm text-gray-600 dark:text-gray-400">${s.days} ${s.time} • ${locationEmoji}</p>`;
      }).join('') || '';

      const seatsPercent = course.seats ? (course.seats.actual / course.seats.capacity) * 100 : 0;
      const seatsColor = seatsPercent > 80 ? 'bg-red-500' : seatsPercent > 50 ? 'bg-yellow-400' : 'bg-green-500';

      const card = document.createElement('div');
      card.className = `bg-white dark:bg-gray-800 rounded-xl shadow hover:shadow-lg transition p-5 flex flex-col justify-between`;

      card.innerHTML = `
        <div>
          <h3 class="text-lg font-semibold ${subjectColorMap[course.subjectCode] || 'text-blue-700'}">
            ${course.subjectCode} ${courseNumber} – ${course.courseName}
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">CRN: ${course.crn}</p>
          <p class="mt-1 font-medium">👨‍🏫 ${course.instructor}</p>
          <div class="mt-2 space-y-1">${scheduleInfo}</div>
          ${course.seats ? `<div class="w-full h-2 rounded bg-gray-200 dark:bg-gray-700 mt-1">
            <div class="h-2 rounded ${seatsColor}" style="width:${seatsPercent}%;"></div>
          </div>` : ''}
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button class="details-btn bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex-1" data-term="${termSelect.value}" data-crn="${course.crn}">🔍 View Details</button>
          <a href="https://oasis.farmingdale.edu/pls/prod/twbkwbis.P_WWWLogin" target="_blank" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex-1 text-center">📝 Sign Up</a>
          <button class="bookmark-btn ${bookmarks.includes(course.crn) ? 'bg-yellow-500' : 'bg-gray-300'} hover:bg-yellow-400 text-white px-4 py-2 rounded-lg flex-1" data-crn="${course.crn}">${bookmarks.includes(course.crn) ? '★ Bookmarked' : '☆ Bookmark'}</button>
          <button class="watch-btn ${watchedCourses.includes(course.crn) ? 'bg-blue-500' : 'bg-gray-300'} text-white px-4 py-2 rounded-lg flex-1" data-crn="${course.crn}" data-term="${termSelect.value}">${watchedCourses.includes(course.crn) ? '👁 Watching' : '👁 Watch'}</button>
        </div>
      `;
      coursesContainer.appendChild(card);
    });
  }

  // --- Event delegation ---
  coursesContainer.addEventListener('click', e => {
    if(e.target.classList.contains('details-btn')) fetchCourseDetails(termSelect.value, e.target.dataset.crn);
    if(e.target.classList.contains('bookmark-btn')) toggleBookmark(e.target);
    if(e.target.classList.contains('watch-btn')) toggleWatch(e.target);
  });

  function toggleBookmark(button){
    const crn = button.dataset.crn;
    bookmarks = bookmarks.includes(crn) ? bookmarks.filter(c => c !== crn) : [...bookmarks, crn];
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    button.textContent = bookmarks.includes(crn) ? '★ Bookmarked' : '☆ Bookmark';
    button.classList.toggle('bg-yellow-500', bookmarks.includes(crn));
    button.classList.toggle('bg-gray-300', !bookmarks.includes(crn));
  }

  function toggleWatch(button){
    const crn = button.dataset.crn;
    const term = button.dataset.term;
    const watching = watchedCourses.includes(crn);
    fetch(`/watch/${term}/${crn}`, { method: watching ? 'DELETE' : 'POST' })
      .then(() => {
        watchedCourses = watching ? watchedCourses.filter(c => c !== crn) : [...watchedCourses, crn];
        localStorage.setItem('watchedCourses', JSON.stringify(watchedCourses));
        button.textContent = watching ? '👁 Watch' : '👁 Watching';
        button.classList.toggle('bg-blue-500', !watching);
        button.classList.toggle('bg-gray-300', watching);
      });
  }

  // --- Modal ---
  function fetchCourseDetails(term, crn){
    fetch(`/course-details/${term}/${crn}`)
      .then(res => res.json())
      .then(displayCourseDetails)
      .catch(() => {
        modalBody.innerHTML = '<p class="text-red-600">Error loading details.</p>';
        modal.classList.remove('hidden');
      });
  }

  function displayCourseDetails(details){
    modalTitle.textContent = details.title;
    const seats = details.seats?.capacity ? `<div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
      <p class="font-semibold">Seats</p>
      <p>Total: ${details.seats.capacity}</p>
      <p>Taken: ${details.seats.actual}</p>
      <p>Remaining: ${details.seats.remaining}</p>
    </div>` : '<p>Seats info not available</p>';

    const waitlist = details.waitlist?.capacity ? `<div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
      <p class="font-semibold">Waitlist</p>
      <p>Total: ${details.waitlist.capacity}</p>
      <p>Taken: ${details.waitlist.actual}</p>
      <p>Remaining: ${details.waitlist.remaining}</p>
    </div>` : '<p>Waitlist info not available</p>';

    modalBody.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p><span class="font-semibold">Term:</span> ${details.associatedTerm}</p>
          <p><span class="font-semibold">Levels:</span> ${details.levels}</p>
          <p><span class="font-semibold">Credits:</span> ${details.credits}</p>
        </div>
        <div class="flex gap-2 flex-col">${seats}${waitlist}</div>
      </div>
      <div class="mt-4">
        <a href="https://oasis.farmingdale.edu/pls/prod/twbkwbis.P_WWWLogin" target="_blank" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg inline-block">📝 Sign Up in OASIS</a>
      </div>
    `;
    modal.classList.remove('hidden');
  }

  const closeModal = () => modal.classList.add('hidden');
  modal.addEventListener('click', e => { if(e.target === modal) closeModal(); });
  modal.querySelector('.close-button').addEventListener('click', closeModal);
  window.addEventListener('keydown', e => { if(e.key === 'Escape') closeModal(); });

  // --- Bookmarks / Watched tabs (Mini Cards) ---
  function populateOptionsList(list, type){
    optionsList.innerHTML = '';
    if(list.length === 0){
      optionsList.innerHTML = `<p class="text-gray-500 dark:text-gray-400">No ${type} courses</p>`;
      return;
    }

    list.forEach(crn => {
      const course = allCourses.find(c => c.crn === crn);
      if(!course) return;

      const courseNumberMatch = course.courseName.match(/\d{3}/);
      const courseNumber = courseNumberMatch ? courseNumberMatch[0] : '';
      const seatsText = course.seats
        ? `${course.seats.remaining} / ${course.seats.capacity} seats`
        : 'Seats info N/A';

      const li = document.createElement('li');
      li.className = 'bg-white dark:bg-gray-700 rounded-lg p-3 shadow flex flex-col gap-1';
      li.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <p class="font-semibold text-sm">${course.subjectCode} ${courseNumber} – ${course.courseName}</p>
            <p class="text-xs text-gray-600 dark:text-gray-300">Instructor: ${course.instructor}</p>
            <p class="text-xs text-gray-600 dark:text-gray-300">${seatsText}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Click ✖ to remove from ${type}</p>
          </div>
          <button class="remove-btn text-red-500 text-sm font-bold ml-2">✖</button>
        </div>
        <button class="details-mini-btn mt-1 text-blue-600 dark:text-blue-400 text-xs font-medium underline">View Details</button>
      `;

      li.querySelector('.details-mini-btn').addEventListener('click', () => {
        fetchCourseDetails(termSelect.value, crn);
        optionsPanel.classList.add('-translate-x-full');
      });

      li.querySelector('.remove-btn').addEventListener('click', () => {
        if(type === 'bookmark'){
          bookmarks = bookmarks.filter(c => c !== crn);
          localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
        } else {
          watchedCourses = watchedCourses.filter(c => c !== crn);
          localStorage.setItem('watchedCourses', JSON.stringify(watchedCourses));
        }
        li.remove();
      });

      optionsList.appendChild(li);
    });
  }

  showBookmarksTab.addEventListener('click', () => populateOptionsList(bookmarks, 'bookmark'));
  showWatchedTab.addEventListener('click', () => populateOptionsList(watchedCourses, 'watched'));

  // --- Search/filter/sort ---
  const searchInput = document.getElementById('course-search');
  const sortSelect = document.getElementById('sort-courses');
  const typeFilter = document.getElementById('filter-type');
  const levelFilter = document.getElementById('filter-level');
  const availabilityFilter = document.getElementById('filter-availability');

  if(searchInput) searchInput.addEventListener('input', applyFilters);
  [typeFilter, levelFilter, availabilityFilter].forEach(f => f?.addEventListener('change', applyFilters));
  if(sortSelect) sortSelect.addEventListener('change', applyFilters);

  function applyFilters(){
    let filtered = [...allCourses];
    const query = searchInput.value.toLowerCase();

    if(query) filtered = filtered.filter(c =>
      c.courseName.toLowerCase().includes(query) ||
      c.instructor.toLowerCase().includes(query) ||
      String(c.crn).includes(query)
    );

    if(typeFilter.value) filtered = filtered.filter(c =>
      typeFilter.value === 'online'
        ? c.schedule.some(s => s.where.toUpperCase().includes("ONLINE"))
        : c.schedule.some(s => !s.where.toUpperCase().includes("ONLINE"))
    );

    if(levelFilter.value) filtered = filtered.filter(c => {
      const match = c.courseName.match(/\d{3}/);
      return match && match[0].startsWith(levelFilter.value);
    });

    if(availabilityFilter.value) filtered = filtered.filter(c => {
      if(!c.seats) return false;
      const percent = (c.seats.actual / c.seats.capacity) * 100;
      return availabilityFilter.value === 'open' ? percent < 100 : percent >= 100;
    });

    if(sortSelect.value) {
      if(sortSelect.value === 'name') filtered.sort((a,b) => a.courseName.localeCompare(b.courseName));
      else if(sortSelect.value === 'crn') filtered.sort((a,b) => a.crn - b.crn);
    }

    displayCourses(filtered);
  }

  // --- Schedule helpers ---
  function parseDaysString(daysStr) {
    if (!daysStr) return [];
    const s = daysStr.toString().toUpperCase().replace(/\s+/g, '');
    const days = new Set();

    if (s.includes('M')) days.add(0);
    if (s.includes('TU') || s.includes('TUE') || /(^|[^A-Z])T(?!H)/.test(s)) days.add(1);
    if (s.includes('W')) days.add(2);
    if (s.includes('TH') || s.includes('R')) {
      days.add(3);
    }
    if (s.includes('F')) days.add(4);
    if (s.includes('MON')) days.add(0);
    if (s.includes('TUE') || s.includes('TUES')) days.add(1);
    if (s.includes('WED')) days.add(2);
    if (s.includes('THU') || s.includes('THUR')) days.add(3);
    if (s.includes('FRI')) days.add(4);

    return Array.from(days).sort((a,b)=>a-b);
  }

  function parseTimeStr(timeStr) {
    if (!timeStr || /TBA|ARR|TBD/i.test(timeStr)) return null;
    const times = [];
    const regex = /(\d{1,2}(?::\d{2})?\s*[AaPp][Mm]?)/g;
    let m;
    while ((m = regex.exec(timeStr)) !== null) {
      times.push(m[1]);
    }
    if (times.length < 2) {
      const regex24 = /(\d{1,2}:\d{2})/g;
      while ((m = regex24.exec(timeStr)) !== null) times.push(m[1]);
    }
    if (times.length < 2) return null;

    function toMinutes(tok) {
      tok = tok.trim().toUpperCase();
      const ampmMatch = tok.match(/([AP]M)$/);
      if (!ampmMatch) {
        const parts = tok.split(':');
        if (parts.length === 2) {
          const hh = parseInt(parts[0],10);
          const mm = parseInt(parts[1],10);
          if (!isNaN(hh) && !isNaN(mm) && hh >= 0 && hh <= 23) return hh*60 + mm;
        }
        const plain = tok.replace(/\s/g,'').replace(/AM|PM/,'');
        const hparts = plain.split(':');
        const hh = parseInt(hparts[0],10);
        const mm = (hparts[1] ? parseInt(hparts[1],10) : 0);
        if (isNaN(hh)) return null;
        if (hh >= 7 && hh <= 11) return hh*60 + mm;
        if (hh >= 12 && hh <= 23) return hh*60 + mm;
        return (hh + 12) * 60 + mm;
      } else {
        const ampm = ampmMatch[0];
        const p = tok.replace(/\s*[AP]M$/,'');
        const parts = p.split(':');
        let hh = parseInt(parts[0],10);
        const mm = (parts[1] ? parseInt(parts[1],10) : 0);
        if (ampm === 'PM' && hh !== 12) hh += 12;
        if (ampm === 'AM' && hh === 12) hh = 0;
        return hh*60 + mm;
      }
    }

    const start = toMinutes(times[0]);
    const end = toMinutes(times[1]);
    if (start == null || end == null) return null;
    return { start, end };
  }
  
  function createScheduleSkeleton() {
    scheduleContainer.innerHTML = ''; 
  
    const header = document.createElement('div');
    header.className = 'mb-2 flex items-center gap-4';
    header.innerHTML = `
      <h2 class="text-2xl font-semibold">Weekly Schedule Preview (Compact)</h2>
      <div class="ml-auto flex gap-2">
        <button id="back-to-list" class="px-3 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600">◀️ Back to List</button>
      </div>
    `;
    scheduleContainer.appendChild(header);
  
    const gridWrap = document.createElement('div');
    gridWrap.className = 'relative border rounded-lg bg-white dark:bg-gray-800 p-2 overflow-x-auto'; 
  
    const grid = document.createElement('div');
    grid.id = 'schedule-grid';
    grid.className = 'grid';
    grid.style.gridTemplateColumns = '80px repeat(5, minmax(150px, 1fr))';
  
    grid.innerHTML = `
      <div class="p-1 border-b text-sm font-medium bg-white dark:bg-gray-800">Time</div>
      <div class="p-1 border-b text-sm text-center font-medium bg-white dark:bg-gray-800">Monday</div>
      <div class="p-1 border-b text-sm text-center font-medium bg-white dark:bg-gray-800">Tuesday</div>
      <div class="p-1 border-b text-sm text-center font-medium bg-white dark:bg-gray-800">Wednesday</div>
      <div class="p-1 border-b text-sm text-center font-medium bg-white dark:bg-gray-800">Thursday</div>
      <div class="p-1 border-b text-sm text-center font-medium bg-white dark:bg-gray-800">Friday</div>
    `;
  
    for (let slot = 0; slot < SLOTS_PER_DAY; slot++) {
      const timeCell = document.createElement('div');
      timeCell.className = 'p-1 text-[10px] text-gray-500 dark:text-gray-400 border-b bg-white dark:bg-gray-800';
      
      if (slot % 4 === 0) {
        const hour = SCHEDULE_START_HOUR + Math.floor(slot / 4);
        const label = `${(hour % 12 === 0) ? 12 : hour % 12} ${hour >= 12 ? 'p' : 'a'}`;
        timeCell.textContent = label;
        timeCell.classList.add('font-semibold', 'text-gray-700', 'dark:text-gray-200');
      }
      grid.appendChild(timeCell);
  
      for (let day = 0; day < 5; day++) {
        const slotCell = document.createElement('div');
        slotCell.className = 'relative border-b min-h-[10px]'; 
        slotCell.dataset.slot = slot;
        slotCell.dataset.day = day;
        const inner = document.createElement('div');
        inner.className = 'absolute inset-0';
        slotCell.appendChild(inner);
        grid.appendChild(slotCell);
      }
    }
  
    gridWrap.appendChild(grid);
    scheduleContainer.appendChild(gridWrap);
  
    const tbaWrap = document.createElement('div');
    tbaWrap.id = 'tba-courses';
    tbaWrap.className = 'mt-4';
    tbaWrap.innerHTML = `<h3 class="text-lg font-medium mb-2">TBA / Unscheduled Courses</h3><div id="tba-list" class="space-y-2"></div>`;
    scheduleContainer.appendChild(tbaWrap);
  
    scheduleContainer.querySelector('#back-to-list').addEventListener('click', () => toggleSchedule(false));
  }

  function minutesToSlotIndex(mins) {
    return Math.floor((mins - SCHEDULE_START_HOUR*60) / SLOT_MINUTES);
  }

  function buildSchedule(courses) {
    createScheduleSkeleton();
    const tbaListEl = scheduleContainer.querySelector('#tba-list');
    const scheduleGrid = Array(5).fill(null).map(() => Array(SLOTS_PER_DAY).fill(null).map(() => []));
    
    const sampleSlot = scheduleContainer.querySelector('[data-slot="0"][data-day="0"]');
    const slotHeight = sampleSlot ? sampleSlot.getBoundingClientRect().height : 10;

    courses.forEach(course => {
      if (!course.schedule || !course.schedule.length) {
        addCourseToTBA(course, tbaListEl);
        return;
      }
      let placedAny = false;
      course.schedule.forEach(s => {
        if (!s || !s.days || !s.time || /TBA|ARR|TBD/i.test(s.time) || /TBA|TBD|ARR/i.test(s.days)) {
          return;
        }
        const days = parseDaysString(s.days);
        const timeRange = parseTimeStr(s.time);
        if (!days.length || !timeRange) {
          return;
        }
        const { start, end } = timeRange;
        if (end <= SCHEDULE_START_HOUR*60 || start >= SCHEDULE_END_HOUR*60) {
          return;
        }
        const clampedStart = Math.max(start, SCHEDULE_START_HOUR*60);
        const clampedEnd = Math.min(end, SCHEDULE_END_HOUR*60);
        const slotStart = minutesToSlotIndex(clampedStart);
        const spanSlots = Math.max(1, Math.ceil((clampedEnd - clampedStart) / SLOT_MINUTES));

        days.forEach(dayIndex => {
          const targetCell = scheduleContainer.querySelector(`[data-slot="${slotStart}"][data-day="${dayIndex}"]`);
          if (!targetCell) return;
          
          const inner = targetCell.firstElementChild;
          const block = document.createElement('div');
          const colorClass = subjectColorMap[course.subjectCode] || 'bg-gray-300';
          block.className = `${colorClass} dark:bg-opacity-80 text-white rounded p-1 absolute left-1 right-1 overflow-hidden shadow cursor-pointer transition-all duration-200`;
          
          const startOffsetMinutes = clampedStart - (SCHEDULE_START_HOUR*60 + slotStart * SLOT_MINUTES);
          const topPx = (startOffsetMinutes / SLOT_MINUTES) * slotHeight;
          const heightPx = spanSlots * slotHeight - 2;
          block.style.top = `${topPx}px`;
          block.style.height = `${Math.max(10, heightPx)}px`;
          block.style.zIndex = 20;

          const courseNumberMatch = course.courseName.match(/\d{3}/);
          const courseNumber = courseNumberMatch ? courseNumberMatch[0] : '';
          
          block.innerHTML = `
            <div class="text-[10px] font-semibold leading-tight whitespace-nowrap">${course.subjectCode} ${courseNumber}</div>
            <div class="text-[9px] truncate">${course.courseName}</div>
          `;
          block.addEventListener('click', (ev) => {
            ev.stopPropagation();
            fetchCourseDetails(termSelect.value, course.crn);
          });

          let hasConflict = false;
          for (let i = 0; i < spanSlots; i++) {
            const currentSlot = slotStart + i;
            if (currentSlot >= SLOTS_PER_DAY) continue;
            if (scheduleGrid[dayIndex][currentSlot].length > 0) {
              hasConflict = true;
              scheduleGrid[dayIndex][currentSlot].forEach(conflictingBlock => {
                conflictingBlock.classList.add('border-4', 'border-red-500');
                conflictingBlock.title = 'Time conflict detected!';
                conflictingBlock.style.zIndex = 30;
              });
            }
          }

          if (hasConflict) {
            block.classList.add('border-4', 'border-red-500');
            block.title = 'Time conflict detected!';
            block.style.zIndex = 30;
          }

          for (let i = 0; i < spanSlots; i++) {
            const currentSlot = slotStart + i;
            if (currentSlot >= SLOTS_PER_DAY) continue;
            scheduleGrid[dayIndex][currentSlot].push(block);
          }

          inner.appendChild(block);
          placedAny = true;
        });
      });

      if (!placedAny) addCourseToTBA(course, tbaListEl);
    });

    if (!tbaListEl.childElementCount) {
      tbaListEl.innerHTML = `<p class="text-gray-600 dark:text-gray-400">No TBA courses.</p>`;
    }
  }
  
  function parseDaysString(daysStr) {
    if (!daysStr) return [];
    const s = daysStr.toString().toUpperCase().replace(/\s+/g, '');
    const days = new Set();

    // Handle unambiguous days first
    if (s.includes('M')) days.add(0); // Monday
    if (s.includes('W')) days.add(2); // Wednesday
    if (s.includes('F')) days.add(4); // Friday
    if (s.includes('R')) days.add(3); // R is always Thursday

    // Handle T/TH/TR ambiguity based on your feedback.
    // This structure prioritizes the two-letter Thursday codes.
    if (s.includes('TH')) {
      days.add(3);
    }
    // Per your request, 'TR' is treated as only Thursday.
    else if (s.includes('TR')) {
      days.add(3);
    }
    // Only if the string does NOT contain 'TH' or 'TR' will 'T' be counted as Tuesday.
    else if (s.includes('T')) {
      days.add(1);
    }

    // Include full words for extra robustness, though they rarely appear
    if (s.includes('MON')) days.add(0);
    if (s.includes('TUE')) days.add(1);
    if (s.includes('WED')) days.add(2);
    if (s.includes('THU')) days.add(3);
    if (s.includes('FRI')) days.add(4);

    return Array.from(days).sort((a,b)=>a-b);
  }

  function addCourseToTBA(course, tbaListEl) {
    const li = document.createElement('div');
    li.className = 'bg-white dark:bg-gray-700 rounded-lg p-3 shadow flex justify-between items-center';
    const courseNumberMatch = course.courseName.match(/\d{3}/);
    const courseNumber = courseNumberMatch ? courseNumberMatch[0] : '';
    li.innerHTML = `
      <div>
        <div class="font-semibold">${course.subjectCode} ${courseNumber} • ${course.courseName}</div>
        <div class="text-xs text-gray-600 dark:text-gray-300">${course.instructor} • CRN: ${course.crn}</div>
      </div>
      <div>
        <button class="small-details px-2 py-1 rounded bg-blue-600 text-white text-sm">Details</button>
      </div>
    `;
    li.querySelector('.small-details').addEventListener('click', () => fetchCourseDetails(termSelect.value, course.crn));
    tbaListEl.appendChild(li);
  }

  // Toggle schedule on/off
  // Toggle schedule on/off
  function toggleSchedule(show) {
    const filterControls = document.getElementById('filter-controls');

    if (show) {
      const bookmarkedCourses = bookmarks
        .map(crn => allCourses.find(course => course.crn === crn))
        .filter(course => course);

      if (bookmarkedCourses.length === 0) {
        alert('Please bookmark one or more courses to see them on the schedule.');
        return;
      }
      
      filterControls.classList.add('hidden'); // HIDE FILTERS
      coursesContainer.classList.add('hidden');
      scheduleContainer.classList.remove('hidden');
      buildSchedule(bookmarkedCourses);
    } else {
      scheduleContainer.classList.add('hidden');
      filterControls.classList.remove('hidden'); // SHOW FILTERS
      coursesContainer.classList.remove('hidden');
    }
  }

  // Connect the schedule toggle functionality to the new menu item
  menuScheduleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const isScheduleVisible = !scheduleContainer.classList.contains('hidden');
    toggleSchedule(!isScheduleVisible);
    menuDropdown.classList.add('hidden'); // Close dropdown
  });
});