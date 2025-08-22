// app.js (Final Version)
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

  // --- RMP config ---
  const RMP_SCHOOL_ID = '14046';
  function rmpUrlFor(name) {
    return `https://www.ratemyprofessors.com/search/professors/${RMP_SCHOOL_ID}?q=${encodeURIComponent(name)}`;
  }

  // --- Menu elements ---
  const menuToggleBtn = document.getElementById('menu-toggle-btn');
  const menuDropdown = document.getElementById('menu-dropdown');
  const menuOptionsBtn = document.getElementById('menu-options-btn');
  const menuScheduleBtn = document.getElementById('menu-schedule-btn');

  // --- Dark mode persistence ---
  if (localStorage.getItem('theme') === 'dark') {
    root.classList.add('dark');
    darkToggle.textContent = '☀️';
  } else darkToggle.textContent = '🌙';

  darkToggle.addEventListener('click', () => {
    root.classList.toggle('dark');
    localStorage.setItem('theme', root.classList.contains('dark') ? 'dark' : 'light');
    darkToggle.textContent = root.classList.contains('dark') ? '☀️' : '🌙';
  });

  // --- Menu toggle ---
  if (menuToggleBtn) {
    menuToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menuDropdown.classList.toggle('hidden');
    });
  }

  // --- Options Panel (slide-out) ---
  const optionsPanel = document.createElement('div');
  optionsPanel.id = 'options-panel';
  optionsPanel.className = 'fixed top-0 left-0 z-50 h-full w-80 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-4 shadow-lg transform -translate-x-full transition-transform duration-300';
  optionsPanel.innerHTML = `
    <h3 class="text-xl font-bold mb-2">📚 Your Courses</h3>
    <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">View bookmarked and watched courses. Use ✖ to remove.</p>
    <div class="flex gap-2 mb-4">
      <button id="show-bookmarks-tab" class="flex-1 px-3 py-1 rounded-lg bg-yellow-400 dark:bg-yellow-600 hover:brightness-105 transition">Bookmarks</button>
      <button id="show-watched-tab" class="flex-1 px-3 py-1 rounded-lg bg-blue-400 dark:bg-blue-600 hover:brightness-105 transition">Watched</button>
    </div>
    <div id="options-list" class="space-y-2 max-h-[70vh] overflow-auto"></div>
    <button id="close-options" class="mt-4 w-full px-3 py-1 rounded-lg bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 transition">Close</button>
  `;
  document.body.appendChild(optionsPanel);

  const optionsList = optionsPanel.querySelector('#options-list');
  const closeOptionsBtn = optionsPanel.querySelector('#close-options');
  const showBookmarksTab = optionsPanel.querySelector('#show-bookmarks-tab');
  const showWatchedTab = optionsPanel.querySelector('#show-watched-tab');

  if (menuOptionsBtn) {
    menuOptionsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      optionsPanel.classList.remove('-translate-x-full');
      if (menuDropdown) menuDropdown.classList.add('hidden');
    });
  }
  closeOptionsBtn.addEventListener('click', () => optionsPanel.classList.add('-translate-x-full'));
  document.addEventListener('click', (e) => {
    const isClickInsideOptions = optionsPanel.contains(e.target) || (menuOptionsBtn && menuOptionsBtn.contains(e.target));
    if (!isClickInsideOptions) optionsPanel.classList.add('-translate-x-full');
    if (menuToggleBtn && !menuToggleBtn.contains(e.target) && menuDropdown) menuDropdown.classList.add('hidden');
  });

  // --- Data ---
  let termsData = [];
  let allCourses = [];
  let bookmarkedCourses = JSON.parse(localStorage.getItem('bookmarkedCourses') || '[]');
  let watchedCourseObjects = JSON.parse(localStorage.getItem('watchedCourseObjects') || '[]');

  const subjectMap = {
    ANT: 'Anthropology', ARC: 'Architectural Technology', ART: 'Art History', AIM: 'Artificial Intelligence Mgmt',
    AET: 'Automotive Technology', AVN: 'Aviation', BIO: 'Biology', BUS: 'Business', CHM: 'Chemistry',
    CHI: 'Chinese', CIV: 'Civil Engineering Technology', CSC: 'Computer Science', CPS: 'Computer Security Technology',
    BCS: 'Computer Systems', CON: 'Construction Management', CRJ: 'Criminal Justice', DEN: 'Dental Hygiene',
    ECO: 'Economics', EET: 'Electrical Engineering Tech', ETM: 'Engineering Technology Mngmnt', EGL: 'English',
    ENV: 'Environmental Studies', FYE: 'First Year Experience', FRE: 'French', FRX: 'Freshman Experience',
    GIS: 'Geographic Information Systems', GEO: 'Geography', GER: 'German', GRO: 'Gerontology',
    HPW: 'Health Promotion and Wellness', HIS: 'History', HON: 'Honors Program', HOR: 'Horticulture', HUM: 'Humanities',
    IND: 'Industrial Technology', IXD: 'Interaction Design', ITA: 'Italian', MTH: 'Mathematics', MET: 'Mechanical Engineering Tech',
    MLS: 'Medical Laboratory Science', MLG: 'Modern Languages', NUR: 'Nursing', NTR: 'Nutrition Science', PHI: 'Philosophy',
    PED: 'Physical Education', PHY: 'Physics and Physical Science', POL: 'Politics', PCM: 'Professional Communications',
    PSY: 'Psychology', RAM: 'Research Aligned Mentorship', RUS: 'Russian', STS: 'Science, Tech and Society',
    SST: 'Security Systems Technology', SOC: 'Sociology', SPA: 'Spanish', SPE: 'Speech', SMT: 'Sport Management',
    THE: 'Theatre', VIS: 'Visual Communications'
  };

  const subjectHexMap = {
    ANT:'#ef4444', ARC:'#22c55e', ART:'#3b82f6', AIM:'#eab308',
    AET:'#84cc16', AVN:'#a855f7', BIO:'#ec4899', BUS:'#4f46e5',
    CHM:'#14b8a6', CHI:'#dc2626', CIV:'#4b5563', CSC:'#f97316',
    CPS:'#0284c7', BCS:'#06b6d4', CON:'#f59e0b', CRJ:'#e11d48',
    DEN:'#2dd4bf', ECO:'#16a34a', EET:'#2563eb', ETM:'#7c3aed',
    EGL:'#fb7185', ENV:'#10b981', FYE:'#6b7280', FRE:'#60a5fa',
    FRX:'#818cf8', GIS:'#059669', GEO:'#84cc16', GER:'#f59e0b',
    GRO:'#d946ef', HPW:'#4ade80', HIS:'#f97316', HON:'#fde68a',
    HOR:'#bef264', HUM:'#f472b6', IND:'#0891b2', IXD:'#38bdf8',
    ITA:'#16a34a', MTH:'#6366f1', MET:'#4b5563', MLS:'#14b8a6',
    MLG:'#f87171', NUR:'#fb7185', NTR:'#bef264', PHI:'#a78bfa',
    PED:'#7dd3fc', PHY:'#fdba74', POL:'#4f46e5', PCM:'#d946ef',
    PSY:'#7c3aed', RAM:'#eab308', RUS:'#dc2626', STS:'#6b7280',
    SST:'#0284c7', SOC:'#ec4899', SPA:'#ea580c', SPE:'#f0abfc',
    SMT:'#2563eb', THE:'#a855f7', VIS:'#fbbf24'
  };

  // --- Schedule config ---
  const SCHEDULE_START_HOUR = 7; // 7 AM
  const SCHEDULE_END_HOUR = 22;  // 10 PM
  const HOUR_HEIGHT = 48;        // px per hour in schedule column

  // Schedule container
  const scheduleContainer = document.createElement('div');
  scheduleContainer.id = 'schedule-container';
  scheduleContainer.className = 'hidden p-4';
  document.body.appendChild(scheduleContainer);

  // --- Fetch terms ---
  if (termSelect) {
    fetch('/terms')
      .then(res => res.json())
      .then(data => {
        termsData = data;
        populateTerms(data);
        termSelect.disabled = false;
      })
      .catch(() => termSelect.innerHTML = '<option>Error loading terms</option>');
  }

  if (termSelect) {
    termSelect.addEventListener('change', () => {
      const selectedTerm = termsData.find(t => t.termCode === termSelect.value);
      if (selectedTerm) populateSubjects(selectedTerm.subjects);
      subjectSelect.disabled = !selectedTerm;
      if (coursesContainer) coursesContainer.innerHTML = '';
    });
  }

  if (subjectSelect) {
    subjectSelect.addEventListener('change', () => {
      if (termSelect.value && subjectSelect.value) fetchCourses(termSelect.value, subjectSelect.value);
    });
  }

  function populateTerms(terms) {
    if (!termSelect) return;
    termSelect.innerHTML = '<option value="">Select a Term</option>';
    terms.forEach(term => {
      const option = document.createElement('option');
      option.value = term.termCode;
      option.textContent = term.termName;
      termSelect.appendChild(option);
    });
  }

  function populateSubjects(subjects) {
    if (!subjectSelect) return;
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
    if (loadingMessage) loadingMessage.classList.remove('hidden');
    if (coursesContainer) coursesContainer.innerHTML = '';
    fetch(`/courses/${term}/${subject}`)
      .then(res => res.json())
      .then(data => {
        if (loadingMessage) loadingMessage.classList.add('hidden');
        allCourses = data.courses || [];
        allCourses = allCourses.map(c => normalizeCourse(c));
        displayCourses(allCourses);
      })
      .catch(() => {
        if (loadingMessage) loadingMessage.classList.add('hidden');
        if (coursesContainer) coursesContainer.innerHTML = `<p class="text-red-600">Error loading courses.</p>`;
      });
  }

  // --- Utilities ---
  function parseSeatValue(v) {
    if (v === null || v === undefined) return NaN;
    const s = String(v).trim();
    const cleaned = s.replace(/[^\d-]/g, '');
    const n = parseInt(cleaned, 10);
    return isNaN(n) ? NaN : n;
  }

  function normalizeCourse(course) {
    const c = Object.assign({}, course);
    if (!c.courseCode) {
      const maybeNum = c.courseNumber || c.section || '';
      c.courseCode = `${c.subjectCode || ''} ${maybeNum}`.trim();
    }
    if (!Array.isArray(c.schedule)) c.schedule = c.schedule ? [c.schedule] : [];
    if (c.seats) {
      c.seats.capacity = c.seats.capacity ?? c.seats.total ?? null;
      c.seats.actual = c.seats.actual ?? c.seats.taken ?? null;
      c.seats.remaining = c.seats.remaining ?? (c.seats.capacity && c.seats.actual ? (parseSeatValue(c.seats.capacity) - parseSeatValue(c.seats.actual)) : null);
    }
    return c;
  }

  function getCourseType(course) {
    if (!course || !Array.isArray(course.schedule) || course.schedule.length === 0) return 'unknown';
    const hasOnline = course.schedule.some(s => (s.where || '').toUpperCase().includes('ONLINE') || (s.type || '').toUpperCase().includes('ONLINE'));
    const hasInPerson = course.schedule.some(s => !((s.where || '').toUpperCase().includes('ONLINE')));
    if (hasOnline && hasInPerson) return 'hybrid';
    if (hasOnline) return 'online';
    if (hasInPerson) return 'inperson';
    return 'unknown';
  }

  function clamp(v, a=0, b=100) { return Math.max(a, Math.min(b, v)); }

  function getCourseNumber(course) {
    if (course.courseNumber) {
      const digits = String(course.courseNumber).match(/\d{3}/);
      if (digits) return digits[0].padStart(3, '0');
    }
    const combined = `${course.courseCode || ''} ${course.courseName || ''} ${course.title || ''}`;
    if (course.subjectCode) {
      const reSubj = new RegExp(`${course.subjectCode}\\s*([0-9]{3})`, 'i');
      const m1 = combined.match(reSubj);
      if (m1) return m1[1];
    }
    const m2 = combined.match(/\b([0-9]{3})\b/);
    if (m2) return m2[1];
    return '';
  }

  function getCourseLevel(course) {
    const fields = [course.courseNumber, course.courseCode, course.section, course.title, course.courseName];
    for (const f of fields) {
      if (!f) continue;
      const str = String(f);
      const m = str.match(/\b(\d{2,4})\b/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num)) {
          const level = Math.floor(num / 100) * 100;
          return level === 0 ? 100 : level;
        }
      }
    }
    const numStr = getCourseNumber(course);
    if (numStr) {
      const num = parseInt(numStr, 10);
      if (!isNaN(num)) return Math.floor(num / 100) * 100;
    }
    return null;
  }

  function updateSeatUI(crn, capacity, actual, remaining) {
    const bar = document.getElementById(`seat-bar-${crn}`);
    const label = document.getElementById(`seat-label-${crn}`);
    const wrapper = document.getElementById(`seat-wrapper-${crn}`);
    const overlay = document.getElementById(`seat-overlay-${crn}`);

    capacity = Number(capacity);
    actual = Number(actual);
    remaining = (typeof remaining === 'number') ? remaining : (capacity - actual);

    const seatsPercent = isNaN(capacity) || capacity === 0 ? 0 : clamp(Math.round((actual / capacity) * 100), 0, 100);
    const seatsColor = seatsPercent > 85 ? 'bg-red-500' : seatsPercent > 60 ? 'bg-yellow-400' : 'bg-green-500';

    if (bar) {
      bar.style.width = `${seatsPercent}%`;
      bar.className = `h-3 rounded-full ${seatsColor}`;
      bar.setAttribute('aria-valuenow', seatsPercent);
    }
    if (label) {
      if (isNaN(capacity) || capacity === 0) {
        label.textContent = 'Seats: N/A';
      } else {
        label.textContent = `${actual} / ${capacity} taken`;
      }
    }
    if (overlay) {
      overlay.textContent = isNaN(capacity) || capacity === 0 ? '' : `${seatsPercent}% full`;
    }
    if (wrapper) {
      wrapper.title = isNaN(capacity) || capacity === 0 ? 'Seats info unavailable' : `${actual} taken of ${capacity} — ${seatsPercent}% full`;
    }

    const idx = allCourses.findIndex(c => String(c.crn) === String(crn));
    if (idx >= 0) {
      allCourses[idx].seats = { capacity, actual, remaining };
    }
  }

  function extractInstructorFrom(details) {
    if (!details) return '';
    if (details.instructor && String(details.instructor).trim()) return String(details.instructor).trim();
    if (details.instructors) {
      if (Array.isArray(details.instructors)) {
        const names = details.instructors.map(i => (typeof i === 'string' ? i : (i.name || i.fullName || i.instructor))).filter(Boolean);
        if (names.length) return names.join(', ');
      } else if (typeof details.instructors === 'string' && details.instructors.trim()) {
        return details.instructors.trim();
      } else if (typeof details.instructors === 'object') {
        return details.instructors.name || details.instructors.fullName || '';
      }
    }
    if (details.teacher && String(details.teacher).trim()) return String(details.teacher).trim();
    if (details.faculty && String(details.faculty).trim()) return String(details.faculty).trim();
    return '';
  }

  function displayCourses(courses) {
    if (!coursesContainer) return;
    coursesContainer.innerHTML = '';
    if (!courses.length) {
      coursesContainer.innerHTML = `<p class="text-gray-600 dark:text-gray-400">No courses found.</p>`;
      return;
    }

    courses.forEach(course => {
      const courseNumber = getCourseNumber(course);
      const crn = course.crn;
      const scheduleInfo = (course.schedule || []).map(s => {
        const where = (s.where || '').toUpperCase();
        const locationEmoji = where.includes('ONLINE') ? '💻 Online' : '🏫 In-person';
        const days = s.days || 'TBA';
        const time = s.time || 'TBA';
        return `<div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"><span>🗓️ ${days} ${time}</span><span>${locationEmoji}</span></div>`;
      }).join('');

      const type = getCourseType(course);
      const typeBadge = {
        online: '<span class="px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-700 text-blue-800 dark:text-white">Online</span>',
        inperson: '<span class="px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-700 text-green-800 dark:text-white">In-person</span>',
        hybrid: '<span class="px-2 py-1 rounded-full text-xs bg-amber-100 dark:bg-amber-700 text-amber-800 dark:text-white">Hybrid</span>',
        unknown: '<span class="px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">TBA</span>'
      }[type];

      const instructorDisplay = course.instructor || extractInstructorFrom(course) || 'TBA';
      const hasInstructor = instructorDisplay && !/TBA/i.test(instructorDisplay);

      const rmpSmallLinkHTML = hasInstructor ? `<a href="${rmpUrlFor(instructorDisplay)}" target="_blank" rel="noreferrer" title="View on RateMyProfessors" class="ml-2 inline-flex items-center justify-center w-6 h-6 rounded text-red-600 dark:text-red-400">⭐</a>` : '';
      
      const isBookmarked = bookmarkedCourses.some(c => String(c.crn) === String(crn));
      const isWatching = watchedCourseObjects.some(c => String(c.crn) === String(crn));

      const card = document.createElement('div');
      card.className = 'bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-shadow flex flex-col';
      card.innerHTML = `
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-start gap-2">
            <div>
              <h3 class="text-lg font-bold text-gray-800 dark:text-gray-100">${course.subjectCode} ${courseNumber}</h3>
              <p class="text-sm text-gray-600 dark:text-gray-300">${course.courseName}</p>
            </div>
            <div class="text-right">
                ${typeBadge}
                <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">CRN: ${crn}</p>
            </div>
          </div>
        </div>

        <div class="p-4 space-y-3 flex-grow">
          <div class="flex items-center gap-2 text-sm">
            <span>👨‍🏫</span>
            <span class="font-medium truncate" style="max-width:260px">${instructorDisplay}</span>
            ${rmpSmallLinkHTML}
          </div>
          ${scheduleInfo || '<div class="text-sm text-gray-500">Schedule: TBA</div>'}
        </div>

        <div id="seat-wrapper-${crn}" class="px-4 pb-4">
            <div id="seat-label-${crn}" class="flex justify-between text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              <span>Loading seats...</span>
              <span id="seat-label-right-${crn}" class="text-xs"></span>
            </div>
            <div class="w-full h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden relative" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
              <div id="seat-bar-${crn}" class="h-3 rounded-full bg-gray-400" style="width:0%"></div>
              <div id="seat-overlay-${crn}" class="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-gray-800 dark:text-gray-100 pointer-events-none"></div>
            </div>
        </div>

        <div class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl flex gap-2 justify-between items-center">
          <div class="flex-1 mr-2">
            <button class="details-btn w-full px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm" data-term="${termSelect ? termSelect.value : ''}" data-crn="${crn}">Details</button>
          </div>
          <div class="flex gap-2 items-center">
            <a href="https://oasis.farmingdale.edu/pls/prod/twbkwbis.P_WWWLogin" target="_blank" class="px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm">Sign Up</a>

            <div class="flex items-center gap-1">
              <button class="bookmark-btn min-w-[44px] w-11 h-9 px-0 py-1.5 rounded-md text-white text-sm ${isBookmarked ? 'bg-yellow-500' : 'bg-gray-400'}" data-crn="${crn}" title="Bookmark">${isBookmarked ? '★' : '☆'}</button>
              <button class="watch-btn min-w-[44px] w-11 h-9 px-0 py-1.5 rounded-md text-white text-sm ${isWatching ? 'bg-sky-500' : 'bg-gray-400'}" data-crn="${crn}" data-term="${termSelect ? termSelect.value : ''}" title="${isWatching ? 'Watching' : 'Watch'}">👁</button>
              <button class="copy-crn-btn min-w-[44px] w-11 h-9 px-0 py-1.5 rounded-md bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 text-sm" title="Copy CRN" data-crn="${crn}">📋</button>
            </div>
          </div>
        </div>
      `;
      coursesContainer.appendChild(card);

      if (course.seats && (course.seats.capacity || course.seats.actual || course.seats.remaining)) {
        const capacity = parseSeatValue(course.seats.capacity);
        const actual = parseSeatValue(course.seats.actual);
        const remaining = typeof course.seats.remaining === 'number' ? course.seats.remaining : parseSeatValue(course.seats.remaining);
        updateSeatUI(crn, capacity, actual, remaining);
      } else {
        const selectedTerm = termSelect ? termSelect.value : '';
        if (selectedTerm) {
          fetch(`/course-details/${selectedTerm}/${crn}`)
            .then(r => {
              if (!r.ok) throw new Error('No details');
              return r.json();
            })
            .then(details => {
              if (!details || !details.seats) {
                const label = document.getElementById(`seat-label-${crn}`);
                const overlay = document.getElementById(`seat-overlay-${crn}`);
                if (label) label.textContent = 'Seats: N/A';
                if (overlay) overlay.textContent = '';
                return;
              }
              const capacity = parseSeatValue(details.seats.capacity);
              const actual = parseSeatValue(details.seats.actual);
              let remaining = parseSeatValue(details.seats.remaining);
              if (isNaN(remaining)) remaining = (isNaN(capacity) || isNaN(actual)) ? 0 : (capacity - actual);
              updateSeatUI(crn, capacity, actual, remaining);
            })
            .catch(() => {
              const label = document.getElementById(`seat-label-${crn}`);
              const overlay = document.getElementById(`seat-overlay-${crn}`);
              if (label) label.textContent = 'Seats: N/A';
              if (overlay) overlay.textContent = '';
            });
        } else {
          const label = document.getElementById(`seat-label-${crn}`);
          const overlay = document.getElementById(`seat-overlay-${crn}`);
          if (label) label.textContent = 'Seats: N/A';
          if (overlay) overlay.textContent = '';
        }
      }
    });
  }

  // --- Event delegation in course list ---
  if (coursesContainer) {
    coursesContainer.addEventListener('click', e => {
      const target = e.target;
      if (target.classList.contains('details-btn')) fetchCourseDetails(termSelect ? termSelect.value : '', target.dataset.crn);
      if (target.classList.contains('bookmark-btn')) toggleBookmark(target);
      if (target.classList.contains('watch-btn')) toggleWatch(target);
      if (target.classList.contains('copy-crn-btn')) handleCopyButton(target);
    });
  }

  // --- Bookmark / Watch functions ---
  function toggleBookmark(button) {
    const crn = String(button.dataset.crn);
    const isBookmarked = bookmarkedCourses.some(c => String(c.crn) === crn);

    if (isBookmarked) {
        bookmarkedCourses = bookmarkedCourses.filter(c => String(c.crn) !== crn);
        button.innerText = '☆';
        button.classList.remove('bg-yellow-500');
        button.classList.add('bg-gray-400');
    } else {
        const courseToAdd = allCourses.find(c => String(c.crn) === crn);
        if (courseToAdd) {
            bookmarkedCourses.push(courseToAdd);
            button.innerText = '★';
            button.classList.add('bg-yellow-500');
            button.classList.remove('bg-gray-400');
        }
    }

    localStorage.setItem('bookmarkedCourses', JSON.stringify(bookmarkedCourses));

    if (!scheduleContainer.classList.contains('hidden')) {
        buildSchedule(bookmarkedCourses);
    }
  }
  
  function toggleWatch(button) {
    const crn = String(button.dataset.crn);
    const term = button.dataset.term;
    const isWatching = watchedCourseObjects.some(c => String(c.crn) === crn);

    if (!isWatching) {
        const courseToWatch = allCourses.find(c => String(c.crn) === crn);
        if (courseToWatch) {
            watchedCourseObjects.push(courseToWatch);
            localStorage.setItem('watchedCourseObjects', JSON.stringify(watchedCourseObjects));
            
            button.classList.add('bg-sky-500');
            button.classList.remove('bg-gray-400');
            button.setAttribute('title', 'Watching');
            button.setAttribute('aria-pressed', 'true');
            
            fetch(`/watch/${term}/${crn}`, { method: 'POST' }).catch(() => {});
        }
    } else {
        watchedCourseObjects = watchedCourseObjects.filter(c => String(c.crn) !== crn);
        localStorage.setItem('watchedCourseObjects', JSON.stringify(watchedCourseObjects));
        
        button.classList.remove('bg-sky-500');
        button.classList.add('bg-gray-400');
        button.setAttribute('title', 'Watch');
        button.setAttribute('aria-pressed', 'false');
        
        fetch(`/watch/${term}/${crn}`, { method: 'DELETE' }).catch(() => {});
    }
  }

  // --- Copy CRN ---
  function handleCopyButton(button) {
    const crn = button.dataset.crn || (button.closest('div') ? (button.closest('div').querySelector('[data-crn]') ? button.closest('div').querySelector('[data-crn]').dataset.crn : null) : null);
    if (!crn) {
      alert('CRN not found to copy.');
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(crn).then(() => showCopyFeedback(button), () => fallbackCopy(crn, button));
    } else {
      fallbackCopy(crn, button);
    }
  }
  function showCopyFeedback(button) {
    button.classList.add('ring-2', 'ring-green-400');
    button.setAttribute('aria-label', 'Copied');
    button.disabled = true;
    setTimeout(() => {
      button.classList.remove('ring-2', 'ring-green-400');
      button.disabled = false;
      button.setAttribute('aria-label', 'Copy CRN');
    }, 1000);
  }
  function fallbackCopy(text, button) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showCopyFeedback(button);
    } catch {
      alert('Could not copy CRN.');
    }
  }

  // --- Modal ---
 // --- Modal ---
  function fetchCourseDetails(term, crn) {
    if (!modalBody || !modal) return;
    modalBody.innerHTML = '<div class="text-center py-6">Loading...</div>';
    modalTitle.textContent = '';
    modal.classList.remove('hidden');

    // Find the full course object from our local list to get its subject and number
    const course = allCourses.find(c => String(c.crn) === String(crn));
    if (!course) {
        modalBody.innerHTML = '<p class="text-red-600">Could not find course data to fetch details.</p>';
        return;
    }
    const courseNumber = getCourseNumber(course);
    
    // --- Create two promises: one for seat details, one for catalog entry ---
    const detailsPromise = fetch(`/course-details/${term}/${crn}`).then(res => {
        if (!res.ok) return {}; // Return empty object on failure to not break Promise.all
        return res.json();
    });

    const catalogPromise = fetch(`/catalog/${term}/${course.subjectCode}/${courseNumber}`).then(res => {
        if (!res.ok) return { entries: [] }; // Return empty structure on failure
        return res.json();
    });

    // --- Wait for both promises to resolve ---
    Promise.all([detailsPromise, catalogPromise])
      .then(([details, catalogData]) => {
        // Pass BOTH results to the display function
        displayCourseDetails(details, catalogData);
      })
      .catch(() => {
        modalBody.innerHTML = '<p class="text-red-600">Error loading course details.</p>';
      });
  }
  ffunction displayCourseDetails(details, catalogData) {
    modalTitle.textContent = details.title || details.courseName || 'Course Details';

    // --- 1. Build the new Catalog Details section ---
    let catalogHtml = '';
    const catalogEntry = catalogData?.entries?.[0]; // Get the first entry from the catalog data

    if (catalogEntry) {
        catalogHtml = `
        <div class="mb-4 p-4 bg-gray-100 dark:bg-gray-900/50 rounded-lg space-y-3">
            ${catalogEntry.description ? `
            <div>
                <h4 class="font-semibold text-gray-800 dark:text-gray-200">Description</h4>
                <p class="text-sm text-gray-600 dark:text-gray-400">${catalogEntry.description}</p>
            </div>` : ''}
            
            ${catalogEntry.prerequisites ? `
            <div>
                <h4 class="font-semibold text-gray-800 dark:text-gray-200">Prerequisites</h4>
                <p class="text-sm text-gray-600 dark:text-gray-400">${catalogEntry.prerequisites}</p>
            </div>` : ''}

            ${catalogEntry.corequisites ? `
            <div>
                <h4 class="font-semibold text-gray-800 dark:text-gray-200">Corequisites</h4>
                <p class="text-sm text-gray-600 dark:text-gray-400">${catalogEntry.corequisites}</p>
            </div>` : ''}
        </div>
        `;
    }

    // --- 2. Build the existing details sections (seats, instructor, etc.) ---
    const instructorDisplay = extractInstructorFrom(details) || 'TBA';
    const hasInstructor = instructorDisplay && !/TBA/i.test(instructorDisplay);
    const rmpLink = hasInstructor ? `<a href="${rmpUrlFor(instructorDisplay)}" target="_blank" rel="noreferrer" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg inline-block ml-2">⭐ Rate Instructor</a>` : '';
    const seats = details.seats?.capacity ? `<div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg"><p class="font-semibold">Seats</p><p>Total: ${details.seats.capacity}</p><p>Taken: ${details.seats.actual}</p><p>Remaining: ${details.seats.remaining}</p></div>` : '<p>Seats info not available</p>';
    const waitlist = details.waitlist?.capacity ? `<div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg"><p class="font-semibold">Waitlist</p><p>Total: ${details.waitlist.capacity}</p><p>Taken: ${details.waitlist.actual}</p><p>Remaining: ${details.waitlist.remaining}</p></div>` : '<p>Waitlist info not available</p>';
    
    // --- 3. Combine everything into the final modal body ---
    modalBody.innerHTML = `
      ${catalogHtml} 
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p><span class="font-semibold">Term:</span> ${details.associatedTerm || 'N/A'}</p>
          <p><span class="font-semibold">Levels:</span> ${details.levels || 'N/A'}</p>
          <p><span class="font-semibold">Credits:</span> ${details.credits || 'N/A'}</p>
          <p class="mt-2"><span class="font-semibold">Instructor:</span> ${instructorDisplay || 'TBA'} ${hasInstructor ? `<a class="text-sm text-red-600 dark:text-red-400 ml-1" href="${rmpUrlFor(instructorDisplay)}" target="_blank" rel="noreferrer">View on RMP</a>` : ''}</p>
        </div>
        <div class="flex gap-2 flex-col">${seats}${waitlist}</div>
      </div>
      <div class="mt-4 flex gap-2">
        <a href="https://oasis.farmingdale.edu/pls/prod/twbkwbis.P_WWWLogin" target="_blank" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg inline-block">📝 Sign Up in OASIS</a>
        ${rmpLink}
      </div>
    `;
  }
			
  // --- Options panel list populate ---
  function populateOptionsList(list, type) {
    optionsList.innerHTML = '';
    if (list.length === 0) {
      optionsList.innerHTML = `<p class="text-gray-500 dark:text-gray-400">No ${type} courses</p>`;
      return;
    }
    list.forEach(course => {
      const crn = String(course.crn);
      const li = document.createElement('div');
      li.className = 'bg-white dark:bg-gray-700 rounded-lg p-3 shadow flex flex-col gap-1';
      const courseNumber = getCourseNumber(course);
      
      const capacity = parseSeatValue(course.seats?.capacity);
      const actual = parseSeatValue(course.seats?.actual);
      let remaining = parseSeatValue(course.seats?.remaining);
      if (isNaN(remaining)) remaining = isNaN(capacity) || isNaN(actual) ? 'N/A' : (capacity - actual);
      const seatsText = !isNaN(capacity) ? `${remaining} / ${capacity} seats remaining` : 'Seats info N/A';
      
      const instructorDisplay = course.instructor || extractInstructorFrom(course) || 'TBA';
      const hasInstructor = instructorDisplay && !/TBA/i.test(instructorDisplay);
      const rmpMiniLink = hasInstructor ? `<a href="${rmpUrlFor(instructorDisplay)}" target="_blank" rel="noreferrer" class="text-red-600 dark:text-red-400 text-xs underline ml-1">Rate Instructor</a>` : '';

      li.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <p class="font-semibold text-sm">${course.subjectCode} ${courseNumber} – ${course.courseName}</p>
            <p class="text-xs text-gray-600 dark:text-gray-300">Instructor: ${instructorDisplay} ${rmpMiniLink}</p>
            <p class="text-xs text-gray-600 dark:text-gray-300">${seatsText}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Click ✖ to remove from ${type}</p>
          </div>
          <button class="remove-btn text-red-500 text-sm font-bold ml-2">✖</button>
        </div>
        <div class="mt-2">
          <button class="details-mini-btn text-blue-600 dark:text-blue-400 text-xs font-medium underline">View Details</button>
        </div>
      `;
      li.querySelector('.details-mini-btn').addEventListener('click', () => {
        fetchCourseDetails(termSelect ? termSelect.value : '', crn);
        optionsPanel.classList.add('-translate-x-full');
      });
      li.querySelector('.remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (type === 'bookmark') {
            bookmarkedCourses = bookmarkedCourses.filter(c => String(c.crn) !== crn);
            localStorage.setItem('bookmarkedCourses', JSON.stringify(bookmarkedCourses));
        } else { // 'watched'
            watchedCourseObjects = watchedCourseObjects.filter(c => String(c.crn) !== crn);
            localStorage.setItem('watchedCourseObjects', JSON.stringify(watchedCourseObjects));
        }
        li.remove();
      });
      optionsList.appendChild(li);
    });
  }
  
  if (showBookmarksTab) showBookmarksTab.addEventListener('click', () => populateOptionsList(bookmarkedCourses, 'bookmark'));
  if (showWatchedTab) showWatchedTab.addEventListener('click', () => populateOptionsList(watchedCourseObjects, 'watched'));

  // --- Search/filter/sort ---
  const searchInput = document.getElementById('course-search');
  const sortSelect = document.getElementById('sort-courses');
  const typeFilter = document.getElementById('filter-type');
  const levelFilter = document.getElementById('filter-level');
  const availabilityFilter = document.getElementById('filter-availability');
  if (searchInput) searchInput.addEventListener('input', applyFilters);
  [typeFilter, levelFilter, availabilityFilter].forEach(f => f?.addEventListener('change', applyFilters));
  if (sortSelect) sortSelect.addEventListener('change', applyFilters);
  function applyFilters() {
    let filtered = [...allCourses];
    const query = (searchInput?.value || '').toLowerCase();
    if (query) filtered = filtered.filter(c =>
      (c.courseName || '').toLowerCase().includes(query) ||
      (c.instructor || '').toLowerCase().includes(query) ||
      String(c.crn || '').includes(query) ||
      (c.courseCode || '').toLowerCase().includes(query)
    );
    if (typeFilter?.value) filtered = filtered.filter(c => getCourseType(c) === typeFilter.value);
    if (levelFilter?.value && levelFilter.value !== 'all') {
      const selectedLevelNum = parseInt(levelFilter.value, 10);
      filtered = filtered.filter(c => getCourseLevel(c) === selectedLevelNum);
    }
    if (availabilityFilter?.value) {
      filtered = filtered.filter(c => {
        if (!c.seats) return false;
        const capacity = parseSeatValue(c.seats.capacity) || 0;
        const actual = parseSeatValue(c.seats.actual) || 0;
        const remaining = (typeof c.seats.remaining === 'number') ? c.seats.remaining : (capacity - actual);
        if (capacity === 0) return false;
        if (availabilityFilter.value === 'open') return remaining > 0;
        if (availabilityFilter.value === 'full') return remaining <= 0;
        return true;
      });
    }
    if (sortSelect?.value) {
      if (sortSelect.value === 'name') filtered.sort((a, b) => (a.courseName || '').localeCompare(b.courseName || ''));
      else if (sortSelect.value === 'crn') filtered.sort((a, b) => (a.crn || 0) - (b.crn || 0));
    }
    displayCourses(filtered);
  }

  // --- Time/day parsing helpers ---
function parseDaysString(daysStr) {
  if (!daysStr) return [];

  let raw = String(daysStr).toUpperCase().trim();

  // quick rejects
  if (/TBA|ARR|TBD/.test(raw)) return [];

  // normalize common full-names -> 3-letter
  raw = raw
    .replace(/MONDAY|MON/g, 'MON')
    .replace(/TUESDAY|TUES|TUE/g, 'TUE')
    .replace(/WEDNESDAY|WEDS|WED/g, 'WED')
    .replace(/THURSDAY|THURS|THU|TH/g, 'THU')
    .replace(/FRIDAY|FRI/g, 'FRI')
    .replace(/SATURDAY|SAT/g, 'SAT')
    .replace(/SUNDAY|SUN/g, 'SUN');

  // If the string contains separators (space, comma, slash, dash, dot), remember that:
  const hasSeparator = /[\s,\/\-\.]/.test(raw);

  // Compact-only-letters version (remove separators) to detect concatenated single-letter sequences
  const compact = raw.replace(/[\s,\/\-\.]/g, '');

  // weekday order & maps
  const orderSingle = ['M','T','W','R','F','S','U']; // U for Sunday (single-letter choice)
  const threeToIndex = { MON:0, TUE:1, WED:2, THU:3, FRI:4, SAT:5, SUN:6 };
  const singleToIndex = { M:0, T:1, W:2, R:3, F:4, S:5, U:6 };

  // If there are only compact single-letter tokens AND there were NO separators in original string,
  // treat it as a range from first to last letter (inclusive).
  if (!hasSeparator && /^[MTWRFSU]+$/.test(compact) && compact.length > 1) {
    const first = compact[0];
    const last = compact[compact.length - 1];
    const start = orderSingle.indexOf(first);
    const end = orderSingle.indexOf(last);
    if (start === -1 || end === -1) return [];

    const res = [];
    if (start <= end) {
      for (let i = start; i <= end; i++) res.push(i);
    } else {
      // If first is after last in week order, wrap around (rare, but supported)
      for (let i = start; i < 7; i++) res.push(i);
      for (let i = 0; i <= end; i++) res.push(i);
    }
    return Array.from(new Set(res)).sort((a, b) => a - b);
  }

  // Otherwise, extract any recognizable tokens (3-letter names or single-letter tokens)
  const tokenRegex = /(MON|TUE|WED|THU|FRI|SAT|SUN|M|T|W|R|F|S|U)/g;
  const matches = raw.match(tokenRegex);
  if (!matches || matches.length === 0) return [];

  const set = new Set();
  for (const tok of matches) {
    if (threeToIndex.hasOwnProperty(tok)) set.add(threeToIndex[tok]);
    else if (singleToIndex.hasOwnProperty(tok)) set.add(singleToIndex[tok]);
  }

  return Array.from(set).sort((a, b) => a - b);
}


  function parseTimeStr(timeStr) {
    if (!timeStr || /TBA|ARR|TBD/i.test(timeStr)) return null;
    const times = [];
    const regex = /(\d{1,2}(?::\d{2})?\s*[AaPp][Mm]?)/g;
    let m;
    while ((m = regex.exec(timeStr)) !== null) times.push(m[1]);
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
          const hh = parseInt(parts[0], 10); const mm = parseInt(parts[1], 10);
          if (!isNaN(hh) && !isNaN(mm) && hh >= 0 && hh <= 23) return hh * 60 + mm;
        }
        const plain = tok.replace(/\s/g, '').replace(/AM|PM/, '');
        const hparts = plain.split(':');
        const hh = parseInt(hparts[0], 10);
        const mm = (hparts[1] ? parseInt(hparts[1], 10) : 0);
        if (isNaN(hh)) return null;
        if (hh >= 7 && hh <= 11) return hh * 60 + mm;
        if (hh >= 12 && hh <= 23) return hh * 60 + mm;
        return (hh + 12) * 60 + mm;
      } else {
        const ampm = ampmMatch[0];
        const p = tok.replace(/\s*[AP]M$/, '');
        const parts = p.split(':');
        let hh = parseInt(parts[0], 10);
        const mm = (parts[1] ? parseInt(parts[1], 10) : 0);
        if (ampm === 'PM' && hh !== 12) hh += 12;
        if (ampm === 'AM' && hh === 12) hh = 0;
        return hh * 60 + mm;
      }
    }
    const start = toMinutes(times[0]);
    const end = toMinutes(times[1]);
    if (start == null || end == null) return null;
    return { start, end };
  }

  // --- Hex luminance / contrast helpers ---
  function hexToRgb(hex) {
    if (!hex) return null;
    hex = hex.replace('#','');
    if (hex.length === 3) hex = hex.split('').map(h => h+h).join('');
    const r = parseInt(hex.substr(0,2),16);
    const g = parseInt(hex.substr(2,2),16);
    const b = parseInt(hex.substr(4,2),16);
    return {r,g,b};
  }
  function luminanceFromHex(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    const srgbToLin = v => {
      v = v/255;
      return (v <= 0.03928) ? v/12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126*srgbToLin(rgb.r) + 0.7152*srgbToLin(rgb.g) + 0.0722*srgbToLin(rgb.b);
  }
  function textColorForHex(hex) {
    const L = luminanceFromHex(hex);
    return L < 0.5 ? '#ffffff' : '#111827';
  }

  // --- Schedule builder ---
  function buildSchedule(courses) {
    scheduleContainer.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'mb-4 flex items-center gap-4';
    header.innerHTML = `
      <h2 class="text-2xl font-semibold">Weekly Schedule (Mon → Sun)</h2>
      <div class="ml-auto">
        <button id="back-to-list" class="px-3 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600">◀️ Back to List</button>
      </div>
    `;
    scheduleContainer.appendChild(header);

    const gridWrap = document.createElement('div');
    gridWrap.className = 'w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden';
    gridWrap.style.display = 'flex';
    gridWrap.style.padding = '0';

    const hoursCol = document.createElement('div');
    hoursCol.style.width = '74px';
    hoursCol.style.boxSizing = 'border-box';
    hoursCol.style.padding = '6px';
    const hoursContainer = document.createElement('div');
    hoursContainer.style.position = 'relative';
    const totalHours = SCHEDULE_END_HOUR - SCHEDULE_START_HOUR;
    const containerHeight = totalHours * HOUR_HEIGHT;
    hoursContainer.style.height = `${containerHeight}px`;
    for (let h = SCHEDULE_START_HOUR; h < SCHEDULE_END_HOUR; h++) {
      const hourDiv = document.createElement('div');
      hourDiv.style.height = `${HOUR_HEIGHT}px`;
      hourDiv.style.lineHeight = `${HOUR_HEIGHT}px`;
      hourDiv.className = 'text-xs text-gray-600 dark:text-gray-300 font-medium';
      const hourLabel = `${(h % 12 === 0) ? 12 : h % 12}${h >= 12 ? 'pm' : 'am'}`;
      hourDiv.textContent = hourLabel;
      hoursContainer.appendChild(hourDiv);
    }
    hoursCol.appendChild(hoursContainer);

    const daysCols = document.createElement('div');
    daysCols.style.flex = '1';
    daysCols.style.display = 'flex';
    daysCols.style.height = `${containerHeight}px`;
    daysCols.style.boxSizing = 'border-box';

    const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

    const dayHeader = document.createElement('div');
    dayHeader.style.display = 'flex';
    dayHeader.className = 'mb-2 items-center';
    dayHeader.innerHTML = `<div style="width:74px"></div>`;
    const dayHeaderCols = document.createElement('div');
    dayHeaderCols.style.display = 'flex';
    dayHeaderCols.style.flex = '1';
    dayNames.forEach(dn => {
      const dh = document.createElement('div');
      dh.className = 'text-sm font-semibold text-center text-gray-700 dark:text-gray-200 p-2';
      dh.style.flex = '1';
      dh.textContent = dn;
      dayHeaderCols.appendChild(dh);
    });
    dayHeader.appendChild(dayHeaderCols);
    scheduleContainer.appendChild(dayHeader);

    const dayColumns = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const col = document.createElement('div');
      col.style.flex = '1';
      col.style.position = 'relative';
      col.style.height = `${containerHeight}px`;
      col.style.boxSizing = 'border-box';
      col.className = 'px-1';
      for (let h = 0; h < totalHours; h++) {
        const sep = document.createElement('div');
        sep.style.position = 'absolute';
        sep.style.left = '0';
        sep.style.right = '0';
        sep.style.height = '1px';
        sep.style.top = `${h * HOUR_HEIGHT}px`;
        sep.style.backgroundColor = 'rgba(0,0,0,0.04)';
        sep.className = 'dark:bg-gray-700';
        col.appendChild(sep);
      }
      dayColumns.push(col);
      daysCols.appendChild(col);
    }

    gridWrap.appendChild(hoursCol);
    gridWrap.appendChild(daysCols);
    scheduleContainer.appendChild(gridWrap);

    const tbaContainer = document.createElement('div');
    tbaContainer.id = 'tba-courses';
    tbaContainer.className = 'mt-6';
    tbaContainer.innerHTML = `
      <h3 class="text-lg font-medium mb-2">TBA / Unscheduled Courses</h3>
      <div id="tba-list" class="space-y-2"></div>
    `;
    scheduleContainer.appendChild(tbaContainer);

    function minutesToTopPx(min) {
      return ((min - (SCHEDULE_START_HOUR * 60)) / 60) * HOUR_HEIGHT;
    }
    function minutesToHeightPx(mins) {
      return (mins / 60) * HOUR_HEIGHT;
    }

    const placedRanges = Array.from({length:7}, () => []);

    courses.forEach(course => {
      if (!course.schedule || course.schedule.length === 0) {
        addCourseToTBA(course, scheduleContainer.querySelector('#tba-list'));
        return;
      }
      course.schedule.forEach(s => {
        if (!s || !s.days || !s.time || /TBA|ARR|TBD/i.test(s.time) || /TBA|TBD|ARR/i.test(s.days)) {
          addCourseToTBA(course, scheduleContainer.querySelector('#tba-list'));
          return;
        }
        const days = parseDaysString(s.days);
        const timeRange = parseTimeStr(s.time);
        if (!days.length || !timeRange) {
          addCourseToTBA(course, scheduleContainer.querySelector('#tba-list'));
          return;
        }

        const startMin = timeRange.start;
        const endMin = timeRange.end;
        const durationMin = Math.max(5, endMin - startMin);

        // --- replace the existing days.forEach(dayIndex => { ... }) body with this ---
days.forEach(dayIndex => {
  // If time is outside schedule bounds -> mark TBA
  if (endMin <= SCHEDULE_START_HOUR * 60 || startMin >= SCHEDULE_END_HOUR * 60) {
    addCourseToTBA(course, scheduleContainer.querySelector('#tba-list'));
    return;
  }

  const top = Math.max(0, minutesToTopPx(startMin));
  const bottomLimit = (SCHEDULE_END_HOUR - SCHEDULE_START_HOUR) * HOUR_HEIGHT;
  const height = Math.max(16, minutesToHeightPx(durationMin));
  const boundedHeight = Math.min(height, bottomLimit - top);

  const col = dayColumns[dayIndex];
  if (!col) return;

  const courseNumber = getCourseNumber(course);
  const section = course.section ? String(course.section) : '';

  const rawSubj = course.subjectCode || '';
  const subj = rawSubj.split(' ')[0];

  const hex = subjectHexMap[subj] || '#6b7280';
  const textColor = textColorForHex(hex);

  // create a fresh block element for this specific day (important!)
  const block = document.createElement('div');
  block.style.backgroundColor = hex;
  block.style.color = textColor;
  block.className = 'rounded-md p-1.5 shadow-md absolute cursor-pointer';
  block.style.left = '6px';
  block.style.right = '6px';
  block.style.top = `${top}px`;
  block.style.height = `${boundedHeight}px`;
  block.style.overflow = 'hidden';
  block.style.boxSizing = 'border-box';
  block.style.display = 'flex';
  block.style.flexDirection = 'column';
  block.style.justifyContent = 'center';
  block.style.gap = '2px';
  block.style.fontSize = '12px';
  block.style.padding = '6px 6px';
  block.setAttribute('data-crn', course.crn);
  block.setAttribute('data-day-index', String(dayIndex));

  // text lines: class (first), time (second), where (third)
  const firstLine = document.createElement('div');
  firstLine.className = 'font-bold text-sm leading-tight truncate';
  firstLine.textContent = `${subj} ${courseNumber} ${section}`.trim();

  const secondLine = document.createElement('div');
  secondLine.className = 'text-[11px] font-semibold leading-tight truncate';
  secondLine.textContent = `${s.time || 'TBA'}`;

  const thirdLine = document.createElement('div');
  thirdLine.className = 'text-[11px] leading-tight truncate';
  thirdLine.textContent = `${s.where || 'TBA'}`;

  block.appendChild(firstLine);
  block.appendChild(secondLine);
  block.appendChild(thirdLine);

  // collapse text when block gets small
  const minForThreeLines = 36;
  if (boundedHeight < minForThreeLines) {
    thirdLine.style.display = 'none';
    if (boundedHeight < 24) {
      secondLine.style.display = 'none';
      firstLine.style.fontSize = '10px';
      firstLine.style.lineHeight = '1.1';
      block.style.padding = '3px 6px';
    }
  }

  // conflict check for this specific day
  const overlapping = placedRanges[dayIndex].some(r => !(endMin <= r.start || startMin >= r.end));
  if (overlapping) {
    block.style.boxShadow = '0 0 0 2px rgba(239,68,68,0.9)';
    block.title = 'Time conflict!';
    placedRanges[dayIndex].forEach(r => {
      if (!(endMin <= r.start || startMin >= r.end) && r.el) {
        r.el.style.boxShadow = '0 0 0 2px rgba(239,68,68,0.9)';
      }
    });
  }

  // remember this block for this day so future conflicts can highlight it
  placedRanges[dayIndex].push({ start: startMin, end: endMin, el: block });

  // click -> fetch details
  block.addEventListener('click', (ev) => {
    ev.stopPropagation();
    fetchCourseDetails(termSelect ? termSelect.value : '', course.crn);
  });

  // finally add this day's block to the column
  col.appendChild(block);
});

  }); 
}); 


    const backBtn = scheduleContainer.querySelector('#back-to-list');
    if (backBtn) backBtn.addEventListener('click', () => toggleSchedule(false));

    const tbaList = scheduleContainer.querySelector('#tba-list');
    if (tbaList && !tbaList.childElementCount) {
      tbaList.innerHTML = `<p class="text-gray-600 dark:text-gray-400">No TBA courses.</p>`;
    }
  }

  function addCourseToTBA(course, tbaListEl) {
    if (!tbaListEl) return;
    const li = document.createElement('div');
    li.className = 'bg-white dark:bg-gray-700 rounded-lg p-3 shadow flex justify-between items-center';
    const courseNumber = getCourseNumber(course);
    li.innerHTML = `
      <div>
        <div class="font-semibold">${course.subjectCode} ${courseNumber} • ${course.courseName}</div>
        <div class="text-xs text-gray-600 dark:text-gray-300">${course.instructor || 'TBA'} • CRN: ${course.crn}</div>
      </div>
      <div>
        <button class="small-details px-2 py-1 rounded bg-blue-600 text-white text-sm">Details</button>
      </div>
    `;
    li.querySelector('.small-details').addEventListener('click', () => fetchCourseDetails(termSelect ? termSelect.value : '', course.crn));
    tbaListEl.appendChild(li);
  }

  function toggleSchedule(show) {
    const filterControls = document.getElementById('filter-controls');

    if (show) {
      if (bookmarkedCourses.length === 0) {
        alert('Please bookmark one or more courses to see them on the schedule.');
        return;
      }

      if (filterControls) filterControls.classList.add('hidden');
      if (coursesContainer) coursesContainer.classList.add('hidden');
      scheduleContainer.classList.remove('hidden');
      buildSchedule(bookmarkedCourses);
    } else {
      scheduleContainer.classList.add('hidden');
      if (filterControls) filterControls.classList.remove('hidden');
      if (coursesContainer) coursesContainer.classList.remove('hidden');
    }
  }

  if (menuScheduleBtn) {
    menuScheduleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const isScheduleVisible = !scheduleContainer.classList.contains('hidden');
      toggleSchedule(!isScheduleVisible);
      if (menuDropdown) menuDropdown.classList.add('hidden');
    });
  }

  function initButtonStates() {
    document.querySelectorAll('.bookmark-btn').forEach(b => {
      const crn = String(b.dataset.crn);
      if (bookmarkedCourses.some(c => String(c.crn) === crn)) {
        b.innerText = '★';
        b.classList.add('bg-yellow-500');
        b.classList.remove('bg-gray-400');
      } else {
        b.innerText = '☆';
        b.classList.remove('bg-yellow-500');
        b.classList.add('bg-gray-400');
      }
    });
    document.querySelectorAll('.watch-btn').forEach(w => {
      const crn = String(w.dataset.crn);
      if (watchedCourseObjects.some(c => String(c.crn) === crn)) {
        w.classList.add('bg-sky-500');
        w.classList.remove('bg-gray-400');
        w.setAttribute('title', 'Watching');
        w.setAttribute('aria-pressed', 'true');
      } else {
        w.classList.remove('bg-sky-500');
        w.classList.add('bg-gray-400');
        w.setAttribute('title', 'Watch');
        w.setAttribute('aria-pressed', 'false');
      }
    });
  }
  setTimeout(initButtonStates, 350);

});