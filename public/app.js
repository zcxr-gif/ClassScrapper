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

  // Bookmarks elements
  const showBookmarksBtn = document.getElementById('show-bookmarks');
  const bookmarksList = document.getElementById('bookmarks-list');

  // Floating bookmarks panel (bottom right)
  let bookmarksPanel = document.getElementById('bookmarks-panel');
  if (!bookmarksPanel) {
    bookmarksPanel = document.createElement('div');
    bookmarksPanel.id = 'bookmarks-panel';
    bookmarksPanel.className = 'fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-4 rounded-lg shadow-md w-72 max-h-[60vh] overflow-auto hidden';
    bookmarksPanel.innerHTML = `
      <h3 class="font-bold mb-2">Bookmarked Courses</h3>
      <ul id="bookmarks-list" class="space-y-1"></ul>
      <button id="close-bookmarks" class="mt-2 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 px-3 py-1 rounded-lg w-full">Close</button>
    `;
    document.body.appendChild(bookmarksPanel);
  }
  const closeBookmarksBtn = bookmarksPanel.querySelector('#close-bookmarks');

  // Floating watched courses panel
  let watchedPanel = document.getElementById('watched-panel');
  if (!watchedPanel) {
    watchedPanel = document.createElement('div');
    watchedPanel.id = 'watched-panel';
    watchedPanel.className = 'fixed bottom-4 left-4 z-50 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-4 rounded-lg shadow-md w-72 max-h-[60vh] overflow-auto hidden';
    watchedPanel.innerHTML = `
      <h3 class="font-bold mb-2">Watched Courses</h3>
      <ul id="watched-list" class="space-y-1"></ul>
      <button id="close-watched" class="mt-2 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 px-3 py-1 rounded-lg w-full">Close</button>
    `;
    document.body.appendChild(watchedPanel);
  }
  const watchedList = watchedPanel.querySelector('#watched-list');
  const closeWatchedBtn = watchedPanel.querySelector('#close-watched');

  // Optional search/filter/sort elements
  const searchInput = document.getElementById('course-search');
  const sortSelect = document.getElementById('sort-courses');
  const typeFilter = document.getElementById('filter-type');
  const levelFilter = document.getElementById('filter-level');
  const availabilityFilter = document.getElementById('filter-availability');

  let termsData = [];
  let allCourses = [];
  let bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
  let watchedCourses = []; // Stores watched CRNs

  const subjectMap = {
    ANT: 'Anthropology', ARC: 'Architectural Technology', ART: 'Art History',
    AIM: 'Artificial Intelligence Mgmt', AVN: 'Aviation', BIO: 'Biology',
    BUS: 'Business', CHM: 'Chemistry', CSC: 'Computer Science'
  };
  const subjectColorMap = { ANT: 'bg-red-400', ARC: 'bg-green-400', ART: 'bg-blue-400', AIM: 'bg-yellow-400', AVN: 'bg-purple-400', BIO: 'bg-pink-400', BUS: 'bg-indigo-400', CHM: 'bg-teal-400', CSC: 'bg-orange-400' };

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

  // --- Fetch terms ---
  fetch('/terms')
    .then(res => res.json())
    .then(data => {
      termsData = data;
      populateTerms(data);
      termSelect.disabled = false;
    })
    .catch(err => {
      console.error('Error fetching terms:', err);
      termSelect.innerHTML = '<option>Error loading terms</option>';
    });

  termSelect.addEventListener('change', () => {
    const selectedTermCode = termSelect.value;
    if (selectedTermCode) {
      const selectedTerm = termsData.find(t => t.termCode === selectedTermCode);
      populateSubjects(selectedTerm.subjects);
      subjectSelect.disabled = false;
    } else {
      subjectSelect.innerHTML = '<option>Select a term first</option>';
      subjectSelect.disabled = true;
    }
    coursesContainer.innerHTML = '';
  });

  subjectSelect.addEventListener('change', () => {
    const term = termSelect.value;
    const subject = subjectSelect.value;
    if (term && subject) fetchCourses(term, subject);
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
      const fullName = subjectMap[code] || code;
      const option = document.createElement('option');
      option.value = code;
      option.textContent = `${code} – ${fullName}`;
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
      .catch(err => {
        loadingMessage.classList.add('hidden');
        console.error('Error fetching courses:', err);
        coursesContainer.innerHTML = `<p class="text-red-600">Error loading courses.</p>`;
      });
  }

  function displayCourses(courses) {
    coursesContainer.innerHTML = '';
    if (courses.length === 0) {
      coursesContainer.innerHTML = `<p class="text-gray-600 dark:text-gray-400">No courses found.</p>`;
      return;
    }

    courses.forEach(course => {
      const courseNumberMatch = course.courseName.match(/\d{3}/);
      const courseNumber = courseNumberMatch ? courseNumberMatch[0] : "";
      const scheduleInfo = course.schedule?.map(s => {
        const location = s.where.toUpperCase().includes("ONLINE") ? "Online" : `In-person @ ${s.where}`;
        return `<p class="text-sm text-gray-600 dark:text-gray-400">${s.days} ${s.time} • ${location}</p>`;
      }).join("") || '';

      const seatsPercent = course.seats ? (course.seats.actual / course.seats.capacity) * 100 : 0;
      const seatsColor = seatsPercent > 80 ? 'bg-red-500' : seatsPercent > 50 ? 'bg-yellow-400' : 'bg-green-500';

      const card = document.createElement('div');
      card.className = "bg-white dark:bg-gray-800 rounded-xl shadow hover:shadow-lg transition p-5 flex flex-col justify-between";

      card.innerHTML = `
        <div>
          <h3 class="text-lg font-semibold ${subjectColorMap[course.subjectCode] || 'text-blue-700'}">
            ${course.subjectCode} ${courseNumber} – ${course.courseName}
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">CRN: ${course.crn}</p>
          <p class="mt-1 font-medium">Instructor: ${course.instructor}</p>
          <div class="mt-2 space-y-1">${scheduleInfo}</div>
          ${course.seats ? `<div class="w-full h-2 rounded bg-gray-200 dark:bg-gray-700 mt-1">
            <div class="h-2 rounded ${seatsColor}" style="width:${seatsPercent}%;"></div>
          </div>` : ''}
        </div>
        <div class="mt-4 flex flex-col gap-2">
          <button 
            class="details-btn bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg w-full"
            data-term="${termSelect.value}" data-crn="${course.crn}">
            View Details
          </button>
          <a href="https://oasis.farmingdale.edu/pls/prod/twbkwbis.P_WWWLogin" target="_blank"
             class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg w-full text-center">
             Sign Up in OASIS
          </a>
          <button class="bookmark-btn ${bookmarks.includes(course.crn) ? 'bg-yellow-500' : 'bg-gray-300'} hover:bg-yellow-400 text-white px-4 py-2 rounded-lg w-full"
                  data-crn="${course.crn}">
            ${bookmarks.includes(course.crn) ? '★ Bookmarked' : '☆ Bookmark'}
          </button>
          <button class="watch-btn ${watchedCourses.includes(course.crn) ? 'bg-blue-500' : 'bg-gray-300'} text-white px-4 py-2 rounded-lg w-full"
                  data-crn="${course.crn}" data-term="${termSelect.value}">
            ${watchedCourses.includes(course.crn) ? 'Watching' : 'Watch'}
          </button>
        </div>
      `;
      coursesContainer.appendChild(card);
    });
  }

  // --- Event delegation ---
  coursesContainer.addEventListener('click', event => {
    if (event.target.classList.contains('details-btn')) {
      fetchCourseDetails(termSelect.value, event.target.dataset.crn);
    }
    if (event.target.classList.contains('bookmark-btn')) toggleBookmark(event.target);
    if (event.target.classList.contains('watch-btn')) toggleWatch(event.target);
  });

  function toggleBookmark(button) {
    const crn = button.dataset.crn;
    if (bookmarks.includes(crn)) bookmarks = bookmarks.filter(b => b !== crn);
    else bookmarks.push(crn);
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));

    button.classList.toggle('bg-yellow-500', bookmarks.includes(crn));
    button.classList.toggle('bg-gray-300', !bookmarks.includes(crn));
    button.textContent = bookmarks.includes(crn) ? '★ Bookmarked' : '☆ Bookmark';
    updateBookmarksPanel();
  }

  function toggleWatch(button) {
    const term = button.dataset.term;
    const crn = button.dataset.crn;
    const isWatching = watchedCourses.includes(crn);

    fetch(`/watch/${term}/${crn}`, { method: isWatching ? 'DELETE' : 'POST' })
      .then(res => res.json())
      .then(() => {
        if (isWatching) watchedCourses = watchedCourses.filter(c => c !== crn);
        else watchedCourses.push(crn);
        button.textContent = isWatching ? 'Watch' : 'Watching';
        button.classList.toggle('bg-blue-500', !isWatching);
        button.classList.toggle('bg-gray-300', isWatching);
        updateWatchedPanel();
      })
      .catch(err => console.error('Error toggling watch:', err));
  }

  // --- Bookmarks panel ---
  showBookmarksBtn.addEventListener('click', () => {
    updateBookmarksPanel();
    bookmarksPanel.classList.toggle('hidden');
  });
  closeBookmarksBtn.addEventListener('click', () => bookmarksPanel.classList.add('hidden'));
  function updateBookmarksPanel() {
    bookmarksList.innerHTML = '';
    if (bookmarks.length === 0) { bookmarksList.innerHTML = '<li>No bookmarks yet.</li>'; return; }
    bookmarks.forEach(crn => {
      const course = allCourses.find(c => c.crn === crn) || { crn, courseName: "Unknown Course", subjectCode: "" };
      const li = document.createElement('li');
      li.className = "border-b border-gray-200 dark:border-gray-700 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1";
      li.textContent = `${course.subjectCode} ${course.courseName} (CRN: ${course.crn})`;
      li.addEventListener('click', () => { bookmarksPanel.classList.add('hidden'); fetchCourseDetails(termSelect.value, course.crn); });
      bookmarksList.appendChild(li);
    });
  }

  // --- Watched panel ---
  closeWatchedBtn.addEventListener('click', () => watchedPanel.classList.add('hidden'));
  function updateWatchedPanel() {
    watchedList.innerHTML = '';
    if (watchedCourses.length === 0) { watchedList.innerHTML = '<li>No watched courses.</li>'; return; }
    watchedCourses.forEach(crn => {
      const course = allCourses.find(c => c.crn === crn) || { crn, courseName: "Unknown Course", subjectCode: "" };
      const li = document.createElement('li');
      li.className = "border-b border-gray-200 dark:border-gray-700 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1";
      li.textContent = `${course.subjectCode} ${course.courseName} (CRN: ${course.crn})`;
      li.addEventListener('click', () => { watchedPanel.classList.add('hidden'); fetchCourseDetails(termSelect.value, course.crn); });
      watchedList.appendChild(li);
    });
  }

  // --- Modal & course details ---
  function fetchCourseDetails(term, crn) {
    fetch(`/course-details/${term}/${crn}`)
      .then(res => res.json())
      .then(details => displayCourseDetails(details))
      .catch(err => {
        console.error('Error fetching course details:', err);
        modalBody.innerHTML = '<p class="text-red-600">Error loading details.</p>';
        modal.classList.remove('hidden');
      });
  }

  function displayCourseDetails(details) {
    modalTitle.textContent = details.title;
    const seats = details.seats?.capacity
      ? `<div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
          <p class="font-semibold">Seats</p>
          <p>Total: ${details.seats.capacity}</p>
          <p>Taken: ${details.seats.actual}</p>
          <p>Remaining: ${details.seats.remaining}</p>
        </div>` : `<div><p class="font-semibold">Seats</p><p>Not available</p></div>`;

    const waitlist = details.waitlist?.capacity
      ? `<div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
          <p class="font-semibold">Waitlist</p>
          <p>Total: ${details.waitlist.capacity}</p>
          <p>Taken: ${details.waitlist.actual}</p>
          <p>Remaining: ${details.waitlist.remaining}</p>
        </div>` : `<div><p class="font-semibold">Waitlist</p><p>Not available</p></div>`;

    modalBody.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <p><span class="font-semibold">Term:</span> ${details.associatedTerm}</p>
          <p><span class="font-semibold">Levels:</span> ${details.levels}</p>
          <p><span class="font-semibold">Credits:</span> ${details.credits}</p>
        </div>
        <div class="flex gap-4">${seats}${waitlist}</div>
      </div>
      <div class="mt-4 flex flex-col gap-2">
        <a href="https://oasis.farmingdale.edu/pls/prod/twbkwbis.P_WWWLogin" target="_blank"
           class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg inline-block">
           Sign Up in OASIS
        </a>
      </div>
    `;
    modal.classList.remove('hidden');
  }

  const closeModal = () => modal.classList.add('hidden');
  modal.addEventListener('click', e => { if(e.target === modal) closeModal(); });
  modal.querySelector('.close-button').addEventListener('click', closeModal);
  window.addEventListener('keydown', e => { if(e.key === "Escape") closeModal(); });

  // --- Search/filter/sort ---
  if(searchInput) searchInput.addEventListener('input', applySearchAndFilters);
  [typeFilter, levelFilter, availabilityFilter].forEach(f => f?.addEventListener('change', applySearchAndFilters));
  if(sortSelect) sortSelect.addEventListener('change', applySearchAndFilters);

  function applySearchAndFilters() {
    let filtered = [...allCourses];
    const query = searchInput?.value.toLowerCase() || '';

    if(query) filtered = filtered.filter(c =>
      c.courseName.toLowerCase().includes(query) ||
      c.instructor.toLowerCase().includes(query) ||
      String(c.crn).includes(query)
    );

    if(typeFilter?.value) filtered = filtered.filter(c =>
      typeFilter.value === 'online'
        ? c.schedule.some(s => s.where.toUpperCase().includes("ONLINE"))
        : c.schedule.some(s => !s.where.toUpperCase().includes("ONLINE"))
    );

    if(levelFilter?.value) filtered = filtered.filter(c => c.courseName.match(/\d{3}/)[0].startsWith(levelFilter.value));

    if(availabilityFilter?.value) filtered = filtered.filter(c => {
      if(!c.seats) return false;
      return availabilityFilter.value === 'open' ? c.seats.remaining > 0 : c.seats.remaining === 0;
    });

    const sortBy = sortSelect?.value;
    if(sortBy){
      if(sortBy === 'courseNumber') filtered.sort((a,b) => a.courseName.localeCompare(b.courseName));
      if(sortBy === 'instructor') filtered.sort((a,b) => a.instructor.localeCompare(b.instructor));
      if(sortBy === 'seatsRemaining') filtered.sort((a,b) => (b.seats?.remaining || 0) - (a.seats?.remaining || 0));
    }

    displayCourses(filtered);
  }
});
