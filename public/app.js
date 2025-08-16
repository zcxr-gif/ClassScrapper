document.addEventListener('DOMContentLoaded', () => {
  const termSelect = document.getElementById('term-select');
  const subjectSelect = document.getElementById('subject-select');
  const coursesContainer = document.getElementById('courses-container');
  const loadingMessage = document.getElementById('loading-message');
  const modal = document.getElementById('details-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const closeButton = document.querySelector('.close-button');
  const darkToggle = document.getElementById('dark-toggle');
  const root = document.documentElement;

  let termsData = [];

  // --- Subject mapping (code → full name) ---
  const subjectMap = {
    BIO: "Biology",
    ANT: "Anthropology",
    CHEM: "Chemistry",
    ENG: "English",
    MAT: "Mathematics",
    CSC: "Computer Science",
    PSY: "Psychology",
    SOC: "Sociology",
    // ➕ Add more as needed
  };

  // --- Dark mode persistence ---
  if (localStorage.getItem('theme') === 'dark') {
    root.classList.add('dark');
  }

  darkToggle.addEventListener('click', () => {
    root.classList.toggle('dark');
    if (root.classList.contains('dark')) {
      localStorage.setItem('theme', 'dark');
    } else {
      localStorage.setItem('theme', 'light');
    }
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
    if (term && subject) {
      fetchCourses(term, subject);
    }
  });

  // --- Populate dropdowns ---
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
      const fullName = subjectMap[code] || "Unknown Subject";
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
        displayCourses(data.courses);
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
      coursesContainer.innerHTML = `<p class="text-gray-600">No courses found.</p>`;
      return;
    }

    courses.forEach(course => {
      // Extract the course number from the courseName (e.g., "ANT 100")
      const courseNumberMatch = course.courseName.match(/\d{3}/);
      const courseNumber = courseNumberMatch ? courseNumberMatch[0] : "";

      const scheduleInfo = course.schedule.map(s => {
        const location = s.where.toUpperCase().includes("ONLINE")
          ? "Online"
          : `In-person @ ${s.where}`;
        return `<p class="text-sm text-gray-600 dark:text-gray-400">${s.days} ${s.time} • ${location}</p>`;
      }).join("");

      const card = document.createElement('div');
      card.className = "bg-white dark:bg-gray-800 rounded-xl shadow hover:shadow-lg transition p-5 flex flex-col justify-between";

      card.innerHTML = `
        <div>
          <h3 class="text-lg font-semibold text-blue-700 dark:text-blue-400">${course.subjectCode} ${courseNumber} – ${course.courseName}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">CRN: ${course.crn}</p>
          <p class="mt-1 font-medium">Instructor: ${course.instructor}</p>
          <div class="mt-2 space-y-1">${scheduleInfo}</div>
        </div>
        <div class="mt-4">
          <button 
            class="details-btn bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg w-full"
            data-term="${termSelect.value}" data-crn="${course.crn}">
            View Details
          </button>
        </div>
      `;
      coursesContainer.appendChild(card);
    });
  }

  coursesContainer.addEventListener('click', (event) => {
    if (event.target.classList.contains('details-btn')) {
      const term = event.target.dataset.term;
      const crn = event.target.dataset.crn;
      fetchCourseDetails(term, crn);
    }
  });

  // --- Fetch & display details ---
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

    let seats = details.seats?.capacity
      ? `
        <div>
          <p class="font-semibold">Seats</p>
          <p>Total: ${details.seats.capacity}</p>
          <p>Taken: ${details.seats.actual}</p>
          <p>Remaining: ${details.seats.remaining}</p>
        </div>`
      : `<div><p class="font-semibold">Seats</p><p>Not available</p></div>`;

    let waitlist = details.waitlist?.capacity
      ? `
        <div>
          <p class="font-semibold">Waitlist</p>
          <p>Total: ${details.waitlist.capacity}</p>
          <p>Taken: ${details.waitlist.actual}</p>
          <p>Remaining: ${details.waitlist.remaining}</p>
        </div>`
      : `<div><p class="font-semibold">Waitlist</p><p>Not available</p></div>`;

    modalBody.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p><span class="font-semibold">Term:</span> ${details.associatedTerm}</p>
          <p><span class="font-semibold">Levels:</span> ${details.levels}</p>
          <p><span class="font-semibold">Credits:</span> ${details.credits}</p>
        </div>
        <div class="flex gap-4">${seats}${waitlist}</div>
      </div>
    `;
    modal.classList.remove('hidden');
  }

  // --- Modal close handlers ---
  closeButton.addEventListener('click', () => modal.classList.add('hidden'));
  window.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
});
