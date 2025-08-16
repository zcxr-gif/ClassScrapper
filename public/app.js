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

  // --- Options Panel ---
  const optionsToggle = document.createElement('button');
  optionsToggle.id = 'options-toggle';
  optionsToggle.className = 'fixed top-4 left-4 z-50 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg transition';
  optionsToggle.textContent = '☰ Options';
  document.body.appendChild(optionsToggle);

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

  optionsToggle.addEventListener('click', () => optionsPanel.classList.toggle('-translate-x-full'));
  closeOptionsBtn.addEventListener('click', () => optionsPanel.classList.add('-translate-x-full'));

  // --- Close options panel when clicking outside ---
  document.addEventListener('click', (e) => {
    const isClickInside = optionsPanel.contains(e.target) || optionsToggle.contains(e.target);
    if (!isClickInside) {
      optionsPanel.classList.add('-translate-x-full');
    }
  });

  // --- Data ---
  let termsData = [];
  let allCourses = [];
  let bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
  let watchedCourses = JSON.parse(localStorage.getItem('watchedCourses') || '[]');

  const subjectMap = {
    ANT: 'Anthropology', ARC: 'Architectural Technology', ART: 'Art History',
    AIM: 'AI Management', AVN: 'Aviation', BIO: 'Biology',
    BUS: 'Business', CHM: 'Chemistry', CSC: 'Computer Science'
  };
  const subjectColorMap = { ANT: 'bg-red-400', ARC: 'bg-green-400', ART: 'bg-blue-400', AIM: 'bg-yellow-400', AVN: 'bg-purple-400', BIO: 'bg-pink-400', BUS: 'bg-indigo-400', CHM: 'bg-teal-400', CSC: 'bg-orange-400' };

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
});
