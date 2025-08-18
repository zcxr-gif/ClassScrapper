// app.js (UPDATED)
// - Fixes: level & availability filters
// - UI: cleaner course cards, CRN copy button
// - Keeps: options panel, schedule view, bookmarks/watch, modal, dark mode

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
  menuToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menuDropdown.classList.toggle('hidden');
  });

  // --- Options Panel (slide-out) ---
  const optionsPanel = document.createElement('div');
  optionsPanel.id = 'options-panel';
  optionsPanel.className = 'fixed top-0 left-0 z-50 h-full w-80 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-4 shadow-lg transform -translate-x-full transition-transform duration-300';
  optionsPanel.innerHTML = `
    <h3 class="text-xl font-bold mb-2">📚 Your Courses</h3>
    <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
      View bookmarked and watched courses. Use ✖ to remove.
    </p>
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

  menuOptionsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    optionsPanel.classList.remove('-translate-x-full');
    menuDropdown.classList.add('hidden');
  });
  closeOptionsBtn.addEventListener('click', () => optionsPanel.classList.add('-translate-x-full'));

  // Click outside closes menus/panels
  document.addEventListener('click', (e) => {
    const isClickInsideOptions = optionsPanel.contains(e.target) || menuOptionsBtn.contains(e.target);
    if (!isClickInsideOptions) optionsPanel.classList.add('-translate-x-full');
    if (!menuToggleBtn.contains(e.target)) menuDropdown.classList.add('hidden');
  });

  // --- Data ---
  let termsData = [];
  let allCourses = [];
  let bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
  let watchedCourses = JSON.parse(localStorage.getItem('watchedCourses') || '[]');

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

  const subjectColorMap = {
    ANT: 'bg-red-400', ARC: 'bg-green-400', ART: 'bg-blue-400', AIM: 'bg-yellow-400',
    AET: 'bg-lime-500', AVN: 'bg-purple-400', BIO: 'bg-pink-400', BUS: 'bg-indigo-400',
    CHM: 'bg-teal-400', CHI: 'bg-red-500', CIV: 'bg-gray-500', CSC: 'bg-orange-400',
    CPS: 'bg-sky-500', BCS: 'bg-cyan-400', CON: 'bg-amber-500', CRJ: 'bg-rose-500',
    DEN: 'bg-teal-300', ECO: 'bg-green-500', EET: 'bg-blue-500', ETM: 'bg-violet-400',
    EGL: 'bg-rose-400', ENV: 'bg-emerald-400', FYE: 'bg-gray-400', FRE: 'bg-blue-300',
    FRX: 'bg-indigo-300', GIS: 'bg-emerald-600', GEO: 'bg-lime-600', GER: 'bg-amber-400',
    GRO: 'bg-fuchsia-400', HPW: 'bg-green-300', HIS: 'bg-orange-500', HON: 'bg-yellow-300',
    HOR: 'bg-lime-400', HUM: 'bg-pink-300', IND: 'bg-cyan-500', IXD: 'bg-sky-400',
    ITA: 'bg-green-600', MTH: 'bg-indigo-500', MET: 'bg-gray-600', MLS: 'bg-teal-500',
    MLG: 'bg-red-300', NUR: 'bg-rose-300', NTR: 'bg-lime-300', PHI: 'bg-purple-300',
    PED: 'bg-sky-300', PHY: 'bg-orange-300', POL: 'bg-indigo-600', PCM: 'bg-fuchsia-500',
    PSY: 'bg-violet-500', RAM: 'bg-yellow-500', RUS: 'bg-red-600', STS: 'bg-gray-500',
    SST: 'bg-sky-600', SOC: 'bg-pink-500', SPA: 'bg-orange-600', SPE: 'bg-fuchsia-300',
    SMT: 'bg-blue-600', THE: 'bg-purple-500', VIS: 'bg-amber-300'
  };

  // --- Schedule config ---
  const SCHEDULE_START_HOUR = 7; // 7 AM
  const SCHEDULE_END_HOUR = 22;  // 10 PM
  const SLOT_MINUTES = 15;       // 15-minute slots
  const SLOTS_PER_DAY = ((SCHEDULE_END_HOUR - SCHEDULE_START_HOUR) * 60) / SLOT_MINUTES;

  // Schedule container added to body (hidden), can be moved into main if desired
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
    if (termSelect.value && subjectSelect.value) fetchCourses(termSelect.value, subjectSelect.value);
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

  // --- Course helpers ---
  function getCourseType(course) {
    if (!course || !Array.isArray(course.schedule) || course.schedule.length === 0) return 'unknown';
    const hasOnline = course.schedule.some(s => (s.where || '').toUpperCase().includes('ONLINE'));
    const hasInPerson = course.schedule.some(s => !((s.where || '').toUpperCase().includes('ONLINE')));
    if (hasOnline && hasInPerson) return 'hybrid';
    if (hasOnline) return 'online';
    if (hasInPerson) return 'inperson';
    return 'unknown';
  }

  function clamp(v, a=0, b=100) { return Math.max(a, Math.min(b, v)); }

  // Robust extraction of the 3-digit course number (100/200/300..)
  function getCourseNumber(course) {
    // prefer an explicit field if backend provides it
    if (course.courseNumber) return String(course.courseNumber).padStart(3, '0');
    // check courseTitle/name for patterns like "SUBJ 101" or "(101)" or standalone 3-digit
    const name = (course.courseName || '') + ' ' + (course.title || '');
    // look for pattern "SUBJ 101" (subject code might appear)
    const subj = course.subjectCode || '';
    if (subj) {
      const reSubj = new RegExp(`${subj}\\s*([0-9]{3})`, 'i');
      const m1 = name.match(reSubj);
      if (m1) return m1[1];
    }
    // fallback: first standalone 3-digit number
    const m2 = name.match(/\b([0-9]{3})\b/);
    if (m2) return m2[1];
    return '';
  }

  // --- Display courses (clean, compact card) ---
  function displayCourses(courses) {
    coursesContainer.innerHTML = '';
    if (!courses.length) {
      coursesContainer.innerHTML = `<p class="text-gray-600 dark:text-gray-400">No courses found.</p>`;
      return;
    }

    courses.forEach(course => {
      const courseNumber = getCourseNumber(course);
      // build schedule lines
      const scheduleInfo = (course.schedule || []).map(s => {
        const where = (s.where || '').toUpperCase();
        const locationEmoji = where.includes('ONLINE') ? '💻 Online' : '🏫 In-person';
        const days = s.days || '';
        const time = s.time || '';
        return `<div class="text-sm text-gray-600 dark:text-gray-400">${days} ${time} • ${locationEmoji}</div>`;
      }).join('');

      // seats progress
      const capacity = Number(course.seats?.capacity) || 0;
      const actual = Number(course.seats?.actual) || 0;
      const remaining = (typeof course.seats?.remaining === 'number') ? course.seats.remaining : (capacity - actual);
      const seatsPercent = capacity === 0 ? 0 : clamp((actual / capacity) * 100, 0, 200);

      const type = getCourseType(course);
      const typeBadge = type === 'online'
        ? `<span class="px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-700 text-blue-800 dark:text-white">Online</span>`
        : type === 'inperson'
        ? `<span class="px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-700 text-green-800 dark:text-white">In-person</span>`
        : type === 'hybrid'
        ? `<span class="px-2 py-1 rounded-full text-xs bg-amber-100 dark:bg-amber-700 text-amber-800 dark:text-white">Hybrid</span>`
        : `<span class="px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">TBA</span>`;

      const card = document.createElement('div');
      card.className = 'bg-white dark:bg-gray-800 rounded-xl shadow hover:shadow-lg transition p-4 flex flex-col justify-between';

      // compact, readable structure
      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 flex items-center justify-center rounded ${subjectColorMap[course.subjectCode] || 'bg-gray-300'} text-white font-bold">${course.subjectCode || ''}</div>
              <div>
                <div class="text-lg font-semibold leading-tight">${course.subjectCode} ${courseNumber ? courseNumber : ''} <span class="text-sm font-medium text-gray-500 dark:text-gray-300">• ${course.courseName}</span></div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">👨‍🏫 ${course.instructor || 'TBA'}</div>
              </div>
            </div>
          </div>
          <div class="text-right space-y-1">
            ${typeBadge}
            <div class="text-xs text-gray-400 dark:text-gray-300">CRN: <span class="font-semibold">${course.crn}</span></div>
          </div>
        </div>

        <div class="mt-3 text-sm text-gray-600 dark:text-gray-400">${scheduleInfo || '<span class="text-xs text-gray-500">Schedule: TBA</span>'}</div>

        ${capacity > 0 ? `<div class="w-full h-2 rounded bg-gray-200 dark:bg-gray-700 mt-3">
          <div class="h-2 rounded ${seatsPercent > 80 ? 'bg-red-500' : seatsPercent > 50 ? 'bg-yellow-400' : 'bg-green-500'}" style="width:${seatsPercent}%;"></div>
        </div>` : ''}

        <div class="mt-4 flex flex-wrap gap-2">
          <button class="details-btn shrink px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm flex-1" data-term="${termSelect.value}" data-crn="${course.crn}">🔍 Details</button>
          <a href="https://oasis.farmingdale.edu/pls/prod/twbkwbis.P_WWWLogin" target="_blank" class="px-3 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm">📝 Sign Up</a>
          <button class="bookmark-btn px-3 py-1 rounded-lg text-white text-sm ${bookmarks.includes(course.crn) ? 'bg-yellow-500' : 'bg-gray-300'}" data-crn="${course.crn}">${bookmarks.includes(course.crn) ? '★ Bookmarked' : '☆ Bookmark'}</button>
          <button class="watch-btn px-3 py-1 rounded-lg text-white text-sm ${watchedCourses.includes(course.crn) ? 'bg-blue-500' : 'bg-gray-300'}" data-crn="${course.crn}" data-term="${termSelect.value}">${watchedCourses.includes(course.crn) ? '👁 Watching' : '👁 Watch'}</button>
          <button class="copy-crn-btn px-3 py-1 rounded-lg text-sm border border-gray-300 dark:border-gray-600">Copy CRN</button>
        </div>
      `;

      coursesContainer.appendChild(card);
    });
  }

  // --- Event delegation for buttons in course list ---
  coursesContainer.addEventListener('click', e => {
    const target = e.target;
    if (target.classList.contains('details-btn')) fetchCourseDetails(termSelect.value, target.dataset.crn);
    if (target.classList.contains('bookmark-btn')) toggleBookmark(target);
    if (target.classList.contains('watch-btn')) toggleWatch(target);
    if (target.classList.contains('copy-crn-btn')) handleCopyButton(target);
  });

  function handleCopyButton(button) {
    // find the CRN in the card (it is in the markup)
    const card = button.closest('div');
    const crnMatch = card ? card.innerText.match(/CRN:\s*([0-9]+)/) : null;
    const crn = crnMatch ? crnMatch[1] : null;
    if (!crn) {
      // fallback: attempt dataset on buttons next to it
      const btnData = card.querySelector('[data-crn]');
      if (btnData) {
        try { navigator.clipboard.writeText(btnData.dataset.crn); showCopyFeedback(button); return; } catch {}
      }
      alert('CRN not found to copy.');
      return;
    }
    // use clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(crn).then(() => showCopyFeedback(button), () => fallbackCopy(crn, button));
    } else {
      fallbackCopy(crn, button);
    }
  }

  function showCopyFeedback(button) {
    const original = button.textContent;
    button.textContent = 'Copied!';
    button.disabled = true;
    setTimeout(() => {
      button.textContent = original;
      button.disabled = false;
    }, 1200);
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

  // --- Bookmark / Watch toggles ---
  function toggleBookmark(button) {
    const crn = button.dataset.crn;
    bookmarks = bookmarks.includes(crn) ? bookmarks.filter(c => c !== crn) : [...bookmarks, crn];
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    button.textContent = bookmarks.includes(crn) ? '★ Bookmarked' : '☆ Bookmark';
    button.classList.toggle('bg-yellow-500', bookmarks.includes(crn));
    button.classList.toggle('bg-gray-300', !bookmarks.includes(crn));
  }

  function toggleWatch(button) {
    const crn = button.dataset.crn;
    const term = button.dataset.term;
    const watching = watchedCourses.includes(crn);
    // optimistic UI: update locally immediately and then call endpoint
    if (!watching) {
      watchedCourses = [...watchedCourses, crn];
      localStorage.setItem('watchedCourses', JSON.stringify(watchedCourses));
      button.textContent = '👁 Watching';
      button.classList.add('bg-blue-500');
      button.classList.remove('bg-gray-300');
      fetch(`/watch/${term}/${crn}`, { method: 'POST' }).catch(() => {/* ignore network errors for now */});
    } else {
      watchedCourses = watchedCourses.filter(c => c !== crn);
      localStorage.setItem('watchedCourses', JSON.stringify(watchedCourses));
      button.textContent = '👁 Watch';
      button.classList.remove('bg-blue-500');
      button.classList.add('bg-gray-300');
      fetch(`/watch/${term}/${crn}`, { method: 'DELETE' }).catch(() => {/* ignore network errors for now */});
    }
  }

  // --- Modal ---
  function fetchCourseDetails(term, crn) {
    modalBody.innerHTML = '<div class="text-center py-6">Loading...</div>';
    modalTitle.textContent = '';
    modal.classList.remove('hidden');
    fetch(`/course-details/${term}/${crn}`)
      .then(res => res.json())
      .then(displayCourseDetails)
      .catch(() => {
        modalBody.innerHTML = '<p class="text-red-600">Error loading details.</p>';
      });
  }

  function displayCourseDetails(details) {
    modalTitle.textContent = details.title || details.courseName || 'Course Details';
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
          <p><span class="font-semibold">Term:</span> ${details.associatedTerm || 'N/A'}</p>
          <p><span class="font-semibold">Levels:</span> ${details.levels || 'N/A'}</p>
          <p><span class="font-semibold">Credits:</span> ${details.credits || 'N/A'}</p>
        </div>
        <div class="flex gap-2 flex-col">${seats}${waitlist}</div>
      </div>
      <div class="mt-4">
        <a href="https://oasis.farmingdale.edu/pls/prod/twbkwbis.P_WWWLogin" target="_blank" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg inline-block">📝 Sign Up in OASIS</a>
      </div>
    `;
  }

  const closeModal = () => modal.classList.add('hidden');
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  modal.querySelector('.close-button').addEventListener('click', closeModal);
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // --- Bookmarks / Watched mini cards in options panel ---
  function populateOptionsList(list, type) {
    optionsList.innerHTML = '';
    if (list.length === 0) {
      optionsList.innerHTML = `<p class="text-gray-500 dark:text-gray-400">No ${type} courses</p>`;
      return;
    }

    list.forEach(crn => {
      const course = allCourses.find(c => c.crn === crn);
      if (!course) {
        // If course not currently loaded, still show CRN
        const liMissing = document.createElement('div');
        liMissing.className = 'bg-white dark:bg-gray-700 rounded-lg p-3 shadow flex justify-between items-center';
        liMissing.innerHTML = `
          <div>
            <div class="font-semibold">CRN ${crn}</div>
            <div class="text-xs text-gray-500 dark:text-gray-300">Course not currently in list</div>
          </div>
          <div>
            <button class="remove-btn text-red-500 text-sm font-bold">✖</button>
          </div>
        `;
        liMissing.querySelector('.remove-btn').addEventListener('click', () => {
          if (type === 'bookmark') {
            bookmarks = bookmarks.filter(c => c !== crn);
            localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
          } else {
            watchedCourses = watchedCourses.filter(c => c !== crn);
            localStorage.setItem('watchedCourses', JSON.stringify(watchedCourses));
          }
          liMissing.remove();
        });
        optionsList.appendChild(liMissing);
        return;
      }

      const li = document.createElement('div');
      li.className = 'bg-white dark:bg-gray-700 rounded-lg p-3 shadow flex flex-col gap-1';
      const courseNumber = getCourseNumber(course);
      const seatsText = course.seats ? `${course.seats.remaining ?? (course.seats.capacity - course.seats.actual)} / ${course.seats.capacity} seats` : 'Seats info N/A';
      li.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <p class="font-semibold text-sm">${course.subjectCode} ${courseNumber} – ${course.courseName}</p>
            <p class="text-xs text-gray-600 dark:text-gray-300">Instructor: ${course.instructor || 'TBA'}</p>
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
        fetchCourseDetails(termSelect.value, crn);
        optionsPanel.classList.add('-translate-x-full');
      });

      li.querySelector('.remove-btn').addEventListener('click', () => {
        if (type === 'bookmark') {
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

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  [typeFilter, levelFilter, availabilityFilter].forEach(f => f?.addEventListener('change', applyFilters));
  if (sortSelect) sortSelect.addEventListener('change', applyFilters);

  function applyFilters() {
    let filtered = [...allCourses];
    const query = (searchInput?.value || '').toLowerCase();

    if (query) filtered = filtered.filter(c =>
      (c.courseName || '').toLowerCase().includes(query) ||
      (c.instructor || '').toLowerCase().includes(query) ||
      String(c.crn || '').includes(query)
    );

    if (typeFilter?.value) {
      filtered = filtered.filter(c => {
        const t = getCourseType(c);
        return t === typeFilter.value;
      });
    }

    // --- Fixed level filter: robust extraction of course number ---
    if (levelFilter?.value) {
      filtered = filtered.filter(c => {
        const num = getCourseNumber(c);
        if (!num) return false;
        return num.charAt(0) === String(levelFilter.value);
      });
    }

    // --- Fixed availability filter: check seats safely ---
    if (availabilityFilter?.value) {
      filtered = filtered.filter(c => {
        if (!c.seats) return false;
        const capacity = Number(c.seats.capacity) || 0;
        const actual = Number(c.seats.actual) || 0;
        const remaining = (typeof c.seats.remaining === 'number') ? c.seats.remaining : (capacity - actual);
        if (capacity === 0) {
          // treat as unknown => exclude (so user sees only courses with real seat data)
          return false;
        }
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

  // --- Schedule helpers (unchanged logic mostly) ---
  function parseDaysString(daysStr) {
    if (!daysStr) return [];
    const s = daysStr.toString().toUpperCase().replace(/\s+/g, '');
    const days = new Set();
    if (s.includes('M')) days.add(0);
    if (s.includes('W')) days.add(2);
    if (s.includes('F')) days.add(4);
    if (s.includes('R')) days.add(3);
    if (s.includes('TH')) days.add(3);
    else if (s.includes('TR')) days.add(3);
    else if (s.includes('T')) days.add(1);

    if (s.includes('MON')) days.add(0);
    if (s.includes('TUE')) days.add(1);
    if (s.includes('WED')) days.add(2);
    if (s.includes('THU')) days.add(3);
    if (s.includes('FRI')) days.add(4);

    return Array.from(days).sort((a, b) => a - b);
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
          const hh = parseInt(parts[0], 10);
          const mm = parseInt(parts[1], 10);
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
    return Math.floor((mins - SCHEDULE_START_HOUR * 60) / SLOT_MINUTES);
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
        if (!days.length || !timeRange) return;
        const { start, end } = timeRange;
        if (end <= SCHEDULE_START_HOUR * 60 || start >= SCHEDULE_END_HOUR * 60) return;
        const clampedStart = Math.max(start, SCHEDULE_START_HOUR * 60);
        const clampedEnd = Math.min(end, SCHEDULE_END_HOUR * 60);
        const slotStart = minutesToSlotIndex(clampedStart);
        const spanSlots = Math.max(1, Math.ceil((clampedEnd - clampedStart) / SLOT_MINUTES));

        days.forEach(dayIndex => {
          const targetCell = scheduleContainer.querySelector(`[data-slot="${slotStart}"][data-day="${dayIndex}"]`);
          if (!targetCell) return;

          const inner = targetCell.firstElementChild;
          const block = document.createElement('div');
          const colorClass = subjectColorMap[course.subjectCode] || 'bg-gray-300';
          block.className = `${colorClass} dark:bg-opacity-80 text-white rounded p-1 absolute left-1 right-1 overflow-hidden shadow cursor-pointer transition-all duration-200`;

          const startOffsetMinutes = clampedStart - (SCHEDULE_START_HOUR * 60 + slotStart * SLOT_MINUTES);
          const topPx = (startOffsetMinutes / SLOT_MINUTES) * slotHeight;
          const heightPx = spanSlots * slotHeight - 2;
          block.style.top = `${topPx}px`;
          block.style.height = `${Math.max(10, heightPx)}px`;
          block.style.zIndex = 20;

          const courseNumber = getCourseNumber(course);

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

  function addCourseToTBA(course, tbaListEl) {
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
    li.querySelector('.small-details').addEventListener('click', () => fetchCourseDetails(termSelect.value, course.crn));
    tbaListEl.appendChild(li);
  }

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

      filterControls.classList.add('hidden');
      coursesContainer.classList.add('hidden');
      scheduleContainer.classList.remove('hidden');
      buildSchedule(bookmarkedCourses);
    } else {
      scheduleContainer.classList.add('hidden');
      filterControls.classList.remove('hidden');
      coursesContainer.classList.remove('hidden');
    }
  }

  menuScheduleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const isScheduleVisible = !scheduleContainer.classList.contains('hidden');
    toggleSchedule(!isScheduleVisible);
    menuDropdown.classList.add('hidden');
  });

});
