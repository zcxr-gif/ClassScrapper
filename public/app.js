document.addEventListener('DOMContentLoaded', () => {
  const termSelect = document.getElementById('term-select');
  const subjectSelect = document.getElementById('subject-select');
  const coursesContainer = document.getElementById('courses-container');
  const loadingMessage = document.getElementById('loading-message');
  const modal = document.getElementById('details-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const closeButton = document.querySelector('.close-button');

  let termsData = [];

  // Fetch terms
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
    subjects.forEach(subj => {
      const option = document.createElement('option');
      option.value = subj;
      option.textContent = subj; // Could map to full names later
      subjectSelect.appendChild(option);
    });
  }

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
      const scheduleInfo = course.schedule.map(s => {
        const location = s.where.toUpperCase().includes("ONLINE") ? "Online" : `In-person @ ${s.where}`;
        return `<p class="text-sm text-gray-600">${s.days} ${s.time} • ${location}</p>`;
      }).join("");

      const card = document.createElement('div');
      card.className = "bg-white rounded-xl shadow hover:shadow-lg transition p-5 flex flex-col justify-between";

      card.innerHTML = `
        <div>
          <h3 class="text-lg font-semibold text-blue-700">${course.courseName} (${course.section})</h3>
          <p class="text-sm text-gray-500">CRN: ${course.crn}</p>
          <p class="mt-1 font-medium text-gray-800">Instructor: ${course.instructor}</p>
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
      ? `<p><strong>Seats:</strong> ${details.seats.remaining} / ${details.seats.capacity}</p>`
      : `<p>Seats: Not available</p>`;

    let waitlist = details.waitlist?.capacity
      ? `<p><strong>Waitlist:</strong> ${details.waitlist.remaining} / ${details.waitlist.capacity}</p>`
      : `<p>Waitlist: Not available</p>`;

    modalBody.innerHTML = `
      <p><strong>Term:</strong> ${details.associatedTerm}</p>
      <p><strong>Levels:</strong> ${details.levels}</p>
      <p><strong>Credits:</strong> ${details.credits}</p>
      ${seats}
      ${waitlist}
    `;
    modal.classList.remove('hidden');
  }

  closeButton.addEventListener('click', () => modal.classList.add('hidden'));
  window.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
});
